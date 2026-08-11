import Link from "next/link";
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
  const gruplar = depo.gruplariGetir();
  const egitimKarti = new Map(egitimler.map((e) => [e.id, e]));
  const grupKarti = new Map(gruplar.map((g) => [g.id, g]));

  /**
   * Süzgeç seçenekleri PERSONEL LİSTESİNDEN türer — elle liste tutulmaz.
   * Alan adıyla çağrılır, kapanışla değil: parametre yakalayıp birden çok kez
   * çağrılan yardımcılar küçültücüde bozulabiliyor (bkz. `csv.ts` notu).
   */
  const secenek = (alan: "bolum" | "hat" | "gorev") =>
    [...new Set(kisiler.map((k) => k[alan]).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, "tr"));

  /**
   * KOMBİNASYONLAR — formun "kaç kişiye gidecek" sayacı için.
   *
   * Bin kişilik listeyi istemciye taşımak yerine ayrık (bölüm, hat, görev)
   * üçlüleri ve her birinin kaç kişi olduğu gönderiliyor: fabrikada birkaç yüz
   * ayrık üçlü var, kişi sayısı ise binlerce. Sayaç aynı sonucu verir çünkü
   * kapsam yalnız bu üç boyuta bakıyor (`kosulKapsar`).
   */
  const kombinasyonlar = (() => {
    const harita = new Map<string, { bolum?: string; hat?: string; gorev?: string; adet: number }>();
    for (const k of kisiler) {
      const anahtar = `${k.bolum ?? ""}|${k.hat ?? ""}|${k.gorev ?? ""}`;
      const v = harita.get(anahtar);
      if (v) v.adet++;
      else harita.set(anahtar, { bolum: k.bolum, hat: k.hat, gorev: k.gorev, adet: 1 });
    }
    return [...harita.values()];
  })();

  const paketKuralSayisi = kurallar.filter((k) => k.grupId).length;

  return (
    <main className="bg-wash min-h-screen">
      <Baslik
        ust="/"
        ustAd="Ana sayfa"
        baslik="Atama kuralları"
        rehberBolum="atama"
        not={`${kisiler.length} kişi listede`}
        sag={
          <Link href="/gruplar" className="btn-ghost text-sm">
            <Icon name="folder" size={16} /> Eğitim paketleri
          </Link>
        }
      />

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
            <strong className="text-ink">kendiliğinden</strong> kapsanır. Kuralı bir{" "}
            <strong className="text-ink">pakete</strong> yazarsanız, pakete sonradan eklenen eğitim de kendiliğinden
            kapsanır.
          </p>
          <KuralFormu
            egitimler={egitimler.map((e) => ({ id: e.id, ad: e.ad, yayinda: e.durum === "yayin" }))}
            paketler={gruplar.map((g) => ({ id: g.id, ad: g.ad, egitimSayisi: g.egitimIdleri.length }))}
            bolumler={secenek("bolum")}
            hatlar={secenek("hat")}
            gorevler={secenek("gorev")}
            kombinasyonlar={kombinasyonlar}
          />
        </section>

        <section>
          <h2 className="eyebrow mb-3">
            Kurallar · {kurallar.length}
            {paketKuralSayisi > 0 ? ` (${paketKuralSayisi} paket kuralı)` : ""}
          </h2>
          {kurallar.length === 0 ? (
            <p className="card p-8 text-center text-muted">
              Henüz kural yok — yayındaki eğitimler kimseye atanmadı, kiosk&apos;ta hiçbir şey görünmez.
            </p>
          ) : (
            <ul className="space-y-3">
              {kurallar.map((k) => {
                const grup = k.grupId ? grupKarti.get(k.grupId) : undefined;
                const uyeler = grup?.egitimIdleri ?? [];
                const e = egitimKarti.get(k.egitimId);
                return (
                  <KuralSatiri
                    key={k.id}
                    kural={k}
                    paketMi={!!k.grupId}
                    hedefAdi={k.grupId ? (grup?.ad ?? "(silinmiş paket)") : (e?.ad ?? "(silinmiş eğitim)")}
                    uyeAdlari={uyeler.map((id) => egitimKarti.get(id)?.ad ?? "(silinmiş)")}
                    // Paket kuralı, üyelerinden EN AZ BİRİ yayındaysa iş görür.
                    yayinda={
                      k.grupId
                        ? uyeler.some((id) => egitimKarti.get(id)?.durum === "yayin")
                        : e?.durum === "yayin"
                    }
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
