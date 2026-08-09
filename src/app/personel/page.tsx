import Baslik from "@/components/Baslik";
import Personel from "./Personel";
import { kapi } from "@/lib/kimlik";
import { opmHataMetni, personelKaynagi } from "@/lib/adaptorlar";
import * as depo from "@/lib/depo";
import type { PersonelKaydi } from "@/lib/adaptor";

export const dynamic = "force-dynamic";

export default async function PersonelSayfa() {
  kapi("yonetici", "/personel");

  // Adaptör sınırı: ekran CSV'yi DEĞİL, kaynağın yeteneklerini tanır.
  // `kayitlar` görüntülemenin, `yonetim` düzenlemenin yeteneğidir — ikisi
  // AYRI, çünkü salt okunur bir kaynakta liste yine de görünmeli.
  const kaynak = personelKaynagi();

  let kisiler: PersonelKaydi[] = [];
  let kaynakHatasi: string | null = null;
  try {
    kisiler = (await kaynak.kayitlar?.()) ?? [];
  } catch (h) {
    // OPM ulaşılamazsa liste boş DÖNMEZ, hata FIRLATIR ("bilmiyorum" ile
    // "kimse yok" aynı şey değil). Ekran bundan kilitlenmemeli: yöneticinin
    // yapılandırmayı görüp düzeltebilmesi gerekiyor.
    kaynakHatasi = opmHataMetni(h);
  }

  const eslemeler = depo.mmEslemeleriGetir();

  return (
    <main className="bg-wash min-h-screen">
      <Baslik ust="/" ustAd="Ana sayfa" baslik="Personel" not={`${kisiler.length} kayıt`} />
      <div className="sayfa-govde">
        {kaynakHatasi ? (
          <p
            role="alert"
            className="card mb-5 border-brand/30 bg-brand-soft p-4 text-sm font-semibold text-brand-dark"
          >
            Personel kaynağı okunamadı: {kaynakHatasi}
            <span className="mt-1 block font-normal">
              Liste boş görünüyor çünkü kaynağa ulaşılamadı — kayıtların silindiği anlamına GELMEZ. Ayarlar
              sayfasından kaynak yapılandırmasını denetleyin.
            </span>
          </p>
        ) : null}

        <Personel
          kisiler={kisiler}
          eslemeler={eslemeler}
          kaynakAdi={kaynak.ad}
          duzenlenebilir={!!kaynak.yonetim}
        />
      </div>
    </main>
  );
}
