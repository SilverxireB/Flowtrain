"use client";

import { useState } from "react";
import Icon from "@/components/Icon";
import { damgaMetni } from "@/lib/rapor";
import type { PanoOzeti } from "@/lib/panoPdf";

/**
 * Dışa aktarma düğmeleri.
 *
 * İKİ AYRI BELGE, İKİ AYRI İŞ:
 *  · CSV = denetim belgesi. TAM liste, Excel'de süzülür, sunucudan gelir.
 *  · PDF = okunacak özet. Toplantıya götürülür, tek sayfada durum söyler.
 * Birini diğerinin yerine koymak, ya toplantıda 400 satır ya denetimde eksik
 * belge demek.
 *
 * İkisinin de künyesi aynı dört soruyu cevaplar (kurum · belge · üretim anı ·
 * kayıt sayısı); CSV'de künyeyi sunucu yazar (`/api/disa-aktar`), PDF'te
 * burada kurulur çünkü belgeyi tarayıcı basıyor.
 */
export default function Disari({ ozet, tarih, kurum }: { ozet: PanoOzeti; tarih: string; kurum: string }) {
  const [calisiyor, setCalisiyor] = useState(false);

  async function pdf() {
    if (calisiyor) return;
    setCalisiyor(true);
    // jsPDF + gömülü yazı tipi ağır: sayfa açılışında değil, basıldığında iner.
    const { panoPdfIndir } = await import("@/lib/panoPdf");
    await panoPdfIndir(
      ozet,
      {
        kurum,
        belge: "Eğitim durumu",
        // Üretim anı DÜĞMEYE BASILDIĞINDA damgalanır: sekme sabahtan beri
        // açıksa sunucudan gelen tarih dünün tarihi olabilir.
        uretim: damgaMetni(new Date()),
        kayitSayisi: ozet.toplam,
        suzgec: "Süzgeç yok — tüm atamalar.",
      },
      tarih,
    );
    setCalisiyor(false);
  }

  return (
    <>
      <button onClick={pdf} disabled={calisiyor} className="btn-ghost text-sm">
        <Icon name="download" size={16} /> {calisiyor ? "Hazırlanıyor…" : "PDF"}
      </button>
      <a href="/api/disa-aktar" className="btn-ghost text-sm" download>
        <Icon name="download" size={16} /> CSV
      </a>
    </>
  );
}
