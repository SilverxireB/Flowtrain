"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * GEÇİŞ ÇUBUĞU — "tıkladım, bir şey oluyor" cevabı.
 *
 * Kullanıcı bildirimi (29.08.2026): "tüm tuşlar tıklanıyor ama hepsi sessiz,
 * tıklıyorsun hiçbir şey olmuyor gibi oluyor, sonra açılıyor sayfalar."
 *
 * ÖLÇÜM: rota geçişlerinin kendisi SAĞLAM — `loading.tsx` her rotada var ve
 * ısınmış dev sunucusunda geçiş 100 ms sürüyor. Eksik olan şey iskelet değil,
 * TIKLAMA ile SAYFA ARASINDAKİ ANIN kendisi. O aralık kısa olduğunda
 * `loading.tsx` görünmeye fırsat bulamıyor; uzun olduğunda (Vercel'de soğuk
 * başlangıç, ağır editör sayfası) fırsat buluyor ama ondan ÖNCEKİ birkaç yüz
 * milisaniye yine sessiz. İkisinin arasında kalan boşluk "tuş ölü" hissini
 * veren şey.
 *
 * NEDEN GLOBAL BİR DİNLEYİCİ: Next 14'te `useLinkStatus` yok (15 ile geldi) ve
 * `useTransition` yalnız kendi başlattığı geçişi görür — `<Link>` tıklamalarını
 * görmez. Belgeye yakalama fazında (`capture`) tek dinleyici koymak, ürünün
 * HER bağlantısını tek yerden kapsıyor: hub kutucukları, tablo satırları, kart
 * haritası, başlıktaki geri oku. Sayfa sayfa gezip düğme düğme durum eklemek
 * hem yüz yerde tekrar hem de yeni eklenen her bağlantıda unutulacak bir iş.
 *
 * KAPANIŞ YOLA BAĞLI: `usePathname`/`useSearchParams` değiştiğinde yeni sayfa
 * gelmiş demektir. Zamanlayıcıyla kapatmak yanlış olurdu — yavaş sayfada çubuk
 * içerikten önce kaybolur ve yine sessizliğe düşerdi.
 *
 * ⚠ GÜVENLİK ZAMANLAYICISI ŞART: yol hiç değişmeyebilir (aynı sayfaya
 * tıklamak, sunucu hatası, iptal edilen geçiş). O durumda çubuk sonsuza kadar
 * akmaya devam eder ve "sistem donmuş" izlenimi verirdi — sessizlikten beter.
 */
export default function GecisCubugu() {
  const yol = usePathname();
  const sorgu = useSearchParams();
  const [aktif, setAktif] = useState(false);

  /* Yeni sayfa geldi. */
  useEffect(() => setAktif(false), [yol, sorgu]);

  useEffect(() => {
    const tikla = (e: MouseEvent) => {
      /* Tarayıcının kendi işine karışma: yeni sekme, indirme, sağ tık,
         değiştirici tuşlar. Bunların hiçbirinde SAYFA DEĞİŞMEZ, yani çubuk
         yanlış yere akardı. */
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const bag = (e.target as HTMLElement | null)?.closest?.("a");
      if (!bag) return;
      const href = bag.getAttribute("href");
      if (!href || href.startsWith("#") || bag.target === "_blank" || bag.hasAttribute("download")) return;

      let hedef: URL;
      try {
        hedef = new URL(bag.href, location.href);
      } catch {
        return;
      }
      if (hedef.origin !== location.origin) return;
      /* AYNI SAYFAYA TIKLAMAK geçiş değildir. */
      if (hedef.pathname === location.pathname && hedef.search === location.search) return;
      setAktif(true);
    };
    document.addEventListener("click", tikla, true);
    return () => document.removeEventListener("click", tikla, true);
  }, []);

  useEffect(() => {
    if (!aktif) return;
    const s = setTimeout(() => setAktif(false), 12000);
    return () => clearTimeout(s);
  }, [aktif]);

  if (!aktif) return null;

  return (
    <div aria-hidden className="fixed inset-x-0 top-0 z-[100] h-[3px] overflow-hidden bg-accent-soft">
      <span className="gecis-cubugu-ic block h-full w-1/3 rounded-full bg-accent" />
    </div>
  );
}
