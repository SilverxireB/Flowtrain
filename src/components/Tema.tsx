"use client";

/**
 * TEMA — seçilebilir liste, `:root[data-tema]` üzerinden.
 *
 * Renkler bu dosyada YOK. Tek yaptığı `<html>` üzerindeki `data-tema`
 * özniteliğini çevirmek; hangi rengin ne olacağını `flow-tokens.css`
 * biliyor. Bileşenlerin tema bloğu yazmaması kuralının tuttuğu yer burası.
 *
 * TEK DÜĞME DEĞİL, SEÇİM LİSTESİ (kullanıcı isteği ve FlowUI dili):
 * FlowUI'da tema sağ üstteki dişliden SEÇİLİYOR ve seçim kalıcı. Tek
 * düğmeli aç-kapa iki tema için yeterliydi ama üçüncü tema geldiğinde
 * ("sistemi izle" da bir seçenek) hangi durumda olduğunu söylemiyordu —
 * simge "gidilecek yeri" gösteriyor, "bulunulan yeri" değil.
 *
 * SİSTEMİ İZLE AYRI BİR SEÇİMDİR, yokluk değil. Kayıtlı seçim yoksa
 * işletim sistemine uyuluyordu ama kullanıcı bunu SEÇEMİYORDU: koyuya
 * geçtikten sonra "otomatiğe dön" diye bir yol kalmıyordu.
 *
 * SEÇİM CİHAZDA KALIR, kullanıcıda değil (`localStorage`). Kapalı ağda bir
 * kokpit bilgisayarını birden çok kişi kullanıyor ve tema kişinin değil
 * EKRANIN özelliği: gündüz vitrin ekranı açık, gece vardiya odası koyu.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Icon, { type IconName } from "@/components/Icon";

export type TemaAdi = "acik" | "koyu" | "siyah";
/** Kullanıcının SEÇTİĞİ şey — "sistem" de geçerli bir seçim. */
type Secim = TemaAdi | "sistem";

const ANAHTAR = "flowtrain-tema";

const SECENEKLER: { deger: Secim; etiket: string; ikon: IconName }[] = [
  { deger: "acik", etiket: "Açık", ikon: "sun" },
  { deger: "koyu", etiket: "Koyu", ikon: "moon" },
  /* SİYAH AYRI BİR TEMADIR, koyunun daha koyusu değil: tek renkli gri
     rampa ve vurgusu logonun turuncusu. Sistem "koyu" derse `koyu`ya
     düşer — siyah yalnız AÇIKÇA seçilir (FlowUI'da da öyle). */
  { deger: "siyah", etiket: "Siyah", ikon: "palette" },
  { deger: "sistem", etiket: "Sistemi izle", ikon: "monitor" },
];

/**
 * BOYA ÖNCESİ ÇALIŞAN BETİK.
 *
 * React yüklenmeden, ilk boyadan da önce çalışır. Olmasaydı sayfa bir kare
 * açık temada çizilip koyuya atlardı — karanlık bir vardiya odasında bu
 * "beyaz flaş" gerçekten rahatsız edici (ve her sayfa geçişinde tekrarlardı).
 *
 * Kayıtlı seçim "sistem" ya da yoksa İŞLETİM SİSTEMİNE uyar.
 *
 * `try/catch` şart: gizli sekmede ve bazı kurum politikalarında
 * `localStorage` okumak fırlatıyor. Tema okunamadıysa sayfa açık temada
 * açılır — bir tercih kaybı, kırık bir sayfa değil.
 */
export function TemaBetigi() {
  const betik = `(function(){try{var s=localStorage.getItem(${JSON.stringify(ANAHTAR)});var t=(s==="acik"||s==="koyu"||s==="siyah")?s:(window.matchMedia("(prefers-color-scheme: dark)").matches?"koyu":"acik");document.documentElement.setAttribute("data-tema",t);}catch(e){document.documentElement.setAttribute("data-tema","acik");}})();`;
  return <script dangerouslySetInnerHTML={{ __html: betik }} />;
}

/** Kayıtlı SEÇİM (tema değil). */
function kayitliSecim(): Secim {
  if (typeof localStorage === "undefined") return "sistem";
  try {
    const s = localStorage.getItem(ANAHTAR);
    return s === "acik" || s === "koyu" || s === "siyah" ? s : "sistem";
  } catch {
    return "sistem";
  }
}

/** Seçimin karşılığı olan gerçek tema. */
function secimdenTema(s: Secim): TemaAdi {
  if (s !== "sistem") return s;
  if (typeof window === "undefined") return "acik";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "koyu" : "acik";
}

export function useTema() {
  /* Sunucu çiziminde seçim BİLİNMEZ (istemcinin `localStorage`ı orada yok).
     "sistem" ile başlanır ve ilk çizimden sonra düzeltilir; aradaki farkı
     kullanıcı görmez çünkü asıl temayı `TemaBetigi` zaten yazdı. */
  const [secim, setSecimDurum] = useState<Secim>("sistem");

  useEffect(() => setSecimDurum(kayitliSecim()), []);

  /* SİSTEM SEÇİLİYSE işletim sistemi değişince tema da değişmeli — kullanıcı
     "izle" dedi, bir kereye mahsus kopyala demedi.

     ⚠ SEÇİM DURUMDAN DEĞİL, DOĞRUDAN KAYITTAN OKUNUYOR. Bu satır bir hatanın
     mezar taşı: `secim` başlangıçta "sistem" ile doğuyor ve gerçek değeri
     ancak yukarıdaki effect'te öğreniliyor. İkisi de montajdan sonra sırayla
     koşuyor, yani bu effect İLK TURDA `secim`i hâlâ "sistem" görüyor ve
     sistem temasını UYGULUYORDU — kullanıcının seçtiği koyu tema eziliyordu.
     Sonraki turda `secim` "koyu" olunca effect yalnız TEMİZLENİYOR, temayı
     geri yazan kimse kalmıyordu.

     Belirtisi tam olarak şuydu: koyu seçiliyken sayfadan çıkıp GERİ gelince
     ekran beyaza dönüyordu (her montaj bir kez daha eziyor). Kayıttan okumak
     durumun geç dolmasına bağımlılığı tümden kaldırıyor. */
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (kayitliSecim() !== "sistem") return;
    const sorgu = window.matchMedia("(prefers-color-scheme: dark)");
    const uygula = () => document.documentElement.setAttribute("data-tema", secimdenTema("sistem"));
    uygula();
    sorgu.addEventListener("change", uygula);
    return () => sorgu.removeEventListener("change", uygula);
  }, [secim]);

  const setSecim = useCallback((yeni: Secim) => {
    document.documentElement.setAttribute("data-tema", secimdenTema(yeni));
    setSecimDurum(yeni);
    try {
      /* "sistem" KAYIT SİLER: yokluk zaten "sistemi izle" demek ve iki ayrı
         gösterim tutmak ikisinin ayrışmasına açık kapı bırakırdı. */
      if (yeni === "sistem") localStorage.removeItem(ANAHTAR);
      else localStorage.setItem(ANAHTAR, yeni);
    } catch {
      /* Yazılamadıysa tema BU oturumda yine çalışır, sonraki açılışta
         hatırlanmaz. Sessizce geçmek doğru: kullanıcıya "tercihiniz
         kaydedilemedi" demek, yapabileceği bir şey olmadığı için gürültü. */
    }
  }, []);

  return { secim, setSecim, tema: secimdenTema(secim) };
}

/**
 * Tema seçici — başlık şeridinde durur.
 *
 * Menü `FlowSecici` DEĞİL: orası bir form alanı, burası bir araç menüsü ve
 * seçenekler simge taşıyor. İkisini tek bileşene sıkıştırmak, form
 * sözleşmesini (value/onChange/name) araç menüsüne taşımak olurdu.
 */
export default function TemaAnahtari({ sinif = "" }: { sinif?: string }) {
  const { secim, setSecim } = useTema();
  const [acik, setAcik] = useState(false);
  const kap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!acik) return;
    const disari = (e: MouseEvent) => {
      if (!kap.current?.contains(e.target as Node)) setAcik(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAcik(false);
    document.addEventListener("mousedown", disari);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", disari);
      document.removeEventListener("keydown", esc);
    };
  }, [acik]);

  const suAnki = SECENEKLER.find((s) => s.deger === secim) ?? SECENEKLER[2];

  return (
    <div ref={kap} className={`relative ${sinif}`}>
      <button
        type="button"
        onClick={() => setAcik((a) => !a)}
        className="btn-icon"
        aria-haspopup="menu"
        aria-expanded={acik}
        /* Etiket BULUNULAN yeri söylüyor: "koyu temaya geç" yazan tek düğme,
           hangi temada olduğunu hiç söylemiyordu. */
        aria-label={`Tema: ${suAnki.etiket}. Değiştir`}
        title={`Tema: ${suAnki.etiket}`}
      >
        <Icon name={suAnki.ikon} size={16} />
      </button>

      {acik ? (
        <ul role="menu" className="flow-tema-menu" aria-label="Tema">
          {SECENEKLER.map((s) => (
            <li key={s.deger}>
              <button
                type="button"
                role="menuitemradio"
                aria-checked={secim === s.deger}
                onClick={() => {
                  setSecim(s.deger);
                  setAcik(false);
                }}
                className="flow-tema-secenek"
              >
                <Icon name={s.ikon} size={14} />
                <span className="flex-1 text-left">{s.etiket}</span>
                {secim === s.deger ? <Icon name="check" size={13} /> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
