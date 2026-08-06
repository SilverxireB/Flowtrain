"use client";

import { useState } from "react";

/**
 * FlowTrain logosu — Flow Studio'nun logo dilinde: başta O-halkası ikonu
 * (dört renkli yay + ürün glifi), devamında kısa ad. "FLOW" yazısı yalnız
 * çatı markada görünür; ürünler O + kısa ad taşır (O zaten Flow'u temsil eder).
 * FlowTrain'in glifi MEZUNİYET KEPİ (Meter bar-chart, Wall kamera, Sign totem,
 * Pulse EKG ile aynı ailede).
 *
 * Boyutlar `clamp` ile ekrana göre esner: logo `whitespace-nowrap` olduğu için
 * sabit puntoda dar telefonda sayfayı yatay kaydırıyordu. İkon yüksekliği em
 * cinsinden — yazıyla birlikte ölçeklenir, oranı bozulmaz.
 *
 * Varlıklar `scripts/logo-uret.mjs` ile üretilir.
 */
const SIZES = {
  sm: { fontSize: "clamp(15px, 4.6vw, 20px)" },
  md: { fontSize: "clamp(19px, 6.2vw, 27px)" },
  lg: { fontSize: "clamp(26px, 8.8vw, 38px)" },
} as const;

export default function Logo({
  size = "md",
  onDark = false,
}: {
  size?: "sm" | "md" | "lg";
  onDark?: boolean;
}) {
  const [imgOk, setImgOk] = useState(true);
  const { fontSize } = SIZES[size];

  return (
    // Ekran okuyucu markayı TEK kez tam adıyla duyar; parçalar gizli.
    // shrink-0: dar başlıkta flex logoyu ezerse yazı taşar ve yanındaki
    // başlıkla üst üste biner.
    <span
      className="inline-flex items-center shrink-0 whitespace-nowrap"
      role="img"
      aria-label="FLOWTRAIN"
      style={{ fontSize, lineHeight: 1 }}
    >
      {imgOk && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={onDark ? "/logo-o-train-white.png" : "/logo-o-train.png"}
          alt=""
          className="w-auto"
          style={{ height: "1.05em" }}
          onError={() => setImgOk(false)}
        />
      )}
      <span
        aria-hidden
        className="font-display font-semibold"
        style={{
          color: onDark ? "#ffffff" : "#001e64",
          fontSize: "1em",
          lineHeight: 1,
          letterSpacing: "0.03em",
          marginLeft: imgOk ? "0.28em" : 0,
        }}
      >
        {imgOk ? "TRAIN" : "FLOWTRAIN"}
      </span>
    </span>
  );
}
