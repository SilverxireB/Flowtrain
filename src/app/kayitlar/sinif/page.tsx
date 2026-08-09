import Baslik from "@/components/Baslik";
import SinifFormu from "./SinifFormu";
import { kapi } from "@/lib/kimlik";
import * as depo from "@/lib/depo";
import { bugun } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * SINIF EĞİTİMİ TOPLU KAYDI.
 *
 * NEDEN VAR: her eğitim kioskta verilmez. Eğitmen otuz kişiye sınıfta anlatır;
 * kayıt yine aynı deftere düşmelidir, yoksa panonun tamamlanma oranı gerçeği
 * göstermez ve fabrika ürüne güvenmeyi bırakır.
 *
 * Bu kayıtlar kiosk kayıtlarıyla KARIŞMAZ: `kaynak: 'sinif'` alanı ekranda
 * kart dönmediğini açıkça söyler, panodaki süre/anomali ölçüsüne girmezler.
 */
export default function SinifSayfa() {
  kapi("hazirlayan", "/kayitlar/sinif");

  const egitimler = depo.egitimleriListele().map((e) => ({
    id: e.id,
    ad: e.ad,
    durum: e.durum,
    egitmen: e.egitmen ?? "",
    sureDk: e.sureDk,
  }));

  return (
    <main className="bg-wash min-h-screen">
      <Baslik ust="/kayitlar" ustAd="Kayıt defteri" baslik="Sınıf eğitimi kaydı" rehberBolum="takip" />
      <div className="sayfa-govde">
        <SinifFormu egitimler={egitimler} bugunGun={bugun()} />
      </div>
    </main>
  );
}
