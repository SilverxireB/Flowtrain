import { OpmYapilandirmaHatasi, opmAdres, opmBasliklari, opmEksikleri, opmYapilandirmaOku } from "./opmYapilandirma";
import type { KayitHedefi } from "../adaptor";
import type { Oturum } from "../tipler";

/**
 * OPM KAYIT HEDEFİ — İSKELET.
 *
 * Tamamlanan oturumu OPM'e bildirir. `dosyaKayit.ts` ile aynı sözleşme:
 * `gonder` başarılıysa döner, DEĞİLSE FIRLATIR.
 *
 * HATA YUTULMAZ — ürünün sattığı şey kayıttır:
 *   `adaptorlar/index.ts → kaydiGonder` hatayı yakalar, `false` döner,
 *   çağıran `depo.senkronIsaretle(id, "hata")` yazar,
 *   kayıt `depo.bekleyenSenkronlar()` içinde bekler,
 *   `/ayarlar` "N kaydı yeniden gönder" düğmesini gösterir.
 * Burada bir `try/catch { }` yazmak bu zincirin tamamını sessizce koparır ve
 * kaybolan kayıt aylar sonra denetimde ortaya çıkar. YAZMAYIN.
 *
 * Kayıt yerel veritabanında HER HÂLÜKÂRDA durur; OPM'e gitmemesi kaydı
 * geçersiz kılmaz, yalnız "gönderilmedi" işaretler.
 *
 * Ayrıntılı sözleşme: `docs/OPM-ENTEGRASYON.md`.
 */

/**
 * DIŞARI VERİLEN ALANLAR — sözleşmenin kendisi.
 *
 * Çekirdek `Oturum` alanlarının tamamı gönderilmez: `sayfaSureleri` ve
 * `sorulanSoruIdleri` bizim içerik geri bildirimimizdir, kurumun eğitim
 * arşivinde işi yoktur (ve kişisel veriyi gereksiz yere dışarı taşır).
 *
 * `senkron` de gönderilmez: o bizim gönderim defterimizdir, kaydın parçası
 * değildir.
 */
export function opmKayitGovdesi(oturum: Oturum): Record<string, unknown> {
  return {
    oturumId: oturum.id,
    sicil: oturum.sicil,
    egitimId: oturum.egitimId,
    egitimSurum: oturum.egitimSurum,
    baslangic: oturum.baslangic,
    bitis: oturum.bitis ?? null,
    puan: oturum.puan ?? null,
    // 'gecti' | 'kaldi' | 'iptal'
    sonuc: oturum.sonuc ?? null,
    // 'kiosk' | 'amir' | 'sinif' | 'aktarim' — kaydın nereden doğduğu
    kaynak: oturum.kaynak,
    gozeten: oturum.gozeten ?? null,
    egitmen: oturum.egitmen ?? null,
    cihaz: oturum.cihaz,
    notlar: oturum.notlar ?? null,
  };
}

export const opmKayit: KayitHedefi = {
  ad: "OPM webservice (eğitim kaydı)",
  async gonder(oturum) {
    const y = opmYapilandirmaOku();
    const eksik = opmEksikleri(y, "kayit");
    if (eksik.length > 0) throw new OpmYapilandirmaHatasi(eksik);

    const yanit = await fetch(opmAdres(y, y.kayitYolu), {
      method: "POST",
      headers: opmBasliklari(y, { "Content-Type": "application/json" }),
      body: JSON.stringify(opmKayitGovdesi(oturum)),
      cache: "no-store",
      signal: AbortSignal.timeout(y.zamanAsimiMs),
    });

    // 2xx dışı HER ŞEY hatadır. 409 (bu oturum zaten var) da dahil:
    // "zaten var"ı başarı saymak, gerçekten reddedilen kaydı da başarı
    // saymanın kapısını açar. Tekrar gönderim güvenliği `oturumId` ile OPM
    // tarafında çözülür — sözleşmede yazılı.
    if (!yanit.ok) {
      const kuyruk = (await yanit.text().catch(() => "")).slice(0, 200);
      throw new Error(`OPM kayıt reddetti: ${yanit.status} ${yanit.statusText}${kuyruk ? ` — ${kuyruk}` : ""}`);
    }
  },
};

/**
 * "Bağlantıyı sına" düğmesinin kayıt ayağı.
 *
 * BİLEREK SAHTE KAYIT GÖNDERMEZ: sınama düğmesi kurumun eğitim arşivine çöp
 * satır yazmamalı. Yalnız yapılandırmanın tam olup olmadığını söyler.
 */
export function opmKayitSina(): { iyi: boolean; mesaj: string } {
  const eksik = opmEksikleri(opmYapilandirmaOku(), "kayit");
  return eksik.length > 0
    ? { iyi: false, mesaj: `Eksik yapılandırma — ${eksik.join(" · ")}` }
    : { iyi: true, mesaj: "Kayıt hedefi yapılandırması tam. Gerçek gönderim ilk tamamlanan oturumda denenir." };
}
