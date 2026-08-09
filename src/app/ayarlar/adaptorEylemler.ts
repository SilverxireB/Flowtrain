"use server";

import { revalidatePath } from "next/cache";
import { kapi } from "@/lib/kimlik";
import * as depo from "@/lib/depo";
import {
  AYAR_KAYIT_HEDEFI,
  AYAR_PERSONEL_KAYNAGI,
  OPM_AYAR,
  opmKayitSina,
  opmPersonelSina,
  personelKaynagi,
} from "@/lib/adaptorlar";

/**
 * ADAPTÖR YAPILANDIRMASI — kurulumun "personel nereden gelir, kayıt nereye
 * gider" sorusunun tek cevabı.
 *
 * Neden ayar, neden kod değil: aynı ürün bir fabrikada CSV, ötekinde OPM ile
 * çalışır. Seçim koda girseydi her müşteri için ayrı sürüm derlenirdi.
 *
 * KİMLİK ANAHTARI SIRDIR: ekrana geri gönderilmez, denetim izine değeri
 * yazılmaz — iz yalnız "değişti" der. Bir kez daha görülmek istenirse
 * yeniden girilir.
 */

export interface AdaptorFormu {
  personelKaynagi: string;
  kayitHedefi: string;
  temelAdres: string;
  kimlikBasligi: string;
  /** Boş bırakılırsa mevcut anahtar KORUNUR (ekran anahtarı hiç görmez). */
  kimlikAnahtari: string;
  anahtariSil: boolean;
  personelYolu: string;
  kayitYolu: string;
  zamanAsimiMs: string;
  onbellekDk: string;
}

function yolGecerli(yol: string): boolean {
  return yol.startsWith("/") && !/\s/.test(yol);
}

export async function adaptorAyariKaydetEylem(form: AdaptorFormu): Promise<string | null> {
  const ben = kapi("yonetici", "/ayarlar");

  const personel = form.personelKaynagi === "opm" ? "opm" : "csv";
  const kayit = form.kayitHedefi === "opm" ? "opm" : "dosya";
  const adres = form.temelAdres.trim().replace(/\/+$/, "");
  const personelYolu = form.personelYolu.trim();
  const kayitYolu = form.kayitYolu.trim();

  if (adres && !/^https?:\/\/[^\s/]+/i.test(adres)) {
    return "OPM adresi http:// ya da https:// ile başlamalı.";
  }
  if (personelYolu && !yolGecerli(personelYolu)) return "Personel uç noktası '/' ile başlamalı ve boşluk içermemeli.";
  if (kayitYolu && !yolGecerli(kayitYolu)) return "Kayıt uç noktası '/' ile başlamalı ve boşluk içermemeli.";

  const zamanAsimi = Number.parseInt(form.zamanAsimiMs, 10);
  if (form.zamanAsimiMs.trim() && (!Number.isFinite(zamanAsimi) || zamanAsimi < 500)) {
    return "Zaman aşımı en az 500 ms olmalı.";
  }
  const onbellek = Number.parseInt(form.onbellekDk, 10);
  if (form.onbellekDk.trim() && (!Number.isFinite(onbellek) || onbellek < 0)) {
    return "Önbellek süresi 0 ya da daha büyük bir dakika değeri olmalı.";
  }

  // OPM seçiliyken yarım yapılandırmaya İZİN VERİLMEZ. Kaydedip "sonra
  // bakarız" demek, kurulumun çalıştığı sanılırken çalışmaması demektir.
  if ((personel === "opm" || kayit === "opm") && !adres) {
    return "OPM seçildi ama adres boş. Önce OPM adresini girin (ya da kaynağı CSV'de bırakın).";
  }

  depo.ayarYaz(AYAR_PERSONEL_KAYNAGI, personel);
  depo.ayarYaz(AYAR_KAYIT_HEDEFI, kayit);
  depo.ayarYaz(OPM_AYAR.temelAdres, adres);
  depo.ayarYaz(OPM_AYAR.kimlikBasligi, form.kimlikBasligi.trim());
  depo.ayarYaz(OPM_AYAR.personelYolu, personelYolu);
  depo.ayarYaz(OPM_AYAR.kayitYolu, kayitYolu);
  depo.ayarYaz(OPM_AYAR.zamanAsimiMs, form.zamanAsimiMs.trim());
  depo.ayarYaz(OPM_AYAR.onbellekDk, form.onbellekDk.trim());

  let anahtarNotu = "";
  if (form.anahtariSil) {
    depo.ayarYaz(OPM_AYAR.kimlikAnahtari, "");
    anahtarNotu = ", kimlik anahtarı silindi";
  } else if (form.kimlikAnahtari.trim()) {
    depo.ayarYaz(OPM_AYAR.kimlikAnahtari, form.kimlikAnahtari.trim());
    anahtarNotu = ", kimlik anahtarı değiştirildi";
  }

  // Yeni seçilen kaynağın önbelleği düşürülür: adres ya da anahtar değiştiyse
  // orada duran liste ESKİ yapılandırmayla okunmuştur.
  personelKaynagi().tazele?.();

  depo.izBirak(
    ben.kullanici,
    `adaptör ayarı: personel=${personel}, kayıt=${kayit}${adres ? `, adres=${adres}` : ""}${anahtarNotu}`,
  );
  revalidatePath("/ayarlar");
  revalidatePath("/personel");
  return null;
}

export interface SinamaSonucu {
  personel: { iyi: boolean; mesaj: string };
  kayit: { iyi: boolean; mesaj: string };
}

/**
 * BAĞLANTIYI SINA.
 *
 * Personel ayağı gerçekten okur (okumak yan etkisizdir). Kayıt ayağı YALNIZ
 * yapılandırmayı denetler — sınama düğmesi kurumun eğitim arşivine sahte satır
 * yazmamalı.
 *
 * Yapılandırma eksikse ağa hiç çıkılmaz, NE eksik olduğu söylenir: kapalı ağda
 * "bağlanamadı" mesajı yanlış teşhise götürür.
 */
export async function opmSinaEylem(): Promise<SinamaSonucu> {
  kapi("yonetici", "/ayarlar");
  return { personel: await opmPersonelSina(), kayit: opmKayitSina() };
}
