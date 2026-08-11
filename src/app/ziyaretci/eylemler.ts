"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as depo from "@/lib/depo";
import * as zdepo from "@/lib/ziyaretciDepo";
import { kapiGirisli } from "@/lib/kimlik";
import { egitimleriCoz, eksikSorular, kayitHatasi, type ZiyaretciSoruTipi } from "@/lib/ziyaretci";

/**
 * ZİYARETÇİ EYLEMLERİ.
 *
 * Kayıt ve soru yönetimi KOKPİTTEN yapılır (girişli hesap). Bilgilendirmenin
 * OYNATILMASI ise hesapsızdır — tablet ziyaretçinin eline verilir, orada
 * kokpit oturumu olmamalı. Bu ayrım `oynat*` eylemlerinde görülür: onlar
 * `kapiGirisli` çağırmaz, ziyaretçi kimliğinin kendisiyle yetkilenir.
 */

/* ── kayıt ────────────────────────────────────────────────────────────────── */

export async function ziyaretciKaydetEylem(_onceki: string | null, form: FormData): Promise<string | null> {
  const hesap = kapiGirisli("/ziyaretci");

  const ad = String(form.get("ad") ?? "");
  const hata = kayitHatasi(ad);
  if (hata) return hata;

  /* Cevaplar formdan `cevap_<soruId>` alanlarıyla gelir; çoklu seçimde aynı
     ad birden çok kez gönderilir. */
  const sorular = zdepo.sorulariGetir();
  const cevaplar: Record<string, number[]> = {};
  for (const s of sorular) {
    const secilenler = form
      .getAll(`cevap_${s.id}`)
      .map((v) => Number(v))
      .filter((n) => Number.isInteger(n) && n >= 0 && n < s.secenekler.length);
    if (secilenler.length > 0) cevaplar[s.id] = [...new Set(secilenler)];
  }

  /* Boş soru bırakılamaz: "yüksekte çalışacak mısınız?" atlanırsa kişi o
     bilgilendirmeyi almadan sahaya girer ve kimse fark etmez. */
  const eksik = eksikSorular(sorular, cevaplar);
  if (eksik.length > 0) return `Cevaplanmayan soru var: "${eksik[0].metin}"`;

  /* Eğitim listesi SUNUCUDA çözülür. İstemciden gelen listeye güvenilseydi,
     kayıt ekranındaki alanlar kurcalanarak zorunlu bilgilendirme atlanabilirdi. */
  const varsayilanlar = zdepo.varsayilanEgitimler();
  const secilenEgitimler = egitimleriCoz(varsayilanlar, sorular, cevaplar);

  /* Kayıt yapanın insiyatifiyle EKLENENLER — varsayılanlar zaten listede ve
     çıkarılamaz, buradan yalnız EKLEME yapılabilir. */
  const elle = form.getAll("ekEgitim").map(String).filter(Boolean);
  // SAHADAKİLER: yayında görünüp anlık görüntüsü olmayan bir eğitim listeye
  // girseydi, tablet o adımda boş açılırdı.
  const yayinda = new Set(depo.sahadakiEgitimler().map((e) => e.id));
  const egitimIdleri = [...new Set([...secilenEgitimler, ...elle])].filter((id) => yayinda.has(id));

  if (egitimIdleri.length === 0) {
    return "Verilecek bilgilendirme yok. Önce Ayarlar'dan varsayılan bilgilendirmeyi seçin ve yayına alın.";
  }

  const z = zdepo.ziyaretciKaydet({
    ad: ad.trim(),
    firma: String(form.get("firma") ?? "").trim() || undefined,
    ziyaretEttigi: String(form.get("ziyaretEttigi") ?? "").trim() || undefined,
    cevaplar,
    egitimIdleri,
    kaydeden: hesap.kullanici,
  });
  depo.izBirak(hesap.kullanici, `ziyaretçi kaydı: ${z.ad}${z.firma ? ` (${z.firma})` : ""} · ${egitimIdleri.length} bilgilendirme`);

  revalidatePath("/ziyaretci");
  redirect(`/ziyaretci/oyna/${z.id}`);
}

export async function ziyaretciSilEylem(id: string): Promise<void> {
  const hesap = kapiGirisli("/ziyaretci");
  const z = zdepo.ziyaretciGetir(id);
  zdepo.ziyaretciSil(id);
  depo.izBirak(hesap.kullanici, `ziyaretçi kaydı silindi: ${z?.ad ?? id}`);
  revalidatePath("/ziyaretci");
}

/* ── oynatma (HESAPSIZ — tablet ziyaretçinin elinde) ──────────────────────── */

export interface OynatVerisi {
  hata?: string;
  oturumId?: string;
  egitimId?: string;
}

export async function bilgilendirmeBaslatEylem(ziyaretciId: string, egitimId: string): Promise<OynatVerisi> {
  const z = zdepo.ziyaretciGetir(ziyaretciId);
  if (!z) return { hata: "Ziyaretçi kaydı bulunamadı." };

  // Listede olmayan bir eğitim başlatılamaz: adres çubuğuna başka bir kimlik
  // yazarak kişiye verilmemiş bir bilgilendirmenin kaydı üretilmesin.
  if (!z.egitimIdleri.includes(egitimId)) return { hata: "Bu bilgilendirme bu ziyaretçiye verilmemiş." };

  // Ziyaretçi tableti de YAYINLANMIŞ sürümü oynatır (kioskla aynı gerekçe).
  const saha = depo.sahadakiEgitim(egitimId);
  if (!saha) return { hata: "Bilgilendirme yayında değil." };

  const o = zdepo.oturumBaslat({ ziyaretciId, egitimId, egitimAdi: saha.ad, egitimSurum: saha.surum });
  return { oturumId: o.id, egitimId };
}

export async function bilgilendirmeTamamlaEylem(
  oturumId: string,
  sayfaSureleri: Record<string, number>,
): Promise<{ hata?: string; tamamlandi?: boolean }> {
  const sonuc = zdepo.oturumBitir(oturumId, sayfaSureleri);
  revalidatePath("/ziyaretci");
  return { tamamlandi: sonuc.tamamlandi };
}

/* ── kayıt soruları (yönetici) ────────────────────────────────────────────── */

const VARSAYILAN_SECENEK: Record<ZiyaretciSoruTipi, string[]> = {
  evetHayir: ["Evet", "Hayır"],
  tekSecim: ["Seçenek 1", "Seçenek 2"],
  cokluSecim: ["Seçenek 1", "Seçenek 2"],
};

export async function soruEkleEylem(tip: ZiyaretciSoruTipi): Promise<void> {
  const hesap = kapiGirisli("/ziyaretci/sorular");
  zdepo.soruEkle({ tip, secenekler: VARSAYILAN_SECENEK[tip], metin: "" });
  depo.izBirak(hesap.kullanici, "ziyaretçi kayıt sorusu eklendi");
  revalidatePath("/ziyaretci/sorular");
}

export async function soruGuncelleEylem(id: string, yama: Record<string, unknown>): Promise<void> {
  kapiGirisli("/ziyaretci/sorular");
  zdepo.soruGuncelle(id, yama);
  revalidatePath("/ziyaretci/sorular");
  revalidatePath("/ziyaretci");
}

export async function soruSilEylem(id: string): Promise<void> {
  const hesap = kapiGirisli("/ziyaretci/sorular");
  zdepo.soruSil(id);
  depo.izBirak(hesap.kullanici, "ziyaretçi kayıt sorusu silindi");
  revalidatePath("/ziyaretci/sorular");
}

export async function sorulariSiralaEylem(sirali: string[]): Promise<void> {
  kapiGirisli("/ziyaretci/sorular");
  zdepo.sorulariSirala(sirali);
  revalidatePath("/ziyaretci/sorular");
}

/* ── saklama süresi (KVKK) ────────────────────────────────────────────────── */

/**
 * Saklama süresini yazar ve HEMEN uygular.
 *
 * Ayarı kaydedip temizliği bir sonraki sayfa açılışına bırakmak, "90 gün"
 * dedikten sonra listede duran eski kayıtları görüp ayarın çalışmadığını
 * düşündürüyordu. Silme geri alınamaz olduğu için ekranda onay isteniyor
 * (`ConfirmDialog`), o kapı istemci tarafında.
 */
export async function saklamaAyarlaEylem(gun: number): Promise<{ gun: number; silinen: number }> {
  const hesap = kapiGirisli("/ziyaretci/sorular");
  const temiz = zdepo.saklamaGunuYaz(gun);
  depo.izBirak(
    hesap.kullanici,
    temiz === 0
      ? "ziyaretçi saklama süresi kapatıldı (sınırsız)"
      : `ziyaretçi saklama süresi ${temiz} gün olarak ayarlandı`,
  );

  const sonuc = zdepo.eskileriTemizle(hesap.kullanici);
  revalidatePath("/ziyaretci/sorular");
  revalidatePath("/ziyaretci");
  return { gun: temiz, silinen: sonuc?.silinen ?? 0 };
}

export async function saklamaTemizleEylem(): Promise<{ silinen: number }> {
  const hesap = kapiGirisli("/ziyaretci/sorular");
  const sonuc = zdepo.eskileriTemizle(hesap.kullanici);
  revalidatePath("/ziyaretci/sorular");
  revalidatePath("/ziyaretci");
  return { silinen: sonuc?.silinen ?? 0 };
}

export async function varsayilanEgitimleriYazEylem(idler: string[]): Promise<void> {
  const hesap = kapiGirisli("/ziyaretci/sorular");
  zdepo.varsayilanEgitimleriYaz(idler);
  depo.izBirak(hesap.kullanici, `ziyaretçi varsayılan bilgilendirmeleri güncellendi (${idler.length} adet)`);
  revalidatePath("/ziyaretci/sorular");
  revalidatePath("/ziyaretci");
}
