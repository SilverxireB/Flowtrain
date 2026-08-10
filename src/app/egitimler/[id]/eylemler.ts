"use server";

import { stat, unlink } from "node:fs/promises";
import { join } from "node:path";
import { revalidatePath } from "next/cache";
import { VERI_KLASORU } from "@/lib/db";
import * as depo from "@/lib/depo";
import { kapi } from "@/lib/kimlik";
import { BOLUM_EN_UZUN, bolumAnahtari, bolumleriCoz } from "./bolumler";

/**
 * EDİTÖRE ÖZEL SUNUCU EYLEMLERİ.
 *
 * Kök `app/eylemler.ts` eğitim/sayfa/soru temelini taşıyor; kart çoğaltma ve
 * medya kütüphanesi buraya yazılıyor çünkü ikisi de YALNIZ editör yüzeyinin
 * işi. Kök dosyaya eklenselerdi her yüzeyin gördüğü yüzey büyür, hangi eylemin
 * nereye ait olduğu okunmaz olurdu.
 */

/**
 * YAYINDAKİ EĞİTİM DEĞİŞTİRİLEMEZ — kök dosyadaki kapının aynısı.
 *
 * Kopyalanmış olması bilinçli: bu dosya kendi eylemlerinden sorumlu ve kapıyı
 * dışarıdan alsaydı, kök dosya değiştiğinde buradaki kapının da düştüğü fark
 * edilmezdi. Kayıtlar "sürüm N"e atıf yapıyor; içeriği yerinde değiştirmek
 * insanların kayıtta yazandan başka bir şeyden sınav olmuş görünmesi demek.
 */
function taslakMi(egitimId: string): boolean {
  return depo.egitimGetir(egitimId)?.durum !== "yayin";
}

/** Dosya adı olarak kullanılacak kimlik — `../` ile veri klasörünün dışına çıkılmasın. */
function temizKimlik(id: string): string {
  return id.replace(/[^a-zA-Z0-9._-]/g, "");
}

/* ── kart kopyalama ───────────────────────────────────────────────────────── */

/**
 * Kartı AYNI eğitimde çoğaltır ve kopyayı aslının hemen ardına koyar.
 *
 * Sona eklenip orada bırakılsaydı, otuz kartlık bir eğitimde çoğaltılan kart
 * listenin dibine düşer ve hazırlayan onu elle on beş kez yukarı taşırdı —
 * özellik faydadan çok iş çıkarırdı.
 */
export async function kartCogaltEylem(egitimId: string, sayfaId: string): Promise<void> {
  const ben = kapi("hazirlayan", `/egitimler/${egitimId}`);
  if (!taslakMi(egitimId)) return;

  const sayfalar = depo.sayfalariGetir(egitimId);
  const kaynak = sayfalar.find((s) => s.id === sayfaId);
  if (!kaynak) return;

  const yeni = depo.sayfaEkle(egitimId, {
    tip: kaynak.tip,
    baslik: kaynak.baslik ? `${kaynak.baslik} (kopya)` : "",
    metin: kaynak.metin,
    metinKarsi: kaynak.metinKarsi,
    gorselId: kaynak.gorselId,
    gorselIdler: kaynak.gorselIdler,
    videoId: kaynak.videoId,
    asgariSure: kaynak.asgariSure,
  });

  const sirali: string[] = [];
  for (const s of sayfalar) {
    sirali.push(s.id);
    if (s.id === sayfaId) sirali.push(yeni.id);
  }
  depo.sayfalariSirala(egitimId, sirali);

  depo.izBirak(ben.kullanici, `kart çoğalttı: ${egitimId}/${sayfaId}`);
  revalidatePath(`/egitimler/${egitimId}`);
}

/**
 * Kartı BAŞKA bir eğitime kopyalar.
 *
 * "Acil durumda ne yapılır" kartı her eğitimde aynı; onu on iki kez yeniden
 * yazmak hem zaman kaybı hem de on iki farklı sürümün ortaya çıkması demek.
 * Hedef eğitim TASLAK olmalı — yayındakine kart eklemek, kayıtların atıf
 * yaptığı sürümü sessizce değiştirirdi.
 */
export async function kartKopyalaEylem(egitimId: string, sayfaId: string, hedefId: string): Promise<void> {
  const ben = kapi("hazirlayan", `/egitimler/${egitimId}`);
  if (hedefId === egitimId) return;
  if (!taslakMi(hedefId)) return;

  const kaynak = depo.sayfalariGetir(egitimId).find((s) => s.id === sayfaId);
  if (!kaynak) return;

  depo.sayfaEkle(hedefId, {
    tip: kaynak.tip,
    baslik: kaynak.baslik,
    metin: kaynak.metin,
    metinKarsi: kaynak.metinKarsi,
    gorselId: kaynak.gorselId,
    gorselIdler: kaynak.gorselIdler,
    videoId: kaynak.videoId,
    asgariSure: kaynak.asgariSure,
  });

  depo.izBirak(ben.kullanici, `kartı başka eğitime kopyaladı: ${sayfaId} → ${hedefId}`);
  revalidatePath(`/egitimler/${hedefId}`);
  revalidatePath(`/egitimler/${egitimId}`);
}

/* ── bölüm başlıkları ─────────────────────────────────────────────────────── */

/**
 * Bir kartın ÜSTÜNDE başlayan bölümün adını yazar; boş ad başlığı kaldırır.
 *
 * Şema değişmiyor: harita `ayar` tablosunda eğitim başına tek JSON satırı
 * (gerekçe `bolumler.ts` başında). Kiosk bu satırı okumaz — bölüm başlığı
 * HAZIRLAYANIN ARACI, işçinin göreceği bir kart değil.
 *
 * Harita her yazımda var olan sayfa kimliklerine göre süzülüyor: silinen
 * kartın başlığı ayar satırında öksüz kalıyordu ve hiçbir ekranda görünmediği
 * için de elle temizlenemiyordu.
 */
export async function bolumBasligiEylem(egitimId: string, sayfaId: string, baslik: string): Promise<void> {
  const ben = kapi("hazirlayan", `/egitimler/${egitimId}`);
  if (!taslakMi(egitimId)) return;

  const idler = depo.sayfalariGetir(egitimId).map((s) => s.id);
  if (!idler.includes(sayfaId)) return;

  const harita = bolumleriCoz(depo.ayarOku(bolumAnahtari(egitimId)), idler);
  const temiz = baslik.trim().slice(0, BOLUM_EN_UZUN);
  if (temiz === "") delete harita[sayfaId];
  else harita[sayfaId] = temiz;

  depo.ayarYaz(bolumAnahtari(egitimId), JSON.stringify(harita));
  depo.izBirak(ben.kullanici, temiz === "" ? `bölüm başlığı kaldırdı: ${egitimId}` : `bölüm başlığı yazdı: ${egitimId} — ${temiz}`);
  revalidatePath(`/egitimler/${egitimId}`);
}

/* ── PPTX içe aktarma ─────────────────────────────────────────────────────── */

/**
 * PPTX'ten çıkan kartları TEK yazımda ekler.
 *
 * Kök dosyadaki `sayfalariTopluEkleEylem` yalnız `{gorselId, baslik}` alıyor —
 * PDF kapısının ürettiği şey bu. PPTX'ten gövde METNİ ve birden çok görsel
 * geliyor; onları tek tek `sayfaGuncelleEylem` ile arkadan yamamak kırk slaytta
 * kırk gidiş dönüş ve yarım kalırsa yarısı metinsiz kartlar demekti.
 *
 * Kart tipi "kural": PPTX'in madde listesini "adım adım" saymak yanlış olurdu
 * (çoğu slayt sıra bildirmez), hazırlayan tipi editörden tek tıkla değiştirir.
 */
export async function pptxKartlariEkleEylem(
  egitimId: string,
  kartlar: { baslik: string; metin: string; gorselIdler: string[] }[],
): Promise<void> {
  const ben = kapi("hazirlayan", `/egitimler/${egitimId}`);
  if (!taslakMi(egitimId)) return;

  for (const k of kartlar) {
    const idler = k.gorselIdler.map(temizKimlik).filter((x) => x !== "");
    depo.sayfaEkle(egitimId, {
      tip: "kural",
      baslik: k.baslik.slice(0, 200),
      metin: k.metin || undefined,
      // Tekil alan listenin İLKİ olmalı — kiosk kartı bugün onu çiziyor
      // (`editorMedya.gorselYamasi` ile aynı sözleşme).
      gorselId: idler[0],
      gorselIdler: idler,
    });
  }

  depo.izBirak(ben.kullanici, `PPTX'ten ${kartlar.length} kart ekledi: ${egitimId}`);
  revalidatePath(`/egitimler/${egitimId}`);
}

/* ── medya kütüphanesi ────────────────────────────────────────────────────── */

/**
 * Medyayı kütüphaneden VE diskten siler.
 *
 * Kaydı silip dosyayı bırakmak veri klasörünü yıllar içinde şişirirdi; dosyayı
 * silip kaydı bırakmak kütüphanede kırık küçük resimler üretirdi. Kullanımda
 * olan bir görsel de silinebilir — engellemek yerine kaç kartta kullanıldığı
 * ekranda SÖYLENİR, kararı hazırlayan verir.
 */
export async function medyaSilEylem(id: string, egitimId: string): Promise<void> {
  const ben = kapi("hazirlayan", `/egitimler/${egitimId}`);
  const temiz = temizKimlik(id);
  if (!temiz) return;

  const kullanim = depo.medyaKullanimi(temiz);
  depo.medyaSil(temiz);
  // Dosya zaten yoksa (elle silinmiş, eski kurulum) hata vermek anlamsız:
  // istenen sonuç — dosyanın olmaması — zaten sağlanmış.
  await unlink(join(VERI_KLASORU, "medya", temiz)).catch(() => {});

  depo.izBirak(ben.kullanici, `medya sildi: ${temiz} (${kullanim} yerde kullanılıyordu)`);
  revalidatePath(`/egitimler/${egitimId}`);
}

/**
 * Görselin ALT METNİ — ekran okuyucunun okuduğu şey.
 *
 * Medyaya yazılır, karta değil: aynı KKD fotoğrafı on kartta kullanılıyorsa
 * açıklaması on kez yazılmamalı. Boş bırakılırsa kart başlığından türetilen
 * bugünkü metin kullanılmaya devam eder — yani alan boş kalınca hiçbir şey
 * kötüleşmez, dolunca iyileşir.
 */
export async function medyaAltMetinEylem(id: string, altMetin: string, egitimId: string): Promise<void> {
  const ben = kapi("hazirlayan", `/egitimler/${egitimId}`);
  const temiz = temizKimlik(id);
  if (!temiz) return;

  const kirpik = altMetin.slice(0, 300).trim();

  /* İÇE AKTARILAN GÖRSELİN KÜTÜPHANEDE KAYDI YOKTUR — PDF/PPTX kapısı bilerek
     `kutuphane=hayir` diyor (kırk slaytlık sunum kütüphaneyi doldurmasın).
     Ama alt metni en çok GEREKEN görseller tam da onlar. Kayıt o an açılıyor:
     açıklaması yazılmış bir görsel zaten yeniden kullanılmaya değer, ve kayıt
     olmadan `medyaAltMetinYaz` hiçbir satırı güncellemez — kullanıcı yazar,
     hiçbir şey olmazdı. Boş metin için kayıt AÇILMAZ; alana girip çıkmak
     kütüphaneye kayıt eklememeli. */
  if (kirpik !== "" && !depo.medyalariGetir().some((m) => m.id === temiz)) {
    const yol = join(VERI_KLASORU, "medya", temiz);
    const bilgi = await stat(yol).catch(() => null);
    if (!bilgi) return;
    depo.medyaKaydet({ id: temiz, ad: temiz, tip: mimeTuru(temiz), boyut: bilgi.size, yukleyen: ben.kullanici });
  }

  depo.medyaAltMetinYaz(temiz, kirpik);
  revalidatePath(`/egitimler/${egitimId}`);
}

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  mp4: "video/mp4",
  webm: "video/webm",
};

/** Uzantıdan MIME — kimlik zaten uzantıyı taşıyor (`mdy_xxx.jpg`). */
function mimeTuru(id: string): string {
  return MIME[id.slice(id.lastIndexOf(".") + 1).toLocaleLowerCase("en")] ?? "application/octet-stream";
}

/**
 * Hiçbir kartta/soruda kullanılmayan medyaları siler.
 *
 * Kart silinince dosya diskte kalıyordu ve kütüphane yıllar içinde "kullanımı
 * 0" kayıtlarla doluyordu; kimse tek tek temizlemez. Liste ÇAĞRI ANINDA
 * yeniden hesaplanıyor: ekranın gördüğü sayı eskimiş olabilir, aradaki saniyede
 * bir görsel karta eklenmiş olsaydı onu silmek kartı boşaltırdı.
 *
 * Silinen dosya sayısını döndürür — kullanıcıya "kaç dosya gitti" denebilsin.
 */
export async function oksuzMedyalariTemizleEylem(egitimId: string): Promise<number> {
  const ben = kapi("hazirlayan", `/egitimler/${egitimId}`);

  const idler = depo.oksuzMedyalar();
  for (const ham of idler) {
    const temiz = temizKimlik(ham);
    if (!temiz) continue;
    depo.medyaSil(temiz);
    await unlink(join(VERI_KLASORU, "medya", temiz)).catch(() => {});
  }

  if (idler.length > 0) depo.izBirak(ben.kullanici, `kullanılmayan ${idler.length} medyayı temizledi`);
  revalidatePath(`/egitimler/${egitimId}`);
  return idler.length;
}
