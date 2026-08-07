/**
 * YETKİ KARARLARI — saf, sunucu bağımlılığı yok.
 *
 * `kimlik.ts` çerez, `next/headers` ve `server-only` taşıdığı için sınav
 * yazılamıyordu; oysa buradaki iki karar ürünün en sessiz yüzeyi: bozulduğunda
 * ekranda hiçbir şey değişmez, yalnız yanlış kişi yanlış yere girer.
 *
 * Sınav: `node tests/yetki.test.mjs`
 */

export type Rol = "yonetici" | "hazirlayan" | "onaylayan" | "amir";

export interface Hesap {
  kullanici: string;
  ad: string;
  rol: Rol;
  /** Amir hesabı bir personel siciliyle eşleşir — ekip listesi ondan çıkar. */
  sicil?: string;
}

const ROL_SIRASI: Record<Rol, number> = { amir: 1, hazirlayan: 2, onaylayan: 3, yonetici: 4 };

/**
 * Yönetici her kapıdan geçer; onaylayan hazırlayanın yaptığını da yapar.
 *
 * AMİR AYRI BİR DAL, ÜST BASAMAK DEĞİL: hazırlama yetkisi vermez ve
 * hazırlayan/onaylayan da amir yüzeyine giremez. Eskiden `enAz === "amir"`
 * koşulsuz `true` dönüyordu — yani giriş yapan HERKES /ekibim'i açıyordu.
 */
export function yetkili(hesap: Hesap | null, enAz: Rol): boolean {
  if (!hesap) return false;
  if (hesap.rol === "yonetici") return true;
  if (enAz === "amir") return hesap.rol === "amir";
  if (hesap.rol === "amir") return false;
  return ROL_SIRASI[hesap.rol] >= ROL_SIRASI[enAz];
}

/**
 * Giriş sonrası dönülecek yol — YALNIZ iç yollar.
 *
 * `//site` kadar `/\site` de şema-göreli bir ADRESTİR: WHATWG ayrıştırması
 * ikisini de `http://site/` yapar. Yalnız `//` elenirse açık yönlendirme
 * kapısı ters eğik çizgiyle açık kalır ve kapalı ağdaki sahte bir giriş
 * sayfasına kimlik toplama akışı kurulabilir.
 */
export function guvenliYol(next: string | undefined, varsayilan = "/"): string {
  if (!next) return varsayilan;
  if (!/^\/[^/\\]/.test(next)) return varsayilan;
  return next;
}
