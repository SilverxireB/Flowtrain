import { ayarOku } from "../depo";

/**
 * OPM YAPILANDIRMASI — adresi KODA GÖMMEYEN tek yer.
 *
 * Kapalı ağ ürünüyüz: OPM'in adresi her fabrikada başkadır ve bizim
 * makinemizde hiç yoktur. Bu yüzden hiçbir adres, hiçbir uç nokta, hiçbir
 * anahtar kaynak koduna yazılmaz — hepsi kurulumda `ayar` tablosuna girilir
 * (`/ayarlar` → "Personel kaynağı ve kayıt hedefi"). Koda gömülen tek şey
 * ANAHTAR ADLARI ve göreli yol varsayılanlarıdır.
 *
 * `tests/sinir.test.mjs` kaynakta dış alan adı arar; buraya örnek bir adres
 * yazmak sınavı düşürür. Örnekler belgede (`docs/OPM-ENTEGRASYON.md`) durur.
 */

export const OPM_AYAR = {
  /** `https?://ana-makine:port` — sonunda eğik çizgi yok. */
  temelAdres: "opmTemelAdres",
  /** Kimliğin taşındığı HTTP başlığı (ör. bir API anahtarı başlığı). */
  kimlikBasligi: "opmKimlikBasligi",
  /** Başlığın değeri. SIR: denetim izine ve ekrana asla yazılmaz. */
  kimlikAnahtari: "opmKimlikAnahtari",
  /** Personel listesi uç noktası — temel adrese eklenir. */
  personelYolu: "opmPersonelYolu",
  /** Eğitim kaydı uç noktası — temel adrese eklenir. */
  kayitYolu: "opmKayitYolu",
  /** Tek istek için üst sınır (ms). */
  zamanAsimiMs: "opmZamanAsimiMs",
  /** Personel listesinin önbellekte taze sayıldığı süre (dakika). */
  onbellekDk: "opmOnbellekDk",
} as const;

export interface OpmYapilandirma {
  temelAdres: string;
  kimlikBasligi: string;
  kimlikAnahtari: string;
  personelYolu: string;
  kayitYolu: string;
  zamanAsimiMs: number;
  onbellekDk: number;
}

/**
 * Varsayılanlar. Yol varsayılanları GÖRELİdir; fabrika kendi uç noktasını
 * yazana kadar bunlar kullanılır ve hiçbir adres oluşturmazlar.
 */
export const OPM_VARSAYILAN = {
  kimlikBasligi: "X-API-Key",
  personelYolu: "/api/personel",
  kayitYolu: "/api/egitim-kaydi",
  zamanAsimiMs: 8000,
  onbellekDk: 10,
} as const;

/** Ayardaki sayı bozuksa kurulumu kilitlemek yerine varsayılana düşülür. */
function sayiOku(anahtar: string, varsayilan: number, enAz: number): number {
  const ham = Number.parseInt(ayarOku(anahtar, ""), 10);
  return Number.isFinite(ham) && ham >= enAz ? ham : varsayilan;
}

export function opmYapilandirmaOku(): OpmYapilandirma {
  return {
    temelAdres: ayarOku(OPM_AYAR.temelAdres, "").trim().replace(/\/+$/, ""),
    kimlikBasligi: ayarOku(OPM_AYAR.kimlikBasligi, OPM_VARSAYILAN.kimlikBasligi).trim(),
    kimlikAnahtari: ayarOku(OPM_AYAR.kimlikAnahtari, "").trim(),
    personelYolu: ayarOku(OPM_AYAR.personelYolu, OPM_VARSAYILAN.personelYolu).trim(),
    kayitYolu: ayarOku(OPM_AYAR.kayitYolu, OPM_VARSAYILAN.kayitYolu).trim(),
    zamanAsimiMs: sayiOku(OPM_AYAR.zamanAsimiMs, OPM_VARSAYILAN.zamanAsimiMs, 500),
    onbellekDk: sayiOku(OPM_AYAR.onbellekDk, OPM_VARSAYILAN.onbellekDk, 0),
  };
}

/**
 * Yapılandırmanın hangi parçası eksik — İNSAN DİLİNDE.
 *
 * Boş liste = "takılabilir". Kimlik anahtarı BİLEREK zorunlu değil: bazı
 * kurumlar servisi ağ seviyesinde (IP kısıtı) korur, anahtar istemez.
 */
export function opmEksikleri(y: OpmYapilandirma, yol: "personel" | "kayit"): string[] {
  const eksik: string[] = [];
  if (!y.temelAdres) eksik.push("OPM adresi girilmemiş");
  else if (!/^https?:\/\/[^\s/]+/i.test(y.temelAdres)) eksik.push("OPM adresi http:// ya da https:// ile başlamıyor");

  const hedef = yol === "personel" ? y.personelYolu : y.kayitYolu;
  const ad = yol === "personel" ? "Personel uç noktası" : "Kayıt uç noktası";
  if (!hedef) eksik.push(`${ad} girilmemiş`);
  else if (!hedef.startsWith("/")) eksik.push(`${ad} '/' ile başlamalı`);

  if (y.kimlikAnahtari && !y.kimlikBasligi) eksik.push("Kimlik anahtarı var ama başlık adı boş");
  return eksik;
}

/**
 * YAPILANDIRMA HATASI ile AĞ HATASI ayrı şeylerdir ve ayrı davranırlar:
 * ağ hatasında son bilinen listeye düşeriz, yapılandırma hatasında DÜŞMEYİZ —
 * eksik kurulum "çalışıyor gibi" görünmemeli.
 */
export class OpmYapilandirmaHatasi extends Error {
  readonly eksikler: string[];
  constructor(eksikler: string[]) {
    super(`OPM yapılandırması eksik: ${eksikler.join(" · ")}. /ayarlar → Personel kaynağı ve kayıt hedefi.`);
    this.name = "OpmYapilandirmaHatasi";
    this.eksikler = eksikler;
  }
}

/** Temel adres + göreli yol. Adres yapılandırmadan gelir, koddan DEĞİL. */
export function opmAdres(y: OpmYapilandirma, yol: string): string {
  return y.temelAdres + (yol.startsWith("/") ? yol : `/${yol}`);
}

/** Kimlik başlığı yalnız anahtar doluysa eklenir — boş başlık göndermek bazı sunucularda 400 döndürür. */
export function opmBasliklari(y: OpmYapilandirma, ek?: Record<string, string>): Record<string, string> {
  const basliklar: Record<string, string> = { Accept: "application/json", ...ek };
  if (y.kimlikAnahtari && y.kimlikBasligi) basliklar[y.kimlikBasligi] = y.kimlikAnahtari;
  return basliklar;
}

/**
 * Hata metnini okunur kılar. `fetch` kapalı ağda çoğu zaman yalnız
 * "fetch failed" der; yöneticiye bu tek başına hiçbir şey anlatmaz.
 */
export function opmHataMetni(h: unknown): string {
  if (h instanceof OpmYapilandirmaHatasi) return h.message;
  if (h instanceof Error) {
    if (h.name === "TimeoutError" || h.name === "AbortError") return "OPM zaman aşımına uğradı (servis yanıt vermedi).";
    const sebep = (h as { cause?: { code?: string } }).cause?.code;
    if (sebep) return `OPM'e ulaşılamadı (${sebep}).`;
    return h.message || "OPM'e ulaşılamadı.";
  }
  return String(h);
}
