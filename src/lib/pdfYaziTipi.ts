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
