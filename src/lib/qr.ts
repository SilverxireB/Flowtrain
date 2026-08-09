/**
 * QR KOD ÜRETİCİ — dış bağımlılık YOK (kapalı ağ kuralı; `csv.ts` ile aynı üslup).
 *
 * NEDEN KENDİMİZ YAZIYORUZ: ürün kapalı ağda, tek kutuda kurulur; npm'den bir
 * QR kütüphanesi çekmek hem kurulum paketini hem denetim yüzeyini büyütür.
 * İhtiyacımız da dar: sabit bir kısa URL'yi hatta asılacak bir etikete basmak.
 *
 * KAPSAM (bilinçli olarak dar tutuldu):
 *  - Model 2, BAYT kipi (UTF-8), hata düzeltme seviyesi **M** (~%15 kurtarma).
 *  - Sürüm 1–10 (M'de 213 bayta kadar). Kiosk bağlantısı en kötü ihtimalle
 *    ~80 karakter; 40. sürüme kadar tablo taşımak ölü ağırlık olurdu.
 *  - Kip karışımı, Kanji, ECI yok. Fabrika etiketi bunların hiçbirini istemiyor.
 *
 * SEVİYE NEDEN M: etiket hatta asılır — toz, yağ, çizik olur. L (%7) sahada
 * zayıf kalıyor; Q/H daha büyük matris demek, aynı kâğıtta modüller küçülünce
 * ucuz el terminali okuyamıyor. M ikisinin ortası ve standardın varsayılanı.
 *
 * NASIL DOĞRULANDI (sınav `tests/` altında Hat D'nin; burada yöntem yazılı):
 *  1. **Reed-Solomon cebirsel denetimi** — üretilen (veri + EC) kod sözcüğü
 *     polinomu, üreteç polinomunun katı olmak zorundadır: α^0 … α^(ec-1)
 *     köklerinin HEPSİNDE polinomun değeri 0 çıkmalı. Tek bir kaydırma hatası
 *     bile bu denetimden geçemez.
 *  2. **Geri okuma (round-trip)** — üretilen matristen biçim bilgisi okunur,
 *     maske geri alınır, veri zikzak sırayla toplanır, blok serpiştirmesi
 *     çözülür ve kip + uzunluk + baytlar geri çıkarılır; sonuç girdi metnine
 *     eşit olmalı. Yerleşim, maske, serpiştirme ve biçim bitlerini tek seferde
 *     kapsar. 1–10 arası her sürümü tetikleyen uzunluklarla koşuldu.
 *  3. **Bilinen sabitler** — M seviyesi + maske 0 için biçim bitleri
 *     `101010000010010` (BCH kalanı 0 olduğu için XOR maskesinin kendisi),
 *     sürüm 7 için sürüm bitleri `000111110010010`... gibi standart değerler.
 *  4. **Yapısal denetim** — üç bulucu deseni, ayırıcılar, zaman şeritleri ve
 *     koyu modül (satır 4·sürüm+9, sütun 8) beklenen yerde mi.
 *
 * SWC TUZAĞI (bkz. `csv.ts`): burada parametre yakalayan kapanış yardımcı YOK.
 * Her yardımcı modül seviyesinde ve aldığı her şeyi parametreyle alır.
 */

/* ── GF(256) — Reed-Solomon aritmetiği ─────────────────────────────────────
   Üreteç 0x11D (x^8+x^4+x^3+x^2+1), standardın belirlediği ilkel polinom.
   Tablolar bir kez kurulur; çarpma logaritma toplamına iner. */

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
for (let i = 0, x = 1; i < 255; i++) {
  EXP[i] = x;
  LOG[x] = i;
  x = (x << 1) ^ (x & 0x80 ? 0x11d : 0);
}
for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];

function gfCarp(a: number, b: number): number {
  return a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]];
}

/** (x−α^0)(x−α^1)…(x−α^(derece−1)) — dizinin 0. elemanı EN YÜKSEK derece. */
function uretecPolinomu(derece: number): number[] {
  let p = [1];
  for (let i = 0; i < derece; i++) {
    const yeni = new Array<number>(p.length + 1).fill(0);
    for (let j = 0; j < p.length; j++) {
      yeni[j] ^= p[j];
      yeni[j + 1] ^= gfCarp(p[j], EXP[i]);
    }
    p = yeni;
  }
  return p;
}

/** Bir veri bloğunun hata düzeltme kod sözcükleri (polinom bölmesinin kalanı). */
function rsKodSozcukleri(veri: number[], ecSayisi: number): number[] {
  const g = uretecPolinomu(ecSayisi);
  const kalan = new Array<number>(ecSayisi).fill(0);
  for (const bayt of veri) {
    const etken = bayt ^ kalan[0];
    kalan.shift();
    kalan.push(0);
    if (etken !== 0) {
      for (let i = 0; i < ecSayisi; i++) kalan[i] ^= gfCarp(g[i + 1], etken);
    }
  }
  return kalan;
}

/* ── sürüm tabloları (yalnız EC seviyesi M) ────────────────────────────────
   `bloklar`: [blok adedi, blok başına VERİ kod sözcüğü] çiftleri. Toplam
   (veri + ec) sayısı standardın sürüm başına toplam kod sözcüğünü tutar —
   ör. sürüm 8: 2×38 + 2×39 + 4×22 = 242. */

interface SurumBilgisi {
  /** Blok başına hata düzeltme kod sözcüğü. */
  ec: number;
  bloklar: [number, number][];
  /** Hizalama deseni merkez koordinatları. */
  hizalama: number[];
}

const SURUMLER: SurumBilgisi[] = [
  { ec: 10, bloklar: [[1, 16]], hizalama: [] },
  { ec: 16, bloklar: [[1, 28]], hizalama: [6, 18] },
  { ec: 26, bloklar: [[1, 44]], hizalama: [6, 22] },
  { ec: 18, bloklar: [[2, 32]], hizalama: [6, 26] },
  { ec: 24, bloklar: [[2, 43]], hizalama: [6, 30] },
  { ec: 16, bloklar: [[4, 27]], hizalama: [6, 34] },
  { ec: 18, bloklar: [[4, 31]], hizalama: [6, 22, 38] },
  { ec: 22, bloklar: [[2, 38], [2, 39]], hizalama: [6, 24, 42] },
  { ec: 22, bloklar: [[3, 36], [2, 37]], hizalama: [6, 26, 46] },
  { ec: 26, bloklar: [[4, 43], [1, 44]], hizalama: [6, 28, 50] },
];

export const EN_BUYUK_SURUM = SURUMLER.length;

function veriKodSayisi(surum: number): number {
  let n = 0;
  for (const [adet, uzunluk] of SURUMLER[surum - 1].bloklar) n += adet * uzunluk;
  return n;
}

/** Bayt kipinde karakter sayacının bit genişliği (sürüm 10'dan itibaren 16). */
function sayacBiti(surum: number): number {
  return surum < 10 ? 8 : 16;
}

function baytKapasitesi(surum: number): number {
  return Math.floor((veriKodSayisi(surum) * 8 - 4 - sayacBiti(surum)) / 8);
}

function surumSec(baytSayisi: number): number {
  for (let s = 1; s <= EN_BUYUK_SURUM; s++) {
    if (baytSayisi <= baytKapasitesi(s)) return s;
  }
  throw new Error(
    `QR: metin çok uzun (${baytSayisi} bayt). Sürüm ${EN_BUYUK_SURUM} / seviye M en fazla ${baytKapasitesi(EN_BUYUK_SURUM)} bayt taşır.`,
  );
}

/* ── veri kodlaması ───────────────────────────────────────────────────────── */

function bitEkle(bitler: number[], deger: number, uzunluk: number): void {
  for (let i = uzunluk - 1; i >= 0; i--) bitler.push((deger >> i) & 1);
}

/**
 * Baytlar → veri kod sözcükleri (sonlandırıcı + hizalama + dolgu dâhil).
 * Dolgu deseni standarttır: 0xEC ve 0x11 dönüşümlü. Sıfırla doldurmak
 * okuyucuların bir kısmında "boş alan" heuristiğini tetikliyor.
 */
function veriKodSozcukleri(baytlar: number[], surum: number): number[] {
  const kapasite = veriKodSayisi(surum) * 8;
  const bitler: number[] = [];
  bitEkle(bitler, 0b0100, 4); // bayt kipi
  bitEkle(bitler, baytlar.length, sayacBiti(surum));
  for (const b of baytlar) bitEkle(bitler, b, 8);

  // Sonlandırıcı en çok 4 bit, sığdığı kadar.
  for (let i = 0; i < 4 && bitler.length < kapasite; i++) bitler.push(0);
  while (bitler.length % 8 !== 0) bitler.push(0);

  const cikti: number[] = [];
  for (let i = 0; i < bitler.length; i += 8) {
    let bayt = 0;
    for (let j = 0; j < 8; j++) bayt = (bayt << 1) | bitler[i + j];
    cikti.push(bayt);
  }
  const dolgu = [0xec, 0x11];
  while (cikti.length < kapasite / 8) cikti.push(dolgu[cikti.length % 2 === 0 ? 0 : 1]);
  return cikti;
}

/**
 * Bloklara böl, her bloğa EC ekle, SERPİŞTİR.
 * Serpiştirme şart: matrisin bir köşesindeki leke tek bir bloğu değil tüm
 * blokları azar azar bozsun diye — hata düzeltmenin işe yaraması buna bağlı.
 */
function tumKodSozcukleri(baytlar: number[], surum: number): number[] {
  const bilgi = SURUMLER[surum - 1];
  const veri = veriKodSozcukleri(baytlar, surum);

  const veriBloklari: number[][] = [];
  const ecBloklari: number[][] = [];
  let p = 0;
  for (const [adet, uzunluk] of bilgi.bloklar) {
    for (let i = 0; i < adet; i++) {
      const blok = veri.slice(p, p + uzunluk);
      p += uzunluk;
      veriBloklari.push(blok);
      ecBloklari.push(rsKodSozcukleri(blok, bilgi.ec));
    }
  }

  const cikti: number[] = [];
  let enUzun = 0;
  for (const b of veriBloklari) enUzun = Math.max(enUzun, b.length);
  for (let i = 0; i < enUzun; i++) {
    for (const b of veriBloklari) if (i < b.length) cikti.push(b[i]);
  }
  for (let i = 0; i < bilgi.ec; i++) {
    for (const b of ecBloklari) cikti.push(b[i]);
  }
  return cikti;
}

/* ── işlev desenleri ──────────────────────────────────────────────────────── */

function modulYaz(m: number[][], islevsel: boolean[][], satir: number, sutun: number, koyu: boolean): void {
  const n = m.length;
  if (satir < 0 || satir >= n || sutun < 0 || sutun >= n) return;
  m[satir][sutun] = koyu ? 1 : 0;
  islevsel[satir][sutun] = true;
}

/** 7×7 bulucu + çevresindeki ayırıcı (merkez koordinatıyla çağrılır). */
function bulucuCiz(m: number[][], islevsel: boolean[][], satir: number, sutun: number): void {
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      const uzaklik = Math.max(Math.abs(dx), Math.abs(dy));
      modulYaz(m, islevsel, satir + dy, sutun + dx, uzaklik !== 2 && uzaklik !== 4);
    }
  }
}

function hizalamaCiz(m: number[][], islevsel: boolean[][], satir: number, sutun: number): void {
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      modulYaz(m, islevsel, satir + dy, sutun + dx, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }
}

/** Biçim bilgisi: 2 bit EC seviyesi (M = 00) + 3 bit maske, BCH(15,5) ile korunur. */
function bicimBitleri(maske: number): number {
  const veri = (0b00 << 3) | maske;
  let kalan = veri;
  for (let i = 0; i < 10; i++) kalan = (kalan << 1) ^ ((kalan >> 9) * 0x537);
  return ((veri << 10) | kalan) ^ 0x5412;
}

function bicimYaz(m: number[][], islevsel: boolean[][], maske: number): void {
  const n = m.length;
  const bitler = bicimBitleri(maske);
  for (let i = 0; i < 15; i++) {
    const bit = (bitler >> i) & 1;
    // Birinci kopya — sol üst köşe.
    if (i < 6) modulYaz(m, islevsel, i, 8, bit === 1);
    else if (i === 6) modulYaz(m, islevsel, 7, 8, bit === 1);
    else if (i === 7) modulYaz(m, islevsel, 8, 8, bit === 1);
    else if (i === 8) modulYaz(m, islevsel, 8, 7, bit === 1);
    else modulYaz(m, islevsel, 8, 14 - i, bit === 1);
    // İkinci kopya — sağ üst ve sol alt (biri okunamazsa diğeri kurtarır).
    if (i < 8) modulYaz(m, islevsel, 8, n - 1 - i, bit === 1);
    else modulYaz(m, islevsel, n - 15 + i, 8, bit === 1);
  }
  modulYaz(m, islevsel, n - 8, 8, true); // her zaman koyu modül
}

/** Sürüm 7 ve üstünde sürüm numarası matrise de yazılır (BCH(18,6)). */
function surumYaz(m: number[][], islevsel: boolean[][], surum: number): void {
  if (surum < 7) return;
  const n = m.length;
  let kalan = surum;
  for (let i = 0; i < 12; i++) kalan = (kalan << 1) ^ ((kalan >> 11) * 0x1f25);
  const bitler = (surum << 12) | kalan;
  for (let i = 0; i < 18; i++) {
    const bit = ((bitler >> i) & 1) === 1;
    const a = n - 11 + (i % 3);
    const b = Math.floor(i / 3);
    modulYaz(m, islevsel, b, a, bit);
    modulYaz(m, islevsel, a, b, bit);
  }
}

function iskeletKur(surum: number): { m: number[][]; islevsel: boolean[][] } {
  const n = surum * 4 + 17;
  const m: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  const islevsel: boolean[][] = Array.from({ length: n }, () => new Array<boolean>(n).fill(false));

  /* SIRA ÖNEMLİ: önce zaman şeritleri, SONRA bulucular.
     Şeritler satır 6 ve sütun 6 boyunca uçtan uca çizilir; iki ucu bulucu
     desenlerinin dış halkasının içine taşar. Bulucular sonra çizilince o
     taşan modülleri geri düzeltir. Ters sırada çizilirse bulucunun dış
     halkasında tek modülük boşluklar kalır — matris standarda uymaz ve
     okuyucuların bir kısmı deseni hiç bulamaz. */
  for (let i = 0; i < n; i++) {
    modulYaz(m, islevsel, 6, i, i % 2 === 0);
    modulYaz(m, islevsel, i, 6, i % 2 === 0);
  }

  bulucuCiz(m, islevsel, 3, 3);
  bulucuCiz(m, islevsel, 3, n - 4);
  bulucuCiz(m, islevsel, n - 4, 3);

  const yerler = SURUMLER[surum - 1].hizalama;
  for (let i = 0; i < yerler.length; i++) {
    for (let j = 0; j < yerler.length; j++) {
      // Üç köşe bulucu desenleriyle çakışır, atlanır.
      const kose =
        (i === 0 && j === 0) || (i === 0 && j === yerler.length - 1) || (i === yerler.length - 1 && j === 0);
      if (!kose) hizalamaCiz(m, islevsel, yerler[i], yerler[j]);
    }
  }

  surumYaz(m, islevsel, surum);
  // Biçim alanı şimdiden REZERVE edilir: veri yerleştirici oraya yazmasın diye.
  bicimYaz(m, islevsel, 0);
  return { m, islevsel };
}

/**
 * Kod sözcüklerini zikzak yerleştir: sağ alttan başlayıp ikişer sütun
 * genişliğinde yukarı-aşağı dolaşılır; 6. sütun (dikey zaman şeridi) atlanır.
 */
function veriYerlestir(m: number[][], islevsel: boolean[][], kodlar: number[]): void {
  const n = m.length;
  let bit = 0;
  const toplamBit = kodlar.length * 8;
  let yukari = true;
  for (let sag = n - 1; sag > 0; sag -= 2) {
    if (sag === 6) sag = 5;
    for (let adim = 0; adim < n; adim++) {
      const satir = yukari ? n - 1 - adim : adim;
      for (let d = 0; d < 2; d++) {
        const sutun = sag - d;
        if (islevsel[satir][sutun]) continue;
        // Kalan bitler (kapasite artığı) sıfır kalır — standart böyle diyor.
        m[satir][sutun] = bit < toplamBit ? (kodlar[bit >> 3] >> (7 - (bit & 7))) & 1 : 0;
        bit++;
      }
    }
    yukari = !yukari;
  }
}

/* ── maske ────────────────────────────────────────────────────────────────── */

function maskeUyar(maske: number, satir: number, sutun: number): boolean {
  switch (maske) {
    case 0:
      return (satir + sutun) % 2 === 0;
    case 1:
      return satir % 2 === 0;
    case 2:
      return sutun % 3 === 0;
    case 3:
      return (satir + sutun) % 3 === 0;
    case 4:
      return (Math.floor(satir / 2) + Math.floor(sutun / 3)) % 2 === 0;
    case 5:
      return ((satir * sutun) % 2) + ((satir * sutun) % 3) === 0;
    case 6:
      return (((satir * sutun) % 2) + ((satir * sutun) % 3)) % 2 === 0;
    default:
      return (((satir + sutun) % 2) + ((satir * sutun) % 3)) % 2 === 0;
  }
}

/** 1:1:3:1:1 bulucu benzeri desen — matrisin içinde çıkarsa okuyucu şaşırır. */
const DESEN = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
const DESEN_TERS = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];

function desenUyar(dizi: number[], bas: number, desen: number[]): boolean {
  for (let i = 0; i < desen.length; i++) if (dizi[bas + i] !== desen[i]) return false;
  return true;
}

function cizgiCezasi(dizi: number[]): number {
  let ceza = 0;
  let kosu = 1;
  for (let i = 1; i < dizi.length; i++) {
    if (dizi[i] === dizi[i - 1]) {
      kosu++;
      if (kosu === 5) ceza += 3;
      else if (kosu > 5) ceza += 1;
    } else kosu = 1;
  }
  for (let i = 0; i + DESEN.length <= dizi.length; i++) {
    if (desenUyar(dizi, i, DESEN) || desenUyar(dizi, i, DESEN_TERS)) ceza += 40;
  }
  return ceza;
}

/**
 * Maske cezası — standardın dört kuralı. Düşük ceza = daha okunur matris:
 * uzun tek renk koşuları, 2×2 lekeler, bulucu benzeri desenler ve koyu/açık
 * dengesizliği okuyucuyu yanıltır.
 */
function maskeCezasi(m: number[][]): number {
  const n = m.length;
  let toplam = 0;
  const satir = new Array<number>(n);
  const sutun = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      satir[j] = m[i][j];
      sutun[j] = m[j][i];
    }
    toplam += cizgiCezasi(satir) + cizgiCezasi(sutun);
  }
  let koyu = 0;
  for (let y = 0; y < n - 1; y++) {
    for (let x = 0; x < n - 1; x++) {
      const a = m[y][x];
      if (a === m[y][x + 1] && a === m[y + 1][x] && a === m[y + 1][x + 1]) toplam += 3;
    }
  }
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) koyu += m[y][x];
  toplam += Math.floor(Math.abs((koyu * 100) / (n * n) - 50) / 5) * 10;
  return toplam;
}

/* ── genel arayüz ─────────────────────────────────────────────────────────── */

/**
 * Metin → QR modül matrisi. `true` = koyu modül.
 *
 * SAF FONKSİYON: aynı girdi her zaman aynı matrisi verir, hiçbir yan etkisi
 * yoktur. Sınav yazılabilir olması için bilerek böyle — SVG üretimi ayrı.
 */
export function qrMatris(metin: string): boolean[][] {
  const baytlar = Array.from(new TextEncoder().encode(metin));
  const surum = surumSec(baytlar.length);
  const kodlar = tumKodSozcukleri(baytlar, surum);

  const { m, islevsel } = iskeletKur(surum);
  veriYerlestir(m, islevsel, kodlar);

  // Sekiz maskenin hepsi denenir, en düşük cezalı seçilir. "Hep maske 0"
  // demek, düz renkli bölgelerin taranamadığı etiketler üretmek demekti.
  let enIyi: number[][] | null = null;
  let enIyiCeza = Infinity;
  for (let maske = 0; maske < 8; maske++) {
    const aday = m.map((s) => s.slice());
    for (let y = 0; y < aday.length; y++) {
      for (let x = 0; x < aday.length; x++) {
        if (!islevsel[y][x] && maskeUyar(maske, y, x)) aday[y][x] ^= 1;
      }
    }
    bicimYaz(aday, islevsel.map((s) => s.slice()), maske);
    const ceza = maskeCezasi(aday);
    if (ceza < enIyiCeza) {
      enIyiCeza = ceza;
      enIyi = aday;
    }
  }
  return enIyi!.map((s) => s.map((v) => v === 1));
}

export interface QrSecenek {
  /** Bir modülün kenar uzunluğu (SVG birimi). */
  modul?: number;
  /** Sessiz alan, modül cinsinden. Standart 4 — daha azı okuyucuyu zorlar. */
  sessizAlan?: number;
  renk?: string;
  zemin?: string;
}

/** Matrisin toplam kenar uzunluğu (sessiz alan dâhil). */
export function qrKenar(matris: boolean[][], modul = 4, sessizAlan = 4): number {
  return (matris.length + sessizAlan * 2) * modul;
}

/**
 * Matris → tek bir SVG `path` verisi.
 *
 * NEDEN TEK YOL, MODÜL BAŞINA `rect` DEĞİL: 57×57'lik bir matris 3000'den fazla
 * dikdörtgen demek. Yazdırma önizlemesi 20 etikette donuyordu. Yan yana koyu
 * modüller tek yatay şeride birleştirilince düğüm sayısı onda birine iniyor —
 * ayrıca komşu dikdörtgenler arasında yazıcıda beliren saç teli çizgiler de
 * kayboluyor.
 */
export function qrYolu(matris: boolean[][], modul = 4, sessizAlan = 4): string {
  const n = matris.length;
  const parcalar: string[] = [];
  for (let y = 0; y < n; y++) {
    let x = 0;
    while (x < n) {
      if (!matris[y][x]) {
        x++;
        continue;
      }
      let uzunluk = 1;
      while (x + uzunluk < n && matris[y][x + uzunluk]) uzunluk++;
      const px = (x + sessizAlan) * modul;
      const py = (y + sessizAlan) * modul;
      const genislik = uzunluk * modul;
      parcalar.push(`M${px} ${py}h${genislik}v${modul}h-${genislik}z`);
      x += uzunluk;
    }
  }
  return parcalar.join("");
}

/** Metin → tam SVG belgesi (API uç noktası ve dosya çıktısı için). */
export function qrSvg(metin: string, secenek: QrSecenek = {}): string {
  const modul = secenek.modul ?? 4;
  const sessizAlan = secenek.sessizAlan ?? 4;
  const renk = secenek.renk ?? "#18181b";
  const zemin = secenek.zemin ?? "#ffffff";
  const matris = qrMatris(metin);
  const kenar = qrKenar(matris, modul, sessizAlan);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${kenar}" height="${kenar}" viewBox="0 0 ${kenar} ${kenar}" ` +
    `shape-rendering="crispEdges" role="img" aria-label="QR kod">` +
    `<rect width="${kenar}" height="${kenar}" fill="${zemin}"/>` +
    `<path d="${qrYolu(matris, modul, sessizAlan)}" fill="${renk}"/>` +
    `</svg>`
  );
}

/* ── kiosk bağlantısı ─────────────────────────────────────────────────────── */

/**
 * QR'ın İÇERİĞİ — Hat D (kiosk) ile SÖZLEŞME, değiştirilmez: `/kiosk?egitim=<id>`.
 *
 * Temel adres AYARDAN gelir (`temelAdres`), koda gömülmez: aynı kurulum bir
 * fabrikada `http://10.20.0.5:3000`, diğerinde iç ağdaki bir sunucu adı olur.
 * Ayar boşsa göreli yol üretilir — göreli yol, etiketi okutmadan önce
 * tarayıcıda zaten FlowTrain açıksa çalışır; hattaki telefon için ayar
 * doldurulmalıdır (etiket sayfası bunu ekranda söyler).
 */
export function kioskBaglantisi(egitimId: string, temelAdres = ""): string {
  const yol = `/kiosk?egitim=${encodeURIComponent(egitimId)}`;
  const temel = temelAdres.trim().replace(/\/+$/, "");
  return temel ? temel + yol : yol;
}
