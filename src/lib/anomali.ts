/**
 * ANOMALİ TESPİTİ — saf mantık.
 *
 * NEDEN VAR: amir tableti tamamlama oranını yükseltir, ama aynı tablet 12
 * kişiyi 4 dakikada "tamamlanmış" gösterebilir. O zaman elde kâğıttan beter
 * bir şey olur: SAHTE YASAL KAYIT. Sattığımız şey kayıttır.
 *
 * Ürün kimseyi suçlamaz, ENGELLEMEZ de — yalnız görünür kılar. Suçlama
 * yapmamasının sebebi: hızlı bitirmenin masum açıklamaları var (aynı eğitimi
 * geçen ay almış, videoyu hattın panosunda izlemiş). Karar insanın.
 *
 * Sınav: `node tests/anomali.test.mjs`
 */
import type { Oturum, Sayfa } from "./tipler";

/** Bir eğitimin dürüstçe tamamlanması için gereken en az süre (saniye). */
export function beklenenSure(sayfalar: Pick<Sayfa, "asgariSure">[]): number {
  return sayfalar.reduce((t, s) => t + (s.asgariSure || 0), 0);
}

/** Oturumun içerikte geçirdiği toplam süre (saniye). */
export function gecenSure(oturum: Pick<Oturum, "sayfaSureleri">): number {
  return Object.values(oturum.sayfaSureleri ?? {}).reduce((t, s) => t + s, 0);
}

/** Beklenenin bu oranının altı "hızlı" sayılır (yarısı). */
export const HIZLI_ORAN = 0.5;

export function hizliMi(oturum: Pick<Oturum, "sayfaSureleri">, beklenen: number): boolean {
  if (beklenen <= 0) return false;
  return gecenSure(oturum) < beklenen * HIZLI_ORAN;
}

export interface GozetenOzeti {
  gozeten: string;
  oturumSayisi: number;
  ortalamaSure: number;
  beklenenSure: number;
  hizliSayisi: number;
  /** Şüpheli: en az 3 oturum VE yarıdan fazlası hızlı. */
  supheli: boolean;
}

/**
 * Gözeten (amir) başına özet.
 *
 * ASGARİ ADET ŞART: tek bir hızlı oturum hiçbir şey söylemez — insan hızlı
 * okumuş olabilir. Desen ancak tekrar edince anlam kazanır, o yüzden 3'ün
 * altında hiçbir amir işaretlenmez (yanlış suçlama ürünü çöpe attırır).
 */
export function gozetenOzetleri(
  oturumlar: Pick<Oturum, "gozeten" | "sayfaSureleri" | "bitis">[],
  beklenen: number,
  asgariOturum = 3,
): GozetenOzeti[] {
  const grup = new Map<string, Pick<Oturum, "gozeten" | "sayfaSureleri" | "bitis">[]>();
  for (const o of oturumlar) {
    if (!o.gozeten || !o.bitis) continue;
    const liste = grup.get(o.gozeten) ?? [];
    liste.push(o);
    grup.set(o.gozeten, liste);
  }

  return [...grup.entries()]
    .map(([gozeten, liste]) => {
      const hizli = liste.filter((o) => hizliMi(o, beklenen)).length;
      const toplam = liste.reduce((t, o) => t + gecenSure(o), 0);
      return {
        gozeten,
        oturumSayisi: liste.length,
        ortalamaSure: Math.round(toplam / liste.length),
        beklenenSure: beklenen,
        hizliSayisi: hizli,
        supheli: liste.length >= asgariOturum && hizli > liste.length / 2,
      };
    })
    .sort((a, b) => b.hizliSayisi - a.hizliSayisi);
}

/** Panoda gösterilecek insan okunur cümle. */
export function anomaliMetni(o: GozetenOzeti): string {
  const dk = (sn: number) => (sn >= 60 ? `${Math.round(sn / 60)} dk` : `${sn} sn`);
  return `${o.oturumSayisi} kayıt · ort. ${dk(o.ortalamaSure)} · beklenen ${dk(o.beklenenSure)}`;
}
