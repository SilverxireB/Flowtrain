/**
 * TABLO SIRALAMA SINAVI.
 *
 * İki tuzak ölçülüyor:
 *  1. TÜRKÇE HARMANLAMA — ham dize karşılaştırması Ç/Ğ/İ/Ö/Ş/Ü ile başlayan
 *     her adı listenin SONUNA sürüyor (Unicode kod noktası Z'den büyük).
 *     Personel listesinde bu, adların yarısını yanlış yere koyuyordu.
 *  2. BOŞ HÜCRE — yön ne olursa olsun sonda kalmalı. Ters çevirince boşlar
 *     başa yığılırsa "en yüksek puan" isteyen kullanıcı ekranın ilk yarısında
 *     puansız satır görüyor.
 *
 * Koşum: `node --experimental-strip-types tests/tablo-sirala.test.mjs`
 */
import { degerKarsilastir, tabloSirala, sonrakiSira } from "../src/lib/tabloSirala.ts";
import { kontrol, esit, bitir } from "./yardim.mjs";

/* ── 1. TÜRKÇE HARMANLAMA ─────────────────────────────────────────────────── */

const adlar = ["Zafer", "Çelik", "Ahmet", "Şule", "İlker", "Buse", "Öznur", "Gül"];
esit(
  tabloSirala(adlar, (a) => a, "artan"),
  ["Ahmet", "Buse", "Çelik", "Gül", "İlker", "Öznur", "Şule", "Zafer"],
  "Türkçe alfabe sırası (Ç, İ, Ö, Ş yerli yerinde)",
);
kontrol(degerKarsilastir("Çelik", "Zafer") < 0, "Ç harfi Z'den ÖNCE gelir");
kontrol(degerKarsilastir("İlker", "Zafer") < 0, "İ harfi Z'den ÖNCE gelir");
kontrol(degerKarsilastir("Öznur", "Pınar") < 0, "Ö harfi P'den ÖNCE gelir");

/* Büyük/küçük harf sıralamayı bölmemeli: aynı ad iki yazımla iki yere düşmez. */
esit(tabloSirala(["bora", "Ali", "Cem"], (a) => a, "artan"), ["Ali", "bora", "Cem"], "büyük/küçük harf ayrımı sıralamayı bölmüyor");

/* ── 2. BOŞ HÜCRE HER İKİ YÖNDE DE SONDA ──────────────────────────────────── */

const puanlar = [{ p: 80 }, { p: null }, { p: 100 }, { p: "" }, { p: 40 }, { p: undefined }];
esit(
  tabloSirala(puanlar, (r) => r.p, "artan").map((r) => r.p),
  [40, 80, 100, null, "", undefined],
  "artan: boşlar sonda",
);
esit(
  tabloSirala(puanlar, (r) => r.p, "azalan").map((r) => r.p),
  [100, 80, 40, null, "", undefined],
  "AZALAN: boşlar YİNE sonda (başa yığılmıyor)",
);

/* ── 3. sayı sayı gibi, metin metin gibi ──────────────────────────────────── */

esit(tabloSirala([10, 9, 100, 2], (n) => n, "artan"), [2, 9, 10, 100], "sayılar sayısal sıralanıyor");
/* Sicil METİNDİR ama sayı gibi okunmalı: `numeric` seçeneği "1003" < "1010"
   verir; ham dize karşılaştırması "1010" < "1003" derdi. */
esit(tabloSirala(["1010", "1003", "999"], (s) => s, "artan"), ["999", "1003", "1010"], "sayısal metin doğal sıralanıyor");
esit(tabloSirala([true, false, true], (b) => b, "artan"), [false, true, true], "mantıksal değer sıralanıyor");

/* ── 4. ÖZGÜN LİSTE BOZULMAZ ──────────────────────────────────────────────── */

const ozgun = ["c", "a", "b"];
const siraliCikti = tabloSirala(ozgun, (x) => x, "artan");
esit(ozgun, ["c", "a", "b"], "girdi listesi olduğu gibi kalıyor");
esit(siraliCikti, ["a", "b", "c"], "yeni liste sıralı dönüyor");

/* ── 5. tarih damgası metin olarak da doğru sıralanır ─────────────────────── */

esit(
  tabloSirala(
    ["2026-08-12T11:56:00Z", "2026-08-11T08:40:00Z", "2026-08-12T08:51:00Z"],
    (t) => t,
    "azalan",
  ),
  ["2026-08-12T11:56:00Z", "2026-08-12T08:51:00Z", "2026-08-11T08:40:00Z"],
  "ISO damga en yeniden eskiye",
);

/* ── 6. başlığa basma davranışı ───────────────────────────────────────────── */

esit(sonrakiSira({ sutun: "ad", yon: "artan" }, "bolum"), { sutun: "bolum", yon: "artan" }, "YENİ sütun artan başlar");
esit(sonrakiSira({ sutun: "ad", yon: "artan" }, "ad"), { sutun: "ad", yon: "azalan" }, "aynı sütun yön çevirir");
esit(sonrakiSira({ sutun: "ad", yon: "azalan" }, "ad"), { sutun: "ad", yon: "artan" }, "ikinci basış geri döner");

/* ── 7. tanımsız sütun listeyi ÇÖKERTMEZ ──────────────────────────────────── */

const alanSozlugu = { ad: (r) => r.ad };
const satirlar = [{ ad: "b" }, { ad: "a" }];
esit(
  tabloSirala(satirlar, (r) => alanSozlugu["olmayan"]?.(r), "artan").length,
  2,
  "bilinmeyen sütunda liste eksilmiyor (hepsi boş sayılır)",
);

bitir("tablo sıralama");
