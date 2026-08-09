/**
 * ADAPTÖR SINIRI SINAVI — `npm test`
 *
 * NEDEN: "çekirdek personelin nereden geldiğini bilmez" yazılı bir kural ama
 * kural elle tutulmuyor, sınavla tutuluyor. Sınırın aşınması her zaman aynı
 * biçimde başlar: bir ekran "sadece şu bilgiyi göstermek için" somut adaptörü
 * doğrudan çağırır, sonra bir tane daha, ve OPM adaptörü eklendiğinde o
 * çağrılar yanlış kaynağa bakıp SESSİZCE yanlış sonuç verir.
 *
 * Aynı dosya, ürünün diğer sessiz kurallarını da bekçiler.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { kontrol, bitir } from "./yardim.mjs";

function dosyalar(kok, uzantilar = [".ts", ".tsx"]) {
  const cikti = [];
  for (const ad of readdirSync(kok)) {
    const yol = join(kok, ad);
    if (statSync(yol).isDirectory()) cikti.push(...dosyalar(yol, uzantilar));
    else if (uzantilar.some((u) => ad.endsWith(u))) cikti.push(yol);
  }
  return cikti;
}

const kaynaklar = dosyalar("src").map((yol) => ({ yol, metin: readFileSync(yol, "utf8") }));

/* ── 1. Somut adaptörler doğrudan çağrılmaz ────────────────────────────────
   İzinli tek yer `ayarlar/page.tsx`: "kurulumun gerçeği" satırları dosya
   yollarını gösteriyor ve bu bilinçli bir istisna. */
const IZINLI_SOMUT = ["src/app/ayarlar/page.tsx", "src/lib/adaptorlar/"];
const somutKacaklar = kaynaklar.filter(
  (k) =>
    /adaptorlar\/(csvPersonel|dosyaKayit)/.test(k.metin) &&
    !IZINLI_SOMUT.some((i) => k.yol.replace(/\\/g, "/").includes(i)),
);
kontrol(
  somutKacaklar.length === 0,
  somutKacaklar.length === 0
    ? "hiçbir ekran somut adaptörü doğrudan çağırmıyor"
    : `somut adaptör kaçağı: ${somutKacaklar.map((k) => k.yol).join(", ")}`,
);

/* ── 2. Kiosk kokpit kimliği ARAMAZ ────────────────────────────────────────
   Ürünün var olma sebebi bu. Bir gün "burada da kapı olsun" diye `kapi()`
   eklenirse işçilerin hiçbiri giremez ve sebebi anlaşılmaz. */
const kioskEylem = kaynaklar.find((k) => k.yol.replace(/\\/g, "/").endsWith("src/app/kiosk/eylemler.ts"));
kontrol(!!kioskEylem, "kiosk eylemleri bulundu");
kontrol(kioskEylem && !/\bkapi\(/.test(kioskEylem.metin), "kiosk eylemleri rol kapısı ARAMIYOR (bilinçli)");

const kioskSayfa = kaynaklar.find((k) => k.yol.replace(/\\/g, "/").endsWith("src/app/kiosk/page.tsx"));
kontrol(kioskSayfa && !/\bkapi\(/.test(kioskSayfa.metin), "kiosk sayfası rol kapısı aramıyor");

/* ── 3. Cevap anahtarı istemciye inmez ─────────────────────────────────────
   `oturumBaslat` soruları `dogru` alanını çıkararak göndermeli. */
kontrol(
  kioskEylem && /dogru: _dogru, \.\.\.s/.test(kioskEylem.metin),
  "sınav soruları cevap anahtarı çıkarılarak gönderiliyor",
);

/* ── 4. Puan sunucuda hesaplanır ───────────────────────────────────────────
   İstemciden gelen bir `puan` alanı kaydedilirse ürünün sattığı şey çöker. */
kontrol(
  kioskEylem && /const p = puanla\(sorulan, gonderi\.cevaplar\)/.test(kioskEylem.metin),
  "puan sunucuda, sunucunun kurduğu soru setiyle hesaplanıyor",
);
kontrol(
  kioskEylem && !/gonderi\.puan/.test(kioskEylem.metin),
  "istemciden gelen puan alanı KULLANILMIYOR",
);

/* ── 5. Yayınlama alanları hazırlayana kapalı ──────────────────────────────
   `durum`/`onaylayan`/`surum` beyaz listede olursa dört göz kuralı düşer. */
const eylemler = kaynaklar.find((k) => k.yol.replace(/\\/g, "/").endsWith("src/app/eylemler.ts"));
const beyazListe = eylemler?.metin.match(/const HAZIRLAYAN_ALANLARI = \[(.*?)\]/s)?.[1] ?? "";
kontrol(beyazListe.length > 0, "hazırlayan alan beyaz listesi duruyor");
for (const yasak of ["durum", "onaylayan", "surum"]) {
  kontrol(!beyazListe.includes(`"${yasak}"`), `hazırlayan '${yasak}' alanını yazamaz`);
}

/* ── 5b. Yayındaki eğitim düzenlenemez ─────────────────────────────────────
   Alan beyaz listesi dört göz kuralını ALAN bazında kapatıyor; bu kapı da
   İÇERİK bazında kapatıyor. Biri olmadan diğeri yarım. */
kontrol(/function taslakMi\(/.test(eylemler?.metin ?? ""), "yayın kilidi yardımcısı duruyor");
for (const fn of [
  "egitimGuncelleEylem",
  "sayfaEkleEylem",
  "sayfaGuncelleEylem",
  "sayfaSilEylem",
  "sayfalariSiralaEylem",
  "sayfalariTopluEkleEylem",
  "soruEkleEylem",
  "soruGuncelleEylem",
  "soruSilEylem",
]) {
  const govde = eylemler?.metin.match(new RegExp(`export async function ${fn}\\([\\s\\S]*?\\n}`))?.[0] ?? "";
  kontrol(/taslakMi\(/.test(govde), `${fn} yayındaki eğitimi reddediyor`);
}

/* ── 5c. Sınav seti oturumda SABİT ────────────────────────────────────────
   Bitişte havuzdan yeniden üretilirse, arada havuz değişince kişi hiç
   görmediği sorulardan puanlanır. */
kontrol(
  kioskEylem && /sorulariKimlikle\(oturum\.sorulanSoruIdleri\)/.test(kioskEylem.metin),
  "puanlama oturumun sabitlenmiş soru setinden yapılıyor",
);

/* ── 6. Küçültücü tuzağı ───────────────────────────────────────────────────
   Parametre yakalayıp birden çok kez çağrılan yardımcı, SWC satır içine
   alırken serbest değişken bırakabiliyor (bkz. csv.ts notu). Kural yazılı;
   burada en azından bilinen kurbanın geri dönmediğine bakılır. */
const csv = kaynaklar.find((k) => k.yol.replace(/\\/g, "/").endsWith("src/lib/csv.ts"));
// Yorum satırları hariç, YALNIZ gövdeye bakılır: tuzağı anlatan açıklamanın
// kendisi eşleşip sınavı düşürüyordu.
const ayiriciGovde = csv?.metin.match(/export function ayiriciBul[\s\S]*?\n}/)?.[0] ?? "";
kontrol(ayiriciGovde.length > 0, "ayiriciBul bulundu");
kontrol(!/=>/.test(ayiriciGovde), "ayiriciBul kapanış içermiyor (küçültücü tuzağı)");

/* ── 7. Dış servis yok ─────────────────────────────────────────────────────
   Kapalı ağ kuralı: kodda dış alan adına giden bir istek olmamalı.

   XML AD ALANLARI İSTİSNA: `xmlns="http://www.w3.org/2000/svg"` bir adres
   değil, KİMLİKTİR — SVG'nin zorunlu parçası ve hiçbir tarayıcı onu indirmez.
   İstisna AÇIKÇA yazılıyor: eskiden bu dize regex'e "w3" rakam içerdiği için
   tesadüfen takılmıyordu, yani kural şans eseri geçiyordu. Şans, kuralın
   kendisi değildir. */
const AD_ALANI = /\b(?:xmlns|xmlns:[a-z]+)="https?:\/\/[^"]+"/gi;
const disCagrilar = kaynaklar.filter((k) =>
  /https?:\/\/(?!localhost|127\.0\.0\.1)[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}/i.test(k.metin.replace(AD_ALANI, "")),
);
kontrol(
  disCagrilar.length === 0,
  disCagrilar.length === 0
    ? "kaynakta dış alan adı yok (kapalı ağ)"
    : `dış alan adı geçen dosya: ${disCagrilar.map((k) => k.yol).join(", ")}`,
);

bitir("sinir");
