"use server";

import { revalidatePath } from "next/cache";
import { kapi } from "@/lib/kimlik";
import * as depo from "@/lib/depo";

/**
 * ATAMA KURALI EYLEMLERİ — hedefi TEK EĞİTİM ya da PAKET olabilen sürüm.
 *
 * Kök `eylemler.ts`teki `kuralEkleEylem` yalnız tek eğitim biliyor ve orası
 * paylaşılan dosya (dört hat paralel çalışıyor, dokunulmaz). Bu yüzden atama
 * yüzeyi kendi eylemini taşır; kural MOTORUNA hiç dokunulmaz — `grupId`
 * doldurmak yeterli, `depo.kurallariCozulmus()` kuralı üyelere kendisi açar.
 */

/** Değerler JSON dizisi olarak gelir: virgül içeren bölüm adları bölünmesin. */
function dizi(form: FormData, ad: string): string[] {
  try {
    const c = JSON.parse(String(form.get(ad) ?? "[]"));
    return Array.isArray(c) ? c.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export async function kuralEkleEylem(_onceki: string | null, form: FormData): Promise<string | null> {
  const ben = kapi("hazirlayan", "/atama");

  const hedefTipi = String(form.get("hedefTipi") ?? "egitim");
  const hedefId = String(form.get("hedefId") ?? "").trim();
  if (!hedefId) return "Bir eğitim ya da paket seçin.";

  const gun = String(form.get("iseGirisIcindeGun") ?? "").trim();
  /* KİŞİYE ÖZEL: siciller serbest metin olarak da yazılabiliyor (kâğıttan
     okuyup yapıştırmak için). Boşluk/virgül/satır sonu ayırıcı sayılır. */
  const sicilHam = String(form.get("sicil") ?? "").trim();
  const sicil = sicilHam
    ? [...new Set(sicilHam.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean))]
    : [];

  const kosul = {
    bolum: dizi(form, "bolum"),
    hat: dizi(form, "hat"),
    gorev: dizi(form, "gorev"),
    sicil,
    iseGirisIcindeGun: gun ? Number(gun) : undefined,
  };
  const sonTarih = String(form.get("sonTarih") ?? "").trim() || undefined;

  if (hedefTipi === "paket") {
    const grup = depo.grupGetir(hedefId);
    if (!grup) return "Paket bulunamadı.";
    /* BOŞ PAKETE KURAL YAZILMAZ: hiçbir şey atamaz ama kullanıcı kuralı
       yazdığını sanır. Sessiz hiçlik yerine açık uyarı. */
    if (grup.egitimIdleri.length === 0) {
      return "Paket boş. Önce pakete eğitim ekleyin, sonra kural yazın.";
    }

    // egitimId BOŞ: paket kuralında tek bir eğitim yoktur, `grupId` taşır.
    depo.kuralEkle({ egitimId: "", grupId: grup.id, kosul, sonTarih, aktif: true });
    depo.izBirak(ben.kullanici, `pakete atama kuralı ekledi: ${grup.ad}`);
  } else {
    const egitim = depo.egitimGetir(hedefId);
    if (!egitim) return "Eğitim bulunamadı.";
    depo.kuralEkle({ egitimId: egitim.id, kosul, sonTarih, aktif: true });
    depo.izBirak(ben.kullanici, `atama kuralı ekledi: ${egitim.ad}`);
  }

  revalidatePath("/atama");
  revalidatePath("/egitimler");
  revalidatePath("/gruplar");
  return null;
}

export async function kuralDurumEylem(id: string, aktif: boolean): Promise<void> {
  const ben = kapi("hazirlayan", "/atama");
  depo.kuralGuncelle(id, { aktif });
  depo.izBirak(ben.kullanici, `kuralı ${aktif ? "açtı" : "kapattı"}: ${id}`);
  revalidatePath("/atama");
  revalidatePath("/egitimler");
}

export async function kuralSilEylem(id: string): Promise<void> {
  const ben = kapi("hazirlayan", "/atama");
  depo.kuralSil(id);
  depo.izBirak(ben.kullanici, `kural sildi: ${id}`);
  revalidatePath("/atama");
  revalidatePath("/egitimler");
}
