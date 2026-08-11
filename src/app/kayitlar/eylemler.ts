"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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
import { duzeltmeNotu } from "@/lib/rapor";
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

/**
 * YAZMA BİTTİ — SONUCU ADRESE KOYUP DÖN.
 *
 * NEDEN BÖYLE: sonuç eskiden formun kendi durumunda (`useState`) tutuluyordu ve
 * kullanıcı hiçbir onay göremiyordu. Sebebi ölçüldü — yukarıdaki `tazele()`
 * içindeki `revalidatePath`, eylem dönerken bulunulan sayfayı da yeniden
 * kurduruyor; taze bir sayfa yüklemesinden sonraki İLK kaydetmede form
 * bileşeni sıfırdan doğuyor ve az önce yazılan `rapor`/`yazilan` durumu onunla
 * birlikte ölüyordu. Ekranda kalan tek şey boşalmış bir formdu: eğitmen otuz
 * kişilik listeyi kaydediyor, hiçbir şey görmüyordu.
 *
 * `router.refresh()`ı kaldırmak ÇÖZMEDİ (denendi, yeniden kurulma sürüyor) ve
 * `revalidatePath`ten vazgeçmek de olmaz — kayıt defteri, pano ve amir tableti
 * tazeliğini ona borçlu. Bu yüzden onay, yeniden kurulmayı ATLATAN tek yere
 * taşındı: adres. Sayfa sonucu sunucudan çiziyor, dolayısıyla bileşen kaç kez
 * yeniden kurulursa kurulsun yazı yerinde kalıyor; yenilenmeye ve paylaşılan
 * bağlantıya da dayanıklı.
 */
function sonucaDon(yol: string, yazilan: number, atlanan: number): never {
  redirect(`${yol}?yazildi=${yazilan}&atlanan=${atlanan}`);
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
  /**
   * DÜZELTME KAYDI: hangi kaydın yerine geçtiği (defterdeki oturum kimliği).
   *
   * Doluysa iki şey değişir: (1) aynı kişi/eğitim/gün için mükerrer denetimi
   * aşılır — yoksa "kayıt zaten var" diyerek düzeltmenin kendisini engellerdi,
   * (2) not alanının BAŞINA düzeltilen belgenin numarası yazılır. Not
   * kullanıcının eline bırakılsaydı bağ her seferinde başka biçimde yazılır ve
   * defter iki satırı birbirine bağlayamazdı.
   */
  duzeltilen?: string;
}

/**
 * Düzeltme kaydının gerçekten bir kaydı düzeltip düzeltmediğini SUNUCUDA
 * doğrular ve nota bağı yazar. İstemciden gelen kimliğe güvenilmez: olmayan bir
 * belge numarası, defterde hiçbir şeye bağlanmayan bir "düzeltme" satırı
 * bırakırdı — denetimde en kötü satır türü.
 */
function duzeltmeyiCoz(girdi: SinifGirdisi): { notlar: string; mukerrerIzni: boolean; hata?: string } {
  if (!girdi.duzeltilen) return { notlar: girdi.notlar, mukerrerIzni: false };
  const eski = depo.oturumGetir(girdi.duzeltilen);
  if (!eski) return { notlar: girdi.notlar, mukerrerIzni: false, hata: "Düzeltilecek kayıt bulunamadı." };
  return { notlar: duzeltmeNotu(eski.id, girdi.notlar), mukerrerIzni: true };
}

/** ÖNİZLEME: kaydetmeden önce kimin gireceğini ve kimin neden atlanacağını gösterir. */
export async function sinifDenetleEylem(girdi: SinifGirdisi): Promise<AktarimCevabi> {
  kapi("hazirlayan", "/kayitlar/sinif");
  const hata = sinifHatasi(girdi);
  if (hata) return { hata };
  const d = duzeltmeyiCoz(girdi);
  if (d.hata) return { hata: d.hata };
  const baglam = await baglamKur();
  return {
    rapor: sinifListesiniCoz(girdi.liste, girdi.egitimId, girdi.gun, girdi.egitmen, d.notlar, baglam, {
      mukerrerIzni: d.mukerrerIzni,
    }),
  };
}

export async function sinifKaydetEylem(girdi: SinifGirdisi): Promise<AktarimCevabi> {
  const ben = kapi("hazirlayan", "/kayitlar/sinif");
  const hata = sinifHatasi(girdi);
  if (hata) return { hata };
  const d = duzeltmeyiCoz(girdi);
  if (d.hata) return { hata: d.hata };

  /* Liste SUNUCUDA yeniden çözülür. Önizlemeden gelen satırlara güvenmek,
     ekranda "atlandı" görünen bir sicilin istek gövdesi değiştirilerek
     yazdırılması demekti — kayıt üreten bir uç noktada bu kabul edilemez. */
  const baglam = await baglamKur();
  const rapor = sinifListesiniCoz(girdi.liste, girdi.egitimId, girdi.gun, girdi.egitmen, d.notlar, baglam, {
    mukerrerIzni: d.mukerrerIzni,
  });
  const kayitlar = rapor.satirlar.map((s) => s.kayit).filter((k): k is AktarimKaydi => !!k);
  if (kayitlar.length === 0) return { rapor, yazilan: 0 };

  const yazilan = await kayitlariYaz(kayitlar, "sinif");
  const egitim = depo.egitimGetir(girdi.egitimId);
  depo.izBirak(
    ben.kullanici,
    girdi.duzeltilen
      ? `düzeltme kaydı: ${girdi.duzeltilen} numaralı kaydın yerine · ${egitim?.ad ?? girdi.egitimId} · ${girdi.gun} · ${yazilan} kayıt`
      : `sınıf eğitimi kaydı: ${egitim?.ad ?? girdi.egitimId} · ${girdi.gun} · eğitmen ${girdi.egitmen.trim()} · ${yazilan} katılımcı`,
  );
  tazele();
  sonucaDon("/kayitlar/sinif", yazilan, rapor.atlanan);
}

function sinifHatasi(girdi: SinifGirdisi): string | null {
  if (!girdi.egitimId) return "Eğitim seçin.";
  if (!tarihiCoz(girdi.gun)) return "Geçerli bir tarih girin.";
  /* DÜZELTMEDE GEREKÇE, SINIFTA EĞİTMEN ZORUNLU — ikisi de aynı soruyu
     cevaplıyor: "bu kayıt kimin beyanına dayanıyor?" Sınıf kaydında cevap
     dersi veren kişidir. Düzeltmede ise kaydın arkasında bir ders yok, bir
     KARAR var; denetçinin soracağı şey eğitmenin adı değil, önceki kaydın
     neden yanlış olduğudur. Düzeltmede eğitmen istemek de anlamsızdı: kiosk
     kaydını düzelten kişinin yazacağı bir eğitmen adı yok. */
  if (girdi.duzeltilen) {
    if (!girdi.notlar.trim()) return "Düzeltme gerekçesi zorunlu — denetimde sorulan soru, önceki kaydın neden yanlış olduğudur.";
  } else if (!girdi.egitmen.trim()) {
    return "Eğitmen adı zorunlu — kayıt kimin beyanına dayanıyor, denetimde bu sorulur.";
  }
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
  sonucaDon("/kayitlar/aktarim", yazilan, hazir.rapor.atlanan);
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
