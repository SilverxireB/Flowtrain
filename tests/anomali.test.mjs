/**
 * Anomali tespiti sınavı — `npm test`
 *
 * NEDEN: ürünün sattığı şey KAYIT. Amir tableti 12 kişiyi 4 dakikada
 * "tamamlanmış" gösterebiliyorsa elde sahte yasal kayıt olur. Bu sınav, o
 * deseni yakalayan mantığın hem YAKALADIĞINI hem MASUM durumu suçlamadığını
 * ölçer — yanlış suçlama ürünü ilk haftada çöpe attırır.
 */
import { beklenenSure, gecenSure, hizliMi, gozetenOzetleri, anomaliMetni } from "../src/lib/anomali.ts";
import { kontrol, esit, bitir } from "./yardim.mjs";

const sayfalar = [{ asgariSure: 8 }, { asgariSure: 12 }, { asgariSure: 10 }, { asgariSure: 0 }];
esit(beklenenSure(sayfalar), 30, "beklenen süre sayfaların asgari sürelerinin toplamı");
esit(beklenenSure([]), 0, "sayfasız eğitimin beklentisi yok");

const otr = (sureler, gozeten = "amir1", bitis = "2026-08-06T10:00:00Z") => ({
  sayfaSureleri: sureler,
  gozeten,
  bitis,
});

esit(gecenSure(otr({ a: 10, b: 20 })), 30, "geçen süre toplanır");
esit(gecenSure({ sayfaSureleri: {} }), 0, "boş oturumun süresi 0");

kontrol(hizliMi(otr({ a: 5, b: 5 }), 30), "beklenenin yarısından azı hızlı");
kontrol(!hizliMi(otr({ a: 15, b: 15 }), 30), "beklenen kadar süre hızlı değil");
kontrol(!hizliMi(otr({ a: 1 }), 0), "beklenti yoksa hiçbir şey hızlı sayılmaz");
// Tam sınırda: yarısı 'hızlı' DEĞİL. Sınırı içeri almak, dürüst ama seri
// çalışan kişiyi işaretler.
kontrol(!hizliMi(otr({ a: 15 }), 30), "tam yarı sınırı hızlı sayılmaz");

// ── gözeten özeti ───────────────────────────────────────────────────────────
const hizliOturumlar = Array.from({ length: 6 }, () => otr({ a: 2, b: 3 }, "amir-supheli"));
const durustOturumlar = Array.from({ length: 6 }, () => otr({ a: 15, b: 20 }, "amir-durust"));
const ozet = gozetenOzetleri([...hizliOturumlar, ...durustOturumlar], 30);

esit(ozet.length, 2, "iki gözeten özetlenir");
kontrol(ozet.find((o) => o.gozeten === "amir-supheli").supheli, "hep hızlı bitiren amir işaretlenir");
kontrol(!ozet.find((o) => o.gozeten === "amir-durust").supheli, "normal süre harcayan amir işaretlenmez");
esit(ozet.find((o) => o.gozeten === "amir-durust").ortalamaSure, 35, "ortalama süre hesaplanır");

// ASGARİ ADET: tek/iki hızlı oturum desen değildir. İnsan hızlı okumuş olabilir.
const azVeri = gozetenOzetleri([otr({ a: 1 }, "amir-az"), otr({ a: 1 }, "amir-az")], 30);
kontrol(!azVeri[0].supheli, "3'ten az oturumda kimse şüpheli işaretlenmez");

// Gözetensiz (kiosk) oturumlar bu tabloya HİÇ girmez — kiosk'ta gözeten yok,
// olmayan bir kişiyi suçlayamayız. (Nesne elle kuruluyor: `otr`un varsayılan
// parametreleri `undefined` geçince devreye girip sınavı geçersiz kılıyordu.)
esit(
  gozetenOzetleri([{ sayfaSureleri: { a: 1 }, bitis: "2026-08-06T10:00:00Z" }], 30).length,
  0,
  "gözetensiz oturum özete girmez",
);
// Bitmemiş oturum da girmez: yarıda bırakılan bir oturum "hızlı" değildir.
esit(gozetenOzetleri([{ sayfaSureleri: { a: 1 }, gozeten: "amir1" }], 30).length, 0, "bitmemiş oturum özete girmez");

esit(
  anomaliMetni({ oturumSayisi: 12, ortalamaSure: 90, beklenenSure: 360 }),
  "12 kayıt · ort. 2 dk · beklenen 6 dk",
  "panoda gösterilen cümle",
);

bitir("anomali");
