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

/** Süre artık SUNUCU damgalarından ölçülüyor; damga verilmezse sayfa
    sürelerine düşer (eski kayıtlar için geri uyumluluk). */
const otr = (sureler, gozeten = "amir1", bitis = "2026-08-06T10:00:00Z") => ({
  sayfaSureleri: sureler,
  gozeten,
  cihaz: "amir-tableti",
  bitis,
});

/** Sunucu damgalı oturum: sn cinsinden istenen süreyi üretir. */
const damgali = (saniye, gozeten = "amir1", cihaz = "amir-tableti") => ({
  sayfaSureleri: { a: 9999 },
  // `null` = gözeten yok. `undefined` geçmek varsayılan parametreyi devreye
  // sokup sınavı sessizce geçersiz kılıyordu (bu tuzağa ikinci düşüş).
  gozeten: gozeten === null ? undefined : gozeten,
  cihaz,
  baslangic: "2026-08-06T10:00:00.000Z",
  bitis: new Date(new Date("2026-08-06T10:00:00.000Z").getTime() + saniye * 1000).toISOString(),
});

esit(gecenSure(otr({ a: 10, b: 20 })), 30, "damga yoksa sayfa süreleri toplanır");
esit(gecenSure({ sayfaSureleri: {} }), 0, "boş oturumun süresi 0");

/* SUNUCU DAMGASI KAZANIR: sahteciliği ölçen sayıyı, sahteciliği yapan tarafın
   göndermesi ürünün tek telafi edici kontrolünü işe yaramaz kılıyordu. */
esit(gecenSure(damgali(120)), 120, "süre baslangic/bitis damgalarından ölçülür");
kontrol(
  gecenSure(damgali(120)) !== 9999,
  "istemciden gelen sayfa süreleri damgayı EZEMEZ",
);

kontrol(hizliMi(otr({ a: 5, b: 5 }), 30), "beklenenin yarısından azı hızlı");
kontrol(!hizliMi(otr({ a: 15, b: 15 }), 30), "beklenen kadar süre hızlı değil");
kontrol(!hizliMi(otr({ a: 1 }), 0), "beklenti yoksa hiçbir şey hızlı sayılmaz");
// Tam sınırda: yarısı 'hızlı' DEĞİL. Sınırı içeri almak, dürüst ama seri
// çalışan kişiyi işaretler.
kontrol(!hizliMi(otr({ a: 15 }), 30), "tam yarı sınırı hızlı sayılmaz");

// ── gözeten özeti ───────────────────────────────────────────────────────────
const hizliOturumlar = Array.from({ length: 6 }, () => damgali(5, "amir-supheli"));
const durustOturumlar = Array.from({ length: 6 }, () => damgali(35, "amir-durust"));
const ozet = gozetenOzetleri([...hizliOturumlar, ...durustOturumlar], 30);

esit(ozet.length, 2, "iki gözeten özetlenir");
kontrol(ozet.find((o) => o.gozeten === "amir-supheli").supheli, "hep hızlı bitiren amir işaretlenir");
kontrol(!ozet.find((o) => o.gozeten === "amir-durust").supheli, "normal süre harcayan amir işaretlenmez");
esit(ozet.find((o) => o.gozeten === "amir-durust").ortalamaSure, 35, "ortalama süre hesaplanır");

// ASGARİ ADET: tek/iki hızlı oturum desen değildir. İnsan hızlı okumuş olabilir.
const azVeri = gozetenOzetleri([damgali(1, "amir-az"), damgali(1, "amir-az")], 30);
kontrol(!azVeri[0].supheli, "3'ten az oturumda kimse şüpheli işaretlenmez");

/* GÖZETENSİZ (KİOSK) OTURUMLAR DA ÖLÇÜLÜR.
   Eskiden atlanıyorlardı — yani sahteciliğin EN KOLAY yolu (kiosk'ta
   başkasının sicilini girmek) panoda hiç görünmüyordu: tek telafi edici
   kontrol, korunması gereken deliği kapsamıyordu. */
const kiosklar = Array.from({ length: 4 }, () => damgali(3, null, "kiosk"));
const kioskOzet = gozetenOzetleri(kiosklar, 30);
esit(kioskOzet.length, 1, "gözetensiz oturumlar tek başlık altında toplanır");
kontrol(kioskOzet[0].gozeten.includes("gözetimsiz"), "başlık gözetimsiz olduğunu söyler");
kontrol(kioskOzet[0].supheli, "kiosk'taki hızlı desen de işaretlenir");

/* İPTAL edilen oturumlar ölçüye GİRMEZ. PIN'ini yanlış girip kilitlenen ya da
   yarıda bırakılıp kapatılan kayıtlar 20 saniyeliktir; sayılsalardı masum bir
   amir "hep hızlı bitiriyor" diye işaretlenirdi — modülün tam da kaçınmak
   istediği yanlış suçlama. */
const iptaller = Array.from({ length: 5 }, () => ({ ...damgali(4, "amir-temiz"), sonuc: "iptal" }));
const temizOzet = gozetenOzetleri([...iptaller, ...Array.from({ length: 3 }, () => damgali(40, "amir-temiz"))], 30);
esit(temizOzet[0].oturumSayisi, 3, "iptal oturumlar sayıma girmez");
kontrol(!temizOzet[0].supheli, "iptal kayıtları masum amiri şüpheli göstermez");

// Bitmemiş oturum girmez: yarıda bırakılan bir oturum "hızlı" değildir.
esit(gozetenOzetleri([{ sayfaSureleri: { a: 1 }, gozeten: "amir1" }], 30).length, 0, "bitmemiş oturum özete girmez");

esit(
  anomaliMetni({ oturumSayisi: 12, ortalamaSure: 90, beklenenSure: 360 }),
  "12 kayıt · ort. 2 dk · beklenen 6 dk",
  "panoda gösterilen cümle",
);

bitir("anomali");
