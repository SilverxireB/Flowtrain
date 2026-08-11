/**
 * HALKA — ürünün tek bekleme göstergesi, markanın O-halkasının kendisi.
 *
 * ÖLÇÜLER LOGODAN OKUNDU, tahmin edilmedi (`public/logo-o-train.png`):
 * dış halka mavi + kırmızı iki yay, iç halka yeşil + turuncu iki yay. Önceki
 * sürüm CSS `conic-gradient` ile dört rengi sürekli bir geçişe yayıyordu —
 * uzaktan halka gibi duruyor ama logonun halkası DEĞİLDİ; yan yana
 * konduğunda ikisi tutmuyordu.
 *
 * SVG, PNG DEĞİL: kapalı ağda bir dosya eksik diye bekleme göstergesi
 * kaybolamaz (`Yukleniyor.tsx` bunu zaten şart koşuyordu). Yaylar burada
 * çizilir, hiçbir varlığa bağlı değildir.
 *
 * ORAN HALKANIN İÇİNE yazılır: halka boş bir çemberdir, ortadaki delik zaten
 * metin için ayrılmış yer. Rakamın arkasında OPAK bir daire var — halka koyu
 * bir video karesinin üstünde dönerken siyah yazı kayboluyordu.
 */

/** Logodan örneklenen yay renkleri. UI paleti DEĞİL — marka halkası. */
const MAVI = "#1b8dec";
const KIRMIZI = "#d30b14";
const YESIL = "#197031";
const TURUNCU = "#f17e2b";

/* Yarıçaplar ve kalınlıklar logodaki oranlarla aynı (yarı boyun yüzdesi):
   dış yay 0.92–1.00, iç yay 0.63–0.72. */
const DIS_R = 45;
const DIS_KALIN = 7;
const IC_R = 33;
const IC_KALIN = 6;

const DIS_CEVRE = 2 * Math.PI * DIS_R;
const IC_CEVRE = 2 * Math.PI * IC_R;

/** Yay uzunluğu / boşluk — logodaki gibi iki karşılıklı yay, arada boşluk. */
const DIS_DESEN = `${DIS_CEVRE * 0.4} ${DIS_CEVRE * 0.6}`;
const IC_DESEN = `${IC_CEVRE * 0.38} ${IC_CEVRE * 0.62}`;

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
    <span
      className={`relative inline-grid shrink-0 place-items-center ${className}`}
      style={{ width: boyut, height: boyut }}
      role="status"
      aria-label={yuzde == null ? "Yükleniyor" : `Yükleniyor, %${yuzde}`}
    >
      <svg viewBox="0 0 100 100" width={boyut} height={boyut} aria-hidden className="block">
        {/* İki halka TERS yönde döner: yaylar olduğu gibi kalır, dönüş
            hareketi verir. Renk ya da oran hiçbir yerde değiştirilmez. */}
        <g className="halka-don-sag" style={{ transformOrigin: "50px 50px" }}>
          <circle cx="50" cy="50" r={DIS_R} fill="none" stroke={MAVI} strokeWidth={DIS_KALIN}
            strokeLinecap="round" strokeDasharray={DIS_DESEN} transform="rotate(-135 50 50)" />
          <circle cx="50" cy="50" r={DIS_R} fill="none" stroke={KIRMIZI} strokeWidth={DIS_KALIN}
            strokeLinecap="round" strokeDasharray={DIS_DESEN} transform="rotate(45 50 50)" />
        </g>
        <g className="halka-don-sol" style={{ transformOrigin: "50px 50px" }}>
          <circle cx="50" cy="50" r={IC_R} fill="none" stroke={YESIL} strokeWidth={IC_KALIN}
            strokeLinecap="round" strokeDasharray={IC_DESEN} transform="rotate(-60 50 50)" />
          <circle cx="50" cy="50" r={IC_R} fill="none" stroke={TURUNCU} strokeWidth={IC_KALIN}
            strokeLinecap="round" strokeDasharray={IC_DESEN} transform="rotate(120 50 50)" />
        </g>
      </svg>

      {/* Delik küçükken rakam okunmaz; yalnız halka yeterince büyükse yazılır. */}
      {yuzde != null && boyut >= 40 ? (
        <span
          className="absolute grid place-items-center rounded-full bg-white font-bold tabular-nums text-ink shadow-sm"
          style={{ width: boyut * 0.52, height: boyut * 0.52, fontSize: Math.round(boyut * 0.24) }}
          aria-hidden
        >
          {yuzde}
        </span>
      ) : null}
    </span>
  );
}
