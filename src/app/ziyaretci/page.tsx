import Link from "next/link";
import Baslik from "@/components/Baslik";
import Icon from "@/components/Icon";
import KayitFormu from "./KayitFormu";
import ZiyaretciSatiri from "./ZiyaretciSatiri";
import Cikti from "./Cikti";
import { kapiGirisli } from "@/lib/kimlik";
import * as depo from "@/lib/depo";
import * as zdepo from "@/lib/ziyaretciDepo";
import { ayniGun, ilerleme } from "@/lib/ziyaretci";
import { simdi } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * ZİYARETÇİ KAYIT MASASI.
 *
 * Akış tek yönlü: kaydet → tablet ziyaretçiye geçer → bilgilendirmeler sırayla
 * akar → tamamlandı. Arada PIN, sınav, puan ve deneme hakkı YOK; ölçtüğümüz
 * şey başarı değil, bilgilendirmenin yapılmış olduğu.
 */
export default async function Ziyaretciler() {
  kapiGirisli("/ziyaretci");

  /* SAKLAMA TEMİZLİĞİ BURADA KOŞAR.
     Kapalı ağda zamanlanmış görev (cron) yok — kutu tek başına duruyor ve
     kimse ona bakmıyor. Ziyaretçi listesi günde onlarca kez açılıyor;
     temizliği buraya bağlamak, ayrı bir hizmet istemeden süreyi gerçekten
     işletmenin en ucuz yolu. Ayar kapalıysa hiçbir şey yapmaz, silinecek
     kayıt yoksa denetim izine de bir şey yazmaz. */
  zdepo.eskileriTemizle();

  const sorular = zdepo.sorulariGetir();
  const yayindakiler = depo.yayindakiEgitimler();
  const varsayilanlar = zdepo.varsayilanEgitimler();
  const bugun = simdi();

  const kayitlar = zdepo.ziyaretcileriGetir(2).map((z) => ({
    ziyaretci: z,
    ilerleme: ilerleme(z.egitimIdleri, zdepo.bitenEgitimIdleri(z.id)),
    egitimAdlari: z.egitimIdleri.map((id) => depo.egitimGetir(id)?.ad ?? "(silinmiş)"),
  }));

  const bugunkuler = kayitlar.filter((k) => ayniGun(k.ziyaretci.kayitZamani, bugun));
  const acik = bugunkuler.filter((k) => k.ilerleme.durum !== "tamam");
  const bitenler = bugunkuler.filter((k) => k.ilerleme.durum === "tamam");
  const dun = kayitlar.filter((k) => !ayniGun(k.ziyaretci.kayitZamani, bugun));

  const kurulumEksik = varsayilanlar.length === 0;

  return (
    <main className="bg-wash min-h-screen">
      <Baslik
        ust="/"
        ustAd="Ana sayfa"
        baslik="Ziyaretçiler"
        not={`bugün ${bugunkuler.length} kayıt · ${acik.length} bekliyor`}
      />

      <div className="sayfa-govde space-y-8">
        {kurulumEksik ? (
          <p className="card border-orta/40 bg-orta/5 p-5 text-sm">
            <strong>Varsayılan bilgilendirme seçilmemiş.</strong> Her ziyaretçiye otomatik verilecek bilgilendirmeyi{" "}
            <Link href="/ziyaretci/sorular" className="font-semibold text-accent underline">
              Kayıt soruları
            </Link>{" "}
            sayfasından seçin. Seçilene kadar kayıt açılamaz.
          </p>
        ) : null}

        <section className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Yeni ziyaretçi</h2>
              <p className="mt-1 text-sm text-muted">
                Kaydı açtığınızda tablet ekranı doğrudan açılır — cihazı ziyaretçiye verin.
              </p>
            </div>
            <Link href="/ziyaretci/sorular" className="btn-ghost text-sm">
              <Icon name="settings" size={16} /> Kayıt soruları
            </Link>
          </div>

          <KayitFormu
            sorular={sorular}
            egitimler={yayindakiler.map((e) => ({ id: e.id, ad: e.ad }))}
            varsayilanlar={varsayilanlar}
            kapali={kurulumEksik}
          />
        </section>

        <Cikti />

        <section>
          <h2 className="eyebrow mb-3">Bugün bekleyenler · {acik.length}</h2>
          {acik.length === 0 ? (
            <p className="card p-8 text-center text-muted">
              Bekleyen ziyaretçi yok. {bitenler.length > 0 ? "Bugünkü ziyaretçilerin hepsi tamamladı." : ""}
            </p>
          ) : (
            <ul className="space-y-3">
              {acik.map((k) => (
                <ZiyaretciSatiri key={k.ziyaretci.id} {...k} />
              ))}
            </ul>
          )}
        </section>

        {bitenler.length > 0 ? (
          <section>
            <h2 className="eyebrow mb-3">Bugün tamamlananlar · {bitenler.length}</h2>
            <ul className="space-y-3">
              {bitenler.map((k) => (
                <ZiyaretciSatiri key={k.ziyaretci.id} {...k} />
              ))}
            </ul>
          </section>
        ) : null}

        {dun.length > 0 ? (
          <section>
            <h2 className="eyebrow mb-3">Dün · {dun.length}</h2>
            <ul className="space-y-3">
              {dun.map((k) => (
                <ZiyaretciSatiri key={k.ziyaretci.id} {...k} />
              ))}
            </ul>
          </section>
        ) : null}

        <p className="flex items-start gap-2 text-sm text-muted">
          <Icon name="shield" size={16} className="mt-0.5 shrink-0" />
          <span>
            Ziyaretçi kaydı personel listesine <strong className="text-ink">karışmaz</strong>: sicil açılmaz, atama kuralı
            işlemez, panodaki tamamlanma oranını değiştirmez. Bilgilendirme tamamlanana kadar ziyaretçi bu listede kalır ve
            tablet tekrar tekrar açılabilir.
          </span>
        </p>
      </div>
    </main>
  );
}
