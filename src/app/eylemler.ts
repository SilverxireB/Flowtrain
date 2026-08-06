"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cikisYap, girisYap, guvenliYol, kapi, kurulumGerekli } from "@/lib/kimlik";
import * as depo from "@/lib/depo";
import type { KartTipi, Soru, SoruTipi } from "@/lib/tipler";

/* ── kimlik ───────────────────────────────────────────────────────────────── */

export async function girisEylem(_onceki: string | null, form: FormData): Promise<string | null> {
  const kullanici = String(form.get("kullanici") ?? "").trim();
  const sifre = String(form.get("sifre") ?? "");
  const hedef = guvenliYol(String(form.get("next") ?? ""), "/");

  const hesap = await girisYap(kullanici, sifre);
  if (!hesap) return "Kullanıcı adı veya şifre hatalı.";
  depo.izBirak(hesap.kullanici, "giriş yaptı");
  redirect(hedef);
}

export async function cikisEylem(): Promise<void> {
  cikisYap();
  redirect("/giris");
}

/** İlk kurulum: hiç hesap yokken tek seferlik yönetici oluşturur. */
export async function kurulumEylem(_onceki: string | null, form: FormData): Promise<string | null> {
  // Kapı burada: kurulum tamamlandıktan sonra bu eylem HERKESE kapalı olmalı,
  // yoksa açık bir "kendine yönetici hesabı aç" uç noktası kalır.
  if (!kurulumGerekli()) return "Kurulum zaten tamamlanmış.";

  const kullanici = String(form.get("kullanici") ?? "").trim();
  const ad = String(form.get("ad") ?? "").trim();
  const sifre = String(form.get("sifre") ?? "");
  if (kullanici.length < 3) return "Kullanıcı adı en az 3 karakter olmalı.";
  if (sifre.length < 6) return "Şifre en az 6 karakter olmalı.";

  depo.hesapOlustur({ kullanici, ad: ad || kullanici, rol: "yonetici", sifre });
  depo.izBirak(kullanici, "kurulum: ilk yönetici hesabı açıldı");
  await girisYap(kullanici, sifre);
  redirect("/");
}

export async function hesapEkleEylem(_onceki: string | null, form: FormData): Promise<string | null> {
  const ben = kapi("yonetici", "/ayarlar");
  const kullanici = String(form.get("kullanici") ?? "").trim();
  const sifre = String(form.get("sifre") ?? "");
  if (kullanici.length < 3) return "Kullanıcı adı en az 3 karakter olmalı.";
  if (sifre.length < 6) return "Şifre en az 6 karakter olmalı.";
  if (depo.hesaplariListele().some((h) => h.kullanici === kullanici)) return "Bu kullanıcı adı zaten var.";

  depo.hesapOlustur({
    kullanici,
    ad: String(form.get("ad") ?? "").trim() || kullanici,
    rol: String(form.get("rol") ?? "hazirlayan") as depo.Rol,
    sicil: String(form.get("sicil") ?? "").trim() || undefined,
    sifre,
  });
  depo.izBirak(ben.kullanici, `hesap açtı: ${kullanici}`);
  revalidatePath("/ayarlar");
  return null;
}

export async function hesapSilEylem(kullanici: string): Promise<void> {
  const ben = kapi("yonetici", "/ayarlar");
  // Kendini silme: yönetici kendini silerse kurulum kilitlenir ve kimse
  // giremez (kurulum sayfası yalnız SIFIR hesapta açılır).
  if (kullanici === ben.kullanici) return;
  depo.hesapSil(kullanici);
  depo.izBirak(ben.kullanici, `hesap sildi: ${kullanici}`);
  revalidatePath("/ayarlar");
}

/**
 * Gönderilemeyen tamamlama kayıtlarını yeniden dener.
 * Kayıt yerelde durduğu için hiçbir şey kaybolmaz; burada yalnız dış hedefe
 * yeniden ulaşılmaya çalışılır.
 */
export async function senkronTekrarEylem(): Promise<void> {
  const ben = kapi("yonetici", "/ayarlar");
  const { kaydiGonder } = await import("@/lib/adaptorlar");
  let basarili = 0;
  for (const o of depo.bekleyenSenkronlar()) {
    const oldu = await kaydiGonder(o);
    depo.senkronIsaretle(o.id, oldu ? "gonderildi" : "hata");
    if (oldu) basarili++;
  }
  depo.izBirak(ben.kullanici, `senkron tekrar denendi: ${basarili} kayıt gönderildi`);
  revalidatePath("/ayarlar");
  revalidatePath("/pano");
}

/** Personel dosyası değiştiğinde önbelleği düşürür. */
export async function personeliTazeleEylem(): Promise<void> {
  kapi("yonetici", "/ayarlar");
  const { onbellegiTemizle } = await import("@/lib/adaptorlar/csvPersonel");
  onbellegiTemizle();
  revalidatePath("/ayarlar");
  revalidatePath("/atama");
}

/* ── eğitim ───────────────────────────────────────────────────────────────── */

export async function egitimOlusturEylem(form: FormData): Promise<void> {
  const ben = kapi("hazirlayan", "/egitimler");
  const ad = String(form.get("ad") ?? "").trim() || "Adsız eğitim";
  const e = depo.egitimOlustur(ad, ben.kullanici);
  depo.izBirak(ben.kullanici, `eğitim açtı: ${ad}`);
  redirect(`/egitimler/${e.id}`);
}

export async function egitimGuncelleEylem(id: string, yama: Record<string, unknown>): Promise<void> {
  const ben = kapi("hazirlayan", `/egitimler/${id}`);
  depo.egitimGuncelle(id, yama);
  depo.izBirak(ben.kullanici, `eğitim güncelledi: ${id}`);
  revalidatePath(`/egitimler/${id}`);
}

export async function egitimKopyalaEylem(id: string): Promise<void> {
  const ben = kapi("hazirlayan", "/egitimler");
  const yeni = depo.egitimKopyala(id, ben.kullanici);
  depo.izBirak(ben.kullanici, `eğitim kopyaladı: ${id}`);
  if (yeni) redirect(`/egitimler/${yeni.id}`);
}

export async function egitimSilEylem(id: string): Promise<void> {
  const ben = kapi("hazirlayan", "/egitimler");
  depo.egitimSil(id);
  depo.izBirak(ben.kullanici, `eğitim sildi: ${id}`);
  revalidatePath("/egitimler");
  redirect("/egitimler");
}

/**
 * YAYINLAMA — onaylayan yetkisi ister.
 * Hazırlayan kendi yazdığını tek başına yayına alamaz: içerik kalitesinin
 * tek güvencesi bu ikinci göz. Yayına alınan her sürüm numarası artar, çünkü
 * kayıt hangi SÜRÜMÜN izlendiğini tutuyor.
 */
export async function yayinlaEylem(id: string): Promise<void> {
  const ben = kapi("onaylayan", `/egitimler/${id}`);
  const e = depo.egitimGetir(id);
  if (!e) return;
  if (depo.sayfalariGetir(id).length === 0) return;
  depo.egitimGuncelle(id, {
    durum: "yayin",
    onaylayan: ben.kullanici,
    surum: e.durum === "yayin" ? e.surum : e.surum + (e.onaylayan ? 1 : 0),
  });
  depo.izBirak(ben.kullanici, `eğitimi yayınladı: ${e.ad}`);
  revalidatePath(`/egitimler/${id}`);
  revalidatePath("/egitimler");
}

export async function taslagaAlEylem(id: string): Promise<void> {
  const ben = kapi("onaylayan", `/egitimler/${id}`);
  depo.egitimGuncelle(id, { durum: "taslak" });
  depo.izBirak(ben.kullanici, `eğitimi taslağa aldı: ${id}`);
  revalidatePath(`/egitimler/${id}`);
  revalidatePath("/egitimler");
}

/* ── sayfa ────────────────────────────────────────────────────────────────── */

export async function sayfaEkleEylem(egitimId: string, tip: KartTipi): Promise<void> {
  kapi("hazirlayan", `/egitimler/${egitimId}`);
  depo.sayfaEkle(egitimId, { tip });
  revalidatePath(`/egitimler/${egitimId}`);
}

/**
 * PDF'ten gelen sayfaları TEK yazımda ekler.
 * Tek tek eklenseydi 40 sayfalık bir sunum 40 ayrı istek ve 40 ayrı yeniden
 * çizim yapardı; yarısında ağ koparsa eğitim yarım kalırdı.
 */
export async function sayfalariTopluEkleEylem(
  egitimId: string,
  kartlar: { gorselId: string; baslik: string }[],
): Promise<void> {
  const ben = kapi("hazirlayan", `/egitimler/${egitimId}`);
  for (const k of kartlar) {
    depo.sayfaEkle(egitimId, { tip: "kural", baslik: k.baslik, gorselId: k.gorselId });
  }
  depo.izBirak(ben.kullanici, `PDF'ten ${kartlar.length} sayfa ekledi: ${egitimId}`);
  revalidatePath(`/egitimler/${egitimId}`);
}

export async function sayfaGuncelleEylem(egitimId: string, id: string, yama: Record<string, unknown>): Promise<void> {
  kapi("hazirlayan", `/egitimler/${egitimId}`);
  depo.sayfaGuncelle(id, yama);
  revalidatePath(`/egitimler/${egitimId}`);
}

export async function sayfaSilEylem(egitimId: string, id: string): Promise<void> {
  kapi("hazirlayan", `/egitimler/${egitimId}`);
  depo.sayfaSil(id);
  revalidatePath(`/egitimler/${egitimId}`);
}

export async function sayfalariSiralaEylem(egitimId: string, sirali: string[]): Promise<void> {
  kapi("hazirlayan", `/egitimler/${egitimId}`);
  depo.sayfalariSirala(egitimId, sirali);
  revalidatePath(`/egitimler/${egitimId}`);
}

/* ── soru ─────────────────────────────────────────────────────────────────── */

export async function soruEkleEylem(egitimId: string, tip: SoruTipi): Promise<void> {
  kapi("hazirlayan", `/egitimler/${egitimId}`);
  depo.soruEkle(egitimId, {
    tip,
    metin: "",
    secenekler: tip === "dogruYanlis" ? ["Doğru", "Yanlış"] : ["", ""],
    dogru: [0],
  });
  revalidatePath(`/egitimler/${egitimId}`);
}

export async function soruGuncelleEylem(egitimId: string, id: string, yama: Partial<Soru>): Promise<void> {
  kapi("hazirlayan", `/egitimler/${egitimId}`);
  depo.soruGuncelle(id, yama);
  revalidatePath(`/egitimler/${egitimId}`);
}

export async function soruSilEylem(egitimId: string, id: string): Promise<void> {
  kapi("hazirlayan", `/egitimler/${egitimId}`);
  depo.soruSil(id);
  revalidatePath(`/egitimler/${egitimId}`);
}

/* ── kural ────────────────────────────────────────────────────────────────── */

export async function kuralEkleEylem(form: FormData): Promise<void> {
  const ben = kapi("hazirlayan", "/atama");
  const dizi = (ad: string) =>
    String(form.get(ad) ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  const gun = String(form.get("iseGirisIcindeGun") ?? "").trim();

  depo.kuralEkle({
    egitimId: String(form.get("egitimId") ?? ""),
    kosul: {
      bolum: dizi("bolum"),
      hat: dizi("hat"),
      gorev: dizi("gorev"),
      iseGirisIcindeGun: gun ? Number(gun) : undefined,
    },
    sonTarih: String(form.get("sonTarih") ?? "").trim() || undefined,
    aktif: true,
  });
  depo.izBirak(ben.kullanici, "atama kuralı ekledi");
  revalidatePath("/atama");
}

export async function kuralDurumEylem(id: string, aktif: boolean): Promise<void> {
  const ben = kapi("hazirlayan", "/atama");
  depo.kuralGuncelle(id, { aktif });
  depo.izBirak(ben.kullanici, `kuralı ${aktif ? "açtı" : "kapattı"}: ${id}`);
  revalidatePath("/atama");
}

export async function kuralSilEylem(id: string): Promise<void> {
  const ben = kapi("hazirlayan", "/atama");
  depo.kuralSil(id);
  depo.izBirak(ben.kullanici, `kural sildi: ${id}`);
  revalidatePath("/atama");
}
