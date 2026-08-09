import Baslik from "@/components/Baslik";
import AktarimFormu from "./AktarimFormu";
import { kapi } from "@/lib/kimlik";
import { SUTUN_TAKMA_ADLARI } from "@/lib/kayitAktarim";

export const dynamic = "force-dynamic";

/**
 * GEÇMİŞ KAYIT İÇE AKTARIMI — CANLIYA GEÇİŞİN ŞARTI.
 *
 * Kurulumun ilk günü defter boşsa pano herkesi "eksik" gösterir: geçen yıl
 * yüksekte çalışma eğitimini almış 300 kişi de listede kırmızı görünür. Fabrika
 * ekrana bakar, "bu liste yanlış" der ve ürünü bir daha açmaz. Geçmiş
 * tamamlamalar içeri alınmadan panonun hiçbir sayısı doğru olmaz.
 *
 * Bu kayıtlar `kaynak: 'aktarim'` taşır — nereden geldikleri denetimde
 * gizlenmez, kioskta yapılmış gibi görünmezler.
 */
export default function AktarimSayfa() {
  kapi("hazirlayan", "/kayitlar/aktarim");

  // Takma adlar tek kaynaktan (`kayitAktarim.ts`) gelir: ekranda yazan liste
  // ile kodun gerçekten kabul ettiği liste ayrışmasın.
  const takmalar = {
    sicil: SUTUN_TAKMA_ADLARI.sicil,
    egitim: SUTUN_TAKMA_ADLARI.egitim,
    tarih: SUTUN_TAKMA_ADLARI.tarih,
    puan: SUTUN_TAKMA_ADLARI.puan,
    egitmen: SUTUN_TAKMA_ADLARI.egitmen,
    notlar: SUTUN_TAKMA_ADLARI.notlar,
  };

  return (
    <main className="bg-wash min-h-screen">
      <Baslik ust="/kayitlar" ustAd="Kayıt defteri" baslik="Geçmiş kayıt aktarımı" rehberBolum="takip" />
      <div className="sayfa-govde">
        <AktarimFormu takmalar={takmalar} />
      </div>
    </main>
  );
}
