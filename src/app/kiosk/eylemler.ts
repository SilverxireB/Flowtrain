"use server";

import { personelKaynagi, kaydiGonder } from "@/lib/adaptorlar";
import * as depo from "@/lib/depo";
import { kisininBekleyenleri } from "@/lib/atamaServis";
import { aktifHesap } from "@/lib/kimlik";
import type { Egitim, Kisi, Sayfa, Soru } from "@/lib/tipler";

/**
 * KİOSK EYLEMLERİ — BURADA KOKPİT KİMLİĞİ ARANMAZ.
 *
 * Bu bilinçli: işçilerin çoğunun kurumsal hesabı yok. Doğrulanan CİHAZDIR
 * (kapalı ağdaki kiosk), kişi sicil ile ATFEDİLİR ve kendi PIN'iyle imzalar.
 *
 * Amir tableti aynı eylemleri kullanır; tek fark oturuma `gozeten` yazılması
 * (kokpit oturumu varsa). Böylece gözetimli oturum kaydı kâğıt imzadan daha
 * güçlü olur: kimin yanında, hangi cihazda, ne kadar sürede yapıldığı durur.
 */

export interface KioskDurum {
  kisi: Kisi;
  bekleyenler: { egitim: Egitim; durum: string; sonTarih: string | null }[];
  tamamlanan: number;
  pinKurulacak: boolean;
}

export async function siciliAra(sicil: string): Promise<{ hata?: string; durum?: KioskDurum }> {
  const temiz = sicil.trim();
  if (!temiz) return { hata: "Sicil numarası girin." };

  const kisi = await personelKaynagi().bul(temiz);
  // Mesaj bilerek AYRINTISIZ: sicil listesini deneme yanılmayla çıkarmak
  // kolay olmasın. Ama "personel listesinde yok" demek de gerekiyor, yoksa
  // kart okutan kişi ekrana bakıp ne yapacağını bilemez.
  if (!kisi) return { hata: "Bu sicil personel listesinde bulunamadı. Amirinize başvurun." };

  const acik = await kisininBekleyenleri(temiz);
  return {
    durum: {
      kisi,
      bekleyenler: acik.map((a) => ({ egitim: a.egitim, durum: a.durum, sonTarih: a.sonTarih })),
      tamamlanan: depo.oturumlariGetir({ sicil: temiz }).filter((o) => o.sonuc === "gecti").length,
      pinKurulacak: !depo.pinVarMi(temiz),
    },
  };
}

export interface OyunVerisi {
  oturumId: string;
  egitim: Egitim;
  sayfalar: Sayfa[];
  sorular: Soru[];
}

export async function oturumBaslat(sicil: string, egitimId: string): Promise<{ hata?: string; veri?: OyunVerisi }> {
  const egitim = depo.egitimGetir(egitimId);
  if (!egitim || egitim.durum !== "yayin") return { hata: "Eğitim yayında değil." };

  // Deneme hakkı sunucuda kontrol edilir: istemciye güvenilmez, ayrıca
  // hakkı biten kişi tarayıcıyı yenileyerek sınırsız deneme yapamamalı.
  const gecmis = depo.oturumlariGetir({ sicil, egitimId }).filter((o) => o.bitis);
  if (gecmis.some((o) => o.sonuc === "gecti")) {
    // Süresi dolan tekrar eğitimi bir istisna: geçmiş olsa da yeniden girilir.
    const tekrarGerekli = (await kisininBekleyenleri(sicil)).some((a) => a.egitim.id === egitimId);
    if (!tekrarGerekli) return { hata: "Bu eğitimi zaten geçtiniz." };
  } else if (gecmis.length >= egitim.denemeHakki) {
    return { hata: `Deneme hakkınız doldu (${egitim.denemeHakki}). Amirinize başvurun.` };
  }

  const kokpit = aktifHesap();
  const oturum = depo.oturumBaslat({
    egitimId,
    egitimSurum: egitim.surum,
    sicil,
    gozeten: kokpit?.kullanici,
    cihaz: kokpit ? "amir-tableti" : "kiosk",
  });

  return {
    veri: {
      oturumId: oturum.id,
      egitim,
      sayfalar: depo.sayfalariGetir(egitimId),
      sorular: depo.sorulariGetir(egitimId),
    },
  };
}

export async function oturumTamamla(
  oturumId: string,
  sonuc: {
    puan: number;
    gecti: boolean;
    sayfaSureleri: Record<string, number>;
    sorulanSoruIdleri: string[];
    yanlisSoruIdleri: string[];
    pin: string;
  },
): Promise<{ hata?: string }> {
  const oturum = depo.oturumGetir(oturumId);
  if (!oturum) return { hata: "Oturum bulunamadı." };
  if (oturum.bitis) return { hata: "Bu oturum zaten kapandı." };

  // PIN = İMZA. İlk kez giren kişi burada belirler; sonrakilerde doğrulanır.
  // Amir tableti bu adımı ATLAYAMAZ — sahteciliğe karşı tek gerçek engel bu.
  if (!/^\d{4}$/.test(sonuc.pin)) return { hata: "PIN 4 rakam olmalı." };
  if (depo.pinVarMi(oturum.sicil)) {
    if (!depo.pinDogrula(oturum.sicil, sonuc.pin)) return { hata: "PIN hatalı." };
  } else {
    depo.pinKur(oturum.sicil, sonuc.pin);
  }

  depo.oturumBitir(oturumId, {
    sayfaSureleri: sonuc.sayfaSureleri,
    puan: sonuc.puan,
    sonuc: sonuc.gecti ? "gecti" : "kaldi",
    yanlisSoruIdleri: sonuc.yanlisSoruIdleri,
    sorulanSoruIdleri: sonuc.sorulanSoruIdleri,
  });

  // Dış hedefe gönderim BAŞARISIZ OLABİLİR ve bu oturumu geçersiz kılmaz —
  // kayıt yerel veritabanında durur, `senkron: hata` ile beklemeye alınır.
  const kapali = depo.oturumGetir(oturumId)!;
  depo.senkronIsaretle(oturumId, (await kaydiGonder(kapali)) ? "gonderildi" : "hata");

  return {};
}
