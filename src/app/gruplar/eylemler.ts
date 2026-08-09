"use server";

import { revalidatePath } from "next/cache";
import { kapi } from "@/lib/kimlik";
import * as depo from "@/lib/depo";

/**
 * EĞİTİM PAKETİ EYLEMLERİ.
 *
 * Kök `eylemler.ts`e eklenmez: dört hat paralel çalışıyor, paylaşılan dosyaya
 * dokunan her hat diğerini bekletir. Paket yüzeyi kendi eylemlerini taşır.
 */

/** Etkilenen yüzeyler tek yerde: paket değişince atama ve katalog da tazelenir. */
function tazele(): void {
  revalidatePath("/gruplar");
  revalidatePath("/atama");
  revalidatePath("/egitimler");
}

export async function grupOlusturEylem(form: FormData): Promise<void> {
  const ben = kapi("hazirlayan", "/gruplar");
  const ad = String(form.get("ad") ?? "").trim();
  if (!ad) return;
  depo.grupOlustur(ad, String(form.get("aciklama") ?? "").trim() || undefined);
  depo.izBirak(ben.kullanici, `eğitim paketi açtı: ${ad}`);
  tazele();
}

/**
 * Paketin adı, açıklaması ve ÜYELERİ tek çağrıda kaydedilir.
 *
 * Ayrı ayrı kaydedilseydi ikinci çağrı düşünce paket yarı güncellenmiş kalırdı:
 * adı yeni, üyeleri eski. Üyeler zaten `grupUyeleriYaz` içinde tek yazımda
 * değişiyor; buradaki bütünlük onun devamı.
 */
export async function grupKaydetEylem(
  id: string,
  yama: { ad: string; aciklama: string; egitimIdleri: string[] },
): Promise<string | null> {
  const ben = kapi("hazirlayan", "/gruplar");
  const grup = depo.grupGetir(id);
  if (!grup) return "Paket bulunamadı.";
  const ad = yama.ad.trim();
  if (!ad) return "Paket adı boş olamaz.";

  // Var olmayan eğitim kimliği süzülür: silinmiş bir eğitim üyeliği yabancı
  // anahtarı düşürür ve tüm kayıt geri alınır.
  const gecerli = new Set(depo.egitimleriListele().map((e) => e.id));
  const uyeler = [...new Set(yama.egitimIdleri)].filter((eid) => gecerli.has(eid));

  depo.grupGuncelle(id, { ad, aciklama: yama.aciklama.trim() });
  depo.grupUyeleriYaz(id, uyeler);
  depo.izBirak(ben.kullanici, `eğitim paketini güncelledi: ${ad} (${uyeler.length} eğitim)`);
  tazele();
  return null;
}

export async function grupSilEylem(id: string): Promise<void> {
  const ben = kapi("hazirlayan", "/gruplar");
  const grup = depo.grupGetir(id);
  if (!grup) return;
  // Paketin kuralları veritabanında CASCADE ile gider (kural.grupId yabancı
  // anahtarı); sayıyı iz için önceden okuyoruz.
  const silinenKural = depo.kurallariGetir().filter((k) => k.grupId === id).length;
  depo.grupSil(id);
  depo.izBirak(ben.kullanici, `eğitim paketi sildi: ${grup.ad} (${silinenKural} kural birlikte silindi)`);
  tazele();
}
