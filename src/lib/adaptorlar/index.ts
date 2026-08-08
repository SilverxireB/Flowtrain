import type { KayitHedefi, PersonelKaynagi } from "../adaptor";
import { csvPersonel } from "./csvPersonel";
import { csvPersonelYonetim } from "./csvPersonelYonetim";
import { dosyaKayit } from "./dosyaKayit";

/**
 * Etkin adaptörler — çekirdek YALNIZ buradan geçer.
 *
 * Bugün tek uygulama var (CSV + dosya). OPM adaptörü eklendiğinde bu dosyaya
 * bir satır girer, başka HİÇBİR yer değişmez. Sınırın gerçekten çalıştığı
 * buradan görülür: bir ekran `csvPersonel`i doğrudan çağırıyorsa sınır
 * sızmıştır.
 */
export function personelKaynagi(): PersonelKaynagi {
  return { ...csvPersonel, yonetim: csvPersonelYonetim };
}

export function kayitHedefi(): KayitHedefi {
  return dosyaKayit;
}

/**
 * Tamamlanan oturumu dış hedefe gönderir.
 * Hata YUTULMAZ — çağıran `senkron: 'hata'` yazar ve kayıt yeniden denenmek
 * üzere bekler. Sessizce düşen bir eğitim kaydı denetimde yok sayılır.
 */
export async function kaydiGonder(oturum: Parameters<KayitHedefi["gonder"]>[0]): Promise<boolean> {
  try {
    await kayitHedefi().gonder(oturum);
    return true;
  } catch {
    return false;
  }
}
