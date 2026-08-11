/**
 * KOKPİTİN TEK GENİŞLİĞİ — `npm test`
 *
 * NEDEN: `globals.css` bu kuralı yazıyor ("bir sayfa 'biraz daha geniş olsun'
 * diye buradan sapmaz") ama kural yalnız yorumda duruyordu ve iki sayfa
 * sessizce saptı: sınıf kaydı ve geçmiş aktarımı kendi `max-w-3xl`ini
 * taşıyordu. Geniş ekranda sayfalar arasında gezerken içerik bir daralıp bir
 * genişliyor, kullanıcı bunu "boyut problemi" diye bildirdi.
 *
 * Sapma GÖZLE fark edilmiyor (tek sayfaya bakınca gayet normal görünüyor),
 * yalnız sayfalar arasında geçerken belli oluyor — yani tam da sınavın
 * yakalaması gereken cinsten bir kusur.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { kontrol, bitir } from "./yardim.mjs";

const KOK = new URL("../src/app", import.meta.url).pathname;

/* Kiosk, giriş, kurulum ve oynatıcı BİLEREK dışarıda: onlar kokpit değil,
   okuma/tablet yüzeyi (globals.css aynı istisnayı sayıyor). */
const HARIC = ["kiosk", "giris", "kurulum", "oyna", "ziyaretci"];
/** Gövde genişliğini belirleyen sınıflar — dar yardımcı kutular değil. */
const GENIS = /className="[^"]*\bmax-w-(3xl|4xl|5xl|6xl)\b/;

function dosyalar(klasor) {
  const cikti = [];
  for (const ad of readdirSync(klasor)) {
    const yol = join(klasor, ad);
    if (statSync(yol).isDirectory()) {
      if (!HARIC.includes(ad)) cikti.push(...dosyalar(yol));
    } else if (ad.endsWith(".tsx")) cikti.push(yol);
  }
  return cikti;
}

const sapanlar = dosyalar(KOK).filter((y) => GENIS.test(readFileSync(y, "utf8")));

kontrol(
  sapanlar.length === 0,
  sapanlar.length === 0
    ? "hiçbir kokpit sayfası kendi genişliğini dayatmıyor"
    : `kendi genişliğini dayatan sayfa(lar): ${sapanlar.map((y) => y.replace(KOK, "")).join(", ")}`,
);

bitir("genişlik");
