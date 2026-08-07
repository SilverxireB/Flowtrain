/**
 * UÇTAN UCA SINAV — gerçek tarayıcıda, gerçek sunucuda, gerçek yazma yoluyla.
 *
 * `npm run e2e`
 *
 * NEDEN: birim sınavlar saf mantığı ölçüyor, ama ürünün asıl vaadi bir ZİNCİR:
 * kurulum → eğitim hazırla → yayınla → kural yaz → kiosk'ta sicil gir →
 * içeriği izle → sınavı ol → PIN'le imzala → kayıt düşsün → panoda görünsün.
 * Zincirin herhangi bir halkası koparsa ürün yok; halkaları tek tek ölçen
 * sınavlar bunu göstermez.
 *
 * Sunucuyu ve veri klasörünü bu betik kurar; kurulumun kendi verisine dokunmaz.
 */
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
/* Playwright ürünün BAĞIMLILIĞI DEĞİL: paketin kurulumu yüzlerce megabayt
   tarayıcı indiriyor ve uygulamayı çalıştırmak için gerekmiyor. Sınavı koşmak
   isteyen ayrıca kurar. */
let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error("Bu sınav Playwright ister:  npm install --no-save playwright");
  process.exit(1);
}

/* Bu ortamda Chromium hazır kurulu; başka makinede Playwright kendi
   indirdiğini kullansın diye yol YOKSA boş geçilir. */
const KROM_YOLU = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const KROM = existsSync(KROM_YOLU) ? KROM_YOLU : undefined;
const PORT = 3111;
const ADRES = `http://127.0.0.1:${PORT}`;

let hata = 0;
let toplam = 0;
const kontrol = (gecti, yazi) => {
  toplam++;
  if (!gecti) hata++;
  console.log(`${gecti ? "✓" : "✗"} ${yazi}`);
};

/* ── ortam ────────────────────────────────────────────────────────────────── */
const veri = mkdtempSync(join(tmpdir(), "flowtrain-e2e-"));
writeFileSync(
  join(veri, "personel.csv"),
  "﻿Sicil;Ad;Bölüm;Hat;Görev;Amir;İşe giriş\r\n" +
    "1001;Ali Yılmaz;Kaynak;Hat 1;Operatör;9001;2026-08-01\r\n" +
    "1002;Ayşe Demir;Kaynak;Hat 1;Operatör;9001;2024-03-15\r\n" +
    "1003;Mehmet Öz;Montaj;Hat 2;Forklift;9001;2023-01-10\r\n" +
    "9001;Veli Usta;Kaynak;Hat 1;Amir;;2020-05-05\r\n",
  "utf8",
);
console.log(`Veri klasörü: ${veri}\n`);

const sunucu = spawn("node_modules/.bin/next", ["start", "-p", String(PORT)], {
  env: { ...process.env, FLOWTRAIN_DATA: veri, NODE_ENV: "production" },
  stdio: ["ignore", "pipe", "pipe"],
});
sunucu.stderr.on("data", (d) => {
  const s = String(d);
  if (!s.includes("Warning")) process.stderr.write(`[sunucu] ${s}`);
});

async function sunucuyuBekle() {
  for (let i = 0; i < 60; i++) {
    try {
      const c = await fetch(ADRES);
      if (c.status < 500) return;
    } catch {
      /* henüz ayakta değil */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Sunucu açılmadı.");
}

function bitir(kod) {
  sunucu.kill("SIGTERM");
  console.log(`\nuçtan uca: ${toplam - hata}/${toplam}`);
  process.exit(kod ?? (hata ? 1 : 0));
}

/* ── akış ─────────────────────────────────────────────────────────────────── */
try {
  await sunucuyuBekle();
  const tarayici = await chromium.launch(KROM ? { executablePath: KROM } : {});
  const kokpit = await tarayici.newContext({ viewport: { width: 1280, height: 900 } });
  const s = await kokpit.newPage();
  s.on("pageerror", (e) => console.log(`  ⚠ sayfa hatası: ${e.message.slice(0, 120)}`));

  /* 1. Kurulum — hiç hesap yokken kurulum sayfasına yönlenmeli. */
  await s.goto(ADRES, { waitUntil: "networkidle" });
  kontrol(s.url().includes("/kurulum"), "hesapsız açılışta kurulum sayfasına yönlendirir");

  await s.fill('input[name="ad"]', "Test Yönetici");
  await s.fill('input[name="kullanici"]', "yonetici");
  await s.fill('input[name="sifre"]', "sifre123");
  await s.click('button[type="submit"]');
  await s.waitForURL(`${ADRES}/`, { timeout: 15000 });
  kontrol(await s.getByText("Test Yönetici").isVisible(), "kurulum sonrası hub açılır ve oturum başlar");

  /* Kurulum bir kez olur: tamamlandıktan sonra kapı kapanmalı, yoksa
     herkes kendine yönetici hesabı açardı. */
  await s.goto(`${ADRES}/kurulum`, { waitUntil: "networkidle" });
  // Girişli kullanıcı /kurulum → /giris → "/" zincirini yürür; ölçüt kurulum
  // sayfasında KALMAMASI.
  kontrol(!s.url().includes("/kurulum"), "kurulum tamamlandıktan sonra kurulum sayfası kapanır");

  /* 2. Eğitim oluştur */
  await s.goto(`${ADRES}/egitimler`, { waitUntil: "networkidle" });
  await s.fill('input[name="ad"]', "Yüksekte Çalışma");
  await s.click('button:has-text("Oluştur")');
  await s.waitForURL(/\/egitimler\/egt_/, { timeout: 15000 });
  const egitimYolu = new URL(s.url()).pathname;
  kontrol(true, "eğitim oluşturuldu ve editör açıldı");

  /* Yayına hazır olmadan yayınlanamamalı: sayfası olmayan bir eğitim
     kiosk'ta boş ekran demektir. */
  kontrol(await s.locator('button:has-text("Yayınla")').isDisabled(), "sayfasız eğitim yayınlanamaz");

  /* 3. İçerik ekle */
  await s.click('button:has-text("Kural kartı")');
  await s.waitForTimeout(800);
  const baslikAlani = s.locator('input[placeholder="Başlık"]').first();
  await baslikAlani.fill("Emniyet kemeri zorunludur");
  await baslikAlani.blur();
  await s.waitForTimeout(800);

  await s.click('button:has-text("Tehlike uyarısı")');
  await s.waitForTimeout(800);
  const ikinciBaslik = s.locator('input[placeholder="Başlık"]').nth(1);
  await ikinciBaslik.fill("2 metrenin üstü yüksektir");
  await ikinciBaslik.blur();
  await s.waitForTimeout(800);
  kontrol((await s.locator('input[placeholder="Başlık"]').count()) === 2, "iki içerik kartı eklendi");

  /* Asgari süreyi kısalt — sınav varsayılan 8 sn'yi beklemesin.
     İLK sayfa bilerek 4 sn: 1 sn olsaydı sayfa yüklenene kadar süre çoktan
     dolar ve "kilitli mi" ölçümü hiçbir şey kanıtlamazdı. */
  const sureAlanlari = await s.locator('input[type="number"][class*="w-20"]').all();
  for (let i = 0; i < sureAlanlari.length; i++) {
    await sureAlanlari[i].fill(i === 0 ? "4" : "1");
    await sureAlanlari[i].blur();
    await s.waitForTimeout(400);
  }

  /* 4. Soru ekle */
  await s.click('button:has-text("Doğru / Yanlış")');
  await s.waitForTimeout(800);
  const soruMetni = s.locator('textarea[placeholder="Soru metni"]').first();
  await soruMetni.fill("Yüksekte çalışırken emniyet kemeri takılır.");
  await soruMetni.blur();
  await s.waitForTimeout(800);
  kontrol(await s.getByText("Doğru / Yanlış").first().isVisible(), "soru havuza eklendi");

  /* Sınavdaki soru sayısını havuzla eşitle (varsayılan 5, havuzda 1 var). */
  await s.click('button[aria-expanded]');
  await s.waitForTimeout(500);
  await s.getByLabel("Sınavdaki soru sayısı").fill("1");
  await s.getByLabel("Sınavdaki soru sayısı").blur();
  await s.waitForTimeout(800);

  /* 4b. REHBER — açılışta çöküyor mu?
     Bu adım bir hatanın bedelini ödeyerek eklendi: rehber içeriğindeki bir
     sabit kullanıldığı yerin altında tanımlıydı, modül yüklenirken geçici
     ölü bölgeye düşüyor ve rehber açılır açılmaz TÜM SAYFA "Application
     error" ile çöküyordu. Derleme ve tip denetimi sessiz kaldı; ekranı
     açmayan hiçbir sınav da göremezdi. */
  await s.click('button[aria-label="Kullanım rehberi"]');
  await s.waitForTimeout(1200);
  kontrol(await s.getByText("FlowTrain rehberi").isVisible(), "rehber çekmecesi açılıyor (çökmüyor)");
  kontrol(await s.getByText("Eğitim hazırlama").first().isVisible(), "derin link ilgili bölümü açtı");
  kontrol(
    await s.getByText("Tehlike uyarısı").first().isVisible(),
    "kart tipi tablosu ürünün kendi sabitinden türüyor",
  );
  await s.keyboard.press("Escape");
  await s.waitForTimeout(500);
  kontrol(!(await s.getByText("FlowTrain rehberi").isVisible()), "ESC ile kapanıyor");

  /* 5. Prova — kayıt DÜŞMEMELİ */
  await s.click('button:has-text("Dene")');
  await s.waitForTimeout(600);
  kontrol(await s.getByText("Prova — kayıt düşmez").isVisible(), "▶ Dene provayı açar ve kayıt düşmediğini söyler");
  await s.locator('button[aria-label="Çık"]').click();
  await s.waitForTimeout(400);

  /* 6. Yayınla */
  await s.click('button:has-text("Yayınla")');
  await s.waitForTimeout(2000);
  kontrol(await s.getByText(/Yayında/).first().isVisible(), "eğitim yayına alındı");

  /* YAYINDAKİ EĞİTİM SALT OKUNUR: kayıtlar "sürüm N"e atıf yapıyor; içeriği
     yerinde değiştirmek insanların kayıtta yazandan başka bir şeyden sınav
     olmuş görünmesi demek. */
  kontrol(await s.getByText("Yayında — düzenleme kapalı.").isVisible(), "yayındaki eğitim kilitli uyarısı çıkıyor");
  kontrol(await s.locator('input[placeholder="Başlık"]').first().isDisabled(), "yayındayken içerik alanları kapalı");
  kontrol(await s.locator('button:has-text("Kural kartı")').isDisabled(), "yayındayken kart eklenemiyor");

  /* 7. Atama kuralı — Kaynak bölümü */
  await s.goto(`${ADRES}/atama`, { waitUntil: "networkidle" });
  kontrol(await s.getByText("4 kişi listede").isVisible(), "personel CSV'si okundu (4 kişi)");

  await s.selectOption('select[name="egitimId"]', { label: "Yüksekte Çalışma" });
  await s.getByRole("button", { name: "Kaynak", exact: true }).click();
  await s.click('button:has-text("Kuralı ekle")');
  await s.waitForTimeout(2000);
  kontrol(await s.getByText("3 kişi").first().isVisible(), "kural Kaynak bölümündeki 3 kişiyi kapsıyor");

  /* 8. KİOSK — hesapsız, ayrı tarayıcı bağlamında (çerez taşınmasın) */
  const kioskBaglam = await tarayici.newContext({ viewport: { width: 1024, height: 1366 } });
  const k = await kioskBaglam.newPage();
  k.on("pageerror", (e) => console.log(`  ⚠ kiosk hatası: ${e.message.slice(0, 120)}`));

  await k.goto(`${ADRES}/kiosk`, { waitUntil: "networkidle" });
  kontrol(k.url().endsWith("/kiosk"), "kiosk giriş istemez (oturumsuz açılır)");

  /* Listede olmayan sicil reddedilmeli. */
  await k.fill('input[aria-label="Sicil numarası"]', "7777");
  await k.click('button:has-text("Devam")');
  await k.waitForTimeout(1500);
  kontrol(await k.getByText(/personel listesinde bulunamadı/).isVisible(), "tanınmayan sicil reddedilir");

  await k.fill('input[aria-label="Sicil numarası"]', "1001");
  await k.click('button:has-text("Devam")');
  await k.waitForTimeout(1500);
  kontrol(await k.getByText("Ali Yılmaz").isVisible(), "sicil tanındı, kişi karşılandı");
  kontrol(await k.getByText("Yüksekte Çalışma").isVisible(), "atanan eğitim kioskta listelendi");

  /* Montaj bölümündeki kişiye bu eğitim DÜŞMEMELİ. */
  await k.click('button:has-text("Bitir")');
  await k.waitForTimeout(500);
  await k.fill('input[aria-label="Sicil numarası"]', "1003");
  await k.click('button:has-text("Devam")');
  await k.waitForTimeout(1500);
  kontrol(await k.getByText("Bekleyen eğitiminiz yok").isVisible(), "kapsam dışı bölüm eğitimi görmez");

  /* 9. Eğitimi tamamla */
  await k.click('button:has-text("Bitir")');
  await k.waitForTimeout(500);
  await k.fill('input[aria-label="Sicil numarası"]', "1001");
  await k.click('button:has-text("Devam")');
  await k.waitForTimeout(1500);
  await k.click('button:has-text("Başla")');
  await k.waitForTimeout(1500);

  /* ASGARİ SÜRE: buton başta kilitli olmalı. */
  const ileri = k.locator("button.kiosk-btn-primary").first();
  kontrol(await ileri.isDisabled(), "asgari süre dolmadan İleri kilitli");
  kontrol(/\d+ sn/.test((await ileri.textContent()) ?? ""), "kilitli düğme kalan süreyi gösterir");
  await k.waitForTimeout(5000);
  kontrol(await ileri.isEnabled(), "süre dolunca İleri açılır");

  await ileri.click();
  await k.waitForTimeout(2500);
  await k.locator("button.kiosk-btn-primary").first().click(); // ikinci sayfa → sınav
  await k.waitForTimeout(1200);
  kontrol(await k.getByText(/Soru 1\/1/).isVisible(), "içerik bitince sınav başlar");

  await k.getByRole("button", { name: /Doğru/ }).first().click();
  await k.waitForTimeout(400);
  await k.locator("button.kiosk-btn-primary").first().click(); // Bitir
  await k.waitForTimeout(1200);
  kontrol(await k.getByText("Kendinize bir PIN belirleyin").isVisible(), "ilk kez giren kişi PIN belirler");

  /* PIN doğrulaması: uyuşmayan PIN reddedilmeli. */
  const pinAlanlari = k.locator('input[inputmode="numeric"]');
  await pinAlanlari.nth(0).fill("1234");
  await pinAlanlari.nth(1).fill("9999");
  await k.click('button:has-text("Onayla ve bitir")');
  await k.waitForTimeout(800);
  kontrol(await k.getByText("İki PIN aynı değil.").isVisible(), "uyuşmayan PIN reddedilir");

  /* İLK PIN'DE İŞE GİRİŞ TARİHİ: başkasının sicilini girip onun imzasını
     belirlemeyi zorlaştıran tek seferlik kontrol. */
  await pinAlanlari.nth(1).fill("1234");
  kontrol(await k.getByText("İşe giriş tarihiniz").isVisible(), "ilk PIN'de işe giriş tarihi sorulur");
  await pinAlanlari.nth(2).fill("01.01.2000");
  await k.click('button:has-text("Onayla ve bitir")');
  await k.waitForTimeout(1500);
  kontrol(await k.getByText(/İşe giriş tarihi eşleşmedi/).isVisible(), "yanlış işe giriş tarihi reddedilir");

  /* YANLIŞ TARİH OTURUMU YAKAR: PIN'i olmayan kişide sayaç tutacak bir satır
     yok, dolayısıyla açık kalan bir oturumda tarih sınırsız denenebilirdi.
     Kişi baştan başlar; iptal oturumlar deneme hakkını yemez. */
  await k.click('button[aria-label="Çık"]');
  await k.waitForTimeout(800);
  await k.fill('input[aria-label="Sicil numarası"]', "1001");
  await k.click('button:has-text("Devam")');
  await k.waitForTimeout(1500);
  kontrol(await k.getByText("Yüksekte Çalışma").isVisible(), "iptal oturum deneme hakkını yakmaz");
  await k.click('button:has-text("Başla")');
  await k.waitForTimeout(5500);
  await k.locator("button.kiosk-btn-primary").first().click();
  await k.waitForTimeout(2500);
  await k.locator("button.kiosk-btn-primary").first().click();
  await k.waitForTimeout(1200);
  await k.getByRole("button", { name: /Doğru/ }).first().click();
  await k.waitForTimeout(400);
  await k.locator("button.kiosk-btn-primary").first().click();
  await k.waitForTimeout(1200);

  // Personel dosyasında 2026-08-01 yazıyor; kullanıcı GG.AA.YYYY giriyor —
  // biçim farkı yüzünden kimse dışarıda kalmamalı.
  const pin2Alanlari = k.locator('input[inputmode="numeric"]');
  await pin2Alanlari.nth(0).fill("1234");
  await pin2Alanlari.nth(1).fill("1234");
  await pin2Alanlari.nth(2).fill("01.08.2026");
  await k.click('button:has-text("Onayla ve bitir")');
  await k.waitForTimeout(3000);
  kontrol(await k.getByText("Tebrikler, geçtiniz").isVisible(), "sınav geçildi ve sonuç gösterildi");

  /* 9b. VAR OLAN PIN: yanlış girilirse kayıt kapanmamalı. */
  await s.goto(`${ADRES}/egitimler`, { waitUntil: "networkidle" });
  await s.fill('input[name="ad"]', "İkinci Eğitim");
  await s.click('button:has-text("Oluştur")');
  await s.waitForURL(/\/egitimler\/egt_/, { timeout: 15000 });
  await s.click('button:has-text("Kural kartı")');
  await s.waitForTimeout(900);
  const ikBaslik = s.locator('input[placeholder="Başlık"]').first();
  await ikBaslik.fill("Kısa kart");
  await ikBaslik.blur();
  await s.waitForTimeout(700);
  const ikSure = s.locator('input[type="number"][class*="w-20"]').first();
  await ikSure.fill("1");
  await ikSure.blur();
  await s.waitForTimeout(700);
  await s.click('button:has-text("Yayınla")');
  await s.waitForTimeout(2000);

  await s.goto(`${ADRES}/atama`, { waitUntil: "networkidle" });
  await s.selectOption('select[name="egitimId"]', { label: "İkinci Eğitim" });
  await s.getByRole("button", { name: "Kaynak", exact: true }).click();
  await s.click('button:has-text("Kuralı ekle")');
  await s.waitForTimeout(2000);

  await k.click('button:has-text("Bitir")');
  await k.waitForTimeout(500);
  await k.fill('input[aria-label="Sicil numarası"]', "1001");
  await k.click('button:has-text("Devam")');
  await k.waitForTimeout(1500);
  await k.click('button:has-text("Başla")');
  await k.waitForTimeout(3500);
  await k.locator("button.kiosk-btn-primary").first().click();
  await k.waitForTimeout(1200);
  kontrol(!(await k.getByText("Kendinize bir PIN belirleyin").isVisible()), "PIN'i olan kişiye yeniden kurdurulmaz");
  await k.locator('input[inputmode="numeric"]').first().fill("0000");
  await k.click('button:has-text("Onayla ve bitir")');
  await k.waitForTimeout(1500);
  kontrol(await k.getByText("PIN hatalı.").isVisible(), "yanlış PIN reddedilir, oturum kapanmaz");
  await k.locator('input[inputmode="numeric"]').first().fill("1234");
  await k.click('button:has-text("Onayla ve bitir")');
  await k.waitForTimeout(3000);
  // Sınavsız eğitim = "okudum, onaylıyorum": içeriği görüp imzalayan kişi
  // tamamlamış sayılır, yoksa tamamlanması imkânsız bir eğitim olurdu.
  kontrol(await k.getByText("Tamamlandı").isVisible(), "sınavsız eğitim imzayla tamamlanır");

  /* 10. Kayıt gerçekten düştü mü — dosya + pano */
  const kayitDosyasi = join(veri, "kayitlar.csv");
  kontrol(existsSync(kayitDosyasi), "kayıt dosyası oluşturuldu (dış hedefe gönderim)");
  if (existsSync(kayitDosyasi)) {
    const icerik = readFileSync(kayitDosyasi, "utf8");
    kontrol(icerik.includes("1001"), "kayıt dosyasında sicil var");
    kontrol(icerik.startsWith("﻿"), "kayıt dosyası BOM ile başlıyor (Excel doğru açar)");
    kontrol(icerik.includes("gecti"), "kayıt dosyasında sonuç var");
  }

  /* Aynı kişi aynı eğitimi tekrar göremez. */
  await k.click('button:has-text("Bitir")');
  await k.waitForTimeout(500);
  await k.fill('input[aria-label="Sicil numarası"]', "1001");
  await k.click('button:has-text("Devam")');
  await k.waitForTimeout(1500);
  kontrol(await k.getByText("Bekleyen eğitiminiz yok").isVisible(), "geçilen eğitim tekrar listelenmez");

  /* 11. Pano */
  await s.goto(`${ADRES}/pano`, { waitUntil: "networkidle" });
  kontrol(await s.getByText("33%").isVisible(), "panoda tamamlanma oranı doğru (3 atamanın 1'i tamam)");
  kontrol(await s.getByText("Kaynak").first().isVisible(), "bölüm kırılımı görünüyor");

  /* 12. CSV dışa aktarma — TAM liste */
  const csv = await s.request.get(`${ADRES}/api/disa-aktar`);
  const csvMetin = await csv.text();
  kontrol(csv.ok(), "CSV dışa aktarma çalışıyor");
  kontrol(csvMetin.includes("1001") && csvMetin.includes("1002"), "dışa aktarma tam listeyi verir (tamam olan da)");
  kontrol(csvMetin.split("\r\n").length >= 4, "CSV'de başlık + 3 satır var");

  /* 13. Yetki kapısı: giriş yapmamış biri kokpite giremez */
  const yabanci = await tarayici.newContext();
  const y = await yabanci.newPage();
  await y.goto(`${ADRES}/pano`, { waitUntil: "networkidle" });
  kontrol(y.url().includes("/giris"), "oturumsuz kullanıcı kokpit sayfasından girişe atılır");
  kontrol(y.url().includes("next=%2Fpano"), "giriş kapısı hedefi taşır (next=/pano)");

  /* 13b. ROL KAPISI: hazırlayan amir yüzeyine giremez. */
  await s.goto(`${ADRES}/ayarlar`, { waitUntil: "networkidle" });
  await s.fill('input[name="ad"]', "Hazırlayan Kişi");
  await s.fill('input[name="kullanici"]', "hazir");
  await s.fill('input[name="sifre"]', "sifre123");
  await s.selectOption('select[name="rol"]', "hazirlayan");
  await s.click('button:has-text("Hesap ekle")');
  await s.waitForTimeout(2000);
  kontrol(await s.getByText("Hazırlayan Kişi").isVisible(), "yeni hesap açıldı");

  const hazirBaglam = await tarayici.newContext();
  const hz = await hazirBaglam.newPage();
  await hz.goto(`${ADRES}/giris`, { waitUntil: "networkidle" });
  await hz.fill('input[name="kullanici"]', "hazir");
  await hz.fill('input[name="sifre"]', "sifre123");
  await hz.click('button[type="submit"]');
  await hz.waitForURL(`${ADRES}/`, { timeout: 15000 });
  kontrol(!(await hz.getByText("Ekibim").isVisible()), "hazırlayan hub'da amir kartını görmez");
  await hz.goto(`${ADRES}/ekibim`, { waitUntil: "networkidle" });
  kontrol(hz.url().includes("yetki=yok"), "hazırlayan amir sayfasından geri çevrilir");
  await hz.goto(`${ADRES}/ayarlar`, { waitUntil: "networkidle" });
  kontrol(hz.url().includes("yetki=yok"), "hazırlayan yönetici sayfasından geri çevrilir");

  /* 13c. Silinen hesap ANINDA yetkisini kaybeder (çerez 12 saat geçerli olsa da). */
  await s.goto(`${ADRES}/ayarlar`, { waitUntil: "networkidle" });
  await s.locator('button[aria-label="Hesabı sil"]').last().click();
  await s.waitForTimeout(400);
  await s.getByRole("button", { name: "Devam" }).click();
  await s.waitForTimeout(2000);
  await hz.goto(`${ADRES}/egitimler`, { waitUntil: "networkidle" });
  kontrol(hz.url().includes("/giris"), "silinen hesap anında girişe atılır (rol çerezden okunmuyor)");

  /* 14. Ayarlar — kurulumun gerçeği */
  await s.goto(`${ADRES}/ayarlar`, { waitUntil: "networkidle" });
  kontrol(await s.getByText("4 kişi").first().isVisible(), "ayarlarda personel dosyası durumu görünüyor");
  kontrol(await s.getByText(/%75/).isVisible(), "amir sütunu doluluk oranı hesaplanıyor (4 kişinin 3'ünde amir var)");
  kontrol(await s.getByText("Ali Yılmaz").isVisible(), "PIN kayıtları listesinde kişi adıyla görünüyor");

  await tarayici.close();
  bitir();
} catch (h) {
  console.error("\n✗ Akış koptu:", h.message);
  hata++;
  bitir(1);
}
