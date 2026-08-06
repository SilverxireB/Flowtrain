import Baslik from "@/components/Baslik";
import Icon from "@/components/Icon";
import { kapi } from "@/lib/kimlik";
import * as depo from "@/lib/depo";
import { tumAtamalar } from "@/lib/atamaServis";
import { acikMi, DURUM_ETIKET, type AtamaDurumu } from "@/lib/kurallar";
import { anomaliMetni, beklenenSure, gozetenOzetleri } from "@/lib/anomali";

export const dynamic = "force-dynamic";

export default async function Pano() {
  kapi("hazirlayan", "/pano");

  const satirlar = await tumAtamalar();
  const toplam = satirlar.length;
  const tamam = satirlar.filter((s) => !acikMi(s.durum)).length;
  const oran = toplam === 0 ? 0 : Math.round((tamam / toplam) * 100);

  const durumSayisi = satirlar.reduce<Record<string, number>>((a, s) => {
    a[s.durum] = (a[s.durum] ?? 0) + 1;
    return a;
  }, {});

  /* Bölüm kırılımı: "kim geride" sorusunun ilk cevabı. */
  const bolumler = new Map<string, { toplam: number; acik: number }>();
  for (const s of satirlar) {
    const ad = s.kisi?.bolum ?? "(bölümsüz)";
    const b = bolumler.get(ad) ?? { toplam: 0, acik: 0 };
    b.toplam++;
    if (acikMi(s.durum)) b.acik++;
    bolumler.set(ad, b);
  }

  /* ANOMALİ: eğitim başına beklenen süre farklı olduğu için gözeten özeti
     eğitim bazında çıkarılır — 30 saniyelik bir eğitimle 20 dakikalık bir
     eğitimi aynı beklentiyle ölçmek herkesi şüpheli gösterirdi. */
  const anomaliler = depo
    .egitimleriListele()
    .flatMap((e) => {
      const beklenen = beklenenSure(depo.sayfalariGetir(e.id));
      if (beklenen <= 0) return [];
      return gozetenOzetleri(depo.oturumlariGetir({ egitimId: e.id }), beklenen)
        .filter((o) => o.supheli)
        .map((o) => ({ egitimAdi: e.ad, ...o }));
    })
    .sort((a, b) => b.hizliSayisi - a.hizliSayisi);

  const bekleyenSenkron = depo.bekleyenSenkronlar().length;

  return (
    <main className="bg-wash min-h-screen">
      <Baslik
        ust="/"
        ustAd="Ana sayfa"
        baslik="Pano"
        not={`${toplam} atama`}
        sag={
          <a href="/api/disa-aktar" className="btn-ghost text-sm" download>
            <Icon name="download" size={16} /> CSV
          </a>
        }
      />

      <div className="mx-auto max-w-4xl space-y-8 px-5 py-8">
        <section className="card p-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Tamamlanma</p>
              <p className="mt-1 text-5xl font-extrabold">{oran}%</p>
            </div>
            <p className="text-right text-sm text-muted">
              {tamam} / {toplam} atama tamam
            </p>
          </div>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-line">
            <div
              className={`h-full rounded-full transition-all ${oran >= 70 ? "bg-iyi" : oran >= 40 ? "bg-orta" : "bg-brand"}`}
              style={{ width: `${oran}%` }}
            />
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {(Object.keys(DURUM_ETIKET) as AtamaDurumu[]).map((d) =>
              durumSayisi[d] ? (
                <span key={d} className="chip text-xs">
                  {DURUM_ETIKET[d]}: <strong>{durumSayisi[d]}</strong>
                </span>
              ) : null,
            )}
          </div>
        </section>

        {bekleyenSenkron > 0 ? (
          <p className="card border-orta/40 bg-orta/5 p-5 text-sm">
            <strong>{bekleyenSenkron} tamamlama kaydı</strong> dış hedefe gönderilemedi ve bekliyor. Kayıtlar yerelde
            duruyor, kaybolmadı — Ayarlar sayfasından yeniden gönderebilirsiniz.
          </p>
        ) : null}

        <section>
          <h2 className="eyebrow mb-3">Bölümler</h2>
          {bolumler.size === 0 ? (
            <p className="card p-8 text-center text-muted">Henüz atama yok.</p>
          ) : (
            <ul className="space-y-2">
              {[...bolumler.entries()]
                .sort((a, b) => b[1].acik - a[1].acik)
                .map(([ad, b]) => {
                  const yuzde = Math.round(((b.toplam - b.acik) / b.toplam) * 100);
                  return (
                    <li key={ad} className="card flex items-center gap-4 p-4">
                      <span className="min-w-0 flex-1 truncate font-semibold">{ad}</span>
                      <span className="h-2 w-32 shrink-0 overflow-hidden rounded-full bg-line">
                        <span
                          className={`block h-full rounded-full ${yuzde >= 70 ? "bg-iyi" : yuzde >= 40 ? "bg-orta" : "bg-brand"}`}
                          style={{ width: `${yuzde}%` }}
                        />
                      </span>
                      <span className="w-24 shrink-0 text-right text-sm text-muted">
                        {b.acik > 0 ? `${b.acik} eksik` : "tamam"}
                      </span>
                    </li>
                  );
                })}
            </ul>
          )}
        </section>

        <section>
          <h2 className="eyebrow mb-3">Gözetimli oturum deseni</h2>
          {anomaliler.length === 0 ? (
            <p className="card p-6 text-sm text-muted">
              Olağandışı bir desen görünmüyor. Bu satır, gözetiminde yapılan oturumların beklenenden çok daha hızlı
              bitmesi durumunda dolar.
            </p>
          ) : (
            <ul className="space-y-2">
              {anomaliler.map((a, i) => (
                <li key={i} className="card border-orta/40 bg-orta/5 p-4">
                  <p className="font-semibold">
                    {a.gozeten} · <span className="font-normal">{a.egitimAdi}</span>
                  </p>
                  <p className="mt-1 text-sm text-orta">{anomaliMetni(a)}</p>
                </li>
              ))}
            </ul>
          )}
          {/* Ürün SUÇLAMAZ, engellemez de — yalnız görünür kılar. Hızlı
              bitirmenin masum açıklamaları var; karar insanındır. */}
          <p className="mt-3 text-xs text-muted">
            Bu bir suçlama değil, bir sorudur. Hızlı bitirmenin masum açıklamaları olabilir; kayıt engellenmez.
          </p>
        </section>
      </div>
    </main>
  );
}
