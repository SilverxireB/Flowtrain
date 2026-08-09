"use server";

import { revalidatePath } from "next/cache";
import { kapi } from "@/lib/kimlik";
import * as depo from "@/lib/depo";

/**
 * KURULUMUN KENDİ ADRESİ — QR kodlarının işaret ettiği yer.
 *
 * Neden ayar: QR etiketi kâğıda basılıp hatta asılıyor. Kâğıttaki adres
 * tarayıcının o anki adresinden türetilseydi, kurulumu ofis makinesinden açan
 * hazırlayan `localhost`u basar ve tablette hiçbir kod çalışmazdı. Adresi bir
 * kez yönetici yazar, bütün etiketler ondan üretilir.
 */
/**
 * KURUM ADI — denetim belgelerinin künyesine basılır.
 *
 * Boşsa belgeler "(kurum adı girilmemiş)" diyor. Bilerek engellenmiyor:
 * eksik künyeli bir belge, hiç alınmamış bir belgeden iyidir; ama denetime
 * giderken bu alanın dolu olması gerekir.
 */
export async function kurumAdiKaydetEylem(ad: string): Promise<string | null> {
  const ben = kapi("yonetici", "/ayarlar");
  const temiz = ad.trim().slice(0, 120);
  depo.ayarYaz("kurumAdi", temiz);
  depo.izBirak(ben.kullanici, temiz ? `kurum adı ayarlandı: ${temiz}` : "kurum adı temizlendi");
  revalidatePath("/ayarlar");
  revalidatePath("/kayitlar");
  revalidatePath("/pano");
  return null;
}

export async function temelAdresKaydetEylem(adres: string): Promise<string | null> {
  const ben = kapi("yonetici", "/ayarlar");
  const temiz = adres.trim().replace(/\/+$/, "");

  if (temiz && !/^https?:\/\/[^\s/]+/i.test(temiz)) {
    return "Adres http:// ya da https:// ile başlamalı (örnek: http://10.20.0.5:3000).";
  }

  depo.ayarYaz("temelAdres", temiz);
  depo.izBirak(ben.kullanici, temiz ? `kurulum adresi ayarlandı: ${temiz}` : "kurulum adresi temizlendi");
  revalidatePath("/ayarlar");
  revalidatePath("/egitimler/qr");
  return null;
}
