import Link from "next/link";
import Tablet from "./Tablet";
import Logo from "@/components/Logo";
import Icon from "@/components/Icon";
import * as depo from "@/lib/depo";
import * as zdepo from "@/lib/ziyaretciDepo";
import { ilerleme } from "@/lib/ziyaretci";

export const dynamic = "force-dynamic";

/**
 * ZİYARETÇİ TABLETİ — HESAPSIZ YÜZEY.
 *
 * `kapi()` çağrılmaz ve bu bilinçli: tablet ziyaretçinin eline verilir, orada
 * açık bir kokpit oturumu olmamalı. Yetki kaynağı adresteki ziyaretçi
 * kimliğidir (rastgele üretilir) — kiosk'takiyle aynı model: doğrulanan CİHAZ,
 * kişi ATFEDİLİR.
 *
 * Ekranda kokpite giden hiçbir bağlantı YOKTUR. Tek çıkış, bilgilendirmeyi
 * bitirmek ya da tableti geri vermek.
 */
export default function ZiyaretciTablet({ params }: { params: { id: string } }) {
  const z = zdepo.ziyaretciGetir(params.id);

  if (!z) {
    return (
      <Bos
        baslik="Kayıt bulunamadı"
        metin="Bu ziyaretçi kaydı silinmiş ya da bağlantı yanlış. Tableti kayıt masasına geri verin."
      />
    );
  }

  const biten = zdepo.bitenEgitimIdleri(z.id);
  const durum = ilerleme(z.egitimIdleri, biten);

  /* İçerik SUNUCUDA hazırlanır: yayında olmayan ya da silinmiş bir eğitim
     tablete hiç inmez. */
  const adimlar = z.egitimIdleri
    .map((id) => {
      const egitim = depo.egitimGetir(id);
      if (!egitim || egitim.durum !== "yayin") return null;
      return { egitim, sayfalar: depo.sayfalariGetir(id), bitti: biten.includes(id) };
    })
    .filter((a): a is NonNullable<typeof a> => a !== null);

  if (adimlar.length === 0) {
    return (
      <Bos
        baslik="Bilgilendirme bulunamadı"
        metin="Verilecek bilgilendirmeler yayından kaldırılmış. Kayıt masasına haber verin."
      />
    );
  }

  return <Tablet ziyaretciId={z.id} ziyaretciAdi={z.ad} adimlar={adimlar} bastanTamam={durum.durum === "tamam"} />;
}

function Bos({ baslik, metin }: { baslik: string; metin: string }) {
  return (
    <main className="bg-wash grid min-h-screen place-items-center px-5 py-10">
      <div className="w-full max-w-xl text-center">
        <Logo size="lg" />
        <div className="card mt-8 p-8">
          <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-orta/10 text-orta-dark">
            <Icon name="warning" size={40} />
          </span>
          <h1 className="mt-5 text-2xl font-extrabold">{baslik}</h1>
          <p className="mt-2 text-muted">{metin}</p>
          <Link href="/ziyaretci" className="btn-ghost mt-6 text-sm">
            Kayıt masası
          </Link>
        </div>
      </div>
    </main>
  );
}
