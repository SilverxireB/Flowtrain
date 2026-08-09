import type { Medya, Sayfa } from "./tipler";

/**
 * EDİTÖR MEDYA YARDIMCILARI — saf, yan etkisiz.
 *
 * Çoklu görsel iki alanda birden yaşıyor: `gorselIdler` (liste) ve `gorselId`
 * (tekil). Tekil alan geriye dönük uyum için duruyor — PDF'ten gelen eski
 * kartlar ve kiosk kartı onu okuyor. Bu yüzden iki alan TEK YERDEN yazılır;
 * her çağıran kendi eşitlemesini yazsaydı biri mutlaka unuturdu ve kartın
 * kioskta görseli kaybolurdu.
 */

/** Kartın görselleri, sırasıyla. Liste boşsa tekil alan tek görsel sayılır. */
export function kartGorselleri(sayfa: Pick<Sayfa, "gorselId" | "gorselIdler">): string[] {
  if (sayfa.gorselIdler.length > 0) return sayfa.gorselIdler;
  return sayfa.gorselId ? [sayfa.gorselId] : [];
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
