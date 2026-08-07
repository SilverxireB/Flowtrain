"use client";

import { useState } from "react";
import Icon from "@/components/Icon";
import type { PanoOzeti } from "@/lib/panoPdf";

/**
 * Dışa aktarma düğmeleri.
 *
 * İKİ AYRI BELGE, İKİ AYRI İŞ:
 *  · CSV = denetim belgesi. TAM liste, Excel'de süzülür, sunucudan gelir.
 *  · PDF = okunacak özet. Toplantıya götürülür, tek sayfada durum söyler.
 * Birini diğerinin yerine koymak, ya toplantıda 400 satır ya denetimde eksik
 * belge demek.
 */
export default function Disari({ ozet, tarih }: { ozet: PanoOzeti; tarih: string }) {
  const [calisiyor, setCalisiyor] = useState(false);

  async function pdf() {
    if (calisiyor) return;
    setCalisiyor(true);
    // jsPDF + gömülü yazı tipi ağır: sayfa açılışında değil, basıldığında iner.
    const { panoPdfIndir } = await import("@/lib/panoPdf");
    await panoPdfIndir(ozet, tarih);
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
