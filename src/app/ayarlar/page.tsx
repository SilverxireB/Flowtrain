import { existsSync, statSync } from "node:fs";
import Baslik from "@/components/Baslik";
import Icon from "@/components/Icon";
import HesapYonetimi from "./HesapYonetimi";
import AdaptorAyari from "./AdaptorAyari";
import Dugmeler from "./Dugmeler";
import Pinler from "./Pinler";
import TemelAdres from "./TemelAdres";
import { kapi } from "@/lib/kimlik";
import * as depo from "@/lib/depo";
import { VERI_KLASORU } from "@/lib/db";
import { adaptorDurumu, kayitHedefi, opmHataMetni, opmYapilandirmaOku, personelKaynagi } from "@/lib/adaptorlar";
import { personelDosyaYolu } from "@/lib/adaptorlar/csvPersonel";
import { kayitDosyaYolu } from "@/lib/adaptorlar/dosyaKayit";
import type { Kisi } from "@/lib/tipler";

export const dynamic = "force-dynamic";

export default async function Ayarlar() {
  const ben = kapi("yonetici", "/ayarlar");

  const durum = adaptorDurumu();
  const opm = opmYapilandirmaOku();

  // OPM kaynağı yapılandırma eksikse ya da hiç okunamamışsa HATA FIRLATIR
  // (boş liste dönmek "fabrikada kimse yok" demek olurdu). Ayarlar sayfası
  // bundan KİLİTLENMEMELİ: düzeltmenin yapılacağı yer tam olarak burası.
  let kisiler: Kisi[] = [];
  let kaynakHatasi: string | null = null;
  try {
    kisiler = await personelKaynagi().listele();
  } catch (h) {
    kaynakHatasi = opmHataMetni(h);
  }

  const personelYolu = personelDosyaYolu();
  const kayitYolu = kayitDosyaYolu();
  const bekleyen = depo.bekleyenSenkronlar().length;
  const amirliOran = kisiler.length ? Math.round((kisiler.filter((k) => k.amirSicil).length / kisiler.length) * 100) : 0;
  /* İŞE GİRİŞ DOLULUK — sahtecilik kapısının SESSİZ düşüşünü görünür kılar.
     İlk PIN kurulurken kişiden işe giriş tarihi isteniyor; kimliği doğrulayan
     tek şey bu (`kiosk/eylemler.ts`). Ama kontrol KOŞULLU: tarih yoksa kapı
     hiç kurulmuyor ve kioskta duran biri iş arkadaşının siciline PIN
     belirleyebiliyor. Personel dosyasında sütun yoksa bu hiçbir yerde
     görünmüyordu — oran burada yazıyor. */
  const iseGirisliOran = kisiler.length
    ? Math.round((kisiler.filter((k) => k.iseGiris).length / kisiler.length) * 100)
    : 0;

  return (
    <main className="bg-wash min-h-screen">
      <Baslik ust="/" ustAd="Ana sayfa" baslik="Ayarlar" rehberBolum="kurulum" />

      <div className="sayfa-govde space-y-8">
        {/* ── kurulumun gerçeği ──
            Bu satırlar DÜZENLENEMEZ ve diske yazılmaz; çalışma anında okunur.
            Amaç: "yedek nerede, sürüm ne, dosya duruyor mu" sorularının cevabı
            kurulumu yapan kişiden değil, ekrandan alınsın. */}
        <section>
          <h2 className="eyebrow mb-3">Kurulumun gerçeği</h2>
          <div className="card divide-y divide-line">
            <Satir
              etiket="Veri klasörü (yedek yeri)"
              deger={VERI_KLASORU}
              mono
              /* WAL: SQLite yazımları bir süre `-wal` dosyasında bekler.
                 Sunucu çalışırken yalnız `.db` kopyalanırsa son kayıtlar
                 yedekte OLMAZ ve bunu kimse fark etmez. */
              not="Yedek alırken klasörün TAMAMINI kopyalayın (-wal ve -shm dosyaları dahil); en güvenlisi servisi kısa süre durdurmaktır."
            />
            <Satir
              etiket="Personel kaynağı"
              deger={personelKaynagi().ad}
              not={kaynakHatasi ?? undefined}
              uyari={!!kaynakHatasi}
            />
            {durum.personelSecim === "csv" ? (
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
            ) : (
              <Satir
                etiket="OPM personel ucu"
                deger={opm.temelAdres ? opm.temelAdres + opm.personelYolu : "Adres girilmemiş"}
                mono
                not={`${kisiler.length} kişi okundu · önbellek ${opm.onbellekDk} dk`}
                uyari={!opm.temelAdres}
              />
            )}
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
            <Satir
              etiket="İşe giriş tarihi doluluk"
              deger={`%${iseGirisliOran}`}
              not={
                iseGirisliOran < 100
                  ? "Tarihi olmayan kişilerde ilk PIN kurulurken kimlik sorusu SORULMAZ — başkasının sicilini girip onun adına PIN belirlemek kolaylaşır."
                  : "İlk PIN'de kimlik sorusu herkes için çalışıyor."
              }
              uyari={iseGirisliOran < 100}
            />
            <Satir etiket="Kayıt hedefi" deger={kayitHedefi().ad} />
            <Satir
              etiket={durum.kayitSecim === "dosya" ? "Kayıt dosyası" : "Kayıt dosyası (yerel kopya)"}
              deger={kayitYolu}
              mono
              not={bekleyen > 0 ? `${bekleyen} kayıt gönderilemedi, bekliyor` : "Tüm kayıtlar gönderildi"}
              uyari={bekleyen > 0}
            />
          </div>

          <Dugmeler bekleyen={bekleyen} />
          <TemelAdres mevcut={depo.ayarOku("temelAdres")} kurumAdi={depo.ayarOku("kurumAdi")} />
        </section>

        <section>
          <h2 className="eyebrow mb-3">Personel kaynağı ve kayıt hedefi</h2>
          <AdaptorAyari
            personelSecim={durum.personelSecim}
            kayitSecim={durum.kayitSecim}
            temelAdres={opm.temelAdres}
            kimlikBasligi={opm.kimlikBasligi}
            /* Anahtarın KENDİSİ ekrana hiç inmez — yalnız varlığı. */
            anahtarVar={opm.kimlikAnahtari !== ""}
            personelYolu={opm.personelYolu}
            kayitYolu={opm.kayitYolu}
            zamanAsimiMs={String(opm.zamanAsimiMs)}
            onbellekDk={String(opm.onbellekDk)}
            personelEksikleri={durum.personelEksikleri}
            kayitEksikleri={durum.kayitEksikleri}
            sonBasariliOkuma={durum.opmPersonel?.sonBasariliOkuma ?? null}
            sonOkumaHatasi={durum.opmPersonel?.sonHata?.mesaj ?? null}
            sonGonderimHatasi={durum.sonGonderimHatasi?.mesaj ?? null}
          />
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
          <h2 className="eyebrow mb-3">PIN kayıtları</h2>
          <Pinler
            kayitlar={depo.pinDurumlari()}
            adlar={Object.fromEntries(kisiler.map((k) => [k.sicil, k.ad]))}
          />
          <p className="mt-3 text-xs text-muted">
            PIN kişinin imzasıdır. {depo.PIN_DENEME_SINIRI} hatalı denemeden sonra {depo.PIN_KILIT_DK} dakika kilitlenir.
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
      {not ? <p className={`mt-1 text-xs ${uyari ? "font-semibold text-orta-dark" : "text-muted"}`}>{not}</p> : null}
    </div>
  );
}
