"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";

/**
 * KİOSK DAYANIKLILIĞI — hattaki tablet aylarca kapanmadan açık kalır.
 *
 * Sign'dan gelen üç önlem, artı bir tane: ağ göstergesi. Hiçbiri kullanıcıya
 * bir düğme eklemez; hepsi görünmez çalışır ve akışa dokunmaz.
 *
 *  1. EKRAN UYKUYA GİRMESİN (Wake Lock). Kiosk'un başında duran işçi ekranı
 *     uyanık tutmak için ona dokunmak zorunda kalmamalı. Kilit sekme arkaya
 *     atılınca tarayıcı tarafından BIRAKILIR; geri dönüldüğünde yeniden alınır
 *     — bir kez isteyip bırakmak, gün ortasında kararan bir ekran demekti.
 *
 *  2. DONMA BEKÇİSİ. Saniye sayacının duvar saatinden ne kadar geri kaldığına
 *     bakar. JavaScript'in KENDİSİ tam donduğunda bunu JavaScript ile görmek
 *     mümkün değildir; görülebilen şey, tarayıcı işlemi askıya alınıp geri
 *     döndüğünde sayacın kocaman bir sıçrama yapmasıdır. O sıçrama olduğunda
 *     sayfa (boştaysa) yenilenir: uzun süre asılı kalmış bir belge, uyanınca
 *     yarısı çalışan bir ekran bırakıyordu.
 *
 *  3. GECE YENİLEME. Gecenin belirli bir saatinde, ekran boştayken sayfa bir
 *     kez yenilenir. Aylarca açık kalan bir sekmede bellek ve zamanlayıcı
 *     birikir; kimsenin başında olmadığı bir anda temizlemek en ucuzu.
 *
 *  4. AĞ KOPTU ŞERİDİ. Kapalı ağ da kopar (anahtar, kablo, sunucu yeniden
 *     başlatma). İşçi "düğme çalışmıyor" diye düşünmesin diye SEBEP yazılır.
 *
 * MEŞGULKEN HİÇBİRİ YENİLEME YAPMAZ (`mesgul`): eğitim izleyen ya da PIN giren
 * kişinin ekranını yenilemek, yarım bir oturum ve kaybolmuş bir imza demektir.
 */

/** Sayacın duvar saatinden bu kadar geri kalması "askıya alınmıştık" demek. */
const SICRAMA_ESIGI_MS = 5 * 60_000;
/** Gece yenilemesi bu saatte (yerel saat) yapılır. */
const GECE_SAATI = 3;

export default function KioskBekci({ mesgul = false }: { mesgul?: boolean }) {
  const [cevrimdisi, setCevrimdisi] = useState(false);
  /* Etki içinden okunan GÜNCEL değer: `mesgul` bağımlılığa konsaydı her
     aşama değişiminde bekçi sökülüp kurulur, sayaç sıfırlanırdı. */
  const mesgulRef = useRef(mesgul);
  mesgulRef.current = mesgul;

  /* ── 1. Wake Lock ──────────────────────────────────────────────────────── */
  useEffect(() => {
    type Kilit = { release: () => Promise<void>; addEventListener: (t: string, f: () => void) => void };
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<Kilit> } };
    if (!nav.wakeLock) return;

    let kilit: Kilit | null = null;
    let sokuldu = false;

    async function al() {
      if (sokuldu || document.visibilityState !== "visible") return;
      try {
        kilit = (await nav.wakeLock!.request("screen")) ?? null;
      } catch {
        /* Pil tasarrufu ya da izin yok. Ekran uyur; ürün çalışmaya devam eder. */
      }
    }

    // Sekme geri geldiğinde kilit YENİDEN alınır — tarayıcı arkaya atılırken
    // bırakır ve bir daha kendiliğinden vermez.
    document.addEventListener("visibilitychange", al);
    al();

    return () => {
      sokuldu = true;
      document.removeEventListener("visibilitychange", al);
      kilit?.release().catch(() => {});
    };
  }, []);

  /* ── 2. Donma bekçisi + 3. Gece yenilemesi ─────────────────────────────── */
  useEffect(() => {
    let sonTik = Date.now();
    let sonGeceGunu = new Date().toDateString();

    const t = setInterval(() => {
      const simdi = Date.now();
      const sicrama = simdi - sonTik;
      sonTik = simdi;

      if (mesgulRef.current) return;

      // Donma / askıya alınma sonrası: temiz bir sayfa en güvenlisi.
      if (sicrama > SICRAMA_ESIGI_MS) {
        location.reload();
        return;
      }

      const d = new Date(simdi);
      const gun = d.toDateString();
      if (d.getHours() === GECE_SAATI && gun !== sonGeceGunu) {
        sonGeceGunu = gun;
        location.reload();
      }
    }, 30_000);

    return () => clearInterval(t);
  }, []);

  /* ── 4. Ağ göstergesi ──────────────────────────────────────────────────── */
  useEffect(() => {
    function guncelle() {
      setCevrimdisi(!navigator.onLine);
    }
    guncelle();
    window.addEventListener("online", guncelle);
    window.addEventListener("offline", guncelle);
    return () => {
      window.removeEventListener("online", guncelle);
      window.removeEventListener("offline", guncelle);
    };
  }, []);

  if (!cevrimdisi) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-3 bg-orta px-5 py-4
        text-center text-lg font-bold text-white"
    >
      <Icon name="warning" size={24} />
      <span>Ağ bağlantısı yok. Ekranı kapatmayın — bağlantı gelince kaldığınız yerden devam eder.</span>
    </div>
  );
}
