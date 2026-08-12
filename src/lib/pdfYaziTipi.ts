import type { jsPDF } from "jspdf";

/**
 * PDF YAZI TİPİ — üç belgenin (pano özeti, kayıt defteri, sertifika) ORTAK kapısı.
 *
 * TÜRKÇE YAZI TİPİ GÖMÜLÜR: jsPDF'in yerleşik Helvetica'sı Latin-1'dir,
 * `ş ğ İ ı` karakterlerini basmaz — gömmezsek belge "Yüksekte Çalıma" der ve
 * kimse hatayı bize değil kendi bilgisayarına yorar. Yazı tipi kendi
 * sunucumuzdan gelir (`public/fonts`), dış ağ istemez.
 *
 * TEK YERDE: üç belgede ayrı ayrı gömülseydi biri güncellenip diğerleri
 * unutulduğunda yalnız o belge bozuk çıkardı — ve bozukluğu ancak Türkçe
 * karakterli bir isim basılınca görünürdü.
 */
export const PDF_FONT = "Jakarta";

/**
 * GÖMÜLÜ YAZI TİPİNDE OLMAYAN KARAKTERLERİN KARŞILIĞI.
 *
 * Yazı tipi alt kümelenmiş (335 kod noktası) ve bu beş glif dışarıda kalmış.
 * jsPDF eksik glifi SESSİZCE ATIYOR — hata vermiyor, boşluk da bırakmıyor:
 * "İş Güvenliği — Yüksekte" belgede "İş Güvenliği  Yüksekte" oluyor.
 *
 * NEDEN BURADA, KAYNAK METİNLERDE DEĞİL: en tehlikeli kayıp kodda yazan tire
 * değil, KULLANICININ yazdığı eğitim adındaki tire. Metinleri tek tek
 * düzeltmek bugünü kurtarır, yarın birinin "Yüksekte Çalışma — Tazeleme" diye
 * eğitim açmasını kurtarmaz. Ayrıca `rapor.ts` boş hücre işareti olarak "—"
 * kullanıyor; o kaybolunca "ölçülmedi" ile "sütun boş" ayırt edilemiyordu.
 *
 * Yazı tipi bir gün tam kümeyle yeniden üretilirse bu tablo boşaltılabilir —
 * ama önce `tests/pdf-metin.test.mjs` cmap'i okuyup gerçekten olduklarını
 * doğrulasın.
 */
const KARSILIK: [RegExp, string][] = [
  [/—/g, "-"], // — em dash
  [/–/g, "-"], // – en dash
  [/‑/g, "-"], // ‑ kesilmez tire
  [/→/g, ">"], // → ok
  [/✓/g, "+"], // ✓ tik
];

/**
 * PDF'e yazılacak metni gömülü yazı tipinin basabileceği hâle getirir.
 *
 * Saf ve sınavlı: `jsPDF` olmadan çağrılabiliyor, dolayısıyla kural belgenin
 * üretilmesini beklemeden ölçülebiliyor.
 */
export function pdfGuvenliMetin(metin: string): string {
  let s = metin;
  for (const [desen, yerine] of KARSILIK) s = s.replace(desen, yerine);
  return s;
}

/**
 * `doc.text`i sarmalar: bundan sonra yazılan HER metin süzgeçten geçer.
 *
 * Tek tek çağrı yerlerini sarmalamak yerine sınırda durmanın sebebi, unutulan
 * tek bir çağrının sessizce eksik glif basması. jsPDF `text`e dize ya da dize
 * dizisi verilebiliyor; ikisi de karşılanıyor.
 */
function metinSuzgeciKur(doc: jsPDF): void {
  type MetinIslevi = (...arg: unknown[]) => unknown;
  const kap = doc as unknown as { text: MetinIslevi };
  const dogal = kap.text.bind(doc) as MetinIslevi;
  kap.text = (...arg: unknown[]) => {
    const metin = arg[0];
    arg[0] = Array.isArray(metin)
      ? metin.map((satir) => pdfGuvenliMetin(String(satir)))
      : pdfGuvenliMetin(String(metin));
    return dogal(...arg);
  };
}

/** Yerel yazı tipi dosyasını base64'e çevirir. MODÜL SEVİYESİNDE: `panoPdf`teki
    satır içi yardımcı deseni küçültücüde serbest değişken bırakabiliyor. */
async function ttfOku(yol: string): Promise<string> {
  const c = await fetch(yol);
  if (!c.ok) throw new Error(String(c.status));
  const b = new Uint8Array(await c.arrayBuffer());
  let s = "";
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s);
}

/** Gömme başarısızsa `false` döner — belge yine üretilir, yalnız Helvetica ile. */
export async function yaziTipiGom(doc: jsPDF): Promise<boolean> {
  /* SÜZGEÇ GÖMMEDEN ÖNCE VE KOŞULSUZ kurulur: gömme başarısız olduğunda
     yedeğe düşülen Helvetica Latin-1'dir ve em dash orada da yoktur. */
  metinSuzgeciKur(doc);
  try {
    const [duz, kalin] = await Promise.all([
      ttfOku("/fonts/PlusJakartaSans-Regular.ttf"),
      ttfOku("/fonts/PlusJakartaSans-Bold.ttf"),
    ]);
    doc.addFileToVFS("PlusJakartaSans-Regular.ttf", duz);
    doc.addFont("PlusJakartaSans-Regular.ttf", PDF_FONT, "normal");
    doc.addFileToVFS("PlusJakartaSans-Bold.ttf", kalin);
    doc.addFont("PlusJakartaSans-Bold.ttf", PDF_FONT, "bold");
    return true;
  } catch {
    return false;
  }
}
