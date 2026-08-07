import Link from "next/link";
import Baslik from "@/components/Baslik";
import Icon from "@/components/Icon";
import { kapi } from "@/lib/kimlik";
import * as depo from "@/lib/depo";
import { egitimOlusturEylem, sablondanAcEylem } from "@/app/eylemler";
import { SABLONLAR } from "@/lib/sablonlar";
import { personelKaynagi } from "@/lib/adaptorlar";
import { kapsamda } from "@/lib/kurallar";

export const dynamic = "force-dynamic";

export default async function Egitimler() {
  kapi("hazirlayan", "/egitimler");
  const egitimler = depo.egitimleriListele();
  const kisiler = await personelKaynagi().listele();

  return (
    <main className="bg-wash min-h-screen">
      <Baslik ust="/" ustAd="Ana sayfa" baslik="Eğitimler" not={`${egitimler.length} eğitim`} rehberBolum="hazirlama" />

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
          <ul className="mt-6 space-y-3">
            {egitimler.map((e) => {
              const sayfa = depo.sayfalariGetir(e.id).length;
              const soru = depo.sorulariGetir(e.id).length;
              const kurallar = depo.kurallariGetir(e.id).filter((k) => k.aktif);
              /* KURAL sayısı değil KİŞİ sayısı: "3 kural" hiçbir şey söylemez,
                 "128 kişiye atandı" bir eğitimin ağırlığını anlatır. */
              const kisiSayisi = kurallar.length
                ? kisiler.filter((kisi) => kurallar.some((k) => kapsamda(kisi, k))).length
                : 0;
              return (
                <li key={e.id}>
                  <Link href={`/egitimler/${e.id}`} className="card flex items-center gap-4 p-5 transition hover:border-accent">
                    <span
                      className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${
                        e.durum === "yayin" ? "bg-iyi/10 text-iyi-dark" : "bg-line text-muted"
                      }`}
                    >
                      <Icon name={e.durum === "yayin" ? "check" : "pencil"} size={20} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{e.ad}</span>
                      <span className="mt-0.5 block text-sm text-muted">
                        {e.durum === "yayin" ? `Yayında · sürüm ${e.surum}` : "Taslak"} · {sayfa} sayfa · {soru} soru
                        {kurallar.length > 0 ? ` · ${kisiSayisi} kişiye atandı` : " · atanmamış"}
                      </span>
                    </span>
                    <Icon name="chevronRight" size={18} className="text-muted" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
