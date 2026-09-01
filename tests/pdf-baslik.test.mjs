/**
 * PDF sayfa başlığı türetme sınavı.
 *
 * Koşum: `node --experimental-strip-types tests/pdf-baslik.test.mjs`
 * (`npm test` hepsini birden koşar.)
 */
import { pdfSayfaBasligi } from "../src/lib/pdfBaslik.ts";

let gecen = 0;
let kalan = 0;

function esit(ad, bulunan, beklenen) {
  if (bulunan === beklenen) {
    gecen++;
  } else {
    kalan++;
    console.error(`  ✗ ${ad}\n    beklenen: ${JSON.stringify(beklenen)}\n    bulunan : ${JSON.stringify(bulunan)}`);
  }
}

/** Kısa yazım: tek parçalık satır. */
function p(metin, y, boy = 10, x = 50) {
  return { metin, x, y, boy };
}

/* ── 1. en büyük punto başlıktır ─────────────────────────────────────────── */

esit(
  "en büyük puntolu satır seçilir",
  pdfSayfaBasligi([p("Bu bir gövde cümlesidir.", 700, 10), p("YÜKSEKTE ÇALIŞMA", 750, 20)]),
  "YÜKSEKTE ÇALIŞMA",
);

esit(
  "başlık sayfanın ALTINDA olsa da punto kazanır",
  pdfSayfaBasligi([p("üstteki küçük not", 780, 8), p("LOTO TALİMATI", 300, 24)]),
  "LOTO TALİMATI",
);

/* ── 2. punto eşitse en üstteki ───────────────────────────────────────────── */

esit(
  "eşit puntoda en üstteki satır",
  pdfSayfaBasligi([p("ikinci satır", 700, 12), p("birinci satır", 740, 12), p("üçüncü satır", 660, 12)]),
  "birinci satır",
);

esit(
  "yarım punto fark eşitlik sayılır (aynı satırda kerning oynaması)",
  pdfSayfaBasligi([p("alttaki", 600, 12), p("üstteki", 700, 12.4)]),
  "üstteki",
);

/* ── 3. parçalar satıra toplanır ──────────────────────────────────────────── */

esit(
  "aynı y'deki parçalar x sırasına göre birleşir",
  pdfSayfaBasligi([
    { metin: "ÇALIŞMA", x: 200, y: 700, boy: 18 },
    { metin: "YÜKSEKTE ", x: 100, y: 700, boy: 18 },
  ]),
  "YÜKSEKTE ÇALIŞMA",
);

esit(
  "tolerans içindeki y farkı aynı satır sayılır",
  pdfSayfaBasligi([
    { metin: "KKD", x: 100, y: 700, boy: 20 },
    { metin: " ZORUNLU", x: 140, y: 703, boy: 20 },
  ]),
  "KKD ZORUNLU",
);

esit(
  "tolerans DIŞINDAKİ y farkı ayrı satırdır",
  pdfSayfaBasligi([
    { metin: "ÜST", x: 100, y: 700, boy: 10 },
    { metin: "ALT", x: 100, y: 680, boy: 10 },
  ]),
  "ÜST",
);

esit("çoklu boşluk tek boşluğa iner", pdfSayfaBasligi([p("A   B    C", 700, 14)]), "A B C");

/* ── 4. sayfa imleri elenir ───────────────────────────────────────────────── */

esit(
  "sadece sayı olan satır başlık değildir",
  pdfSayfaBasligi([p("12", 780, 30), p("Kimyasal güvenlik", 700, 12)]),
  "Kimyasal güvenlik",
);

esit(
  "'Sayfa 3 / 12' elenir",
  pdfSayfaBasligi([p("Sayfa 3 / 12", 780, 20), p("Acil durum planı", 700, 12)]),
  "Acil durum planı",
);

esit("'Page 4' elenir", pdfSayfaBasligi([p("Page 4", 780, 20), p("Forklift", 700, 12)]), "Forklift");

esit("noktalama çizgisi elenir", pdfSayfaBasligi([p("— — —", 780, 30), p("Giriş", 700, 12)]), "Giriş");

/* ── 5. tavanı aşan satır ELENİR, kırpılmaz ───────────────────────────────── */

const uzun = "Bu cümle yetmiş karakterden uzun olduğu için başlık adayı sayılmaz ve elenmelidir.";
esit("uzun satır elenir", pdfSayfaBasligi([p(uzun, 700, 30), p("Kısa başlık", 650, 10)]), "Kısa başlık");

esit("elenecek satırdan başka aday yoksa boş döner", pdfSayfaBasligi([p(uzun, 700, 12)]), "");

/* ── 6. şüphede boş döner ─────────────────────────────────────────────────── */

esit("hiç parça yoksa boş", pdfSayfaBasligi([]), "");
esit("yalnız boşluk varsa boş", pdfSayfaBasligi([p("   ", 700, 12), p("\n", 690, 12)]), "");
esit("çok kısa satır (im) elenir", pdfSayfaBasligi([p("•", 700, 30)]), "");

/* ── 7. biçim kalıntıları ─────────────────────────────────────────────────── */

esit("sondaki iki nokta atılır", pdfSayfaBasligi([p("1. Kapsam:", 700, 16)]), "1. Kapsam");
esit("tam genişlik iki nokta da atılır", pdfSayfaBasligi([p("Amaç：", 700, 16)]), "Amaç");

/* ── 8. tek puntolu düz metinde ilk satıra düşer ──────────────────────────── */

esit(
  "punto farkı yoksa ilk satır başlık olur",
  pdfSayfaBasligi([p("Genel kurallar", 720, 11), p("Bu bölüm kuralları anlatır.", 700, 11)]),
  "Genel kurallar",
);

/* ── 9. gerçek bir prosedür sayfasının kabaca kalıbı ──────────────────────── */

esit(
  "başlık + numaralı gövde + altbilgi",
  pdfSayfaBasligi([
    p("ABC Fabrika A.Ş.", 800, 8),
    p("KİMYASAL DÖKÜNTÜ MÜDAHALE", 750, 22),
    p("1. Alanı boşaltın", 700, 11),
    p("2. Amiri arayın", 685, 11),
    p("Rev.02", 40, 8),
    p("7", 30, 8),
  ]),
  "KİMYASAL DÖKÜNTÜ MÜDAHALE",
);

console.log(gecen + kalan === gecen ? `pdf-baslik: ${gecen}/${gecen} ✓` : `pdf-baslik: ${gecen}/${gecen + kalan} — ${kalan} KALDI`);
process.exit(kalan === 0 ? 0 : 1);
