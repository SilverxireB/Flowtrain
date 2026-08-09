import { mmEslemeleriGetir } from "../depo";

/**
 * MALİYET MERKEZİ TÜRETMESİ — her personel adaptörünün ortak kuralı.
 *
 * OPM kaydı ÜÇ ŞEYDİR: sicil · ad · maliyet merkezi. Bölüm ve amir o kayıtta
 * YOKTUR; `mmEsleme` tablosundan türetilir. Kural iki adaptörde ayrı ayrı
 * yazılırsa (CSV bir türlü, OPM başka türlü eşlerse) aynı fabrikada iki farklı
 * bölüm gerçeği oluşur ve hangisinin doğru olduğu kimse bilemez. Bu yüzden
 * kural TEK yerde: burada.
 *
 * Eşleme VERİDİR — fabrika kendi kodlarını `/personel` ekranından bağlar,
 * yazılımcı gerekmez.
 */

export interface MmTuretilen {
  bolum: string;
  amirSicil: string;
}

/**
 * Kod → bölüm/amir haritası. Toplu işlerde (bin kişilik OPM listesi) BİR KEZ
 * kurulur; satır başına tabloya gitmek listeyi gereksiz yere yavaşlatır.
 *
 * Harita saklanmaz, her çağrıda yeniden kurulur: eşleme ekranda değiştiği anda
 * bir sonraki okuma doğru sonucu vermeli — bayat eşleme, yanlış amire düşen
 * personel demektir.
 */
export function mmEslemeHaritasi(): Map<string, MmTuretilen> {
  const harita = new Map<string, MmTuretilen>();
  for (const e of mmEslemeleriGetir()) {
    harita.set(e.kod.trim(), { bolum: e.bolum ?? "", amirSicil: e.amirSicil ?? "" });
  }
  return harita;
}

/** Haritadan tek kod çözer. Kod tanımsızsa `null` — çağıran "eşlemesiz" sayar. */
export function haritadanTuret(harita: Map<string, MmTuretilen>, kod: string): MmTuretilen | null {
  return harita.get(kod.trim()) ?? null;
}

/** Tek satırlık düzenleme için kestirme; toplu işte `mmEslemeHaritasi` kullanın. */
export function mmTuret(kod: string): MmTuretilen | null {
  return haritadanTuret(mmEslemeHaritasi(), kod);
}
