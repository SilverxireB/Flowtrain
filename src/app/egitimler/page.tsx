import Link from "next/link";
import Baslik from "@/components/Baslik";
import Icon from "@/components/Icon";
import { kapi } from "@/lib/kimlik";
import * as depo from "@/lib/depo";
import { egitimOlusturEylem } from "@/app/eylemler";

export const dynamic = "force-dynamic";

export default function Egitimler() {
  kapi("hazirlayan", "/egitimler");
  const egitimler = depo.egitimleriListele();

  return (
    <main className="bg-wash min-h-screen">
      <Baslik ust="/" ustAd="Ana sayfa" baslik="Eğitimler" not={`${egitimler.length} eğitim`} />

      <div className="mx-auto max-w-5xl px-5 py-8">
        <form action={egitimOlusturEylem} className="card flex flex-wrap items-end gap-3 p-5">
          <label className="min-w-0 flex-1">
            <span className="eyebrow mb-1.5 block">Yeni eğitim</span>
            <input name="ad" placeholder="Örn. Yüksekte Çalışma" className="input-base" required />
          </label>
          <button className="btn-primary" type="submit">
            <Icon name="plus" size={18} /> Oluştur
          </button>
        </form>

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
              const kural = depo.kurallariGetir(e.id).filter((k) => k.aktif).length;
              return (
                <li key={e.id}>
                  <Link href={`/egitimler/${e.id}`} className="card flex items-center gap-4 p-5 transition hover:border-accent">
                    <span
                      className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${
                        e.durum === "yayin" ? "bg-iyi/10 text-iyi" : "bg-line text-muted"
                      }`}
                    >
                      <Icon name={e.durum === "yayin" ? "check" : "pencil"} size={20} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{e.ad}</span>
                      <span className="mt-0.5 block text-sm text-muted">
                        {e.durum === "yayin" ? `Yayında · sürüm ${e.surum}` : "Taslak"} · {sayfa} sayfa · {soru} soru
                        {kural > 0 ? ` · ${kural} atama kuralı` : " · atanmamış"}
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
