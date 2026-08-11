/**
 * PPTX ÇÖZÜMLEME SINAVI — `npm test`
 *
 * NEDEN SINAVLI: "yükle" kapısı ürünün en önemli tek özelliği (fabrikanın İSG
 * sunumu zaten var; yeniden yazdırmak uyarlamayı öldürür) ve bu yol SESSİZ
 * bozuluyor — ayrıştırıcı bir şey bulamazsa kullanıcı yalnız "içerik
 * bulunamadı" görür, sebebini kimse bilmez.
 *
 * SUNUM SINAVIN İÇİNDE KURULUYOR: depoya ikilik bir .pptx örneği koymak yerine
 * ZIP elle yazılıyor. Ayrıştırıcı sıkıştırmasız (yöntem 0) girdileri
 * desteklediği için deflate'e gerek yok; böylece sınav hem okunur hem de
 * gerçek bir arşiv üzerinde koşuyor.
 *
 * KAPSAM: başlık/gövde ayrımı, görsel ilişkisi, slayt SIRASI, boş slayt ve
 * "bu dosya sunum değil" kapısı.
 */
import { deflateRawSync } from "node:zlib";
import { pptxCoz } from "../src/lib/pptx.ts";
import { kontrol, esit, bitir } from "./yardim.mjs";

/* ── elle ZIP yazıcı ──────────────────────────────────────────────────────── */

const kodla = (m) => new TextEncoder().encode(m);

/** CRC-32 — ZIP girdi başlığı istiyor; tablosu bir kez kuruluyor. */
const CRC_TABLO = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(bayt) {
  let c = 0xffffffff;
  for (let i = 0; i < bayt.length; i++) c = CRC_TABLO[(c ^ bayt[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * Sıkıştırmasız (yöntem 0) ya da deflate (yöntem 8) ZIP üretir.
 *
 * İkisi de sınanıyor: gerçek PowerPoint dosyaları deflate kullanıyor ve
 * ayrıştırıcı onu tarayıcının `DecompressionStream`i ile açıyor — yalnız
 * sıkıştırmasız arşivle sınamak, asıl kullanılan yolu hiç ölçmemek olurdu.
 */
function zipYaz(dosyalar, { sikistir = false } = {}) {
  const parcalar = [];
  const merkez = [];
  let ofset = 0;

  for (const [ad, icerik] of dosyalar) {
    const ham = typeof icerik === "string" ? kodla(icerik) : icerik;
    const govde = sikistir ? new Uint8Array(deflateRawSync(ham)) : ham;
    const yontem = sikistir ? 8 : 0;
    const adBayt = kodla(ad);
    const crc = crc32(ham);

    const yerel = new DataView(new ArrayBuffer(30));
    yerel.setUint32(0, 0x04034b50, true);
    yerel.setUint16(4, 20, true);
    yerel.setUint16(6, 0, true);
    yerel.setUint16(8, yontem, true);
    yerel.setUint32(14, crc, true);
    yerel.setUint32(18, govde.length, true);
    yerel.setUint32(22, ham.length, true);
    yerel.setUint16(26, adBayt.length, true);
    parcalar.push(new Uint8Array(yerel.buffer), adBayt, govde);

    const m = new DataView(new ArrayBuffer(46));
    m.setUint32(0, 0x02014b50, true);
    m.setUint16(4, 20, true);
    m.setUint16(6, 20, true);
    m.setUint16(10, yontem, true);
    m.setUint32(16, crc, true);
    m.setUint32(20, govde.length, true);
    m.setUint32(24, ham.length, true);
    m.setUint16(28, adBayt.length, true);
    m.setUint32(42, ofset, true);
    merkez.push(new Uint8Array(m.buffer), adBayt);

    ofset += 30 + adBayt.length + govde.length;
  }

  const merkezBoyut = merkez.reduce((n, p) => n + p.length, 0);
  const son = new DataView(new ArrayBuffer(22));
  son.setUint32(0, 0x06054b50, true);
  son.setUint16(8, dosyalar.length, true);
  son.setUint16(10, dosyalar.length, true);
  son.setUint32(12, merkezBoyut, true);
  son.setUint32(16, ofset, true);

  const hepsi = [...parcalar, ...merkez, new Uint8Array(son.buffer)];
  const toplam = hepsi.reduce((n, p) => n + p.length, 0);
  const cikti = new Uint8Array(toplam);
  let y = 0;
  for (const p of hepsi) {
    cikti.set(p, y);
    y += p.length;
  }
  return cikti;
}

/* ── örnek sunum ──────────────────────────────────────────────────────────── */

/** Başlık yer tutucusu (`type="title"`) + gövde metni olan bir slayt. */
const slayt = (baslik, satirlar, gorselRid) => `<?xml version="1.0"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
       xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
 <p:cSld><p:spTree>
  <p:sp><p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>
   <p:txBody><a:p><a:r><a:t>${baslik}</a:t></a:r></a:p></p:txBody></p:sp>
  <p:sp><p:nvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr>
   <p:txBody>${satirlar.map((m) => `<a:p><a:r><a:t>${m}</a:t></a:r></a:p>`).join("")}</p:txBody></p:sp>
  ${gorselRid ? `<p:pic><p:blipFill><a:blip r:embed="${gorselRid}"/></p:blipFill></p:pic>` : ""}
 </p:spTree></p:cSld></p:sld>`;

const rels = (girdiler) => `<?xml version="1.0"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${girdiler.map(([id, tip, hedef]) => `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${tip}" Target="${hedef}"/>`).join("\n")}
</Relationships>`;

/* Slayt SIRASI sunumun kendi listesinden gelir, dosya adından değil: bu yüzden
   ikinci slayt bilerek "slide9.xml" adını taşıyor ve listede önce geliyor.
   Ada göre sıralayan bir ayrıştırıcı burada yanılırdı. */
const SUNUM = `<?xml version="1.0"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
                xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
 <p:sldIdLst><p:sldId id="256" r:id="rId1"/><p:sldId id="257" r:id="rId2"/><p:sldId id="258" r:id="rId3"/></p:sldIdLst>
</p:presentation>`;

/** 1×1 saydam PNG — gerçek bayt, ayrıştırıcı türü uzantıdan çıkarıyor. */
const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00,
  0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00, 0x0a, 0x49,
  0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00,
  0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]);

const DOSYALAR = [
  ["ppt/presentation.xml", SUNUM],
  [
    "ppt/_rels/presentation.xml.rels",
    rels([
      ["rId1", "slide", "slides/slide1.xml"],
      ["rId2", "slide", "slides/slide9.xml"],
      ["rId3", "slide", "slides/slide2.xml"],
    ]),
  ],
  ["ppt/slides/slide1.xml", slayt("Yüksekte Çalışma", ["Emniyet kemeri takılır.", "Korkuluk kontrol edilir."], "rId5")],
  ["ppt/slides/_rels/slide1.xml.rels", rels([["rId5", "image", "../media/image1.png"]])],
  ["ppt/slides/slide9.xml", slayt("İkinci Slayt", ["Tek satır."])],
  ["ppt/slides/slide2.xml", slayt("", [])],
  ["ppt/media/image1.png", PNG],
];

/* ── 1. Sıkıştırmasız arşiv ───────────────────────────────────────────────── */

const sonuc = await pptxCoz(zipYaz(DOSYALAR));
esit(sonuc.slaytlar.length, 3, "üç slaydın üçü de okundu");
esit(sonuc.slaytlar[0].baslik, "Yüksekte Çalışma", "başlık yer tutucusundan çıkarıldı");
kontrol(
  sonuc.slaytlar[0].metin.includes("Emniyet kemeri takılır.") && sonuc.slaytlar[0].metin.includes("Korkuluk"),
  "gövde metninin satırları korundu",
);
kontrol(!sonuc.slaytlar[0].metin.includes("Yüksekte Çalışma"), "başlık gövde metnine İKİNCİ KEZ girmiyor");

/* SIRA SUNUMUN LİSTESİNDEN: dosya adı slide9 olmasına rağmen ikinci sırada. */
esit(sonuc.slaytlar[1].baslik, "İkinci Slayt", "slayt sırası sunumun kendi listesinden geliyor (dosya adından değil)");

esit(sonuc.slaytlar[0].gorseller.length, 1, "slayttaki görsel ilişkisiyle bulundu");
esit(sonuc.slaytlar[0].gorseller[0].ad, "ppt/media/image1.png", "görselin arşiv içindeki yolu doğru");
esit([...sonuc.slaytlar[0].gorseller[0].veri.slice(0, 4)], [0x89, 0x50, 0x4e, 0x47], "görselin BAYTLARI taşındı (PNG imzası)");
kontrol(/png/i.test(sonuc.slaytlar[0].gorseller[0].tur), "görselin türü uzantıdan çıkarıldı");

/* Boş slayt AYIKLANMIYOR — eleme kararı çağıranın (kart üretici) işi; burada
   yalnız ne varsa okunuyor. */
esit(sonuc.slaytlar[2].baslik, "", "boş slayt boş başlıkla geliyor");
esit(sonuc.slaytlar[2].gorseller.length, 0, "boş slaytta görsel yok");

/* ── 2. DEFLATE'li arşiv — gerçek PowerPoint dosyalarının yolu ────────────── */

const sikisik = await pptxCoz(zipYaz(DOSYALAR, { sikistir: true }));
esit(sikisik.slaytlar.length, 3, "deflate'li arşiv de okundu");
esit(sikisik.slaytlar[0].baslik, "Yüksekte Çalışma", "deflate'li arşivde başlık aynı");
esit(
  [...sikisik.slaytlar[0].gorseller[0].veri],
  [...PNG],
  "deflate'li arşivde görselin baytları birebir aynı",
);

/* ── 3. Sunum olmayan dosya NAZİKÇE reddedilir ────────────────────────────── */

let mesaj = "";
try {
  await pptxCoz(zipYaz([["okuma.txt", "merhaba"]]));
} catch (h) {
  mesaj = h.message;
}
kontrol(/sunum|PowerPoint/i.test(mesaj), `sunum olmayan arşiv anlaşılır hatayla reddediliyor (${mesaj})`);

let bosMesaj = "";
try {
  await pptxCoz(zipYaz([["ppt/presentation.xml", SUNUM]]));
} catch (h) {
  bosMesaj = h.message;
}
kontrol(/slayt/i.test(bosMesaj), `slaydı olmayan sunum anlaşılır hatayla reddediliyor (${bosMesaj})`);

bitir("pptx");
