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

/**
 * Oturumun süresi (saniye).
 *
 * SUNUCU SAATİNDEN ÖLÇÜLÜR, istemciden gelen `sayfaSureleri` toplamından
 * DEĞİL. Sebebi doğrudan bu dosyanın var oluş sebebiyle çelişiyordu: sahteciliği
 * ölçen sayıyı, sahteciliği yapan tarafın göndermesi. `baslangic` ve `bitis`
 * damgalarını sunucu yazar; kimse "6 dakika sürdü" diye yalan söyleyemez.
 *
 * `sayfaSureleri` yine tutulur — hangi sayfada ne kadar kalındığı içerik
 * geri bildirimi için değerli — ama anomali kararına girmez.
 */
export function gecenSure(oturum: Pick<Oturum, "sayfaSureleri" | "baslangic" | "bitis">): number {
  if (oturum.baslangic && oturum.bitis) {
    const fark = (new Date(oturum.bitis).getTime() - new Date(oturum.baslangic).getTime()) / 1000;
    if (fark >= 0) return Math.round(fark);
  }
  return Object.values(oturum.sayfaSureleri ?? {}).reduce((t, s) => t + s, 0);
}

/** Beklenenin bu oranının altı "hızlı" sayılır (yarısı). */
export const HIZLI_ORAN = 0.5;

type OturumOlcusu = Pick<Oturum, "sayfaSureleri" | "baslangic" | "bitis"> & { sonuc?: Oturum["sonuc"] };

export function hizliMi(oturum: OturumOlcusu, beklenen: number): boolean {
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
  oturumlar: (OturumOlcusu & Pick<Oturum, "gozeten" | "cihaz">)[],
  beklenen: number,
  asgariOturum = 3,
): GozetenOzeti[] {
  const grup = new Map<string, OturumOlcusu[]>();
  for (const o of oturumlar) {
    if (!o.bitis) continue;
    /* İPTAL edilen oturumlar ölçüye GİRMEZ: PIN'ini yanlış girip kilitlenen
       kişinin 20 saniyelik kaydı "hızlı oturum" sayılıyor ve masum amiri
       şüpheli gösteriyordu — modülün tam da kaçınmak istediği şey. */
    if (o.sonuc === "iptal") continue;
    // Gözeteni olmayan (kiosk) oturumlar da ölçülür, "Kiosk" başlığı altında.
    // Eskiden atlanıyorlardı — yani sahteciliğin EN KOLAY yolu (kiosk'ta
    // başkasının sicilini girmek) panoda hiç görünmüyordu; tek telafi edici
    // kontrol, korunması gereken deliği kapsamıyordu.
    const anahtar = o.gozeten ?? `(gözetimsiz · ${o.cihaz ?? "kiosk"})`;
    const liste = grup.get(anahtar) ?? [];
    liste.push(o);
    grup.set(anahtar, liste);
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
