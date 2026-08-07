import Link from "next/link";
import Logo from "./Logo";
import Icon from "./Icon";
import RehberAc from "./rehber/RehberAc";

/**
 * Sayfa başlığı.
 *
 * GERİ TUŞU HEDEFİ (suite kuralı): `←` sayfanın GELDİĞİ yere döner, hub'a
 * değil. Ölçüt basit — sayfaya nereden giriliyorsa üstü orasıdır. Editör
 * listeden açılır → listeye döner; liste hub'dan açılır → hub'a döner.
 */
export default function Baslik({
  ust,
  ustAd,
  baslik,
  not,
  sag,
  rehberBolum,
}: {
  ust?: string;
  ustAd?: string;
  baslik?: string;
  not?: string;
  sag?: React.ReactNode;
  /** Rehber çekmecesi bu başlıkta açılsın (derin link). */
  rehberBolum?: string;
}) {
  return (
    <header className="border-b border-line bg-white/70 backdrop-blur sticky top-0 z-30">
      {/* Şerit gövdeyle AYNI kapta: farklı genişlikteyken başlık ile içerik
          birbirini tutmuyor, sayfa değiştikçe her şey kayıyordu. */}
      <div className="sayfa-kap flex items-center gap-3 py-3">
        {ust ? (
          <Link href={ust} className="btn-icon" aria-label={ustAd ? `${ustAd} sayfasına dön` : "Geri"}>
            <Icon name="chevronLeft" size={20} />
          </Link>
        ) : null}

        <Link href="/" aria-label="FlowTrain ana sayfa">
          <Logo size="sm" />
        </Link>

        {baslik ? (
          <div className="min-w-0 flex-1 border-l border-line pl-3">
            <p className="truncate font-semibold leading-tight">{baslik}</p>
            {not ? <p className="truncate text-xs text-muted">{not}</p> : null}
          </div>
        ) : (
          <div className="flex-1" />
        )}

        <div className="flex shrink-0 items-center gap-2">
          {sag}
          <RehberAc bolum={rehberBolum} />
        </div>
      </div>
    </header>
  );
}
