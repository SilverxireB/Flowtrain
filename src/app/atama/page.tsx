import Baslik from "@/components/Baslik";
import Icon from "@/components/Icon";
import KuralFormu from "./KuralFormu";
import KuralSatiri from "./KuralSatiri";
import { kapi } from "@/lib/kimlik";
import * as depo from "@/lib/depo";
import { personelKaynagi } from "@/lib/adaptorlar";
import { kapsamda } from "@/lib/kurallar";

export const dynamic = "force-dynamic";

export default async function Atama() {
  kapi("hazirlayan", "/atama");

  const kisiler = await personelKaynagi().listele();
  const kurallar = depo.kurallariGetir();
  const egitimler = depo.egitimleriListele();
  const egitimAdi = new Map(egitimler.map((e) => [e.id, e]));

  /**
   * Süzgeç seçenekleri PERSONEL LİSTESİNDEN türer — elle liste tutulmaz.
   * Alan adıyla çağrılır, kapanışla değil: parametre yakalayıp birden çok kez
   * çağrılan yardımcılar küçültücüde bozulabiliyor (bkz. `csv.ts` notu).
   */
  const secenek = (alan: "bolum" | "hat" | "gorev") =>
    [...new Set(kisiler.map((k) => k[alan]).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, "tr"));

  return (
    <main className="bg-wash min-h-screen">
      <Baslik ust="/" ustAd="Ana sayfa" baslik="Atama kuralları" rehberBolum="atama" not={`${kisiler.length} kişi listede`} />

      <div className="sayfa-govde space-y-8">
        {kisiler.length === 0 ? (
          <p className="card border-orta/40 bg-orta/5 p-5 text-sm">
            <strong>Personel listesi boş.</strong> Ayarlar sayfasındaki yolu kullanarak{" "}
            <span className="font-mono text-xs">personel.csv</span> dosyasını veri klasörüne bırakın. Kurallar boş listede
            kimseyi kapsamaz.
          </p>
        ) : null}

        <section className="card p-5">
          <h2 className="font-semibold">Yeni kural</h2>
          <p className="mt-1 text-sm text-muted">
            Kişi kişi atama yapmayın. Kural yazarsanız listeye sonradan düşen personel{" "}
            <strong className="text-ink">kendiliğinden</strong> kapsanır.
          </p>
          <KuralFormu
            egitimler={egitimler.map((e) => ({ id: e.id, ad: e.ad, yayinda: e.durum === "yayin" }))}
            bolumler={secenek("bolum")}
            hatlar={secenek("hat")}
            gorevler={secenek("gorev")}
          />
        </section>

        <section>
          <h2 className="eyebrow mb-3">Kurallar · {kurallar.length}</h2>
          {kurallar.length === 0 ? (
            <p className="card p-8 text-center text-muted">
              Henüz kural yok — yayındaki eğitimler kimseye atanmadı, kiosk&apos;ta hiçbir şey görünmez.
            </p>
          ) : (
            <ul className="space-y-3">
              {kurallar.map((k) => {
                const e = egitimAdi.get(k.egitimId);
                return (
                  <KuralSatiri
                    key={k.id}
                    kural={k}
                    egitimAdi={e?.ad ?? "(silinmiş eğitim)"}
                    yayinda={e?.durum === "yayin"}
                    // ÖNİZLEME: kural kaç kişiyi kapsıyor. Kuralı yazarken
                    // sayıyı görmeyen kişi 400 kişilik bir eğitim atadığını
                    // ancak kiosk'ta kuyruk olunca fark eder.
                    kisiSayisi={kisiler.filter((kisi) => kapsamda(kisi, k)).length}
                  />
                );
              })}
            </ul>
          )}
        </section>

        <p className="flex items-start gap-2 text-sm text-muted">
          <Icon name="help" size={16} className="mt-0.5" />
          <span>
            Kural pasifse veya eğitim taslaktaysa kimseye düşmez. Yayında olmayan bir eğitim kiosk&apos;ta hiç görünmez —
            yarım kalan içerik hatta çıkmasın diye.
          </span>
        </p>
      </div>
    </main>
  );
}
