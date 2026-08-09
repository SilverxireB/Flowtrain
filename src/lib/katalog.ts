/**
 * KATALOG VE PAKET ÖZETLERİ — saf mantık.
 *
 * NEDEN AYRI DOSYA: "kaç kişiye atandı / kaçı tamamladı" sorusunun cevabı üç
 * ayrı ekranda (katalog, paket listesi, ileride rapor) çıkıyor. Üçünde ayrı
 * hesaplanırsa üç farklı sayı görünür ve hangisinin doğru olduğu tartışılır.
 * Hesap burada, veritabanına hiç bakmadan yapılır — atama satırları girdi,
 * özet çıktıdır; sınav yazmak için veritabanı kurmak gerekmez (`kurallar.ts`
 * ile aynı gerekçe).
 *
 * "TAMAM"IN TANIMI TEK YERDEN gelir: `acikMi()` — amirin ilgilenmesi gereken
 * durumlar açıktır, kalanı tamamdır. Burada ikinci bir tanım yazılsaydı
 * katalogdaki oran panodakiyle tutmazdı.
 */
import { acikMi, type AtamaDurumu } from "./kurallar";

/** Özet için yeten en dar satır — `AtamaSatiri`nin alt kümesi. */
export interface OzetSatiri {
  sicil: string;
  egitimId: string;
  durum: AtamaDurumu;
}

export interface EgitimOzeti {
  /** Bu eğitimin düştüğü kişi sayısı. */
  kisi: number;
  /** Tamamlamış (açık durumu olmayan) kişi sayısı. */
  tamam: number;
  /** Tamamlanma yüzdesi (0 kişide 0). */
  oran: number;
}

/** Eğitim kimliği → özet. Atanmamış eğitimler haritada HİÇ görünmez. */
export function egitimOzetleri(satirlar: OzetSatiri[]): Record<string, EgitimOzeti> {
  const cikti: Record<string, EgitimOzeti> = {};
  for (const s of satirlar) {
    const o = cikti[s.egitimId] ?? { kisi: 0, tamam: 0, oran: 0 };
    o.kisi++;
    if (!acikMi(s.durum)) o.tamam++;
    cikti[s.egitimId] = o;
  }
  for (const id of Object.keys(cikti)) {
    const o = cikti[id];
    o.oran = o.kisi === 0 ? 0 : Math.round((o.tamam / o.kisi) * 100);
  }
  return cikti;
}

export interface PaketOzeti {
  /** Paketten EN AZ BİR eğitim düşen kişi sayısı. */
  kisi: number;
  /** Kendisine düşen paket eğitimlerinin HEPSİNİ tamamlamış kişi sayısı. */
  bitiren: number;
  /** Kişi × eğitim toplam atama ve bunun tamamlanan kısmı. */
  toplamAtama: number;
  tamamAtama: number;
  /** Atama bazında tamamlanma yüzdesi. */
  oran: number;
  /** Kişi başına ortalama "kaç eğitimden kaçı" — ör. 5 eğitimin 3'ü. */
  ortalamaTamam: number;
  ortalamaToplam: number;
}

/**
 * Bir paketin ilerlemesi.
 *
 * İKİ AYRI SAYI VERİLİR, bilerek: "atamaların %80'i tamam" ile "kişilerin
 * %20'si paketi bitirdi" aynı veriden çıkar ama farklı şey söyler. Oryantasyonda
 * önemli olan İKİNCİSİDİR — beş eğitimin dördünü bitiren kişi hâlâ hatta
 * çıkamaz. Yalnız yüzdeyi göstermek paketi bitmiş gibi gösterirdi.
 *
 * Paydaya, paket eğitimi kendisine DÜŞEN kişiler girer. Fabrikanın tamamına
 * bölünseydi, yalnız kaynakçılara atanan bir paket %2 tamamlanmış görünürdü.
 */
export function paketOzeti(satirlar: OzetSatiri[], egitimIdleri: string[]): PaketOzeti {
  const uyeler = new Set(egitimIdleri);
  const kisiler = new Map<string, { toplam: number; tamam: number }>();
  for (const s of satirlar) {
    if (!uyeler.has(s.egitimId)) continue;
    const k = kisiler.get(s.sicil) ?? { toplam: 0, tamam: 0 };
    k.toplam++;
    if (!acikMi(s.durum)) k.tamam++;
    kisiler.set(s.sicil, k);
  }

  let toplamAtama = 0;
  let tamamAtama = 0;
  let bitiren = 0;
  for (const k of kisiler.values()) {
    toplamAtama += k.toplam;
    tamamAtama += k.tamam;
    if (k.tamam === k.toplam) bitiren++;
  }
  const kisi = kisiler.size;
  return {
    kisi,
    bitiren,
    toplamAtama,
    tamamAtama,
    oran: toplamAtama === 0 ? 0 : Math.round((tamamAtama / toplamAtama) * 100),
    ortalamaTamam: kisi === 0 ? 0 : Math.round((tamamAtama / kisi) * 10) / 10,
    ortalamaToplam: kisi === 0 ? 0 : Math.round((toplamAtama / kisi) * 10) / 10,
  };
}
