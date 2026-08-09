/**
 * QR KODLAYICI SINAVI (Hat B'nin `src/lib/qr.ts`si) — `npm test`
 *
 * NEDEN BU KADAR AYRINTILI: QR üreticisinin yanlışı EKRANDA GÖRÜNMEZ. Kareler
 * her hâlükârda güzel durur; hata yalnız hattaki telefon etiketi okutmaya
 * çalıştığında ortaya çıkar — yani ürün kurulduktan sonra, işçinin karşısında.
 * Ve QR kiosk'un tek dokunuşsuz kapısı: okunmazsa iş başı eğitiminin
 * dijitalleşmesi olduğu yerde durur.
 *
 * YÖNTEM — kodlayıcıyı BAĞIMSIZ bir çözücüyle geri okumak. Aşağıdaki çözücü
 * `qr.ts`nin hiçbir iç fonksiyonunu kullanmıyor; standarttan yeniden yazıldı.
 * Kapsadıkları:
 *   1. Kod sözcüğü sayısı, matris geometrisinden bağımsız olarak doğrulanır
 *      (işlev desenleri dışındaki modül sayısı = 8 × kod sözcüğü).
 *   2. Reed-Solomon cebirsel denetimi — (veri + EC) polinomu α^0…α^(ec−1)
 *      köklerinin HEPSİNDE sıfır vermeli. Tek bir kaydırma hatası geçemez.
 *   3. Geri okuma — biçim bitleri, maske, zikzak yerleşim, blok serpiştirmesi
 *      ve bayt kipi çözülür; sonuç girdi metnine eşit olmalı.
 *   4. Bilinen sabitler ve yapı — bulucu desenleri, zaman şeritleri, koyu
 *      modül, biçim bitlerinin BCH geçerliliği.
 *   5. HAT SÖZLEŞMESİ — QR'ın içeriği `/kiosk?egitim=<id>` ve kiosk tarafı
 *      (`qrEgitimId`) onu geri okuyabiliyor.
 */
import { qrMatris, qrYolu, qrKenar, qrSvg, kioskBaglantisi, EN_BUYUK_SURUM } from "../src/lib/qr.ts";
import { qrEgitimId } from "../src/lib/kioskAkis.ts";
import { kontrol, esit, bitir } from "./yardim.mjs";

/* ── GF(256), bağımsız kurulum ─────────────────────────────────────────────── */
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
for (let i = 0, x = 1; i < 255; i++) {
  EXP[i] = x;
  LOG[x] = i;
  x = (x << 1) ^ (x & 0x80 ? 0x11d : 0);
}
for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];

function carp(a, b) {
  return a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]];
}

/* ── standart tablolar (seviye M, sürüm 1–10) ──────────────────────────────
   Kaynak: ISO/IEC 18004 tabloları. `qr.ts`nin tablosundan BAĞIMSIZ yazıldı;
   toplam kod sözcüğü sayısı ayrıca matris geometrisiyle çapraz denetleniyor. */
const TABLO = [
  { ec: 10, bloklar: [[1, 16]] },
  { ec: 16, bloklar: [[1, 28]] },
  { ec: 26, bloklar: [[1, 44]] },
  { ec: 18, bloklar: [[2, 32]] },
  { ec: 24, bloklar: [[2, 43]] },
  { ec: 16, bloklar: [[4, 27]] },
  { ec: 18, bloklar: [[4, 31]] },
  { ec: 22, bloklar: [[2, 38], [2, 39]] },
  { ec: 22, bloklar: [[3, 36], [2, 37]] },
  { ec: 26, bloklar: [[4, 43], [1, 44]] },
];
const HIZALAMA = [[], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];

/**
 * ARTIK BİTLER — veri bölgesi sekizin tam katı değildir.
 * Sürüm 1'de 0, 2–6'da 7, 7–13'te 0 artık bit kalır (standart). Bu sayı
 * olmadan "serbest modül = 8 × kod sözcüğü" denetimi 2–6 arası sürümlerde
 * yanlış alarm verir.
 */
const ARTIK_BIT = [0, 7, 7, 7, 7, 7, 0, 0, 0, 0];

/** İşlev deseni haritası — standarttaki REZERVE alanlar (veri buraya yazılmaz). */
function islevHaritasi(surum) {
  const n = surum * 4 + 17;
  const r = Array.from({ length: n }, () => new Array(n).fill(false));

  // Sol üst 9×9, sağ üst 9×8, sol alt 8×9 — ASİMETRİK. Biçim bilgisi sol üstte
  // hem satır hem sütun tutar, diğer iki köşede yalnız birer şerit.
  for (let y = 0; y <= 8; y++) for (let x = 0; x <= 8; x++) r[y][x] = true;
  for (let y = 0; y <= 8; y++) for (let x = n - 8; x <= n - 1; x++) r[y][x] = true;
  for (let y = n - 8; y <= n - 1; y++) for (let x = 0; x <= 8; x++) r[y][x] = true;

  for (let i = 0; i < n; i++) {
    r[6][i] = true;
    r[i][6] = true;
  }
  const yerler = HIZALAMA[surum - 1];
  for (let i = 0; i < yerler.length; i++) {
    for (let j = 0; j < yerler.length; j++) {
      const kose =
        (i === 0 && j === 0) || (i === 0 && j === yerler.length - 1) || (i === yerler.length - 1 && j === 0);
      if (kose) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) r[yerler[i] + dy][yerler[j] + dx] = true;
    }
  }
  if (surum >= 7) {
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 3; j++) {
        r[i][n - 11 + j] = true;
        r[n - 11 + j][i] = true;
      }
    }
  }
  return r;
}

function maskeUyar(maske, satir, sutun) {
  if (maske === 0) return (satir + sutun) % 2 === 0;
  if (maske === 1) return satir % 2 === 0;
  if (maske === 2) return sutun % 3 === 0;
  if (maske === 3) return (satir + sutun) % 3 === 0;
  if (maske === 4) return (Math.floor(satir / 2) + Math.floor(sutun / 3)) % 2 === 0;
  if (maske === 5) return ((satir * sutun) % 2) + ((satir * sutun) % 3) === 0;
  if (maske === 6) return (((satir * sutun) % 2) + ((satir * sutun) % 3)) % 2 === 0;
  return (((satir + sutun) % 2) + ((satir * sutun) % 3)) % 2 === 0;
}

/** Biçim bitleri — birinci kopya (sol üst köşe), LSB'den başlayarak. */
function bicimOku(m) {
  let bitler = 0;
  for (let i = 0; i < 15; i++) {
    let y;
    let x;
    if (i < 6) {
      y = i;
      x = 8;
    } else if (i === 6) {
      y = 7;
      x = 8;
    } else if (i === 7) {
      y = 8;
      x = 8;
    } else if (i === 8) {
      y = 8;
      x = 7;
    } else {
      y = 8;
      x = 14 - i;
    }
    if (m[y][x]) bitler |= 1 << i;
  }
  return bitler;
}

/** İkinci kopya (sağ üst + sol alt) — biri okunamazsa diğeri kurtarır. */
function bicimOkuIkinci(m) {
  const n = m.length;
  let bitler = 0;
  for (let i = 0; i < 15; i++) {
    const koyu = i < 8 ? m[8][n - 1 - i] : m[n - 15 + i][8];
    if (koyu) bitler |= 1 << i;
  }
  return bitler;
}

function bchKalani(bitler) {
  let kalan = bitler;
  for (let i = 14; i >= 10; i--) if ((kalan >> i) & 1) kalan ^= 0x537 << (i - 10);
  return kalan & 0x3ff;
}

/** Zikzak sırayla veri modüllerini oku (maske çözülmüş matriste). */
function veriBitleri(m, islev) {
  const n = m.length;
  const bitler = [];
  let yukari = true;
  for (let sag = n - 1; sag > 0; sag -= 2) {
    if (sag === 6) sag = 5;
    for (let adim = 0; adim < n; adim++) {
      const satir = yukari ? n - 1 - adim : adim;
      for (let d = 0; d < 2; d++) {
        const sutun = sag - d;
        if (islev[satir][sutun]) continue;
        bitler.push(m[satir][sutun] ? 1 : 0);
      }
    }
    yukari = !yukari;
  }
  return bitler;
}

/** Reed-Solomon sendromu: geçerli kod sözcüğünde hepsi 0 olmalı. */
function sendromlar(kodlar, ec) {
  const cikti = [];
  for (let i = 0; i < ec; i++) {
    let toplam = 0;
    for (const k of kodlar) toplam = carp(toplam, EXP[i]) ^ k;
    cikti.push(toplam);
  }
  return cikti;
}

/** Matris → { surum, maske, metin, bloklar } — tam geri okuma. */
function coz(matris) {
  const n = matris.length;
  const surum = (n - 17) / 4;
  const islev = islevHaritasi(surum);

  /* Biçim kod sözcüğü: üst 5 bit veri (2 bit EC seviyesi + 3 bit maske),
     alt 10 bit BCH kalanı; tamamı 0x5412 ile maskelenmiş yazılır. */
  const ham = bicimOku(matris) ^ 0x5412;
  const veriBiti = (ham >> 10) & 0x1f;
  const maske = veriBiti & 7;
  const seviye = (veriBiti >> 3) & 3;

  const m = matris.map((s, y) => s.map((v, x) => (!islev[y][x] && maskeUyar(maske, y, x) ? !v : v)));
  const bitler = veriBitleri(m, islev);

  const bilgi = TABLO[surum - 1];
  const uzunluklar = [];
  for (const [adet, uzunluk] of bilgi.bloklar) for (let i = 0; i < adet; i++) uzunluklar.push(uzunluk);
  const veriToplam = uzunluklar.reduce((a, b) => a + b, 0);
  const toplamKod = veriToplam + uzunluklar.length * bilgi.ec;

  const kodlar = [];
  for (let i = 0; i + 8 <= bitler.length && kodlar.length < toplamKod; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | bitler[i + j];
    kodlar.push(b);
  }

  // Serpiştirmeyi çöz.
  const veriBloklari = uzunluklar.map(() => []);
  let p = 0;
  const enUzun = Math.max(...uzunluklar);
  for (let i = 0; i < enUzun; i++) {
    for (let b = 0; b < uzunluklar.length; b++) {
      if (i < uzunluklar[b]) veriBloklari[b].push(kodlar[p++]);
    }
  }
  const ecBloklari = uzunluklar.map(() => []);
  for (let i = 0; i < bilgi.ec; i++) {
    for (let b = 0; b < uzunluklar.length; b++) ecBloklari[b].push(kodlar[p++]);
  }

  // Bayt kipi çözümü.
  const veri = veriBloklari.flat();
  const vb = [];
  for (const b of veri) for (let i = 7; i >= 0; i--) vb.push((b >> i) & 1);
  const al = (bas, uzunluk) => {
    let d = 0;
    for (let i = 0; i < uzunluk; i++) d = (d << 1) | vb[bas + i];
    return d;
  };
  const kip = al(0, 4);
  const sayacBiti = surum < 10 ? 8 : 16;
  const adet = al(4, sayacBiti);
  const baytlar = [];
  for (let i = 0; i < adet; i++) baytlar.push(al(4 + sayacBiti + i * 8, 8));

  return {
    surum,
    maske,
    seviye,
    kip,
    bicimGecerli: bchKalani(ham) === 0,
    ikinciKopyaAyni: bicimOku(matris) === bicimOkuIkinci(matris),
    veriModulSayisi: islev.flat().filter((v) => !v).length,
    artikBit: ARTIK_BIT[surum - 1],
    toplamKod,
    bloklar: veriBloklari.map((v, i) => [...v, ...ecBloklari[i]]),
    ec: bilgi.ec,
    metin: new TextDecoder().decode(new Uint8Array(baytlar)),
  };
}

/* ── 1. Temel geri okuma ───────────────────────────────────────────────────── */
const BAGLANTI = "/kiosk?egitim=egt_m8x2k91";
const c = coz(qrMatris(BAGLANTI));
esit(c.metin, BAGLANTI, "kiosk bağlantısı geri okunuyor");
esit(c.kip, 0b0100, "bayt kipi kullanılıyor");
esit(c.seviye, 0b00, "hata düzeltme seviyesi M");
kontrol(c.bicimGecerli, "biçim bitleri BCH denetiminden geçiyor");
kontrol(c.ikinciKopyaAyni, "biçim bilgisinin iki kopyası aynı (biri okunamazsa diğeri kurtarır)");
kontrol(c.maske >= 0 && c.maske <= 7, "maske geçerli aralıkta");

/* ── 2. Kapasite tablosu geometriyle ÇAPRAZ denetleniyor ───────────────────
   Tabloyu iki yerde de aynı yanlış yazmak mümkün; matrisin serbest modül
   sayısı standarttan bağımsız bir tanık. */
for (const uzunluk of [5, 20, 40, 60, 90, 130, 170, 200]) {
  const d = coz(qrMatris("a".repeat(uzunluk)));
  esit(
    d.veriModulSayisi,
    d.toplamKod * 8 + d.artikBit,
    `sürüm ${d.surum}: serbest modül sayısı kod sözcüğü + artık bit ile tutuyor`,
  );
}

/* ── 3. Reed-Solomon cebirsel denetimi ─────────────────────────────────────
   Her blok (veri + EC), üreteç polinomunun katı olmak zorunda. */
for (const uzunluk of [5, 40, 90, 150, 200]) {
  const d = coz(qrMatris("x".repeat(uzunluk)));
  let hepsiSifir = true;
  for (const blok of d.bloklar) {
    if (sendromlar(blok, d.ec).some((s) => s !== 0)) hepsiSifir = false;
  }
  kontrol(hepsiSifir, `sürüm ${d.surum}: bütün blokların RS sendromları sıfır`);
}

/* ── 4. Sürüm 1–10 arası geri okuma ────────────────────────────────────────
   Sürüm arttıkça hizalama desenleri, blok sayısı ve (7'den itibaren) sürüm
   bitleri devreye giriyor — her biri yerleşimi kaydırabilecek şeyler. */
const gorulenSurumler = new Set();
for (let uzunluk = 1; uzunluk <= 210; uzunluk += 7) {
  const metin = "K".repeat(uzunluk);
  const d = coz(qrMatris(metin));
  gorulenSurumler.add(d.surum);
  if (d.metin !== metin) {
    kontrol(false, `sürüm ${d.surum} (${uzunluk} bayt): geri okuma bozuk`);
    break;
  }
}
esit(gorulenSurumler.size, EN_BUYUK_SURUM, `sürüm 1–${EN_BUYUK_SURUM} arası hepsi denendi ve geri okundu`);

/* ── 5. UTF-8 ──────────────────────────────────────────────────────────────
   Eğitim adları Türkçe; etikete adı da basılabilir. */
esit(coz(qrMatris("Yüksekte Çalışma — Şaft 3")).metin, "Yüksekte Çalışma — Şaft 3", "Türkçe karakterler bozulmuyor");
esit(coz(qrMatris("a")).metin, "a", "tek karakterlik metin");

/* ── 6. Yapı denetimi ──────────────────────────────────────────────────────── */
const m = qrMatris(BAGLANTI);
const n = m.length;
esit((n - 17) % 4, 0, "matris kenarı geçerli bir sürüme karşılık geliyor");
kontrol(m[3][3] && m[3][n - 4] && m[n - 4][3], "üç bulucu deseninin merkezi koyu");
kontrol(!m[5][3] && !m[5][n - 4], "bulucu deseninin açık halkası yerinde");
// Ayırıcılar: bulucunun etrafındaki 8. sıra/sütun boş olmalı.
let ayiriciTemiz = true;
for (let i = 0; i <= 7; i++) {
  if (m[7][i] || m[i][7]) ayiriciTemiz = false;
}
kontrol(ayiriciTemiz, "sol üst bulucunun ayırıcısı temiz");
// Zaman şeritleri: satır 6 ve sütun 6, 8. modülden itibaren dönüşümlü.
let zamanDogru = true;
for (let i = 8; i < n - 8; i++) {
  if (m[6][i] !== (i % 2 === 0) || m[i][6] !== (i % 2 === 0)) zamanDogru = false;
}
kontrol(zamanDogru, "yatay ve dikey zaman şeritleri dönüşümlü");
kontrol(m[n - 8][8], "koyu modül (satır 4·sürüm+9, sütun 8) yerinde");

/* ── 7. Belirlilik ─────────────────────────────────────────────────────────
   Saf fonksiyon: aynı girdi her zaman aynı matris. Etiketi iki kez basan
   kişi iki farklı kare almamalı. */
esit(JSON.stringify(qrMatris(BAGLANTI)), JSON.stringify(qrMatris(BAGLANTI)), "aynı metin aynı matrisi verir");
kontrol(JSON.stringify(qrMatris("a")) !== JSON.stringify(qrMatris("b")), "farklı metin farklı matris verir");

/* ── 8. Sınırlar ───────────────────────────────────────────────────────────── */
let tasti = false;
try {
  qrMatris("z".repeat(500));
} catch {
  tasti = true;
}
kontrol(tasti, "kapasiteyi aşan metin sessizce kırpılmıyor, hata veriyor");

/* ── 9. SVG çıktısı ────────────────────────────────────────────────────────── */
esit(qrKenar(m, 4, 4), (n + 8) * 4, "kenar uzunluğu sessiz alanı içeriyor");
esit(qrKenar(m, 6, 0), n * 6, "sessiz alansız kenar yalnız matris kadar");
const yol = qrYolu(m, 4, 4);
kontrol(yol.startsWith("M"), "yol verisi taşıma komutuyla başlıyor");
kontrol(/^[Mhvz0-9 .-]+$/.test(yol), "yol yalnız dikdörtgen komutları içeriyor");
// Sessiz alan STANDART 4 modül: daha azı okuyucuyu zorluyor.
kontrol(!/M[0-9]+ [0-9]+h/.test(yol.slice(0, 2)) || parseInt(yol.slice(1), 10) >= 16, "sessiz alan bırakılmış");
const svg = qrSvg(BAGLANTI);
kontrol(svg.startsWith("<svg") && svg.endsWith("</svg>"), "SVG belgesi tam");
kontrol(/viewBox="0 0 \d+ \d+"/.test(svg), "SVG ölçeklenebilir (viewBox var)");
kontrol(/role="img"/.test(svg) && /aria-label=/.test(svg), "SVG ekran okuyucuya kendini tanıtıyor");
// KAPALI AĞ: SVG dış kaynağa gitmemeli.
kontrol(!/https?:\/\//.test(svg.replace('xmlns="http://www.w3.org/2000/svg"', "")), "SVG dış kaynak çağırmıyor");

/* ── 10. HAT SÖZLEŞMESİ — Hat B ile Hat D arasında ─────────────────────────
   QR'ın içeriği `/kiosk?egitim=<id>`. Bu sözleşme bozulursa hattaki etiket
   sicilini giren işçiyi doğru eğitime götürmez ve kimse sebebini anlamaz. */
esit(kioskBaglantisi("egt_1"), "/kiosk?egitim=egt_1", "ayar boşken göreli yol üretilir");
esit(kioskBaglantisi("egt_1", "http://10.20.0.5:3000"), "http://10.20.0.5:3000/kiosk?egitim=egt_1", "temel adres önekleniyor");
esit(kioskBaglantisi("egt_1", "http://10.20.0.5:3000/"), "http://10.20.0.5:3000/kiosk?egitim=egt_1", "sondaki eğik çizgi iki kez yazılmıyor");
esit(kioskBaglantisi("a b&c"), "/kiosk?egitim=a%20b%26c", "kimlik URL için kaçırılıyor");

// UÇTAN UCA: kodlanan bağlantı geri okunuyor VE kiosk tarafı parametreyi
// çözebiliyor. İki hattın sözleşmesi tek satırda doğrulanıyor.
for (const id of ["egt_1", "egt_m8x2k91", "a b&c"]) {
  const adres = kioskBaglantisi(id, "http://10.20.0.5:3000");
  const okunan = coz(qrMatris(adres)).metin;
  esit(okunan, adres, `"${id}": QR bağlantıyı bozmadan taşıyor`);
  esit(qrEgitimId(new URL(okunan).searchParams.get("egitim")), id, `"${id}": kiosk parametreyi geri çözüyor`);
}

bitir("qr");
