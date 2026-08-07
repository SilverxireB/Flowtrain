/**
 * Geliştirme aracı: ana ekranların görüntüsünü alır (`node tests/ekran-goruntusu.mjs`).
 * Sınav DEĞİL — göz kontrolü için. Çıktılar /tmp altına yazılır, repoya girmez.
 */
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

const KROM = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const PORT = 3112;
const ADRES = `http://127.0.0.1:${PORT}`;
const CIKTI = process.env.CIKTI ?? "/tmp/flowtrain-ekran";

const veri = mkdtempSync(join(tmpdir(), "flowtrain-ss-"));
writeFileSync(
  join(veri, "personel.csv"),
  "﻿Sicil;Ad;Bölüm;Hat;Görev;Amir;İşe giriş\r\n" +
    "1001;Ali Yılmaz;Kaynak;Hat 1;Operatör;9001;2026-08-01\r\n" +
    "1002;Ayşe Demir;Kaynak;Hat 1;Operatör;9001;2024-03-15\r\n" +
    "1003;Mehmet Öz;Montaj;Hat 2;Forklift;9001;2023-01-10\r\n" +
    "1004;Zeynep Kaya;Boya;Hat 3;Operatör;9001;2025-11-20\r\n" +
    "9001;Veli Usta;Kaynak;Hat 1;Amir;;2020-05-05\r\n",
  "utf8",
);

// Önceki çöken koşudan kalan sunucu portu tutuyor olabilir: tutuyorsa yeni
// sunucu bağlanamaz ve betik ESKİ verinin üstünde çalışır.
try {
  spawn("pkill", ["-f", `next start -p ${PORT}`]).on("close", () => {});
  await new Promise((r) => setTimeout(r, 1500));
} catch {
  /* pkill yoksa sorun değil */
}

const sunucu = spawn("node_modules/.bin/next", ["start", "-p", String(PORT)], {
  env: { ...process.env, FLOWTRAIN_DATA: veri, NODE_ENV: "production" },
  stdio: ["ignore", "ignore", "ignore"],
});

for (let i = 0; i < 60; i++) {
  try {
    if ((await fetch(ADRES)).status < 500) break;
  } catch {
    /* bekle */
  }
  await new Promise((r) => setTimeout(r, 500));
}

process.on("exit", () => sunucu.kill("SIGTERM"));
process.on("uncaughtException", (e) => {
  console.error(e.message);
  sunucu.kill("SIGTERM");
  process.exit(1);
});

const tarayici = await chromium.launch({ executablePath: KROM });
const kokpit = await tarayici.newContext({ viewport: { width: 1180, height: 900 }, deviceScaleFactor: 2 });
const s = await kokpit.newPage();

async function cek(ad, tamSayfa = false) {
  await s.waitForTimeout(700);
  await s.screenshot({ path: `${CIKTI}-${ad}.png`, fullPage: tamSayfa });
  console.log(`✓ ${CIKTI}-${ad}.png`);
}

await s.goto(ADRES, { waitUntil: "networkidle" });
await cek("01-kurulum");
await s.fill('input[name="ad"]', "Şeyma Yıldız");
await s.fill('input[name="kullanici"]', "seyma");
await s.fill('input[name="sifre"]', "sifre123");
await s.click('button[type="submit"]');
await s.waitForURL(`${ADRES}/`);
await cek("02-hub");

await s.goto(`${ADRES}/egitimler`, { waitUntil: "networkidle" });
await s.fill('input[name="ad"]', "Yüksekte Çalışma");
await s.click('button:has-text("Oluştur")');
await s.waitForURL(/\/egitimler\/egt_/);

await s.click('button:has-text("Tehlike uyarısı")');
await s.waitForTimeout(900);
let b = s.locator('input[placeholder="Başlık"]').first();
await b.fill("2 metrenin üstünde emniyet kemeri zorunludur");
await b.blur();
await s.waitForTimeout(700);
let m = s.locator("textarea").nth(1);
await m.fill("Kemersiz çalışan kişi hattan alınır. Bu bir uyarı değil, kuraldır.");
await m.blur();
await s.waitForTimeout(700);

await s.click('button:has-text("Yap / Yapma")');
await s.waitForTimeout(900);
b = s.locator('input[placeholder="Başlık"]').nth(1);
await b.fill("Kemer nasıl bağlanır");
await b.blur();
await s.waitForTimeout(700);

await s.click('button:has-text("Çoktan seçmeli")');
await s.waitForTimeout(900);
const sm = s.locator('textarea[placeholder="Soru metni"]').first();
await sm.fill("Kaç metreden itibaren emniyet kemeri zorunludur?");
await sm.blur();
await s.waitForTimeout(700);
const sik = s.locator('input[placeholder="1. şık"]');
await sik.fill("2 metre");
await sik.blur();
await s.waitForTimeout(500);
const sik2 = s.locator('input[placeholder="2. şık"]');
await sik2.fill("5 metre");
await sik2.blur();
await s.waitForTimeout(700);
await cek("03-editor", true);

await s.click('button:has-text("Dene")');
await s.waitForTimeout(1200);
await cek("04-prova");
await s.locator('button[aria-label="Çık"]').click();
await s.waitForTimeout(500);

await s.click('button[aria-label="Kullanım rehberi"]');
await s.waitForTimeout(1200);
await cek("05-rehber");
await s.keyboard.press("Escape");
await s.waitForTimeout(400);

await s.click('button:has-text("Yayınla")');
await s.waitForTimeout(2000);

await s.goto(`${ADRES}/atama`, { waitUntil: "networkidle" });
await s.selectOption('select[name="egitimId"]', { label: "Yüksekte Çalışma" });
await s.getByRole("button", { name: "Kaynak", exact: true }).click();
await s.click('button:has-text("Kuralı ekle")');
await s.waitForTimeout(2000);
await cek("06-atama", true);

await s.goto(`${ADRES}/pano`, { waitUntil: "networkidle" });
await cek("07-pano", true);

const kioskBaglam = await tarayici.newContext({ viewport: { width: 900, height: 1200 }, deviceScaleFactor: 2 });
const k = await kioskBaglam.newPage();
await k.goto(`${ADRES}/kiosk`, { waitUntil: "networkidle" });
await k.waitForTimeout(700);
await k.screenshot({ path: `${CIKTI}-08-kiosk-giris.png` });
console.log(`✓ ${CIKTI}-08-kiosk-giris.png`);

await k.fill('input[aria-label="Sicil numarası"]', "1001");
await k.click('button:has-text("Devam")');
await k.waitForTimeout(1500);
await k.screenshot({ path: `${CIKTI}-09-kiosk-liste.png` });
console.log(`✓ ${CIKTI}-09-kiosk-liste.png`);

await k.click('button:has-text("Başla")');
await k.waitForTimeout(1500);
await k.screenshot({ path: `${CIKTI}-10-kiosk-kart.png` });
console.log(`✓ ${CIKTI}-10-kiosk-kart.png`);

await k.waitForTimeout(9000);
await k.locator("button.kiosk-btn-primary").first().click();
await k.waitForTimeout(9000);
await k.locator("button.kiosk-btn-primary").first().click();
await k.waitForTimeout(1500);
await k.screenshot({ path: `${CIKTI}-11-kiosk-sinav.png` });
console.log(`✓ ${CIKTI}-11-kiosk-sinav.png`);

await tarayici.close();
sunucu.kill("SIGTERM");
