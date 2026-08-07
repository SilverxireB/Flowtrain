"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Icon from "@/components/Icon";
import Kart from "./Kart";
import { puanla, sinaviKur, soruDogruMu, tohumla } from "@/lib/sinav";
import { beklenenSure } from "@/lib/anomali";
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

export default function EgitimOyun({
  egitim,
  sayfalar,
  sorular,
  oturumId,
  prova = false,
  kisiAdi,
  pinKurulacak = false,
  iseGirisSorulacak = false,
  sinavHazir = false,
  onBitir,
  onCik,
}: {
  egitim: Egitim;
  sayfalar: Sayfa[];
  sorular: SoruGorunum[];
  oturumId: string;
  prova?: boolean;
  kisiAdi?: string;
  /** İlk kez giren kişi PIN'ini burada belirler. */
  pinKurulacak?: boolean;
  /** İlk PIN'de işe giriş tarihi de sorulur (kimliği kaba biçimde doğrular). */
  iseGirisSorulacak?: boolean;
  /** `sorular` zaten sunucuda seçilip karıştırıldıysa istemci yeniden kurmaz. */
  sinavHazir?: boolean;
  onBitir?: (sonuc: OyunSonucu) => Promise<{ hata?: string; puan?: number; gecti?: boolean } | void>;
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

  function secenegeBas(i: number) {
    if (!soru) return;
    setCevaplar((c) => {
      const mevcut = c[soru.id] ?? [];
      if (!cokluSecim) return { ...c, [soru.id]: [i] };
      return { ...c, [soru.id]: mevcut.includes(i) ? mevcut.filter((x) => x !== i) : [...mevcut, i] };
    });
  }

  function soruIleri() {
    if (secili.length === 0) return;
    if (soruIndeks < sinavSorulari.length - 1) setSoruIndeks((i) => i + 1);
    else if (prova) {
      // Provada cevap anahtarı elimizde (hazırlayan zaten yetkili) — puanı
      // burada hesaplamak sunucuya hiç dokunmadan sonucu göstermeyi sağlar.
      const p = puanla(sinavSorulari as Soru[], cevaplar);
      setSonuc({ puan: p.puan, gecti: p.puan >= egitim.gecmeNotu });
      setAsama("sonuc");
    } else setAsama("imza");
  }

  async function imzala() {
    // ÇİFT TIKLAMA KİLİDİ `useRef` ile: state kilidi yarışı kaybediyor —
    // iki hızlı dokunuş aynı çizimi okuyup ikisi de geçiyordu.
    if (kilit.current) return;
    setHata(null);

    if (!/^\d{4}$/.test(pin)) return setHata("PIN 4 rakam olmalı.");
    if (pinKurulacak && pin !== pin2) return setHata("İki PIN aynı değil.");
    if (iseGirisSorulacak && !iseGiris.trim()) return setHata("İşe giriş tarihinizi girin.");

    kilit.current = true;
    // Puan BURADA hesaplanmaz: gerçek oturumda cevap anahtarı istemcide yok
    // ve sonuç kurumun eğitim kaydına yazılıyor — sunucu karar verir.
    const cevap = await onBitir?.({
      sayfaSureleri: sureler,
      cevaplar,
      pin,
      iseGiris: iseGirisSorulacak ? iseGiris : undefined,
    });
    kilit.current = false;

    if (!cevap || cevap.hata) return setHata(cevap?.hata ?? "Kayıt tamamlanamadı, tekrar deneyin.");
    setSonuc({ puan: cevap.puan ?? 0, gecti: !!cevap.gecti });
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
          <button onClick={onCik} className="btn-icon" aria-label="Çık">
            <Icon name="close" size={20} />
          </button>
        ) : null}
      </div>

      {asama === "icerik" && sayfa ? (
        <>
          <Ilerleme simdi={indeks + 1} toplam={sayfalar.length} etiket="Sayfa" />
          <div className="flex-1 py-6">
            <Kart sayfa={sayfa} key={sayfa.id} />
            {sayfa.tip === "video" && sayfa.videoId ? (
              <VideoBekci sayfaId={sayfa.id} onBitti={() => setVideoBitti(true)} />
            ) : null}
          </div>
          <div className="sticky bottom-0 -mx-5 border-t border-line bg-white/90 px-5 py-4 backdrop-blur">
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
                  {sonSayfa ? "Sınava geç" : "İleri"} <Icon name="chevronRight" size={22} />
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
            <h2 className="text-2xl font-extrabold leading-tight sm:text-3xl">{soru.metin}</h2>
            {cokluSecim ? (
              <p className="mt-2 text-sm font-semibold text-muted">Birden fazla şık işaretleyebilirsiniz.</p>
            ) : null}
            <div className="mt-6 space-y-3">
              {soru.secenekler.map((s, i) => (
                <button
                  key={i}
                  onClick={() => secenegeBas(i)}
                  className={`kiosk-secenek ${secili.includes(i) ? "kiosk-secenek-secili" : ""}`}
                  aria-pressed={secili.includes(i)}
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
          </div>
          <div className="sticky bottom-0 -mx-5 border-t border-line bg-white/90 px-5 py-4 backdrop-blur">
            <button onClick={soruIleri} disabled={secili.length === 0} className="kiosk-btn-primary">
              {soruIndeks < sinavSorulari.length - 1 ? "Sonraki soru" : prova ? "Sonucu gör" : "Bitir"}
              <Icon name="chevronRight" size={22} />
            </button>
          </div>
        </>
      ) : null}

      {asama === "imza" ? (
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
        <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
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
              "Eğitimi izlediniz ve imzaladınız."
            ) : (
              <>
                Puanınız <strong className="text-ink">{sonuc.puan}</strong> · geçme notu {egitim.gecmeNotu}
              </>
            )}
          </p>
          {!sonuc.gecti ? (
            <p className="mt-4 max-w-sm text-muted">
              Eğitimi tekrar izleyip yeniden deneyebilirsiniz. Deneme hakkınız: {egitim.denemeHakki}
            </p>
          ) : null}
          {onCik ? (
            <button onClick={onCik} className="kiosk-btn-primary mt-10 max-w-xs">
              Bitir
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Ilerleme({ simdi, toplam, etiket }: { simdi: number; toplam: number; etiket: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm font-semibold text-muted">
        <span>
          {etiket} {simdi}/{toplam}
        </span>
        <span>{Math.round((simdi / toplam) * 100)}%</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${(simdi / toplam) * 100}%` }} />
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
    return () => {
      v.removeEventListener("timeupdate", izle);
      v.removeEventListener("seeking", atlamaEngeli);
      v.removeEventListener("ended", sonaGeldi);
    };
  }, [sayfaId]);

  return null;
}
