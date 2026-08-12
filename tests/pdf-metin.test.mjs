/**
 * PDF METİN SÜZGECİ SINAVI — `npm test`
 *
 * NEDEN SINAVLI: gömülü yazı tipi ALT KÜMELENMİŞ ve içinde olmayan bir glif
 * jsPDF tarafından SESSİZCE ATILIYOR — hata yok, boşluk bile yok. Belge
 * "İş Güvenliği — Yüksekte" yerine "İş Güvenliği  Yüksekte" basıyor ve bunu
 * ancak birisi kâğıda bakıp fark ediyor.
 *
 * Bu sınav iki şeyi birden tutuyor:
 *  1. Süzgeç, yazı tipinde OLMAYAN her karakteri karşılıyor mu (saf mantık).
 *  2. Yazı tipi dosyasında gerçekten hangi kod noktaları var (cmap okunuyor).
 *
 * İKİNCİSİ ASIL DEĞERLİ: yazı tipi bir gün tam kümeyle yeniden üretilirse
 * sınav "artık gerek yok" diye söyleyecek; ya da tersine, alt küme daralırsa
 * yeni eksik glifi ilk fark eden burası olacak. Süzgeç tablosunu elle güncel
 * tutmaya çalışmak, tam olarak bu sınavın engellediği şey.
 */
import { readFileSync } from "node:fs";
import { pdfGuvenliMetin } from "../src/lib/pdfYaziTipi.ts";
import { kontrol, esit, bitir } from "./yardim.mjs";

/* ── 1. Süzgecin kendisi ───────────────────────────────────────────────────
   Kaynak metinlerde geçen gerçek örneklerle. */

esit(pdfGuvenliMetin("İş Güvenliği — Yüksekte"), "İş Güvenliği - Yüksekte", "em dash tireye çevriliyor");
esit(pdfGuvenliMetin("2020–2024"), "2020-2024", "en dash tireye çevriliyor");
esit(pdfGuvenliMetin("Süzgeç yok — tüm kayıtlar."), "Süzgeç yok - tüm kayıtlar.", "künye satırı korunuyor");
esit(pdfGuvenliMetin("—"), "-", "boş hücre işareti kaybolmuyor (rapor.ts)");
esit(pdfGuvenliMetin("a → b"), "a > b", "ok işareti karşılanıyor");
esit(pdfGuvenliMetin("✓ tamam"), "+ tamam", "tik işareti karşılanıyor");

/* Bir metinde birden çok ve karışık geçiş. */
esit(
  pdfGuvenliMetin("Kaynak — Hat 1 → Montaj – vardiya"),
  "Kaynak - Hat 1 > Montaj - vardiya",
  "aynı metindeki birden çok karakter birlikte çevriliyor",
);

/* TÜRKÇE HARFLERE DOKUNULMAZ: süzgecin işi eksik glifi karşılamak, metni
   sadeleştirmek değil. Buraya `ş → s` gibi bir kural sızarsa belge Türkçe
   olmaktan çıkar. */
const TURKCE = "İıŞşĞğÇçÖöÜü · … ₺ ° «»";
esit(pdfGuvenliMetin(TURKCE), TURKCE, "Türkçe harfler ve yazı tipinde VAR OLAN işaretler dokunulmadan geçiyor");
esit(pdfGuvenliMetin(""), "", "boş metin boş kalıyor");
esit(pdfGuvenliMetin("düz metin"), "düz metin", "karşılığı olmayan metin değişmiyor");

/* ── 2. Yazı tipi gerçekte neyi basabiliyor ────────────────────────────────
   cmap (format 4) okunup süzgeç tablosuyla karşılaştırılıyor. */

function kodNoktalari(yol) {
  const b = readFileSync(yol);
  const tabloSayisi = b.readUInt16BE(4);
  let cmapOfs = 0;
  for (let i = 0; i < tabloSayisi; i++) {
    const o = 12 + i * 16;
    if (b.toString("ascii", o, o + 4) === "cmap") cmapOfs = b.readUInt32BE(o + 8);
  }
  if (!cmapOfs) return null;

  const altSayi = b.readUInt16BE(cmapOfs + 2);
  let f4 = 0;
  for (let i = 0; i < altSayi; i++) {
    const o = cmapOfs + 4 + i * 8;
    const alt = cmapOfs + b.readUInt32BE(o + 4);
    if (b.readUInt16BE(alt) === 4) f4 = alt;
  }
  if (!f4) return null;

  const segX2 = b.readUInt16BE(f4 + 6);
  const seg = segX2 / 2;
  const sonlar = f4 + 14;
  const baslar = sonlar + segX2 + 2;
  const kume = new Set();
  for (let i = 0; i < seg; i++) {
    const son = b.readUInt16BE(sonlar + i * 2);
    const bas = b.readUInt16BE(baslar + i * 2);
    if (bas === 0xffff) continue;
    for (let c = bas; c <= son && c !== 0xffff; c++) kume.add(c);
  }
  return kume;
}

/** Süzgecin karşıladığı karakterler — tablo değişirse burası da değişmeli. */
const KARSILANAN = [
  ["—", 0x2014],
  ["–", 0x2013],
  ["‑", 0x2011],
  ["→", 0x2192],
  ["✓", 0x2713],
];

/** Belgelerde kullanılan ve yazı tipinde OLMASI gereken karakterler. */
const GEREKENLER = [
  ["İ", 0x130],
  ["ı", 0x131],
  ["ş", 0x15f],
  ["ğ", 0x11f],
  ["ç", 0xe7],
  ["ö", 0xf6],
  ["ü", 0xfc],
  ["·", 0xb7],
  ["…", 0x2026],
];

for (const dosya of ["Regular", "Bold"]) {
  const kume = kodNoktalari(`public/fonts/PlusJakartaSans-${dosya}.ttf`);
  kontrol(!!kume && kume.size > 0, `${dosya}: cmap okundu (${kume ? kume.size : 0} kod noktası)`);
  if (!kume) continue;

  /* Türkçe harfler OLMAK ZORUNDA — bu yazı tipinin var olma sebebi. */
  for (const [ad, kod] of GEREKENLER) {
    kontrol(kume.has(kod), `${dosya}: '${ad}' yazı tipinde var (gömmenin sebebi)`);
  }

  /* Süzgeç tablosu ile gerçek ALT KÜME uyuşuyor mu?
     Bir karakter yazı tipine sonradan girerse süzgeçten çıkarılabilir; sınav
     bunu haber versin diye kontrol tersten de yazıldı. */
  for (const [ad, kod] of KARSILANAN) {
    kontrol(
      !kume.has(kod),
      kume.has(kod)
        ? `${dosya}: '${ad}' ARTIK yazı tipinde var — pdfYaziTipi.ts'teki karşılık tablosundan çıkarılabilir`
        : `${dosya}: '${ad}' yazı tipinde yok, süzgeç onu karşılıyor`,
    );
  }
}

/* ── 3. Kaynakta kalan tuzak var mı ────────────────────────────────────────
   Ziyaretçi defteri bir zamanlar gömme kodunun kendi kopyasını taşıyordu ve
   süzgeç ortak kapıda kurulduğu için o belgede hiç çalışmıyordu. Aynı ayrılık
   tekrar doğarsa kimse fark etmez. */
const ziyaretci = readFileSync("src/lib/ziyaretciPdf.ts", "utf8");
kontrol(
  /from "\.\/pdfYaziTipi"/.test(ziyaretci),
  "ziyaretciPdf ortak yazı tipi kapısını kullanıyor (kendi kopyasını değil)",
);
kontrol(
  !/addFileToVFS/.test(ziyaretci),
  "ziyaretciPdf yazı tipini kendisi gömmüyor",
);

bitir("pdf metin");
