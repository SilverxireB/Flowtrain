/**
 * Okunabilirlik sınavı — `npm test`
 *
 * NEDEN: bu uyarılar hazırlayanın yazdığı metne karışıyor. Eşik yanlış olursa
 * iki kötü sonuçtan biri çıkar: ya hiçbir şey uyarmaz (özellik yokmuş gibi), ya
 * her kart uyarır (liste gürültüye döner ve hazırlayan hepsini görmezden gelir).
 * Sayılar burada kilitli.
 */
import { kartOkunabilirligi, okumaUyarilari } from "../src/lib/okunabilirlik.ts";
import { kontrol, esit, bitir } from "./yardim.mjs";

const kart = (y) => ({ id: "s1", egitimId: "e1", sira: 1, tip: "kural", baslik: "B", metin: "", asgariSure: 8, ...y });

/* ── kısa metin uyarmaz ──────────────────────────────────────────────────── */
esit(kartOkunabilirligi(kart({ metin: "Sahaya baretsiz girilmez." })).length, 0, "kısa cümle uyarı üretmez");
esit(kartOkunabilirligi(kart({ metin: "" })).length, 0, "boş kart okuma uyarısı üretmez");

/* ── uzun cümle ──────────────────────────────────────────────────────────── */
{
  const uzun = "kelime ".repeat(30).trim() + ".";
  const u = kartOkunabilirligi(kart({ metin: uzun }));
  kontrol(u.some((x) => x.includes("sözcüklük cümle")), "25 sözcüğü aşan cümle uyarır");
}

/* Sınırın hemen altı uyarmamalı — eşik gevşek olursa her kart uyarır. */
esit(
  kartOkunabilirligi(kart({ metin: "kelime ".repeat(24).trim() + "." })).filter((x) => x.includes("cümle")).length,
  0,
  "24 sözcüklük cümle uyarmaz (eşik gürültü yapmıyor)",
);

/* ── cümle bölme: kısaltma cümle sonu sayılmaz ───────────────────────────── */
{
  /* "vb." ortada geçiyor; yanlış bölünürse iki kısa cümle sanılır ve uzun
     cümle uyarısı KAÇAR. */
  const m = "Bu kartta baret gözlük eldiven vb. ekipmanların hepsi " + "ayrıntılı ".repeat(20) + "anlatılır.";
  kontrol(
    kartOkunabilirligi(kart({ metin: m })).some((x) => x.includes("cümle")),
    "kısaltmadaki nokta cümleyi bölmez (uzun cümle kaçmıyor)",
  );
}

/* ── uzun kart ───────────────────────────────────────────────────────────── */
{
  /* Her cümle kısa ama kart uzun: ayrı bir kusur, ayrı uyarı. */
  const m = Array.from({ length: 50 }, () => "Kısa cümle burada.").join("\n");
  kontrol(kartOkunabilirligi(kart({ metin: m })).some((x) => x.includes("ikiye bölmek")), "120 sözcüğü aşan kart uyarır");

  /* SINIRIN KENDİSİ uyarmaz — "aşarsa" dedik, "ulaşırsa" değil. 40×3 = 120. */
  const tamSinir = Array.from({ length: 40 }, () => "Kısa cümle burada.").join("\n");
  esit(
    kartOkunabilirligi(kart({ metin: tamSinir })).filter((x) => x.includes("ikiye bölmek")).length,
    0,
    "tam 120 sözcük uyarmaz (eşik aşılmalı)",
  );
}

/* ── bağıran satır ───────────────────────────────────────────────────────── */
kontrol(
  kartOkunabilirligi(kart({ metin: "BU SATIR TAMAMEN BÜYÜK HARFLE YAZILMIŞ VE UZUNDUR" })).some((x) =>
    x.includes("büyük harf"),
  ),
  "uzun ve tamamı büyük harf satır uyarır",
);
esit(
  kartOkunabilirligi(kart({ metin: "DİKKAT" })).length,
  0,
  "kısa büyük harfli vurgu uyarmaz (DİKKAT yazmak suç değil)",
);

/* ── karşı kolon da okunur ───────────────────────────────────────────────── */
kontrol(
  kartOkunabilirligi(kart({ tip: "yapYapma", metin: "Kısa.", metinKarsi: "kelime ".repeat(30).trim() + "." })).length > 0,
  "yap/yapma kartının KARŞI kolonu da ölçülür",
);

/* ── kart başına tek satır ───────────────────────────────────────────────── */
{
  const kotu = kart({ id: "x", metin: "KELIME ".repeat(40).trim() + "." });
  esit(okumaUyarilari([kotu]).length, 1, "üç kusurlu kart listede TEK satır tutar (liste gürültüye dönmesin)");
  esit(okumaUyarilari([kotu])[0].sayfaId, "x", "uyarı hangi karta ait olduğunu taşır");
}

esit(okumaUyarilari([]).length, 0, "kart yoksa uyarı yok");

bitir("okunabilirlik");
