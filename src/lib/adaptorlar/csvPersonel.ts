import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { csvOku } from "../csv";
import { VERI_KLASORU } from "../db";
import type { PersonelKaynagi } from "../adaptor";
import type { Kisi } from "../tipler";

/**
 * CSV PERSONEL KAYNAĞI — ürünün STANDART sürümü.
 *
 * Neden API değil dosya: kurumların IT'si dışarıya API açmaz, ama haftalık
 * bırakılan bir dosyayı her kurum kabul eder. Dosya yolu: `<veri>/personel.csv`.
 *
 * Başlıklar Türkçe ve ESNEKtir (kurum kendi dışa aktarımını değiştirmesin diye):
 *   sicil | ad | bölüm/bolum | hat | görev/gorev | amir/amirsicil | işegiriş/isegiris
 *
 * ÖNBELLEK dosyanın değişme zamanına bakar: personel listesi her ekran
 * açılışında okunuyor, 400 satırlık dosyayı her seferinde ayrıştırmak gereksiz —
 * ama dosya güncellenince ANINDA yansımalı, yoksa yeni giren personel
 * "yarın gelir" olur.
 */
const DOSYA = () => process.env.FLOWTRAIN_PERSONEL_CSV ?? join(VERI_KLASORU, "personel.csv");

let onbellek: { mtime: number; kisiler: Kisi[] } | null = null;

function ilkDolu(kayit: Record<string, string>, adaylar: string[]): string | undefined {
  for (const a of adaylar) {
    const v = kayit[a];
    if (v != null && v.trim() !== "") return v.trim();
  }
  return undefined;
}

export function csvKisileriOku(): Kisi[] {
  const yol = DOSYA();
  if (!existsSync(yol)) return [];

  const mtime = statSync(yol).mtimeMs;
  if (onbellek && onbellek.mtime === mtime) return onbellek.kisiler;

  const kisiler = csvOku(readFileSync(yol, "utf8"))
    .map((k) => ({
      sicil: ilkDolu(k, ["sicil", "sicil no", "sicilno", "personel no"]) ?? "",
      ad: ilkDolu(k, ["ad", "adı", "ad soyad", "adsoyad", "isim"]) ?? "",
      bolum: ilkDolu(k, ["bölüm", "bolum", "departman"]),
      hat: ilkDolu(k, ["hat", "line"]),
      gorev: ilkDolu(k, ["görev", "gorev", "unvan", "pozisyon"]),
      amirSicil: ilkDolu(k, ["amir", "amirsicil", "amir sicil", "amir sicili", "yönetici", "yonetici"]),
      iseGiris: ilkDolu(k, ["işegiriş", "isegiris", "işe giriş", "ise giris", "giriş tarihi", "giris tarihi"]),
    }))
    // Sicilsiz satır ATILIR: kime ait olduğu bilinmeyen bir eğitim kaydı
    // denetimde hiçbir işe yaramaz, üstelik boş satırlar listeyi kirletir.
    .filter((k) => k.sicil !== "");

  onbellek = { mtime, kisiler };
  return kisiler;
}

/** Sınavlar ve `/ayarlar` yeniden okumayı zorlayabilsin diye. */
export function onbellegiTemizle(): void {
  onbellek = null;
}

export const csvPersonel: PersonelKaynagi = {
  ad: "CSV dosyası",
  async listele() {
    return csvKisileriOku();
  },
  async bul(sicil) {
    return csvKisileriOku().find((k) => k.sicil === sicil.trim()) ?? null;
  },
  async ekip(amirSicil) {
    return csvKisileriOku().filter((k) => k.amirSicil === amirSicil);
  },
};

export function personelDosyaYolu(): string {
  return DOSYA();
}
