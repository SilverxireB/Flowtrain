"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Icon from "@/components/Icon";

// Rehber içeriği ilk açılışta indirilmesin: her kokpit sayfasında duran bir
// düğme için yüzlerce satır JSX taşımanın anlamı yok.
const Rehber = dynamic(() => import("./TrainRehber"), { ssr: false });

/**
 * "?" düğmesi — her kokpit sayfasının başlığında durur.
 *
 * NEDEN ÇEKMECE, NEDEN AYRI SAYFA DEĞİL: yardım aranan an, iş yapılan andır.
 * Ayrı sayfaya gitmek editörden çıkmak demektir; dönünce nerede kaldığını
 * yeniden bulman gerekir.
 */
export default function RehberAc({ bolum }: { bolum?: string }) {
  const [acik, setAcik] = useState(false);

  return (
    <>
      <button onClick={() => setAcik(true)} className="btn-icon" aria-label="Kullanım rehberi" title="Kullanım rehberi">
        <Icon name="help" size={20} />
      </button>
      {acik ? <Rehber bolum={bolum} onClose={() => setAcik(false)} /> : null}
    </>
  );
}
