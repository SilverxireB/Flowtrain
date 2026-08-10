"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import Icon from "@/components/Icon";
import Kart from "./Kart";
import Bicimli from "./Bicimli";
import {
  bolgeCoz,
  bolgeVurusu,
  eslestirmeCifti,
  karistir,
  puanla,
  sinaviKur,
  tohumla,
  type Bolge,
} from "@/lib/sinav";
import { yanlisAciklamalari, type YanlisAciklama } from "@/lib/kioskAkis";
import type { Egitim, Sayfa, Soru } from "@/lib/tipler";

/**
 * EĞİTİM OYNATICI — kiosk akışının tamamı.
 *
 * TEK BİLEŞEN, İKİ KİP: editördeki "▶ Dene" ile kiosk AYNI bileşeni çalıştırır
 * (`prova` kipinde hiçbir şey yazılmaz). Ayrı bir önizleme bileşeni yazsaydık
 * ikisi zamanla ayrışır ve hazırlayan gördüğünden başkasını yayınlardı.
 *
 * SAHTECİLİK ÖNLEMLERİ BURADA (v1 kapsamı, ertelenmez):
 *  - her kartın asgari kalma süresi dolmadan "İleri" açılmaz
 *  - video ilk izlemede atlanamaz (sona gelmeden ileri yok)
 *  - sorular tohumlu havuzdan gelir; tohum oturum kimliğidir
 *  - bitirmeyi İŞÇİ kendi PIN'iyle yapar (imza yerine geçer), amir değil
 *  - sayfa süreleri kaydedilir → panoda anomali satırı
 */

type Asama = "icerik" | "sinav" | "imza" | "sonuc";

/** Sınav sorusu — GERÇEK oturumda cevap anahtarı gelmez, provada gelir. */
export type SoruGorunum = Omit<Soru, "dogru"> & { dogru?: number[] };

export interface OyunSonucu {
  sayfaSureleri: Record<string, number>;
  /** soruId → işaretlenen şıklar. Puanı SUNUCU hesaplar. */
  cevaplar: Record<string, number[]>;
  pin: string;
  iseGiris?: string;
}

/**
 * Sunucunun bitişte döndürdüğü cevap.
 *
 * `yanlislar` SINAV KAPANDIKTAN SONRA gelir ve yalnız kişinin KENDİ yanlış
 * yaptığı soruların açıklamasını taşır — cevap anahtarı değil. Sırası önemli:
 * açıklama cevaptan önce inseydi sınav kendi cevabını söylerdi.
 */
export interface BitisCevabi {
  hata?: string;
  puan?: number;
  gecti?: boolean;
  yanlislar?: YanlisAciklama[];
}

export default function EgitimOyun({
  egitim,
  sayfalar,
  sorular,
  altMetinler,
  oturumId,
  prova = false,
  kisiAdi,
  pinKurulacak = false,
  iseGirisSorulacak = false,
  sinavHazir = false,
  imzaKipi = "pin",
  bitirEtiketi,
  cikEtiketi,
  otoCikSn,
  onBitir,
  onCik,
}: {
  egitim: Egitim;
  sayfalar: Sayfa[];
  sorular: SoruGorunum[];
  /**
   * Görsel kimliği → hazırlayanın yazdığı alt metni (`Medya.altMetin`).
   * Verilmezse kart ve soru görseli türetilmiş metne düşer — editörün canlı
   * önizlemesi medya kütüphanesini taşımıyor ve taşımak zorunda değil.
   */
  altMetinler?: Record<string, string>;
  oturumId: string;
  prova?: boolean;
  kisiAdi?: string;
  /**
   * İMZA KİPİ — üçüncü kip, ayrı bileşen değil.
   *
   * `pin`: çalışan. PIN imza yerine geçer, kayıt kurumun eğitim dosyasına gider.
   * `onay`: ziyaretçi. PIN'i yok, bir daha gelmeyecek; imza yerine adının
   * yazdığı bir onay ekranı geçer. Bunun için ayrı bir oynatıcı yazsaydık iki
   * oynatıcı zamanla ayrışır ve ziyaretçi, hazırlayanın gördüğünden başka bir
   * şey izlerdi — bileşenin en başındaki "tek bileşen, iki kip" kuralı bu.
   */
  imzaKipi?: "pin" | "onay";
  /** Onay düğmesinin yazısı. */
  bitirEtiketi?: string;
  /** Sonuç ekranındaki çıkış düğmesinin yazısı (ziyaretçide "sıradaki"). */
  cikEtiketi?: string;
  /** İlk kez giren kişi PIN'ini burada belirler. */
  pinKurulacak?: boolean;
  /** İlk PIN'de işe giriş tarihi de sorulur (kimliği kaba biçimde doğrular). */
  iseGirisSorulacak?: boolean;
  /** `sorular` zaten sunucuda seçilip karıştırıldıysa istemci yeniden kurmaz. */
  sinavHazir?: boolean;
  /**
   * Sonuç ekranı kaç saniye sonra kendiliğinden kapansın (kiosk).
   *
   * DOKUNUŞ SAYISI: sonuçtaki "Bitir", kiosk akışının DÖRDÜNCÜ dokunuşuydu ve
   * teslim ölçütü üçtür. Basılmadığında ekran zaten kişisel bilgiyle sıradaki
   * insanı bekliyordu. Ziyaretçi tabletinde verilmez: orada ekranı okuyan
   * kişinin acelesi yok ve tableti masaya geri veren o.
   */
  otoCikSn?: number;
  onBitir?: (sonuc: OyunSonucu) => Promise<BitisCevabi | void>;
  onCik?: () => void;
}) {
  const [asama, setAsama] = useState<Asama>("icerik");
  const [indeks, setIndeks] = useState(0);
  const [kalan, setKalan] = useState(sayfalar[0]?.asgariSure ?? 0);
  const [videoBitti, setVideoBitti] = useState(false);
  const [sureler, setSureler] = useState<Record<string, number>>({});
  const [cevaplar, setCevaplar] = useState<Record<string, number[]>>({});
  const [soruIndeks, setSoruIndeks] = useState(0);
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [iseGiris, setIseGiris] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [sonuc, setSonuc] = useState<{ puan: number; gecti: boolean } | null>(null);
  const [yanlislar, setYanlislar] = useState<YanlisAciklama[]>([]);
  const kilit = useRef(false);

  /* Gerçek oturumda sınav SUNUCUDA kurulur (tohum = oturum kimliği) ve buraya
     hazır gelir. Provada havuzun tamamı geldiği için burada kurulur. */
  const sinavSorulari = useMemo<SoruGorunum[]>(
    () =>
      sinavHazir ? sorular : sinaviKur(sorular as Soru[], egitim.soruSayisi, egitim.karisik, tohumla(oturumId)),
    [sinavHazir, sorular, egitim.soruSayisi, egitim.karisik, oturumId],
  );

  const sayfa = sayfalar[indeks];
  const sonSayfa = indeks >= sayfalar.length - 1;
  /** Sonuç ekranında okunacak bir açıklama var mı (geri sayımı uzatır). */
  const okunacakVar = yanlislar.some((y) => (y.aciklama ?? "").trim() !== "");

  /* Asgari süre sayacı. Sekme arkaya atılırsa sayaç durur: telefonu cebe
     koyup beklemek "izlemek" değildir. */
  useEffect(() => {
    if (asama !== "icerik" || !sayfa) return;
    setKalan(sayfa.asgariSure);
    setVideoBitti(false);
    if (sayfa.asgariSure <= 0) return;

    const t = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      setKalan((k) => (k > 0 ? k - 1 : 0));
      setSureler((s) => ({ ...s, [sayfa.id]: (s[sayfa.id] ?? 0) + 1 }));
    }, 1000);
    return () => clearInterval(t);
  }, [asama, sayfa]);

  /* Süresi olmayan kart (video) da geçen süreyi saymalı — yoksa anomali
     ölçüsü videoyu hiç görmez. */
  useEffect(() => {
    if (asama !== "icerik" || !sayfa || sayfa.asgariSure > 0) return;
    const t = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      setSureler((s) => ({ ...s, [sayfa.id]: (s[sayfa.id] ?? 0) + 1 }));
    }, 1000);
    return () => clearInterval(t);
  }, [asama, sayfa]);

  const videoBekliyor = sayfa?.tip === "video" && !!sayfa.videoId && !videoBitti;
  const ileriAcik = kalan <= 0 && !videoBekliyor;

  const ileri = useCallback(() => {
    if (!ileriAcik) return;
    if (sonSayfa) {
      setAsama(sinavSorulari.length > 0 ? "sinav" : prova ? "sonuc" : "imza");
      if (sinavSorulari.length === 0 && prova) setSonuc({ puan: 0, gecti: true });
    } else setIndeks((i) => i + 1);
  }, [ileriAcik, sonSayfa, sinavSorulari.length, prova]);

  const soru = sinavSorulari[soruIndeks];
  const secili = soru ? (cevaplar[soru.id] ?? []) : [];
  const cokluSecim = soru?.tip === "cokluSecim";
  /* ŞIK LİSTESİ ile cevaplanan tipler. `bosluk` buraya dahil: cümledeki boşluk
     görsel olarak farklı çizilir ama cevaplama ve puanlama çoktan seçmelinin
     aynısıdır — ayrı bir cevap biçimi uydurmak, `sinav.ts`teki puanlamayı
     ikiye bölerdi. */
  const sikliSoru =
    soru?.tip === "coktanSecmeli" || soru?.tip === "dogruYanlis" || soru?.tip === "cokluSecim" || soru?.tip === "bosluk";
  const tamam = soru ? cevapTam(soru, secili) : false;

  function secenegeBas(i: number) {
    if (!soru) return;
    setCevaplar((c) => {
      const mevcut = c[soru.id] ?? [];
      if (!cokluSecim) return { ...c, [soru.id]: [i] };
      return { ...c, [soru.id]: mevcut.includes(i) ? mevcut.filter((x) => x !== i) : [...mevcut, i] };
    });
  }

  /** Yeni tiplerin cevabı bütün olarak yazılır (sıra dizisi, eşleme dizisi). */
  function cevabiAyarla(yeni: number[]) {
    if (!soru) return;
    setCevaplar((c) => ({ ...c, [soru.id]: yeni }));
  }

  function soruIleri() {
    if (!tamam) return;
    if (soruIndeks < sinavSorulari.length - 1) setSoruIndeks((i) => i + 1);
    else if (prova) {
      // Provada cevap anahtarı elimizde (hazırlayan zaten yetkili) — puanı
      // burada hesaplamak sunucuya hiç dokunmadan sonucu göstermeyi sağlar.
      // Açıklama listesi de aynı yerden çıkar: hazırlayan yazdığı açıklamayı
      // işçinin göreceği yerde, göreceği biçimde görmeli.
      const p = puanla(sinavSorulari as Soru[], cevaplar);
      setSonuc({ puan: p.puan, gecti: p.puan >= egitim.gecmeNotu });
      setYanlislar(yanlisAciklamalari(sinavSorulari, p.yanlisSoruIdleri));
      setAsama("sonuc");
    } else setAsama("imza");
  }

  async function imzala() {
    // ÇİFT TIKLAMA KİLİDİ `useRef` ile: state kilidi yarışı kaybediyor —
    // iki hızlı dokunuş aynı çizimi okuyup ikisi de geçiyordu.
    if (kilit.current) return;
    setHata(null);

    // Onay kipinde PIN alanı hiç çizilmez; doğrulamaları da atlanır.
    if (imzaKipi === "pin") {
      if (!/^\d{4}$/.test(pin)) return setHata("PIN 4 rakam olmalı.");
      if (pinKurulacak && pin !== pin2) return setHata("İki PIN aynı değil.");
      if (iseGirisSorulacak && !iseGiris.trim()) return setHata("İşe giriş tarihinizi girin.");
    }

    kilit.current = true;

    /* AĞ KOPARSA KİLİT AÇILMALI.
       Sunucu eylemi ağ kesildiğinde REDDEDİLİR (throw). Eskiden `await`
       doğrudan yazılıydı: hata fırlayınca `kilit.current = false` satırına hiç
       gelinmiyor, kiosk "Onayla ve bitir" düğmesi sessizce ölüyordu — işçi
       basıyor, hiçbir şey olmuyordu ve tek çare tableti yeniden başlatmaktı.
       Yarım oturum sunucuda AÇIK kalır (bitiş damgası yok) ve iki saat sonra
       `eskiOturumlariKapat` onu iptal eder; deneme hakkı yanmaz. */
    let cevap: BitisCevabi | void;
    try {
      // Puan BURADA hesaplanmaz: gerçek oturumda cevap anahtarı istemcide yok
      // ve sonuç kurumun eğitim kaydına yazılıyor — sunucu karar verir.
      cevap = await onBitir?.({
        sayfaSureleri: sureler,
        cevaplar,
        pin,
        iseGiris: iseGirisSorulacak ? iseGiris : undefined,
      });
    } catch {
      kilit.current = false;
      return setHata("Bağlantı kurulamadı. Ekranı kapatmayın, tekrar deneyin.");
    }
    kilit.current = false;

    if (!cevap || cevap.hata) return setHata(cevap?.hata ?? "Kayıt tamamlanamadı, tekrar deneyin.");
    setSonuc({ puan: cevap.puan ?? 0, gecti: !!cevap.gecti });
    setYanlislar(cevap.yanlislar ?? []);
    setAsama("sonuc");
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-5 py-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-muted">{egitim.ad}</p>
          {kisiAdi ? <p className="truncate text-xs text-muted">{kisiAdi}</p> : null}
        </div>
        {prova ? (
          <span className="chip border-accent/40 bg-accent-soft text-accent-dark">
            <Icon name="eye" size={14} /> Prova — kayıt düşmez
          </span>
        ) : null}
        {onCik ? (
          /* 72px'lik dokunma hedefi — eldivenle. Kokpitin `.btn-icon`ı 36px ve
             burada ıskalanıyordu; sadeleştirme görünümde değil HEDEFTE: kutu
             büyük, çizgi hâlâ ince. Ölçüler satır içi yazılıydı; ikinci bir
             simge düğmesi eklenince kopyalanacaklardı — kural artık
             `.kiosk-btn-ikon` ile tek yerde (`globals.css`). */
          <button onClick={onCik} aria-label="Eğitimden çık" className="kiosk-btn-ikon">
            <Icon name="close" size={26} />
          </button>
        ) : null}
      </div>

      {asama === "icerik" && sayfa ? (
        <>
          <Ilerleme simdi={indeks + 1} toplam={sayfalar.length} etiket="Sayfa" />
          <div className="flex-1 py-6">
            <Kart sayfa={sayfa} altMetinler={altMetinler} key={sayfa.id} />
            {sayfa.tip === "video" && sayfa.videoId ? (
              <VideoBekci sayfaId={sayfa.id} onBitti={() => setVideoBitti(true)} />
            ) : null}
          </div>
          <div className="sticky bottom-0 -mx-5 border-t border-line bg-white/90 px-5 py-4 backdrop-blur">
            {/* Sayaç saniye saniye seslendirilemez (ekran okuyucu boğulur);
                yalnız kapının AÇILDIĞI an duyurulur. */}
            <p aria-live="polite" className="sr-only">
              {ileriAcik ? "İleri düğmesi açıldı." : ""}
            </p>
            <button onClick={ileri} disabled={!ileriAcik} className="kiosk-btn-primary">
              {videoBekliyor ? (
                <>
                  <Icon name="play" size={22} /> Videoyu sonuna kadar izleyin
                </>
              ) : kalan > 0 ? (
                <>
                  <Icon name="hourglass" size={22} /> {kalan} sn
                </>
              ) : (
                <>
                  {/* Son sayfada düğme SIRADAKİ AŞAMAYI söyler. Sabit "Sınava
                      geç" yazdığında sınavsız bir bilgilendirmenin sonunda
                      olmayan bir sınav vaat ediliyordu. */}
                  {!sonSayfa
                    ? "İleri"
                    : sinavSorulari.length > 0
                      ? "Sınava geç"
                      : imzaKipi === "onay"
                        ? "Onaya geç"
                        : "İmzaya geç"}{" "}
                  <Icon name="chevronRight" size={22} />
                </>
              )}
            </button>
          </div>
        </>
      ) : null}

      {asama === "sinav" && soru ? (
        <>
          <Ilerleme simdi={soruIndeks + 1} toplam={sinavSorulari.length} etiket="Soru" />
          <div className="flex-1 py-6">
            <h2 id={`soru-${soru.id}`} className="text-2xl font-extrabold leading-tight sm:text-3xl">
              {soru.tip === "bosluk" ? (
                /* Seçilen şık BOŞLUĞUN İÇİNDE gösterilir: cümleyi tamamlanmış
                   hâliyle okumak, "hangisini seçmiştim" diye aşağı bakmaya
                   gerek bırakmıyor — ekstra dokunuş değil, ekstra bakış
                   tasarrufu. */
                <BoslukluSoru metin={soru.metin} secilenMetin={soru.secenekler[secili[0]]} />
              ) : (
                soru.metin
              )}
            </h2>
            {/* SORU GÖRSELİ — "hangisi doğru duruş" tipi sorular metinle
                sorulamıyor. Şıkların ÜSTÜNDE durur: cevabı verirken görselin
                ekranda kalması gerekiyor, kaydırmayla değil.
                `gorselIsaret`te çizilmez: orada görsel süs değil CEVAP ALANI,
                kendi bileşeni içinde bölge katmanıyla birlikte çiziliyor. */}
            {soru.gorselId && soru.tip !== "gorselIsaret" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/medya/${soru.gorselId}`}
                /* "Soru görseli" bir açıklama değil, bir etiket. Hazırlayan
                   görsele alt metni yazdıysa soruyu ANLAŞILIR kılan odur —
                   "hangisi doğru duruş" sorusu görseli okunmadan cevaplanamaz. */
                alt={(altMetinler?.[soru.gorselId] ?? "").trim() || "Soru görseli"}
                className="mt-5 max-h-[34vh] w-full rounded-2xl border border-line object-contain"
              />
            ) : null}
            {cokluSecim ? (
              <p className="mt-2 text-sm font-semibold text-muted">Birden fazla şık işaretleyebilirsiniz.</p>
            ) : null}

            {/* Tek seçimlik soru RADYO grubudur, çoklu seçim ONAY KUTUSU
                grubudur. Hepsi `aria-pressed` ile "basılı düğme" olarak
                duyuruluyordu; ekran okuyucu kullanan kişi kaç şıktan kaçını
                seçebileceğini hiç duymuyordu. */}
            {sikliSoru ? (
              <div
                role={cokluSecim ? "group" : "radiogroup"}
                aria-labelledby={`soru-${soru.id}`}
                className="mt-6 space-y-3"
              >
                {soru.secenekler.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => secenegeBas(i)}
                    className={`kiosk-secenek ${secili.includes(i) ? "kiosk-secenek-secili" : ""}`}
                    role={cokluSecim ? "checkbox" : "radio"}
                    aria-checked={secili.includes(i)}
                  >
                    <span
                      className={`grid h-8 w-8 shrink-0 place-items-center ${
                        cokluSecim ? "rounded-lg" : "rounded-full"
                      } border-2 ${secili.includes(i) ? "border-accent bg-accent text-white" : "border-line"}`}
                    >
                      {secili.includes(i) ? <Icon name="check" size={16} /> : null}
                    </span>
                    <span>{s}</span>
                  </button>
                ))}
              </div>
            ) : null}

            {soru.tip === "siralama" || soru.tip === "eslestirme" ? (
              <SiraliEsleme soru={soru} oturumId={oturumId} secili={secili} ayarla={cevabiAyarla} />
            ) : null}

            {soru.tip === "gorselIsaret" ? (
              <GorselIsaret soru={soru} secili={secili} ayarla={cevabiAyarla} altMetinler={altMetinler} />
            ) : null}
          </div>
          <div className="sticky bottom-0 -mx-5 border-t border-line bg-white/90 px-5 py-4 backdrop-blur">
            <button onClick={soruIleri} disabled={!tamam} className="kiosk-btn-primary">
              {soruIndeks < sinavSorulari.length - 1 ? "Sonraki soru" : prova ? "Sonucu gör" : "Bitir"}
              <Icon name="chevronRight" size={22} />
            </button>
          </div>
        </>
      ) : null}

      {asama === "imza" && imzaKipi === "onay" ? (
        <div className="flex-1 py-6">
          <h2 className="text-2xl font-extrabold sm:text-3xl">Onay</h2>
          {/* Ziyaretçinin imzası bu ekran. PIN yok, ama onayladığı cümle
              ekranda yazılı duruyor ve adı kayda onunla birlikte geçiyor. */}
          <p className="mt-4 text-lg leading-relaxed text-ink/90">
            Ben{kisiAdi ? <strong className="text-ink"> {kisiAdi}</strong> : null}, bu bilgilendirmeyi baştan sona
            izlediğimi ve anladığımı onaylıyorum.
          </p>
          <p className="mt-3 text-lg text-muted">
            &quot;{bitirEtiketi ?? "Tamamla"}&quot; dediğinizde adınız ve saat kayda geçer.
          </p>

          {hata ? (
            <p role="alert" className="mt-5 rounded-xl border border-brand/30 bg-brand-soft px-4 py-3 font-semibold text-brand-dark">
              {hata}
            </p>
          ) : null}

          <button onClick={imzala} className="kiosk-btn-primary mt-8">
            <Icon name="check" size={22} /> {bitirEtiketi ?? "Tamamla"}
          </button>
        </div>
      ) : null}

      {asama === "imza" && imzaKipi === "pin" ? (
        <div className="flex-1 py-6">
          <h2 className="text-2xl font-extrabold sm:text-3xl">
            {pinKurulacak ? "Kendinize bir PIN belirleyin" : "PIN'inizi girin"}
          </h2>
          {/* İmza METNİ önemli: kişi neyi onayladığını bilmeli. Amirin
              tabletinde de bu ekran çıkar ve PIN'i İŞÇİ girer. */}
          <p className="mt-3 text-lg text-muted">
            {pinKurulacak
              ? "Bu PIN bundan sonra sizin imzanız olacak. Kimseyle paylaşmayın."
              : "PIN'iniz imzanız yerine geçer: eğitimi sizin tamamladığınızı onaylar."}
          </p>

          <div className="mt-8 max-w-xs space-y-4">
            <PinAlani deger={pin} ayarla={setPin} etiket="PIN (4 rakam)" />
            {pinKurulacak ? <PinAlani deger={pin2} ayarla={setPin2} etiket="PIN tekrar" /> : null}
            {iseGirisSorulacak ? (
              <label className="block">
                <span className="mb-2 block font-semibold">İşe giriş tarihiniz</span>
                <input
                  value={iseGiris}
                  onChange={(e) => setIseGiris(e.target.value)}
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="GG.AA.YYYY"
                  className="input-base text-center text-xl font-semibold"
                />
                {/* Tek seferlik kimlik kontrolü: PIN'i ilk kez belirlerken,
                    başkasının sicilini girip onun imzasını ele geçirmeyi
                    zorlaştırır. Sonraki girişlerde sorulmaz. */}
                <span className="mt-1 block text-sm text-muted">
                  İlk PIN&apos;i belirlerken bir kez sorulur.
                </span>
              </label>
            ) : null}
          </div>

          {hata ? (
            <p role="alert" className="mt-5 rounded-xl border border-brand/30 bg-brand-soft px-4 py-3 font-semibold text-brand-dark">
              {hata}
            </p>
          ) : null}

          <button onClick={imzala} className="kiosk-btn-primary mt-8 max-w-xs">
            <Icon name="check" size={22} /> Onayla ve bitir
          </button>
        </div>
      ) : null}

      {asama === "sonuc" && sonuc ? (
        <div className="flex flex-1 flex-col items-center py-10 text-center">
          <span
            className={`grid h-24 w-24 place-items-center rounded-full ${
              sonuc.gecti ? "bg-iyi/10 text-iyi-dark" : "bg-brand-soft text-brand"
            }`}
          >
            <Icon name={sonuc.gecti ? "check" : "close"} size={48} />
          </span>
          <h2 className="mt-6 text-3xl font-extrabold">
            {sinavSorulari.length === 0 ? "Tamamlandı" : sonuc.gecti ? "Tebrikler, geçtiniz" : "Geçemediniz"}
          </h2>
          <p className="mt-2 text-xl text-muted">
            {sinavSorulari.length === 0 ? (
              imzaKipi === "onay" ? (
                "Bilgilendirmeyi izlediniz ve onayladınız."
              ) : (
                "Eğitimi izlediniz ve imzaladınız."
              )
            ) : (
              <>
                Puanınız <strong className="text-ink">{sonuc.puan}</strong> · geçme notu {egitim.gecmeNotu}
              </>
            )}
          </p>
          {/* Ziyaretçinin deneme hakkı yoktur; "kaldınız, N hakkınız var"
              cümlesi orada anlamsız (sınav da yok). */}
          {!sonuc.gecti && imzaKipi === "pin" ? (
            <p className="mt-4 max-w-sm text-muted">
              Eğitimi tekrar izleyip yeniden deneyebilirsiniz. Deneme hakkınız: {egitim.denemeHakki}
            </p>
          ) : null}

          <Aciklamalar yanlislar={yanlislar} />

          {onCik ? (
            <button onClick={onCik} className="kiosk-btn-primary mt-10 max-w-xs">
              {cikEtiketi ?? "Bitir"}
              {/* Okunacak açıklama varsa geri sayım UZAR. Ekranı kişinin
                  gözünün önünden 20 saniyede çekmek, "neden yanlıştı"
                  kutusunu hiç okutmamakla aynı şey olurdu. */}
              {otoCikSn ? (
                <GeriSayim saniye={okunacakVar ? otoCikSn * 3 : otoCikSn} onBitti={onCik} />
              ) : null}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Doldurulmamış yuva. Cevap dizisi `number[]` kalmalı (puanlama öyle yazıldı). */
const BOS = -1;

/**
 * Sorunun cevabı GÖNDERİLEBİLECEK kadar tamam mı?
 *
 * Eski kural "en az bir şık işaretli"ydi ve yeni tiplerde yetmiyor: yarım
 * sıralama ya da eksik eşleme gönderildiğinde `sinav.ts` bunu sessizce YANLIŞ
 * sayar. Kişi cevabı bildiği hâlde, düğme açık göründüğü için yarım
 * göndererek kalırdı — kapıyı burada tutuyoruz.
 */
function cevapTam(soru: SoruGorunum, secili: number[]): boolean {
  if (soru.tip === "siralama" || soru.tip === "eslestirme") {
    return secili.length === soru.secenekler.length && !secili.includes(BOS);
  }
  return secili.length > 0;
}

/**
 * BOŞLUK DOLDURMA — cümledeki `___` ekranda gerçekten boşluk gibi görünür.
 *
 * Klavye YOK: kiosk eldivenle kullanılıyor, boşluğu yazdırmak en çok öğreten
 * soruyu en az cevaplanan soru yapardı (`tipler.ts`teki not). Boşluk yalnız
 * cümlenin nerede kesildiğini gösterir; cevap şıklardan seçilir.
 */
function BoslukluSoru({ metin, secilenMetin }: { metin: string; secilenMetin?: string }) {
  // İki ve daha fazla alt çizgi boşluk sayılır: hazırlayan `__` da yazabiliyor.
  const parcalar = metin.split(/_{2,}/);
  // TEK boşlukta seçilen şık boşluğa yazılır. Birden çok boşluk varsa hangisine
  // yazılacağı belirsiz — hepsine aynı kelimeyi koymak cümleyi bozardı.
  const dolgu = parcalar.length === 2 ? (secilenMetin ?? "").trim() : "";

  return (
    <>
      {parcalar.map((p, i) => (
        <Fragment key={i}>
          {i > 0 ? (
            <span
              className={`mx-1 inline-block min-w-[6ch] rounded-lg border-b-4 px-2 text-center align-baseline ${
                dolgu ? "border-accent bg-accent-soft text-accent-dark" : "border-accent/50 bg-accent-soft/50"
              }`}
            >
              {dolgu || <span className="sr-only">boşluk</span>}
              {dolgu ? null : " "}
            </span>
          ) : null}
          {p}
        </Fragment>
      ))}
    </>
  );
}

/**
 * SIRALAMA ve EŞLEŞTİRME — tek bileşen, çünkü etkileşim AYNI.
 *
 * İkisi de "yuvalar var, havuzdan seçilen madde yuvaya girer" işidir:
 * sıralamada yuvalar 1., 2., 3. sıradır; eşleştirmede yuvalar soldaki
 * maddelerdir. İki ayrı bileşen yazsaydık ikisi zamanla ayrışır ve işçi aynı
 * sınavda iki farklı etkileşim öğrenmek zorunda kalırdı.
 *
 * SÜRÜKLE-BIRAK YOK: eldivenli parmak bir listeyi sürükleyemiyor, dokunma
 * hareketi kaydırmayla karışıyor. Dokunarak yerleştirme N madde için N dokunuş
 * — sürüklemenin en iyi hâliyle aynı, ama ıskalayınca liste kaymıyor.
 *
 * HAVUZ TOHUMLU KARIŞTIRILIR: `sinaviKur` soruları karıştırıyor, şıkları
 * değil. Sıralamada şıklar doğru sırada saklandığı için karıştırılmadan
 * gösterilseydi cevap ekranda hazır dururdu. Tohum `oturumId + soru.id`:
 * her yeniden çizimde aynı dizilim gelir, yoksa kişi dizdiğini kaybederdi.
 */
function SiraliEsleme({
  soru,
  oturumId,
  secili,
  ayarla,
}: {
  soru: SoruGorunum;
  oturumId: string;
  secili: number[];
  ayarla: (yeni: number[]) => void;
}) {
  const eslestirme = soru.tip === "eslestirme";

  const { yuvaEtiketleri, havuzMetinleri } = useMemo(() => {
    if (soru.tip === "eslestirme") {
      const ciftler = soru.secenekler.map((s) => eslestirmeCifti(s));
      return { yuvaEtiketleri: ciftler.map((c) => c.sol), havuzMetinleri: ciftler.map((c) => c.sag) };
    }
    return {
      yuvaEtiketleri: soru.secenekler.map((_, i) => `${i + 1}.`),
      havuzMetinleri: soru.secenekler,
    };
  }, [soru]);

  const dizilim = useMemo(
    () => karistir(havuzMetinleri.map((_, i) => i), tohumla(oturumId + soru.id)),
    [havuzMetinleri, oturumId, soru.id],
  );

  /* Cevap dizisi HER ZAMAN yuva sayısı kadar uzun; boş yuva `BOS`. Kısa dizi
     tutulsaydı ortadaki bir eşlemeyi geri almak sonrakileri kaydırırdı — kişi
     tek bir yanlışı düzeltirken doğru bildiklerini kaybederdi. */
  const cevap: number[] = [];
  for (let i = 0; i < yuvaEtiketleri.length; i++) cevap.push(secili[i] ?? BOS);
  const kalanlar = dizilim.filter((h) => !cevap.includes(h));

  function yerlestir(havuzIndeksi: number) {
    const yeni = [...cevap];
    const bos = yeni.indexOf(BOS);
    if (bos === -1) return;
    yeni[bos] = havuzIndeksi;
    ayarla(yeni);
  }

  function geriAl(yuva: number) {
    const yeni = [...cevap];
    yeni[yuva] = BOS;
    ayarla(yeni);
  }

  return (
    <div className="mt-6">
      <p className="text-base font-semibold text-muted">
        {eslestirme
          ? "Soldaki her maddeye karşılığını seçin. Yanlış seçtiyseniz × ile geri alın."
          : "Doğru sırayla dokunun: ilk dokunduğunuz 1. sıraya girer. × ile geri alabilirsiniz."}
      </p>

      <ol className="mt-4 space-y-3">
        {cevap.map((h, yuva) => (
          <li
            key={yuva}
            className={`flex items-center gap-3 rounded-2xl border-2 p-3 ${
              h === BOS ? "border-dashed border-line bg-paper" : "border-accent bg-accent-soft"
            }`}
          >
            <span
              className={`font-bold ${
                eslestirme ? "flex-1 text-lg leading-snug" : "grid h-10 w-10 shrink-0 place-items-center text-xl"
              }`}
            >
              {yuvaEtiketleri[yuva] || "—"}
            </span>
            <Icon name="chevronRight" size={22} className="shrink-0 text-muted" />
            <span className="flex-1 text-lg font-semibold">
              {h === BOS ? <span className="text-muted">Seçilmedi</span> : havuzMetinleri[h]}
            </span>
            {h === BOS ? null : (
              <button
                onClick={() => geriAl(yuva)}
                aria-label={`${yuvaEtiketleri[yuva]} seçimini geri al`}
                className="kiosk-btn-ikon"
              >
                <Icon name="close" size={24} />
              </button>
            )}
          </li>
        ))}
      </ol>

      {kalanlar.length > 0 ? (
        <div className="mt-5 space-y-3">
          <p className="text-sm font-bold uppercase tracking-wider text-muted">
            {eslestirme ? "Karşılıklar" : "Kalan maddeler"}
          </p>
          {kalanlar.map((h) => (
            <button
              key={h}
              onClick={() => yerlestir(h)}
              className="kiosk-secenek"
              aria-label={
                eslestirme
                  ? `${havuzMetinleri[h]} — sıradaki maddeye eşle`
                  : `${havuzMetinleri[h]} — sıraya ekle`
              }
            >
              <Icon name="plus" size={22} className="text-accent" />
              <span>{havuzMetinleri[h]}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * GÖRSELDE İŞARETLEME — görsel, cevabın kendisi.
 *
 * ÖLÇÜLER YÜZDE: bölgeler `sinav.ts`te yüzde olarak saklanıyor, çünkü aynı
 * görsel kioskta ve amir tabletinde farklı genişlikte çiziliyor. Tıklama da
 * yüzdeye çevrilir; piksel karşılaştırsaydık doğru yeri işaretleyen kişi dar
 * ekranda yanlış cevap alırdı.
 *
 * YALNIZ İŞARETLENENLER GÖRÜNÜR: bütün bölgeleri çerçeveleseydik soru
 * "tehlikeyi bul" olmaktan çıkıp "kutulardan birini seç"e dönerdi.
 */
function GorselIsaret({
  soru,
  secili,
  ayarla,
  altMetinler,
}: {
  soru: SoruGorunum;
  secili: number[];
  ayarla: (yeni: number[]) => void;
  altMetinler?: Record<string, string>;
}) {
  const bolgeler = useMemo<(Bolge | null)[]>(() => soru.secenekler.map((s) => bolgeCoz(s)), [soru]);

  function degistir(i: number) {
    ayarla(secili.includes(i) ? secili.filter((x) => x !== i) : [...secili, i]);
  }

  function tikla(e: MouseEvent<HTMLButtonElement>) {
    // Klavyeyle basıldığında koordinat yoktur (detail 0) — 0,0 noktasını
    // işaretlemek, ekran okuyucu kullanan kişiye rastgele cevap yazdırırdı.
    if (e.detail === 0) return;
    const k = e.currentTarget.getBoundingClientRect();
    if (k.width === 0 || k.height === 0) return;
    const vuran = bolgeVurusu(soru.secenekler, ((e.clientX - k.left) / k.width) * 100, ((e.clientY - k.top) / k.height) * 100);
    if (vuran.length === 0) return;

    /* İÇ İÇE BÖLGELERDE EN KÜÇÜĞÜ kazanır. Hepsini birden işaretlemek,
       "makinenin tamamı" bölgesinin içindeki "koruma kapağı" bölgesine
       dokunan kişiye iki cevap birden yazardı. */
    let secim = vuran[0];
    let enKucukAlan = Infinity;
    for (const i of vuran) {
      const b = bolgeler[i];
      if (!b) continue;
      const alan = b.g * b.y2;
      if (alan < enKucukAlan) {
        enKucukAlan = alan;
        secim = i;
      }
    }
    degistir(secim);
  }

  return (
    <div className="mt-5">
      <p className="text-base font-semibold text-muted">
        Tehlikeli gördüğünüz yerlere dokunun. Yanlış dokunduysanız aynı yere tekrar dokunun.
      </p>

      {/* Dokunma hedefi görselin KENDİSİ — zaten 72px'ten büyük, ama ölçü
          açıkça yazılı: görsel yüklenemezse kutu bir çizgiye inip
          dokunulamaz hâle gelmesin. */}
      {soru.gorselId ? (
        <button
          type="button"
          onClick={tikla}
          className="relative mt-4 inline-block min-h-[72px] max-w-full cursor-pointer rounded-2xl border-2 border-line focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent-soft"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/medya/${soru.gorselId}`}
            alt={(altMetinler?.[soru.gorselId] ?? "").trim() || "Soru görseli"}
            className="max-h-[46vh] w-auto max-w-full rounded-2xl object-contain"
          />
          {secili.map((i) => {
            const b = bolgeler[i];
            if (!b) return null;
            return (
              <span
                key={i}
                aria-hidden
                className="pointer-events-none absolute grid place-items-center rounded-xl border-4 border-accent bg-accent/25"
                style={{ left: `${b.x}%`, top: `${b.y}%`, width: `${b.g}%`, height: `${b.y2}%` }}
              >
                <span className="grid h-9 w-9 place-items-center rounded-full bg-accent text-white">
                  <Icon name="check" size={22} />
                </span>
              </span>
            );
          })}
        </button>
      ) : (
        <p className="mt-4 rounded-2xl border border-dashed border-line p-8 text-center text-muted">
          Görsel eklenmemiş.
        </p>
      )}

      <p aria-live="polite" className="mt-3 text-base font-semibold">
        {secili.length === 0 ? "Henüz işaret yok." : `${secili.length} yer işaretlendi.`}
      </p>

      {/* EKRAN OKUYUCU / KLAVYE KARŞILIĞI: görsele dokunmak sesli okuyucuyla
          yapılamaz, koordinat diye bir şey yok.

          Bölge etiketleri cevap anahtarı DEĞİL — şık listesinin karşılığı;
          hangisinin doğru olduğunu yine söylemiyoruz. Etiketsiz bölge listeye
          girmez: "bölge 3" kimseye bir şey anlatmaz.

          `sr-only focus:not-sr-only`: normalde görünmez, ODAK GELİNCE gerçek
          bir 72px'lik kiosk şıkkına dönüşür. Kalıcı gizli bir düğme, klavyeyle
          gezen kişiyi göremediği bir şeyi tıklarken bırakırdı. */}
      <div role="group" aria-label="Görseldeki bölgeler" className="mt-3 space-y-3">
        {bolgeler.map((b, i) =>
          b && b.etiket ? (
            <button
              key={i}
              type="button"
              role="checkbox"
              aria-checked={secili.includes(i)}
              onClick={() => degistir(i)}
              className={`kiosk-secenek sr-only focus:not-sr-only ${secili.includes(i) ? "kiosk-secenek-secili" : ""}`}
            >
              {b.etiket}
            </button>
          ) : null,
        )}
      </div>
    </div>
  );
}

/**
 * "NEDEN YANLIŞTI" KUTUSU — sınavın öğrettiği tek yer.
 *
 * CEVAPTAN SONRA: liste yalnız sonuç ekranında çizilir, sınav kapandıktan ve
 * puan sunucuda hesaplandıktan sonra. Soru sırasında gösterilseydi sınav kendi
 * cevabını söylerdi.
 *
 * DOĞRU ŞIK YAZILMIYOR, AÇIKLAMA YAZILIYOR: "cevap B idi" bir sonraki denemede
 * ezberlenecek bir harf üretir; "yağ döküntüsüne bez atmak buharı tutmaz"
 * cümlesi ise kuralı öğretir. Açıklama girilmemiş soruda sessiz kalırız —
 * uydurma bir metin yazmaktansa hiçbir şey yazmamak dürüst.
 */
function Aciklamalar({ yanlislar }: { yanlislar: YanlisAciklama[] }) {
  const aciklamali = yanlislar.filter((y) => (y.aciklama ?? "").trim() !== "");
  if (aciklamali.length === 0) return null;

  return (
    <section className="mt-10 w-full max-w-xl text-left">
      <h3 className="flex items-center gap-2 text-lg font-bold">
        <Icon name="help" size={20} className="text-accent" />
        Bunları gözden geçirin
      </h3>
      <ul className="mt-4 space-y-3">
        {aciklamali.map((y) => (
          <li key={y.soruId} className="rounded-2xl border border-line bg-white p-5">
            <p className="font-bold leading-snug">{y.metin}</p>
            {/* BİÇİM DİLİ BURADA DA GEÇERLİ. Hazırlayan kart metninde `**` ile
                vurgu yapıyor; aynı kişi açıklamayı da düzyazı olarak yazıyor.
                Biri çizilip öteki çizilmezse sahada yıldız görünür ve neyin
                nerede çalıştığı ezberlenmesi gereken bir kural olur. */}
            <div className="mt-2 text-ink/90">
              <Bicimli metin={y.aciklama} boyut="kucuk" />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Sonuç ekranı geri sayımı (yalnız kiosk).
 *
 * SEKME ARKADAYSA SAYMAZ: aynı kural içerik sayacında da var. Kiosk uykuya
 * girip uyandığında ekranı bir anda sıfırlamak, o sırada yaklaşan kişiye
 * "kayıt olmadı" izlenimi verirdi.
 */
function GeriSayim({ saniye, onBitti }: { saniye: number; onBitti: () => void }) {
  const [kalan, setKalan] = useState(saniye);
  const bitti = useRef(onBitti);
  bitti.current = onBitti;

  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      setKalan((k) => (k > 0 ? k - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  /* Çıkış AYRI ETKİDE: `setKalan` güncelleyicisinin içinden ebeveynin durumunu
     değiştirmek çizim sırasında yan etki demek. React bunu uyarıyla karşılar
     ve iki kez çizilen geliştirme kipinde çıkışı İKİ KEZ tetikliyordu. */
  useEffect(() => {
    if (kalan === 0) bitti.current();
  }, [kalan]);

  return <span className="ml-2 text-base font-semibold opacity-70">({kalan})</span>;
}

function Ilerleme({ simdi, toplam, etiket }: { simdi: number; toplam: number; etiket: string }) {
  const yuzde = Math.round((simdi / toplam) * 100);
  return (
    <div>
      <div className="flex items-center justify-between text-sm font-semibold text-muted">
        <span>
          {etiket} {simdi}/{toplam}
        </span>
        <span aria-hidden>{yuzde}%</span>
      </div>
      {/* Çubuk RENKTEN ibaret olmamalı: yüzde metni görene, `progressbar`
          rolü ekran okuyucuya söylüyor. */}
      <div
        role="progressbar"
        aria-label={`${etiket} ilerlemesi`}
        aria-valuemin={0}
        aria-valuemax={toplam}
        aria-valuenow={simdi}
        aria-valuetext={`${toplam} ${etiket.toLocaleLowerCase("tr")}dan ${simdi}. ${etiket.toLocaleLowerCase("tr")}`}
        className="mt-2 h-2 overflow-hidden rounded-full bg-line"
      >
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${yuzde}%` }} />
      </div>
    </div>
  );
}

function PinAlani({ deger, ayarla, etiket }: { deger: string; ayarla: (v: string) => void; etiket: string }) {
  return (
    <label className="block">
      <span className="mb-2 block font-semibold">{etiket}</span>
      <input
        value={deger}
        onChange={(e) => ayarla(e.target.value.replace(/\D/g, "").slice(0, 4))}
        // `inputMode=numeric` telefonda rakam tuş takımını açar; `type=number`
        // kullanılsaydı ok tuşlarıyla değer değişir ve baştaki sıfır kaybolurdu.
        inputMode="numeric"
        autoComplete="off"
        className="input-base text-center text-3xl font-bold tracking-[0.5em]"
        placeholder="••••"
      />
    </label>
  );
}

/**
 * Video bekçisi: videonun sonuna gelinmeden ileri açılmaz.
 *
 * İLERİ SARMA engellenir, GERİ SARMA serbesttir — anlamadığı yeri tekrar
 * izleyen kişiyi cezalandırmayız.
 *
 * ETKİ SABİT TUTULUR (`useRef` + boş bağımlılık): `onBitti` satır içi bir ok
 * fonksiyonu olarak geliyordu ve bağımlılıktaydı; ebeveyn her saniye süre
 * sayacıyla yeniden çizildiği için etki her saniye sökülüp kuruluyor,
 * `enUzak` sıfırlanıyordu. Sonuç iki katmanlı bir hataydı: ilerleme takibi
 * ölü koda dönüşmüştü ve geri saran kişi videonun BAŞINA atılıyordu — yani
 * yorumun vaat ettiğinin tam tersi çalışıyordu.
 */
function VideoBekci({ sayfaId, onBitti }: { sayfaId: string; onBitti: () => void }) {
  const bitti = useRef(onBitti);
  bitti.current = onBitti;

  useEffect(() => {
    // Sayfadaki İLK video değil, İÇERİK videosu: ikinci bir <video> eklendiğinde
    // sessizce yanlış öğeyi izlemeye başlardı.
    const v = document.querySelector<HTMLVideoElement>("video[data-icerik-videosu]");
    if (!v) return;

    let enUzak = 0;
    const izle = () => {
      // İlerleme YALNIZ doğal oynatmayla birikir: `currentTime`i olduğu gibi
      // almak, kaydırıcıyı sürükleyen kişinin ilerlemeyi kendi eliyle
      // yazmasına izin veriyordu.
      if (!v.seeking && v.currentTime > enUzak && v.currentTime - enUzak < 1.5) enUzak = v.currentTime;
      if (v.duration && enUzak >= v.duration - 1.5) bitti.current();
    };
    const atlamaEngeli = () => {
      // İleriye doğru HİÇBİR atlamaya tolerans yok; geriye serbest.
      if (v.currentTime > enUzak + 0.4) v.currentTime = enUzak;
    };
    const sonaGeldi = () => bitti.current();

    v.addEventListener("timeupdate", izle);
    v.addEventListener("seeking", atlamaEngeli);
    v.addEventListener("ended", sonaGeldi);

    /* OTOMATİK OYNATMA — kioskta "oynat"a basmayı beklemeyiz: eldivenli el,
       bir metre uzaklık, sıradaki insan. Sayfa açılır açılmaz başlar.

       SESSİZE ALMIYORUZ. Tarayıcılar sesli otomatik oynatmayı ancak kullanıcı
       etkileşiminden sonra veriyor; kiosk'ta o etkileşim ZATEN var (sicil
       yazıldı, "Başla"ya basıldı). Yine de engellenirse video DURUR ve kişi
       kendi başlatır — sessiz başlatmak, anlatımı hiç duymadan "izledi" sayılan
       bir kayıt üretirdi ve denetimde savunulacak tarafı olmazdı. */
    v.play().catch(() => {
      /* Tarayıcı izin vermedi. Kontroller açık, kişi kendi başlatır. */
    });

    return () => {
      v.removeEventListener("timeupdate", izle);
      v.removeEventListener("seeking", atlamaEngeli);
      v.removeEventListener("ended", sonaGeldi);
    };
  }, [sayfaId]);

  return null;
}
