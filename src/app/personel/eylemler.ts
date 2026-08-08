"use server";

import { revalidatePath } from "next/cache";
import { kapi } from "@/lib/kimlik";
import * as depo from "@/lib/depo";
import { personelKaynagi } from "@/lib/adaptorlar";
import type { AktarimSonucu, PersonelYama } from "@/lib/adaptor";

/**
 * KAPI HEP "yonetici": personel listesi kişisel veridir, düzenleme yetkisi
 * kurulumun sahibinde durur.
 *
 * YETENEK KONTROLÜ HER EYLEMDE: kaynak salt okunursa (OPM webservice'i gibi)
 * ekran düğmeleri zaten gizli olur, ama düğmeyi gizlemek sunucuda karşılığı
 * olmayan bir önlemdir — istek yine de gelebilir.
 */
function yonetim() {
  const y = personelKaynagi().yonetim;
  if (!y) throw new Error("Bu personel kaynağı buradan düzenlenemez.");
  return y;
}

export async function personelGuncelleEylem(sicil: string, yama: PersonelYama): Promise<string | null> {
  const ben = kapi("yonetici", "/personel");
  if (!personelKaynagi().yonetim) return "Bu personel kaynağı buradan düzenlenemez.";
  if (!yonetim().guncelle(sicil, yama)) return "Kayıt bulunamadı — kaynak bu sırada değişmiş olabilir.";
  depo.izBirak(ben.kullanici, `personel düzenledi: ${sicil}`);
  revalidatePath("/personel");
  revalidatePath("/atama");
  revalidatePath("/ekibim");
  return null;
}

export async function mmEslemeKaydetEylem(kod: string, bolum: string, amirSicil: string): Promise<string | null> {
  const ben = kapi("yonetici", "/personel");
  if (!kod.trim()) return "Maliyet merkezi kodu boş olamaz.";
  depo.mmEslemeKaydet(kod, bolum, amirSicil);
  depo.izBirak(
    ben.kullanici,
    `maliyet merkezi eşledi: ${kod.trim()} → ${bolum.trim() || "—"} / ${amirSicil.trim() || "—"}`,
  );
  revalidatePath("/personel");
  return null;
}

export async function mmEslemeSilEylem(kod: string): Promise<void> {
  const ben = kapi("yonetici", "/personel");
  depo.mmEslemeSil(kod);
  depo.izBirak(ben.kullanici, `maliyet merkezi eşlemesi sildi: ${kod}`);
  revalidatePath("/personel");
}

export async function opmIceAktarEylem(metin: string): Promise<{ sonuc?: AktarimSonucu; hata?: string }> {
  const ben = kapi("yonetici", "/personel");
  if (!personelKaynagi().yonetim) return { hata: "Bu personel kaynağı buradan düzenlenemez." };
  if (!metin.trim()) return { hata: "Dosya boş." };
  try {
    const sonuc = yonetim().iceAktar(metin);
    if (sonuc.yeni === 0 && sonuc.guncellenen === 0) {
      return { hata: "Hiç kayıt okunamadı. Başlık satırında sicil sütunu var mı?" };
    }
    depo.izBirak(ben.kullanici, `personel aktarımı: ${sonuc.yeni} yeni, ${sonuc.guncellenen} güncellenen kayıt`);
    revalidatePath("/personel");
    revalidatePath("/atama");
    revalidatePath("/ekibim");
    return { sonuc };
  } catch (e) {
    return { hata: e instanceof Error ? e.message : "Dosya okunamadı." };
  }
}

export async function eslemeyiUygulaEylem(): Promise<{ uygulanan: number; eslemesizKodlar: string[] }> {
  const ben = kapi("yonetici", "/personel");
  if (!personelKaynagi().yonetim) return { uygulanan: 0, eslemesizKodlar: [] };
  const sonuc = yonetim().eslemeyiUygula();
  depo.izBirak(ben.kullanici, `maliyet merkezi eşlemesini uyguladı: ${sonuc.uygulanan} kayıt`);
  revalidatePath("/personel");
  revalidatePath("/atama");
  revalidatePath("/ekibim");
  return sonuc;
}
