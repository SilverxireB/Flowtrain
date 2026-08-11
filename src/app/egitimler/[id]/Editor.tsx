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
import type { BolumHaritasi } from "./bolumler";
import { kartGorselleri, type MedyaOzet } from "@/lib/editorMedya";
import { KART_ETIKET, SORU_ETIKET, type Egitim, type KartTipi, type Sayfa, type Soru, type SoruTipi } from "@/lib/tipler";
import type { Rol } from "@/lib/depo";
import {
  egitimGuncelleEylem,
  egitimKopyalaEylem,
  egitimSilEylem,
  sayfaEkleEylem,
  sayfaGuncelleEylem,
  sayfaSilEylem,
  sayfalariSiralaEylem,
  sayfalariTopluEkleEylem,
  metinKartlariEkleEylem,
  onerilenSorulariEkleEylem,
  soruEkleEylem,
  soruGuncelleEylem,
  soruSilEylem,
  taslagaAlEylem,
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
  zorSoruIdleri: string[];
  /** Yeterince denenmiş ve HİÇ yanlış yapılmamış sorular. */
  kolaySoruIdleri: string[];
  istatistik: { soruId: string; deneme: number; yanlis: number }[];
  medyalar: MedyaOzet[];
  kategoriler: string[];
  /** Kartın kopyalanabileceği diğer TASLAK eğitimler. */
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
  const [seritAcik, setSeritAcik] = useState(false);
  /** Dar/orta ekranda harita çekmecesi açık mı? Geniş ekranda rayda duruyor. */
  const [haritaAcik, setHaritaAcik] = useState(false);
  /** Sürüklenen kart ve bırakılacak ARALIK (0..n) — ikisi de çizim için. */
  const [surukleId, setSurukleId] = useState<string | null>(null);
  const [birakIndeks, setBirakIndeks] = useState<number | null>(null);
  /* Kaydedilmemiş tuş vuruşları. Sunucuya yazmak alandan çıkınca olur; bu
     harita YALNIZ önizlemeyi besler, yoksa yazarken yan taraf donuk kalırdı. */
  const [anlik, setAnlik] = useState<Record<string, Record<string, unknown>>>({});
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
        } finally {
          router.refresh();
        }
      });
    },
    [gecis, router],
  );

  const yayinaHazir = sayfalar.length > 0;
  /** Yayındayken hiçbir içerik kontrolü çalışmaz (sunucu da reddeder). */
  const kilitli = yayinda;

  const gosterilen = useMemo(() => sayfalar.map((s) => birlestir(s, anlik[s.id])), [sayfalar, anlik]);
  const secili = gosterilen.find((s) => s.id === seciliId) ?? gosterilen[0] ?? null;
  const seciliSira = secili ? gosterilen.findIndex((s) => s.id === secili.id) + 1 : 0;

  const istatistikHarita = useMemo(() => new Map(istatistik.map((i) => [i.soruId, i])), [istatistik]);
  const kontrol = useMemo(
    () => yayinKontrolu(egitim, gosterilen, sorular, kirikGorselIdler),
    [egitim, gosterilen, sorular, kirikGorselIdler],
  );

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
   * Karta ATLA: seç, görünür yap, istenirse ilk alanına odaklan.
   *
   * Odak bir sonraki çizim turunda aranıyor: dar ekranda "Önizleme" sekmesi
   * açıkken kart listesi DOM'da hiç yok, bu tıklamayla geliyor.
   */
  const kartaGit = useCallback((sayfaId: string, odakla: boolean) => {
    setSeciliId(sayfaId);
    setHaritaAcik(false);
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

  const sayfaSil = useCallback(
    (sayfaId: string) => {
      const s = gosterilenRef.current.find((x) => x.id === sayfaId);
      if (!s) return;
      confirm(
        { title: "Sayfa silinsin mi?", message: `"${s.baslik || KART_ETIKET[s.tip]}" kalıcı olarak silinir.`, danger: true },
        () => calistir(() => sayfaSilEylem(egitim.id, sayfaId)),
      );
    },
    [calistir, confirm, egitim.id],
  );

  const sayfaTasi = useCallback(
    (sayfaId: string, yon: -1 | 1) => {
      const liste = [...gosterilenRef.current];
      const i = liste.findIndex((x) => x.id === sayfaId);
      const hedef = i + yon;
      if (i < 0 || hedef < 0 || hedef >= liste.length) return;
      [liste[i], liste[hedef]] = [liste[hedef], liste[i]];
      calistir(() => sayfalariSiralaEylem(egitim.id, liste.map((x) => x.id)));
    },
    [calistir, egitim.id],
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
      sayfaTasi(id, e.key === "ArrowUp" ? -1 : 1);
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

  const soruSil = useCallback(
    (soruId: string) =>
      confirm({ title: "Soru silinsin mi?", message: "Soru havuzdan kalıcı olarak çıkar.", danger: true }, () =>
        calistir(() => soruSilEylem(egitim.id, soruId)),
      ),
    [calistir, confirm, egitim.id],
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
        not={yayinda ? `Yayında · sürüm ${egitim.surum}` : "Taslak"}
        rehberBolum="hazirlama"
        sag={
          <>
            {!yayinda ? <YayinRozeti liste={kontrol} /> : null}
            <button
              onClick={() => setProva(true)}
              disabled={sayfalar.length === 0}
              className="btn-ghost text-sm"
              title="Kiosk'ta nasıl görüneceğini gösterir; hiçbir kayıt düşmez"
            >
              <Icon name="play" size={16} /> Dene
            </button>
            {onaylayabilir ? (
              yayinda ? (
                <button onClick={() => calistir(() => taslagaAlEylem(egitim.id))} className="btn-ghost text-sm">
                  Taslağa al
                </button>
              ) : (
                <button
                  onClick={() => calistir(() => yayinlaEylem(egitim.id))}
                  disabled={!yayinaHazir}
                  className="btn-primary text-sm"
                  title={yayinaHazir ? "" : "En az bir sayfa gerekir"}
                >
                  <Icon name="check" size={16} /> Yayınla
                </button>
              )
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

          `left` KABIN SOL KENARINA GÖRE hesaplanıyor (`50vw - 53.5rem`), ekranın
          soluna yapıştırılmıyor: 2560px'lik bir monitörde sabit `left` rayı
          içerikten yarım ekran uzağa düşürür, göz o mesafeyi her seferinde
          kat etmek zorunda kalırdı. Alt sınır 0.75rem — eşik genişlikte rayı
          ekran dışına taşırmamak için. */}
      <aside className="fixed left-[max(0.75rem,calc(50vw_-_53.5rem))] top-24 z-30 hidden max-h-[calc(100vh_-_8rem)] w-48 overflow-y-auto rounded-2xl border border-line bg-white p-2 shadow-sm min-[1760px]:block">
        <h2 className="eyebrow mb-1 px-1">Kart haritası</h2>
        <KartHaritasi
          satirlar={haritaSatirlari}
          seciliId={secili?.id ?? null}
          kilitli={kilitli}
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
      <div className={`sayfa-govde ${seritAcik ? "pb-[52vh]" : "pb-24"} xl:pb-8`}>
        {/* Harita düğmesi rayın görünmediği HER genişlikte duruyor. */}
        <div className="mb-5 flex flex-wrap items-center gap-3 min-[1760px]:hidden">
          <button onClick={() => setHaritaAcik(true)} className="btn-ghost text-sm" aria-expanded={haritaAcik}>
            <Icon name="list" size={16} /> Kart haritası
            {gosterilen.length > 0 ? <span className="font-normal text-muted">{gosterilen.length}</span> : null}
          </button>
        </div>

        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_26rem] xl:items-start">
          <div className="min-w-0 space-y-8">
            {yayinda ? (
              /* Yayındaki eğitim bir KAYITTIR: tamamlanmış oturumlar "sürüm N"e
                 atıf yapıyor. İçeriği yerinde değiştirmek, insanların kayıtta
                 yazandan başka bir şeyden sınav olmuş görünmesi demek. */
              <p className="rounded-xl border border-orta/40 bg-orta/5 px-4 py-3 text-sm">
                <strong>Yayında — düzenleme kapalı.</strong>{" "}
                {onaylayabilir
                  ? "Değişiklik için önce Taslağa alın; yeniden yayınlandığında sürüm numarası artar."
                  : "Değişiklik için onaylayan rolündeki bir kişi eğitimi taslağa almalı."}
              </p>
            ) : null}

            {!onaylayabilir && !yayinda ? (
              <p className="rounded-xl border border-line bg-white px-4 py-3 text-sm text-muted">
                Hazırladığınız eğitimi <strong className="text-ink">onaylayan</strong> rolündeki bir kişi yayına alır.
                İçerik kalitesinin tek güvencesi bu ikinci gözdür.
              </p>
            ) : null}

            {/* ── tanım ── */}
            <section>
              <h2 className="eyebrow mb-3">Tanım</h2>
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
                      ? "space-y-3 rounded-2xl border-l-4 border-accent/30 bg-accent-soft/20 py-2 pl-3"
                      : "space-y-3"
                  }
                >
                  {grup.ad !== null ? (
                    /* BÖLÜM BAŞLIĞI ARTIK BİR KAPAK: kaç kart kapsadığını
                       söyler ve katlanır. Katlama telefonda zorunlu — kırk
                       kartlık eğitimde altıncı bölüme inmek için beş bölümü
                       kaydırmak gerekiyordu. */
                    <button
                      type="button"
                      onClick={() => bolumKatla(anahtar)}
                      aria-expanded={!katli}
                      className="dokunma-44 flex w-full items-center gap-2 pr-2 text-left"
                    >
                      <Icon name={katli ? "chevronRight" : "down"} size={16} className="shrink-0 text-accent" />
                      <span className="min-w-0 flex-1 truncate text-sm font-bold uppercase tracking-[0.1em] text-ink">
                        {grup.ad}
                      </span>
                      <span className="shrink-0 text-xs text-muted">{grup.kartlar.length} kart</span>
                    </button>
                  ) : null}

                  {katli ? null : grup.kartlar.map(({ sayfa: s, indeks: i }) => (
                  <div
                    key={s.id}
                    id={kartDomKimligi(s.id)}
                    data-kart={s.id}
                    className="group relative"
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

                    <BolumAyraci sayfaId={s.id} baslik={bolumler[s.id]} kilitli={kilitli} onYaz={bolumYaz} />

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
                              className={`hidden shrink-0 rounded-md p-0.5 sm:inline-grid sm:place-items-center ${
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
              </div>

              {sayfalar.length > 0 && !kilitli ? (
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm font-semibold text-muted hover:text-ink">
                    Başka bir sunum ya da PDF ekle
                  </summary>
                  <div className="mt-3">
                    <IceriAktar onPdfKartlari={pdfKartlari} onPptxKartlari={pptxKartlari} />
                  </div>
                </details>
              ) : null}
            </section>

            {/* ── sorular ── */}
            <section>
              <h2 className="eyebrow mb-3">Sorular · {sorular.length} soru havuzda</h2>

              {/* Uyarı ÇÖZÜMÜ AÇAR. Sınav ayarları katlanmış bir bölümde
                  duruyor; sorunu görüp düzeltmesini kapalı bir kutunun içinde
                  aratmak, uyarıyı "okundu geçildi" satırına çevirir. */}
              {sorular.length > 0 && sorular.length < egitim.soruSayisi ? (
                <p className="mb-3 rounded-xl border border-orta/30 bg-orta/5 px-4 py-3 text-sm font-semibold text-orta-dark">
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
              <section className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-white px-4 py-3">
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
                className="dokunma-44 flex w-full items-center justify-between rounded-xl px-1 py-2 text-left"
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
                      className="h-5 w-5 accent-accent"
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
          Rayın sığmadığı genişliklerde harita ÇEKMECEYE düşüyor: editörün
          yanında kalıcı bir sütun açsaydı, zaten dar olan düzenleme alanını
          bir de o bölerdi. Kart seçilince kendiliğinden kapanıyor — açık
          kalan bir panel, atladığı kartın üstünü örterdi. */}
      {haritaAcik ? (
        <div className="fixed inset-0 z-50 min-[1760px]:hidden">
          <button
            type="button"
            onClick={() => setHaritaAcik(false)}
            aria-label="Kart haritasını kapat"
            className="absolute inset-0 h-full w-full cursor-default bg-ink/30"
          />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white">
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
