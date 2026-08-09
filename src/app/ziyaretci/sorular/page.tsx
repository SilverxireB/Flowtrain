import Baslik from "@/components/Baslik";
import Icon from "@/components/Icon";
import SoruYonetimi from "./SoruYonetimi";
import Saklama from "./Saklama";
import { kapiGirisli } from "@/lib/kimlik";
import * as depo from "@/lib/depo";
import * as zdepo from "@/lib/ziyaretciDepo";

export const dynamic = "force-dynamic";

/**
 * ZİYARETÇİ KAYIT SORULARI.
 *
 * Buradaki her şey VERİDİR, kod değil: soru metni, şıkları ve her şıkkın hangi
 * bilgilendirmeyi tetiklediği. Fabrika kendi sorusunu yazar — "kaynakhanede
 * çalışacak mısınız?", "kimyasal depoya girecek misiniz?" — ve kimseyi
 * aramasına gerek kalmaz.
 *
 * Bu tercih atama kural motorundakiyle aynı: kişi kişi/koşul koşul kodlamak
 * yerine kuralı kullanıcıya yazdırmak.
 */
export default function ZiyaretciSorulari() {
  kapiGirisli("/ziyaretci/sorular");

  const sorular = zdepo.sorulariGetir();
  const varsayilanlar = zdepo.varsayilanEgitimler();
  const egitimler = depo.egitimleriListele().map((e) => ({ id: e.id, ad: e.ad, yayinda: e.durum === "yayin" }));

  /* Kaç kayıt silinecek — SAYIYI ÖNCEDEN söylemek şart. "Eski kayıtlar
     silinecek" cümlesi 3 kayıtla 3000 kaydı aynı gösteriyordu. */
  const saklamaGun = zdepo.saklamaGunu();
  const eskiSayisi = zdepo.eskiSayisi();

  return (
    <main className="bg-wash min-h-screen">
      <Baslik
        ust="/ziyaretci"
        ustAd="Ziyaretçiler"
        baslik="Kayıt soruları"
        not={`${sorular.length} soru · ${varsayilanlar.length} varsayılan bilgilendirme`}
      />

      <div className="sayfa-govde space-y-8">
        <SoruYonetimi sorular={sorular} egitimler={egitimler} varsayilanlar={varsayilanlar} />

        <Saklama gun={saklamaGun} eskiSayisi={eskiSayisi} />

        <p className="flex items-start gap-2 text-sm text-muted">
          <Icon name="help" size={16} className="mt-0.5 shrink-0" />
          <span>
            Yalnız <strong className="text-ink">yayındaki</strong> bilgilendirmeler ziyaretçiye verilebilir. Taslak bir
            eğitimi burada seçebilirsiniz ama kayıt sırasında listeye girmez — yarım kalan içerik ziyaretçinin karşısına
            çıkmasın diye.
          </span>
        </p>
      </div>
    </main>
  );
}
