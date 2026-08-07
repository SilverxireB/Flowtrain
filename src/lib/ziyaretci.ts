/**
 * ZİYARETÇİ MANTIĞI — saf (yan etkisiz), sunucu bağımlılığı yok.
 *
 * Ziyaretçi ÇALIŞAN DEĞİLDİR ve personel listesine hiç karışmaz: sicili yok,
 * amiri yok, atama kuralı görmez, PIN'i yok, panoya düşmez. Kendi defterinde
 * yaşar. Bu ayrım bilinçli — ziyaretçiyi personel gibi kaydetmek, fabrikanın
 * tamamlanma oranını her ay yüzlerce misafirle sulandırırdı.
 *
 * BURADAKİ TEK GERÇEK KARAR: kayıt ekranındaki cevaplardan hangi
 * bilgilendirmelerin verileceği. Bunu veritabanına yapıştırmamak lazım, yoksa
 * sınav yazmak için veritabanı kurmak gerekir.
 *
 * Sınav: `node tests/ziyaretci.test.mjs`
 */

export type ZiyaretciSoruTipi = "evetHayir" | "tekSecim" | "cokluSecim";

export const ZIYARETCI_SORU_ETIKET: Record<ZiyaretciSoruTipi, string> = {
  evetHayir: "Evet / Hayır",
  tekSecim: "Tek seçim",
  cokluSecim: "Çoklu seçim",
};

/**
 * Kayıt ekranında sorulan soru.
 *
 * `eslesme` şık indeksini eğitim kimliklerine bağlar: "Yüksekte çalışacak
 * mısınız?" → Evet(0) → yüksekte çalışma bilgilendirmesi. Kodda değil VERİDE
 * durur; her fabrika kendi sorusunu yazar, yazılımcı çağırmaya gerek kalmaz.
 */
export interface ZiyaretciSoru {
  id: string;
  sira: number;
  metin: string;
  tip: ZiyaretciSoruTipi;
  secenekler: string[];
  /** Şık indeksi (metin anahtar) → o şık işaretlenince eklenecek eğitimler. */
  eslesme: Record<string, string[]>;
  aktif: boolean;
}

export interface Ziyaretci {
  id: string;
  ad: string;
  firma?: string;
  ziyaretEttigi?: string;
  /** soruId → işaretlenen şık indeksleri. */
  cevaplar: Record<string, number[]>;
  /** Verilecek bilgilendirmeler — SIRA ÖNEMLİ, tablette bu sırayla akar. */
  egitimIdleri: string[];
  kayitZamani: string;
  tamamlanma?: string;
  kaydeden: string;
}

export interface ZiyaretciOturum {
  id: string;
  ziyaretciId: string;
  egitimId: string;
  egitimSurum: number;
  baslangic: string;
  bitis?: string;
  sayfaSureleri: Record<string, number>;
}

/**
 * Cevaplardan verilecek bilgilendirme listesini çıkarır.
 *
 * VARSAYILANLAR HER ZAMAN BAŞTA VE ÇIKARILAMAZ. "Genel İSG bilgilendirmesi"
 * gibi herkesi ilgilendiren şeyin kayıt yapanın insiyatifine bırakılması,
 * yoğun bir sabahta atlanacağı anlamına gelir — ve atlandığı gün kimse fark
 * etmez, kaza olana kadar.
 *
 * Sıra korunur ve tekrar elenir: aynı eğitim iki sorudan da gelebilir, kişiye
 * iki kez izletmenin anlamı yok.
 */
export function egitimleriCoz(
  varsayilanlar: string[],
  sorular: ZiyaretciSoru[],
  cevaplar: Record<string, number[]>,
): string[] {
  const cikti: string[] = [];
  const gorulen = new Set<string>();

  for (const id of varsayilanlar) {
    if (id && !gorulen.has(id)) {
      gorulen.add(id);
      cikti.push(id);
    }
  }

  // Soru sırası kullanıcıya gösterilen sırayla aynı olmalı; `sira` alanı
  // ekrandaki düzeni belirliyor, çıktı da onu izlesin.
  const sirali = [...sorular].filter((s) => s.aktif).sort((a, b) => a.sira - b.sira);
  for (const soru of sirali) {
    for (const secim of cevaplar[soru.id] ?? []) {
      for (const id of soru.eslesme[String(secim)] ?? []) {
        if (id && !gorulen.has(id)) {
          gorulen.add(id);
          cikti.push(id);
        }
      }
    }
  }
  return cikti;
}

/**
 * Bir soruya verilen cevap geçerli mi?
 * Boş bırakılan soru eğitim BAĞLAMAZ; "yüksekte çalışacak mısınız?" sorusunu
 * atlayan kişi yüksekte çalışma bilgilendirmesini almadan sahaya girerdi.
 */
export function cevapEksikMi(soru: ZiyaretciSoru, cevaplar: Record<string, number[]>): boolean {
  return (cevaplar[soru.id] ?? []).length === 0;
}

export function eksikSorular(sorular: ZiyaretciSoru[], cevaplar: Record<string, number[]>): ZiyaretciSoru[] {
  return sorular.filter((s) => s.aktif && cevapEksikMi(s, cevaplar));
}

export type ZiyaretciDurum = "bekliyor" | "basladi" | "tamam";

export const ZIYARETCI_DURUM_ETIKET: Record<ZiyaretciDurum, string> = {
  bekliyor: "Bekliyor",
  basladi: "Devam ediyor",
  tamam: "Tamamlandı",
};

export interface ZiyaretciIlerleme {
  durum: ZiyaretciDurum;
  biten: number;
  toplam: number;
  /** Sıradaki bilgilendirme — hepsi bittiyse null. */
  siradaki: string | null;
}

/**
 * Ziyaretçinin nerede olduğu.
 *
 * TAMAMLANMA, listedeki HER bilgilendirmenin bitmesidir. Ziyaretçi yarıda
 * bırakırsa listede kalır ve tekrar başlatılabilir — deneme hakkı yoktur,
 * çünkü burada ölçülen bir başarı değil, bir bilgilendirmenin yapılmış olması.
 */
export function ilerleme(egitimIdleri: string[], bitenEgitimIdleri: string[]): ZiyaretciIlerleme {
  const biten = new Set(bitenEgitimIdleri);
  const kalanlar = egitimIdleri.filter((id) => !biten.has(id));
  const bitenSayisi = egitimIdleri.length - kalanlar.length;

  return {
    durum: kalanlar.length === 0 && egitimIdleri.length > 0 ? "tamam" : bitenSayisi > 0 ? "basladi" : "bekliyor",
    biten: bitenSayisi,
    toplam: egitimIdleri.length,
    siradaki: kalanlar[0] ?? null,
  };
}

/** Aynı güne mi düşüyor — liste "bugün" kırılımını buradan yapar. */
export function ayniGun(zamanA: string, zamanB: string): boolean {
  return zamanA.slice(0, 10) === zamanB.slice(0, 10);
}

/**
 * Ad zorunlu, gerisi değil.
 *
 * BİLEREK AZ ALAN: ziyaretçi defterine ne kadar çok kişisel veri girerse o
 * kadar çok korunacak veri olur. İSG bilgilendirme kaydı için "kim, ne zaman,
 * neyi izledi" yeter — kimlik numarası istemiyoruz.
 */
export function kayitHatasi(ad: string): string | null {
  const temiz = ad.trim();
  if (temiz.length < 3) return "Ad soyad girin (en az 3 harf).";
  if (temiz.length > 80) return "Ad soyad çok uzun.";
  return null;
}
