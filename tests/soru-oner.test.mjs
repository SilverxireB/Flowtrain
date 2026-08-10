/**
 * Karttan soru önerisi sınavı — `npm test`
 *
 * NEDEN: öneri hazırlayanın önüne "hazır soru" diye düşüyor ve insan hazır
 * gelene az bakar. Kalıp bozulursa ürün yanlış cevap anahtarlı bir sınav
 * ÖNERİR; hazırlayan onaylar, işçi doğru bildiği sorudan kalır. Bu yüzden
 * burada asıl korunan şey "soru üretilmesi" değil, üretilenin DOĞRU olması.
 */
import { sorulariOner } from "../src/lib/soruOner.ts";
import { kontrol, esit, bitir } from "./yardim.mjs";

const kart = (y) => ({
  id: "s1",
  egitimId: "e1",
  sira: 1,
  tip: "kural",
  baslik: "",
  metin: "",
  asgariSure: 8,
  ...y,
});

/* ── adım → sıralama ─────────────────────────────────────────────────────── */
{
  const o = sorulariOner([
    kart({ tip: "adim", baslik: "Düşme olursa", metin: "1. Hattı durdur\n2. Kişiyi kımıldatma\n3. Amiri ara" }),
  ]);
  esit(o.length, 1, "adım kartından bir soru önerilir");
  esit(o[0].tip, "siralama", "adım kartı SIRALAMA sorusu üretir");
  esit(
    o[0].secenekler,
    ["Hattı durdur", "Kişiyi kımıldatma", "Amiri ara"],
    "numaralandırma temizlenir, sıra KARTTAKİ sırayla saklanır",
  );
  /* `siralamaDogruMu` kimliğe bakıyor: şıklar doğru sırada durmalı. */
  esit(o[0].dogru, [0, 1, 2], "doğru cevap kimlik sırasıdır");
}

esit(sorulariOner([kart({ tip: "adim", metin: "Tek adım" })]).length, 0, "tek adımlık karttan sıralama sorusu çıkmaz");

/* ── yap/yapma → doğru-yanlış ────────────────────────────────────────────── */
{
  const o = sorulariOner([
    kart({
      tip: "yapYapma",
      baslik: "Kemer nasıl bağlanır",
      metin: "Kancayı bel hizasının üstüne tak.",
      metinKarsi: "Kancayı korkuluğa takma.",
    }),
  ]);
  esit(o[0].tip, "dogruYanlis", "yap/yapma kartı doğru-yanlış üretir");
  esit(o[0].metin, "Kancayı korkuluğa takma", "ifade KARŞI kolondan alınır");
  esit(o[0].dogru, [1], "karşı kolondaki davranış YANLIŞ olarak işaretlenir");
}

/* ── sayı vurgusu → çoktan seçmeli ───────────────────────────────────────── */
{
  const o = sorulariOner([kart({ tip: "sayiVurgu", baslik: "Kemer", metin: "2 metre | emniyet kemeri sınırı" })]);
  esit(o[0].tip, "coktanSecmeli", "sayı kartı çoktan seçmeli üretir");
  esit(o[0].secenekler[0], "2 metre", "doğru şık karttaki sayıdır");
  esit(o[0].dogru, [0], "doğru şık işaretli");
  kontrol(
    o[0].secenekler.slice(1).every((s) => /metre/.test(s)),
    "çeldiriciler BİRİMİ korur (birimsiz şık gözle ayırt ediliyordu)",
  );
  kontrol(new Set(o[0].secenekler).size === o[0].secenekler.length, "şıklar birbirini tekrar etmez");
}

esit(
  sorulariOner([kart({ tip: "sayiVurgu", metin: "sıfır | anlamsız" })]).length,
  0,
  "sayı okunamıyorsa öneri üretilmez (uydurma çeldirici yok)",
);

/* ── kontrol listesi → çoklu seçim, çeldirici BAŞKA karttan ──────────────── */
{
  const o = sorulariOner([
    kart({ id: "s1", tip: "kontrolListesi", baslik: "Platform öncesi", metin: "Korkuluk sağlam mı\nAyak tahtası yerinde mi" }),
    kart({ id: "s2", tip: "kural", baslik: "Vardiya listesi asılır", metin: "Vardiya listesi panoya asılır" }),
  ]);
  const coklu = o.find((x) => x.tip === "cokluSecim");
  esit(coklu.dogru, [0, 1], "karttaki maddeler doğru şıklardır");
  kontrol(
    coklu.secenekler.length > 2 && coklu.secenekler.slice(2).some((s) => s.includes("Vardiya")),
    "çeldirici BAŞKA kartın gerçek cümlesinden gelir",
  );
}

/* ── karşılaştırma → eşleştirme ──────────────────────────────────────────── */
{
  const o = sorulariOner([
    kart({ tip: "karsilastirma", baslik: "Doğru ve yanlış", metin: "Durum | Yapılacak\nYangın | Alarmı çal\nDüşme | Hattı durdur" }),
  ]);
  esit(o[0].tip, "eslestirme", "karşılaştırma tablosu eşleştirme üretir");
  kontrol(o[0].secenekler.every((s) => s.includes(" | ")), "her şık `sol | sağ` çiftidir");
  esit(o[0].secenekler.length, 2, "başlık satırı çift sayılmaz");
}

/* ── kopya üretmez ───────────────────────────────────────────────────────── */
{
  const sayfalar = [kart({ tip: "yapYapma", metin: "Doğru davranış", metinKarsi: "Kancayı korkuluğa takma." })];
  const ilk = sorulariOner(sayfalar);
  const ikinci = sorulariOner(sayfalar, [{ tip: ilk[0].tip, metin: ilk[0].metin }]);
  esit(ikinci.length, 0, "zaten var olan soru ikinci kez önerilmez");
}

/* ── boş karttan soru çıkmaz ─────────────────────────────────────────────── */
esit(sorulariOner([kart({ tip: "kural", baslik: "", metin: "" })]).length, 0, "boş karttan soru önerilmez");
esit(sorulariOner([kart({ tip: "video", metin: "x" })]).length, 0, "video kartı için kalıp yok");

/* ── güvene göre sıralama ────────────────────────────────────────────────── */
{
  const o = sorulariOner([
    kart({ id: "a", tip: "kural", metin: "Sahaya baretsiz girilmez." }),
    kart({ id: "b", tip: "adim", metin: "1. Dur\n2. Bak\n3. Geç" }),
  ]);
  kontrol(o[0].guven <= o[o.length - 1].guven, "yüksek güvenli öneri listenin başında");
}

/* ── kaynak kart taşınır ─────────────────────────────────────────────────── */
esit(
  sorulariOner([kart({ id: "s7", tip: "adim", metin: "1. Bir\n2. İki" })])[0].kaynakSayfaId,
  "s7",
  "öneri hangi karttan çıktığını taşır",
);

bitir("soru önerisi");
