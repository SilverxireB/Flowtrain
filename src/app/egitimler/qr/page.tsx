import Baslik from "@/components/Baslik";
import Icon from "@/components/Icon";
import Etiketler, { type EtiketVerisi } from "./Etiketler";
import { kapi } from "@/lib/kimlik";
import * as depo from "@/lib/depo";
import { kioskBaglantisi, qrKenar, qrMatris, qrYolu } from "@/lib/qr";

export const dynamic = "force-dynamic";

export const metadata = { title: "FlowTrain — QR etiketleri" };

/**
 * YAZDIRILABİLİR QR ETİKET SAYFASI.
 *
 * Dijitalleşmenin asıl anahtarı bu sayfa: istasyona asılan etiketi okutan işçi
 * kioskta liste karıştırmadan doğrudan o eğitime düşer. Kâğıt talimatın yerini
 * alan şey, kâğıt kadar kolay asılabilen bir şey olmak zorunda.
 *
 * QR'LAR SUNUCUDA ÜRETİLİR: matris saf bir hesap ama 60 eğitim × 8 maske
 * denemesi süzgeç her değiştiğinde tarayıcıda yeniden koşardı. Sunucu bir kez
 * hesaplar, istemciye yalnız SVG yol verisi iner — QR modülü istemci paketine
 * hiç girmez.
 *
 * TASLAKLAR DA LİSTELENİR ama seçili gelmez: taslak eğitim kioskta açılmaz,
 * o etiketi asmak duvara ölü bir bağlantı asmaktır.
 */
export default function QrEtiketleri() {
  kapi("hazirlayan", "/egitimler/qr");

  const temelAdres = depo.ayarOku("temelAdres");
  const egitimler = depo.egitimleriListele();

  const etiketler: EtiketVerisi[] = egitimler.map((e) => {
    const baglanti = kioskBaglantisi(e.id, temelAdres);
    // Modül birimi 1: ölçek CSS'te belirlenir, aynı yol hem ekranda hem
    // kâğıtta keskin çıkar (vektör).
    const matris = qrMatris(baglanti);
    return {
      id: e.id,
      ad: e.ad,
      kategori: e.kategori,
      yayinda: e.durum === "yayin",
      baglanti,
      yol: qrYolu(matris, 1, 4),
      kenar: qrKenar(matris, 1, 4),
    };
  });

  const kategoriler = depo.kategorileriGetir();

  return (
    <main className="bg-wash min-h-screen">
      <div className="yazdirma-gizle">
        <Baslik
          ust="/egitimler"
          ustAd="Eğitimler"
          baslik="QR etiketleri"
          not={`${etiketler.length} eğitim`}
          rehberBolum="hazirlama"
        />
      </div>

      <div className="sayfa-govde">
        <section className="yazdirma-gizle card p-5">
          <h2 className="font-semibold">Hattaki istasyona asılacak etiketler</h2>
          <p className="mt-1 text-sm text-muted">
            Etiketi okutan kişi kioskta <strong className="text-ink">doğrudan o eğitime</strong> düşer — liste
            karıştırmaz, sicilini girip başlar. Seçtiklerinizi A4&apos;e sığan ızgarada yazdırın, laminatlayıp
            istasyona asın.
          </p>

          {temelAdres ? (
            <p className="mt-3 flex items-start gap-2 rounded-flow bg-wash px-3 py-2 text-sm text-muted">
              <Icon name="link" size={16} className="mt-0.5" />
              <span>
                Etiketler <span className="font-mono text-xs text-ink">{temelAdres}</span> adresine bakıyor. Kurulumun
                adresi değişirse etiketler yeniden basılmalı.
              </span>
            </p>
          ) : (
            /* Göreli yol telefonda ÇALIŞMAZ: kamera uygulaması "/kiosk?..." metnini
               açacak bir sunucu bilmez. Bunu basmadan önce söylemek zorundayız. */
            <p className="mt-3 flex items-start gap-2 rounded-flow border border-orta/40 bg-orta/5 px-3 py-2 text-sm">
              <Icon name="warning" size={16} className="mt-0.5 text-orta-dark" />
              <span>
                <strong>Kurulum adresi tanımlı değil.</strong> Etiketler göreli yol (
                <span className="font-mono text-xs">/kiosk?egitim=…</span>) taşır ve telefon kamerası bunu açamaz.
                Ayarlar sayfasında <span className="font-mono text-xs">temelAdres</span> değerini
                (örn. <span className="font-mono text-xs">http://10.20.0.5:3000</span>) tanımlayın, sonra basın.
              </span>
            </p>
          )}
        </section>

        <Etiketler etiketler={etiketler} kategoriler={kategoriler} />
      </div>
    </main>
  );
}
