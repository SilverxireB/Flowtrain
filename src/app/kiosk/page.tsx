import Kiosk from "./Kiosk";

export const dynamic = "force-dynamic";

export const metadata = { title: "FlowTrain — Kiosk" };

/**
 * KİOSK SAYFASI — kokpit kimliği ARANMAZ (kural: işçi hesap açmaz).
 * Kimlik doğrulanan cihazdır; kişi sicil + PIN ile atfedilir.
 */
export default function KioskSayfa() {
  return <Kiosk />;
}
