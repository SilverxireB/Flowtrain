import "server-only";
import { personelKaynagi } from "./adaptorlar";
import * as depo from "./depo";
import { bugun } from "./db";
import { acikMi, atamaDurumu, atamalariCikar, oturumlariKovala, type Atama } from "./kurallar";
import type { Egitim, Kisi } from "./tipler";

/**
 * Kural motorunu gerçek veriye bağlayan ince katman.
 *
 * Motorun kendisi SAF ve sınavlıdır (`kurallar.ts`); burada yalnız "kimler,
 * hangi kurallar, hangi oturumlar" toplanır. Bu ayrım bilinçli: iş mantığını
 * veritabanına yapıştırırsak sınav yazmak için veritabanı kurmak gerekir.
 */

export interface AtamaSatiri extends Atama {
  egitim: Egitim;
  kisi: Kisi;
}

async function malzeme() {
  const kisiler = await personelKaynagi().listele();
  // Paket kuralları burada üyelerine açılmış gelir; motor yalnız eğitim bilir.
  const kurallar = depo.kurallariCozulmus().filter((k) => k.aktif);
  /* SAHADAKİ hâlleriyle: künye (geçme notu, deneme hakkı, TEKRAR SÜRESİ)
     yayınlanan sürümden gelir. Taslaktan okunsaydı, hazırlayan tekrar
     süresini 12 aydan 6 aya çektiği anda — daha hiçbir şey yayınlanmadan —
     yüzlerce kişi "süresi doldu" görünürdü.

     YAYINDA OLMAYAN eğitim listede hiç yok, dolayısıyla kimseye atanmaz:
     taslak bir eğitim kiosk'ta görünseydi, hazırlayan yarım bıraktığı içeriği
     hatta yayınlamış olurdu. */
  const egitimler = new Map(depo.sahadakiEgitimler().map((e) => [e.id, e]));
  const yayindakiKurallar = kurallar.filter((k) => egitimler.has(k.egitimId));
  return { kisiler, kurallar: yayindakiKurallar, egitimler };
}

/** Bir kişinin atamaları (kiosk ve amir tableti bunu kullanır). */
export async function kisiyeAtananlar(sicil: string): Promise<AtamaSatiri[]> {
  const { kisiler, kurallar, egitimler } = await malzeme();
  const kisi = kisiler.find((k) => k.sicil === sicil);
  if (!kisi) return [];

  const oturumlar = depo.oturumlariGetir({ sicil });
  const gun = bugun();

  return atamalariCikar([kisi], kurallar)
    .map((a) => {
      const egitim = egitimler.get(a.egitimId)!;
      return { ...atamaDurumu(a, oturumlar, egitim, gun), egitim, kisi };
    })
    .sort((a, b) => (a.sonTarih ?? "9999") .localeCompare(b.sonTarih ?? "9999"));
}

/** Kiosk'ta gösterilecekler: yalnız AÇIK olanlar (tamamı zaten tamam olan gizlenir). */
export async function kisininBekleyenleri(sicil: string): Promise<AtamaSatiri[]> {
  return (await kisiyeAtananlar(sicil)).filter((a) => acikMi(a.durum));
}

/** Bir amirin ekibi + her birinin atama durumu. */
export async function ekibinDurumu(amirSicil: string): Promise<AtamaSatiri[]> {
  const { kurallar, egitimler } = await malzeme();
  const ekip = await personelKaynagi().ekip(amirSicil);
  if (ekip.length === 0) return [];

  const gun = bugun();
  // Defter BİR KEZ kovalanıyor; atama başına baştan süzmek 8586 × 20 000
  // karşılaştırma demekti (ölçüldü: 5,07 sn → 18 ms).
  const kovalar = oturumlariKovala(depo.oturumlariGetir());
  const kisiKarti = new Map(ekip.map((k) => [k.sicil, k]));

  return atamalariCikar(ekip, kurallar)
    .map((a) => {
      const egitim = egitimler.get(a.egitimId)!;
      return { ...atamaDurumu(a, kovalar, egitim, gun), egitim, kisi: kisiKarti.get(a.sicil)! };
    })
    .sort((a, b) => (a.sonTarih ?? "9999").localeCompare(b.sonTarih ?? "9999"));
}

/** Tüm fabrika — pano bunu kullanır. */
export async function tumAtamalar(): Promise<AtamaSatiri[]> {
  const { kisiler, kurallar, egitimler } = await malzeme();
  const gun = bugun();
  // Panonun tamamı bu yoldan geçiyor; kovalama olmadan 1000 kişilik fabrikada
  // tek başına 5 saniyeden fazla sürüyordu.
  const kovalar = oturumlariKovala(depo.oturumlariGetir());
  const kisiKarti = new Map(kisiler.map((k) => [k.sicil, k]));

  return atamalariCikar(kisiler, kurallar).map((a) => {
    const egitim = egitimler.get(a.egitimId)!;
    return { ...atamaDurumu(a, kovalar, egitim, gun), egitim, kisi: kisiKarti.get(a.sicil)! };
  });
}
