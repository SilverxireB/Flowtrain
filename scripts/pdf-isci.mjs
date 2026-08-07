/**
 * pdfjs işçi dosyasını `public/`e kopyalar (`npm install` sonrası otomatik).
 *
 * NEDEN AYRI DOSYA: bu iş eskiden `package.json` içinde tek satırlık bir
 * `node -e "..."` idi. İç içe tırnaklar Windows'ta `cmd` tarafından yeniden
 * yorumlanıyor ve kurulum "npm install çalıştı ama PDF yükleme çalışmıyor"
 * diye SESSİZCE yarım kalıyordu — üstelik hata mesajı da PDF'ten değil,
 * bulunamayan işçi dosyasından geliyordu.
 *
 * NEDEN CDN DEĞİL: ürün kapalı ağda çalışır; işçi dosyası kendi sunucumuzdan
 * gelmek ZORUNDA, yoksa PDF dönüştürme sonsuza kadar "çalışıyor" kalır.
 */
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const kok = join(dirname(fileURLToPath(import.meta.url)), "..");
const kaynak = join(kok, "node_modules", "pdfjs-dist", "build", "pdf.worker.min.mjs");
const hedef = join(kok, "public", "pdf.worker.min.mjs");

if (!existsSync(kaynak)) {
  // Kurulum yarım kaldıysa `npm install`ı düşürmeyelim; ama sessiz de kalmayalım.
  console.warn("⚠ pdfjs işçi dosyası bulunamadı — PDF yükleme çalışmayacak. `npm install` tamamlandı mı?");
  process.exit(0);
}

mkdirSync(dirname(hedef), { recursive: true });
copyFileSync(kaynak, hedef);
console.log("✓ public/pdf.worker.min.mjs güncellendi");
