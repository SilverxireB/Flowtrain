import Baslik from "@/components/Baslik";
import Personel from "./Personel";
import { kapi } from "@/lib/kimlik";
import { personelKaynagi } from "@/lib/adaptorlar";
import * as depo from "@/lib/depo";

export const dynamic = "force-dynamic";

export default function PersonelSayfa() {
  kapi("yonetici", "/personel");

  // Adaptör sınırı: ekran CSV'yi DEĞİL, kaynağın yönetim yeteneğini tanır.
  // Yetenek yoksa (tek yönlü OPM webservice'i) liste salt okunur gösterilir.
  const kaynak = personelKaynagi();
  const kisiler = kaynak.yonetim?.kayitlar() ?? [];
  const eslemeler = depo.mmEslemeleriGetir();

  return (
    <main className="bg-wash min-h-screen">
      <Baslik ust="/" ustAd="Ana sayfa" baslik="Personel" not={`${kisiler.length} kayıt`} />
      <div className="sayfa-govde">
        <Personel kisiler={kisiler} eslemeler={eslemeler} kaynakAdi={kaynak.ad} duzenlenebilir={!!kaynak.yonetim} />
      </div>
    </main>
  );
}
