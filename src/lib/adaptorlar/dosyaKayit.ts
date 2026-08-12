import { appendFileSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BOM } from "../csv";
import { VERI_KLASORU } from "../db";
import type { KayitHedefi } from "../adaptor";

/**
 * DOSYA KAYIT HEDEFİ — ürünün standart sürümü.
 *
 * Tamamlanan her oturum `<veri>/kayitlar.csv`e EKLENİR (üzerine yazılmaz).
 * Kurumun eğitim sistemi ne olursa olsun bu dosya elle içe aktarılabilir;
 * denetimde de tek başına belgedir.
 *
 * Neden ayrı dosya, neden SQLite yetmiyor: veritabanı bizim çalışma alanımız,
 * bu dosya KURUMUN. Kurulum kaldırılsa bile kayıt elinde kalmalı.
 */
const DOSYA = () => join(VERI_KLASORU, "kayitlar.csv");

const BASLIK = ["Sicil", "Ad", "Eğitim", "Sürüm", "Başlangıç", "Bitiş", "Puan", "Sonuç", "Gözeten", "Cihaz", "Oturum"];

function kacir(v: unknown): string {
  const s = String(v ?? "");
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Çözülemeyen ad/eğitim için hücreye YAZILAN metin.
 *
 * Boş bırakmak "bilmiyoruz"u gizliyordu: belgeye bakan kişi sütunun hiç
 * doldurulmadığını mı yoksa o kaydın kişisinin listeden düştüğünü mü
 * bilemiyordu. Denetimde bu ikisi çok farklı iki şey.
 */
const COZULEMEDI = "(listede yok)";

export const dosyaKayit: KayitHedefi = {
  ad: "Dosya çıktısı (kayitlar.csv)",
  async gonder(oturum, baglam) {
    const yol = DOSYA();
    if (!existsSync(yol)) writeFileSync(yol, BOM + BASLIK.join(";") + "\r\n", "utf8");
    const satir = [
      oturum.sicil,
      /* AD VE EĞİTİM ADI YAZILIR. Bu iki hücre eskiden boş ve ham kimlikti;
         dosyanın var olma sebebi "kurulum kaldırılsa bile kayıt kurumun
         elinde kalsın" iken, elde kalan şey isimsiz sicillerle anlamsız
         `egt_...` kimliklerinden ibaretti — yani hiçbir denetimde
         kullanılamazdı. */
      baglam?.ad || COZULEMEDI,
      baglam?.egitimAdi || `${COZULEMEDI} · ${oturum.egitimId}`,
      oturum.egitimSurum,
      oturum.baslangic,
      oturum.bitis ?? "",
      oturum.puan ?? "",
      oturum.sonuc ?? "",
      oturum.gozeten ?? "",
      oturum.cihaz,
      oturum.id,
    ]
      .map(kacir)
      .join(";");
    appendFileSync(yol, satir + "\r\n", "utf8");
  },
};

export function kayitDosyaYolu(): string {
  return DOSYA();
}
