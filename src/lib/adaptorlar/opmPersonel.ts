import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { VERI_KLASORU } from "../db";
import { haritadanTuret, mmEslemeHaritasi, type MmTuretilen } from "./mmTuretme";
import {
  OpmYapilandirmaHatasi,
  opmAdres,
  opmBasliklari,
  opmEksikleri,
  opmHataMetni,
  opmYapilandirmaOku,
} from "./opmYapilandirma";
import type { PersonelKaynagi } from "../adaptor";
import type { Kisi } from "../tipler";

/**
 * OPM PERSONEL KAYNAĞI — İSKELET.
 *
 * BU DOSYA BAĞLANMAMIŞTIR. Yapılandırma boş geldiği sürece tek bir istek bile
 * çıkmaz; kurulum `personelKaynagi = "csv"` kaldığı sürece bu kod hiç
 * çalışmaz. Arçelik yazılımcısının dolduracağı tek yer `opmListesiniCek()`
 * içindeki yanıt çözümlemesidir — gerisi (önbellek, zaman aşımı, hata
 * davranışı, maliyet merkezi türetmesi) burada bitmiştir.
 *
 * BEKLENEN KAYIT ÜÇ ALANDIR: sicil · ad soyad · maliyet merkezi.
 * Bölüm ve amir OPM'den GELMEZ, `mmEsleme` tablosundan türetilir
 * (`mmTuretme.ts`). Servis bölüm/amir gönderse bile YOK SAYILIR: iki gerçek
 * yarışırsa her aktarım fabrikanın kendi eşlemesini ezer.
 *
 * Ayrıntılı sözleşme: `docs/OPM-ENTEGRASYON.md`.
 */

/* ── ağ hatası davranışı — ÜRÜN KARARI ────────────────────────────────────
   OPM'e ulaşılamadığında SON BİLİNEN LİSTE döner, boş liste DÖNMEZ.

   Neden: boş liste "kimse yok" demektir, "bilmiyorum" demez. Kiosk sicili
   tanımaz, amir tabletinde ekip boşalır, panoda tamamlanma oranı bir anda
   anlamsızlaşır — hepsi de OPM birkaç dakika yanıt vermediği için. Fabrika
   çalışmaya devam ediyorsa eğitim de devam etmelidir; iki saatlik bayat bir
   personel listesiyle eğitim vermek, hiç eğitim verememekten iyidir.

   Bayatlık gizlenmez: `opmPersonelDurumu()` son başarılı okumayı ve son hatayı
   verir, `/ayarlar` bunu yazar.

   Son bilinen liste DİSKE de yazılır (`<veri>/opm-personel-son.json`): süreç
   yeniden başladığında bellek önbelleği boştur ve OPM hâlâ kapalıysa fabrika
   yine kimseyi tanımazdı.

   Hiç başarılı okuma OLMAMIŞSA (ilk kurulum, disk anlık görüntüsü de yok)
   HATA FIRLATILIR. Burada boş liste dönmek, "OPM takıldı ve fabrikada kimse
   çalışmıyor" gibi görünürdü — sessiz yanlış, gürültülü hatadan beterdir. */

const ANLIK_GORUNTU = () => join(VERI_KLASORU, "opm-personel-son.json");

let onbellek: { zaman: number; kisiler: Kisi[] } | null = null;
/** sicil → maliyet merkezi. Çekirdek tipe girmeyen alanın adaptör içindeki yeri. */
const sicilMm = new Map<string, string>();
let sonBasariliOkuma: string | null = null;
let sonHata: { zaman: string; mesaj: string } | null = null;

/* ── yanıt çözümlemesi ────────────────────────────────────────────────────── */

/** Sarmalayıcı adları kurumdan kuruma değişir; dizi de gelebilir. */
function listeyiCikar(govde: unknown): unknown[] {
  if (Array.isArray(govde)) return govde;
  if (govde && typeof govde === "object") {
    for (const anahtar of ["veri", "data", "items", "kayitlar", "personel", "result"]) {
      const deger = (govde as Record<string, unknown>)[anahtar];
      if (Array.isArray(deger)) return deger;
    }
  }
  throw new Error("OPM yanıtı bir personel listesi içermiyor (dizi bekleniyordu).");
}

/** Alan adları için takma adlar — kurum dışa aktarımını bizim için değiştirmesin. */
const TAKMA = {
  sicil: ["sicil", "sicilNo", "personelNo", "registryNumber", "employeeId", "id"],
  ad: ["ad", "adSoyad", "adiSoyadi", "isim", "name", "fullName", "nameAndSurname"],
  maliyetMerkezi: ["maliyetMerkezi", "mm", "costCenter", "costCenterCode", "maliyetMerkeziKodu"],
  gorev: ["gorev", "görev", "unvan", "pozisyon", "title", "position", "role"],
  iseGiris: ["iseGiris", "işeGiriş", "girisTarihi", "hireDate", "startDate"],
  hat: ["hat", "line", "uretimHatti"],
} as const;

function alanOku(ham: Record<string, unknown>, adaylar: readonly string[]): string {
  for (const a of adaylar) {
    const v = ham[a];
    if (typeof v === "string" && v.trim() !== "") return v.trim();
    if (typeof v === "number") return String(v);
  }
  return "";
}

/**
 * Ham OPM kaydını çekirdeğin `Kisi`sine çevirir.
 * Sicilsiz kayıt ATILIR: kime ait olduğu bilinmeyen eğitim kaydı denetimde
 * hiçbir işe yaramaz.
 */
function kisiyeCevir(ham: Record<string, unknown>, harita: Map<string, MmTuretilen>): Kisi | null {
  const sicil = alanOku(ham, TAKMA.sicil);
  if (!sicil) return null;

  const mm = alanOku(ham, TAKMA.maliyetMerkezi);
  const turetilen = mm ? haritadanTuret(harita, mm) : null;

  return {
    sicil,
    ad: alanOku(ham, TAKMA.ad),
    // Bölüm ve amir YALNIZ eşlemeden gelir — servis ne gönderirse göndersin.
    bolum: turetilen?.bolum || undefined,
    amirSicil: turetilen?.amirSicil || undefined,
    hat: alanOku(ham, TAKMA.hat) || undefined,
    gorev: alanOku(ham, TAKMA.gorev) || undefined,
    iseGiris: alanOku(ham, TAKMA.iseGiris) || undefined,
  };
}

/* ── ağ ────────────────────────────────────────────────────────────────────
   Adres, başlık ve zaman aşımı yapılandırmadan gelir; bu dosyada hiçbir
   adres yazılı değildir. */

async function opmGovdesiniAl(yol: string): Promise<unknown> {
  const y = opmYapilandirmaOku();
  const eksik = opmEksikleri(y, "personel");
  if (eksik.length > 0) throw new OpmYapilandirmaHatasi(eksik);

  const yanit = await fetch(opmAdres(y, yol), {
    method: "GET",
    headers: opmBasliklari(y),
    cache: "no-store",
    signal: AbortSignal.timeout(y.zamanAsimiMs),
  });
  if (!yanit.ok) {
    const kuyruk = (await yanit.text().catch(() => "")).slice(0, 200);
    throw new Error(`OPM ${yanit.status} ${yanit.statusText}${kuyruk ? ` — ${kuyruk}` : ""}`);
  }
  return yanit.json();
}

/**
 * OPM'den TAM listeyi çeker. Başarısızlıkta HATA FIRLATIR — yutmak buradaki
 * tek yasak. Çağıran (`kisileriGetir`) hatayı görüp son bilinen listeye düşer.
 *
 * ARÇELİK YAZILIMCISINA: sayfalama gerekiyorsa (OPM 500'er kayıt döndürüyorsa)
 * döngü BURAYA girer; `kisileriGetir` ve aşağısı değişmez.
 */
async function opmListesiniCek(): Promise<Kisi[]> {
  const y = opmYapilandirmaOku();
  const ham = listeyiCikar(await opmGovdesiniAl(y.personelYolu));
  const harita = mmEslemeHaritasi();

  const kisiler: Kisi[] = [];
  /* Maliyet merkezi `Kisi`ye GİRMEZ (çekirdek OPM alanı tanımaz) ama
     `/personel` ekranının o sütuna ihtiyacı var. Sicil → kod eşlemesi burada,
     adaptörün içinde tutuluyor; çekirdek yine yalnız bölüm ve amir görüyor. */
  sicilMm.clear();
  for (const satir of ham) {
    if (!satir || typeof satir !== "object") continue;
    const ozgun = satir as Record<string, unknown>;
    const kisi = kisiyeCevir(ozgun, harita);
    if (!kisi) continue;
    kisiler.push(kisi);
    const mm = alanOku(ozgun, TAKMA.maliyetMerkezi);
    if (mm) sicilMm.set(kisi.sicil, mm);
  }
  // Boş liste BAŞARI SAYILMAZ: yanlış uç nokta çoğu zaman 200 + boş dizi
  // döner ve bu, fabrikada kimse yokmuş gibi görünürdü.
  if (kisiler.length === 0) throw new Error("OPM boş personel listesi döndürdü — uç nokta doğru mu?");
  return kisiler;
}

/* ── anlık görüntü (yeniden başlatmaya dayanıklı son bilinen liste) ───────── */

function anlikGoruntuYaz(kisiler: Kisi[]): void {
  try {
    writeFileSync(ANLIK_GORUNTU(), JSON.stringify({ zaman: new Date().toISOString(), kisiler }), "utf8");
  } catch {
    // Diske yazamamak eğitim vermeyi engellemez; bellek önbelleği yine çalışır.
  }
}

function anlikGoruntuOku(): { zaman: string; kisiler: Kisi[] } | null {
  const yol = ANLIK_GORUNTU();
  if (!existsSync(yol)) return null;
  try {
    const veri = JSON.parse(readFileSync(yol, "utf8")) as { zaman?: string; kisiler?: Kisi[] };
    if (!Array.isArray(veri.kisiler) || veri.kisiler.length === 0) return null;
    return { zaman: veri.zaman ?? "", kisiler: veri.kisiler };
  } catch {
    return null;
  }
}

/* ── önbellekli okuma ─────────────────────────────────────────────────────── */

function tazeMi(): boolean {
  if (!onbellek) return false;
  const omur = opmYapilandirmaOku().onbellekDk * 60_000;
  return Date.now() - onbellek.zaman < omur;
}

/**
 * Ekranların gördüğü tek okuma yolu.
 *
 * ÖNBELLEK ŞART: personel listesi her ekran açılışında okunuyor (hub, atama,
 * kayıtlar, ayarlar, her kiosk girişi). Her açılışta OPM'e gitmek hem servisi
 * döver hem ekranı ağ gecikmesine bağlar.
 */
async function kisileriGetir(): Promise<Kisi[]> {
  if (onbellek && tazeMi()) return onbellek.kisiler;

  try {
    const kisiler = await opmListesiniCek();
    onbellek = { zaman: Date.now(), kisiler };
    sonBasariliOkuma = new Date().toISOString();
    sonHata = null;
    anlikGoruntuYaz(kisiler);
    return kisiler;
  } catch (h) {
    sonHata = { zaman: new Date().toISOString(), mesaj: opmHataMetni(h) };

    // Yapılandırma eksikse BAYAT LİSTEYE DÜŞÜLMEZ: yarım kurulum "çalışıyor"
    // gibi görünmemeli, yönetici eksiği görüp tamamlamalı.
    if (h instanceof OpmYapilandirmaHatasi) throw h;

    if (onbellek) return onbellek.kisiler;

    const kayitli = anlikGoruntuOku();
    if (kayitli) {
      onbellek = { zaman: Date.now(), kisiler: kayitli.kisiler };
      return kayitli.kisiler;
    }

    // Hiç başarılı okuma yok: boş liste yerine hata. Bkz. dosya başındaki karar.
    throw new Error(`${sonHata.mesaj} Son bilinen personel listesi de yok — kurulum henüz bir kez bile OPM'i okumadı.`);
  }
}

/* ── dışarı verilen yüz ───────────────────────────────────────────────────── */

export const opmPersonel: PersonelKaynagi = {
  ad: "OPM webservice",
  async listele() {
    return kisileriGetir();
  },
  async bul(sicil) {
    const temiz = sicil.trim();
    return (await kisileriGetir()).find((k) => k.sicil === temiz) ?? null;
  },
  async ekip(amirSicil) {
    return (await kisileriGetir()).filter((k) => k.amirSicil === amirSicil);
  },
  tazele() {
    onbellek = null;
  },
  /**
   * Ekranın gördüğü tam kayıt — maliyet merkezi dahil.
   *
   * `listele()` çekirdek tipi `Kisi`yi döner ve maliyet merkezi orada yoktur.
   * `/personel` bu sütunu `yonetim`den okuyordu; OPM'de `yonetim` olmadığı
   * için liste BOŞ kalıyordu. "Düzenlenemez" ile "hiç kayıt yok" bambaşka
   * şeyler: biri bilgi verir, öteki kurulumu bozuk gösterir.
   */
  async kayitlar() {
    return (await kisileriGetir()).map((k) => ({
      sicil: k.sicil,
      ad: k.ad,
      maliyetMerkezi: sicilMm.get(k.sicil) ?? "",
      gorev: k.gorev ?? "",
      bolum: k.bolum ?? "",
      amirSicil: k.amirSicil ?? "",
      hat: k.hat ?? "",
      iseGiris: k.iseGiris ?? "",
    }));
  },
  /**
   * `yonetim` BİLEREK YOK.
   *
   * OPM tek yönlü okunur: personeli FlowTrain'den düzenlemek, kurumun İK
   * gerçeğinin yanına ikinci bir gerçek koymak olurdu — ilk senkronda o el
   * emeği silinir ve kimse silindiğini fark etmez. Alan boş kalınca
   * `/personel` ekranı kendini SALT OKUNUR gösterir; ekran adaptöre "sen kimsin"
   * diye SORMAZ, yalnız bu yeteneğe bakar. Sınırın çalıştığının kanıtı budur:
   * bu satırı eklememek için hiçbir ekranda tek satır değişmedi.
   *
   * Bir gün OPM yazma uçları açarsa `PersonelYonetimi` burada uygulanır ve
   * ekran kendiliğinden düzenlenebilir hâle gelir — yine hiçbir ekran değişmez.
   */
};

/* ── `/ayarlar` için durum ve sınama ──────────────────────────────────────── */

export interface OpmPersonelDurumu {
  onbelleklenmisKisi: number;
  sonBasariliOkuma: string | null;
  sonHata: { zaman: string; mesaj: string } | null;
  anlikGoruntuVar: boolean;
}

export function opmPersonelDurumu(): OpmPersonelDurumu {
  return {
    onbelleklenmisKisi: onbellek?.kisiler.length ?? 0,
    sonBasariliOkuma,
    sonHata,
    anlikGoruntuVar: anlikGoruntuOku() !== null,
  };
}

/**
 * "Bağlantıyı sına" düğmesinin arkası.
 *
 * Yapılandırma eksikse AĞA ÇIKMAZ, NEyin eksik olduğunu söyler — kapalı ağda
 * "bağlanamadı" mesajı çoğu zaman yanlış teşhise götürür.
 */
export async function opmPersonelSina(): Promise<{ iyi: boolean; mesaj: string }> {
  const y = opmYapilandirmaOku();
  const eksik = opmEksikleri(y, "personel");
  if (eksik.length > 0) return { iyi: false, mesaj: `Eksik yapılandırma — ${eksik.join(" · ")}` };

  try {
    const kisiler = await opmListesiniCek();
    const eslemesiz = kisiler.filter((k) => !k.bolum && !k.amirSicil).length;
    const not = eslemesiz > 0 ? ` ${eslemesiz} kişinin maliyet merkezi eşlemesi tanımsız (bölüm/amir boş).` : "";
    return { iyi: true, mesaj: `Bağlantı başarılı: ${kisiler.length} kişi okundu.${not}` };
  } catch (h) {
    return { iyi: false, mesaj: opmHataMetni(h) };
  }
}
