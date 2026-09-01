"use client";

/**
 * FLOW SEÇİCİ — native `<select>`in yerine geçen kendi menümüz.
 *
 * NEDEN VAR: açılır listeyi native `<select>`te işletim sistemi çiziyor ve
 * CSS oraya işlemiyor. Chrome/Windows'ta iki uç da denendi ve ikisi de
 * bozuk çıktı — seçiciye zemin vermek listeyi "stilli" kipe sokup AÇIK
 * renk açıyor, zemini kaldırınca kutu tarayıcının grisine (#3b3b3b)
 * düşüyor. Kullanıcı bunu üç kez ekran görüntüsüyle bildirdi.
 *
 * FlowUI aynı sebeple react-select'e geçmiş ("`<select>` KULLANILMAZ").
 * Burada yeni npm paketi yasak (CLAUDE.md 8), o yüzden menüyü kendimiz
 * çiziyoruz. Ölçüler FlowUI'ın çalışan hâlinden alındı.
 *
 * NATIVE API'YLE KONUŞUR: `value` / `onChange` / `name` / `disabled` aynı,
 * seçenekler `<option>` ÇOCUKLARI olarak veriliyor. Böylece çağıran sayfa
 * `<select>` → `<FlowSecici>` yazmaktan başka bir şey değiştirmiyor ve
 * form mantığı olduğu gibi kalıyor. `onChange` her durumda DEĞERİ verir.
 *
 * ERİŞİLEBİLİRLİK: `combobox` + `listbox` deseni, `aria-activedescendant`
 * ile klavye konumu, ok tuşları / Home / End / Escape / harfle atlama.
 * Gizli bir `<input>` değeri taşır ki `<form>` gönderiminde alan kaybolmasın.
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import Icon from "@/components/Icon";

interface Secenek {
  deger: string;
  etiket: string;
  kapali: boolean;
}

/**
 * Seçenek etiketini METNE çevirir.
 *
 * `String(children)` YETMEZ: JSX'te `<option>{p.ad} ({p.sayi} eğitim)</option>`
 * yazıldığında `children` bir DİZİDİR ve `String([...])` virgüllü çöp üretir
 * ("Oryantasyon,( ,1, eğitim,)"). Etiket hem ekranda hem ekran okuyucuda
 * yanlış çıkıyordu; uçtan uca sınav bunu tıklanamayan seçenek olarak yakaladı.
 */
function metneCevir(dugum: unknown): string {
  if (dugum === null || dugum === undefined || typeof dugum === "boolean") return "";
  if (Array.isArray(dugum)) return dugum.map(metneCevir).join("");
  if (typeof dugum === "object" && "props" in (dugum as object)) {
    return metneCevir((dugum as { props?: { children?: unknown } }).props?.children);
  }
  return String(dugum);
}

/** `<option>` çocuklarını okunur listeye çevirir. */
function seceneklereCevir(children: ReactNode): Secenek[] {
  const cikti: Secenek[] = [];
  const gez = (dugum: ReactNode): void => {
    if (dugum === null || dugum === undefined || typeof dugum === "boolean") return;
    if (Array.isArray(dugum)) return dugum.forEach(gez);
    if (typeof dugum !== "object" || !("props" in dugum)) return;
    const el = dugum as { type?: unknown; props?: Record<string, unknown> };
    /* `<>…</>` ve dizi sarmalayıcıların içine iniyoruz: sayfalar seçenekleri
       çoğu zaman `.map()` ile üretiyor ve arada parça (Fragment) kalıyor. */
    if (el.type !== "option") return gez((el.props?.children ?? null) as ReactNode);
    const etiket = metneCevir(el.props?.children);
    cikti.push({
      deger: String(el.props?.value ?? etiket),
      etiket,
      kapali: !!el.props?.disabled,
    });
  };
  gez(children);
  return cikti;
}

export default function FlowSecici({
  value: disDeger,
  onChange,
  name,
  defaultValue = "",
  required = false,
  disabled = false,
  children,
  sinif = "",
  "aria-label": ariaLabel,
}: {
  /** KONTROLLÜ kip. Verilmezse bileşen değeri kendi tutar. */
  value?: string;
  /** Native ile aynı sözleşme: olay yerine DOĞRUDAN değer gelir. */
  onChange?: (deger: string) => void;
  name?: string;
  /** KONTROLSÜZ kip: `<form>` içinde sunucu eylemine giden alanlar böyle. */
  defaultValue?: string;
  required?: boolean;
  disabled?: boolean;
  children: ReactNode;
  sinif?: string;
  "aria-label"?: string;
}) {
  const secenekler = useMemo(() => seceneklereCevir(children), [children]);
  /* İKİ KİP, TEK BİLEŞEN. Native `<select>` de böyle çalışıyor: `value`
     verilirse kontrollü, `defaultValue` verilirse kendi tutuyor. İkinci
     kip olmadan `<form action={...}>` içindeki alanlar için ayrı bir
     sarmalayıcı yazmak gerekirdi ve ikisi zamanla ayrışırdı. */
  const [icDeger, setIcDeger] = useState(defaultValue);
  const kontrollu = disDeger !== undefined;
  const value = kontrollu ? disDeger : icDeger;

  const [acik, setAcik] = useState(false);
  const [odak, setOdak] = useState(0);
  const kap = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLUListElement>(null);
  const kimlik = useId();

  const secili = secenekler.find((s) => s.deger === value);
  const seciliIndeks = Math.max(0, secenekler.findIndex((s) => s.deger === value));

  const kapat = useCallback(() => setAcik(false), []);

  /* DIŞARI TIKLAMA VE ESC. Dinleyici yalnız menü açıkken bağlanıyor: yirmi
     seçicinin yirmisi birden belge dinleseydi her tıklama yirmi kez
     hesaplanırdı. */
  useEffect(() => {
    if (!acik) return;
    const disari = (e: MouseEvent) => {
      if (!kap.current?.contains(e.target as Node)) kapat();
    };
    /* `mousedown` — `click` DEĞİL: menüdeki bir seçeneğe basılıp fare
       dışarıda bırakılırsa `click` hiç doğmuyor ve menü açık kalıyordu. */
    document.addEventListener("mousedown", disari);
    return () => document.removeEventListener("mousedown", disari);
  }, [acik, kapat]);

  /* Menü açılınca odak SEÇİLİ satıra gider — listeyi baştan taramak yerine
     kullanıcı nerede kaldığını görür. */
  useEffect(() => {
    if (acik) setOdak(seciliIndeks);
  }, [acik, seciliIndeks]);

  /* Odaktaki satır görünür kalsın (uzun listede klavyeyle gezinme). */
  useEffect(() => {
    if (!acik) return;
    menu.current?.querySelector<HTMLElement>('[data-odak="evet"]')?.scrollIntoView({ block: "nearest" });
  }, [acik, odak]);

  function sec(i: number) {
    const s = secenekler[i];
    if (!s || s.kapali) return;
    if (!kontrollu) setIcDeger(s.deger);
    onChange?.(s.deger);
    kapat();
    /* Odak DÜĞMEYE geri veriliyor: klavye kullanıcısı seçtikten sonra
       sayfanın başına fırlamasın. */
    kap.current?.querySelector<HTMLButtonElement>(".flow-secici-dugme")?.focus();
  }

  /** Harfe basınca o harfle başlayan sonraki seçeneğe atlar. */
  function harfleAtla(harf: string) {
    const k = harf.toLocaleLowerCase("tr");
    const bas = odak + 1;
    for (let n = 0; n < secenekler.length; n++) {
      const i = (bas + n) % secenekler.length;
      if (secenekler[i].etiket.toLocaleLowerCase("tr").startsWith(k)) return setOdak(i);
    }
  }

  function tusla(e: React.KeyboardEvent) {
    if (disabled) return;
    if (!acik) {
      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(e.key)) {
        e.preventDefault();
        setAcik(true);
      }
      return;
    }
    switch (e.key) {
      case "Escape":
        e.preventDefault();
        kapat();
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        sec(odak);
        break;
      case "ArrowDown":
        e.preventDefault();
        setOdak((i) => Math.min(secenekler.length - 1, i + 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setOdak((i) => Math.max(0, i - 1));
        break;
      case "Home":
        e.preventDefault();
        setOdak(0);
        break;
      case "End":
        e.preventDefault();
        setOdak(secenekler.length - 1);
        break;
      case "Tab":
        kapat();
        break;
      default:
        if (e.key.length === 1) harfleAtla(e.key);
    }
  }

  return (
    <div ref={kap} className={`flow-secici-kap ${sinif}`} data-acik={acik ? "evet" : "hayir"}>
      {/* Gizli alan: `<form>` gönderiminde değer kaybolmasın. Native
          `<select name>` bunu kendiliğinden yapıyordu. */}
      {name ? <input type="hidden" name={name} value={value} required={required} /> : null}

      <button
        type="button"
        disabled={disabled}
        onClick={() => setAcik((a) => !a)}
        onKeyDown={tusla}
        className="flow-secici-dugme"
        data-bos={value === "" ? "evet" : "hayir"}
        role="combobox"
        aria-expanded={acik}
        aria-haspopup="listbox"
        aria-controls={`${kimlik}-liste`}
        aria-activedescendant={acik ? `${kimlik}-s${odak}` : undefined}
        aria-label={ariaLabel}
      >
        <span className="truncate">{secili?.etiket ?? ""}</span>
        <Icon name="down" size={14} className="flow-secici-ok" />
      </button>

      {acik ? (
        <ul ref={menu} id={`${kimlik}-liste`} role="listbox" className="flow-secici-menu" aria-label={ariaLabel}>
          {secenekler.map((s, i) => (
            <li key={s.deger || `bos-${i}`}>
              <button
                type="button"
                id={`${kimlik}-s${i}`}
                role="option"
                aria-selected={s.deger === value}
                aria-disabled={s.kapali || undefined}
                data-odak={i === odak ? "evet" : "hayir"}
                onMouseEnter={() => setOdak(i)}
                onClick={() => sec(i)}
                className="flow-secici-secenek"
                title={s.etiket}
              >
                {s.etiket}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
