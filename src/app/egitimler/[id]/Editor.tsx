"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Baslik from "@/components/Baslik";
import Icon from "@/components/Icon";
import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import EgitimOyun from "@/components/oyun/EgitimOyun";
import CanliOnizleme from "@/components/editor/CanliOnizleme";
import OnizlemeSeridi from "@/components/editor/OnizlemeSeridi";
import SayfaSatiri from "@/components/editor/SayfaSatiri";
import SoruSatiri from "@/components/editor/SoruSatiri";
import SoruOnerici from "@/components/editor/SoruOnerici";
import MetinYapistir from "@/components/editor/MetinYapistir";
import TanimBolumu from "@/components/editor/TanimBolumu";
import YayinKontrol, { YayinRozeti, kartSorunlu, yayinKontrolu } from "@/components/editor/YayinKontrol";
import { KartEkleMenusu } from "@/components/editor/KartTipiMenusu";
import BolumAyraci from "./BolumAyraci";
import KartHaritasi, { type HaritaSatiri } from "./KartHaritasi";
import type { BolumHaritasi } from "@/lib/bolumler";
import { kartGorselleri, type MedyaOzet } from "@/lib/editorMedya";
import { KART_ETIKET, SORU_ETIKET, type Egitim, type KartTipi, type Sayfa, type Soru, type SoruTipi } from "@/lib/tipler";
import type { Rol } from "@/lib/depo";
import {
  egitimGuncelleEylem,
  egitimKopyalaEylem,
  egitimSilEylem,
  sayfaEkleEylem,
  sayfaGuncelleEylem,
  sayfaGeriYukleEylem,
  sayfaSilEylem,
  sayfalariSilEylem,
  sayfalariGeriYukleEylem,
  sayfalariSiralaEylem,
  sayfalariTopluEkleEylem,
  metinKartlariEkleEylem,
  onerilenSorulariEkleEylem,
  soruEkleEylem,
  soruGeriYukleEylem,
  soruGuncelleEylem,
  soruSilEylem,
  taslagaAlEylem,
  yayindanGeriDonEylem,
  yayinlaEylem,
} from "@/app/eylemler";
import {
  bolumBasligiEylem,
  kartCogaltEylem,
  kartKopyalaEylem,
  medyaAltMetinEylem,
  medyaSilEylem,
  oksuzMedyalariTemizleEylem,
  pptxKartlariEkleEylem,
} from "./eylemler";

// Ağır ve nadir kullanılan: PDF motoru ilk açılışta indirilmesin.
const IceriAktar = dynamic(() => import("@/components/editor/IceriAktar"), { ssr: false });

/**
 * EĞİTİM EDİTÖRÜ.
 *
 * SIRALAMA BİLİNÇLİ: tanım → içerik → sorular → yayına hazırlık → (gelişmiş)
 * sınav ayarları. Ayarlar en sonda ve KAPALI çünkü ürün "ayar sormayan ürün"
 * olmalı; hazırlayan hiçbir ayara dokunmadan yayınlayabilmeli.
 *
 * SAĞDA CANLI ÖNİZLEME: hazırlayanın en pahalı hatası, yazdığı şeyin kioskta
 * nasıl göründüğünü ancak yayınladıktan sonra görmesiydi. Önizleme kiosk
 * kartının KENDİSİNİ çiziyor (ithal, kopya değil) — yani burada görünen ile
 * sahada görünen aynı koddan çıkıyor.
 */
export default function Editor({
  egitim,
  sayfalar,
  sorular,
  rol,
  yayinDurumu,
  zorSoruIdleri,
  kolaySoruIdleri,
  istatistik,
  medyalar,
  kategoriler,
  hedefEgitimler,
  kirikGorselIdler,
  oksuzSayisi,
  bolumler,
}: {
  egitim: Egitim;
  sayfalar: Sayfa[];
  sorular: Soru[];
  rol: Rol;
  /**
   * Son yayınlanan sürüm ve taslağın ondan farklı olup olmadığı; hiç
   * yayınlanmadıysa `null`. Karşılaştırma SUNUCUDA yapılır (`surum.ts`).
   */
  yayinDurumu: { surum: number; zaman: string; degisiklikVar: boolean } | null;
  zorSoruIdleri: string[];
  /** Yeterince denenmiş ve HİÇ yanlış yapılmamış sorular. */
  kolaySoruIdleri: string[];
  istatistik: { soruId: string; deneme: number; yanlis: number }[];
  medyalar: MedyaOzet[];
  kategoriler: string[];
  /** Kartın kopyalanabileceği diğer eğitimler (hedefin TASLAĞINA yazılır). */
  hedefEgitimler: { id: string; ad: string }[];
  /** Kayıtta duran ama diskte bulunmayan medya kimlikleri. */
  kirikGorselIdler: string[];
  /** Hiçbir kartta/soruda kullanılmayan medya sayısı. */
  oksuzSayisi: number;
  /** sayfaId → o kartın ÜSTÜNDE başlayan bölümün adı. Yalnız editörde görünür. */
  bolumler: BolumHaritasi;
}) {
  const router = useRouter();
  const [bekle, gecis] = useTransition();
  const { confirm, dialog } = useConfirm();
  const { show, toast } = useToast();
  const [prova, setProva] = useState(false);
  const [ayarlarAcik, setAyarlarAcik] = useState(false);
  const soruSayisiRef = useRef<HTMLInputElement>(null);
  const [seciliId, setSeciliId] = useState<string | null>(null);
  /* TOPLU SEÇİM — kip AÇIKÇA açılır. Kalıcı onay kutuları normal
     düzenlemede gürültü; kırk kartlık listede ise tek tek silmek
     kırk tur demek (kullanıcı gerçekten otuz beş kartı öyle sildi). */
  const [secimKipi, setSecimKipi] = useState(false);
  const [secililer, setSecililer] = useState<Set<string>>(new Set());
  /* Shift ile aralık seçimi için SON dokunulan satır. */
  const sonSecimRef = useRef<string | null>(null);
  const [seritAcik, setSeritAcik] = useState(false);
  /** Dar/orta ekranda harita çekmecesi açık mı? Geniş ekranda rayda duruyor. */
  const [haritaAcik, setHaritaAcik] = useState(false);
  /** Sürüklenen kart ve bırakılacak ARALIK (0..n) — ikisi de çizim için. */
  const [surukleId, setSurukleId] = useState<string | null>(null);
  const [birakIndeks, setBirakIndeks] = useState<number | null>(null);
  /* Kaydedilmemiş tuş vuruşları. Sunucuya yazmak alandan çıkınca olur; bu
     harita YALNIZ önizlemeyi besler, yoksa yazarken yan taraf donuk kalırdı. */
  const [anlik, setAnlik] = useState<Record<string, Record<string, unknown>>>({});
  /* Son başarılı alan kaydının SAATİ. Kaybolan bir bildirim değil kalıcı bir
     satır: alanlar odaktan çıkınca kendiliğinden kaydediyor, yani "kaydettim
     mi" sorusu sürekli açık kalıyordu ve tek yanıt sayfanın en dibindeydi. */
  const [sonKayit, setSonKayit] = useState<Date | null>(null);
  const kilit = useRef(false);

  const yayinda = egitim.durum === "yayin";
  const onaylayabilir = rol === "onaylayan" || rol === "yonetici";

  /**
   * Çift tıklama kilidi `useRef` ile — state kilidi yarışı kaybediyor.
   *
   * `useCallback`: bu iki yardımcı aşağıdaki bütün satır geri çağrılarının
   * bağımlılığı. Her çizimde yeniden üretilselerdi geri çağrılar da yenilenir
   * ve `memo` hiçbir satırı koruyamazdı.
   */
  const calistir = useCallback(
    (is: () => Promise<void>) => {
      if (kilit.current) return;
      kilit.current = true;
      gecis(async () => {
        try {
          await is();
        } finally {
          kilit.current = false;
          router.refresh();
        }
      });
    },
    [gecis, router],
  );

  /**
   * ALAN KAYDI — kilitsiz, bilerek.
   *
   * Çift tıklama kilidi ekle/sil/sırala gibi bir kez olması gereken işler için;
   * alandan çıkışta tetiklenen kayıtlar oradan geçmemeli. Bir alandan çıkıp
   * hemen diğerine yazan kişinin İKİNCİ düzenlemesi kilide takılıp sessizce
   * düşüyordu — ve canlı önizleme onu kaydedilmiş gibi göstermeye devam
   * ediyordu, yani veri kaybı ekranda görünmüyordu. Alan yamaları idempotent,
   * sırası bozulsa da aynı sonucu verir.
   */
  const kaydet = useCallback(
    (is: () => Promise<void>) => {
      gecis(async () => {
        try {
          await is();
          setSonKayit(new Date());
        } finally {
          router.refresh();
        }
      });
    },
    [gecis, router],
  );

  const yayinaHazir = sayfalar.length > 0;
  /**
   * EDİTÖR ARTIK HİÇ KİLİTLENMİYOR.
   *
   * Eskiden `kilitli = yayinda` idi ve bunun bedeli görünürdü: yayındaki bir
   * eğitimde tek bir yazım hatasını düzeltmek için eğitimi kiosktan düşürmek
   * gerekiyordu. Sürümlü yayınla düzenleme TASLAĞA yazılıyor, saha son
   * yayınlanan sürümü oynatıyor — yani düzenlemenin sahaya sızma yolu YOK.
   *
   * Değişken duruyor ve alt bileşenlere geçmeye devam ediyor: `kilitli` bir
   * yüzey sözleşmesi (satır, harita, ayraç hepsi onu bekliyor) ve ileride
   * başka bir sebeple (ör. salt okunur rol) geri gelebilir. Bugün sabit `false`.
   */
  const kilitli = false;

  /** Yayınlanmamış değişiklik — rozetin ve "yayındaki hâline dön"ün koşulu. */
  const yayinlanmamisVar = !!yayinDurumu?.degisiklikVar;


  /**
   * GÖVDEYİ YENİDEN KURMA ANAHTARI — içerik SUNUCUDAN toptan değişince.
   *
   * Editördeki alanlar KONTROLSÜZ (`defaultValue`), bilerek: her tuş vuruşunu
   * React durumuna bağlamak, otomatik kayıt ve canlı önizleme ile birlikte
   * imleci oynatıyordu. Bunun bedeli tek bir yerde ortaya çıkıyor —
   * "yayındaki hâline dön". Kartlar aynı KİMLİKLE geri geliyor (bölüm
   * başlıkları ve soru istatistiği bunun için kimliği koruyor), React
   * satırları yeniden kurmuyor ve alanlarda ESKİ yazı kalıyor: sunucu doğru,
   * ekran yanlış. Uçtan uca sınav bunu yakaladı.
   *
   * ANAHTAR YÜK TAŞIYOR — ölçüldü: `key` kaldırılınca uçtan uca sınav geri
   * dönüşten sonra alanda hâlâ eski yazıyı buluyor.
   *
   * Anahtarı eylemin İÇİNDEN artırmak çözmez: `calistir` önce eylemi koşuyor,
   * `router.refresh()` ondan SONRA dönüyor — yeniden kurma taze veri gelmeden
   * olur ve hiçbir işe yaramaz. Bu yüzden ölçüt SUNUCUNUN cevabı: "taslak
   * yayınla aynı" durumuna GEÇİŞ.
   * Bu geçiş yalnız iki yerde olur — geri dönüş ve yayınlama; ikisinde de
   * kullanıcı bir düğmeye basmıştır, kimse yazarken imlecini kaybetmez. Ters
   * yön (ilk tuş vuruşuyla "değişiklik var" olmak) BİLEREK dışarıda.
   */
  const [tazeleme, setTazeleme] = useState(0);
  const oncekiDegisiklik = useRef(yayinlanmamisVar);
  useEffect(() => {
    if (oncekiDegisiklik.current && !yayinlanmamisVar) setTazeleme((n) => n + 1);
    oncekiDegisiklik.current = yayinlanmamisVar;
  }, [yayinlanmamisVar]);


  const gosterilen = useMemo(() => sayfalar.map((s) => birlestir(s, anlik[s.id])), [sayfalar, anlik]);

  /**
   * YENİ GELEN KART — belirerek girsin, bir anda bitmesin.
   *
   * Ekleme sunucu eylemi; `router.refresh()` dönünce liste TOPTAN yeniden
   * çiziliyor ve kart hiçbir ara durum olmadan ekranda beliriveriyordu. Göz
   * bunu "bir şeyler ters gitti de düzeldi" diye okuyor — kullanıcı da öyle
   * bildirdi ("oluştururken hata oluşuyor gibi").
   *
   * Kimliği ÖNCEKİ ÇİZİMLE KARŞILAŞTIRARAK buluyoruz: sunucudan dönen kimliği
   * beklemeye gerek yok, listede olmayan kimlik yeni kimliktir. Sıralama ve
   * silme de listeyi değiştirir ama oralarda YENİ kimlik doğmaz, dolayısıyla
   * animasyon yanlışlıkla tetiklenmez.
   */
  const oncekiIdler = useRef<Set<string>>(new Set(sayfalar.map((s) => s.id)));
  const [yeniKartId, setYeniKartId] = useState<string | null>(null);

  useEffect(() => {
    const simdiki = sayfalar.map((s) => s.id);
    const yeni = simdiki.find((id) => !oncekiIdler.current.has(id));
    oncekiIdler.current = new Set(simdiki);
    if (!yeni) return;

    setYeniKartId(yeni);
    /* İşaret TEMİZLENİR: kalırsa kart her yeniden çizimde (her tuş vuruşunda
       liste yeniden kuruluyor) baştan animasyona girer ve titrer. */
    const t = setTimeout(() => setYeniKartId(null), 600);
    return () => clearTimeout(t);
  }, [sayfalar]);
  const secili = gosterilen.find((s) => s.id === seciliId) ?? gosterilen[0] ?? null;
  const seciliSira = secili ? gosterilen.findIndex((s) => s.id === secili.id) + 1 : 0;

  const istatistikHarita = useMemo(() => new Map(istatistik.map((i) => [i.soruId, i])), [istatistik]);
  const kontrol = useMemo(
    () => yayinKontrolu(egitim, gosterilen, sorular, kirikGorselIdler),
    [egitim, gosterilen, sorular, kirikGorselIdler],
  );

  /**
   * SAHADA KİLİTLEYEN KUSURLA YAYINLAMA — engellenmez ama SORULUR.
   *
   * Ürünün ilkesi "engelleme, söyle" ve doğru: zorunlu tutulan her kontrol
   * ikinci haftada anlamsız bir metin yazılarak aşılır. Ama kontrol listesinde
   * "3 uyarı" yazan bir rozetle yayınlanan eğitimde işçinin karşısına
   * cevaplanamayan bir soru ekranı çıkabiliyordu — kozmetik kusurla sahayı
   * durduran kusur aynı sarı satırdaydı.
   *
   * Onay penceresi yalnız KİLİT varken açılıyor; temiz yayında tek tık
   * korunuyor, yoksa her yayınlamaya sürtünme eklemiş olurduk.
   */
  const yayinla = useCallback(() => {
    const kilitler = kontrol.filter((k) => k.durum === "kilit");
    const gonder = () => calistir(() => yayinlaEylem(egitim.id));
    if (kilitler.length === 0) return gonder();

    confirm(
      {
        title: "Sahada kilitleyen kusurla yayınlansın mı?",
        message:
          `${kilitler.length} kusur işçinin ekranında ilerlemeyi durdurur:\n\n` +
          kilitler.map((k) => `• ${k.metin}`).join("\n") +
          "\n\nYine de yayınlayabilirsiniz; kayıt geçerli olur ama işçi o soruda takılır.",
        confirmLabel: "Yine de yayınla",
        danger: true,
      },
      gonder,
    );
  }, [kontrol, calistir, confirm, egitim.id]);

  /* HARİTA SATIRLARI. Her tuş vuruşunda yeniden kuruluyor ve bu İSTENEN
     davranış: başlığı yazarken haritadaki satır da anında düzeliyor, yani
     "(başlıksız)" uyarısı düzeltilir düzeltilmez kayboluyor. Satırlar
     kağıt gibi hafif (üç metin + bir simge), `SayfaSatiri` gibi değil. */
  const kirikKume = useMemo(() => new Set(kirikGorselIdler), [kirikGorselIdler]);
  const haritaSatirlari = useMemo<HaritaSatiri[]>(
    () =>
      gosterilen.map((s, i) => ({
        id: s.id,
        sira: i + 1,
        tip: s.tip,
        baslik: ilkSatir(s.baslik),
        sorunlu: kartSorunlu(s, kirikKume),
        bolum: bolumler[s.id],
      })),
    [gosterilen, kirikKume, bolumler],
  );

  /**
   * BÖLÜM GRUPLARI.
   *
   * Başlık modelde zaten "bu kartın ÜSTÜNDE bölüm başlar" demekti, yani bir
   * başlık sonraki başlığa kadarki tüm kartları kapsıyordu. Ama ekranda hiçbir
   * şey gruplanmıyordu: kartlar düz bir liste hâlinde akıyor, bölüm adı da
   * araya sıkışmış bir satır gibi duruyordu. Hazırlayan haklı olarak "her karta
   * ayrı bölüm girmem gerekiyor, başlıktan farkı yok" diyordu — fark MODELDE
   * vardı, YÜZEYDE yoktu.
   *
   * İlk başlıktan önceki kartlar adsız gruptur ve kaplama çizilmez: boş bir
   * "Bölümsüz" kutusu, olmayan bir şeye ad vermek olurdu.
   */
  const gruplar = useMemo(() => {
    const cikti: { ad: string | null; kartlar: { sayfa: Sayfa; indeks: number }[] }[] = [];
    gosterilen.forEach((sayfa, indeks) => {
      const ad = bolumler[sayfa.id];
      if (ad || cikti.length === 0) cikti.push({ ad: ad ?? null, kartlar: [] });
      cikti[cikti.length - 1].kartlar.push({ sayfa, indeks });
    });
    return cikti;
  }, [gosterilen, bolumler]);

  /**
   * Katlanmış bölümler — kırk kartlık eğitimde telefonda gezinmenin tek yolu.
   * Kimlik olarak bölümün İLK KARTININ kimliği kullanılır: ad değişince katlama
   * durumu kaybolmasın, aynı adlı iki bölüm birbirini katlamasın.
   */
  const [katliBolumler, setKatliBolumler] = useState<Set<string>>(new Set());
  const bolumKatla = useCallback((anahtar: string) => {
    setKatliBolumler((k) => {
      const y = new Set(k);
      if (y.has(anahtar)) y.delete(anahtar);
      else y.add(anahtar);
      return y;
    });
  }, []);

  /* Alt metin, medyanın kendisine yazılıyor (karta değil) — aynı fotoğraf on
     kartta kullanılıyorsa açıklaması on kez yazılmasın. Satırlara HARİTA
     geçiliyor, dizinin kendisi değil: satır başına `find` çağırmak kırk kartta
     kütüphane boyunca kırk tarama demekti. */
  const altMetinler = useMemo(() => {
    const h: Record<string, string> = {};
    for (const m of medyalar) if (m.altMetin) h[m.id] = m.altMetin;
    return h;
  }, [medyalar]);

  /* ── satır geri çağrıları ───────────────────────────────────────────────
     HEPSİ KARARLI (`useCallback`) ve hepsi KİMLİK alıyor. Satıra özel kapanış
     yazmak daha kısa olurdu ama her çizimde yeni bir fonksiyon üretir ve
     `SayfaSatiri`/`SoruSatiri` üzerindeki `memo` hiçbir işe yaramazdı: kart
     metnine yazılan tek harf kırk satırı birden yeniden çizerdi (ölçüldü,
     20–30 ms; tek satır 0,3–0,4 ms).

     Güncel sayfa listesine REF üzerinden bakılıyor: `gosterilen`i bağımlılığa
     koymak geri çağrıları her tuş vuruşunda yenilerdi — çözmeye çalıştığımız
     sorunun ta kendisi. */
  const gosterilenRef = useRef<Sayfa[]>(gosterilen);
  gosterilenRef.current = gosterilen;
  /* Soru listesi de aynı gerekçeyle ref'te: silmeden önce yedeğini almak
     için okunuyor, bağımlılığa girseydi `soruSil` her düzenlemede yenilenirdi. */
  const sorularRef = useRef<Soru[]>(sorular);
  sorularRef.current = sorular;

  /* Klavye kısayolu ve bırakma hesabı ÇİZİM DIŞINDA çalışıyor (belge
     dinleyicisi, `dragend`). Durumu bağımlılığa koymak dinleyiciyi her tuş
     vuruşunda söküp takardı; ref güncel değeri taşır, kimlik sabit kalır. */
  const seciliIdRef = useRef<string | null>(null);
  const surukleIdRef = useRef<string | null>(null);
  surukleIdRef.current = surukleId;
  const birakIndeksRef = useRef<number | null>(null);
  birakIndeksRef.current = birakIndeks;
  const provaRef = useRef(false);
  provaRef.current = prova;
  const haritaAcikRef = useRef(false);
  haritaAcikRef.current = haritaAcik;

  const sayfaSec = useCallback((sayfaId: string) => setSeciliId(sayfaId), []);

  /**
   * Seçimi çevirir. `aralik` (Shift) son dokunulan satırdan buraya kadar
   * hepsini AÇAR — kapatmaz: ardışık kartları toplamak asıl iş, Shift ile
   * yanlışlıkla otuz kartın seçimini kaldırmak geri alınması zor bir sürpriz
   * olurdu.
   */
  const secimDegis = useCallback((sayfaId: string, aralik: boolean) => {
    /* ⚠ ÇAPA GÜNCELLEYİCİNİN DIŞINDA OKUNUP YAZILIR. Önce `sonSecimRef`e
       `setSecililer` geri çağrısının İÇİNDE dokunuyordum ve Shift ile aralık
       hiç çalışmıyordu: React geliştirme kipinde güncelleyiciyi İKİ KEZ
       çağırıyor (saflık denetimi), ikinci turda çapa zaten tıklanan satıra
       eşitlenmiş oluyor ve aralık tek karta iniyordu. Güncelleyici SAF
       kalmalı — yan etki dışarıda. */
    const liste = gosterilenRef.current;
    const son = sonSecimRef.current;
    const a = son ? liste.findIndex((x) => x.id === son) : -1;
    const b = liste.findIndex((x) => x.id === sayfaId);
    sonSecimRef.current = sayfaId;

    setSecililer((onceki) => {
      const yeni = new Set(onceki);
      /* ARALIK YALNIZ EKLER, KALDIRMAZ: ardışık kartları toplamak asıl iş;
         Shift ile otuz kartın seçimini yanlışlıkla düşürmek geri alması zor
         bir sürpriz olurdu. */
      if (aralik && a >= 0 && b >= 0) {
        for (let i = Math.min(a, b); i <= Math.max(a, b); i++) yeni.add(liste[i].id);
        return yeni;
      }
      if (yeni.has(sayfaId)) yeni.delete(sayfaId);
      else yeni.add(sayfaId);
      return yeni;
    });
  }, []);

  const secimKapat = useCallback(() => {
    setSecimKipi(false);
    setSecililer(new Set());
    sonSecimRef.current = null;
  }, []);

  const tumunuSec = useCallback(() => {
    setSecililer((onceki) =>
      onceki.size === gosterilenRef.current.length ? new Set() : new Set(gosterilenRef.current.map((x) => x.id)),
    );
  }, []);

  /**
   * ÖNİZLEME KAYDIRMAYI İZLER.
   *
   * Eskiden önizleme yalnız bir karta TIKLANDIĞINDA değişiyordu. Beş kartlık
   * eğitimde fark edilmez; elli iki kartlıkta kullanıcı aşağı kaydırıp
   * "önizleme çalışmıyor" diyor — ölçüldü, açılışta hiçbir şey seçili
   * olmadığı için ekran 1. kartta duruyordu, oysa 52. kart düzenleniyordu.
   * Önizleme sağda SÜREKLİ duran bir panel; sürekli duran şey baktığın yeri
   * göstermeli.
   *
   * ÖLÇÜT "en çok görünen" DEĞİL, EKRANIN ÜST ÜÇTE BİRİNE EN YAKIN kart:
   * kartlar ekrandan uzun olabiliyor (görselli kart 900px'i geçiyor) ve
   * kesişim oranı o durumda hep aynı kartı kazandırır. Sabit bir okuma
   * çizgisi, gözün gerçekte baktığı yere karşılık geliyor.
   *
   * rAF ile kısılıyor: kaydırma olayı saniyede yüzlerce kez geliyor ve her
   * birinde elli iki `getBoundingClientRect` okumak sayfayı kilitlerdi.
   * Dar ekranda çalışmaz — orada liste ve önizleme aynı anda görünmüyor.
   */
  useEffect(() => {
    let bekleyen = false;
    const olc = () => {
      bekleyen = false;
      if (!genisEkran()) return;
      const cizgi = window.innerHeight * 0.35;
      let enIyi: string | null = null;
      let enYakin = Number.POSITIVE_INFINITY;
      for (const sayfa of gosterilenRef.current) {
        const el = document.getElementById(kartDomKimligi(sayfa.id));
        if (!el) continue;
        const k = el.getBoundingClientRect();
        if (k.bottom < 0 || k.top > window.innerHeight) continue;
        /* Çizgi kartın İÇİNDEYSE uzaklık sıfırdır — uzun kart, kısa komşusuna
           yenilmesin diye. */
        const uzaklik =
          k.top <= cizgi && k.bottom >= cizgi
            ? 0
            : Math.min(Math.abs(k.top - cizgi), Math.abs(k.bottom - cizgi));
        if (uzaklik < enYakin) {
          enYakin = uzaklik;
          enIyi = sayfa.id;
        }
      }
      if (enIyi && enIyi !== seciliIdRef.current) setSeciliId(enIyi);
    };
    const tetik = () => {
      if (bekleyen) return;
      bekleyen = true;
      requestAnimationFrame(olc);
    };
    window.addEventListener("scroll", tetik, { passive: true });
    window.addEventListener("resize", tetik);
    tetik();
    return () => {
      window.removeEventListener("scroll", tetik);
      window.removeEventListener("resize", tetik);
    };
  }, []);

  /**
   * Karta ATLA: seç, görünür yap, istenirse ilk alanına odaklan.
   *
   * Odak bir sonraki çizim turunda aranıyor: dar ekranda "Önizleme" sekmesi
   * açıkken kart listesi DOM'da hiç yok, bu tıklamayla geliyor.
   */
  const kartaGit = useCallback((sayfaId: string, odakla: boolean) => {
    setSeciliId(sayfaId);
    /* Panel YALNIZ dar ekranda kapanır. Geniş ekranda kalıcı olduğu için
       kapatmak, haritadan sırayla kart gezen kişiye her adımda düğmeye
       bastırırdı — haritanın var olma sebebi tam olarak o gezinti. */
    if (!genisEkran()) setHaritaAcik(false);
    requestAnimationFrame(() => {
      const el = document.getElementById(kartDomKimligi(sayfaId));
      if (!el) return;
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      // `preventScroll`: odak kendi başına kaydırsaydı kartı ekranın kenarına
      // yapıştırırdı; ortalamayı üstteki satır yapıyor.
      if (odakla) el.querySelector<HTMLElement>("input, textarea")?.focus({ preventScroll: true });
    });
  }, []);

  /* Haritadan tıklanan kart ODAKLANIR da: harita zaten "şu kartı düzenleyeceğim"
     demenin kısa yolu; kartı ekrana getirip imleci hazırlayana bir tık daha
     attırmak yolun yarısında bırakmak olurdu. */
  const haritadanSec = useCallback((sayfaId: string) => kartaGit(sayfaId, true), [kartaGit]);

  /* ── sürükle-bırak sıralama ─────────────────────────────────────────────
     Kütüphane yok: HTML5 `draggable` yetiyor. TUTAMAK var, kartın tamamı
     sürüklenmiyor — kart gövdesi metin alanlarıyla dolu ve sürüklenebilir bir
     kutuda metin seçmek imkânsızlaşıyor. ▲▼ düğmeleri DURUYOR: sürükleme
     dokunmatikte ve klavyede tek başına yeterli değil. */
  const surukleBasla = useCallback((sayfaId: string) => setSurukleId(sayfaId), []);

  const surukleBitir = useCallback(() => {
    setSurukleId(null);
    setBirakIndeks(null);
  }, []);

  /* `dragover` saniyede onlarca kez tetikleniyor; aynı aralık için durum
     yazmak kırk satırı boşuna yeniden çizerdi. */
  const birakYeri = useCallback((indeks: number) => setBirakIndeks((e) => (e === indeks ? e : indeks)), []);

  const birak = useCallback(() => {
    const kaynak = surukleIdRef.current;
    const aralik = birakIndeksRef.current;
    setSurukleId(null);
    setBirakIndeks(null);
    if (!kaynak || aralik === null) return;

    const idler = gosterilenRef.current.map((x) => x.id);
    const nereden = idler.indexOf(kaynak);
    if (nereden < 0) return;
    // Kart önce listeden çıkıyor: kendi üstündeki aralığa bırakılırsa hedef
    // indeks bir kayar.
    const nereye = aralik > nereden ? aralik - 1 : aralik;
    if (nereye === nereden) return;

    const yeni = [...idler];
    yeni.splice(nereden, 1);
    yeni.splice(nereye, 0, kaynak);
    // TEK YAZIM. Sırayı adım adım yazmak, yarıda kalan bir istekte listeyi
    // bozuk bir sırayla bırakırdı.
    calistir(() => sayfalariSiralaEylem(egitim.id, yeni));
  }, [calistir, egitim.id]);

  const bolumYaz = useCallback(
    (sayfaId: string, baslik: string) => kaydet(() => bolumBasligiEylem(egitim.id, sayfaId, baslik)),
    [kaydet, egitim.id],
  );

  const anlikYaz = useCallback((sayfaId: string, yama: Record<string, unknown>) => {
    setAnlik((a) => ({ ...a, [sayfaId]: { ...a[sayfaId], ...yama } }));
  }, []);

  const sayfaGuncelle = useCallback(
    (sayfaId: string, yama: Record<string, unknown>) => kaydet(() => sayfaGuncelleEylem(egitim.id, sayfaId, yama)),
    [kaydet, egitim.id],
  );

  /**
   * Kart siler ve 10 saniyelik GERİ ALMA penceresi açar.
   *
   * Onay kutusu yetmiyordu: yarım saatte yazılmış bir vaka kartı tek tık +
   * tek onayla gidiyordu ve ürünün başka her yerinde geri dönüş var
   * ("Yayındaki hâline dön", tip değişiminde "Geri al"). Taslak ile yayın
   * ayrı iki nesne olduğu için geri alma kayıt değişmezliğini İHLAL ETMEZ.
   *
   * Kartın alanları ve SIRA İNDEKSİ silmeden ÖNCE kopyalanıyor; sunucu
   * yanıtından sonra ikisi de listede yok. Onay metni de değişti: artık
   * "kalıcı olarak" demiyor, çünkü demiyor.
   */
  const sayfaSil = useCallback(
    (sayfaId: string) => {
      const liste = gosterilenRef.current;
      const i = liste.findIndex((x) => x.id === sayfaId);
      const s = liste[i];
      if (!s) return;
      const yedek = {
        tip: s.tip,
        baslik: s.baslik,
        metin: s.metin,
        metinKarsi: s.metinKarsi,
        gorselId: s.gorselId,
        gorselIdler: s.gorselIdler,
        videoId: s.videoId,
        asgariSure: s.asgariSure,
      };
      confirm(
        { title: "Sayfa silinsin mi?", message: `"${s.baslik || KART_ETIKET[s.tip]}" silinir. Geri alabilirsin.`, danger: true },
        () =>
          calistir(async () => {
            await sayfaSilEylem(egitim.id, sayfaId);
            show("Kart silindi.", "done", {
              etiket: "Geri al",
              onTikla: () => calistir(() => sayfaGeriYukleEylem(egitim.id, yedek, i)),
            });
          }),
      );
    },
    [calistir, confirm, egitim.id, show],
  );

  /**
   * SEÇİLİ KARTLARI BİR HAMLEDE SİLER — geri alınabilir.
   *
   * Yedek SİLMEDEN ÖNCE alınıyor (sunucu yanıtından sonra kartlar listede
   * yok) ve sıra indeksleriyle birlikte. Geri alma BÜYÜKTEN KÜÇÜĞE gidiyor:
   * `sayfaGeriYukleEylem` kartı verilen indekse koyuyor, küçükten başlarsak
   * sonraki her ekleme bir öncekinin indeksini kaydırır ve kartlar karışık
   * sırayla geri gelirdi.
   *
   * TEK BİLDİRİM, TEK "Geri al": kırk kart için kırk bildirim ekranı
   * kaplardı. Öksüz dosya sayısı da burada söyleniyor — silinen kartların
   * görselleri diskte kalıyor ve o bilgi bugün yalnız sayfanın en altındaki
   * bakım şeridinde duruyor, kimse oraya bakmıyor.
   */
  const secilileriSil = useCallback(() => {
    const liste = gosterilenRef.current;
    const yedekler = liste
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => secililer.has(s.id))
      .map(({ s, i }) => ({
        indeks: i,
        veri: {
          tip: s.tip,
          baslik: s.baslik,
          metin: s.metin,
          metinKarsi: s.metinKarsi,
          gorselId: s.gorselId,
          gorselIdler: s.gorselIdler,
          videoId: s.videoId,
          asgariSure: s.asgariSure,
        },
      }));
    if (yedekler.length === 0) return;

    confirm(
      {
        title: `${yedekler.length} kart silinsin mi?`,
        message: "Seçilen kartlar listeden çıkar. Geri alabilirsin.",
        danger: true,
        confirmLabel: `${yedekler.length} kartı sil`,
      },
      () =>
        calistir(async () => {
          const adet = await sayfalariSilEylem(egitim.id, [...secililer]);
          secimKapat();
          show(`${adet} kart silindi.`, "done", {
            etiket: "Geri al",
            /* TEK ÇAĞRI. Kart kart geri yüklemek yirmi sekiz sunucu turu
               ve yirmi sekiz yeniden çizim demekti; arada bildirim
               kapanınca geri alma yarım kalıyordu. */
            onTikla: () =>
              calistir(async () => {
                await sayfalariGeriYukleEylem(egitim.id, yedekler);
              }),
          });
        }),
    );
  }, [calistir, confirm, egitim.id, secililer, secimKapat, show]);

  const sayfaTasi = useCallback(
    (sayfaId: string, yon: -1 | 1, odaklaGeri = false) => {
      const liste = [...gosterilenRef.current];
      const i = liste.findIndex((x) => x.id === sayfaId);
      const hedef = i + yon;
      if (i < 0 || hedef < 0 || hedef >= liste.length) return;
      [liste[i], liste[hedef]] = [liste[hedef], liste[i]];
      calistir(async () => {
        await sayfalariSiralaEylem(egitim.id, liste.map((x) => x.id));
        /* ODAK TAŞINAN KARTA GERİ VERİLİYOR (klavye yolu için).
           Taşımadan sonra odak karttan çıkıyordu ve `listeTus` odaktaki karta
           bakarak çalıştığı için kısayol YALNIZ BİR KEZ işliyordu: kartı üç
           sıra taşımak isteyen kişi her basıştan sonra karta geri tıklamak
           zorundaydı, hiçbir şey olmadığı için de "çalışmıyor" diye
           vazgeçiyordu. Fareyle sürükleme çalışırken klavye yolu ölüydü. */
        if (odaklaGeri) kartaGit(sayfaId, true);
      });
    },
    [calistir, egitim.id, kartaGit],
  );

  /**
   * Ctrl+↑/↓ ile sıralama — TEK dinleyici, satır başına kapanış değil.
   *
   * Sürükleme klavyeyle yapılamaz; ▲▼ düğmeleri var ama metin alanında
   * yazarken fareye uzanmak gerekiyordu. Hangi kartın taşınacağı odaktan,
   * `data-kart` niteliğiyle bulunuyor — satır başına geri çağrı üretmek
   * `SayfaSatiri` sarmalayıcılarını her çizimde tazelerdi.
   */
  const listeTus = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!e.ctrlKey || e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
      const kap = (e.target as HTMLElement).closest<HTMLElement>("[data-kart]");
      const id = kap?.dataset.kart;
      if (!id) return;
      e.preventDefault();

      /* ÖNCE KAYDET, SONRA TAŞI — yoksa yazılan metin sessizce gidiyordu.
         Alanlar `onBlur`da kaydediyor; taşıma ise odağı bırakmadan sunucuya
         yazıp listeyi tazeliyordu. Başlığa yazıp alandan çıkmadan Ctrl+↑'a
         basan kişi yazdığını kaybediyor, üstelik hiçbir uyarı görmüyordu —
         ve tuzağı ürünün kendi kısayol ipucu kuruyordu ("Ctrl+↑/↓ odaktaki
         kartı taşır"). `blur()` alanın kendi kayıt yolunu tetikliyor; iki
         yazım (alan + sıra) farklı sütunlara gittiği için çakışmıyor. */
      (document.activeElement as HTMLElement | null)?.blur?.();

      sayfaTasi(id, e.key === "ArrowUp" ? -1 : 1, true);
    },
    [sayfaTasi],
  );

  const sayfaCogalt = useCallback(
    (sayfaId: string) => calistir(() => kartCogaltEylem(egitim.id, sayfaId)),
    [calistir, egitim.id],
  );

  const sayfaKopyala = useCallback(
    (sayfaId: string, hedefId: string) =>
      calistir(async () => {
        await kartKopyalaEylem(egitim.id, sayfaId, hedefId);
        show(`Kart "${hedefEgitimler.find((e) => e.id === hedefId)?.ad ?? "eğitime"}" kopyalandı`);
      }),
    [calistir, egitim.id, hedefEgitimler, show],
  );

  const soruGuncelle = useCallback(
    (soruId: string, yama: Record<string, unknown>) =>
      kaydet(() => soruGuncelleEylem(egitim.id, soruId, yama as Partial<Soru>)),
    [kaydet, egitim.id],
  );

  /** Soru siler; geri alma penceresi `sayfaSil` ile aynı gerekçeyle açılıyor. */
  const soruSil = useCallback(
    (soruId: string) => {
      const q = sorularRef.current.find((x) => x.id === soruId);
      if (!q) return;
      const yedek = {
        tip: q.tip,
        metin: q.metin,
        secenekler: q.secenekler,
        dogru: q.dogru,
        gorselId: q.gorselId,
        aciklama: q.aciklama,
      };
      confirm({ title: "Soru silinsin mi?", message: "Soru havuzdan çıkar. Geri alabilirsin.", danger: true }, () =>
        calistir(async () => {
          await soruSilEylem(egitim.id, soruId);
          show("Soru silindi.", "done", {
            etiket: "Geri al",
            onTikla: () => calistir(() => soruGeriYukleEylem(egitim.id, yedek)),
          });
        }),
      );
    },
    [calistir, confirm, egitim.id, show],
  );

  const medyaSil = useCallback(
    (id: string) => calistir(() => medyaSilEylem(id, egitim.id)),
    [calistir, egitim.id],
  );

  const altMetinYaz = useCallback(
    (medyaId: string, altMetin: string) => kaydet(() => medyaAltMetinEylem(medyaId, altMetin, egitim.id)),
    [kaydet, egitim.id],
  );

  const oksuzTemizle = useCallback(
    () =>
      calistir(async () => {
        const silinen = await oksuzMedyalariTemizleEylem(egitim.id);
        show(silinen > 0 ? `${silinen} kullanılmayan medya silindi` : "Silinecek kullanılmayan medya kalmamış");
      }),
    [calistir, egitim.id, show],
  );

  const pdfKartlari = useCallback(
    async (kartlar: { gorselId: string; baslik: string }[]) => {
      await sayfalariTopluEkleEylem(egitim.id, kartlar);
      router.refresh();
    },
    [egitim.id, router],
  );

  const pptxKartlari = useCallback(
    async (kartlar: { baslik: string; metin: string; gorselIdler: string[] }[]) => {
      await pptxKartlariEkleEylem(egitim.id, kartlar);
      router.refresh();
    },
    [egitim.id, router],
  );

  seciliIdRef.current = secili?.id ?? null;

  /**
   * KARTLAR ARASI ATLAMA — Alt+↑/↓.
   *
   * Kırk kartlık eğitimde bir sonraki karta geçmenin en yavaş yolu fareyle
   * kaydırmaktı. Kısayol BELGE seviyesinde: hazırlayan o an hangi alanda
   * yazıyor olursa olsun çalışmalı, yoksa "önce listeye tıkla" adımı geri
   * gelirdi. Alt tek başına hiçbir metin alanında anlam taşımıyor.
   *
   * Esc çekmeceyi kapatır. Prova (▶ Dene) açıkken kısayol susuyor: orada
   * ekranda editör değil kiosk var.
   */
  useEffect(() => {
    function tusla(e: KeyboardEvent) {
      if (e.key === "Escape" && haritaAcikRef.current) {
        setHaritaAcik(false);
        return;
      }
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      if (provaRef.current) return;

      const liste = gosterilenRef.current;
      if (liste.length === 0) return;
      e.preventDefault();

      const su = liste.findIndex((s) => s.id === seciliIdRef.current);
      const adim = e.key === "ArrowUp" ? -1 : 1;
      const hedef = su < 0 ? 0 : Math.min(liste.length - 1, Math.max(0, su + adim));
      kartaGit(liste[hedef].id, true);
    }
    document.addEventListener("keydown", tusla);
    return () => document.removeEventListener("keydown", tusla);
  }, [kartaGit]);

  return (
    <main className="bg-wash min-h-screen pb-24">
      <Baslik
        ust="/egitimler"
        ustAd="Eğitimler"
        baslik={egitim.ad}
        not={
          yayinda
            ? `Yayında · sürüm ${egitim.surum}`
            : yayinDurumu
              ? `Taslak · sahada değil (son sürüm ${yayinDurumu.surum})`
              : "Taslak"
        }
        rehberBolum="hazirlama"
        sag={
          <>
            {/* KAYIT GÖSTERGESİ — yapışkan başlıkta, yani kırkıncı kartta
                yazarken de görünür. Eskiden tek onay sayfanın EN DİBİNDE,
                Kopyala/Sil düğmelerinin yanındaydı: yazan kişi onu hiç
                görmüyordu ve alanlar odaktan çıkınca sessizce kaydettiği
                için "kaydettim mi" sorusu hep açık kalıyordu.

                SAAT YAZILI, "kaydedildi" değil. Sabit bir onay metni bir
                saat önceki kayıttan mı yoksa az önceki tuş vuruşundan mı
                geldiğini söylemez; saat söyler. Kaybolmuyor da — bildirim
                olsaydı gözden kaçan kişi için hiç var olmamış olurdu. */}
            <span className="hidden text-xs text-muted sm:inline" role="status" aria-live="polite">
              {bekle ? (
                "Kaydediliyor…"
              ) : sonKayit ? (
                <>
                  <Icon name="check" size={13} /> {saatBicimi(sonKayit)} kaydedildi
                </>
              ) : null}
            </span>

            {/* YAYINLANMAMIŞ DEĞİŞİKLİK ROZETİ — uyarı değil, bilgi.
                Taslak ile yayın ayrı iki nesne olduğu için hiçbir şey
                kaybolmuyor; korkutan bir "kaydedilmedi" uyarısı yerine
                sahadaki hâlle arasındaki farkı söyleyen bir rozet duruyor. */}
            {yayinlanmamisVar && yayinDurumu ? (
              <span
                className="chip hidden border-accent/40 bg-accent/10 text-xs text-accent sm:inline-flex"
                title={`Sahada hâlâ sürüm ${yayinDurumu.surum} oynuyor. Taslak kaydedildi, yayınlanmadı.`}
              >
                <Icon name="pencil" size={14} /> Yayınlanmamış değişiklik
              </span>
            ) : null}
            {!yayinda || yayinlanmamisVar ? <YayinRozeti liste={kontrol} /> : null}
            <button
              onClick={() => setProva(true)}
              disabled={sayfalar.length === 0}
              className="btn-ghost text-sm"
              title="Taslağın kiosk'ta nasıl görüneceğini gösterir; hiçbir kayıt düşmez"
            >
              <Icon name="play" size={16} /> Dene
            </button>

            {/* YAYINDAKİ HÂLİNE DÖN. Yayınlamanın simetriği ve `hazirlayan`
                yetkisiyle: sahaya bir şey çıkarmıyor, taslağı yayındakine
                eşitliyor. Onay isteniyor çünkü yayınlanmamış düzenlemeler
                gider — yayınlanmış sürüm ise yerinde kalır. */}
            {yayinlanmamisVar && yayinDurumu ? (
              <button
                onClick={() =>
                  confirm(
                    {
                      title: `Sürüm ${yayinDurumu.surum} hâline dönülsün mü?`,
                      message:
                        "Taslaktaki yayınlanmamış değişiklikler gider ve içerik sahadaki hâline eşitlenir. " +
                        "Yayınlanmış sürüm olduğu gibi kalır.",
                      confirmLabel: "Yayındaki hâline dön",
                    },
                    () =>
                      calistir(async () => {
                        await yayindanGeriDonEylem(egitim.id);
                        // Kaydedilmemiş tuş vuruşlarının önizleme katmanı da
                        // gider; kart kimliğine bağlı olduğu için temizlenmezse
                        // yayındaki metnin üstünde eski yazı kalırdı.
                        setAnlik({});
                        show(`Taslak sürüm ${yayinDurumu.surum} hâline döndü.`);
                      }),
                  )
                }
                className="btn-ghost text-sm"
                title="Taslağı son yayınlanan sürümden yeniden kurar"
              >
                <Icon name="undo" size={16} /> Yayındaki hâline dön
              </button>
            ) : null}

            {onaylayabilir ? (
              <>
                {yayinda ? (
                  /* "SAHADAN İNDİR" — eskiden "Taslağa al" idi ve anlamı
                     değişti. Düzenlemek için artık gerekmiyor; bu düğme
                     eğitimi GERÇEKTEN kiosktan düşürür. Eski adıyla kalsaydı
                     alışkanlıkla basan hazırlayan, vardiya ortasında eğitimi
                     sahadan kaldırmış olurdu. */
                  <button
                    onClick={() => calistir(() => taslagaAlEylem(egitim.id))}
                    className="btn-ghost text-sm"
                    title="Eğitim kiosk, ziyaretçi ve amir tabletinde görünmez olur. Düzenlemek için gerekmez."
                  >
                    <Icon name="lock" size={16} /> Sahadan indir
                  </button>
                ) : null}
                <button
                  onClick={() => yayinla()}
                  disabled={!yayinaHazir || (yayinda && !yayinlanmamisVar)}
                  className="btn-primary text-sm"
                  title={
                    !yayinaHazir
                      ? "En az bir sayfa gerekir"
                      : yayinda && !yayinlanmamisVar
                        ? "Yayınlanmamış değişiklik yok"
                        : yayinDurumu
                          ? `Sürüm ${yayinDurumu.surum + 1} olarak yayınlanır`
                          : "Sürüm 1 olarak yayınlanır"
                  }
                >
                  <Icon name="check" size={16} /> Yayınla
                </button>
              </>
            ) : (
              <span className="chip text-xs text-muted" title="Yayına almayı onaylayan rolü yapar">
                <Icon name="lock" size={14} /> Onay bekler
              </span>
            )}
          </>
        }
      />

      {/* ── KART HARİTASI RAYI ────────────────────────────────────────────
          ÜÇÜNCÜ SÜTUN AÇILMADI, KENAR BOŞLUĞU KULLANILDI. Kokpitin genişliği
          `.sayfa-kap` ile 80rem'de sabit (globals.css); ekran ne kadar büyürse
          büyüsün içerik 1280px'te kalıyor. Haritayı ızgaraya üçüncü sütun
          olarak koymak, 1920px'lik bir ekranda bile editörü ~200px daraltıp
          iki yanda duran boşluğa hiç dokunmamak demekti — yani asıl işin
          yapıldığı sütundan çalıp boşluğa bakmak. Ray o boşlukta duruyor:
          editör ve önizleme bugünkü genişliklerini AYNEN koruyor.
          Boşluğun yetmediği her yerde harita çekmeceye düşüyor (aşağıda).

          `left` KABIN SOL KENARINA GÖRE hesaplanıyor (`50vw - 816px`), ekranın
          soluna yapıştırılmıyor: 2560px'lik bir monitörde sabit `left` rayı
          içerikten yarım ekran uzağa düşürür, göz o mesafeyi her seferinde
          kat etmek zorunda kalırdı. Alt sınır 0.75rem — eşik genişlikte rayı
          ekran dışına taşırmamak için. */}
      <aside className="fixed left-[calc((100vw_-_1280px)/2_-_236px)] top-24 z-30 hidden max-h-[calc(100vh_-_8rem)] w-56 overflow-y-auto rounded-flow border border-line bg-yuzey p-2 shadow-sm min-[1800px]:block">
        <h2 className="eyebrow mb-1 px-1">Kart haritası</h2>
        <KartHaritasi
          satirlar={haritaSatirlari}
          seciliId={secili?.id ?? null}
          kilitli={kilitli}
          secimKipi={secimKipi}
          secililer={secililer}
          onSecimDegis={secimDegis}
          surukleId={surukleId}
          birakIndeks={birakIndeks}
          onSec={haritadanSec}
          onSurukleBasla={surukleBasla}
          onSurukleBitir={surukleBitir}
          onBirakYeri={birakYeri}
          onBirak={birak}
        />
        {gosterilen.length > 0 ? <p className="mt-2 px-1 text-[11px] leading-snug text-muted">{KISAYOL_NOTU}</p> : null}
      </aside>

      {/* Alttaki önizleme şeridi yapışkan: son alan onun ALTINDA kalmasın diye
          o kadar pay bırakılır. Şerit açıkken pay büyür. Geniş ekranda şerit
          hiç çizilmiyor, pay da yok. */}
      {/* Çekmece AÇIKKEN gövde sağa itilir (lg ve üstü): panel içeriğin üstünü
          örtmez, ikisi yan yana durur. Dar ekranda itme yok — orada panel
          zaten perdeli ve geçici. */}
      <div
        /* ⭐ EDİTÖR `sayfa-kap` KULLANMAZ — BİLİNÇLİ TEK İSTİSNA.
           Kokpitin geri kalanı 1280px'lik ortalı bir kapta duruyor ve o kural
           yerinde: okuma sayfası ekran genişledikçe uzayan satırlara dönüşmemeli.
           Ama burası okuma sayfası değil, ÜÇ SÜTUNLU TEZGÂH — harita, editör,
           kiosk önizlemesi. Kapaklı genişlikte üçü 774px'i paylaşıyor, editör
           sütunu 410px'e düşüyor ve ekranın sağında 280px boş kalıyordu
           (ölçüldü, 1609px pencere; kullanıcı: "sağda solda bir sürü boşluk
           varken editör daralıyor").

           Harita ekranın SOL KENARINDA duruyor ve gövde onun kadar
           içeriden başlıyor: ray göründüğü her genişlikte yer ayrılır,
           altında yalnız harita açıkken. */
        /* ⭐ EDİTÖR DE HERKESLE AYNI KAPTA (kullanıcı kararı, 29.08.2026).
           Tam genişlik denendi ve GERİ ALINDI: sayfa kenardan başlayınca
           kokpitin geri kalanıyla hizası bozuluyordu ("bak tüm sayfalar aynı
           aralığı kullanıyor"). Asıl sorun genişlik değil KÖK PUNTOSUYDU —
           `max-w-7xl` 13px kökte 1040px veriyordu; kök 16'ya dönünce kap
           gerçek 1280'ine çıktı ve editör sütunu 410 → 800px oldu, yani
           yayılmaya gerek kalmadı.

           Harita ise kabın DIŞINDA: geniş ekranda sol boşlukta duran ray,
           dar ekranda çekmece. Böylece hiza her durumda korunuyor. */
        className={`sayfa-govde ${seritAcik ? "pb-[52vh]" : "pb-24"} xl:pb-8 ${
          /* Çekmece kipinde gövde sağa itiliyor; kap AYNI MİKTARDA büyüyor ki
             dolgu içerikten değil ekranın boş kenarından karşılansın. */
          haritaAcik ? "lg:max-w-[1528px] lg:pl-[248px]" : ""
        }`}
      >
        {/* Harita düğmesi rayın görünmediği HER genişlikte duruyor. */}
        <div className="mb-5 flex flex-wrap items-center gap-3 min-[1800px]:hidden">
          <button onClick={() => setHaritaAcik((a) => !a)} className="btn-ghost text-sm" aria-expanded={haritaAcik}>
            <Icon name="list" size={16} /> Kart haritası
            {gosterilen.length > 0 ? <span className="font-normal text-muted">{gosterilen.length}</span> : null}
          </button>
        </div>

        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_26rem] xl:items-start">
          {/* `key` yalnız "taslak = yayın" durumuna GEÇİLİNCE değişir —
              gerekçe `tazeleme` tanımında. */}
          <div key={tazeleme} className="min-w-0 space-y-8">
            {yayinlanmamisVar && yayinDurumu ? (
              /* KORKUTMAYAN AMA AÇIK OLAN ŞERİT.
                 Eskiden burada "Yayında — düzenleme kapalı" yazıyordu ve
                 düzenlemek için eğitimi kiosktan düşürmek gerekiyordu. Artık
                 düzenleme sahaya çıkmıyor; söylenmesi gereken tek şey, ekranda
                 görülenin sahadakinden FARKLI olduğu. Hiçbir şey kaybolmuyor,
                 dolayısıyla bir uyarı değil bir durum bildirimi. */
              <p className="rounded-flow border border-accent/40 bg-accent/5 px-4 py-3 text-sm">
                <strong>Bu değişiklikler sahada yok.</strong>{" "}
                {yayinda
                  ? `Kiosk, ziyaretçi ve amir tabletinde hâlâ sürüm ${yayinDurumu.surum} oynuyor.`
                  : `Eğitim sahadan indirilmiş; en son sürüm ${yayinDurumu.surum} yayınlanmıştı.`}{" "}
                {onaylayabilir
                  ? `Yayınladığınızda sürüm ${yayinDurumu.surum + 1} açılır ve eski sürüm kayıtlar için saklanmaya devam eder.`
                  : "Yayına almayı onaylayan rolündeki bir kişi yapar."}
              </p>
            ) : null}

            {yayinda && !yayinlanmamisVar ? (
              <p className="rounded-flow border border-iyi/40 bg-iyi/5 px-4 py-3 text-sm">
                <strong>Yayında ve sahayla aynı.</strong> Yazdığınız her değişiklik taslağa kaydedilir; sahadaki
                sürüm siz yayınlayana kadar değişmez.
              </p>
            ) : null}

            {!onaylayabilir && !yayinda ? (
              <p className="rounded-flow border border-line bg-yuzey px-4 py-3 text-sm text-muted">
                Hazırladığınız eğitimi <strong className="text-ink">onaylayan</strong> rolündeki bir kişi yayına alır.
                İçerik kalitesinin tek güvencesi bu ikinci gözdür.
              </p>
            ) : null}

            {/* ── tanım ──
                ⛔ "TANIM" BAŞLIĞI KALDIRILDI (kullanıcı kararı). Sayfanın ilk
                bloğu zaten tanım; içindeki alanlar kendi etiketlerini taşıyor
                ("Eğitim adı", "Kategori"…) ve üstteki şerit eğitimin adını
                söylüyor. Etiket hiçbir soruyu cevaplamıyordu, yalnız ilk kartı
                aşağı itip sol sütunun tepe hizasını bozuyordu. */}
            <section>
              <TanimBolumu
                egitim={egitim}
                kategoriler={kategoriler}
                kilitli={kilitli}
                onGuncelle={(yama) => kaydet(() => egitimGuncelleEylem(egitim.id, yama))}
              />
            </section>

            {/* ── içerik ── */}
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="eyebrow">İçerik · {sayfalar.length} sayfa</h2>
                {/* ── TOPLU SEÇİM ŞERİDİ ────────────────────────────────
                    Kip kapalıyken tek düğme; açıkken sayaç + eylemler.
                    Seçim KART HARİTASINDAN yapılıyor: elli iki kartlık
                    listede satırlar orada yan yana duruyor, editör
                    kartları ekran boyunda. Şerit burada çünkü karar
                    (silme) içeriğe ait, gezinme aracına değil. */}
                {!kilitli && sayfalar.length > 1 ? (
                  secimKipi ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="chip">{secililer.size} kart seçildi</span>
                      <button onClick={tumunuSec} className="btn-ghost text-sm">
                        {secililer.size === gosterilen.length ? "Seçimi bırak" : "Tümünü seç"}
                      </button>
                      <button
                        onClick={secilileriSil}
                        disabled={secililer.size === 0}
                        className="btn-ghost text-sm text-brand-dark hover:border-brand/50"
                      >
                        <Icon name="trash" size={15} /> Sil
                      </button>
                      <button onClick={secimKapat} className="btn-ghost text-sm">
                        Vazgeç
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setSecimKipi(true);
                        setHaritaAcik(true);
                      }}
                      className="btn-ghost text-sm"
                    >
                      <Icon name="check" size={15} /> Seç
                    </button>
                  )
                ) : null}
              </div>

              {sayfalar.length === 0 && !kilitli ? (
                <IceriAktar onPdfKartlari={pdfKartlari} onPptxKartlari={pptxKartlari} />
              ) : null}

              {/* SARMALAYICI KATMAN: sürükleme tutamağı, bölüm ayracı ve
                  bırakma çizgisi burada. `SayfaSatiri`nin kendisine hiç
                  dokunulmuyor — o satır kart hattının dosyası. */}
              <div className="mt-4 space-y-3" onKeyDown={listeTus}>
                {gruplar.map((grup) => {
                  const anahtar = grup.kartlar[0]?.sayfa.id ?? "bolumsuz";
                  const katli = grup.ad !== null && katliBolumler.has(anahtar);
                  return (
                <section
                  key={anahtar}
                  className={
                    grup.ad !== null
                      ? "space-y-3 rounded-flow border-l-4 border-accent/30 bg-accent-soft/20 py-2 pl-3"
                      : "space-y-3"
                  }
                >
                  {grup.ad !== null ? (
                    /* BÖLÜM BAŞLIĞI ARTIK BİR KAPAK: kaç kart kapsadığını
                       söyler ve katlanır. Katlama telefonda zorunlu — kırk
                       kartlık eğitimde altıncı bölüme inmek için beş bölümü
                       kaydırmak gerekiyordu. */
                    /* Kapak DÜĞME DEĞİL, satır: içinde düzenlenebilir bir alan
                       ve kaldırma düğmesi var, ikisi de bir düğmenin içine
                       giremez. Katlama artık soldaki oka bağlı. */
                    <div className="flex items-center gap-2 pr-2">
                      <button
                        type="button"
                        onClick={() => bolumKatla(anahtar)}
                        aria-expanded={!katli}
                        aria-label={katli ? `${grup.ad} bölümünü aç` : `${grup.ad} bölümünü kapat`}
                        className="btn-icon shrink-0 text-accent"
                      >
                        <Icon name={katli ? "chevronRight" : "down"} size={16} />
                      </button>
                      <BolumAyraci
                        kapak
                        sayfaId={grup.kartlar[0].sayfa.id}
                        baslik={grup.ad}
                        kilitli={kilitli}
                        onYaz={bolumYaz}
                      />
                      <span className="shrink-0 text-xs text-muted">{grup.kartlar.length} kart</span>
                    </div>
                  ) : null}

                  {katli ? null : grup.kartlar.map(({ sayfa: s, indeks: i }) => (
                  <div
                    key={s.id}
                    id={kartDomKimligi(s.id)}
                    data-kart={s.id}
                    className={`group relative ${yeniKartId === s.id ? "animate-pop" : ""}`}
                    onDragOver={(e) => {
                      if (!surukleId) return;
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      const kutu = e.currentTarget.getBoundingClientRect();
                      birakYeri(e.clientY < kutu.top + kutu.height / 2 ? i : i + 1);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      birak();
                    }}
                  >
                    {/* Bırakma çizgisi MUTLAK: akışa girseydi imlecin altındaki
                        kart her kıpırdanışta kayar, hedef titrerdi. */}
                    {birakIndeks === i ? (
                      <span aria-hidden className="absolute -top-1.5 left-0 right-0 z-10 h-0.5 rounded bg-accent" />
                    ) : null}
                    {i === gosterilen.length - 1 && birakIndeks === gosterilen.length ? (
                      <span aria-hidden className="absolute -bottom-1.5 left-0 right-0 z-10 h-0.5 rounded bg-accent" />
                    ) : null}

                    {/* Bölümü BAŞLATAN kartta ayraç çizilmez: adı kapak zaten
                        gösteriyor ve düzenlemesi orada. Kalan kartlarda ayraç
                        yalnız "+ Bölüm başlığı" olarak belirir. */}
                    {grup.ad !== null && grup.kartlar[0].sayfa.id === s.id ? null : (
                      <BolumAyraci sayfaId={s.id} baslik={bolumler[s.id]} kilitli={kilitli} onYaz={bolumYaz} />
                    )}

                    {/* ARAYA KART EKLEME — kart hep SONA ekleniyordu.
                        12 kartlık listede 6. sıraya kart sokmak, kartı sona
                        ekleyip on kez Ctrl+↑'a basmak demekti (ölçüldü: 8,9 sn);
                        40 kartlık eğitimde pratikte imkânsızdı. Oysa "şuraya bir
                        uyarı kartı lazım" içerik hazırlamanın en sık hareketi.

                        Bölüm ayracıyla AYNI boşlukta ve aynı belirme kuralında
                        duruyor (fareli ekranda üstüne gelince, dokunmatikte hep
                        görünür); kartların arasına kalıcı bir düğme sırası
                        koymak listeyi gürültüye çevirirdi. */}
                    <KartEkleMenusu
                      kilitli={kilitli}
                      araya
                      onEkle={(t) => calistir(() => sayfaEkleEylem(egitim.id, t, s.id))}
                    />

                    {/* TUTAMAK KARTIN İÇİNE GEÇTİ. Solda ayrı bir sütun olarak
                        dururken kartı ~40px sağa itiyordu: kartlar sayfadaki
                        her şeyle (bölüm başlığı, "İÇERİK" etiketi, üstteki
                        tanım kutusu) hizasız kalıyor, liste sağa kaymış gibi
                        görünüyordu. Artık başlık satırının ilk öğesi — hiçbir
                        şey kaymıyor, sürükleme aynı şekilde çalışıyor. */}
                    <div className={`min-w-0 ${surukleId === s.id ? "opacity-40" : ""}`}>
                      <div>
                        <SayfaSatiri
                          tutamak={
                            <span
                              draggable={!kilitli}
                              onDragStart={(e) => {
                                // Firefox veri konmadan sürüklemeyi başlatmıyor.
                                e.dataTransfer.setData("text/plain", s.id);
                                e.dataTransfer.effectAllowed = "move";
                                const kart = document.getElementById(kartDomKimligi(s.id));
                                if (kart) e.dataTransfer.setDragImage(kart, 24, 24);
                                surukleBasla(s.id);
                              }}
                              onDragEnd={surukleBitir}
                              title="Sürükleyerek taşıyın · klavyede Ctrl+↑/↓"
                              className={`hidden shrink-0 rounded-flow-sm p-0.5 sm:inline-grid sm:place-items-center ${
                                kilitli
                                  ? "opacity-20"
                                  : `text-muted hover:bg-line/60 hover:text-ink ${surukleId === s.id ? "cursor-grabbing" : "cursor-grab"}`
                              }`}
                            >
                              <Icon name="grip" size={16} />
                            </span>
                          }
                          sayfa={s}
                          sira={i + 1}
                          toplam={gosterilen.length}
                          secili={secili?.id === s.id}
                          medyalar={medyalar}
                          altMetinler={altMetinler}
                          hedefEgitimler={hedefEgitimler}
                          kilitli={kilitli}
                          onSec={sayfaSec}
                          onAnlik={anlikYaz}
                          onGuncelle={sayfaGuncelle}
                          onMedyaSil={medyaSil}
                          onAltMetin={altMetinYaz}
                          onCogalt={sayfaCogalt}
                          onKopyala={sayfaKopyala}
                          onSil={sayfaSil}
                          onTasi={sayfaTasi}
                        />
                      </div>
                    </div>
                  </div>
                  ))}
                </section>
                  );
                })}
              </div>

              {gosterilen.length > 1 ? (
                <p className="mt-3 px-1 text-xs text-muted">{KISAYOL_NOTU}</p>
              ) : null}

              {/* ON TİP ON DÜĞME DEĞİLDİR. Kart tipi beşten ona çıkınca düz
                  düğme sırası iki satıra taşıp içerik listesini aşağı itiyordu;
                  gruplu panel tek düğmeye iniyor ve tipin ne işe yaradığını da
                  yazıyor. Aynı panel satırdaki tip rozetinde de koşuyor. */}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <KartEkleMenusu kilitli={kilitli} onEkle={(t) => calistir(() => sayfaEkleEylem(egitim.id, t))} />
                {/* Kimse sıfırdan başlamıyor: elindeki talimatı yapıştırıp
                    kartlara bölmek, kart kart yazmaktan çok daha hızlı. */}
                <MetinYapistir
                  kilitli={kilitli}
                  onEkle={(kartlar) => calistir(() => metinKartlariEkleEylem(egitim.id, kartlar))}
                />
                {/* PDF/PPTX YÜKLEME KARTLI EĞİTİMDE DE DURUYOR. Kapı eskiden
                    yalnız bomboş eğitimde vardı; ilk kart eklendiği anda
                    kayboluyordu ve kullanıcı bunu "yükleme çalışmıyor" diye
                    bildirdi. İki aktarma da kartları SONA ekliyor, gizlemenin
                    sebebi yoktu. */}
                {sayfalar.length > 0 ? (
                  <IceriAktar sade onPdfKartlari={pdfKartlari} onPptxKartlari={pptxKartlari} />
                ) : null}
              </div>

              {/* Buradaki KAPALI açılır ("Başka bir sunum ya da PDF ekle")
                  kaldırıldı: aynı iş artık kart ekleme düğmelerinin yanında,
                  açık ve tek bir düğme. Kullanıcı yükleme yolunu bulamayıp
                  "çalışmıyor" diye bildirdi — özellik duruyordu, kapısı kart
                  listesinin altında kapalı bir üçgenin arkasındaydı. Üç ayrı
                  giriş noktası tutmak yerine en çok bakılan yerde tek kapı. */}
            </section>

            {/* ── sorular ── */}
            <section>
              <h2 className="eyebrow mb-3">Sorular · {sorular.length} soru havuzda</h2>

              {/* Uyarı ÇÖZÜMÜ AÇAR. Sınav ayarları katlanmış bir bölümde
                  duruyor; sorunu görüp düzeltmesini kapalı bir kutunun içinde
                  aratmak, uyarıyı "okundu geçildi" satırına çevirir. */}
              {sorular.length > 0 && sorular.length < egitim.soruSayisi ? (
                <p className="mb-3 rounded-flow border border-orta/30 bg-orta/5 px-4 py-3 text-sm font-semibold text-orta-dark">
                  Havuzda {sorular.length} soru var, sınavda {egitim.soruSayisi} soru sorulacak. Havuz sınavdan küçükse
                  herkese aynı sorular gelir — karıştırmanın anlamı kalmaz.{" "}
                  {kilitli ? null : (
                    <button
                      type="button"
                      onClick={() => {
                        setAyarlarAcik(true);
                        // Bölüm bu tıklamayla çiziliyor; odak bir sonraki
                        // çizim turunda aranır, yoksa alan henüz yoktur.
                        requestAnimationFrame(() => soruSayisiRef.current?.focus());
                      }}
                      className="underline underline-offset-2"
                    >
                      Sınav ayarlarını aç
                    </button>
                  )}
                </p>
              ) : null}

              <div className="space-y-3">
                {sorular.map((s, i) => (
                  <SoruSatiri
                    key={s.id}
                    soru={s}
                    sira={i + 1}
                    zor={zorSoruIdleri.includes(s.id)}
                    kolay={kolaySoruIdleri.includes(s.id)}
                    istatistik={istatistikHarita.get(s.id)}
                    medyalar={medyalar}
                    kilitli={kilitli}
                    onMedyaSil={medyaSil}
                    onAltMetin={altMetinYaz}
                    onGuncelle={soruGuncelle}
                    onSil={soruSil}
                  />
                ))}
              </div>

              {/* ÖNERİ ÖNCE, BOŞ SORU SONRA: hazırlayan buraya geldiğinde
                  kartları çoktan yazmış oluyor. Yedi boş soru düğmesiyle
                  karşılamak, iş bitmişken işi baştan başlatmak gibiydi. */}
              <div className="mt-4">
                <SoruOnerici
                  sayfalar={gosterilen}
                  mevcutSorular={sorular}
                  kilitli={kilitli}
                  onEkle={(secilenler) => calistir(() => onerilenSorulariEkleEylem(egitim.id, secilenler))}
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {(Object.keys(SORU_ETIKET) as SoruTipi[]).map((t) => (
                  <button key={t} disabled={kilitli} onClick={() => calistir(() => soruEkleEylem(egitim.id, t))} className="btn-ghost text-sm">
                    <Icon name="plus" size={16} /> {SORU_ETIKET[t]}
                  </button>
                ))}
              </div>
            </section>

            {/* ── medya bakımı ────────────────────────────────────────────
                Kart silinince dosya diskte kalıyor ve kütüphanede kullanımı
                sıfır görünen bir kayda dönüşüyor. Bakım AYRI BİR EKRANA
                konsaydı kimse açmaz, veri klasörü yıllar içinde şişerdi;
                burada, içeriğin altında, yalnız temizlenecek bir şey VARSA
                görünüyor. Kaç dosyanın gideceği önceden söyleniyor — silme
                geri alınamaz. */}
            {oksuzSayisi > 0 && !kilitli ? (
              <section className="flex flex-wrap items-center gap-3 rounded-flow border border-line bg-yuzey px-4 py-3">
                <Icon name="image" size={16} className="text-muted" />
                <p className="min-w-0 flex-1 text-sm">
                  Kütüphanede <strong>{oksuzSayisi} medya</strong> hiçbir kartta ya da soruda kullanılmıyor.
                  <span className="text-muted"> Silinen kartlardan geriye kalan dosyalar diskte yer tutar.</span>
                </p>
                <button
                  onClick={() =>
                    confirm(
                      {
                        title: "Kullanılmayan medyalar silinsin mi?",
                        message: `${oksuzSayisi} dosya kütüphaneden ve diskten kalıcı olarak silinir. Bu işlem geri alınamaz. Kartlarda ya da sorularda kullanılan hiçbir görsele dokunulmaz.`,
                        danger: true,
                        confirmLabel: `${oksuzSayisi} dosyayı sil`,
                      },
                      oksuzTemizle,
                    )
                  }
                  className="btn-ghost text-sm"
                >
                  <Icon name="trash" size={16} /> Temizle
                </button>
              </section>
            ) : null}

            {/* ── yayına hazırlık ──
                ENGELLEMEZ, SÖYLER: hazırlayan uyarılara rağmen yayınlayabilir.
                Zorunlu tutulan her kontrol ikinci haftada anlamsız bir başlık
                yazılarak aşılır; görünür bir liste ise gerçekten okunuyor. */}
            {!yayinda ? (
              <section>
                <h2 className="eyebrow mb-3">Yayına hazırlık</h2>
                <YayinKontrol liste={kontrol} />
              </section>
            ) : null}

            {/* ── gelişmiş ── */}
            <section>
              <button
                onClick={() => setAyarlarAcik((a) => !a)}
                className="dokunma-44 flex w-full items-center justify-between rounded-flow px-1 py-2 text-left"
                aria-expanded={ayarlarAcik}
              >
                <span className="eyebrow">Sınav ayarları (gelişmiş)</span>
                <Icon name={ayarlarAcik ? "up" : "down"} size={16} className="text-muted" />
              </button>

              {ayarlarAcik ? (
                <div className="card grid gap-4 p-5 sm:grid-cols-2">
                  <Sayi
                    kilitli={kilitli}
                    etiket="Geçme notu"
                    deger={egitim.gecmeNotu}
                    onDegis={(v) => kaydet(() => egitimGuncelleEylem(egitim.id, { gecmeNotu: v }))}
                  />
                  <Sayi
                    kilitli={kilitli}
                    etiket="Deneme hakkı"
                    deger={egitim.denemeHakki}
                    onDegis={(v) => kaydet(() => egitimGuncelleEylem(egitim.id, { denemeHakki: v }))}
                  />
                  <Sayi
                    kilitli={kilitli}
                    etiket="Sınavdaki soru sayısı"
                    girdiRef={soruSayisiRef}
                    deger={egitim.soruSayisi}
                    onDegis={(v) => kaydet(() => egitimGuncelleEylem(egitim.id, { soruSayisi: v }))}
                  />
                  <Sayi
                    kilitli={kilitli}
                    etiket="Tekrar (ay) — boş: tekrar yok"
                    deger={egitim.tekrarAy ?? 0}
                    onDegis={(v) => kaydet(() => egitimGuncelleEylem(egitim.id, { tekrarAy: v || undefined }))}
                  />
                  <label className="flex items-center gap-3 sm:col-span-2">
                    <input
                      type="checkbox"
                      disabled={kilitli}
                      defaultChecked={egitim.karisik}
                      onChange={(e) => kaydet(() => egitimGuncelleEylem(egitim.id, { karisik: e.target.checked }))}
                      className="h-5 w-5"
                    />
                    <span className="text-sm">
                      <strong>Soruları karıştır.</strong>{" "}
                      <span className="text-muted">
                        Kapatılırsa herkese aynı sorular aynı sırayla gelir — arka arkaya 12 kişi aynı deseni tıklayabilir.
                      </span>
                    </span>
                  </label>
                </div>
              ) : null}
            </section>

            {/* ── tehlikeli bölge ── */}
            <section className="flex flex-wrap gap-2 border-t border-line pt-6">
              <button onClick={() => calistir(() => egitimKopyalaEylem(egitim.id))} className="btn-ghost text-sm">
                <Icon name="copy" size={16} /> Kopyala
              </button>
              <button
                onClick={() =>
                  confirm(
                    {
                      title: "Eğitim silinsin mi?",
                      message: `"${egitim.ad}" ve tüm sayfaları/soruları silinir. Tamamlanmış oturum KAYITLARI silinmez.`,
                      danger: true,
                      confirmLabel: "Sil",
                    },
                    () => calistir(() => egitimSilEylem(egitim.id)),
                  )
                }
                className="btn-ghost text-sm text-brand"
              >
                <Icon name="trash" size={16} /> Sil
              </button>
              {bekle ? <span className="self-center text-sm text-muted">Kaydediliyor…</span> : null}
            </section>
          </div>

          {/* `top-20`: başlık şeridi yapışkan (sticky) ve ~64px — önizleme
              onun altına yerleşmezse kaydırınca başlığın arkasına giriyor.
              DAR EKRANDA ÇİZİLMEZ: orada aynı önizleme alttaki şeritte durur. */}
          <aside className="hidden xl:sticky xl:top-20 xl:block">
            <CanliOnizleme sayfa={secili} sira={seciliSira} toplam={gosterilen.length} altMetinler={altMetinler} />
            {secili ? (
              <p className="mt-2 px-1 text-xs text-muted">
                Düzenlediğiniz kart burada gösterilir. Kiosk kartının kendisi çiziliyor — sahada göreceğiniz şey bu.
              </p>
            ) : null}
          </aside>
        </div>
      </div>

      {/* Dar ekranın önizlemesi: seçili kartı izler, yazdıkça dolar. */}
      <OnizlemeSeridi
        sayfa={secili}
        sira={seciliSira}
        toplam={gosterilen.length}
        altMetinler={altMetinler}
        acik={seritAcik}
        onAcikDegisti={setSeritAcik}
      />

      {/* ── HARİTA ÇEKMECESİ ──────────────────────────────────────────────
          Rayın sığmadığı genişliklerde harita ÇEKMECEYE düşüyor. İKİ AYRI
          DAVRANIŞ, tek bileşen:

          lg VE ÜSTÜ (dizüstü: 1366/1440/1536) — kalıcı yan panel. Perde yok,
          gövde sağa itiliyor, kart seçilince KAPANMIYOR. Ray 1640px'te
          sığıyor (kap 1280 + 156 ray + boşluk; eski 1760 eşiği 80rem'i 1280
          sanan hesaptan geliyordu, kök 13px olduğu için kap aslında 1040'tı),
          yani tipik ofis dizüstünde
          harita hiç kalıcı olamıyordu; üstelik seçince kapandığı için
          "haritadan gez, kartta düzelt" döngüsü her turda düğmeye basmayı
          gerektiriyordu. Kırk kartlık eğitimde asıl gezinme aracı buydu.

          lg ALTI (tablet/telefon) — eskisi gibi perdeli ve geçici: orada
          yan yana iki sütuna yer yok, açık kalan panel kartın üstünü örterdi.

          Dış kap tıklama geçirmez (`pointer-events-none`); yalnız perde ve
          panelin kendisi alır. Yoksa perdesiz kipte görünmez bir katman tüm
          editörü tıklanamaz yapardı. */}
      {haritaAcik ? (
        <div className="pointer-events-none fixed inset-0 z-50 min-[1800px]:hidden">
          <button
            type="button"
            onClick={() => setHaritaAcik(false)}
            aria-label="Kart haritasını kapat"
            className="pointer-events-auto absolute inset-0 h-full w-full cursor-default bg-ink/30 lg:hidden"
          />
          <div className="pointer-events-auto absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-yuzey lg:top-16 lg:border-r lg:border-line">
            <div className="flex items-center gap-2 border-b border-line px-4 py-3">
              <h2 className="eyebrow flex-1">Kart haritası</h2>
              <button onClick={() => setHaritaAcik(false)} className="btn-icon" aria-label="Kapat">
                <Icon name="close" size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              <KartHaritasi
                satirlar={haritaSatirlari}
                seciliId={secili?.id ?? null}
                kilitli={kilitli}
                secimKipi={secimKipi}
                secililer={secililer}
                onSecimDegis={secimDegis}
                surukleId={surukleId}
                birakIndeks={birakIndeks}
                onSec={haritadanSec}
                onSurukleBasla={surukleBasla}
                onSurukleBitir={surukleBitir}
                onBirakYeri={birakYeri}
                onBirak={birak}
              />
            </div>
            <p className="border-t border-line px-4 py-3 text-xs leading-snug text-muted">{KISAYOL_NOTU}</p>
          </div>
        </div>
      ) : null}

      {prova ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-paper">
          <EgitimOyun
            egitim={egitim}
            sayfalar={gosterilen}
            sorular={sorular}
            altMetinler={altMetinler}
            oturumId={`prova_${egitim.id}`}
            prova
            onCik={() => setProva(false)}
          />
        </div>
      ) : null}

      {dialog}
      {toast}
    </main>
  );
}

/**
 * Sunucudan gelen sayfa + kaydedilmemiş tuş vuruşları.
 *
 * MODÜL SEVİYESİNDE (kapanış DEĞİL): `csv.ts`teki küçültücü tuzağı — parametre
 * yakalayıp birden çok kez çağrılan yardımcı — burada da mümkündü.
 *
 * Boşaltılan alanlar depoya `null` gidiyor; tipte karşılığı `undefined`.
 */
const BOSALABILIR = ["gorselId", "videoId", "metin", "metinKarsi"];

/** Kısayollar TEK yerde yazılı — ray, çekmece ve liste altı aynı metni gösterir. */
const KISAYOL_NOTU = "Alt+↑/↓ önceki/sonraki karta gider · Ctrl+↑/↓ odaktaki kartı taşır.";

/** Kart satırının DOM kimliği — haritadan atlarken bununla bulunuyor. */
function kartDomKimligi(sayfaId: string): string {
  return `kart-${sayfaId}`;
}

/** Kayıt göstergesinin saati — `14:32`. */
function saatBicimi(an: Date): string {
  return an.toLocaleTimeString("tr", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Harita paneli KALICI mı (Tailwind `lg`)?
 *
 * Eşik CSS'te de burada da geçiyor; ikisi ayrışırsa panel geniş ekranda hem
 * açık kalır hem kart seçince kapanır. Değiştirirken İKİSİNİ birden değiştir:
 * `lg:pl-…`, `lg:hidden` ve bu satır aynı 1024px'i anlatıyor.
 *
 * Sunucuda çizimde `window` yok — orada dar varsayılır, ilk etkileşime kadar
 * fark etmez çünkü çekmece kapalı doğuyor.
 */
function genisEkran(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;
}

/** Başlığın ilk satırı; harita sütunu dar, ikinci satırın yeri yok. */
function ilkSatir(metin: string): string {
  const temiz = metin.trim();
  const kesme = temiz.indexOf("\n");
  return (kesme === -1 ? temiz : temiz.slice(0, kesme)).slice(0, 80);
}


/**
 * Yama SUNUCUDAKİYLE AYNIYSA sayfanın KENDİSİ döner — yeni nesne değil.
 *
 * Bu satır olmadan `memo` bir süre sonra işe yaramaz hâle geliyordu: `anlik`
 * haritasından kayıt hiç silinmiyor, dolayısıyla bir kez düzenlenmiş her sayfa
 * sonsuza dek "yamalı" kalıyor ve her tuş vuruşunda yeni bir nesne üretiyordu.
 * Kırk kartın hepsine dokunmuş bir hazırlayanda editör başladığı yere dönerdi.
 * Kayıt sunucuya yazıldıktan sonra iki değer eşitlenir ve satır çizim dışında
 * kalır — yamayı silmek gerekmez.
 */
function esitMi(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function birlestir(sayfa: Sayfa, yama?: Record<string, unknown>): Sayfa {
  if (!yama) return sayfa;

  const kaynak = sayfa as unknown as Record<string, unknown>;
  let farkli = false;
  for (const alan of Object.keys(yama)) {
    // Depoya `null` giden alanların tipteki karşılığı `undefined`.
    const deger = yama[alan] === null && BOSALABILIR.includes(alan) ? undefined : yama[alan];
    if (!esitMi(kaynak[alan], deger)) {
      farkli = true;
      break;
    }
  }
  if (!farkli) return sayfa;

  const b: Record<string, unknown> = { ...sayfa, ...yama };
  for (const alan of BOSALABILIR) if (b[alan] === null) b[alan] = undefined;
  return b as unknown as Sayfa;
}


function Sayi({
  etiket,
  deger,
  onDegis,
  kilitli,
  girdiRef,
}: {
  etiket: string;
  deger: number;
  onDegis: (v: number) => void;
  kilitli?: boolean;
  girdiRef?: React.RefObject<HTMLInputElement>;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold">{etiket}</span>
      <input
        ref={girdiRef}
        type="number"
        disabled={kilitli}
        defaultValue={deger}
        min={0}
        onBlur={(e) => Number(e.target.value) !== deger && onDegis(Number(e.target.value))}
        className="input-base"
      />
    </label>
  );
}
