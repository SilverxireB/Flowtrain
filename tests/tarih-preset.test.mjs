/**
 * TARİH PRESET SINAVI — süzgeç kokpitinin hap dili.
 *
 * Ölçülen tuzaklar: ay sonu, yıl dönümü, artık yıl ve YEREL GÜN.
 * Sonuncusu en sinsisi — `toISOString()` Türkiye'de (UTC+3) gece
 * yarısından önceki saatlerde bir gün GERİ kaydırıyor.
 *
 * Koşum: `node --experimental-strip-types tests/tarih-preset.test.mjs`
 */
import { presetAraligi, eslesenPreset, gunYaz, PRESETLER } from "../src/lib/tarihPreset.ts";
import { kontrol, esit, bitir } from "./yardim.mjs";

/** Yerel saatle bir an kurar (ay 1-tabanlı yazılır, okunur olsun diye). */
const an = (y, a, g, saat = 12) => new Date(y, a - 1, g, saat);

/* ── 1. gün yazımı yerel ──────────────────────────────────────────────────── */

esit(gunYaz(an(2026, 3, 1, 2)), "2026-03-01", "gece yarısından sonra bile YEREL gün yazılıyor");
esit(gunYaz(an(2026, 3, 1, 23)), "2026-03-01", "gece geç saatte de aynı gün");
esit(gunYaz(an(2026, 1, 5)), "2026-01-05", "tek haneli ay ve gün sıfırla dolduruluyor");

/* ── 2. bugün / dün ───────────────────────────────────────────────────────── */

esit(presetAraligi("bugun", an(2026, 8, 12)), { baslangicGun: "2026-08-12", bitisGun: "2026-08-12" }, "bugün tek gün");
esit(presetAraligi("dun", an(2026, 8, 12)), { baslangicGun: "2026-08-11", bitisGun: "2026-08-11" }, "dün tek gün");

/* AY BAŞINDA dün bir önceki AYA düşer. */
esit(presetAraligi("dun", an(2026, 8, 1)), { baslangicGun: "2026-07-31", bitisGun: "2026-07-31" }, "ayın ilki: dün önceki ayın sonu");
/* YIL BAŞINDA dün bir önceki YILA düşer. */
esit(presetAraligi("dun", an(2026, 1, 1)), { baslangicGun: "2025-12-31", bitisGun: "2025-12-31" }, "yılın ilki: dün önceki yılın sonu");
/* ARTIK YIL: 2028 artık, 1 Mart'ın dünü 29 Şubat. */
esit(presetAraligi("dun", an(2028, 3, 1)), { baslangicGun: "2028-02-29", bitisGun: "2028-02-29" }, "artık yılda 29 Şubat atlanmıyor");
/* ARTIK OLMAYAN yılda 1 Mart'ın dünü 28 Şubat. */
esit(presetAraligi("dun", an(2026, 3, 1)), { baslangicGun: "2026-02-28", bitisGun: "2026-02-28" }, "artık olmayan yılda 28 Şubat");

/* ── 3. son 7 gün — BUGÜNÜ İÇERİR ─────────────────────────────────────────── */

esit(
  presetAraligi("son7", an(2026, 8, 12)),
  { baslangicGun: "2026-08-06", bitisGun: "2026-08-12" },
  "son 7 gün bugünü İÇERİR (6 gün geriye)",
);
esit(
  presetAraligi("son7", an(2026, 1, 3)),
  { baslangicGun: "2025-12-28", bitisGun: "2026-01-03" },
  "son 7 gün yıl sınırını aşabiliyor",
);

/* ── 4. bu ay ─────────────────────────────────────────────────────────────── */

esit(presetAraligi("buAy", an(2026, 8, 12)), { baslangicGun: "2026-08-01", bitisGun: "2026-08-12" }, "bu ay: 1'inden bugüne");
esit(presetAraligi("buAy", an(2026, 8, 1)), { baslangicGun: "2026-08-01", bitisGun: "2026-08-01" }, "ayın ilkinde tek gün");
esit(presetAraligi("buAy", an(2026, 2, 28)), { baslangicGun: "2026-02-01", bitisGun: "2026-02-28" }, "şubatta da 1'inden başlar");

/* ── 5. eşleşen preset — elle seçilen aralık da hapı yakar ────────────────── */

const simdi = an(2026, 8, 12);
for (const { anahtar } of PRESETLER) {
  esit(eslesenPreset(presetAraligi(anahtar, simdi), simdi), anahtar, `${anahtar} kendi aralığıyla eşleşiyor`);
}
esit(
  eslesenPreset({ baslangicGun: "2026-08-12", bitisGun: "2026-08-12" }, simdi),
  "bugun",
  "takvimden ELLE seçilen bugün de 'Bugün' hapını yakıyor",
);
esit(eslesenPreset({ baslangicGun: "2026-01-01", bitisGun: "2026-06-30" }, simdi), null, "keyfi aralık hiçbir hapı yakmıyor");
esit(eslesenPreset({ baslangicGun: "", bitisGun: "" }, simdi), null, "boş aralık hap yakmıyor");
esit(
  eslesenPreset({ baslangicGun: "2026-08-06", bitisGun: "" }, simdi),
  null,
  "yarım aralık hap yakmıyor (tek uçlu süzgeç preset değildir)",
);

/* ── 6. sıra = önem sırası ────────────────────────────────────────────────── */

esit(PRESETLER.map((p) => p.anahtar), ["bugun", "dun", "son7", "buAy"], "hap sırası önem sırası");
kontrol(PRESETLER[0].anahtar === "bugun", "daralmada kalan hap 'Bugün' (ilk sıra)");

bitir("tarih preset");
