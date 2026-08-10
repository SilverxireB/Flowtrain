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
      {/* DAR EKRANDA SARAR — telefondaki karmaşanın kök sebebi buydu.
          Şerit tek satırdı ve sağdaki eylem grubu `shrink-0` olduğu için
          daralabilen tek öğe logo kalıyordu: "TRAIN" yazısı ortadan kesiliyor,
          dahası şerit viewport'u aşınca SAYFANIN TAMAMI genişliyordu (390px
          telefonda düzen 485-520px'e çıkıp içerik dar bir şeride sıkışıyor,
          sağda kocaman boşluk kalıyordu). Tablolar zaten kendi kaplarında
          kayıyordu; ekranı bozan tablolar değil, başlığın taşmasıydı. */}
      <div className="sayfa-kap flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
        {ust ? (
          <Link href={ust} className="btn-icon" aria-label={ustAd ? `${ustAd} sayfasına dön` : "Geri"}>
            <Icon name="chevronLeft" size={20} />
          </Link>
        ) : null}

        <Link href="/" className="dokunma-44 shrink-0" aria-label="FlowTrain ana sayfa">
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

        {/* Sarınca sağa yaslı ikinci satır olur; tek satıra sığdığında hiçbir
            şey değişmez (`flex-wrap` yalnız yer kalmayınca kırar). */}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {sag}
          <RehberAc bolum={rehberBolum} />
        </div>
      </div>
    </header>
  );
}
