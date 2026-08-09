import Link from "next/link";
import Baslik from "@/components/Baslik";
import Icon from "@/components/Icon";
import Katalog, { type KatalogSatiri } from "./Katalog";
import { kapi } from "@/lib/kimlik";
import * as depo from "@/lib/depo";
import { egitimOlusturEylem, sablondanAcEylem } from "@/app/eylemler";
import { SABLONLAR } from "@/lib/sablonlar";
import { tumAtamalar } from "@/lib/atamaServis";
import { egitimOzetleri } from "@/lib/katalog";

export const dynamic = "force-dynamic";

export default async function Egitimler() {
  kapi("hazirlayan", "/egitimler");

  const egitimler = depo.egitimleriListele();
  const kategoriler = depo.kategorileriGetir();
  const gruplar = depo.gruplariGetir();

  /* KURAL sayısı değil KİŞİ sayısı: "3 kural" hiçbir şey söylemez, "128 kişiye
     atandı" bir eğitimin ağırlığını anlatır. Sayı `tumAtamalar` üzerinden
     çıkar; orası paket kurallarını üyelerine açar ve taslak eğitimleri eler —
     yani ekrandaki sayı kioskta gerçekten görünecek olan sayıdır. */
  const atamalar = await tumAtamalar();
  const ozetler = egitimOzetleri(atamalar.map((a) => ({ sicil: a.sicil, egitimId: a.egitimId, durum: a.durum })));

  /* Kuralı olan ama taslakta duran eğitimi "atanmamış"tan ayırmak için: biri
     unutulmuş içerik, diğeri onay bekleyen içerik — ikisi aynı şey değil. */
  const kuralli = new Set(depo.kurallariCozulmus().filter((k) => k.aktif).map((k) => k.egitimId));

  const paketAdlari = new Map<string, string[]>();
  for (const g of gruplar) {
    for (const id of g.egitimIdleri) paketAdlari.set(id, [...(paketAdlari.get(id) ?? []), g.ad]);
  }

  const satirlar: KatalogSatiri[] = egitimler.map((e) => {
    const o = ozetler[e.id] ?? { kisi: 0, tamam: 0, oran: 0 };
    return {
      id: e.id,
      ad: e.ad,
      kategori: e.kategori,
      yayinda: e.durum === "yayin",
      surum: e.surum,
      zorunlu: e.zorunlu,
      sureDk: e.sureDk,
      sayfa: depo.sayfalariGetir(e.id).length,
      soru: depo.sorulariGetir(e.id).length,
      kisi: o.kisi,
      tamam: o.tamam,
      oran: o.oran,
      kuralVar: kuralli.has(e.id),
      paketler: paketAdlari.get(e.id) ?? [],
    };
  });

  const yayinda = satirlar.filter((s) => s.yayinda).length;

  return (
    <main className="bg-wash min-h-screen">
      <Baslik
        ust="/"
        ustAd="Ana sayfa"
        baslik="Eğitimler"
        not={`${egitimler.length} eğitim · ${yayinda} yayında`}
        rehberBolum="hazirlama"
        sag={
          <>
            <Link href="/gruplar" className="btn-ghost text-sm">
              <Icon name="folder" size={16} /> Paketler
            </Link>
            <Link href="/egitimler/qr" className="btn-ghost text-sm">
              <Icon name="qr" size={16} /> QR etiketleri
            </Link>
          </>
        }
      />

      <div className="sayfa-govde">
        <form action={egitimOlusturEylem} className="card flex flex-wrap items-end gap-3 p-5">
          <label className="min-w-0 flex-1">
            <span className="eyebrow mb-1.5 block">Yeni eğitim</span>
            <input name="ad" placeholder="Örn. Yüksekte Çalışma" className="input-base" required />
          </label>
          <button className="btn-primary" type="submit">
            <Icon name="plus" size={18} /> Oluştur
          </button>
        </form>

        {/* Yeni eğitim = boş sayfa DEĞİL. İki hızlı yol: elindeki PDF (editörde)
            ya da bir iskelet şablon. */}
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-semibold text-muted hover:text-ink">
            Ya da hazır bir iskeletten başlayın
          </summary>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {SABLONLAR.map((s) => (
              <form key={s.id} action={sablondanAcEylem.bind(null, s.id)}>
                <button className="card w-full p-4 text-left transition hover:border-accent" type="submit">
                  <span className="block font-semibold">{s.ad}</span>
                  <span className="mt-1 block text-xs text-muted">{s.not}</span>
                </button>
              </form>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">
            Şablonlar <strong>içerik değil kalıp</strong> taşır: kartlar ve sorular hazır gelir, metni siz yazarsınız.
          </p>
        </details>

        {egitimler.length === 0 ? (
          <div className="card mt-6 p-10 text-center">
            <p className="text-lg font-semibold">Henüz eğitim yok.</p>
            <p className="mt-2 text-muted">
              En hızlı yol: eğitimi oluşturup <strong className="text-ink">elinizdeki PDF&apos;i yükleyin</strong> —
              her sayfa bir karta dönüşür, altına birkaç soru eklersiniz.
            </p>
          </div>
        ) : (
          <div className="mt-6">
            <Katalog satirlar={satirlar} kategoriler={kategoriler} />
          </div>
        )}

        <p className="mt-4 flex items-start gap-2 text-sm text-muted">
          <Icon name="help" size={16} className="mt-0.5" />
          <span>
            <strong className="text-ink">Atanan</strong> sütunu kioskta gerçekten görünecek kişi sayısıdır: taslak bir
            eğitim kuralı olsa bile kimseye düşmez. Kategori alanı ve zorunluluk işareti eğitimin kendi sayfasından
            ayarlanır.
          </span>
        </p>
      </div>
    </main>
  );
}
