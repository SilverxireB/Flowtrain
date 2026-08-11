/**
 * HALKA — ürünün tek bekleme göstergesi.
 *
 * Markanın O-halkası zaten bir halka; ayrıca bir "spinner çizimi" uydurmuyoruz.
 * `globals.css`teki `.yukleme-halka` kuralına DOKUNULMAZ: renk sırası, maske ve
 * hareketi azalt davranışı orada tanımlı ve tek yerde durur. Buradaki iş yalnız
 * onu ÖLÇEKLEMEK ve gerektiğinde ortasına oran yazmak.
 *
 * ORAN HALKANIN İÇİNE yazılır, halkanın üstüne değil: halka boş bir çemberdir,
 * ortadaki delik zaten metin için ayrılmış yer. Böylece yüzde göstermek
 * halkanın çizimini değiştirmez — belirsiz bekleme ile belirli ilerleme aynı
 * görselin iki hâli olur.
 */
export default function Halka({
  boyut = 44,
  oran,
  className = "",
}: {
  /** Kenar uzunluğu (px). Düğme içinde 16-18, kart üstünde 44-56. */
  boyut?: number;
  /** 0-100 arası gerçek ilerleme. Verilmezse belirsiz bekleme. */
  oran?: number;
  className?: string;
}) {
  const yuzde = oran == null ? null : Math.max(0, Math.min(100, Math.round(oran)));

  return (
    <span className={`relative inline-grid shrink-0 place-items-center ${className}`} style={{ width: boyut, height: boyut }}>
      <span className="yukleme-halka" style={{ width: boyut, height: boyut }} aria-hidden />
      {/* Delik küçükken rakam okunmaz; yalnız halka yeterince büyükse yazılır. */}
      {yuzde != null && boyut >= 40 ? (
        <span
          className="absolute font-bold tabular-nums text-ink"
          style={{ fontSize: Math.round(boyut * 0.26) }}
          aria-hidden
        >
          {yuzde}
        </span>
      ) : null}
    </span>
  );
}
