import { existsSync, statSync } from "node:fs";
import Baslik from "@/components/Baslik";
import Icon from "@/components/Icon";
import HesapYonetimi from "./HesapYonetimi";
import Dugmeler from "./Dugmeler";
import { kapi } from "@/lib/kimlik";
import * as depo from "@/lib/depo";
import { VERI_KLASORU } from "@/lib/db";
import { personelKaynagi, kayitHedefi } from "@/lib/adaptorlar";
import { personelDosyaYolu } from "@/lib/adaptorlar/csvPersonel";
import { kayitDosyaYolu } from "@/lib/adaptorlar/dosyaKayit";

export const dynamic = "force-dynamic";

export default async function Ayarlar() {
  const ben = kapi("yonetici", "/ayarlar");

  const kisiler = await personelKaynagi().listele();
  const personelYolu = personelDosyaYolu();
  const kayitYolu = kayitDosyaYolu();
  const bekleyen = depo.bekleyenSenkronlar().length;
  const amirliOran = kisiler.length ? Math.round((kisiler.filter((k) => k.amirSicil).length / kisiler.length) * 100) : 0;

  return (
    <main className="bg-wash min-h-screen">
      <Baslik ust="/" ustAd="Ana sayfa" baslik="Ayarlar" />

      <div className="mx-auto max-w-3xl space-y-8 px-5 py-8">
        {/* ── kurulumun gerçeği ──
            Bu satırlar DÜZENLENEMEZ ve diske yazılmaz; çalışma anında okunur.
            Amaç: "yedek nerede, sürüm ne, dosya duruyor mu" sorularının cevabı
            kurulumu yapan kişiden değil, ekrandan alınsın. */}
        <section>
          <h2 className="eyebrow mb-3">Kurulumun gerçeği</h2>
          <div className="card divide-y divide-line">
            <Satir etiket="Veri klasörü (yedek yeri)" deger={VERI_KLASORU} mono />
            <Satir etiket="Personel kaynağı" deger={personelKaynagi().ad} />
            <Satir
              etiket="Personel dosyası"
              deger={personelYolu}
              mono
              not={
                existsSync(personelYolu)
                  ? `${kisiler.length} kişi · son güncelleme ${new Date(statSync(personelYolu).mtimeMs)
                      .toISOString()
                      .slice(0, 16)
                      .replace("T", " ")}`
                  : "Dosya yok — bu yola bırakın"
              }
              uyari={!existsSync(personelYolu)}
            />
            <Satir
              etiket="Amir sütunu doluluk"
              deger={`%${amirliOran}`}
              not={
                amirliOran < 100
                  ? "Amir sicili boş olan kişiler hiçbir amirin ekibinde görünmez."
                  : "Tüm kişilerde amir sicili tanımlı."
              }
              uyari={amirliOran < 100}
            />
            <Satir etiket="Kayıt hedefi" deger={kayitHedefi().ad} />
            <Satir
              etiket="Kayıt dosyası"
              deger={kayitYolu}
              mono
              not={bekleyen > 0 ? `${bekleyen} kayıt gönderilemedi, bekliyor` : "Tüm kayıtlar gönderildi"}
              uyari={bekleyen > 0}
            />
          </div>

          <Dugmeler bekleyen={bekleyen} />
        </section>

        <section>
          <h2 className="eyebrow mb-3">Hesaplar</h2>
          <HesapYonetimi hesaplar={depo.hesaplariListele()} benKullanici={ben.kullanici} />
          <p className="mt-3 flex items-start gap-2 text-xs text-muted">
            <Icon name="help" size={14} className="mt-0.5 shrink-0" />
            <span>
              <strong>Amir</strong> hesabına sicil girin — ekip listesi personel dosyasındaki amir sütunundan o sicile
              göre çıkar. <strong>Onaylayan</strong> eğitimleri yayına alabilir; hazırlayan alamaz.
            </span>
          </p>
        </section>

        <section>
          <h2 className="eyebrow mb-3">Denetim izi</h2>
          <ul className="card divide-y divide-line text-sm">
            {depo.izleriGetir(40).map((i) => (
              <li key={i.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5">
                <span className="font-mono text-xs text-muted">{i.neZaman.slice(0, 16).replace("T", " ")}</span>
                <span className="font-semibold">{i.kim}</span>
                <span className="text-muted">{i.ne}</span>
              </li>
            ))}
            {depo.izleriGetir(1).length === 0 ? <li className="px-4 py-6 text-center text-muted">Kayıt yok.</li> : null}
          </ul>
        </section>
      </div>
    </main>
  );
}

function Satir({
  etiket,
  deger,
  not,
  mono,
  uyari,
}: {
  etiket: string;
  deger: string;
  not?: string;
  mono?: boolean;
  uyari?: boolean;
}) {
  return (
    <div className="px-4 py-3">
      <p className="text-sm font-semibold">{etiket}</p>
      <p className={`mt-0.5 break-all ${mono ? "font-mono text-xs" : "text-sm"} text-muted`}>{deger}</p>
      {not ? <p className={`mt-1 text-xs ${uyari ? "font-semibold text-orta" : "text-muted"}`}>{not}</p> : null}
    </div>
  );
}
