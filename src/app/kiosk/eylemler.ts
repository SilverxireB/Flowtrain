"use server";

import { personelKaynagi, kaydiGonder } from "@/lib/adaptorlar";
import * as depo from "@/lib/depo";
import { kisininBekleyenleri } from "@/lib/atamaServis";
import { aktifHesap } from "@/lib/kimlik";
import { kimlik } from "@/lib/db";
import { puanla, sinaviKur, tohumla } from "@/lib/sinav";
import { yanlisAciklamalari, type YanlisAciklama } from "@/lib/kioskAkis";
import type { Egitim, Sayfa, Soru } from "@/lib/tipler";

/**
 * KİOSK EYLEMLERİ — BURADA KOKPİT KİMLİĞİ ARANMAZ.
 *
 * Bu bilinçli: işçilerin çoğunun kurumsal hesabı yok. Doğrulanan CİHAZDIR
 * (kapalı ağdaki kiosk), kişi sicil ile ATFEDİLİR ve kendi PIN'iyle imzalar.
 *
 * "Kimlik yok" DEMEK "kontrol yok" DEMEK DEĞİL. Bu dosyadaki her karar
 * sunucuda verilir; istemciden gelen hiçbir sayıya güvenilmez:
 *  · puan istemciden ALINMAZ, sunucuda yeniden hesaplanır
 *  · cevap anahtarı (`dogru`) istemciye HİÇ gönderilmez
 *  · süre `baslangic`/`bitis` damgalarından ölçülür
 *  · PIN denemeleri sayılır ve kilitlenir
 *  · sicil ve atama gerçekten var mı diye bakılır
 */

/** Kiosk'a dönen kişi bilgisi — ekranda gösterilenle SINIRLI. */
export interface KioskKisi {
  sicil: string;
  ad: string;
  bolum?: string;
}

export interface KioskDurum {
  kisi: KioskKisi;
  bekleyenler: { egitim: Egitim; durum: string; sonTarih: string | null }[];
  tamamlanan: number;
}

export async function siciliAra(sicil: string): Promise<{ hata?: string; durum?: KioskDurum }> {
  const temiz = sicil.trim();
  if (!temiz) return { hata: "Sicil numarası girin." };

  const kisi = await personelKaynagi().bul(temiz);
  if (!kisi) return { hata: "Bu sicil personel listesinde bulunamadı. Amirinize başvurun." };

  const acik = await kisininBekleyenleri(temiz);
  return {
    durum: {
      // Hat, görev, amir sicili ve işe giriş tarihi BİLEREK gönderilmiyor:
      // ekranda gösterilmiyorlar ve kimliksiz bir uç noktadan personel
      // listesi + organizasyon şeması çıkarmayı kolaylaştırıyorlardı.
      kisi: { sicil: kisi.sicil, ad: kisi.ad, bolum: kisi.bolum },
      bekleyenler: acik.map((a) => ({ egitim: a.egitim, durum: a.durum, sonTarih: a.sonTarih })),
      tamamlanan: depo.oturumlariGetir({ sicil: temiz }).filter((o) => o.sonuc === "gecti").length,
    },
  };
}

/** Sınav sorusu — cevap anahtarı OLMADAN. */
export type GizliSoru = Omit<Soru, "dogru">;

export interface OyunVerisi {
  oturumId: string;
  egitim: Egitim;
  sayfalar: Sayfa[];
  sorular: GizliSoru[];
  /** Kişi ilk kez imzalıyor mu — PIN belirleme ekranı buna göre açılır. */
  pinKurulacak: boolean;
  /** İlk PIN'de işe giriş tarihi sorulacak mı (kişide tarih varsa). */
  iseGirisSorulacak: boolean;
}

export async function oturumBaslat(sicil: string, egitimId: string): Promise<{ hata?: string; veri?: OyunVerisi }> {
  const temiz = sicil.trim();

  // Sicil GERÇEKTEN var mı: eskiden hiç bakılmıyordu, uydurma bir sicille
  // kayıt üretilebiliyordu.
  const kisi = await personelKaynagi().bul(temiz);
  if (!kisi) return { hata: "Bu sicil personel listesinde bulunamadı." };

  const egitim = depo.egitimGetir(egitimId);
  if (!egitim || egitim.durum !== "yayin") return { hata: "Eğitim yayında değil." };

  // Bu eğitim bu kişiye GERÇEKTEN atanmış ve açık mı: atanmamış bir eğitim
  // için kayıt üretmek, denetimde "almadığı eğitimi almış görünen kişi" demek.
  const bekleyen = await kisininBekleyenleri(temiz);
  if (!bekleyen.some((b) => b.egitim.id === egitimId)) {
    return { hata: "Bu eğitim size atanmış görünmüyor." };
  }

  /* DENEME HAKKI.
     Açık oturumlar da sayılır — yoksa "bitirmeden 20 oturum aç, sonra hepsini
     kapat" yarışı hakkı sessizce aşardı. Ama yalnız TAZE olanlar: kiosk kimlik
     istemediği için biri başkasının siciliyle iki kez "Başla"ya basıp o kişiyi
     eğitimden kalıcı kilitleyebilirdi, ve eğitimi yarıda bırakan işçi her
     seferinde bir hak yakardı. Eskiyenler burada kapanır. */
  depo.eskiOturumlariKapat(temiz, egitimId);
  const gecmis = depo.oturumlariGetir({ sicil: temiz, egitimId }).filter((o) => o.sonuc !== "iptal");
  if (gecmis.length >= egitim.denemeHakki) {
    return { hata: `Deneme hakkınız doldu (${egitim.denemeHakki}). Amirinize başvurun.` };
  }

  const kokpit = aktifHesap();
  /* Sınav BİR KEZ kurulur ve oturumun üstünde saklanır. Bitişte havuzdan
     yeniden üretilseydi, arada havuza tek bir soru eklenmesi permütasyonu
     değiştirip kişiyi HİÇ GÖRMEDİĞİ sorulardan puanlardı; sorular silinseydi
     set boşalıp sınavsız "geçti" kaydı üretirdi. */
  const sinav = sinaviKur(depo.sorulariGetir(egitimId), egitim.soruSayisi, egitim.karisik, tohumla(kimlik("tohum")));
  const oturum = depo.oturumBaslat({
    egitimId,
    egitimSurum: egitim.surum,
    sicil: temiz,
    gozeten: kokpit?.kullanici,
    cihaz: kokpit ? "amir-tableti" : "kiosk",
    sorulanSoruIdleri: sinav.map((q) => q.id),
  });
  depo.izBirak(kokpit?.kullanici ?? "kiosk", `oturum açıldı: ${temiz} · ${egitim.ad}`);

  const pinYok = !depo.pinVarMi(temiz);
  return {
    veri: {
      oturumId: oturum.id,
      egitim,
      sayfalar: depo.sayfalariGetir(egitimId),
      // Cevap anahtarı istemciye HİÇ inmez: eskiden `dogru` dizileriyle
      // birlikte gönderiliyordu, yani sınavın cevapları tek istekle
      // indirilebiliyordu.
      sorular: sinav.map(({ dogru: _dogru, ...s }) => s),
      pinKurulacak: pinYok,
      iseGirisSorulacak: pinYok && !!kisi.iseGiris,
    },
  };
}

export interface TamamlamaSonucu {
  hata?: string;
  puan?: number;
  gecti?: boolean;
  /**
   * Yanlış cevaplanan soruların açıklamaları — SINAV KAPANDIKTAN SONRA.
   *
   * Cevap anahtarı DEĞİL: hangi şıkkın doğru olduğu yine gönderilmiyor, yalnız
   * hazırlayanın yazdığı "neden yanlış" metni gidiyor. Kişinin kendi
   * yanlışını öğrenmesi, ezberlenecek bir harf öğrenmesinden başka bir şey;
   * sınav bir ceza değil, öğretme anıdır.
   */
  yanlislar?: YanlisAciklama[];
}

export async function oturumTamamla(
  oturumId: string,
  gonderi: {
    sayfaSureleri: Record<string, number>;
    /** soruId → işaretlenen şık indeksleri. Puanı SUNUCU hesaplar. */
    cevaplar: Record<string, number[]>;
    pin: string;
    /** İlk PIN kurulumunda doğrulama için (GG.AA.YYYY ya da YYYY-AA-GG). */
    iseGiris?: string;
  },
): Promise<TamamlamaSonucu> {
  const oturum = depo.oturumGetir(oturumId);
  if (!oturum) return { hata: "Oturum bulunamadı." };
  if (oturum.bitis) return { hata: "Bu oturum zaten kapandı." };

  if (!/^\d{4}$/.test(gonderi.pin)) return { hata: "PIN 4 rakam olmalı." };

  /* ── PIN = İMZA ────────────────────────────────────────────────────────── */
  if (depo.pinVarMi(oturum.sicil)) {
    const sonuc = depo.pinDogrula(oturum.sicil, gonderi.pin);
    if (sonuc === "kilitli") {
      // Oturumu KAPAT: açık bırakılan oturum, aynı kimlikle sınırsız deneme
      // demekti — kilit tek başına hiçbir şey korumuyordu.
      depo.oturumIptal(oturumId, "PIN kilidi");
      return { hata: `Çok fazla hatalı deneme. ${depo.PIN_KILIT_DK} dakika sonra tekrar deneyin.` };
    }
    if (sonuc !== "dogru") return { hata: "PIN hatalı." };
  } else {
    /* İLK PIN (güven-ilk-kullanımda).
       Kapalı ağdaki bir cihazdan başkasının sicilini girip onun adına PIN
       belirlemek mümkün olurdu; bunu ucuza zorlaştıran şey kişinin KENDİ
       bildiği ama listeyi görmeyenin bilmediği bir alan: işe giriş tarihi.
       Personel dosyasında tarih yoksa kapı düşer — o durumda denetim izi
       ve yöneticinin PIN sıfırlama yetkisi tek telafi kalır. */
    const kisi = await personelKaynagi().bul(oturum.sicil);
    if (kisi?.iseGiris) {
      if (!tarihEsit(gonderi.iseGiris, kisi.iseGiris)) {
        /* Oturumu KAPAT: PIN'i olmayan kişide sayaç tutacak bir satır yok,
           dolayısıyla tek bir açık oturumla tarih sınırsız denenebilirdi.
           Her deneme artık bir oturuma (ve bir deneme hakkına) mal oluyor. */
        depo.oturumIptal(oturumId, "işe giriş tarihi eşleşmedi");
        return { hata: "İşe giriş tarihi eşleşmedi. Amirinize başvurun." };
      }
    }
    depo.pinKur(oturum.sicil, gonderi.pin);
    depo.izBirak(oturum.gozeten ?? "kiosk", `ilk PIN belirlendi: ${oturum.sicil}`);
  }

  /* ── PUANLAMA SUNUCUDA ─────────────────────────────────────────────────── */
  const egitim = depo.egitimGetir(oturum.egitimId);
  if (!egitim) return { hata: "Eğitim bulunamadı." };

  // Sorular OTURUMUN KENDİ kaydından okunur: hangi soruların sorulduğu bilgisi
  // de, doğru cevaplar da istemciden GELMEZ — ve arada havuz değişse bile
  // kişi gördüğü sorulardan puanlanır.
  const sorulan = depo.sorulariKimlikle(oturum.sorulanSoruIdleri);
  const p = puanla(sorulan, gonderi.cevaplar);

  /* SINAVSIZ EĞİTİM = "okudum, onaylıyorum" kaydı.
     `puanla` sorusuz sınava bilerek 0 verir (hazırlayan soru eklemeyi
     unuttuysa kimse geçmesin diye), ama havuzda HİÇ soru olmaması ayrı bir
     durumdur: bazı eğitimler sınav değil bildirimdir — bir kuralı okuyup
     imzalamak. Kişi içeriği baştan sona gördü ve kendi PIN'iyle imzaladı;
     onu "kaldı" saymak, tamamlanması imkânsız bir eğitim üretirdi. */
  const sinavVar = sorulan.length > 0;
  const gecti = sinavVar ? p.puan >= egitim.gecmeNotu : true;

  depo.oturumBitir(oturumId, {
    sayfaSureleri: gonderi.sayfaSureleri,
    puan: sinavVar ? p.puan : 100,
    sonuc: gecti ? "gecti" : "kaldi",
    yanlisSoruIdleri: p.yanlisSoruIdleri,
    sorulanSoruIdleri: sorulan.map((s) => s.id),
  });
  depo.izBirak(
    oturum.gozeten ?? "kiosk",
    `eğitim tamamlandı: ${oturum.sicil} · ${egitim.ad} · ${sinavVar ? `${p.puan} puan` : "sınavsız"} · ${gecti ? "geçti" : "kaldı"}`,
  );

  // Dış hedefe gönderim BAŞARISIZ OLABİLİR ve bu oturumu geçersiz kılmaz —
  // kayıt yerel veritabanında durur, `senkron: hata` ile beklemeye alınır.
  const kapali = depo.oturumGetir(oturumId)!;
  depo.senkronIsaretle(oturumId, (await kaydiGonder(kapali)) ? "gonderildi" : "hata");

  return {
    puan: sinavVar ? p.puan : 100,
    gecti,
    yanlislar: yanlisAciklamalari(sorulan, p.yanlisSoruIdleri),
  };
}

/**
 * Tarihleri yazım farkına takılmadan karşılaştırır.
 * Personel dosyası `2026-08-01` de yazabilir `01.08.2026` de; kullanıcı ekrana
 * ikisinden birini girer. Biçim farkı yüzünden insanları dışarıda bırakmayız —
 * ama GÜN/AY SIRASI korunur: rakamları sıralayıp karşılaştırmak 03.05 ile
 * 05.03'ü eşit sayıyor ve tahmin uzayını gereksiz yere daraltıyordu.
 */
function tarihEsit(girilen: string | undefined, beklenen: string): boolean {
  const coz = (metin: string): string | null => {
    const p = (metin.match(/\d+/g) ?? []).map(Number);
    if (p.length < 3) return null;
    // Dört haneli parça YIL: başta ise YYYY-AA-GG, sonda ise GG.AA.YYYY.
    const [a, b, c] = p;
    const [yil, ay, gun] = String(a).length === 4 ? [a, b, c] : [c, b, a];
    if (!yil || ay < 1 || ay > 12 || gun < 1 || gun > 31) return null;
    return `${yil}-${String(ay).padStart(2, "0")}-${String(gun).padStart(2, "0")}`;
  };
  const g = coz(girilen ?? "");
  const b = coz(beklenen);
  return !!g && !!b && g === b;
}
