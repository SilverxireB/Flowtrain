/**
 * SINAV MOTORU — saf (yan etkisiz) mantık, sunucu/istemci ayrımı yok.
 *
 * Sınavlı olmasının sebebi: puanlama ve soru seçimi kurumun eğitim kayıtlarına
 * yazılan yasal bir sonuç üretir. "Geçti" yanlışsa kimse fark etmez.
 *
 * Sınav: `node tests/sinav.test.mjs`
 */
import type { Soru } from "./tipler";

/**
 * Tohumlu karıştırıcı (mulberry32 + Fisher-Yates).
 *
 * NEDEN TOHUMLU: (1) sınav tekrar açıldığında AYNI soru seti gelmeli — yenile
 * tuşuyla kolay set aranmasın; (2) sınavlar deterministik koşsun. Tohum
 * `oturumId`den türer, dolayısıyla her deneme farklı set alır.
 */
export function tohumla(metin: string): number {
  let h = 2166136261;
  for (let i = 0; i < metin.length; i++) {
    h ^= metin.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rastgele(tohum: number): () => number {
  let a = tohum;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function karistir<T>(dizi: T[], tohum: number): T[] {
  const r = rastgele(tohum);
  const s = [...dizi];
  for (let i = s.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [s[i], s[j]] = [s[j], s[i]];
  }
  return s;
}

/** Sınavda sorulacak sorular: havuzdan tohumlu seçim. */
export function sinaviKur(havuz: Soru[], soruSayisi: number, karisik: boolean, tohum: number): Soru[] {
  if (!karisik) return havuz.slice(0, soruSayisi);
  return karistir(havuz, tohum).slice(0, Math.min(soruSayisi, havuz.length));
}

/**
 * Bir sorunun cevabı doğru mu?
 * ÇOKLU SEÇİMDE "hep ya da hiç": eksik işaretleme yarım puan almaz. Güvenlik
 * eğitiminde "üç önlemden ikisini biliyorum" geçer not değildir.
 */
export function soruDogruMu(soru: Soru, secilen: number[]): boolean {
  /* SIRA ÖNEMLİ OLAN TİPLER ayrı ele alınır. Küme karşılaştırması `secilen`i
     sıralıyor; sıralama sorusunda bu, yanlış sıralayan herkesi doğru
     saymak demekti. */
  if (soru.tip === "siralama") return siralamaDogruMu(soru, secilen);
  if (soru.tip === "eslestirme") return eslestirmeDogruMu(soru, secilen);

  const d = [...soru.dogru].sort((a, b) => a - b);
  const s = [...new Set(secilen)].sort((a, b) => a - b);

  /* DOĞRUSU İŞARETLENMEMİŞ SORU KİMSEYE PUAN VERMEZ.
     Küme karşılaştırması boş `dogru` ile boş cevabı EŞİT sayıyordu: hazırlayan
     doğru şıkkı işaretlemeyi unutmuşsa, soruyu boş bırakan herkes o sorudan
     puan alıyordu. Sessiz ve tam ters yönde bir hata — "geçti" yazan kayıt
     yanlış olur. Bu bir içerik kusurudur; `yayinKontrolu` yayından önce
     uyarır, puanlama da ödüllendirmez. */
  if (d.length === 0) return false;

  return d.length === s.length && d.every((v, i) => v === s[i]);
}

/**
 * SIRALAMA — şıklar DOĞRU sırada saklanır, kişiye karışık gösterilir.
 *
 * Cevap, kişinin dizdiği sıradaki şık indeksleridir; doğru cevap kimliğin
 * kendisidir (`0,1,2,…`). Ayrı bir "doğru sıra" alanı tutulmadı: iki yerde
 * duran sıra er geç ayrışır ve hangisinin geçerli olduğu belirsizleşir.
 */
export function siralamaDogruMu(soru: Soru, secilen: number[]): boolean {
  if (secilen.length !== soru.secenekler.length) return false;
  return secilen.every((v, i) => v === i);
}

/**
 * EŞLEŞTİRME — her şık `sol | sağ` çiftidir.
 *
 * Cevabın `i`. elemanı, `i`. soldaki maddeye seçilen sağ maddenin indeksidir.
 * Doğru eşleşme kimliktir. Kısmi doğruya puan YOK: "üç önlemden ikisini
 * biliyorum" güvenlik eğitiminde geçer not değildir (çoklu seçimdeki kuralın
 * aynısı).
 */
export function eslestirmeDogruMu(soru: Soru, secilen: number[]): boolean {
  if (secilen.length !== soru.secenekler.length) return false;
  return secilen.every((v, i) => v === i);
}

/** Eşleştirme şıkkını çiftine ayırır (`sol | sağ`). */
export function eslestirmeCifti(secenek: string): { sol: string; sag: string } {
  const i = secenek.indexOf("|");
  if (i === -1) return { sol: secenek.trim(), sag: "" };
  return { sol: secenek.slice(0, i).trim(), sag: secenek.slice(i + 1).trim() };
}

export interface Bolge {
  x: number;
  y: number;
  g: number;
  y2: number;
  etiket: string;
}

/**
 * GÖRSELDE İŞARETLEME bölgesi: `x,y,genişlik,yükseklik | etiket`.
 *
 * Ölçüler YÜZDE (0–100), piksel değil: aynı görsel kioskta 728 px, amir
 * tabletinde daha dar çiziliyor; piksel saklansaydı işaret kutusu cihazdan
 * cihaza kayardı ve doğru yeri işaretleyen kişi yanlış cevap alırdı.
 */
export function bolgeCoz(secenek: string): Bolge | null {
  const [olcu, etiket = ""] = secenek.split("|");
  const p = olcu.split(",").map((s) => Number(s.trim()));
  if (p.length < 4 || p.some((n) => !Number.isFinite(n))) return null;
  return { x: p[0], y: p[1], g: p[2], y2: p[3], etiket: etiket.trim() };
}

/** Tıklanan nokta (yüzde olarak) hangi bölgelerin içinde? */
export function bolgeVurusu(secenekler: string[], x: number, y: number): number[] {
  const vuran: number[] = [];
  for (let i = 0; i < secenekler.length; i++) {
    const b = bolgeCoz(secenekler[i]);
    if (!b) continue;
    if (x >= b.x && x <= b.x + b.g && y >= b.y && y <= b.y + b.y2) vuran.push(i);
  }
  return vuran;
}

export interface PuanSonucu {
  puan: number;
  dogruSayisi: number;
  toplam: number;
  yanlisSoruIdleri: string[];
}

/** 0–100 puan. Soru yoksa puan 0'dır — "soru yok, herkes geçti" olmaz. */
export function puanla(sorular: Soru[], cevaplar: Record<string, number[]>): PuanSonucu {
  const yanlis: string[] = [];
  let dogru = 0;
  for (const s of sorular) {
    if (soruDogruMu(s, cevaplar[s.id] ?? [])) dogru++;
    else yanlis.push(s.id);
  }
  const toplam = sorular.length;
  return {
    puan: toplam === 0 ? 0 : Math.round((dogru / toplam) * 100),
    dogruSayisi: dogru,
    toplam,
    yanlisSoruIdleri: yanlis,
  };
}

export function gectiMi(puan: number, gecmeNotu: number): boolean {
  return puan >= gecmeNotu;
}

/**
 * İÇERİK KALİTE SİNYALİ: bir soruyu çoğunluk yanlış yapıyorsa insanlar değil,
 * o sayfa kötüdür. Hazırlayana bunu söylemek ürünün ayırt edici tarafı.
 */
export function zorSorular(
  istatistik: { soruId: string; deneme: number; yanlis: number }[],
  esik = 0.6,
  asgariDeneme = 10,
): { soruId: string; yanlisOrani: number }[] {
  return istatistik
    .filter((s) => s.deneme >= asgariDeneme && s.yanlis / s.deneme >= esik)
    .map((s) => ({ soruId: s.soruId, yanlisOrani: s.yanlis / s.deneme }))
    .sort((a, b) => b.yanlisOrani - a.yanlisOrani);
}
