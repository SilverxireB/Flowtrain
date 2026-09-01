"use client";

/**
 * FlowSpinner — markalı yükleme animasyonu.
 *
 * FlowUI'dan KOPYALANDI, bağlanmadı (CLAUDE.md 6). Dört kişilik kadrodan
 * her montajda rastgele biri sahne alır: `hop` (zıplama), `spark`
 * (kıvılcım), `bars` (renk çubukları), `dots` (düşünüyor). `variant`
 * verilirse sabitlenir.
 *
 * RASTGELELİK NEDEN: bekleme ürünün en çok görülen anlarından biri ve hep
 * aynı hareketi izlemek bekleyişi uzatıyor. Dördü de aynı süreyi anlatır,
 * sadece can sıkmaz.
 *
 * SEÇİM MONTAJDAN SONRA YAPILIR. Next.js sayfayı sunucuda da çiziyor;
 * `Math.random()` doğrudan çizimde çağrılsaydı sunucu bir varyantı,
 * tarayıcı başkasını seçer ve React uyumsuzluk hatası verirdi. İlk kare
 * `hop` çizilir, hemen ardından kadro belirlenir — yaylar ikisinde de aynı
 * olduğu için geçiş görünmez.
 */

import { useEffect, useState } from "react";
import stil from "./FlowSpinner.module.css";

const KADRO = ["hop", "spark", "bars", "dots"] as const;
type Varyant = (typeof KADRO)[number];

const SINIF: Record<Varyant, string> = {
  hop: "vHop",
  spark: "vSpark",
  bars: "vBars",
  dots: "vDots",
};

export default function FlowSpinner({
  boyut = "md",
  etiket = "",
  blok = false,
  varyant,
}: {
  boyut?: "xs" | "sm" | "md";
  /** Altına yazılacak açıklama ("Kayıtlar yükleniyor…"). */
  etiket?: string;
  /** Kart görünümlü, tam alan kaplayan kullanım (tablo/sayfa yüklemesi). */
  blok?: boolean;
  /** Kadrodan birini sabitler; verilmezse rastgele. */
  varyant?: Varyant;
}) {
  const [secili, setSecili] = useState<Varyant>(varyant ?? "hop");

  useEffect(() => {
    if (varyant) return setSecili(varyant);
    setSecili(KADRO[Math.floor(Math.random() * KADRO.length)]);
  }, [varyant]);

  return (
    <div
      className={`${stil.wrapper} ${stil[boyut]} ${blok ? stil.block : ""}`}
      role="status"
      aria-live="polite"
    >
      {/* Animasyonun tamamı SÜSTÜR: ekran okuyucu için anlamı yok, anlamı
          taşıyan şey `role="status"` ve etiket. */}
      <div className={`${stil.stage} ${stil[SINIF[secili]]}`} aria-hidden="true">
        <svg className={stil.logo} viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Kırmızı yay (sağ-alt dış) */}
          <path
            className={`${stil.arc} ${stil.arcRed}`}
            d="M26.2675 5.52009C26.0075 5.48759 25.7539 5.55259 25.5459 5.7151C25.1169 6.04013 25.0389 6.65768 25.3639 7.08022C27.3986 9.73893 28.3216 13.0607 27.9706 16.428C27.3271 22.4995 22.4582 27.3554 16.3802 27.9794C12.9934 28.324 9.65861 27.3814 6.99989 25.3142C6.79838 25.1517 6.54486 25.0802 6.28484 25.1127C6.02482 25.1452 5.7908 25.2752 5.63478 25.4832C5.47227 25.6912 5.40726 25.9448 5.43977 26.2048C5.47227 26.4648 5.60228 26.6923 5.8103 26.8548C8.46251 28.9155 11.6413 30.0076 15.0151 30.0076C15.5351 30.0076 16.0681 29.9816 16.5882 29.9296C23.5763 29.2145 29.1797 23.6241 29.9143 16.6425C30.3238 12.7747 29.2577 8.96537 26.9175 5.91012C26.7615 5.7021 26.534 5.57209 26.274 5.53309L26.2675 5.52009Z"
            fill="var(--flow-logo-red)"
          />
          {/* Mavi yay (üst-sol dış) */}
          <path
            className={`${stil.arc} ${stil.arcBlue}`}
            d="M1.9881 13.9834C2.47564 7.52191 7.72157 2.36049 14.1961 1.97696C17.3294 1.78844 20.4171 2.72452 22.8873 4.60968C23.0953 4.76569 23.3488 4.83719 23.6089 4.79819C23.8689 4.76569 24.0964 4.62918 24.2589 4.42116C24.584 3.99212 24.4994 3.38107 24.0704 3.05605C21.2232 0.89137 17.6674 -0.187718 14.0791 0.0267997C6.63598 0.468836 0.603489 6.41032 0.0444428 13.8339C-0.222079 17.3767 0.713997 20.77 2.74866 23.6497C2.93068 23.9098 3.22971 24.0593 3.54823 24.0593C3.74975 24.0593 3.94476 24.0008 4.11377 23.8773C4.54931 23.5652 4.65332 22.9542 4.34779 22.5186C2.57965 20.0159 1.76059 17.0647 1.9946 13.9769L1.9881 13.9834Z"
            fill="var(--flow-logo-blue)"
          />
          {/* Turuncu yay (sol iç) */}
          <path
            className={`${stil.arc} ${stil.arcOrange}`}
            d="M14.001 25.5936H14.105C14.612 25.5936 15.0281 25.2165 15.0736 24.716C15.0996 24.456 15.0216 24.2024 14.8525 24.0009C14.6835 23.7994 14.4495 23.6759 14.196 23.6499C10.4842 23.2924 7.42243 20.6141 6.57086 16.9804C5.8038 13.6976 7.0259 10.2393 9.67812 8.16563C10.1007 7.83411 10.1787 7.22306 9.84713 6.79402C9.5156 6.37149 8.89805 6.29348 8.47552 6.62501C5.22525 9.16671 3.73013 13.4051 4.66621 17.4159C5.70629 21.8688 9.4571 25.145 13.9945 25.5806L14.001 25.5936Z"
            fill="var(--flow-logo-orange)"
          />
          {/* Yeşil yay (sağ iç) */}
          <path
            className={`${stil.arc} ${stil.arcGreen}`}
            d="M20.0399 22.096C19.8254 22.2455 19.6889 22.4731 19.6434 22.7266C19.5979 22.9866 19.6564 23.2401 19.8059 23.4546C19.9879 23.7147 20.287 23.8642 20.599 23.8642C20.8005 23.8642 20.9955 23.7992 21.1645 23.6822C24.7008 21.173 26.352 16.8176 25.3639 12.5923C24.2393 7.78836 20.0139 4.40808 15.0865 4.38208C14.5535 4.38208 14.118 4.81762 14.1115 5.35066C14.1115 5.61068 14.209 5.8577 14.391 6.03972C14.573 6.22823 14.82 6.32574 15.08 6.33224C19.1039 6.35824 22.5491 9.11447 23.4657 13.0408C24.2718 16.4926 22.9262 20.0484 20.0334 22.096H20.0399Z"
            fill="var(--flow-logo-green)"
          />
        </svg>

        {secili === "spark" && (
          <>
            <div className={`${stil.orbit} ${stil.orbitOuter}`}>
              <span className={stil.spark} />
            </div>
            <div className={`${stil.orbit} ${stil.orbitInner}`}>
              <span className={stil.spark} />
            </div>
          </>
        )}

        {secili === "bars" && (
          <div className={stil.bars}>
            <i />
            <i />
            <i />
            <i />
          </div>
        )}

        {secili === "dots" && (
          <div className={stil.dots}>
            <i />
            <i />
            <i />
          </div>
        )}
      </div>

      {etiket ? <p className={stil.label}>{etiket}</p> : null}
    </div>
  );
}
