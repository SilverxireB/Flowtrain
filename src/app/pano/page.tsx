import Link from "next/link";
import Baslik from "@/components/Baslik";
import Icon from "@/components/Icon";
import Disari from "./Disari";
import { kapi } from "@/lib/kimlik";
import * as depo from "@/lib/depo";
import { tumAtamalar } from "@/lib/atamaServis";
import { acikMi, DURUM_ETIKET, type AtamaDurumu } from "@/lib/kurallar";
import { anomaliMetni, beklenenSure, gozetenOzetleri } from "@/lib/anomali";
import { ayEtiketi, aylikTrend, kirilimCikar, type Kirilim } from "@/lib/rapor";
import { bugun } from "@/lib/db";

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

  /* Üç kırılım AYNI saf fonksiyondan çıkar (`rapor.ts`): bölüm "kim geride",
     kategori "ne türde geride", zorunlu ise denetimin bakacağı tek sayı. */
  const bolumler = kirilimCikar(satirlar.map((s) => ({ ad: s.kisi?.bolum || "(bölümsüz)", acik: acikMi(s.durum) })));
  /* Hiçbir eğitimde kategori yoksa kırılım tek satırlık "(kategorisiz)" olurdu:
     bilgi vermeyen ama dolu görünen bir bölüm. O durumda boş bırakılır. */
  const kategoriler = satirlar.some((s) => !!s.egitim.kategori)
    ? kirilimCikar(satirlar.map((s) => ({ ad: s.egitim.kategori || "(kategorisiz)", acik: acikMi(s.durum) })))
    : [];

  /* YASAL ZORUNLU eğitimler ayrı özetlenir. Genel oranın içinde eridiğinde
     "%80 tamam" görüntüsü, zorunlu eğitimlerin yarısının eksik olduğu bir
     fabrikayı da rahatlatıyordu. */
  const zorunluSatirlar = satirlar.filter((s) => s.egitim.zorunlu);
  const zorunluAcik = zorunluSatirlar.filter((s) => acikMi(s.durum)).length;
  const zorunlu = {
    toplam: zorunluSatirlar.length,
    acik: zorunluAcik,
    oran:
      zorunluSatirlar.length === 0
        ? 0
        : Math.round(((zorunluSatirlar.length - zorunluAcik) / zorunluSatirlar.length) * 100),
  };

  const tumOturumlar = depo.oturumlariGetir();
  const aylar = aylikTrend(tumOturumlar, bugun().slice(0, 7));
  const enYuksekAy = Math.max(1, ...aylar.map((a) => a.toplam));

  /* ANOMALİ: eğitim başına beklenen süre farklı olduğu için gözeten özeti
     eğitim bazında çıkarılır — 30 saniyelik bir eğitimle 20 dakikalık bir
     eğitimi aynı beklentiyle ölçmek herkesi şüpheli gösterirdi.

     SINIF VE AKTARIM KAYITLARI ÖLÇÜYE GİRMEZ: o kayıtlarda ekranda kart
     dönmediği için başlangıç ile bitiş aynı damgadır, süreleri sıfırdır. Ölçüye
     katılsalardı sınıf eğitimi veren her eğitmen ve içeri alınan her geçmiş
     kayıt "olağandışı hızlı" görünür, panel de anlamını yitirirdi. */
  const anomaliler = depo
    .egitimleriListele()
    .flatMap((e) => {
      const beklenen = beklenenSure(depo.sayfalariGetir(e.id));
      if (beklenen <= 0) return [];
      const olculenler = depo
        .oturumlariGetir({ egitimId: e.id })
        .filter((o) => o.kaynak === "kiosk" || o.kaynak === "amir");
      return gozetenOzetleri(olculenler, beklenen)
        .filter((o) => o.supheli)
        .map((o) => ({ egitimAdi: e.ad, ...o }));
    })
    .sort((a, b) => b.hizliSayisi - a.hizliSayisi);

  const bekleyenSenkron = depo.bekleyenSenkronlar().length;

  /* PDF özeti sunucuda hazırlanır: istemciye 400 satırlık ham liste yerine
     yalnız rapora girecek olan gider. */
  const pdfOzeti = {
    toplam,
    tamam,
    oran,
    durumlar: (Object.keys(DURUM_ETIKET) as AtamaDurumu[])
      .filter((d) => durumSayisi[d])
      .map((d) => ({ etiket: DURUM_ETIKET[d], sayi: durumSayisi[d] })),
    bolumler: bolumler.map((b) => ({ ad: b.ad, toplam: b.toplam, acik: b.acik })),
    kategoriler: kategoriler.map((k) => ({ ad: k.ad, toplam: k.toplam, acik: k.acik })),
    zorunlu,
    aylar: aylar.map((a) => ({ etiket: ayEtiketi(a.ay), gecti: a.gecti, kaldi: a.kaldi })),
    gecikenler: satirlar
      .filter((s) => s.durum === "gecikti" || s.durum === "suresiDoldu" || s.durum === "kaldi")
      .slice(0, 200)
      .map((s) => ({
        ad: s.kisi?.ad ?? "",
        sicil: s.sicil,
        egitim: s.egitim.ad,
        sonTarih: s.sonTarih ?? s.gecerlilikBitis ?? "",
      })),
  };

  return (
    <main className="bg-wash min-h-screen">
      <Baslik
        ust="/"
        ustAd="Ana sayfa"
        baslik="Pano"
        not={`${toplam} atama`}
        rehberBolum="takip"
        sag={
          <>
            {/* Pano ÖZET söyler, defter SATIR verir. Denetimde "peki bu kişi
                hangi gün tamamlamış" sorusu hep gelir; kapı burada dursun. */}
            <Link href="/kayitlar" className="btn-ghost text-sm">
              <Icon name="receipt" size={16} /> Kayıt defteri
            </Link>
            <Disari ozet={pdfOzeti} tarih={bugun()} />
          </>
        }
      />

      <div className="sayfa-govde space-y-8">
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

        {/* ZORUNLU EĞİTİMLER AYRI KART: genel oranın içinde eridiğinde
            "%80 tamam" görüntüsü, zorunlu eğitimlerin yarısı eksik olan bir
            fabrikayı da rahatlatıyordu. Denetimin baktığı sayı budur. */}
        {zorunlu.toplam > 0 ? (
          <section className="card p-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="eyebrow">Yasal zorunlu eğitimler</p>
                <p className="mt-1 text-3xl font-extrabold">{zorunlu.oran}%</p>
              </div>
              <p className="text-right text-sm text-muted">
                {zorunlu.acik > 0 ? (
                  <strong className="text-brand-dark">{zorunlu.acik} eksik</strong>
                ) : (
                  <strong className="text-iyi-dark">eksik yok</strong>
                )}{" "}
                / {zorunlu.toplam} atama
              </p>
            </div>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-line">
              <div
                className={`h-full rounded-full ${zorunlu.oran >= 95 ? "bg-iyi" : zorunlu.oran >= 70 ? "bg-orta" : "bg-brand"}`}
                style={{ width: `${zorunlu.oran}%` }}
              />
            </div>
            <p className="mt-3 text-xs text-muted">
              Katalogda &quot;yasal zorunlu&quot; işaretli eğitimler. Denetimde sorulan oran bu orandır.
            </p>
          </section>
        ) : null}

        <section>
          <h2 className="eyebrow mb-3">Bölümler</h2>
          <KirilimListesi satirlar={bolumler} bosMetin="Henüz atama yok." />
        </section>

        <section>
          <h2 className="eyebrow mb-3">Kategoriler</h2>
          <KirilimListesi satirlar={kategoriler} bosMetin="Eğitimlere kategori girilmemiş." />
        </section>

        {/* AYLIK SEYİR: tek bir tamamlanma yüzdesi "iyileşiyor mu, duruyor mu"
            sorusunu cevaplamıyordu. Boş aylar da çizilir — hiç eğitim
            verilmeyen ay grafikten düşseydi seyir kesintisiz görünürdü. */}
        <section>
          <h2 className="eyebrow mb-3">Aylık tamamlanma</h2>
          <div className="card p-5">
            <div className="flex h-40 items-end gap-1.5">
              {aylar.map((a) => (
                <div key={a.ay} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                  <span className="text-[10px] font-semibold text-muted">{a.toplam || ""}</span>
                  <span
                    className="flex w-full flex-col justify-end overflow-hidden rounded-t-md bg-line/60"
                    style={{ height: `${Math.round((a.toplam / enYuksekAy) * 100)}%`, minHeight: a.toplam ? 4 : 2 }}
                    title={`${ayEtiketi(a.ay)}: ${a.gecti} geçti, ${a.kaldi} kaldı`}
                  >
                    <span
                      className="block w-full bg-brand"
                      style={{ height: a.toplam ? `${Math.round((a.kaldi / a.toplam) * 100)}%` : "0%" }}
                    />
                    <span
                      className="block w-full bg-iyi"
                      style={{ height: a.toplam ? `${Math.round((a.gecti / a.toplam) * 100)}%` : "0%" }}
                    />
                  </span>
                  <span className="w-full truncate text-center text-[10px] text-muted">{ayEtiketi(a.ay)}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted">
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-iyi" /> geçti
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-brand" /> kaldı
              </span>
              <span className="ml-auto">Son 12 ay · kapanmış oturumlar</span>
            </p>
          </div>
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
                  <p className="mt-1 text-sm text-orta-dark">{anomaliMetni(a)}</p>
                </li>
              ))}
            </ul>
          )}
          {/* Ürün SUÇLAMAZ, engellemez de — yalnız görünür kılar. Hızlı
              bitirmenin masum açıklamaları var; karar insanındır. */}
          <p className="mt-3 text-xs text-muted">
            Bu bir suçlama değil, bir sorudur. Hızlı bitirmenin masum açıklamaları olabilir; kayıt engellenmez. Sınıf
            eğitimi ve dış aktarım kayıtları bu ölçüye girmez — o kayıtlarda ekranda kart dönmez, süre ölçülmez.
          </p>
        </section>
      </div>
    </main>
  );
}

/**
 * Kırılım listesi — bölüm ve kategori AYNI çizimi paylaşır.
 *
 * İkisi ayrı ayrı yazılsaydı biri güncellendiğinde diğeri geride kalır ve aynı
 * panoda iki farklı görsel dil olurdu.
 */
function KirilimListesi({ satirlar, bosMetin }: { satirlar: Kirilim[]; bosMetin: string }) {
  if (satirlar.length === 0) return <p className="card p-8 text-center text-muted">{bosMetin}</p>;
  return (
    <ul className="space-y-2">
      {satirlar.map((k) => (
        <li key={k.ad} className="card flex items-center gap-4 p-4">
          <span className="min-w-0 flex-1 truncate font-semibold">{k.ad}</span>
          <span className="h-2 w-32 shrink-0 overflow-hidden rounded-full bg-line">
            <span
              className={`block h-full rounded-full ${k.oran >= 70 ? "bg-iyi" : k.oran >= 40 ? "bg-orta" : "bg-brand"}`}
              style={{ width: `${k.oran}%` }}
            />
          </span>
          <span className="w-24 shrink-0 text-right text-sm text-muted">
            {k.acik > 0 ? `${k.acik} eksik` : "tamam"}
          </span>
        </li>
      ))}
    </ul>
  );
}
