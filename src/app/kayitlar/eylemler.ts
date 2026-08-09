"use server";

import { revalidatePath } from "next/cache";
import { kapi } from "@/lib/kimlik";
import * as depo from "@/lib/depo";
import { personelKaynagi, kaydiGonder } from "@/lib/adaptorlar";
import { csvOku } from "@/lib/csv";
import {
  aktarimiCoz,
  sinifListesiniCoz,
  tarihiCoz,
  type AktarimBaglami,
  type AktarimKaydi,
  type AktarimRaporu,
} from "@/lib/kayitAktarim";
import type { OturumKaynagi } from "@/lib/tipler";

/**
 * KAYIT DEFTERİ EYLEMLERİ — kayıt YAZAR, hiçbiri kayıt DEĞİŞTİRMEZ ya da SİLMEZ.
 *
 * Bu dosyada bilerek `oturumGuncelle`/`oturumSil` yok. Satılan şey kayıttır;
 * düzeltme yolu yeni bir kayıt ve notudur.
 *
 * KAPI "hazirlayan": tamamlama kaydı yazmak eğitim programını yürüten kişinin
 * işidir. Amir kendi ekibinde gözetimli oturum açar (o ayrı yüzey), toplu kayıt
 * girmez — otuz kişilik listeyi kimin girdiği denetim izinde durur.
 */

/** Aynı gün, aynı kişi, aynı eğitim: mükerrer. İptal edilmiş oturum saymaz. */
function mevcutAnahtarlar(): string[] {
  return depo
    .oturumlariGetir()
    .filter((o) => !!o.bitis && o.sonuc !== "iptal")
    .map((o) => `${o.sicil}|${o.egitimId}|${(o.bitis ?? o.baslangic).slice(0, 10)}`);
}

async function baglamKur(): Promise<AktarimBaglami> {
  const kisiler = await personelKaynagi().listele();
  return {
    siciller: kisiler.map((k) => k.sicil),
    egitimler: depo.egitimleriListele().map((e) => ({ id: e.id, ad: e.ad, surum: e.surum, durum: e.durum })),
    mevcutAnahtarlar: mevcutAnahtarlar(),
  };
}

/**
 * Raporun geçerli satırlarını deftere yazar.
 *
 * DIŞ HEDEFE GÖNDERİM DE YAPILIR: sınıf ve aktarım kayıtları da kurumun
 * belgesine (`kayitlar.csv`) düşmeli. Yalnız kiosk kayıtları gönderilseydi
 * kurumun dosyası ile ürünün defteri birbirini tutmaz, hangisinin doğru olduğu
 * tartışılırdı. Gönderim başarısızsa kayıt YİNE DE geçerlidir; `senkron: hata`
 * ile beklemeye alınır ve Ayarlar'dan yeniden denenir.
 */
async function kayitlariYaz(kayitlar: AktarimKaydi[], kaynak: OturumKaynagi): Promise<number> {
  let yazilan = 0;
  for (const k of kayitlar) {
    const o = depo.oturumKaydet({
      egitimId: k.egitimId,
      egitimSurum: k.egitimSurum,
      sicil: k.sicil,
      kaynak,
      bitis: k.bitis,
      egitmen: k.egitmen,
      notlar: k.notlar,
      puan: k.puan,
    });
    depo.senkronIsaretle(o.id, (await kaydiGonder(o)) ? "gonderildi" : "hata");
    yazilan++;
  }
  return yazilan;
}

function tazele(): void {
  revalidatePath("/kayitlar");
  revalidatePath("/pano");
  revalidatePath("/ekibim");
}

export interface AktarimCevabi {
  hata?: string;
  rapor?: AktarimRaporu;
  /** Yalnız uygulama adımında dolar. */
  yazilan?: number;
}

/* ── sınıf eğitimi toplu kaydı ────────────────────────────────────────────── */

export interface SinifGirdisi {
  egitimId: string;
  /** `YYYY-AA-GG`. */
  gun: string;
  egitmen: string;
  notlar: string;
  /** Satır satır yapıştırılan katılımcı listesi. */
  liste: string;
}

/** ÖNİZLEME: kaydetmeden önce kimin gireceğini ve kimin neden atlanacağını gösterir. */
export async function sinifDenetleEylem(girdi: SinifGirdisi): Promise<AktarimCevabi> {
  kapi("hazirlayan", "/kayitlar/sinif");
  const hata = sinifHatasi(girdi);
  if (hata) return { hata };
  const baglam = await baglamKur();
  return { rapor: sinifListesiniCoz(girdi.liste, girdi.egitimId, girdi.gun, girdi.egitmen, girdi.notlar, baglam) };
}

export async function sinifKaydetEylem(girdi: SinifGirdisi): Promise<AktarimCevabi> {
  const ben = kapi("hazirlayan", "/kayitlar/sinif");
  const hata = sinifHatasi(girdi);
  if (hata) return { hata };

  /* Liste SUNUCUDA yeniden çözülür. Önizlemeden gelen satırlara güvenmek,
     ekranda "atlandı" görünen bir sicilin istek gövdesi değiştirilerek
     yazdırılması demekti — kayıt üreten bir uç noktada bu kabul edilemez. */
  const baglam = await baglamKur();
  const rapor = sinifListesiniCoz(girdi.liste, girdi.egitimId, girdi.gun, girdi.egitmen, girdi.notlar, baglam);
  const kayitlar = rapor.satirlar.map((s) => s.kayit).filter((k): k is AktarimKaydi => !!k);
  if (kayitlar.length === 0) return { rapor, yazilan: 0 };

  const yazilan = await kayitlariYaz(kayitlar, "sinif");
  const egitim = depo.egitimGetir(girdi.egitimId);
  depo.izBirak(
    ben.kullanici,
    `sınıf eğitimi kaydı: ${egitim?.ad ?? girdi.egitimId} · ${girdi.gun} · eğitmen ${girdi.egitmen.trim()} · ${yazilan} katılımcı`,
  );
  tazele();
  return { rapor, yazilan };
}

function sinifHatasi(girdi: SinifGirdisi): string | null {
  if (!girdi.egitimId) return "Eğitim seçin.";
  if (!tarihiCoz(girdi.gun)) return "Geçerli bir tarih girin.";
  // Eğitmen adı zorunlu: sınıf kaydının kiosk kaydından tek farkı, arkasında
  // duran insanın adıdır. Boş bırakılırsa kayıt kimin sözüne dayanıyor bilinmez.
  if (!girdi.egitmen.trim()) return "Eğitmen adı zorunlu — kayıt kimin beyanına dayanıyor, denetimde bu sorulur.";
  if (!girdi.liste.trim()) return "Katılımcı listesi boş.";
  return null;
}

/* ── geçmiş kayıt içe aktarımı ────────────────────────────────────────────── */

/** Tek seferde okunacak en çok satır — kazara açılan dev dosya sunucuyu kilitlemesin. */
const AKTARIM_SINIRI = 5000;

export async function aktarimDenetleEylem(metin: string): Promise<AktarimCevabi> {
  kapi("hazirlayan", "/kayitlar/aktarim");
  return { ...(await aktarimiHazirla(metin)) };
}

export async function aktarimUygulaEylem(metin: string): Promise<AktarimCevabi> {
  const ben = kapi("hazirlayan", "/kayitlar/aktarim");
  const hazir = await aktarimiHazirla(metin);
  if (hazir.hata || !hazir.rapor) return hazir;

  const kayitlar = hazir.rapor.satirlar.map((s) => s.kayit).filter((k): k is AktarimKaydi => !!k);
  if (kayitlar.length === 0) return { ...hazir, yazilan: 0 };

  const yazilan = await kayitlariYaz(kayitlar, "aktarim");
  depo.izBirak(
    ben.kullanici,
    `geçmiş kayıt aktarımı: ${yazilan} kayıt yazıldı, ${hazir.rapor.atlanan} satır atlandı`,
  );
  tazele();
  return { ...hazir, yazilan };
}

async function aktarimiHazirla(metin: string): Promise<AktarimCevabi> {
  if (!metin.trim()) return { hata: "Dosya boş." };
  const kayitlar = csvOku(metin);
  if (kayitlar.length === 0) return { hata: "Dosyada veri satırı bulunamadı." };
  if (kayitlar.length > AKTARIM_SINIRI) {
    return { hata: `Dosyada ${kayitlar.length} satır var; tek seferde en çok ${AKTARIM_SINIRI} satır alınır. Dosyayı bölün.` };
  }
  const baglam = await baglamKur();
  const rapor = aktarimiCoz(kayitlar, baglam);
  if (rapor.eksikSutunlar.length > 0) {
    return {
      rapor,
      hata: `Şu sütunlar bulunamadı: ${rapor.eksikSutunlar.join(", ")}. Başlık satırında sicil, eğitim ve tarih sütunları olmalı.`,
    };
  }
  return { rapor };
}
