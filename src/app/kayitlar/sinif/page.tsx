import Baslik from "@/components/Baslik";
import SinifFormu from "./SinifFormu";
import { kapi } from "@/lib/kimlik";
import * as depo from "@/lib/depo";
import { bugun } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * SINIF EĞİTİMİ TOPLU KAYDI — ve aynı formdan DÜZELTME KAYDI.
 *
 * NEDEN VAR (sınıf): her eğitim kioskta verilmez. Eğitmen otuz kişiye sınıfta
 * anlatır; kayıt yine aynı deftere düşmelidir, yoksa panonun tamamlanma oranı
 * gerçeği göstermez ve fabrika ürüne güvenmeyi bırakır.
 *
 * NEDEN AYNI FORM (düzeltme): düzeltme yolu ürünün en çok açıklanan ama en az
 * görünen kuralıydı — "kayıt silinmez, doğrusunu yeni kayıt olarak girin"
 * yazıyorduk ama girmenin yolunu göstermiyorduk; kullanıcı boş bir sınıf
 * formuyla baş başa kalıp eğitimi, günü, sicili elle bulmak zorundaydı.
 * Defterdeki kaydın yanındaki düğme buraya alanları DOLU getirir; ekran da
 * kipini açıkça söyler. Ayrı bir "düzeltme" ekranı yazılmadı: ikisi zamanla
 * ayrışır ve düzeltme kaydı sınıf kaydından farklı bir şey sanılırdı — oysa
 * tam olarak aynı şeydir, yalnız bir kaydı işaret eder.
 *
 * Bu kayıtlar kiosk kayıtlarıyla KARIŞMAZ: `kaynak: 'sinif'` alanı ekranda
 * kart dönmediğini açıkça söyler, panodaki süre/anomali ölçüsüne girmezler.
 */
export default function SinifSayfa({
  searchParams,
}: {
  searchParams?: { duzelt?: string; egitim?: string; sicil?: string; gun?: string };
}) {
  kapi("hazirlayan", "/kayitlar/sinif");

  const egitimler = depo.egitimleriListele().map((e) => ({
    id: e.id,
    ad: e.ad,
    durum: e.durum,
    egitmen: e.egitmen ?? "",
    sureDk: e.sureDk,
  }));

  /* Düzeltilecek kayıt SUNUCUDA okunur. Adres çubuğundan gelen kimlik
     doğrulanmadan ekrana yazılsaydı, olmayan bir belge numarası için
     "düzeltme kipi" açılır ve kayıt kaydetme adımında sessizce sıradan bir
     sınıf kaydına dönerdi. */
  const duzeltilen = searchParams?.duzelt ? depo.oturumGetir(searchParams.duzelt) : null;
  const baslangic = duzeltilen
    ? {
        duzeltilen: duzeltilen.id,
        egitimId: duzeltilen.egitimId,
        gun: (duzeltilen.bitis ?? duzeltilen.baslangic).slice(0, 10),
        liste: duzeltilen.sicil,
        egitmen: duzeltilen.egitmen ?? "",
        egitimAdi: depo.egitimGetir(duzeltilen.egitimId)?.ad ?? duzeltilen.egitimId,
      }
    : undefined;

  return (
    <main className="bg-wash min-h-screen">
      <Baslik
        ust="/kayitlar"
        ustAd="Kayıt defteri"
        baslik={duzeltilen ? "Düzeltme kaydı" : "Sınıf eğitimi kaydı"}
        not={duzeltilen ? `${duzeltilen.id} numaralı kaydın yerine` : undefined}
        rehberBolum="takip"
      />
      <div className="sayfa-govde">
        <SinifFormu egitimler={egitimler} bugunGun={bugun()} baslangic={baslangic} />
      </div>
    </main>
  );
}
