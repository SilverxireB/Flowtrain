import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * PAROLA ÖZETLEME — tek kaynak.
 *
 * Neden ayrı dosya: aynı hesabın şifresini iki yer yazıyor — uygulamanın
 * kendisi (`depo.ts`) ve konsoldan çalışan kurtarma aracı
 * (`scripts/sifre-sifirla.mjs`). İkisi kendi özetini üretseydi, birinde
 * yapılan bir değişiklik (tuz uzunluğu, anahtar boyu) diğerini sessizce
 * geçersiz kılar ve şifre "yanlış" görünürdü.
 *
 * `server-only` BİLEREK YOK: bu dosya konsol betiğinden de çağrılıyor.
 * İçinde istek/oturum/çerez yok, yalnız saf kripto.
 */

/** scrypt: kasıtlı olarak yavaş — kaba kuvvet denemesini pahalı kılar. */
export function ozetle(deger: string, tuz: string): string {
  return scryptSync(deger, tuz, 32).toString("hex");
}

export function tuzUret(): string {
  return randomBytes(16).toString("hex");
}

/**
 * Sabit süreli karşılaştırma. Basit `===` doğru olan ilk karakterde
 * ayrıldığı için harf harf şifre çıkarmayı mümkün kılar.
 */
export function ozetDogru(ozet: string, tuz: string, girilen: string): boolean {
  const a = Buffer.from(ozet, "hex");
  const b = Buffer.from(ozetle(girilen, tuz), "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Kurulumun her yerinde aynı asgari uzunluk. */
export const EN_KISA_SIFRE = 6;
