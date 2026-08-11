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
import { fileURLToPath } from "node:url";
import { kontrol, bitir } from "./yardim.mjs";

/* `fileURLToPath`, `new URL(...).pathname` DEĞİL.
   Windows'ta `pathname` yolu "/D:/Claude/..." diye verir; baştaki eğik çizgi
   `join` ile birleşince "D:\D:\Claude\..." olur ve sınav dosyayı hiç bulamadan
   ENOENT ile ölür. macOS/Linux'ta ikisi de aynı sonucu verdiği için kusur
   yalnız Windows'ta çıkıyor. */
const KOK = fileURLToPath(new URL("../src/app", import.meta.url));

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

/* ── TAM EKRAN KATMANLAR GÖVDEYE TAŞINMALI ────────────────────────────────
   GERÇEK HATA (11 Ağustos 2026, telefonda bildirildi): rehber çekmecesi
   ekranı değil, başlık şeridinin kutusunu kaplıyordu — 375×112 piksellik bir
   şerit. Altındaki editör formu rehberin metniyle iç içe görünüyordu.

   SEBEP: çekmece başlık şeridinin İÇİNDE çiziliyor ve o şeritte
   `backdrop-blur` var. `backdrop-filter`, tıpkı `transform` gibi, altındaki
   `position: fixed` öğeler için yeni bir kapsayıcı blok yaratıyor; `fixed`
   artık ekrana göre değil o kutuya göre çözülüyor.

   Kusur GÖZLE FARK EDİLMİYOR: geniş ekranda başlık şeridi zaten geniş,
   çekmece de makul görünüyor. Yalnız dar ekranda ortaya çıkıyor — yani tam da
   sınavın yakalaması gereken cinsten. Kural: tam ekran katman, ağaçtaki
   yerine güvenmek yerine gövdeye taşınır (`createPortal`). */
const KATMANLAR = ["../src/components/Rehber.tsx", "../src/components/ConfirmDialog.tsx"];
for (const goreli of KATMANLAR) {
  const yol = fileURLToPath(new URL(goreli, import.meta.url));
  const metin = readFileSync(yol, "utf8");
  const tamEkran = /className="fixed inset-0/.test(metin);
  if (!tamEkran) continue;
  kontrol(
    /createPortal\(/.test(metin),
    `${goreli.split("/").pop()}: tam ekran katman gövdeye taşınıyor (backdrop-blur'lu ata 'fixed'i kırar)`,
  );
}

bitir("genişlik");
