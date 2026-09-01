import type { Medya } from "./tipler";

/**
 * EDİTÖR MEDYA YARDIMCILARI — saf, yan etkisiz.
 *
 * Çoklu görsel iki alanda birden yaşıyor: `gorselIdler` (liste) ve `gorselId`
 * (tekil). Tekil alan geriye dönük uyum için duruyor — PDF'ten gelen eski
 * kartlar ve kiosk kartı onu okuyor. Bu yüzden iki alan TEK YERDEN yazılır;
 * her çağıran kendi eşitlemesini yazsaydı biri mutlaka unuturdu ve kartın
 * kioskta görseli kaybolurdu.
 */

/**
 * Kartın görselleri, sırasıyla ve tekrarsız.
 *
 * ÜRÜNDE TEK KOPYA. Bir zamanlar üç yerde vardı — burada, kiosk oynatıcısında
 * (`components/oyun/gorseller.ts`) ve `kartVeri.onceSonra` içinde satır içi —
 * ve İKİSİ FARKLI ŞEY YAPIYORDU: buradaki liste doluysa tekil alanı ATIYOR,
 * kiosktaki tekil alanı BAŞA KOYUYORDU. Aynı karttan iki farklı görsel kümesi
 * çıkabiliyordu, üstelik yayın öncesi kontrol birincisini, sahanın çizdiği
 * ekran ikincisini çağırıyordu: kontrolün gördüğü ile işçinin gördüğü aynı
 * olmak zorunda. İkisi de yorumunda "TEK YERDE" diyordu; ikisi de yanılıyordu.
 *
 * Bugün patlamıyordu çünkü tüm yazıcılar `gorselId === gorselIdler[0]`
 * değişmezini koruyor — o değişmezi bozan TEK bir yazıcı yeterdi.
 *
 * SEÇİLEN ANLAM: liste doluysa GERÇEK odur. `gorselYamasi` (hemen aşağıda)
 * `gorselId`'yi listenin ilkinden türetiyor, yani tekil alan bir kaynak değil
 * bir TÜREVDİR; geriye dönük uyum için, listesi hiç yazılmamış eski kartlar
 * için duruyor. Okuyucu ile yazıcı bilerek aynı dosyada: ayrı dosyalara
 * düştükleri anda yeniden ayrışırlar.
 *
 * Sınav: `node tests/kart-gorsel.test.mjs`
 */
export function kartGorselleri(sayfa: { gorselId?: string; gorselIdler?: string[] }): string[] {
  const kaynak = sayfa.gorselIdler?.length ? sayfa.gorselIdler : sayfa.gorselId ? [sayfa.gorselId] : [];
  /* Boş dize ve tekrar ELENİR: `gorselIdler` JSON'dan geliyor ve elle
     düzeltilmiş bir veride ikisi de görülür. Tekrar eden kimlik kioskta aynı
     fotoğrafı iki kez çizerdi. */
  return [...new Set(kaynak.filter((id) => !!id))];
}

/**
 * Görsel listesini yazan yama.
 *
 * `gorselId` HER ZAMAN listenin ilki olur: kiosk kartı bugün onu çiziyor.
 * Liste boşaldığında `null` gider (undefined olsaydı depo alanı hiç güncellemez,
 * silinen görsel kartta kalırdı).
 */
export function gorselYamasi(idler: string[]): { gorselId: string | null; gorselIdler: string[] } {
  return { gorselId: idler[0] ?? null, gorselIdler: idler };
}

/** Bir kimliği listede bir adım öne/arkaya taşır. Sınırda liste aynen döner. */
export function siraDegistir(idler: string[], indeks: number, yon: -1 | 1): string[] {
  const hedef = indeks + yon;
  if (hedef < 0 || hedef >= idler.length) return idler;
  const yeni = [...idler];
  [yeni[indeks], yeni[hedef]] = [yeni[hedef], yeni[indeks]];
  return yeni;
}

/** Kütüphane satırı: medya kaydı + kaç yerde kullanıldığı. */
export interface MedyaOzet extends Medya {
  /** Kaç kartta/soruda kullanılıyor — silmeden önce söylenir. */
  kullanim: number;
}

export function boyutMetni(bayt: number): string {
  if (bayt <= 0) return "—";
  if (bayt < 1024 * 1024) return `${Math.max(1, Math.round(bayt / 1024))} KB`;
  return `${(bayt / (1024 * 1024)).toFixed(1)} MB`;
}

/** Medya kimliği görsel mi? Uzantı kimliğin içinde (`mdy_xxx.jpg`). */
export function gorselMi(id: string): boolean {
  return /\.(png|jpe?g|webp|gif)$/i.test(id);
}
