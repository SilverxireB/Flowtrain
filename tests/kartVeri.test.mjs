/**
 * Yeni kart tiplerinin veri dili sınavı — `npm test`
 *
 * NEDEN: beş yeni kart tipi veritabanına tek sütun eklemeden, mevcut
 * `metin` / `metinKarsi` / `gorselIdler` alanları üzerinde küçük bir satır
 * diliyle çalışıyor. Dil yanlış okunursa kart sessizce boş ya da yanlış
 * çizilir — hazırlayan doğru yazdığını sanır, sahada başka bir şey görünür.
 */
import {
  satirlar,
  kontrolMaddeleri,
  karsilastirmaTablosu,
  sayiVurgulari,
  onceSonra,
} from "../src/lib/kartVeri.ts";
import { kontrol, esit, bitir } from "./yardim.mjs";

/* ── satır ayırma ────────────────────────────────────────────────────────── */
esit(satirlar("a\nb"), ["a", "b"], "satırlara bölünür");
esit(satirlar("a\r\nb"), ["a", "b"], "Windows satır sonu da okunur");
esit(satirlar("a\n\n  \nb"), ["a", "b"], "boş satırlar atılır");
esit(satirlar("  a  "), ["a"], "kenar boşlukları kırpılır");
esit(satirlar(undefined), [], "tanımsız metin boş liste");

/* ── kontrol listesi ─────────────────────────────────────────────────────── */
esit(kontrolMaddeleri("kask\neldiven").length, 2, "her satır bir madde");
esit(kontrolMaddeleri("- kask")[0].metin, "kask", "elle yazılan tire temizlenir");
esit(kontrolMaddeleri("• kask")[0].metin, "kask", "bullet de temizlenir");

/* ── karşılaştırma tablosu ───────────────────────────────────────────────── */
const t = karsilastirmaTablosu("Doğru | Yanlış\nkask tak | başı açık\ngözlük tak | gözlük baret üstünde");
esit(t.basliklar, ["Doğru", "Yanlış"], "İLK SATIR sütun başlığıdır");
esit(t.satirlar.length, 2, "başlık satırı gövdeye karışmaz");
esit(t.satirlar[0], ["kask tak", "başı açık"], "satır ikiye bölünür");

/* Ayırıcı yoksa sağ kolon BOŞ kalır — satır kaybolmaz. Kaybolsaydı hazırlayan
   yazdığı satırın nereye gittiğini anlamazdı. */
esit(karsilastirmaTablosu("Başlık\ntek parça").satirlar[0], ["tek parça", ""], "ayırıcısız satır solda durur");
esit(karsilastirmaTablosu("").satirlar.length, 0, "boş metin boş tablo");
esit(karsilastirmaTablosu("").basliklar, ["", ""], "boş tabloda başlık da boş");

/* İçerikte ikinci bir `|` varsa YALNIZ İLKİ ayırır: "A | B | C" iki kolonlu
   bir tabloda üçüncü kolon değil, sağ kolonun içeriğidir. */
esit(karsilastirmaTablosu("B1 | B2\na | b | c").satirlar[0], ["a", "b | c"], "yalnız ilk ayırıcı böler");

/* ── sayı vurgusu ────────────────────────────────────────────────────────── */
esit(sayiVurgulari("3 sn | düşme süresi")[0], { sayi: "3 sn", etiket: "düşme süresi" }, "ayırıcılı yazım");
esit(sayiVurgulari("3 saniyede düşer")[0], { sayi: "3", etiket: "saniyede düşer" }, "doğal yazım da okunur");
esit(sayiVurgulari("12")[0], { sayi: "12", etiket: "" }, "yalnız rakam etiketsiz durur");
esit(sayiVurgulari("1 | a\n2 | b").length, 2, "her satır bir vurgu");

/* ── önce / sonra ────────────────────────────────────────────────────────── */
const os = onceSonra({ gorselIdler: ["a.png", "b.png"], metin: "bozuk", metinKarsi: "düzeltilmiş" });
esit(os.onceId, "a.png", "ilk görsel önce");
esit(os.sonraId, "b.png", "ikinci görsel sonra");
esit(os.onceYazi, "bozuk", "sol alt yazı");
esit(os.sonraYazi, "düzeltilmiş", "sağ alt yazı");

/* KART TİPİ DEĞİŞTİRİLMİŞ OLABİLİR: tekil `gorselId` ile kaydedilmiş eski bir
   kart bu tipe çevrilince görselini KAYBETMEMELİ. */
esit(onceSonra({ gorselId: "eski.png" }).onceId, "eski.png", "tekil görsel ilk yuvaya düşer");
esit(onceSonra({ gorselId: "eski.png" }).sonraId, undefined, "ikinci yuva boş kalır");
esit(onceSonra({}).onceId, undefined, "görselsiz kart çökmez");
kontrol(onceSonra({}).onceYazi === "", "yazısız kart boş dize verir, undefined değil");

bitir("kart verisi");
