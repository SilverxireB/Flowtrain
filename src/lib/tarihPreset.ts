/**
 * TARİH PRESET HAPLARI — süzgeç kokpitinin çekirdeği.
 *
 * FlowUI'ın filtre dili: kokpit TEK SATIRDIR ve tarih aralığı iki takvim
 * kutusuyla değil, HAPLARLA seçilir (Bugün · Dün · Son 7 Gün · Bu Ay).
 * İki kutu duruyor ama sık kullanılan aralık tek tıkla geliyor — kayıt
 * defterine bakan kişinin sorusu neredeyse her zaman "bugün ne oldu".
 *
 * SAF MANTIK, ÇİZİM DEĞİL: `src/lib`te durmasının sebebi sınavlanabilirlik.
 * Ay sonu, artık yıl ve yerel saat dilimi tuzakları burada ölçülüyor.
 *
 * ⚠ YEREL GÜN, UTC DEĞİL. `toISOString()` kullanmak Türkiye'de gece
 * yarısından önce bir GÜN GERİ kaydırıyor (UTC+3): 1 Mart 02:00'de
 * "bugün" 28 Şubat çıkıyordu. Gün parçaları yerel saatten okunuyor.
 *
 * Sınav: `node tests/tarih-preset.test.mjs`
 */

export type PresetAnahtari = "bugun" | "dun" | "son7" | "buAy";

export interface Aralik {
  baslangicGun: string;
  bitisGun: string;
}

/** Yerel takvim gününü `YYYY-MM-DD` olarak yazar. */
export function gunYaz(t: Date): string {
  const y = t.getFullYear();
  const a = String(t.getMonth() + 1).padStart(2, "0");
  const g = String(t.getDate()).padStart(2, "0");
  return `${y}-${a}-${g}`;
}

/** Gün ekler/çıkarır. `Date` ay ve yıl taşmasını kendi halleder. */
function gunKaydir(t: Date, adim: number): Date {
  const yeni = new Date(t.getFullYear(), t.getMonth(), t.getDate() + adim);
  return yeni;
}

/**
 * PRESET SIRASI = ÖNEM SIRASI ve daralmada FEDA SIRASININ TERSİ.
 *
 * Yer kalmayınca sondan başa gizlenir (Bu Ay → Son 7 Gün → Dün); "Bugün"
 * HER ZAMAN kalır. FlowUI kuralı: kokpit tek satırdır ve daralınca sarmak
 * yerine en az kullanılanı bırakır.
 */
export const PRESETLER: { anahtar: PresetAnahtari; etiket: string }[] = [
  { anahtar: "bugun", etiket: "Bugün" },
  { anahtar: "dun", etiket: "Dün" },
  { anahtar: "son7", etiket: "Son 7 gün" },
  { anahtar: "buAy", etiket: "Bu ay" },
];

/**
 * Preset'in kapsadığı aralık.
 *
 * `simdi` DIŞARIDAN verilir: işlev saf kalsın ve sınav ay sonunu, artık
 * yılı, yıl dönümünü kendi seçtiği günle ölçebilsin.
 *
 * "Son 7 gün" BUGÜNÜ İÇERİR (bugün dahil yedi gün, yani 6 gün geriye).
 * Bugünü dışarıda bırakan bir "son 7 gün" kullanıcının beklediği şey değil:
 * defterde en çok aranan kayıt bugün düşen kayıttır.
 */
export function presetAraligi(anahtar: PresetAnahtari, simdi: Date): Aralik {
  const bugun = gunYaz(simdi);
  switch (anahtar) {
    case "bugun":
      return { baslangicGun: bugun, bitisGun: bugun };
    case "dun": {
      const d = gunYaz(gunKaydir(simdi, -1));
      return { baslangicGun: d, bitisGun: d };
    }
    case "son7":
      return { baslangicGun: gunYaz(gunKaydir(simdi, -6)), bitisGun: bugun };
    case "buAy":
      return {
        baslangicGun: gunYaz(new Date(simdi.getFullYear(), simdi.getMonth(), 1)),
        bitisGun: bugun,
      };
  }
}

/**
 * Elde duran aralık hangi preset'e denk geliyor?
 *
 * Hap "seçili" görünsün diye: kullanıcı takvimden elle bugünü seçtiyse
 * "Bugün" hapı da yanmalı — aynı şeyi iki farklı yoldan söylemenin ekranda
 * iki farklı görünmesi kafa karıştırıyor. Hiçbirine uymuyorsa `null`.
 */
export function eslesenPreset(aralik: Aralik, simdi: Date): PresetAnahtari | null {
  for (const { anahtar } of PRESETLER) {
    const a = presetAraligi(anahtar, simdi);
    if (a.baslangicGun === aralik.baslangicGun && a.bitisGun === aralik.bitisGun) return anahtar;
  }
  return null;
}
