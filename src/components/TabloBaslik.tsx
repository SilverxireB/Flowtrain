"use client";

/**
 * SIRALANABİLİR TABLO BAŞLIĞI — üç kokpit tablosunun ortak parçası.
 *
 * Sıralama her tabloda ayrı yazılıyordu (katalogda vardı, kayıt defterinde
 * ve personelde hiç yoktu). Aynı ekranın bir tablosu sıralanıp diğeri
 * sıralanmıyorsa kullanıcı hangisinin sıralandığını denemeden bilemiyor.
 *
 * ERİŞİLEBİLİRLİK: `aria-sort` ekran okuyucuya durumu söylüyor, ok işareti
 * ise GÖZE. İkisi de gerekli — ok tek başına ekran okuyucuya hiçbir şey
 * anlatmıyor.
 */

import Icon from "@/components/Icon";
import type { SiraYonu } from "@/lib/tabloSirala";

export default function TabloBaslik({
  sutun,
  etiket,
  sira,
  bas,
  sagda = false,
  sinif = "",
}: {
  sutun: string;
  etiket: string;
  sira: { sutun: string; yon: SiraYonu };
  bas: (sutun: string) => void;
  /** Sayı sütunları sağa yaslanır — soldan hizalı rakam karşılaştırılamaz. */
  sagda?: boolean;
  sinif?: string;
}) {
  const secili = sira.sutun === sutun;
  const azalan = secili && sira.yon === "azalan";

  return (
    <th
      className={`siralanabilir ${sagda ? "text-right" : ""} ${sinif}`}
      aria-sort={secili ? (azalan ? "descending" : "ascending") : "none"}
    >
      <button
        type="button"
        onClick={() => bas(sutun)}
        className={`dokunma-44 inline-flex items-center gap-1 hover:text-ink ${secili ? "text-ink" : ""}`}
      >
        {etiket}
        {/* Ok YALNIZ seçili sütunda: her başlıkta soluk bir ok durursa
            hangisinin gerçekten sıralı olduğu okunmuyor. */}
        {secili ? <Icon name={azalan ? "down" : "up"} size={12} /> : null}
      </button>
    </th>
  );
}
