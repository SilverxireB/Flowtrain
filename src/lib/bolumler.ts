/**
 * BÖLÜM BAŞLIKLARI — uzun eğitimi editörde parçalara ayırma aracı.
 *
 * ŞEMA DEĞİŞMEZ. Başlıklar `ayar` tablosuna, eğitim başına tek JSON satırı
 * olarak yazılır (`ziyaretciDepo.ts` varsayılan bilgilendirme listesini aynı
 * yolla tutuyor — desen yeni değil). Yeni sütun ya da tablo açmamanın iki
 * somut karşılığı var: `Sayfa` tipine dokunulmadığı için kiosk, oynatıcı,
 * dışa aktarım ve yükseltme betiği hiç etkilenmiyor; ve bölüm başlığı bir
 * KART OLMADIĞI için kioskta işçiye fazladan hiçbir şey görünmüyor.
 *
 * BAŞLIK KARTA BAĞLANIR, SIRAYA DEĞİL: `{ sayfaId: "Acil durum" }` "bu kartın
 * ÜSTÜNDE bölüm başlar" demektir. Sıra numarasına bağlansaydı araya tek kart
 * eklemek bütün başlıkları bir aşağı kaydırırdı; karta bağlıyken bölüm kendi
 * ilk kartıyla birlikte taşınır.
 *
 * NEDEN `src/lib` (eskiden editörün yanındaydı): yayın anlık görüntüsü bu
 * satırı da almak zorunda (`depo.yayinla`), yoksa yayınlanan eğitim bölümsüz
 * kalır. Depo katmanının editör klasöründen içe aktarım yapması bağımlılığı
 * ters çevirirdi; anahtar biçimini iki yere kopyalamak ise ilk değişiklikte
 * sessizce ayrışırdı.
 */

/** sayfaId → o kartın üstünde başlayan bölümün adı. */
export type BolumHaritasi = Record<string, string>;

/** `ayar` tablosundaki anahtar. Eğitim başına tek satır. */
export function bolumAnahtari(egitimId: string): string {
  return `bolumler:${egitimId}`;
}

/** Bölüm adı için üst sınır — harita sütunu dar, uzun ad orada okunmaz. */
export const BOLUM_EN_UZUN = 60;

/**
 * Ham JSON'u haritaya çevirir.
 *
 * `gecerliIdler` verilirse ARTIK VAR OLMAYAN kartların başlıkları elenir:
 * bölümünün ilk kartı silindiğinde geriye öksüz bir kayıt kalıyordu ve o kayıt
 * hiçbir yerde görünmediği için de temizlenemiyordu. Okuma da yazma da aynı
 * süzgeçten geçtiği için ayar satırı ilk yazımda kendiliğinden toparlanır.
 *
 * Bozuk/elle düzenlenmiş JSON sessizce boş haritaya düşer — editörün açılması
 * bir ayar satırına bağlı olamaz.
 */
export function bolumleriCoz(ham: string, gecerliIdler?: string[]): BolumHaritasi {
  let veri: unknown;
  try {
    veri = JSON.parse(ham || "{}");
  } catch {
    return {};
  }
  if (!veri || typeof veri !== "object" || Array.isArray(veri)) return {};

  const izin = gecerliIdler ? new Set(gecerliIdler) : null;
  const cikti: BolumHaritasi = {};
  for (const [id, ad] of Object.entries(veri as Record<string, unknown>)) {
    if (typeof ad !== "string") continue;
    if (izin && !izin.has(id)) continue;
    const temiz = ad.trim().slice(0, BOLUM_EN_UZUN);
    if (temiz !== "") cikti[id] = temiz;
  }
  return cikti;
}
