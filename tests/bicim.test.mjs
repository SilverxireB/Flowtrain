/**
 * Kart metni biçimlendirme sınavı — `npm test`
 *
 * NEDEN: bu dil hazırlayanın yazdığı metinle işçinin gördüğü ekran arasındaki
 * tek çeviri katmanı. Yanlış ayrıştırma iki yönde de sessizdir: ya hazırlayan
 * vurgu yazar sahada düz görünür, ya da düz metin bir anda kalınlaşır. İkisi
 * de "eğitim yanlış okundu" demektir ve kimse hata mesajı görmez.
 */
import { bloklariCoz, parcalariCoz, duzMetin } from "../src/lib/bicimMetin.ts";
import { kontrol, esit, bitir } from "./yardim.mjs";

/* ── satır içi vurgu ─────────────────────────────────────────────────────── */
esit(parcalariCoz("düz metin"), [{ tip: "duz", metin: "düz metin" }], "vurgusuz satır tek parça");
esit(
  parcalariCoz("bu **çok** önemli"),
  [
    { tip: "duz", metin: "bu " },
    { tip: "kalin", metin: "çok" },
    { tip: "duz", metin: " önemli" },
  ],
  "ortadaki vurgu üç parçaya ayrılır",
);
esit(
  parcalariCoz("**ASLA** elle tutma"),
  [
    { tip: "kalin", metin: "ASLA" },
    { tip: "duz", metin: " elle tutma" },
  ],
  "satır başındaki vurgu",
);

/* KAPANMAMIŞ VURGU DÜZ KALIR. Yazarken `**` yazıp devam eden kişi cümlesinin
   yarısının bir anda kalınlaşmasını görmemeli. */
esit(
  parcalariCoz("yarım **vurgu"),
  [
    { tip: "duz", metin: "yarım " },
    { tip: "duz", metin: "vurgu" },
  ],
  "kapanmamış vurgu düz metindir",
);
esit(parcalariCoz(""), [{ tip: "duz", metin: "" }], "boş satır boş parça verir");

/* ── bloklar ─────────────────────────────────────────────────────────────── */
esit(bloklariCoz(""), [], "boş metin blok üretmez");
esit(bloklariCoz(undefined), [], "tanımsız metin blok üretmez");
esit(bloklariCoz("   \n  \n"), [], "yalnız boşluk blok üretmez");

const tekParagraf = bloklariCoz("bir satır\nikinci satır");
esit(tekParagraf.length, 1, "tek satır sonu YENİ PARAGRAF DEĞİLDİR");
esit(tekParagraf[0].tip, "paragraf", "düz satırlar paragraf olur");
esit(tekParagraf[0].satirlar.length, 2, "paragraf iki satır taşır");

esit(bloklariCoz("bir\n\niki").length, 2, "boş satır paragrafı böler");

const madde = bloklariCoz("- ilki\n- ikincisi");
esit(madde.length, 1, "ardışık maddeler tek blokta toplanır");
esit(madde[0].tip, "madde", "madde bloğu");
esit(madde[0].satirlar.length, 2, "iki madde");
esit(bloklariCoz("• kalın nokta").at(0).tip, "madde", "bullet karakteri de madde sayılır");

const sirali = bloklariCoz("1. önce\n2. sonra\n3) üçüncü");
esit(sirali.length, 1, "numaralı satırlar tek blokta");
esit(sirali[0].tip, "sirali", "sıralı blok");
esit(sirali[0].satirlar.length, 3, "üç adım; parantezli yazım da kabul");

const uyari = bloklariCoz("!! enerjiyi kes");
esit(uyari[0].tip, "uyari", "!! uyarı bloğu açar");
esit(uyari[0].satirlar[0][0].metin, "enerjiyi kes", "uyarı işareti metinden temizlenir");

/* Blok tipi DEĞİŞİNCE yeni blok açılmalı; yoksa madde ile paragraf aynı
   kutuya düşer ve kioskta liste düz metin gibi görünür. */
const karisik = bloklariCoz("giriş cümlesi\n- madde\n1. adım\n!! uyarı\nkapanış");
esit(
  karisik.map((b) => b.tip),
  ["paragraf", "madde", "sirali", "uyari", "paragraf"],
  "tip değişince blok değişir",
);

/* Vurgu blok içinde de çalışmalı — listedeki bir maddeyi vurgulamak en sık
   ihtiyaç. */
esit(bloklariCoz("- **kask** zorunlu")[0].satirlar[0][0].tip, "kalin", "madde içinde vurgu");

/* ── düz metne indirgeme ─────────────────────────────────────────────────── */
esit(duzMetin("**kalın** ve düz"), "kalın ve düz", "çıktıda biçim işareti kalmaz");
esit(duzMetin("- bir\n- iki"), "bir\niki", "madde işaretleri temizlenir");
esit(duzMetin("!! dikkat"), "dikkat", "uyarı işareti temizlenir");
esit(duzMetin(""), "", "boş metin boş kalır");
kontrol(!duzMetin("**a** 1. b\n!! c").includes("*"), "hiçbir biçim işareti sızmıyor");

bitir("biçim");
