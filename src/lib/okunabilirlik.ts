import { satirlar } from "./kartVeri";
import type { Sayfa } from "./tipler";

/**
 * OKUNABİLİRLİK — sahada okunmayan metin, yazılmamış metindir.
 *
 * NEDEN VAR: eğitim yazan kişi masa başında, ekrana yakın, acelesi yok.
 * Okuyan kişi ayakta, eldivenli, vardiya başında ve kartı geçmek için sekiz
 * saniye bekliyor. Bu iki bağlam arasındaki fark, iyi niyetle yazılmış uzun
 * paragrafların hiç okunmamasıyla sonuçlanıyor: kart görünüyor, süre doluyor,
 * "İleri"ye basılıyor, hiçbir şey öğrenilmiyor. Ürün bunu ölçemez ama METNİN
 * BİÇİMİNİ ölçebilir.
 *
 * ÖLÇÜLEBİLİR OLANI SÖYLER, ÜSLUP ELEŞTİRMEZ. "Daha açıklayıcı yaz" gibi bir
 * uyarı ölçüsüzdür ve listeyi gürültüye çevirir; buradaki her kural bir sayıya
 * dayanıyor ve hazırlayan somut bir düzeltme yapabiliyor.
 *
 * ENGELLEMEZ. Yayına engel değil, uyarıdır — hazırlayanın "bu cümle uzun ama
 * kanun metni, aynen kalacak" deme hakkı var.
 *
 * Sınav: `node tests/okunabilirlik.test.mjs`
 */

/** Bir cümle bu kadar sözcüğü aşarsa ayakta okunmuyor. */
const UZUN_CUMLE = 25;
/** Bir kart bu kadar sözcüğü aşarsa ikiye bölünmeli. */
const UZUN_KART = 120;
/** Bu uzunluktan sonra TAMAMI BÜYÜK HARF okumayı yavaşlatır. */
const BAGIRAN_SATIR = 40;

export interface OkumaUyarisi {
  sayfaId: string;
  metin: string;
}

function sozcukler(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

/** Kartın okunabilir metni — tipe özel alanlar dahil. */
function kartMetni(sayfa: Sayfa): string {
  return [sayfa.metin ?? "", sayfa.metinKarsi ?? ""].join("\n");
}

/**
 * Cümlelere böler. Kısaltmalardaki nokta ("vb.", "örn.") cümle sonu
 * sayılmasın diye nokta+boşluk+BÜYÜK HARF aranır.
 */
function cumleler(metin: string): string[] {
  return metin
    .replace(/\r\n/g, "\n")
    .split(/(?<=[.!?])\s+(?=[A-ZÇĞİÖŞÜ])|\n+/)
    .map((c) => c.trim())
    .filter(Boolean);
}

function bagiranSatir(metin: string): boolean {
  return satirlar(metin).some(
    (s) => s.length > BAGIRAN_SATIR && s === s.toLocaleUpperCase("tr") && /[A-ZÇĞİÖŞÜ]/.test(s),
  );
}

/** Tek bir kartın okuma uyarıları. */
export function kartOkunabilirligi(sayfa: Sayfa): string[] {
  const uyarilar: string[] = [];
  const metin = kartMetni(sayfa);

  const enUzun = cumleler(metin).reduce((a, c) => Math.max(a, sozcukler(c)), 0);
  if (enUzun > UZUN_CUMLE) {
    uyarilar.push(`${enUzun} sözcüklük cümle var — ayakta okunmuyor, bölün.`);
  }

  const toplam = sozcukler(metin);
  if (toplam > UZUN_KART) {
    uyarilar.push(`Kart ${toplam} sözcük — ikiye bölmek okunma şansını artırır.`);
  }

  if (bagiranSatir(metin)) {
    uyarilar.push("Tamamı büyük harfle yazılmış uzun satır okumayı yavaşlatır.");
  }

  return uyarilar;
}

/**
 * Eğitimin tamamı için okuma uyarıları.
 *
 * KART BAŞINA EN FAZLA BİR SATIR: aynı kart üç kusur birden taşıyorsa üçünü de
 * yazmak listeyi o kartla doldurur ve diğer kartlar görünmez olur. En ağırı
 * (ilk kural) söylenir; hazırlayan onu düzeltince sıradaki görünür.
 */
export function okumaUyarilari(sayfalar: Sayfa[]): OkumaUyarisi[] {
  const cikti: OkumaUyarisi[] = [];
  for (const s of sayfalar) {
    const u = kartOkunabilirligi(s);
    if (u.length > 0) cikti.push({ sayfaId: s.id, metin: u[0] });
  }
  return cikti;
}
