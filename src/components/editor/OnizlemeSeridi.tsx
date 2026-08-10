"use client";

import { useEffect, useState } from "react";
import Icon from "@/components/Icon";
import CanliOnizleme from "./CanliOnizleme";
import type { Sayfa } from "@/lib/tipler";

/**
 * ÖNİZLEME ŞERİDİ — dar ekranda seçili kartın önizlemesi ekranın altında durur.
 *
 * NEDEN SEKME DEĞİL: önizleme eskiden "Düzenle / Önizleme" sekmesinin arkasına
 * saklıydı. Yazan kişi aşağı iniyor, kartı değiştiriyor, görmek için yukarı
 * çıkıp sekmeyi değiştiriyor, dönünce YERİNİ KAYBEDİYORDU. Sekme iki yüzeyi
 * birbirinin alternatifi yapıyor; oysa yazmak ve görmek AYNI ANIN iki yarısı.
 *
 * Şerit seçiliyi izler: hangi kartı düzenliyorsan altta o çizilir, yazdıkça
 * dolar. Kapalıyken yalnız kartın adını taşıyan ince bir çubuktur — açmak
 * isteyen açar (kullanıcı kararı: "gizlice yukarıda olabilir").
 *
 * GENİŞ EKRANDA HİÇ ÇİZİLMEZ (`xl:hidden`): orada önizleme zaten yan sütunda
 * yapışkan duruyor, iki önizleme aynı anda hem gereksiz hem kafa karıştırıcı.
 */
const HATIRA = "flowtrain.onizlemeSeridi";

export default function OnizlemeSeridi({
  sayfa,
  sira,
  toplam,
  altMetinler,
  acik,
  onAcikDegisti,
}: {
  sayfa: Sayfa | null;
  sira: number;
  toplam: number;
  altMetinler: Record<string, string>;
  acik: boolean;
  onAcikDegisti: (acik: boolean) => void;
}) {
  /* Tercih oturumlar arası hatırlanır: her kart değiştirdiğinde yeniden
     açmak zorunda kalmak, sekmeye dönmekten farksız olurdu. */
  const [okundu, setOkundu] = useState(false);
  useEffect(() => {
    if (okundu) return;
    setOkundu(true);
    try {
      if (localStorage.getItem(HATIRA) === "1") onAcikDegisti(true);
    } catch {
      /* depolama kapalı olabilir — varsayılan kapalı kalır */
    }
  }, [okundu, onAcikDegisti]);

  const degistir = (yeni: boolean) => {
    onAcikDegisti(yeni);
    try {
      localStorage.setItem(HATIRA, yeni ? "1" : "0");
    } catch {
      /* önemli değil */
    }
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 backdrop-blur xl:hidden">
      <button
        type="button"
        onClick={() => degistir(!acik)}
        aria-expanded={acik}
        aria-label={acik ? "Önizlemeyi kapat" : "Önizlemeyi aç"}
        className="sayfa-kap flex min-h-[44px] w-full items-center gap-2 py-2 text-left"
      >
        <Icon name="monitor" size={16} />
        <span className="shrink-0 text-sm font-semibold">Önizleme</span>
        {sayfa ? (
          <span className="min-w-0 flex-1 truncate text-xs text-muted">
            {sira}/{toplam} · {sayfa.baslik?.trim() || "başlıksız kart"}
          </span>
        ) : (
          <span className="min-w-0 flex-1 truncate text-xs text-muted">kart seçilmedi</span>
        )}
        <Icon name={acik ? "down" : "up"} size={18} />
      </button>

      {acik ? (
        <div className="sayfa-kap max-h-[46vh] overflow-y-auto pb-3">
          <CanliOnizleme sayfa={sayfa} sira={sira} toplam={toplam} altMetinler={altMetinler} />
        </div>
      ) : null}
    </div>
  );
}
