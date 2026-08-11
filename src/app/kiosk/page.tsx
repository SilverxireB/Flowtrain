import Kiosk from "./Kiosk";
import * as depo from "@/lib/depo";
import { qrEgitimId } from "@/lib/kioskAkis";

export const dynamic = "force-dynamic";

export const metadata = { title: "FlowTrain — Kiosk" };

/**
 * KİOSK SAYFASI — kokpit kimliği ARANMAZ (kural: işçi hesap açmaz).
 * Kimlik doğrulanan cihazdır; kişi sicil + PIN ile atfedilir.
 *
 * QR SÖZLEŞMESİ (Hat B): asılı etiketin içeriği `/kiosk?egitim=<egitimId>`.
 * Eğitimin ADI burada, SUNUCUDA çözülür — istemciye kimlik verip "adını da
 * sen sor" demek, hesapsız bir uç noktadan eğitim katalogunu tek tek
 * gezdirmeye açık kapı bırakırdı. Yayında olmayan bir eğitim hiç geçmez;
 * kişi yine sicilini girip bekleyenlerini görebilir.
 */
export default function KioskSayfa({ searchParams }: { searchParams?: { egitim?: string | string[] } }) {
  const istenen = qrEgitimId(searchParams?.egitim);
  // Etikette görünen ad da YAYINLANMIŞ sürümden: taslakta yeniden adlandırılan
  // eğitim, kioskta oynatılacak olandan başka bir adla karşılamamalı.
  const egitim = istenen ? depo.sahadakiEgitim(istenen) : null;
  const hedef = egitim ? { id: egitim.id, ad: egitim.ad } : null;

  return <Kiosk hedef={hedef} hedefGecersiz={!!istenen && !hedef} />;
}
