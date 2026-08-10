/**
 * VERİYİ TAŞINMAYA HAZIRLA — `npm run veri`
 *
 * NEDEN VAR: SQLite WAL kipinde çalışıyor. Yazılan her şey önce `.db` dosyasına
 * DEĞİL, yanındaki `flowtrain.db-wal` dosyasına gider ve oraya saatlerce
 * oturabilir. Sonuç, sessiz bir veri kaybı biçimi:
 *
 *   - `git status` tertemiz görünür,
 *   - `flowtrain.db` commit edilmiştir,
 *   - ama günün çalışması hâlâ WAL'dedir ve başka makineye geçen kişi
 *     saatler öncesinin verisini bulur.
 *
 * Bir kez başımıza geldi: `.db` sabah 04:21'den kalmışken WAL 210 KB'a çıkmıştı
 * ve arada eklenen eğitim, maliyet merkezi eşlemesi ve aktarılan kayıtların
 * hiçbiri diske inmemişti.
 *
 * Bu betik WAL'i `.db`ye katlar (checkpoint TRUNCATE). Sonrasında `.db` tek
 * başına eksiksizdir; yan dosyalar boş kalır.
 *
 * NE ZAMAN ÇALIŞTIRILIR: veriyi commit'lemeden, yedek almadan ya da klasörü
 * başka bir makineye kopyalamadan önce. Uygulama düzgün kapatıldığında WAL
 * kendiliğinden yazılır — bu betik "sunucu açıkken kopyalıyorum" durumu için.
 *
 * SUNUCU AÇIKKEN ÇALIŞTIRMAK GÜVENLİDİR: checkpoint ayrı bir bağlantıdan
 * yapılır, veri kaybettirmez. Yalnız o an yazan bir işlem varsa checkpoint
 * tamamlanamayabilir; çıktıda söylenir.
 */
import Database from "better-sqlite3";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";

const VERI = process.env.FLOWTRAIN_DATA ?? join(process.cwd(), "data");
const DB = join(VERI, "flowtrain.db");

if (!existsSync(DB)) {
  console.error(`Veritabanı bulunamadı: ${DB}`);
  process.exit(1);
}

const walYolu = `${DB}-wal`;
const oncekiWal = existsSync(walYolu) ? statSync(walYolu).size : 0;

const d = new Database(DB);
/* Sonuç `{ busy, log, checkpointed }`. `busy === 1` ise başka bir bağlantı
   yazıyor demektir ve WAL'in tamamı boşaltılamamıştır — bunu YUTMUYORUZ:
   "hazırladım" deyip yarım bırakmak, bu betiğin engellemek için var olduğu
   hatanın ta kendisi olurdu. Checkpoint BİR KEZ çağrılır; ikinci çağrı
   ilkinin sonucunu görmeden ölçüm yapardı. */
const sonuc = d.pragma("wal_checkpoint(TRUNCATE)")[0] ?? {};
const engellendi = Number(sonuc.busy ?? 0);
const walSayfa = Number(sonuc.log ?? 0);
const geriYazilan = Number(sonuc.checkpointed ?? 0);
d.close();

const kalanWal = existsSync(walYolu) ? statSync(walYolu).size : 0;

console.log(`Veri klasörü : ${VERI}`);
console.log(`WAL önce     : ${(oncekiWal / 1024).toFixed(0)} KB`);
console.log(`WAL sonra    : ${(kalanWal / 1024).toFixed(0)} KB`);

if (engellendi === 1 || kalanWal > 0) {
  console.error(
    "\nUYARI: WAL tamamen boşaltılamadı — büyük olasılıkla sunucu şu an yazıyor.\n" +
      "Sunucuyu durdurup tekrar çalıştırın, yoksa commit'lenen veri eksik kalır.",
  );
  process.exit(1);
}

console.log(`\nHazır. Veritabanı tek başına eksiksiz (WAL ${walSayfa} sayfa, ${geriYazilan} sayfa geri yazıldı).`);
console.log("Şimdi commit edebilir ya da klasörü kopyalayabilirsiniz.");
