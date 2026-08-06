import Baslik from "@/components/Baslik";
import Icon from "@/components/Icon";
import Ekip from "./Ekip";
import { kapi } from "@/lib/kimlik";
import { ekibinDurumu } from "@/lib/atamaServis";
import { acikMi } from "@/lib/kurallar";

export const dynamic = "force-dynamic";

export default async function Ekibim() {
  const hesap = kapi("amir", "/ekibim");

  if (!hesap.sicil) {
    return (
      <main className="bg-wash min-h-screen">
        <Baslik ust="/" ustAd="Ana sayfa" baslik="Ekibim" />
        <div className="mx-auto max-w-2xl px-5 py-10">
          <p className="card border-orta/40 bg-orta/5 p-6">
            <strong>Hesabınıza sicil numarası tanımlanmamış.</strong> Ekip listesi, personel dosyasındaki{" "}
            <span className="font-mono text-xs">amir</span> sütunundan çıkar; hesabınıza sicil girilene kadar kimse
            görünmez. Yönetici, Ayarlar sayfasından ekleyebilir.
          </p>
        </div>
      </main>
    );
  }

  const satirlar = await ekibinDurumu(hesap.sicil);
  const acik = satirlar.filter((s) => acikMi(s.durum));
  const kisiSayisi = new Set(satirlar.map((s) => s.sicil)).size;
  const doluyor = satirlar.filter((s) => s.durum === "suresiDoluyor").length;

  return (
    <main className="bg-wash min-h-screen">
      <Baslik ust="/" ustAd="Ana sayfa" baslik="Ekibim" not={`${kisiSayisi} kişi`} />

      <div className="mx-auto max-w-3xl px-5 py-8">
        {/* AMİRİN KARNESİ: bu üç sayı onun her gün açma sebebi. Eğitimin
            oynatılması bu ekranın alt işlemidir, ana işi değil. */}
        <div className="grid grid-cols-3 gap-3">
          <Kutu sayi={kisiSayisi} etiket="Kişi" />
          <Kutu sayi={acik.length} etiket="Eksik" vurgu={acik.length > 0 ? "brand" : undefined} />
          <Kutu sayi={doluyor} etiket="Süresi doluyor" vurgu={doluyor > 0 ? "orta" : undefined} />
        </div>

        {satirlar.length === 0 ? (
          <p className="card mt-6 p-8 text-center text-muted">
            Size bağlı personel bulunamadı. Personel dosyasındaki <span className="font-mono text-xs">amir</span> sütunu
            sicilinizi ({hesap.sicil}) göstermiyor olabilir.
          </p>
        ) : (
          <Ekip
            satirlar={satirlar.map((s) => ({
              sicil: s.sicil,
              ad: s.kisi?.ad ?? s.sicil,
              egitimId: s.egitim.id,
              egitimAdi: s.egitim.ad,
              durum: s.durum,
              sonTarih: s.sonTarih,
              gecerlilikBitis: s.gecerlilikBitis ?? null,
            }))}
          />
        )}

        <p className="mt-8 flex items-start gap-2 text-sm text-muted">
          <Icon name="shield" size={16} className="mt-0.5 shrink-0" />
          <span>
            &quot;Başlat&quot; dediğinizde eğitim sizin gözetiminizde açılır, ama{" "}
            <strong className="text-ink">bitirme PIN&apos;ini kişinin kendisi girer.</strong> Kayıtta hem sizin hem onun
            imzası durur — bu, kâğıt imzadan daha güçlü bir belgedir.
          </span>
        </p>
      </div>
    </main>
  );
}

function Kutu({ sayi, etiket, vurgu }: { sayi: number; etiket: string; vurgu?: "brand" | "orta" }) {
  const renk = vurgu === "brand" ? "text-brand" : vurgu === "orta" ? "text-orta" : "text-ink";
  return (
    <div className="card p-4 text-center">
      <p className={`text-3xl font-extrabold ${renk}`}>{sayi}</p>
      <p className="mt-1 text-xs font-semibold text-muted">{etiket}</p>
    </div>
  );
}
