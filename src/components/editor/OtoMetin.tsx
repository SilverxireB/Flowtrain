"use client";

import { forwardRef, useEffect, useRef } from "react";

/**
 * İÇERİĞE GÖRE BÜYÜYEN METİN ALANI.
 *
 * Sabit `rows` ile altı adımlı bir "Adım adım" kartı dört satıra sıkışıp
 * kaydırma çubuğuna düşüyordu: hazırlayan yazdığı adımların tamamını AYNI ANDA
 * göremiyor, dolayısıyla sıra hatasını, tekrarı ya da eksik adımı fark
 * edemiyordu. Editörün tek işi metni göstermek; onu kutuya sığdırmak değil.
 *
 * `rows` EN AZ yükseklik olarak kalır — betik çalışmadan önce ve boş kartta
 * kutu yine makul boyda görünür, sayfa açılışta zıplamaz.
 *
 * Elle boyutlandırma (`resize-y`) kaldırıldı: kutu zaten içeriğe oturuyor,
 * ikisi birlikte olunca kullanıcının verdiği yükseklik ilk tuşta eziliyordu.
 *
 * REF DIŞARI VERİLİR (`forwardRef`): biçim şeridi seçimi (`selectionStart/End`)
 * okuyup metni kendisi yazıyor. Kendi iç ref'imiz de duruyor — dışarıdan ref
 * verilmediğinde otomatik boyutlandırma çalışmaya devam etmeli.
 */
const OtoMetin = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function OtoMetin({ className = "", ...kalan }, disRef) {
    const alan = useRef<HTMLTextAreaElement | null>(null);

    // İlk çizimde ve metin dışarıdan değiştiğinde (kaydetme sonrası tazeleme,
    // şablondan kart eklenmesi) yeniden ölç.
    useEffect(() => boyutla(alan.current), [kalan.defaultValue]);

    return (
      <textarea
        {...kalan}
        ref={(e) => {
          alan.current = e;
          if (typeof disRef === "function") disRef(e);
          else if (disRef) disRef.current = e;
        }}
        onInput={(e) => boyutla(e.currentTarget)}
        className={`${className} resize-none overflow-hidden`}
      />
    );
  },
);

export default OtoMetin;

/**
 * MODÜL SEVİYESİNDE, kapanış DEĞİL — `csv.ts`teki küçültücü tuzağının aynısı
 * (parametre yakalayıp birden çok kez çağrılan yardımcı) burada da mümkündü.
 *
 * Önce `auto`: yükseklik sıfırlanmadan `scrollHeight` okunursa kutu yalnız
 * büyür, metin silindiğinde bir daha küçülmez.
 *
 * DIŞARI AÇIK: biçim şeridi metni React'in dışında (doğrudan `value` ile)
 * yazıyor, dolayısıyla `onInput` tetiklenmiyor ve kutuyu kendisi ölçmeli.
 */
export function boyutla(alan: HTMLTextAreaElement | null): void {
  if (!alan) return;
  alan.style.height = "auto";
  alan.style.height = `${alan.scrollHeight}px`;
}
