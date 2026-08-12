import { ayarOku, egitimGetir, yayinGetir } from "../depo";
import type { KayitBaglami, KayitHedefi, PersonelKaynagi } from "../adaptor";
import type { Oturum } from "../tipler";
import { csvPersonel } from "./csvPersonel";
import { csvPersonelYonetim } from "./csvPersonelYonetim";
import { dosyaKayit } from "./dosyaKayit";
import { opmKayit, opmKayitSina } from "./opmKayit";
import { opmPersonel, opmPersonelDurumu, opmPersonelSina } from "./opmPersonel";
import { opmEksikleri, opmHataMetni, opmYapilandirmaOku } from "./opmYapilandirma";

/**
 * Etkin adaptörler — çekirdek YALNIZ buradan geçer.
 *
 * Seçim AYARDIR, kod değil: `personelKaynagi` ve `kayitHedefi` anahtarları
 * `/ayarlar` ekranından yazılır. Bir ekran `csvPersonel`i ya da `opmPersonel`i
 * doğrudan çağırıyorsa sınır sızmıştır (`tests/sinir.test.mjs` bunu ölçer).
 *
 * VARSAYILAN DEĞİŞMEZ: ayar yoksa ya da tanınmayan bir değer taşıyorsa CSV +
 * dosya kullanılır. Ürünün standart sürümü odur; yanlış yazılmış tek bir ayar
 * satırı kurulumu kilitlememeli.
 *
 * Ama "opm" AÇIKÇA seçilmişse SESSİZCE CSV'ye DÜŞÜLMEZ: eksik yapılandırma
 * gürültülü hata verir. Sessiz düşüş, entegrasyonun çalıştığı sanılırken
 * çalışmaması demektir — en pahalı hata biçimi.
 */

export const AYAR_PERSONEL_KAYNAGI = "personelKaynagi";
export const AYAR_KAYIT_HEDEFI = "kayitHedefi";

export type PersonelKaynagiSecimi = "csv" | "opm";
export type KayitHedefiSecimi = "dosya" | "opm";

export function personelKaynagiSecimi(): PersonelKaynagiSecimi {
  return ayarOku(AYAR_PERSONEL_KAYNAGI, "csv").trim().toLowerCase() === "opm" ? "opm" : "csv";
}

export function kayitHedefiSecimi(): KayitHedefiSecimi {
  return ayarOku(AYAR_KAYIT_HEDEFI, "dosya").trim().toLowerCase() === "opm" ? "opm" : "dosya";
}

export function personelKaynagi(): PersonelKaynagi {
  // OPM tek yönlü okunur: `yonetim` YOK, `/personel` kendini salt okunur
  // gösterir. Ekran bunu sormaz, yeteneğe bakar. `kayitlar` ise ayrı bir
  // yetenek: OPM'de de dolu, yoksa liste "düzenlenemez" değil BOŞ görünürdü.
  if (personelKaynagiSecimi() === "opm") return opmPersonel;
  return {
    ...csvPersonel,
    yonetim: csvPersonelYonetim,
    kayitlar: async () => csvPersonelYonetim.kayitlar(),
  };
}

export function kayitHedefi(): KayitHedefi {
  return kayitHedefiSecimi() === "opm" ? opmKayit : dosyaKayit;
}

/* ── gönderim ─────────────────────────────────────────────────────────────── */

/** Son başarısız gönderimin sebebi — `/ayarlar` "neden gitmedi"yi yazabilsin diye. */
let sonGonderimHatasi: { zaman: string; mesaj: string } | null = null;

export function sonKayitGonderimHatasi(): { zaman: string; mesaj: string } | null {
  return sonGonderimHatasi;
}

/**
 * Kaydın yanında gidecek okunur bilgileri çözer (`KayitBaglami`).
 *
 * BURADA ÇÖZÜLÜYOR, hedefin içinde değil: hedef "adı nereden bulurum" diye
 * personel kaynağına uzanırsa adaptör sınırı ters yönden delinir ve dosya
 * hedefi CSV/OPM ayrımını tanımak zorunda kalır.
 *
 * Eğitim adı KAYDIN SÜRÜMÜNDEN okunuyor: kayıt "sürüm 2"ye atıf yapıyorsa
 * belgede de o sürümün adı yazmalı, bugünkü taslağın adı değil. Sürüm
 * görüntüsü yoksa taslağa düşülür.
 *
 * Çözüm başarısız olursa hata YUTULUR ve alan boş bırakılır: bir adın
 * bulunamaması kaydın gönderilmesini engellememeli — kayıt her şeyden önce
 * gelir.
 */
async function kayitBaglami(oturum: Oturum): Promise<KayitBaglami> {
  try {
    const kisi = await personelKaynagi().bul(oturum.sicil);
    const yayin = yayinGetir(oturum.egitimId, oturum.egitimSurum);
    return {
      ad: kisi?.ad,
      egitimAdi: yayin?.ad ?? egitimGetir(oturum.egitimId)?.ad,
    };
  } catch {
    return {};
  }
}

/**
 * Tamamlanan oturumu dış hedefe gönderir.
 * Hata YUTULMAZ — çağıran `senkron: 'hata'` yazar ve kayıt yeniden denenmek
 * üzere bekler. Sessizce düşen bir eğitim kaydı denetimde yok sayılır.
 *
 * `false` dönmek yutmak değildir: kaydın kendisi veritabanında durur, sebep
 * `sonKayitGonderimHatasi()` ile okunur, tekrar denemeyi Ayarlar'daki düğme
 * yapar.
 */
export async function kaydiGonder(oturum: Parameters<KayitHedefi["gonder"]>[0]): Promise<boolean> {
  try {
    await kayitHedefi().gonder(oturum, await kayitBaglami(oturum));
    sonGonderimHatasi = null;
    return true;
  } catch (h) {
    sonGonderimHatasi = { zaman: new Date().toISOString(), mesaj: opmHataMetni(h) };
    return false;
  }
}

/* ── `/ayarlar` için ─────────────────────────────────────────────────────── */

export interface AdaptorDurumu {
  personelSecim: PersonelKaynagiSecimi;
  kayitSecim: KayitHedefiSecimi;
  /** OPM kullanılıyorsa eksik yapılandırma maddeleri; boşsa takılabilir. */
  personelEksikleri: string[];
  kayitEksikleri: string[];
  opmPersonel: ReturnType<typeof opmPersonelDurumu> | null;
  sonGonderimHatasi: { zaman: string; mesaj: string } | null;
}

export function adaptorDurumu(): AdaptorDurumu {
  const personelSecim = personelKaynagiSecimi();
  const kayitSecim = kayitHedefiSecimi();
  const y = opmYapilandirmaOku();
  return {
    personelSecim,
    kayitSecim,
    personelEksikleri: personelSecim === "opm" ? opmEksikleri(y, "personel") : [],
    kayitEksikleri: kayitSecim === "opm" ? opmEksikleri(y, "kayit") : [],
    opmPersonel: personelSecim === "opm" ? opmPersonelDurumu() : null,
    sonGonderimHatasi,
  };
}

export { opmKayitSina, opmPersonelSina, opmHataMetni };
export { OPM_AYAR, OPM_VARSAYILAN, opmYapilandirmaOku } from "./opmYapilandirma";
export type { OpmYapilandirma } from "./opmYapilandirma";
