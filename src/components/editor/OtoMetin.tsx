"use client";

import { useEffect, useRef } from "react";

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
 */
export default function OtoMetin(ozellikler: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className = "", ...kalan } = ozellikler;
  const alan = useRef<HTMLTextAreaElement>(null);

  // İlk çizimde ve metin dışarıdan değiştiğinde (kaydetme sonrası tazeleme,
  // şablondan kart eklenmesi) yeniden ölç.
  useEffect(() => boyutla(alan.current), [ozellikler.defaultValue]);

  return (
    <textarea
      {...kalan}
      ref={alan}
      onInput={(e) => boyutla(e.currentTarget)}
      className={`${className} resize-none overflow-hidden`}
    />
  );
}

/**
 * MODÜL SEVİYESİNDE, kapanış DEĞİL — `csv.ts`teki küçültücü tuzağının aynısı
 * (parametre yakalayıp birden çok kez çağrılan yardımcı) burada da mümkündü.
 *
 * Önce `auto`: yükseklik sıfırlanmadan `scrollHeight` okunursa kutu yalnız
 * büyür, metin silindiğinde bir daha küçülmez.
 */
function boyutla(alan: HTMLTextAreaElement | null): void {
  if (!alan) return;
  alan.style.height = "auto";
  alan.style.height = `${alan.scrollHeight}px`;
}
