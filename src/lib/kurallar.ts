/**
 * ATAMA KURAL MOTORU — saf mantık.
 *
 * Atama kişi kişi YAPILMAZ, kural yazılır. Sebebi: kişi kişi atama bir kereye
 * mahsus kampanyadır; yeni giren personel hiçbir eğitime atanmaz ve kimse fark
 * etmez. Kural yazılınca personel listesine düşen kişi kendiliğinden kapsanır.
 *
 * Sınav: `node tests/kurallar.test.mjs`
 */
import type { Egitim, Kisi, Kural, Oturum } from "./tipler";

/** "Süresi doluyor" uyarısının kaç gün önceden çıkacağı. */
export const UYARI_GUN = 30;

const GUN_MS = 86_400_000;

export function gunEkle(tarih: string, gun: number): string {
  const d = new Date(tarih + (tarih.length === 10 ? "T00:00:00Z" : ""));
  return new Date(d.getTime() + gun * GUN_MS).toISOString().slice(0, 10);
}

export function ayEkle(tarih: string, ay: number): string {
  const d = new Date(tarih + (tarih.length === 10 ? "T00:00:00Z" : ""));
  const s = new Date(d);
  s.setUTCMonth(s.getUTCMonth() + ay);
  return s.toISOString().slice(0, 10);
}

export function gunFarki(a: string, b: string): number {
  const t = (s: string) => new Date(s + (s.length === 10 ? "T00:00:00Z" : "")).getTime();
  return Math.round((t(a) - t(b)) / GUN_MS);
}

/**
 * Kişi bu kuralın kapsamında mı?
 *
 * BOŞ KOŞUL = HERKES. Koşul dizisi boş/tanımsızsa o boyut süzmez; üç boyut da
 * boşsa kural tüm personeli kapsar (bilinçli: "tüm fabrika ISG eğitimi").
 * Verilen boyutlar VE ile bağlanır, boyut içindeki değerler VEYA ile.
 */
export function kapsamda(kisi: Kisi, kural: Kural): boolean {
  if (!kural.aktif) return false;
  const k = kural.kosul;
  return boyutUyar(k.bolum, kisi.bolum) && boyutUyar(k.hat, kisi.hat) && boyutUyar(k.gorev, kisi.gorev);
}

/**
 * Modül seviyesinde, kapanış DEĞİL — `csv.ts`teki küçültücü tuzağının aynısı
 * burada da mümkündü (parametre yakalayan, birden çok kez çağrılan yardımcı).
 */
function boyutUyar(secim: string[] | undefined, deger: string | undefined): boolean {
  return !secim || secim.length === 0 || (deger != null && secim.includes(deger));
}

/**
 * Bir kişinin bu kural için son tarihi.
 * `iseGirisIcindeGun` kişiye GÖRE hesaplanır (yeni girenin ilk 3 günü),
 * sabit `sonTarih` herkes için aynıdır. İkisi de varsa ERKEN olan geçerlidir —
 * yoksa yeni giren kişi altı ay sonraki kampanya tarihine kadar bekleyebilirdi.
 */
export function sonTarih(kisi: Kisi, kural: Kural): string | null {
  const adaylar: string[] = [];
  if (kural.sonTarih) adaylar.push(kural.sonTarih);
  if (kural.kosul.iseGirisIcindeGun != null && kisi.iseGiris) {
    adaylar.push(gunEkle(kisi.iseGiris, kural.kosul.iseGirisIcindeGun));
  }
  if (adaylar.length === 0) return null;
  return adaylar.sort()[0];
}

export type AtamaDurumu =
  | "tamam"
  | "suresiDoluyor"
  | "suresiDoldu"
  | "eksik"
  | "gecikti"
  | "kaldi";

export interface Atama {
  sicil: string;
  egitimId: string;
  sonTarih: string | null;
  durum: AtamaDurumu;
  /** Tekrar gerekiyorsa geçerliliğin bittiği gün. */
  gecerlilikBitis?: string;
  sonOturum?: Oturum;
}

/** Kişi × kural kesişimi — hangi eğitim kime düşüyor. */
export function atamalariCikar(kisiler: Kisi[], kurallar: Kural[]): { sicil: string; egitimId: string; sonTarih: string | null }[] {
  const cikti: { sicil: string; egitimId: string; sonTarih: string | null }[] = [];
  const gorulen = new Set<string>();
  for (const kisi of kisiler) {
    for (const kural of kurallar) {
      if (!kapsamda(kisi, kural)) continue;
      const anahtar = `${kisi.sicil}|${kural.egitimId}`;
      const st = sonTarih(kisi, kural);
      const mevcut = cikti.find((c) => `${c.sicil}|${c.egitimId}` === anahtar);
      if (mevcut) {
        // Aynı eğitim iki kuraldan da düşüyorsa ERKEN tarih geçerli.
        if (st && (!mevcut.sonTarih || st < mevcut.sonTarih)) mevcut.sonTarih = st;
        continue;
      }
      gorulen.add(anahtar);
      cikti.push({ sicil: kisi.sicil, egitimId: kural.egitimId, sonTarih: st });
    }
  }
  return cikti;
}

/**
 * Bir atamanın bugünkü durumu.
 *
 * Sıra önemli: önce GEÇERLİ bir "geçti" kaydı var mı diye bakılır; sonra
 * tekrar süresi; en son son tarih. "Kaldı" ayrı bir durumdur — eksikle
 * karıştırılırsa amir "hiç girmemiş" sanır, oysa girmiş ve kalmıştır.
 */
export function atamaDurumu(
  atama: { sicil: string; egitimId: string; sonTarih: string | null },
  oturumlar: Oturum[],
  egitim: Pick<Egitim, "tekrarAy">,
  bugun: string,
): Atama {
  const kendi = oturumlar
    .filter((o) => o.sicil === atama.sicil && o.egitimId === atama.egitimId && o.bitis)
    .sort((a, b) => (a.bitis! < b.bitis! ? 1 : -1));

  const sonGecti = kendi.find((o) => o.sonuc === "gecti");
  const son = kendi[0];

  if (sonGecti) {
    const bitisGunu = sonGecti.bitis!.slice(0, 10);
    if (egitim.tekrarAy) {
      const gecerlilikBitis = ayEkle(bitisGunu, egitim.tekrarAy);
      const kalan = gunFarki(gecerlilikBitis, bugun);
      if (kalan < 0) {
        return { ...atama, durum: "suresiDoldu", gecerlilikBitis, sonOturum: sonGecti };
      }
      if (kalan <= UYARI_GUN) {
        return { ...atama, durum: "suresiDoluyor", gecerlilikBitis, sonOturum: sonGecti };
      }
      return { ...atama, durum: "tamam", gecerlilikBitis, sonOturum: sonGecti };
    }
    return { ...atama, durum: "tamam", sonOturum: sonGecti };
  }

  if (son?.sonuc === "kaldi") return { ...atama, durum: "kaldi", sonOturum: son };
  if (atama.sonTarih && gunFarki(atama.sonTarih, bugun) < 0) return { ...atama, durum: "gecikti" };
  return { ...atama, durum: "eksik" };
}

/** Amirin ilgilenmesi gereken durumlar (pano ve tablet aynı tanımı kullanır). */
export const ACIK_DURUMLAR: AtamaDurumu[] = ["eksik", "gecikti", "kaldi", "suresiDoldu"];

export function acikMi(d: AtamaDurumu): boolean {
  return ACIK_DURUMLAR.includes(d);
}

export const DURUM_ETIKET: Record<AtamaDurumu, string> = {
  tamam: "Tamam",
  suresiDoluyor: "Süresi doluyor",
  suresiDoldu: "Süresi doldu",
  eksik: "Eksik",
  gecikti: "Gecikti",
  kaldi: "Kaldı",
};
