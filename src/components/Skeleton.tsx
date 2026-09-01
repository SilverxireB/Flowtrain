"use client";

/**
 * İskelet (yükleniyor) yüzeyi. Eskiden kokpit ortada tek bir "Yükleniyor…"
 * yazısıyla bekletiyordu: sayfa bir anda boştan doluya sıçradığı için hem
 * beklerken ne geleceği belirsizdi hem de içerik gelince düzen zıplıyordu.
 * İskelet, gelecek düzenin ölçüsünü baştan ayırır.
 *
 * `prefers-reduced-motion` açıkken parıltı animasyonu global CSS kuralıyla
 * zaten duruyor (globals.css).
 *
 * BURADA TEK BİLEŞEN VAR, bilerek. Dosya başka bir üründen kopyalanmıştı ve
 * üç kullanılmayan bileşen daha taşıyordu (`SkelBoxDark`, `SkelCards`,
 * `SkelCockpit`) — üstelik yorumları FlowTrain'de var olmayan yüzeylerden
 * söz ediyordu: "Sign/Wall perde kokpiti", "hub sunum/duvar listeleri".
 * `CLAUDE.md` 6 "kopyalanır, bağlanmaz" diyor; kopyalanan şeyin başka bir
 * ürünün sözlüğünü de getirmemesi gerekiyordu. Buraya gerçekten koyu yüzeyli
 * bir iskelet gerekirse o gün yazılır — bugün gereken tek şey gri bloktur.
 */

/** Tek gri blok. Ölçüsünü çağıran verir; iskeletin tamamı bununla kurulur. */
export function SkelBox({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-flow bg-ink/[0.07] ${className}`} />;
}
