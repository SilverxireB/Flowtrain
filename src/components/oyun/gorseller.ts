/**
 * OYNATICI YERLEŞİMİ — saf kararlar, çizim değil.
 *
 * Sınav: `node tests/oynatici.test.mjs`
 *
 * `kartGorselleri` BURADA DEĞİL. Bu dosyada kendi kopyası vardı ve `lib`teki
 * ikizinden farklı davranıyordu: buradaki tekil `gorselId`'yi listenin başına
 * koyuyor, oradaki liste doluysa onu atıyordu. Yani yayın öncesi kontrolün
 * gördüğü görsel kümesi ile sahanın çizdiği küme farklı işlevlerden
 * geliyordu. Tek gerçek `lib/editorMedya.ts`te — okuma ile yazma orada yan
 * yana duruyor, ayrı dosyalara düştükleri anda yeniden ayrışırlar.
 * Buradan YENİDEN DIŞA AKTARILIYOR ki oynatıcı tarafındaki çağıranların
 * içe aktarma yolu değişmesin.
 */
export { kartGorselleri } from "@/lib/editorMedya";

/**
 * Görsel sayısına göre ızgara.
 *
 * KİOSK DÜZENİ BOZULMAZ: bir metre uzaktan bakan kişi için tek görsel büyük
 * kalır; iki görsel yan yana durur (yap/yapma karşılaştırması bu); üç ve
 * fazlası ızgaraya girer. Hepsini alt alta tam genişlikte dizmek, "İleri"
 * düğmesini ekranın çok altına atıyordu ve eldivenli el kaydırmak zorunda
 * kalıyordu.
 */
export function gorselIzgaraSinifi(adet: number): string {
  if (adet <= 1) return "mt-6";
  if (adet === 2) return "mt-6 grid grid-cols-2 gap-3";
  return "mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3";
}

/**
 * Görselin en fazla kaplayacağı yükseklik sınıfı.
 * Yükseklik sınırı olmadan tek bir dikey fotoğraf ekranın tamamını yiyor,
 * kartın metni ekranın dışına düşüyordu.
 */
export function gorselYukseklikSinifi(adet: number): string {
  if (adet <= 1) return "max-h-[46vh]";
  if (adet === 2) return "max-h-[32vh]";
  return "max-h-[24vh]";
}

/**
 * SAYI VURGUSU ızgarası — görsel ızgarasının kardeşi, ayrı tutuluyor çünkü
 * ölçüt farklı: görselde amaç ekrana sığdırmak, rakamda amaç BİR BAKIŞTA
 * okutmak. Tek rakam varsa yan yana dizilecek bir şey yoktur ve kartın
 * tamamını kaplar; ikişerli dizilim rakamı yarı yarıya küçültür.
 */
export function sayiIzgaraSinifi(adet: number): string {
  if (adet <= 1) return "mt-8";
  if (adet === 2) return "mt-8 grid grid-cols-2 gap-4";
  return "mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3";
}

/**
 * Rakamın puntosu — kutu daraldıkça küçülür.
 * Sabit punto bırakıldığında üç rakamlı bir değer ("120 kg") iki sütunlu
 * dizilimde kutudan taşıyor ve satır kayıyordu.
 */
export function sayiPuntoSinifi(adet: number): string {
  if (adet <= 1) return "text-6xl sm:text-7xl";
  if (adet === 2) return "text-5xl sm:text-6xl";
  return "text-4xl sm:text-5xl";
}
