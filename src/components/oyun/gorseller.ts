import type { Sayfa } from "@/lib/tipler";

/**
 * KART GÖRSELLERİ — saf yerleşim kararı, çizim değil.
 *
 * Çekirdek kart başına çoklu görseli `Sayfa.gorselIdler` ile veriyor; tekil
 * `gorselId` geriye dönük duruyor. İki alanı her çizim yerinde ayrı ayrı
 * birleştirmek, birinin unutulduğu bir yer bırakırdı — birleştirme TEK YERDE.
 *
 * Sınav: `node tests/oynatici.test.mjs`
 */

/**
 * Kartın göstereceği görsel kimlikleri, sırasıyla ve tekrarsız.
 * Tekil `gorselId` HER ZAMAN başta: eski kartlarda kapak görseli odur.
 */
export function kartGorselleri(sayfa: Pick<Sayfa, "gorselId" | "gorselIdler">): string[] {
  const cikti: string[] = [];
  const gorulen = new Set<string>();

  if (sayfa.gorselId && !gorulen.has(sayfa.gorselId)) {
    gorulen.add(sayfa.gorselId);
    cikti.push(sayfa.gorselId);
  }
  for (const id of sayfa.gorselIdler ?? []) {
    if (!id || gorulen.has(id)) continue;
    gorulen.add(id);
    cikti.push(id);
  }
  return cikti;
}

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
