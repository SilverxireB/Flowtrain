import Link from "next/link";
import Baslik from "@/components/Baslik";
import Icon from "@/components/Icon";
import Gruplar, { type EgitimSecenegi, type PaketSatiri } from "./Gruplar";
import { grupOlusturEylem } from "./eylemler";
import { kapi } from "@/lib/kimlik";
import * as depo from "@/lib/depo";
import { tumAtamalar } from "@/lib/atamaServis";
import { paketOzeti } from "@/lib/katalog";

export const dynamic = "force-dynamic";

export const metadata = { title: "FlowTrain — Eğitim paketleri" };

export default async function GruplarSayfasi() {
  kapi("hazirlayan", "/gruplar");

  const gruplar = depo.gruplariGetir();
  const egitimler = depo.egitimleriListele();
  const kurallar = depo.kurallariGetir();

  const atamalar = (await tumAtamalar()).map((a) => ({ sicil: a.sicil, egitimId: a.egitimId, durum: a.durum }));

  const paketler: PaketSatiri[] = gruplar.map((g) => ({
    id: g.id,
    ad: g.ad,
    aciklama: g.aciklama ?? "",
    egitimIdleri: g.egitimIdleri,
    ozet: paketOzeti(atamalar, g.egitimIdleri),
    kuralSayisi: kurallar.filter((k) => k.grupId === g.id).length,
  }));

  const secenekler: EgitimSecenegi[] = egitimler.map((e) => ({
    id: e.id,
    ad: e.ad,
    kategori: e.kategori,
    yayinda: e.durum === "yayin",
  }));

  return (
    <main className="bg-wash min-h-screen">
      <Baslik
        ust="/egitimler"
        ustAd="Eğitimler"
        baslik="Eğitim paketleri"
        not={`${gruplar.length} paket`}
        rehberBolum="atama"
        sag={
          <Link href="/atama" className="btn-ghost text-sm">
            <Icon name="target" size={16} /> Atama kuralları
          </Link>
        }
      />

      <div className="sayfa-govde space-y-8">
        {/* Paketin NE İŞE YARADIĞI bir cümlede: hazırlayan bu ekranı ilk kez
            açtığında "grup da neyin nesi" diye sormamalı. */}
        <section className="card p-5">
          <h2 className="font-semibold">Paket, birlikte verilen eğitimlerin adıdır</h2>
          <p className="mt-1 text-sm text-muted">
            <strong className="text-ink">Oryantasyon = 5 eğitim.</strong> Atama kuralını tek tek eğitimlere değil{" "}
            <strong className="text-ink">pakete</strong> yazarsınız; pakete sonradan eklenen eğitim, kural yeniden
            yazılmadan aynı herkese gider. Beş kuralı elle güncellemek gerekmez — biri mutlaka unutulurdu.
          </p>

          <form action={grupOlusturEylem} className="mt-4 flex flex-wrap items-end gap-3">
            <label className="min-w-[12rem] flex-1">
              <span className="eyebrow mb-1.5 block">Yeni paket</span>
              <input name="ad" placeholder="Örn. Oryantasyon" className="input-base" required />
            </label>
            <label className="min-w-[12rem] flex-[2]">
              <span className="eyebrow mb-1.5 block">Açıklama</span>
              <input name="aciklama" placeholder="Ne zaman, kime verilir" className="input-base" />
            </label>
            <button className="btn-primary" type="submit">
              <Icon name="plus" size={18} /> Oluştur
            </button>
          </form>
        </section>

        <section>
          <h2 className="eyebrow mb-3">Paketler · {paketler.length}</h2>
          <Gruplar paketler={paketler} egitimler={secenekler} />
        </section>

        <p className="flex items-start gap-2 text-sm text-muted">
          <Icon name="help" size={16} className="mt-0.5" />
          <span>
            Paketin içindeki <strong className="text-ink">taslak</strong> eğitimler kioskta görünmez; yayına
            alındıklarında pakete atanmış herkese kendiliğinden düşerler. Paket silinince içindeki eğitimler değil,
            yalnız pakete yazılmış atama kuralları silinir.
          </span>
        </p>
      </div>
    </main>
  );
}
