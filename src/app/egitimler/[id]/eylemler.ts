"use server";

import { unlink } from "node:fs/promises";
import { join } from "node:path";
import { revalidatePath } from "next/cache";
import { VERI_KLASORU } from "@/lib/db";
import * as depo from "@/lib/depo";
import { kapi } from "@/lib/kimlik";

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
