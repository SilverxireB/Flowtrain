"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cikisYap, girisYap, guvenliYol, kapi, kurulumGerekli } from "@/lib/kimlik";
import * as depo from "@/lib/depo";
import { kaydiGonder, personelKaynagi, sonKayitGonderimHatasi } from "@/lib/adaptorlar";
import { SABLONLAR } from "@/lib/sablonlar";
import { nrm } from "@/lib/arama";
import { bolumAnahtari, bolumleriCoz } from "@/lib/bolumler";
import type { KartTipi, Sayfa, Soru, SoruTipi } from "@/lib/tipler";

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

/**
 * HESABIN ŞİFRESİNİ DEĞİŞTİRİR — devrin şartı.
 *
 * `depo.hesapSifreDegistir` yazılmıştı ama HİÇBİR YERDEN ÇAĞRILMIYORDU: ekranda
 * şifre değiştirme yolu yoktu. `docs/CANLIYA-GECIS.md` devir maddesinde
 * "yönetici hesabı fabrikadaki sorumluya verildi, ŞİFRESİ DEĞİŞTİRİLDİ" diyor —
 * yani belge, ürünün yapamadığı bir adımı şart koşuyordu. Tek çare sunucu
 * konsolundan `npm run sifre` idi ve o da yazılımcı işi.
 *
 * YÖNETİCİ KAPISI: bu eylem başkasının şifresini de değiştirebiliyor, o yüzden
 * `yonetici` istiyor. Kendi şifresini değiştirmek de buradan geçiyor —
 * yöneticinin kendi hesabı zaten bu ekranda.
 *
 * İZ BIRAKILIR ama şifre YAZILMAZ: denetimde "kimin şifresi ne zaman kim
 * tarafından değiştirildi" sorusunun cevabı gerekir, şifrenin kendisi değil.
 */
export async function hesapSifreDegistirEylem(kullanici: string, yeniSifre: string): Promise<string | null> {
  const ben = kapi("yonetici", "/ayarlar");
  if (yeniSifre.length < 6) return "Şifre en az 6 karakter olmalı.";
  if (!depo.hesapSifreDegistir(kullanici, yeniSifre)) return "Hesap bulunamadı.";
  depo.izBirak(ben.kullanici, `hesap şifresi değiştirildi: ${kullanici}`);
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
  let basarili = 0;
  const bekleyenler = depo.bekleyenSenkronlar();
  for (const o of bekleyenler) {
    const oldu = await kaydiGonder(o);
    depo.senkronIsaretle(o.id, oldu ? "gonderildi" : "hata");
    if (oldu) basarili++;
  }

  /* SEBEP DE YAZILIYOR: "3 kayıt gönderilemedi" satırı tek başına eyleme
     dönüşmüyor — adres mi yanlış, anahtar mı süresi dolmuş, servis mi kapalı
     bilinmeden kimse düzeltemez. Sebep denetim izinde durursa sorun ertesi
     gün başka biri tarafından da okunabilir. */
  const kalan = bekleyenler.length - basarili;
  const sebep = kalan > 0 ? sonKayitGonderimHatasi()?.mesaj : null;
  depo.izBirak(
    ben.kullanici,
    `senkron tekrar denendi: ${basarili} gönderildi` +
      (kalan > 0 ? `, ${kalan} başarısız${sebep ? ` — ${sebep}` : ""}` : ""),
  );
  revalidatePath("/ayarlar");
  revalidatePath("/pano");
}

/** Personel dosyası değiştiğinde önbelleği düşürür. */
export async function personeliTazeleEylem(): Promise<void> {
  kapi("yonetici", "/ayarlar");
  // Adaptör sınırı: CSV modülü DOĞRUDAN çağrılmaz. OPM adaptörü etkinken
  // doğrudan çağrı, yanlış adaptörün önbelleğini temizleyip sessizce hiçbir
  // şey yapmazdı.
  personelKaynagi().tazele?.();
  revalidatePath("/ayarlar");
  revalidatePath("/atama");
}

/**
 * PIN sıfırlar — kişi bir sonraki tamamlamada yenisini belirler.
 * Bu yol OLMAK ZORUNDA: PIN unutulduğunda ya da bir başkası tarafından
 * belirlendiğinde, kişinin kendi imzasına geri dönmesinin başka yolu yok.
 */
export async function pinSifirlaEylem(sicil: string): Promise<void> {
  const ben = kapi("yonetici", "/ayarlar");
  depo.pinSifirla(sicil);
  depo.izBirak(ben.kullanici, `PIN sıfırladı: ${sicil}`);
  revalidatePath("/ayarlar");
}

/* ── eğitim ───────────────────────────────────────────────────────────────── */

export async function egitimOlusturEylem(form: FormData): Promise<void> {
  const ben = kapi("hazirlayan", "/egitimler");
  const ad = String(form.get("ad") ?? "").trim() || "Adsız eğitim";
  const e = depo.egitimOlustur(ad, ben.kullanici);
  depo.izBirak(ben.kullanici, `eğitim açtı: ${ad}`);
  redirect(`/egitimler/${e.id}`);
}

/**
 * Şablondan eğitim açar — boş sayfa yerine doldurulacak kalıp.
 * Şablon İÇERİK taşımaz, yalnız kart yapısını ve soruları kurar.
 */
export async function sablondanAcEylem(sablonId: string): Promise<void> {
  const ben = kapi("hazirlayan", "/egitimler");
  const sablon = SABLONLAR.find((s) => s.id === sablonId);
  if (!sablon) return;

  const e = depo.egitimOlustur(sablon.ad, ben.kullanici);
  for (const k of sablon.kartlar) depo.sayfaEkle(e.id, k);
  for (const q of sablon.sorular) {
    depo.soruEkle(e.id, {
      tip: q.secenekler.length === 2 && q.secenekler[0] === "Doğru" ? "dogruYanlis" : "coktanSecmeli",
      metin: q.metin,
      secenekler: q.secenekler,
      dogru: q.dogru,
    });
  }
  depo.izBirak(ben.kullanici, `şablondan eğitim açtı: ${sablon.ad}`);
  redirect(`/egitimler/${e.id}`);
}

/**
 * Hazırlayanın değiştirebileceği alanlar — BEYAZ LİSTE.
 *
 * `durum`, `onaylayan` ve `surum` BİLEREK dışarıda: depo katmanı bunları
 * yazabiliyor, dolayısıyla süzülmemiş bir yama ile `hazirlayan` rolündeki biri
 * kendi eğitimini onaysız yayına alabiliyor ve `onaylayan` alanına istediği
 * kişinin adını yazabiliyordu. Dört göz kuralının tek gerçek yeri burası —
 * düğmeyi gizlemek sunucuda karşılığı olmayan bir önlemdir.
 */
const HAZIRLAYAN_ALANLARI = [
  "ad",
  "aciklama",
  "gecmeNotu",
  "denemeHakki",
  "soruSayisi",
  "karisik",
  "tekrarAy",
  "kategori",
  "zorunlu",
  "sureDk",
  "egitmen",
] as const;

/**
 * YAYINDAKİ EĞİTİMİN EDİTÖRÜ ARTIK KİLİTLİ DEĞİL — ve bu bir gevşetme değil.
 *
 * Eski kapı ("yayındaysa hiçbir alanı değiştirme") gerçek bir açığı
 * kapatıyordu: içerik yerinde değişiyor, kayıtlar "sürüm N"e atıf yapmaya
 * devam ediyor ve insanlar kayıtta yazandan BAŞKA bir içerikten sınav olmuş
 * görünüyordu. Sürümlü yayınla (`docs/SURUMLU-YAYIN.md`) o açık kaynağında
 * kapandı: düzenleme TASLAĞA yazılıyor, saha yalnız yayınlanmış anlık
 * görüntüyü oynatıyor ve yayınlanan sürüm bir daha değişmiyor.
 *
 * Kapının bedeli görünürdü: yayındaki eğitimde bir yazım hatasını düzeltmek
 * için eğitimi kiosktan düşürmek gerekiyordu — vardiya ortasında gelen işçi
 * "size atanmış eğitim yok" görüyordu.
 *
 * DÖRT GÖZ KURALI YERİNDE: yayınlamak hâlâ `onaylayan` yetkisi ister
 * (`yayinlaEylem`) ve `HAZIRLAYAN_ALANLARI` beyaz listesi `durum`/`surum`/
 * `onaylayan` alanlarını dışarıda tutmaya devam ediyor. Hazırlayan taslağı
 * istediği gibi yazar; sahaya çıkaran ikinci gözdür.
 */

/**
 * Kategori serbest metindir ama "İSG" / "isg" / "ısg" ÜÇ AYRI kategori olmamalı:
 * katalog süzgeci üç satır gösterir, hazırlayan hangisinin doğru olduğunu
 * bilemez ve rapor kırılımı bölünür.
 *
 * Yazarken mevcut bir kategoriye Türkçe duyarsız eşleşiyorsa ONUN yazımına
 * çekilir. Eşleşme yoksa kullanıcının yazdığı aynen kalır — yeni kategori
 * açmak yasak değil, kazara açmak engelleniyor.
 */
function kategoriyiYaklastir(girilen: string): string {
  const temiz = girilen.trim().replace(/\s+/g, " ");
  if (!temiz) return "";
  return depo.kategorileriGetir().find((k) => nrm(k) === nrm(temiz)) ?? temiz;
}

export async function egitimGuncelleEylem(id: string, yama: Record<string, unknown>): Promise<void> {
  const ben = kapi("hazirlayan", `/egitimler/${id}`);
  const suzulmus: Record<string, unknown> = {};
  for (const alan of HAZIRLAYAN_ALANLARI) {
    if (yama[alan] !== undefined) suzulmus[alan] = yama[alan];
  }
  if (typeof suzulmus.kategori === "string") suzulmus.kategori = kategoriyiYaklastir(suzulmus.kategori);
  depo.egitimGuncelle(id, suzulmus);
  depo.izBirak(ben.kullanici, `eğitim güncelledi: ${id}`);
  revalidatePath(`/egitimler/${id}`);
}

export async function egitimKopyalaEylem(id: string): Promise<void> {
  const ben = kapi("hazirlayan", "/egitimler");

  /* BÖLÜM BAŞLIKLARI DA TAŞINIR. Başlıklar sayfa KİMLİĞİNE bağlı ve kopyanın
     sayfaları yeni kimlikler alıyor; eşleme olmadan kopya, kırk kartı
     bölümsüz bir liste olarak açılırdı. Geçen yılın kopyasını almanın bütün
     sebebi düzeni de devralmak. */
  const esleme = new Map<string, string>();
  const yeni = depo.egitimKopyala(id, ben.kullanici, esleme);
  if (yeni) {
    const eski = bolumleriCoz(depo.ayarOku(bolumAnahtari(id)));
    const tasinan: Record<string, string> = {};
    for (const [eskiId, baslik] of Object.entries(eski)) {
      const yeniId = esleme.get(eskiId);
      if (yeniId) tasinan[yeniId] = baslik;
    }
    if (Object.keys(tasinan).length > 0) {
      depo.ayarYaz(bolumAnahtari(yeni.id), JSON.stringify(tasinan));
    }
  }

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
 *
 * Hazırlayan kendi yazdığını tek başına yayına alamaz: içerik kalitesinin
 * tek güvencesi bu ikinci göz.
 *
 * Yayınlamak artık o anki taslağın ANLIK GÖRÜNTÜSÜNÜ alır (`depo.yayinla`):
 * sürüm numarası gerçek bir içeriğe bağlanır, "bu kişi neyi izledi" sorusunun
 * cevabı denetimde durur. Sürüm numarası kararı depoda ve `surum.ts`te —
 * burada arıtılmış bir aritmetik yoktur.
 */
export async function yayinlaEylem(id: string): Promise<void> {
  const ben = kapi("onaylayan", `/egitimler/${id}`);
  const e = depo.egitimGetir(id);
  if (!e) return;
  const sonuc = depo.yayinla(id, ben.kullanici);
  // Kartsız eğitim yayınlanmaz — sahada tamamlanamayan bir eğitim görünürdü.
  if (!sonuc) return;
  depo.izBirak(
    ben.kullanici,
    sonuc.yeni
      ? `eğitimi yayınladı: ${e.ad} · sürüm ${sonuc.surum}`
      : `eğitimi sahaya geri aldı: ${e.ad} · sürüm ${sonuc.surum} (içerik değişmedi)`,
  );
  revalidatePath(`/egitimler/${id}`);
  revalidatePath("/egitimler");
}

/**
 * SAHADAN İNDİR. Artık "düzenleyebilmek için" değil, GERÇEKTEN indirmek için:
 * eğitim kioskta, ziyaretçi tabletinde ve amir tabletinde görünmez olur.
 * Düzenlemek için taslağa almak gerekmiyor (yayın kilidi kalktı).
 */
export async function taslagaAlEylem(id: string): Promise<void> {
  const ben = kapi("onaylayan", `/egitimler/${id}`);
  depo.egitimGuncelle(id, { durum: "taslak" });
  depo.izBirak(ben.kullanici, `eğitimi sahadan indirdi (taslağa aldı): ${id}`);
  revalidatePath(`/egitimler/${id}`);
  revalidatePath("/egitimler");
}

/**
 * YAYINDAKİ HÂLİNE DÖN — taslağı yayınlanmış sürümden yeniden kurar.
 *
 * `hazirlayan` yetkisi ister, `onaylayan` değil: bu bir YAYINLAMA değil, bir
 * düzenleme adımı — sahada hiçbir şey değişmez, taslak yayındakine eşitlenir.
 *
 * Yayınlanmamış düzenlemeler gider; ekran bunu onay kutusuyla soruyor.
 * Yayınlanmış sürüm ise yerinde durmaya devam eder — geri dönmek bir kaydı
 * silmez, yalnız taslağı ondan kopyalar.
 */
export async function yayindanGeriDonEylem(id: string, surum?: number): Promise<void> {
  const ben = kapi("hazirlayan", `/egitimler/${id}`);
  const donulen = depo.yayindanGeriDon(id, surum);
  if (donulen === null) return;
  depo.izBirak(ben.kullanici, `taslağı yayına döndürdü: ${id} · sürüm ${donulen}`);
  revalidatePath(`/egitimler/${id}`);
  revalidatePath("/egitimler");
}

/* ── sayfa ────────────────────────────────────────────────────────────────── */

/**
 * Kart ekler. `oncekiId` verilirse o kartın HEMEN ALTINA, yoksa sona.
 *
 * NEDEN ARAYA EKLEME: kart hep sona ekleniyordu ve içerik hazırlamak doğrusal
 * değil — "şuraya bir uyarı kartı lazım" en sık yapılan iş. 12 kartlık listede
 * 6. sıraya kart sokmak, kartı sona ekleyip on kez Ctrl+↑'a basmak demekti
 * (ölçüldü: 8,9 sn); 40 kartlık eğitimde pratikte imkânsızdı.
 *
 * Sıra TEK YAZIMDA kaydırılıyor: yeni kart araya girince altındakilerin hepsi
 * bir artmalı ve bu yarım kalırsa liste bozulur (`sayfalariSirala` ile aynı
 * gerekçe).
 */
export async function sayfaEkleEylem(egitimId: string, tip: KartTipi, oncekiId?: string): Promise<void> {
  kapi("hazirlayan", `/egitimler/${egitimId}`);
  depo.sayfaEkle(egitimId, { tip, oncekiId });
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
    /* ALT METİN DE BAŞLIKTAN DOĞAR. Görsel PDF sayfasının kendisi, yani
       başlık gerçekten "bu görselde ne var"ı anlatıyor. Boş bırakıldığında
       ekran okuyucu hiçbir şey duymuyordu; ürün alt metin yazmayı kendi
       ekranında isterken kendi aktarımında atlıyordu. Hazırlayan istediği
       gibi değiştirir — bu bir başlangıç, son söz değil. */
    depo.medyaAltMetinYaz(k.gorselId, k.baslik);
  }
  depo.izBirak(ben.kullanici, `PDF'ten ${kartlar.length} sayfa ekledi: ${egitimId}`);
  revalidatePath(`/egitimler/${egitimId}`);
}

/**
 * YAPIŞTIRILAN METİNDEN TOPLU KART.
 *
 * Bölme İSTEMCİDE yapılır ve sonucu hazırlayan panelde görüp onaylar; buraya
 * yalnız onaylananlar gelir. Sunucu metni yeniden bölmez — bölseydi ekranda
 * onaylanan ile yazılan farklı olabilirdi ("gördüğüm bu değildi").
 */
export async function metinKartlariEkleEylem(
  egitimId: string,
  kartlar: { tip: KartTipi; baslik: string; metin: string }[],
): Promise<void> {
  const ben = kapi("hazirlayan", `/egitimler/${egitimId}`);
  for (const k of kartlar) {
    if (!k.baslik.trim() && !k.metin.trim()) continue;
    depo.sayfaEkle(egitimId, { tip: k.tip, baslik: k.baslik, metin: k.metin });
  }
  depo.izBirak(ben.kullanici, `yapıştırılan metinden ${kartlar.length} kart ekledi: ${egitimId}`);
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

/**
 * ÇOK SAYIDA KARTI BİR HAMLEDE SİLER.
 *
 * NEDEN AYRI UÇ: elli iki kartlık bir sunumu geri almak, tek tek silmede
 * elli iki tur (her biri onay + sunucu gidiş dönüşü + yeniden çizim)
 * demekti — ölçüldü, kullanıcı PDF/PPTX denemesinden sonra otuz beş kartı
 * böyle sildi. Döngüyü istemciye kurmak da çözüm değil: her `revalidatePath`
 * listeyi baştan çiziyor, arada silinen kartın sırası kayıyor.
 *
 * TEK İŞLEMDE: `sayfaSil` bir kez sarmalanıyor, sayfa bir kez yenileniyor.
 * Geri alma yine mümkün — istemci yedeği ve sıra indekslerini önceden
 * alıyor, `sayfaGeriYukleEylem` her kart için sırayla çağrılıyor.
 */
export async function sayfalariSilEylem(egitimId: string, idler: string[]): Promise<number> {
  const ben = kapi("hazirlayan", `/egitimler/${egitimId}`);
  /* SIRA ÖNEMLİ DEĞİL ama TEKİLLİK önemli: aynı kimlik iki kez gelirse
     ikinci silme sessizce hiçbir şey yapar, sayaç yanlış olurdu. */
  const tekil = [...new Set(idler)];
  for (const id of tekil) depo.sayfaSil(id);
  depo.izBirak(ben.kullanici, `${tekil.length} kart sildi: ${egitimId}`);
  revalidatePath(`/egitimler/${egitimId}`);
  return tekil.length;
}

/**
 * Silinen kartı GERİ KOYAR — "Geri al" bildiriminin sunucu ucu.
 *
 * KAYIT DEĞİŞMEZLİĞİNİ İHLAL ETMEZ (CLAUDE.md 7). Dokunulan şey TASLAK:
 * `sayfa` tablosu editörün çalışma alanı, sahanın oynattığı şey
 * `yayinSayfa` anlık görüntüsü. Yayınlanmış hiçbir satır ne siliniyor ne
 * geri geliyor; tamamlama kayıtları da yerinde duruyor.
 *
 * KİMLİK YENİ. Aynı kimliği geri yazmak mümkündü ama doğru değil: o kimliğe
 * bağlı `soruIstatistik` ve `oturum.sayfaSureleri` satırları silinen kartın
 * geçmişini yeni karta yapıştırırdı. Geri alınan kart yeni bir karttır;
 * taslakta bunun bir bedeli yok.
 *
 * SIRA İNDEKSLE GERİ VERİLİYOR, "üstündeki kartın kimliği" ile değil. Üstteki
 * kartı taşımak kolaydı ama LİSTENİN İLK KARTI için üstünde kart yok — o
 * durumda kart sona ekleniyordu, yani geri alma kartı geri getirip başka bir
 * yere koyuyordu. Önce eklenip sonra `sayfalariSirala` ile yerine oturtuluyor;
 * sıralama zaten tek yazımlık bir işlem ve sınavlı.
 *
 * `indeks` liste dışına düşerse (bu arada başka kartlar silinmişse) sona
 * eklenir: geri almanın yarısını yapmak, hiç yapmamaktan iyidir.
 */
export async function sayfaGeriYukleEylem(
  egitimId: string,
  veri: Record<string, unknown>,
  indeks: number,
): Promise<void> {
  const ben = kapi("hazirlayan", `/egitimler/${egitimId}`);
  const yeni = depo.sayfaEkle(egitimId, { ...(veri as { tip: Sayfa["tip"] }) });
  const idler = depo
    .sayfalariGetir(egitimId)
    .map((s) => s.id)
    .filter((id) => id !== yeni.id);
  idler.splice(Math.max(0, Math.min(indeks, idler.length)), 0, yeni.id);
  depo.sayfalariSirala(egitimId, idler);
  depo.izBirak(ben.kullanici, `silinen kart geri alındı: ${egitimId}`);
  revalidatePath(`/egitimler/${egitimId}`);
}

export async function sayfalariSiralaEylem(egitimId: string, sirali: string[]): Promise<void> {
  kapi("hazirlayan", `/egitimler/${egitimId}`);
  depo.sayfalariSirala(egitimId, sirali);
  revalidatePath(`/egitimler/${egitimId}`);
}

/* ── soru ─────────────────────────────────────────────────────────────────── */

/**
 * Yeni sorunun başlangıç şıkları — TİPE GÖRE.
 *
 * Hepsine `["", ""]` vermek yeni tiplerde anlamsız bir başlangıç üretiyordu:
 * eşleştirmede ayraçsız iki boş satır, görselde işaretlemede ise ayrıştırılamayan
 * iki "bölge". Editör bunları temizlemek zorunda kalıyordu; başlangıcı doğru
 * vermek daha ucuz.
 */
function baslangicSiklari(tip: SoruTipi): { secenekler: string[]; dogru: number[] } {
  if (tip === "dogruYanlis") return { secenekler: ["Doğru", "Yanlış"], dogru: [0] };
  // Bölgeler görselin üzerinde çizilerek eklenir; boş şık "bozuk bölge" demek.
  if (tip === "gorselIsaret") return { secenekler: [], dogru: [] };
  // Ayraç baştan konuyor ki editör iki kutuyu ayırabilsin.
  if (tip === "eslestirme") return { secenekler: [" | ", " | "], dogru: [] };
  // Sıralamada doğru cevap kimliktir; `dogru` kullanılmaz.
  if (tip === "siralama") return { secenekler: ["", ""], dogru: [] };
  return { secenekler: ["", ""], dogru: [0] };
}

export async function soruEkleEylem(egitimId: string, tip: SoruTipi): Promise<void> {
  kapi("hazirlayan", `/egitimler/${egitimId}`);
  depo.soruEkle(egitimId, { tip, metin: "", ...baslangicSiklari(tip) });
  revalidatePath(`/egitimler/${egitimId}`);
}

/**
 * ÖNERİLEN SORULARI TOPLU EKLER.
 *
 * Öneri sunucuda yeniden ÜRETİLMEZ, istemciden gelen gövde de körlemesine
 * yazılmaz: kart tipi ve şık sayısı gibi kabuk kuralları burada da geçerli
 * (`soruEkle` şıkları olduğu gibi alır). İstemci yalnız hazırlayanın ONAYLADIĞI
 * önerileri gönderir; hazırlayan zaten bu eğitimi düzenleme yetkisine sahip,
 * yani buradan geçen içerik elle yazılabilecek içerikle aynı sınıfta.
 */
export async function onerilenSorulariEkleEylem(
  egitimId: string,
  sorular: { tip: SoruTipi; metin: string; secenekler: string[]; dogru: number[] }[],
): Promise<void> {
  const ben = kapi("hazirlayan", `/egitimler/${egitimId}`);
  for (const s of sorular) {
    if (!s.metin.trim()) continue;
    depo.soruEkle(egitimId, { tip: s.tip, metin: s.metin, secenekler: s.secenekler, dogru: s.dogru });
  }
  depo.izBirak(ben.kullanici, `kartlardan ${sorular.length} soru ekledi: ${egitimId}`);
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

/** Silinen soruyu geri koyar. Gerekçesi `sayfaGeriYukleEylem` ile aynı. */
export async function soruGeriYukleEylem(egitimId: string, veri: Omit<Soru, "id" | "egitimId">): Promise<void> {
  const ben = kapi("hazirlayan", `/egitimler/${egitimId}`);
  depo.soruEkle(egitimId, veri);
  depo.izBirak(ben.kullanici, `silinen soru geri alındı: ${egitimId}`);
  revalidatePath(`/egitimler/${egitimId}`);
}

/* ── kural ────────────────────────────────────────────────────────────────
   ATAMA KURALI EYLEMLERİ BU DOSYADA DEĞİL, `app/atama/eylemler.ts`te.

   Burada da bir takımı vardı ve hiçbir yer çağırmıyordu; `/atama` ekranı
   kendi yerel sürümünü kullanıyordu. İkisi zamanla ayrıştı: buradaki sürümde
   paket hedefi yoktu, sicil koşulu yoktu, EĞİTİM VAR MI DENETİMİ yoktu ve
   ekleme sonrası onay adresi kurulmuyordu.

   Sunucu eylemi ölü kod DEĞİLDİR: derlemede kendi kimliğiyle adreslenebilir
   bir uç nokta olarak yayınlanır. Yani "kimse çağırmıyor" demek "kimse
   ulaşamaz" demek değil — zayıf olan sürüm, güçlü olanın yanında açık bir
   kapı olarak duruyordu. Silindi.

   Yeni bir kural eylemi gerekirse `app/atama/eylemler.ts`e yazılır. */
