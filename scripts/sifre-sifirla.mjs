/**
 * ŞİFRE SIFIRLAMA — `npm run sifre`
 *
 * NEDEN VAR: kapalı ağda e-posta ile "şifremi unuttum" diye bir şey yok.
 * Kurulumda çoğu zaman tek bir yönetici hesabı oluyor; o hesabın şifresi
 * unutulduğunda kurulumun İÇİNE girmenin başka yolu kalmıyordu — veri
 * duruyor ama kimse ulaşamıyor. Müşteriye böyle bir ürün teslim edilmez.
 *
 * KURTARMA YETKİSİ = SUNUCUNUN DOSYA SİSTEMİNE ERİŞİM. Standart model bu:
 * makineye girebilen kişi zaten veritabanını da kopyalayabilir, dolayısıyla
 * buradan şifre değiştirmek yeni bir açık yaratmıyor. Ekrandan (tarayıcıdan)
 * çalışan bir sıfırlama yolu ise BİLEREK yok — o, kimliği doğrulanmamış
 * birine yönetici hesabı vermek olurdu.
 *
 * Kullanım:
 *   npm run sifre                      → hesapları listeler
 *   npm run sifre -- <kullanici> <yeni sifre>
 *
 * Değişiklik denetim izine düşer; sonradan "bu şifreyi kim değiştirdi"
 * sorusunun cevabı kayıtta durur.
 */
import Database from "better-sqlite3";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { ozetle, tuzUret, EN_KISA_SIFRE } from "../src/lib/parola.ts";

const VERI = process.env.FLOWTRAIN_DATA ?? join(process.cwd(), "data");
const DB = join(VERI, "flowtrain.db");

if (!existsSync(DB)) {
  console.error(`Veritabanı bulunamadı: ${DB}`);
  console.error("Uygulama hiç açılmadıysa önce `npm run dev` ile bir kez açın.");
  process.exit(1);
}

const d = new Database(DB);
const hesaplar = d.prepare("SELECT kullanici, ad, rol FROM hesap ORDER BY olusturma").all();

const [kullanici, ...sifreParcalari] = process.argv.slice(2);
const sifre = sifreParcalari.join(" ");

if (!kullanici) {
  console.log(`Veri klasörü: ${VERI}\n`);
  if (hesaplar.length === 0) {
    console.log("Hiç hesap yok — uygulamayı açtığınızda kurulum ekranı ilk yöneticiyi oluşturur.");
  } else {
    console.log("Hesaplar:");
    for (const h of hesaplar) console.log(`  ${h.kullanici.padEnd(20)} ${h.rol.padEnd(11)} ${h.ad}`);
    console.log(`\nŞifre değiştirmek için:\n  npm run sifre -- ${hesaplar[0].kullanici} "yeni sifre"`);
  }
  d.close();
  process.exit(0);
}

const hesap = hesaplar.find((h) => h.kullanici === kullanici);
if (!hesap) {
  console.error(`"${kullanici}" adında bir hesap yok. Mevcutlar: ${hesaplar.map((h) => h.kullanici).join(", ") || "(yok)"}`);
  d.close();
  process.exit(1);
}

if (sifre.length < EN_KISA_SIFRE) {
  console.error(`Şifre en az ${EN_KISA_SIFRE} karakter olmalı.`);
  d.close();
  process.exit(1);
}

/* Tuz da YENİLENİR: aynı tuzu korumak, eski özetle yeni özeti
   karşılaştırılabilir kılardı. */
const tuz = tuzUret();
d.prepare("UPDATE hesap SET ozet=?, tuz=? WHERE kullanici=?").run(ozetle(sifre, tuz), tuz, kullanici);

const izId = `iz_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
d.prepare("INSERT INTO iz (id,kim,ne,neZaman) VALUES (?,?,?,?)").run(
  izId,
  kullanici,
  "şifre konsoldan sıfırlandı (sifre-sifirla)",
  new Date().toISOString(),
);

/* WAL tuzağı: yazdığımızı diske indirmeden çıkarsak, kullanıcı sunucuyu
   açtığında ESKİ şifreyi görebilir ve araç "çalışmadı" sanılır. */
d.pragma("wal_checkpoint(TRUNCATE)");
d.close();

console.log(`"${kullanici}" (${hesap.rol}) şifresi değiştirildi.`);
console.log("Değişiklik denetim izine yazıldı. Sunucuyu yeniden başlatmanız gerekmez.");
