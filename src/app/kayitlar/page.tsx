import Link from "next/link";
import Baslik from "@/components/Baslik";
import Icon from "@/components/Icon";
import Defter from "./Defter";
import { kapi } from "@/lib/kimlik";
import * as depo from "@/lib/depo";
import { personelKaynagi } from "@/lib/adaptorlar";
import { gecenSure } from "@/lib/anomali";
import { ayEkle } from "@/lib/kurallar";
import type { KayitSatiri } from "@/lib/rapor";
import { bugun } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * KAYIT DEFTERİ — tüm tamamlama kayıtları tek yerde.
 *
 * DÜZENLEME VE SİLME YOK, BU BİR EKSİK DEĞİL KARARDIR. Satılan şey kayıttır;
 * düzenlenebilir bir tamamlama kaydı denetimde değersizdir ("bu satırı dün
 * kim değiştirdi?" sorusunun cevabı yoksa belgenin hükmü yoktur). Yanlış kayıt
 * silinmez: doğrusu YENİ bir kayıt olarak girilir ve gerekçesi kaydın notuna
 * yazılır — denetim izi her iki satırı da görür.
 *
 * Birleştirme SUNUCUDA yapılır: oturum + eğitim + kişi tek düzlemde istemciye
 * iner, ekran ve dışa aktarım AYNI satırı görür. İkisi ayrı ayrı kurulsaydı
 * CSV'de olan bir sütun ekranda olmayabilirdi.
 */
export default async function KayitlarSayfa() {
  kapi("hazirlayan", "/kayitlar");

  const kisiler = await personelKaynagi().listele();
  const kisiKarti = new Map(kisiler.map((k) => [k.sicil, k]));
  const egitimler = depo.egitimleriListele();
  const egitimKarti = new Map(egitimler.map((e) => [e.id, e]));

  const satirlar: KayitSatiri[] = depo.oturumlariGetir().map((o) => {
    const e = egitimKarti.get(o.egitimId);
    const k = kisiKarti.get(o.sicil);
    const bitisGunu = o.bitis?.slice(0, 10);
    return {
      id: o.id,
      egitimId: o.egitimId,
      // Eğitim silinmiş olabilir; kayıt yine de durur ve kimliğiyle gösterilir.
      egitimAdi: e?.ad ?? `(silinmiş eğitim · ${o.egitimId})`,
      egitimSurum: o.egitimSurum,
      kategori: e?.kategori ?? "",
      zorunlu: !!e?.zorunlu,
      sicil: o.sicil,
      ad: k?.ad ?? "",
      bolum: k?.bolum ?? "",
      baslangic: o.baslangic,
      bitis: o.bitis,
      // Sınıf/aktarım kaydında başlangıç ile bitiş aynı damgadır: süre
      // ÖLÇÜLMEDİ demektir, sıfır demek değil — o yüzden alan boş bırakılır.
      sureSn: o.bitis && o.bitis !== o.baslangic ? gecenSure(o) : undefined,
      puan: o.puan,
      sonuc: o.sonuc,
      kaynak: o.kaynak,
      egitmen: o.egitmen,
      gozeten: o.gozeten,
      notlar: o.notlar,
      gecerlilikBitis:
        o.sonuc === "gecti" && bitisGunu && e?.tekrarAy ? ayEkle(bitisGunu, e.tekrarAy) : undefined,
    };
  });

  const bolumler = [...new Set(satirlar.map((s) => s.bolum).filter(Boolean))].sort((a, b) => a.localeCompare(b, "tr"));

  return (
    <main className="bg-wash min-h-screen">
      <Baslik
        ust="/"
        ustAd="Ana sayfa"
        baslik="Kayıt defteri"
        not={`${satirlar.length} kayıt`}
        rehberBolum="takip"
        sag={
          <>
            <Link href="/kayitlar/sinif" className="btn-ghost text-sm">
              <Icon name="users" size={16} /> Sınıf kaydı
            </Link>
            <Link href="/kayitlar/aktarim" className="btn-ghost text-sm">
              <Icon name="upload" size={16} /> Geçmiş kayıt
            </Link>
          </>
        }
      />

      <div className="sayfa-govde">
        <Defter
          satirlar={satirlar}
          egitimler={egitimler.map((e) => ({ id: e.id, ad: e.ad }))}
          bolumler={bolumler}
          bugunGun={bugun()}
        />
      </div>
    </main>
  );
}
