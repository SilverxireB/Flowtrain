/**
 * ZİYARETÇİ DEFTERİNİN ÇIKTISI ve KVKK SAKLAMA SÜRESİ — saf mantık.
 *
 * Bugüne kadar ziyaretçi kayıtları veritabanında duruyor ama dışarı hiç
 * çıkmıyordu. İki eksik vardı ve ikisi aynı madalyonun yüzleri:
 *
 *  · ÇIKTI — "geçen ay kimler geldi, neyi izlediler" sorusu denetimde sorulur
 *    ve cevabı ekrandan okunamaz. CSV denetim BELGESİdir (tam liste, Excel'de
 *    süzülür); PDF okunacak ÖZETtir.
 *  · SAKLAMA — ziyaretçinin adı kişisel veridir ve amacı bitince tutulmaz.
 *    Fabrikanın belirlediği günden eski kayıt SİLİNİR; silinme denetim izine
 *    düşer, yoksa "veriyi biz mi sildik, hiç mi girmedik" tartışması çıkar.
 *
 * Karar mantığı burada, veritabanı bağlantısı `ziyaretciDepo.ts`te.
 *
 * Sınav: `node tests/ziyaretciCikti.test.mjs`
 */
import type { Ziyaretci, ZiyaretciDurum } from "./ziyaretci";
import { ZIYARETCI_DURUM_ETIKET } from "./ziyaretci";

/* ── saklama süresi (KVKK) ───────────────────────────────────────────────── */

/**
 * Varsayılan SIFIR = temizlik KAPALI.
 *
 * Bilerek: kurulumdan sonra kimsenin haberi olmadan kayıt silen bir ürün, bir
 * gün "geçen yılki ziyaretçi listesini ver" dendiğinde savunulamaz. Süreyi
 * fabrika BİLEREK açar; açılana kadar hiçbir şey silinmez.
 */
export const SAKLAMA_KAPALI = 0;

/** Ekrandaki hazır seçenekler — serbest sayı istemek kimseye yardım etmiyor. */
export const SAKLAMA_SECENEKLERI: { gun: number; etiket: string }[] = [
  { gun: SAKLAMA_KAPALI, etiket: "Sınırsız (temizlik kapalı)" },
  { gun: 30, etiket: "30 gün" },
  { gun: 90, etiket: "90 gün" },
  { gun: 180, etiket: "6 ay" },
  { gun: 365, etiket: "1 yıl" },
  { gun: 730, etiket: "2 yıl" },
];

/**
 * Serbest metinden gün sayısı. Negatif, ondalık ve saçma büyük değerler
 * kırpılır: ayar kutusuna elle "-5" yazan kişi bütün defteri silmesin.
 */
export function saklamaGunuTemizle(ham: unknown): number {
  const n = Math.floor(Number(ham));
  if (!Number.isFinite(n) || n <= 0) return SAKLAMA_KAPALI;
  return Math.min(n, 3650);
}

/**
 * Bu tarihten ESKİ kayıtlar silinir (ISO damga). Temizlik kapalıysa null.
 * Sınır dahil değildir: tam sınırdaki kayıt DURUR — silme kararında şüphe
 * her zaman kaydın lehinedir.
 */
export function saklamaSiniri(gun: number, simdiIso: string): string | null {
  const g = saklamaGunuTemizle(gun);
  if (g === SAKLAMA_KAPALI) return null;
  const t = Date.parse(simdiIso);
  if (!Number.isFinite(t)) return null;
  return new Date(t - g * 86_400_000).toISOString();
}

/* ── dışa aktarım satırları ──────────────────────────────────────────────── */

export const ZIYARETCI_BASLIKLARI: { anahtar: string; etiket: string }[] = [
  { anahtar: "ad", etiket: "Ad soyad" },
  { anahtar: "firma", etiket: "Firma" },
  { anahtar: "ziyaretEttigi", etiket: "Ziyaret ettiği" },
  { anahtar: "kayit", etiket: "Kayıt" },
  { anahtar: "durum", etiket: "Durum" },
  { anahtar: "ilerleme", etiket: "İlerleme" },
  { anahtar: "bilgilendirmeler", etiket: "Bilgilendirmeler" },
  { anahtar: "tamamlanma", etiket: "Tamamlanma" },
  { anahtar: "kaydeden", etiket: "Kaydeden" },
];

export interface CiktiKaydi {
  ziyaretci: Ziyaretci;
  durum: ZiyaretciDurum;
  biten: number;
  toplam: number;
  /** Eğitim adları — kimlikleri değil; denetimde kimlik hiçbir şey anlatmaz. */
  egitimAdlari: string[];
}

/**
 * Damgayı okunur hâle getirir: `2026-08-07T09:12:00.000Z` → `2026-08-07 09:12`.
 * Excel'de sıralanabilir kalsın diye ISO düzeni korunur; T ve saniye gider.
 */
export function damgaKisalt(iso: string | undefined): string {
  if (!iso) return "";
  return iso.slice(0, 16).replace("T", " ");
}

export function ziyaretciSatirlari(kayitlar: CiktiKaydi[]): Record<string, unknown>[] {
  const cikti: Record<string, unknown>[] = [];
  for (const k of kayitlar) {
    cikti.push({
      ad: k.ziyaretci.ad,
      firma: k.ziyaretci.firma ?? "",
      ziyaretEttigi: k.ziyaretci.ziyaretEttigi ?? "",
      kayit: damgaKisalt(k.ziyaretci.kayitZamani),
      durum: ZIYARETCI_DURUM_ETIKET[k.durum],
      ilerleme: `${k.biten}/${k.toplam}`,
      // Tek hücrede birden çok ad: CSV kaçırma `csv.ts`te yapılıyor, burada
      // yalnız okunur bir ayraç seçiliyor (noktalı virgül ayırıcı olduğu için
      // araya konmaz — hücreyi ikiye bölerdi).
      bilgilendirmeler: k.egitimAdlari.join(" | "),
      tamamlanma: damgaKisalt(k.ziyaretci.tamamlanma),
      kaydeden: k.ziyaretci.kaydeden,
    });
  }
  return cikti;
}

/** PDF/CSV başlığındaki özet — "12 ziyaretçi · 10 tamamlandı · 2 yarım". */
export function ciktiOzeti(kayitlar: CiktiKaydi[]): { toplam: number; tamam: number; yarim: number } {
  let tamam = 0;
  let yarim = 0;
  for (const k of kayitlar) {
    if (k.durum === "tamam") tamam++;
    else yarim++;
  }
  return { toplam: kayitlar.length, tamam, yarim };
}
