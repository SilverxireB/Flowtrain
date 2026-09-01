/**
 * TABLO SIRALAMA — saf karşılaştırma.
 *
 * NEDEN BURADA: sıralama bir görünüm süsü değil, listenin OKUNMA biçimi.
 * Türkçe sıralama, boş hücre ve sayı/tarih ayrımı burada ölçülebiliyor;
 * her tabloda ayrı yazılsaydı üçü üç farklı sonuç verirdi.
 *
 * Sınav: `node tests/tablo-sirala.test.mjs`
 */

export type SiraYonu = "artan" | "azalan";

/**
 * TÜRKÇE KARŞILAŞTIRMA ŞART.
 *
 * `"Çelik" < "Zafer"` varsayılan sıralamada YANLIŞ çıkıyor: JS'in ham dize
 * karşılaştırması Unicode kod noktasına bakıyor ve Ç harfi Z'den sonra
 * geliyor. Personel listesinde Ç/Ğ/İ/Ö/Ş/Ü ile başlayan her ad listenin
 * sonuna sürülüyordu. `Intl.Collator` bir kez kurulup yeniden kullanılıyor —
 * her karşılaştırmada yeniden kurmak binlerce satırda ölçülür bir maliyet.
 */
const harmanlayici = new Intl.Collator("tr", { numeric: true, sensitivity: "base" });

/**
 * İki değeri karşılaştırır.
 *
 * BOŞ HER ZAMAN SONA, yön ne olursa olsun. Ters çevirince boşların başa
 * yığılması sıralamayı işe yaramaz hâle getiriyor: kullanıcı "en yüksek
 * puan" isterken ekranın ilk yarısı puansız satırlarla doluyordu.
 */
export function degerKarsilastir(a: unknown, b: unknown): number {
  const aBos = a === null || a === undefined || a === "";
  const bBos = b === null || b === undefined || b === "";
  if (aBos && bBos) return 0;
  if (aBos) return 1;
  if (bBos) return -1;

  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" && typeof b === "boolean") return Number(a) - Number(b);
  return harmanlayici.compare(String(a), String(b));
}

/**
 * Listeyi bir alana göre sıralar. ÖZGÜN LİSTE BOZULMAZ.
 *
 * `oku` alanı çıkarır; böylece "tamamlama" gibi türetilmiş sütunlar da
 * sıralanabiliyor (satırda öyle bir alan yok, iki alandan hesaplanıyor).
 */
export function tabloSirala<T>(liste: T[], oku: (satir: T) => unknown, yon: SiraYonu): T[] {
  const yonKatsayisi = yon === "azalan" ? -1 : 1;
  return [...liste].sort((a, b) => {
    const s = degerKarsilastir(oku(a), oku(b));
    /* Boşlar yön ne olursa olsun SONDA kalmalı: `degerKarsilastir` boşu
       zaten sona atıyor ama yön katsayısıyla çarpılsaydı ters sıralamada
       başa gelirdi. Boş karşılaştırmasında katsayı uygulanmıyor. */
    const aBos = boslukMu(oku(a));
    const bBos = boslukMu(oku(b));
    if (aBos !== bBos) return s;
    return yonKatsayisi * s;
  });
}

function boslukMu(d: unknown): boolean {
  return d === null || d === undefined || d === "";
}

/** Başlığa basınca: aynı sütunsa yön döner, değilse yeni sütun artan başlar. */
export function sonrakiSira(
  suAnki: { sutun: string; yon: SiraYonu },
  basilan: string,
): { sutun: string; yon: SiraYonu } {
  if (suAnki.sutun !== basilan) return { sutun: basilan, yon: "artan" };
  return { sutun: basilan, yon: suAnki.yon === "artan" ? "azalan" : "artan" };
}
