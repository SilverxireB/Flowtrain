/**
 * PDF SAYFASININ BAŞLIK ADAYI.
 *
 * NEDEN VAR: PDF içe aktarımı her sayfayı görüntüye çevirip bir karta koyuyor
 * ve kartlara `talimat — 1`, `talimat — 2`… diye ad veriyordu. Kırk sayfalık
 * bir prosedürde kart haritası okunmaz hâle geliyor, aramada hiçbir şey
 * bulunmuyor ve görselin alt metni boş kaldığı için ekran okuyucu da
 * "talimat — 1" duyuyordu. Ürünün kendi "dosya adını değil ne gösterdiğini
 * yaz" kuralını kendi aktarımı çiğniyordu.
 *
 * KALIP İŞİ, TAHMİN DEĞİL (`metinBol.ts` ile aynı ilke). Anlam çözülmüyor;
 * sayfanın BİÇİMİ okunuyor: en büyük punto ile yazılmış kısa satır başlıktır.
 * Punto biçimsel bir gerçektir, yorum değil — yanıldığında bile hazırlayanın
 * gördüğü şey "yanlış başlık" olur, "uydurulmuş başlık" değil. Şüphede
 * kalınca BOŞ döner ve çağıran dosya adına düşer: kötü bir başlık
 * üretmektense eskisini kullanmak yeğdir.
 *
 * Sınav: `node tests/pdf-baslik.test.mjs`
 */

/** pdf.js `getTextContent()` parçasının bu modülün ihtiyaç duyduğu kadarı. */
export interface PdfMetinParcasi {
  metin: string;
  /** Sol kenardan uzaklık — satır içi sıralama için. */
  x: number;
  /** PDF y ekseni YUKARI büyür: en üstteki satırın y'si en büyüktür. */
  y: number;
  /** Punto yüksekliği. */
  boy: number;
}

/** Başlık sayılmak için en fazla bu kadar karakter (`metinBol.ts` ile aynı). */
const BASLIK_TAVANI = 70;

/** Bundan kısa bir "başlık" muhtemelen sayfa numarası ya da bir imdir. */
const EN_AZ = 3;

/**
 * Aynı satır sayılma toleransı, punto oranı olarak.
 *
 * Sabit bir piksel eşiği olamaz: aynı belgede 8 puntoluk dipnot da, 28
 * puntoluk başlık da var. Alt simge ve üst simge parçaları taban çizgisinden
 * yarım punto kadar kayar; eşik bundan biraz geniş.
 */
const SATIR_TOLERANSI = 0.6;

/** Yalnız sayı, noktalama ve "sayfa 3/12" gibi kalıplar başlık değildir. */
function sayfaImiMi(metin: string): boolean {
  const s = metin.trim().toLocaleLowerCase("tr");
  if (/^[\d\s./|—–-]+$/.test(s)) return true;
  return /^(sayfa|page)\s*[:.]?\s*\d+(\s*[/of]+\s*\d+)?$/.test(s);
}

interface Satir {
  metin: string;
  y: number;
  boy: number;
}

/**
 * Parçaları satırlara toplar.
 *
 * pdf.js metni parça parça verir ve bir satır kolayca on parçaya bölünür
 * (yazı tipi değişimi, kerning, sözcük aralığı). Parçaları y'ye göre
 * gruplamadan "ilk satır" diye bir şey yoktur — ilk PARÇA vardır, ki o da
 * çoğu zaman tek bir harftir.
 */
function satirlaraTopla(parcalar: PdfMetinParcasi[]): Satir[] {
  const dolu = parcalar.filter((p) => p.metin.trim() !== "");
  if (dolu.length === 0) return [];

  // Üstten alta: PDF'te y yukarı büyüdüğü için AZALAN sıra.
  const sirali = [...dolu].sort((a, b) => b.y - a.y);
  const gruplar: PdfMetinParcasi[][] = [];

  for (const p of sirali) {
    const son = gruplar[gruplar.length - 1];
    const temsil = son?.[0];
    const esik = Math.max(temsil?.boy ?? p.boy, p.boy) * SATIR_TOLERANSI;
    if (temsil && Math.abs(temsil.y - p.y) <= esik) son.push(p);
    else gruplar.push([p]);
  }

  return gruplar.map((g) => {
    const soldanSaga = [...g].sort((a, b) => a.x - b.x);
    /* Parçalar arasına boşluk KONMAZ: pdf.js parçaları çoğu zaman kendi
       baştaki/sondaki boşluklarını taşır ve ekleyince "K K D" gibi kelimeler
       çıkar. Birleştirip fazlalıkları tek boşluğa indirmek daha güvenli. */
    const metin = soldanSaga
      .map((p) => p.metin)
      .join("")
      .replace(/\s+/g, " ")
      .trim();
    return { metin, y: g[0].y, boy: Math.max(...g.map((p) => p.boy)) };
  });
}

/**
 * Sayfanın başlık adayı; bulunamazsa boş dize.
 *
 * SEÇİM: sayfa imi olmayan, tavanı aşmayan satırlar arasından EN BÜYÜK
 * puntolu; eşitlikte EN ÜSTTEKİ. Punto farkı yoksa (tek puntoyla dizilmiş
 * düz metin) bu kural doğal olarak "ilk satır"a düşer, ki o da makul bir
 * başlıktır.
 *
 * TAVANI AŞAN SATIR ELENİR, KIRPILMAZ: uzun bir paragrafın ilk yetmiş
 * karakteri cümlenin ortasında biter ve haritada kartı anlatmaz. Böyle bir
 * sayfada başlık YOKTUR; dosya adına düşmek dürüst olandır.
 */
export function pdfSayfaBasligi(parcalar: PdfMetinParcasi[]): string {
  const adaylar = satirlaraTopla(parcalar).filter(
    (s) => s.metin.length >= EN_AZ && s.metin.length <= BASLIK_TAVANI && !sayfaImiMi(s.metin),
  );
  if (adaylar.length === 0) return "";

  let en = adaylar[0];
  for (const s of adaylar) {
    if (s.boy > en.boy + 0.5) en = s;
    else if (Math.abs(s.boy - en.boy) <= 0.5 && s.y > en.y) en = s;
  }
  // Sondaki iki nokta başlık biçiminin kalıntısı ("1. Kapsam:").
  return en.metin.replace(/[:：]$/, "").trim();
}
