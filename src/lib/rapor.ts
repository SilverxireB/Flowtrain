/**
 * KAYIT DEFTERİ MANTIĞI — saf, sunucu bağımlılığı yok.
 *
 * NEDEN AYRI DOSYA VE NEDEN SAF: defterdeki süzgeç bir görünüm ayrıntısı değil,
 * DENETİM ARACIDIR. "Şubat ayında Kaynak bölümünde kim yüksekte çalışma eğitimi
 * aldı" sorusunun cevabı eksikse, eksikliği kimse ekranda göremez — liste
 * kısalır, kullanıcı "demek ki yokmuş" der. Bu yüzden süzgeç ve kırılımlar
 * veritabanı sorgusuna değil saf fonksiyonlara yazıldı: sınav yazılabilsin.
 *
 * Sınav önerisi: `tests/rapor.test.mjs`
 */
import { eslesir } from "./arama";
import type { OturumKaynagi, Sonuc } from "./tipler";

/**
 * Defterin tek satırı — oturum + eğitim + kişi tek düzlemde.
 *
 * Ekran ve dışa aktarım AYNI satırı görür. İkisi ayrı ayrı birleştirilseydi
 * CSV'de olan bir sütun ekranda olmayabilirdi ve denetimde "ekranda başka,
 * belgede başka" durumu doğardı.
 */
export interface KayitSatiri {
  id: string;
  egitimId: string;
  egitimAdi: string;
  egitimSurum: number;
  kategori: string;
  zorunlu: boolean;
  sicil: string;
  ad: string;
  bolum: string;
  baslangic: string;
  bitis?: string;
  /** Sunucu damgalarından ölçülen süre (saniye). Sınıf/aktarım kaydında yok. */
  sureSn?: number;
  puan?: number;
  sonuc?: Sonuc;
  kaynak: OturumKaynagi;
  egitmen?: string;
  gozeten?: string;
  notlar?: string;
  /** Eğitimde tekrar süresi varsa sertifikanın geçerlilik bitişi (`YYYY-AA-GG`). */
  gecerlilikBitis?: string;
}

/** `acik`: bitmemiş oturum — geçti/kaldı/iptal hiçbiri değil. */
export type SonucSuzgeci = Sonuc | "acik" | "";

export interface KayitSuzgeci {
  /** Kişi adı ya da sicil — Türkçe duyarlı (`arama.ts`). */
  sorgu: string;
  egitimId: string;
  bolum: string;
  kaynak: OturumKaynagi | "";
  sonuc: SonucSuzgeci;
  /** GG dahil: `YYYY-AA-GG`. Boşsa sınır yok. */
  baslangicGun: string;
  bitisGun: string;
}

export const BOS_SUZGEC: KayitSuzgeci = {
  sorgu: "",
  egitimId: "",
  bolum: "",
  kaynak: "",
  sonuc: "",
  baslangicGun: "",
  bitisGun: "",
};

/**
 * Satırın takvimdeki yeri.
 *
 * BİTİŞ ÖNCELİKLİ: denetim "ne zaman tamamlandı" diye sorar, "ne zaman
 * başlandı" diye değil. Yarım kalan oturumda bitiş yoktur; o zaman başlangıç
 * kullanılır, yoksa satır tarih süzgecinden tamamen düşer ve açık oturumlar
 * görünmez olurdu.
 */
export function kayitGunu(k: Pick<KayitSatiri, "baslangic" | "bitis">): string {
  return (k.bitis ?? k.baslangic ?? "").slice(0, 10);
}

function sonucEslesir(k: KayitSatiri, istenen: SonucSuzgeci): boolean {
  if (!istenen) return true;
  if (istenen === "acik") return !k.bitis;
  return k.sonuc === istenen;
}

/** Süzgeç — boş alan "sınırlama yok" demektir, hepsi VE ile birleşir. */
export function kayitlariSuz(satirlar: KayitSatiri[], s: KayitSuzgeci): KayitSatiri[] {
  return satirlar.filter((k) => {
    if (s.egitimId && k.egitimId !== s.egitimId) return false;
    if (s.bolum && k.bolum !== s.bolum) return false;
    if (s.kaynak && k.kaynak !== s.kaynak) return false;
    if (!sonucEslesir(k, s.sonuc)) return false;
    const gun = kayitGunu(k);
    if (s.baslangicGun && gun < s.baslangicGun) return false;
    if (s.bitisGun && gun > s.bitisGun) return false;
    if (s.sorgu && !eslesir(k.ad, s.sorgu) && !eslesir(k.sicil, s.sorgu)) return false;
    return true;
  });
}

export function suzgecAcikMi(s: KayitSuzgeci): boolean {
  return !!(s.sorgu || s.egitimId || s.bolum || s.kaynak || s.sonuc || s.baslangicGun || s.bitisGun);
}

/**
 * Süzgecin insan okunur özeti.
 *
 * BELGEYE YAZILIR: süzülmüş bir listeyi başlıksız basmak, denetimde "bu liste
 * neyin listesi" sorusunu cevapsız bırakır. Eksik belge, hiç belge olmamasından
 * kötüdür — o yüzden çıktının hangi süzgeçle alındığı belgenin üstünde durur.
 */
export function suzgecOzeti(s: KayitSuzgeci, egitimAdi: string, kaynakEtiket: string, sonucEtiket: string): string {
  const parcalar: string[] = [];
  if (s.egitimId) parcalar.push(`eğitim: ${egitimAdi}`);
  if (s.bolum) parcalar.push(`bölüm: ${s.bolum}`);
  if (s.kaynak) parcalar.push(`kaynak: ${kaynakEtiket}`);
  if (s.sonuc) parcalar.push(`sonuç: ${sonucEtiket}`);
  if (s.baslangicGun || s.bitisGun) parcalar.push(`tarih: ${s.baslangicGun || "başlangıç"} – ${s.bitisGun || "bugün"}`);
  if (s.sorgu) parcalar.push(`arama: "${s.sorgu}"`);
  return parcalar.length === 0 ? "Süzgeç yok — tüm kayıtlar." : parcalar.join(" · ");
}

/* ── biçimlendirme ────────────────────────────────────────────────────────── */

/** `2026-08-07T14:32:10.000Z` → `2026-08-07 14:32`. Boşsa tire. */
export function zamanMetni(iso?: string): string {
  return iso ? iso.slice(0, 16).replace("T", " ") : "—";
}

export function sureMetni(sn?: number): string {
  if (sn === undefined || sn <= 0) return "—";
  if (sn < 60) return `${sn} sn`;
  const dk = Math.round(sn / 60);
  return dk < 90 ? `${dk} dk` : `${Math.floor(dk / 60)} sa ${dk % 60} dk`;
}

/** Sayfalama — sınır dışına taşan sayfa numarası sessizce geri çekilir. */
export function sayfala<T>(liste: T[], sayfa: number, boyut: number): { gorunen: T[]; gecerliSayfa: number; sonSayfa: number } {
  const sonSayfa = Math.max(1, Math.ceil(liste.length / boyut));
  const gecerliSayfa = Math.min(Math.max(1, sayfa), sonSayfa);
  return { gorunen: liste.slice((gecerliSayfa - 1) * boyut, gecerliSayfa * boyut), gecerliSayfa, sonSayfa };
}

/* ── pano kırılımları ─────────────────────────────────────────────────────── */

export interface Kirilim {
  ad: string;
  toplam: number;
  acik: number;
  /** Tamamlanma yüzdesi (0-100). Toplam sıfırsa 0. */
  oran: number;
}

/**
 * Ada göre grupla, açık/kapalı say.
 *
 * TEK FONKSİYON, ÜÇ KIRILIM: bölüm, kategori ve zorunluluk aynı hesabı ister.
 * Üçünü ayrı ayrı yazmak, birinde düzeltilen yuvarlama hatasının diğer ikisinde
 * kalması demekti.
 */
export function kirilimCikar(olculer: { ad: string; acik: boolean }[]): Kirilim[] {
  const kutu = new Map<string, { toplam: number; acik: number }>();
  for (const o of olculer) {
    const k = kutu.get(o.ad) ?? { toplam: 0, acik: 0 };
    k.toplam++;
    if (o.acik) k.acik++;
    kutu.set(o.ad, k);
  }
  return [...kutu.entries()]
    .map(([ad, k]) => ({ ad, toplam: k.toplam, acik: k.acik, oran: Math.round(((k.toplam - k.acik) / k.toplam) * 100) }))
    .sort((a, b) => b.acik - a.acik || a.ad.localeCompare(b.ad, "tr"));
}

export interface AyOzeti {
  /** `YYYY-AA`. */
  ay: string;
  gecti: number;
  kaldi: number;
  toplam: number;
}

/** `2026-01` + (-1) → `2025-12`. Ay taşması elle yürütülür (Date kurmaya değmez). */
export function ayKaydir(ay: string, adim: number): string {
  const yil = Number(ay.slice(0, 4));
  const no = Number(ay.slice(5, 7)) - 1 + adim;
  const yeniYil = yil + Math.floor(no / 12);
  const yeniAy = ((no % 12) + 12) % 12;
  return `${yeniYil}-${String(yeniAy + 1).padStart(2, "0")}`;
}

/**
 * Aylık tamamlanma seyri.
 *
 * BOŞ AYLAR DA DÖNER: yalnız kaydı olan aylar listelenseydi, hiç eğitim
 * verilmeyen ay grafikte hiç görünmez ve seyir kesintisiz gibi okunurdu —
 * oysa anlatmak istediğimiz şey tam da o boşluk.
 */
export function aylikTrend(
  satirlar: Pick<KayitSatiri, "bitis" | "sonuc">[],
  sonAy: string,
  adet = 12,
): AyOzeti[] {
  const kutu = new Map<string, { gecti: number; kaldi: number }>();
  for (const k of satirlar) {
    if (!k.bitis || (k.sonuc !== "gecti" && k.sonuc !== "kaldi")) continue;
    const ay = k.bitis.slice(0, 7);
    const s = kutu.get(ay) ?? { gecti: 0, kaldi: 0 };
    if (k.sonuc === "gecti") s.gecti++;
    else s.kaldi++;
    kutu.set(ay, s);
  }

  const cikti: AyOzeti[] = [];
  for (let i = adet - 1; i >= 0; i--) {
    const ay = ayKaydir(sonAy, -i);
    const s = kutu.get(ay) ?? { gecti: 0, kaldi: 0 };
    cikti.push({ ay, gecti: s.gecti, kaldi: s.kaldi, toplam: s.gecti + s.kaldi });
  }
  return cikti;
}

const AY_ADI = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

export function ayEtiketi(ay: string): string {
  return `${AY_ADI[Number(ay.slice(5, 7)) - 1] ?? ay.slice(5, 7)} ${ay.slice(2, 4)}`;
}
