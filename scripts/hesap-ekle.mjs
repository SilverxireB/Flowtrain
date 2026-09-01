/**
 * HESAP EKLEME — `npm run hesap`
 *
 * NEDEN AYRI BİR BETİK VAR: normalde hesap açmanın yeri `/ayarlar`
 * ekranıdır ve yönetici oradan ekler. Ama VİTRİN DAĞITIMINDA (Vercel) o yol
 * kalıcı DEĞİL: orada veri klasörü `/tmp/flowtrain`, yani sunucu örneğine
 * ait geçici bir alan. Ekrandan açılan hesap o örnek yaşadığı sürece
 * çalışır, örnek geri dönüştüğünde yok olur — link verilen kişi ertesi gün
 * "şifre yanlış" der.
 *
 * Vitrinde KALICI tek yol, hesabı depodaki tohum veritabanına yazmaktır
 * (`data/flowtrain.db`): her soğuk açılışta `/tmp`ye o kopyalanıyor
 * (`src/lib/db.ts` · `tohumKlasorunuAc`). Bu betik onu yapar.
 *
 * Kullanım:
 *   npm run hesap                                   → hesapları listeler
 *   npm run hesap -- <kullanici> <ad> <rol> <sifre>
 *
 * Roller: yonetici · hazirlayan · onaylayan · amir
 *
 * ⚠ Vitrine eklenen hesap AÇIK KAYNAK DEPOYA girer. Gerçek kurulumda hesap
 * buradan değil, `/ayarlar` ekranından açılır.
 */
import Database from "better-sqlite3";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { ozetle, tuzUret, EN_KISA_SIFRE } from "../src/lib/parola.ts";

const ROLLER = ["yonetici", "hazirlayan", "onaylayan", "amir"];
const VERI = process.env.FLOWTRAIN_DATA ?? join(process.cwd(), "data");
const DB = join(VERI, "flowtrain.db");

if (!existsSync(DB)) {
  console.error(`Veritabanı bulunamadı: ${DB}`);
  process.exit(1);
}

const d = new Database(DB);
const hesaplar = d.prepare("SELECT kullanici, ad, rol FROM hesap ORDER BY olusturma").all();

const [kullanici, ad, rol, ...sifreParcalari] = process.argv.slice(2);
const sifre = sifreParcalari.join(" ");

if (!kullanici) {
  console.log(`Veri klasörü: ${VERI}\n`);
  console.log(hesaplar.length ? "Hesaplar:" : "Hiç hesap yok.");
  for (const h of hesaplar) console.log(`  ${h.kullanici.padEnd(22)} ${h.rol.padEnd(11)} ${h.ad}`);
  console.log(`\nEklemek için:\n  npm run hesap -- kullanici "Ad Soyad" hazirlayan "sifre"`);
  d.close();
  process.exit(0);
}

if (hesaplar.some((h) => h.kullanici === kullanici)) {
  console.error(`"${kullanici}" zaten var. Şifresini değiştirmek için: npm run sifre -- ${kullanici} "yeni sifre"`);
  d.close();
  process.exit(1);
}
if (!ROLLER.includes(rol)) {
  console.error(`Rol "${rol}" geçersiz. Geçerli roller: ${ROLLER.join(" · ")}`);
  d.close();
  process.exit(1);
}
if (!ad || sifre.length < EN_KISA_SIFRE) {
  console.error(`Ad gerekli ve şifre en az ${EN_KISA_SIFRE} karakter olmalı.`);
  d.close();
  process.exit(1);
}

const tuz = tuzUret();
d.prepare(
  "INSERT INTO hesap (kullanici,ad,rol,ozet,tuz,sicil,olusturma) VALUES (?,?,?,?,?,?,?)",
).run(kullanici, ad, rol, ozetle(sifre, tuz), tuz, null, new Date().toISOString());

const izId = `iz_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
d.prepare("INSERT INTO iz (id,kim,ne,neZaman) VALUES (?,?,?,?)").run(
  izId,
  kullanici,
  `hesap konsoldan açıldı (${rol})`,
  new Date().toISOString(),
);

/* WAL tuzağı: diske indirmeden çıkarsak hesap `.db`ye değil `-wal`e yazılır
   ve `git add data/` onu almaz — vitrine hiç gitmemiş olur. */
d.pragma("wal_checkpoint(TRUNCATE)");
d.close();

console.log(`"${kullanici}" (${rol}) eklendi — ${ad}`);
