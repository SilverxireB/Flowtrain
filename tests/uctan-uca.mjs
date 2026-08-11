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

/**
 * Sunucu, Next'in JS giriş noktası NODE ile koşularak başlatılır.
 *
 * `node_modules/.bin/next` çağrılmıyordu: o yol Unix'te bir kabuk betiği,
 * Windows'ta ise karşılığı `next.cmd`dir ve `spawn` uzantısız adı bulamayıp
 * `ENOENT` atıyordu — sınav Windows'ta hiç koşamıyordu. Paketin kendi
 * `dist/bin/next` dosyası her iki işletim sisteminde de aynı yerde duruyor,
 * kabuk aracılığına da gerek kalmıyor (`shell: true` argümanları kabuğa
 * ayrıştırtır, boşluklu yollarda ayrı bir tuzaktır).
 */
const nextGiris = join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
const sunucu = spawn(process.execPath, [nextGiris, "start", "-p", String(PORT)], {
  env: { ...process.env, FLOWTRAIN_DATA: veri, NODE_ENV: "production" },
  stdio: ["ignore", "pipe", "pipe"],
});
sunucu.stderr.on("data", (d) => {
  const s = String(d);
  if (!s.includes("Warning")) process.stderr.write(`[sunucu] ${s}`);
});

/**
 * Kart ekleme — GERÇEK KULLANICI YOLU.
 *
 * Kart tipi beşten ona çıkınca düz düğme sırası gruplu bir panele indi;
 * eskiden tip düğmesine doğrudan tıklanıyordu. Panelin kendisi de sınavın
 * konusu: açılmazsa kart eklemenin BAŞKA yolu yok.
 */
async function kartEkle(s, tipEtiketi) {
  await s.click('button:has-text("Kart ekle")');
  await s.waitForTimeout(200);
  await s.click(`button:has-text("${tipEtiketi}")`);
  await s.waitForTimeout(400);
}

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
  await kartEkle(s, "Kural kartı");
  await s.waitForTimeout(800);
  const baslikAlani = s.locator('input[placeholder="Başlık"]').first();
  await baslikAlani.fill("Emniyet kemeri zorunludur");
  await baslikAlani.blur();
  await s.waitForTimeout(800);

  await kartEkle(s, "Tehlike uyarısı");
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

  /* Sınavdaki soru sayısını havuzla eşitle (varsayılan 5, havuzda 1 var).

     GERÇEK KULLANICI YOLU izleniyor: uyarının kendi bağlantısına tıklanıyor.
     Böylece hem alan açılıyor hem de "sorunu gören kişi çözüme ulaşabiliyor
     mu" sorusu sınavlanmış oluyor. Eskiden `button[aria-expanded]` ile
     sayfadaki İLK katlanır düğme seçiliyordu; editöre yeni katlanır bölümler
     eklendikçe sessizce yanlış düğmeye tıklamaya başladı. */
  kontrol(
    await s.getByRole("button", { name: "Sınav ayarlarını aç" }).isVisible(),
    "havuz uyarısı çözüme bağlantı veriyor",
  );
  await s.getByRole("button", { name: "Sınav ayarlarını aç" }).click();
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
  await s.locator('button[aria-label="Eğitimden çık"]').click();
  await s.waitForTimeout(400);

  /* 6. Yayınla */
  await s.click('button:has-text("Yayınla")');
  await s.waitForTimeout(2000);
  kontrol(await s.getByText(/Yayında/).first().isVisible(), "eğitim yayına alındı");

  /* YAYINDAKİ EĞİTİMİN EDİTÖRÜ AÇIK (`docs/SURUMLU-YAYIN.md`, 3. adım).
     Eskiden burada "düzenleme kapalı" ölçülüyordu: kayıtlar "sürüm N"e atıf
     yaptığı için içeriği yerinde değiştirmek denetimi bozuyordu. Artık
     düzenleme TASLAĞA yazılıyor ve sahaya çıkmıyor, dolayısıyla kilide gerek
     yok — kilidin bedeli, tek harflik bir düzeltme için eğitimi kiosktan
     düşürmekti. */
  kontrol(await s.getByText("Yayında ve sahayla aynı.").isVisible(), "yayındayken taslağın sahayla aynı olduğu yazıyor");
  kontrol(await s.locator('input[placeholder="Başlık"]').first().isEnabled(), "yayındayken içerik alanları AÇIK");
  kontrol(await s.locator('button:has-text("Kart ekle")').isEnabled(), "yayındayken kart eklenebiliyor");
  kontrol(
    await s.locator('button:has-text("Yayınla")').isDisabled(),
    "değişiklik yokken Yayınla kapalı (ikizi olan sürüm üretilmez)",
  );

  /* 7. Atama kuralı — Kaynak bölümü */
  await s.goto(`${ADRES}/atama`, { waitUntil: "networkidle" });
  kontrol(await s.getByText("4 kişi listede").isVisible(), "personel CSV'si okundu (4 kişi)");

  await s.selectOption('select[name="hedefId"]', { label: "Yüksekte Çalışma" });
  await s.getByRole("button", { name: "Kaynak", exact: true }).click();
  await s.click('button:has-text("Atamayı ekle")');
  await s.waitForTimeout(2000);
  kontrol(await s.getByText("3 kişi").first().isVisible(), "kural Kaynak bölümündeki 3 kişiyi kapsıyor");

  /* 8. KİOSK — hesapsız, ayrı tarayıcı bağlamında (çerez taşınmasın) */
  const kioskBaglam = await tarayici.newContext({ viewport: { width: 1024, height: 1366 } });
  const k = await kioskBaglam.newPage();
  k.on("pageerror", (e) => console.log(`  ⚠ kiosk hatası: ${e.message.slice(0, 120)}`));
  /* Kiosk ÖNE ALINIYOR: asgari süre sayacı, sekme görünür değilken bilerek
     durur ("telefonu cebe koyup beklemek izlemek değildir"). Kokpit sekmesi
     açık kalınca kiosk arka planda sayılıyor ve sayaç hiç işlemiyordu — ürün
     doğru davranıyor, sınav gerçek tabletin durumunu taklit etmiyordu. */
  await k.bringToFront();

  await k.goto(`${ADRES}/kiosk`, { waitUntil: "networkidle" });
  kontrol(k.url().endsWith("/kiosk"), "kiosk giriş istemez (oturumsuz açılır)");

  /* Listede olmayan sicil reddedilmeli. */
  await k.fill('#kiosk-sicil', "7777");
  await k.click('button:has-text("Devam")');
  await k.waitForTimeout(1500);
  kontrol(await k.getByText(/personel listesinde bulunamadı/).isVisible(), "tanınmayan sicil reddedilir");

  await k.fill('#kiosk-sicil', "1001");
  await k.click('button:has-text("Devam")');
  await k.waitForTimeout(1500);
  kontrol(await k.getByText("Ali Yılmaz").isVisible(), "sicil tanındı, kişi karşılandı");
  kontrol(await k.getByText("Yüksekte Çalışma").isVisible(), "atanan eğitim kioskta listelendi");

  /* Montaj bölümündeki kişiye bu eğitim DÜŞMEMELİ. */
  await k.click('button:has-text("Bitir")');
  await k.waitForTimeout(500);
  await k.fill('#kiosk-sicil', "1003");
  await k.click('button:has-text("Devam")');
  await k.waitForTimeout(1500);
  kontrol(await k.getByText("Bekleyen eğitiminiz yok").isVisible(), "kapsam dışı bölüm eğitimi görmez");

  /* 9. Eğitimi tamamla */
  await k.click('button:has-text("Bitir")');
  await k.waitForTimeout(500);
  await k.fill('#kiosk-sicil', "1001");
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

  await k.getByRole("radio", { name: /Doğru/ }).first().click();
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
  await k.click('button[aria-label="Eğitimden çık"]');
  await k.waitForTimeout(800);
  await k.fill('#kiosk-sicil', "1001");
  await k.click('button:has-text("Devam")');
  await k.waitForTimeout(1500);
  kontrol(await k.getByText("Yüksekte Çalışma").isVisible(), "iptal oturum deneme hakkını yakmaz");
  await k.click('button:has-text("Başla")');
  await k.waitForTimeout(5500);
  await k.locator("button.kiosk-btn-primary").first().click();
  await k.waitForTimeout(2500);
  await k.locator("button.kiosk-btn-primary").first().click();
  await k.waitForTimeout(1200);
  await k.getByRole("radio", { name: /Doğru/ }).first().click();
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
  await kartEkle(s, "Kural kartı");
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
  await s.selectOption('select[name="hedefId"]', { label: "İkinci Eğitim" });
  await s.getByRole("button", { name: "Kaynak", exact: true }).click();
  await s.click('button:has-text("Atamayı ekle")');
  await s.waitForTimeout(2000);

  await k.click('button:has-text("Bitir")');
  await k.waitForTimeout(500);
  await k.fill('#kiosk-sicil', "1001");
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
  await k.fill('#kiosk-sicil', "1001");
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

  /* ══════════════════════════════════════════════════════════════════════════
     BURADAN SONRASI: birinci dalgada HİÇ AÇILMAYAN yüzeyler.
     `/kayitlar`, `/kayitlar/sinif`, `/kayitlar/aktarim`, `/gruplar`,
     `/egitimler/qr`, `/kiosk?egitim=`, `/personel` — hepsi kokpitin gerçek
     iş yüzeyleri ve hiçbiri bu zincirde bir kez bile çizilmiyordu. Ekranı
     açmayan bir sınav, ekranın çöktüğünü göremez (rehber çekmecesi hatası tam
     olarak böyle kaçmıştı).

     SIRA ÖNEMLİ: `/personel` EN SONDA, çünkü maliyet merkezi eşlemesi kişinin
     BÖLÜMÜNÜ değiştiriyor ve bölüm değişince atama kuralları başka kişileri
     kapsar — daha önce koşan hiçbir ölçüm bundan etkilenmemeli.
     ══════════════════════════════════════════════════════════════════════════ */

  /* 15. KAYIT DEFTERİ — süzgeç, ayrıntı, CSV. */
  await s.goto(`${ADRES}/kayitlar`, { waitUntil: "networkidle" });
  kontrol(await s.getByText("Kayıt defteri").first().isVisible(), "kayıt defteri açılıyor");
  kontrol(await s.getByText("Ali Yılmaz").first().isVisible(), "kayıt satırı kişinin adıyla görünüyor");
  /* Tablonun metni ölçüme KATILIYOR: "görünmüyor" tek başına neyin yanlış
     olduğunu söylemiyor — satır hiç yok mu, adı mı farklı, süzgeç mi eliyor?
     Başarısızlıkta defterde ne olduğunu da yazdırıyoruz. */
  const defterMetni = await s.locator("table").first().innerText();
  kontrol(
    defterMetni.includes("Yüksekte Çalışma"),
    `kioskta tamamlanan eğitim deftere düşmüş${
      defterMetni.includes("Yüksekte Çalışma") ? "" : ` — defterde görünen: ${defterMetni.slice(0, 400).replace(/\s+/g, " ")}`
    }`,
  );
  /* Kayıt DÜZENLENMEZ, SİLİNMEZ (CLAUDE.md 7): defterde kalem ya da çöp kutusu
     olmamalı. Bu kural yalnız yazıyla değil, ekranın kendisiyle korunuyor. */
  kontrol(
    (await s.locator('button[aria-label*="sil"], button[aria-label*="düzenle"]').count()) === 0,
    "defterde düzenle/sil düğmesi YOK",
  );
  kontrol(await s.getByText("Kayıtlar düzenlenmez ve silinmez.").isVisible(), "değişmezlik ekranda yazıyor");

  await s.getByLabel("Sonuç süzgeci").selectOption("kaldi");
  await s.waitForTimeout(400);
  kontrol(await s.getByText("Bu süzgeçle eşleşen kayıt yok.").isVisible(), "süzgeç çalışıyor (kalan kimse yok)");
  await s.getByLabel("Sonuç süzgeci").selectOption("gecti");
  await s.waitForTimeout(400);
  kontrol(await s.getByText("Ali Yılmaz").first().isVisible(), "süzgeç geçenleri geri getiriyor");
  await s.click('button:has-text("Süzgeci temizle")');
  await s.waitForTimeout(400);

  /* Kayıt ayrıntısı: belge numarası olmayan bir kaydın denetimde karşılığı yok. */
  await s.locator('button[aria-label*="kaydını aç"]').first().click();
  await s.waitForTimeout(500);
  kontrol(await s.getByText(/Kayıt no:/).isVisible(), "kayıt ayrıntısı belge numarasını gösteriyor");
  await s.getByRole("button", { name: "Kapat" }).click();
  await s.waitForTimeout(300);

  /* CSV GERÇEKTEN İNİYOR mu: düğmenin varlığı değil, dosyanın kendisi ölçülüyor. */
  let defterCsv = "";
  let defterCsvAdi = "";
  try {
    const [indirme] = await Promise.all([
      s.waitForEvent("download", { timeout: 15000 }),
      s.getByRole("button", { name: "CSV" }).click(),
    ]);
    defterCsvAdi = indirme.suggestedFilename();
    const yol = await indirme.path();
    if (yol) defterCsv = readFileSync(yol, "utf8");
  } catch {
    /* indirme gelmedi — aşağıdaki doğrulamalar düşer ve sebebi görünür */
  }
  kontrol(defterCsvAdi.includes("kayit-defteri"), "kayıt defteri CSV olarak iniyor");
  kontrol(defterCsv.includes("1001"), "inen CSV kayıtları taşıyor");
  kontrol(defterCsv.startsWith("﻿"), "inen CSV BOM ile başlıyor (Excel doğru açar)");
  kontrol(defterCsv.includes("Kayıt no"), "inen CSV belge numarası sütunu taşıyor");

  /* 16. SINIF EĞİTİMİ TOPLU KAYDI — kart döndürmeden yazılan kayıt.
     Her eğitim kioskta verilmez; sınıfta anlatılan da AYNI deftere düşmeli,
     yoksa panonun tamamlanma oranı gerçeği göstermez. */
  await s.goto(`${ADRES}/kayitlar/sinif`, { waitUntil: "networkidle" });
  kontrol(await s.getByText("Sınıf eğitimi kaydı").first().isVisible(), "sınıf kaydı sayfası açılıyor");

  await s.getByRole("combobox").first().selectOption({ label: "Yüksekte Çalışma" });
  await s.waitForTimeout(300);
  await s.fill('input[placeholder="Dersi veren kişi"]', "Veli Usta");
  await s.locator("textarea").first().fill("1002 Ayşe Demir\n1003 Mehmet Öz\n7777 Listede Yok\n1002");
  await s.click('button:has-text("Listeyi denetle")');
  await s.waitForTimeout(1500);

  /* DENETİM ADIMI ÖNCE: otuz kişilik listede tek harf hatası olan sicil
     sessizce atlanırsa eğitmen "girdim" sanır. */
  kontrol(await s.getByText(/2 satır yazılacak/).isVisible(), "denetim kaç satırın yazılacağını söylüyor");
  kontrol(await s.getByText(/Atlanan 2 satır/).isVisible(), "atlanan satırlar sayısıyla listeleniyor");
  kontrol(
    await s.getByText("Sicil personel listesinde yok.").first().isVisible(),
    "tanınmayan sicilin GEREKÇESİ yazıyor",
  );
  kontrol(
    await s.getByText("Bu kişi için bu tarihte kayıt zaten var.").first().isVisible(),
    "listede iki kez geçen sicil gerekçesiyle atlanıyor",
  );

  await s.getByRole("button", { name: /^Kaydet/ }).click();
  await s.waitForTimeout(500);
  await s.getByRole("alertdialog").getByRole("button", { name: "Kaydet" }).click();
  await s.waitForTimeout(2500);
  /* ⚠ BİLİNEN AÇIK (11 Ağustos 2026) — sürümlü yayınla İLGİSİZ, düşük öncelikli.
     Kaydet'ten sonra özet paneli HİÇ çıkmıyor ve form baştan sona sıfırlanıyor
     (eğitim seçimi bile "Seçin…"e dönüyor). Ölçüldü: panel 700 ms'de de
     2500 ms'de de yok, yani geç gelme değil — `sinifKaydetEylem` raporu doğru
     döndürüyor ama `tazele()` + `router.refresh()` sonrası bileşen yeniden
     kuruluyor ve yerel `rapor` durumu siliniyor.
     ZARAR: eğitmen otuz kişilik listeyi kaydeder ve hiçbir onay görmez.
     Kayıtlar YAZILIYOR — hemen aşağıdaki defter denetimleri bunu gösteriyor.
     Bu satır bilerek KIRMIZI bırakıldı: geçecek şekilde gevşetmek, gerçek
     bir kullanıcı sorununu sınavın içine gömmek olurdu. */
  kontrol(await s.getByText(/2 kayıt deftere yazıldı/).isVisible(), "sınıf kayıtları gerçekten yazıldı");

  /* Kayıt DEFTERDE ve KAYNAĞI doğru: sınıf kaydı kioskta yapılmış gibi
     görünmemeli — süre/anomali ölçüsü ikisini karıştırırsa pano yalan söyler. */
  await s.goto(`${ADRES}/kayitlar`, { waitUntil: "networkidle" });
  await s.getByLabel("Kaynak süzgeci").selectOption("sinif");
  await s.waitForTimeout(500);
  kontrol(await s.getByText("Ayşe Demir").first().isVisible(), "sınıf kaydı defterde görünüyor");
  kontrol(await s.getByText("Mehmet Öz").first().isVisible(), "listedeki ikinci katılımcı da defterde");
  kontrol(
    (await s.getByText("Sınıf eğitimi").count()) >= 2,
    "kayıtlar 'Sınıf eğitimi' kaynağıyla işaretli",
  );
  kontrol(await s.getByText("Veli Usta").first().isVisible(), "kaydın arkasındaki eğitmen defterde duruyor");

  /* 17. GEÇMİŞ KAYIT AKTARIMI — canlıya geçişin şartı. */
  await s.goto(`${ADRES}/kayitlar/aktarim`, { waitUntil: "networkidle" });
  kontrol(await s.getByText("Geçmiş kayıt aktarımı").first().isVisible(), "geçmiş kayıt aktarımı sayfası açılıyor");
  await s
    .locator("textarea")
    .first()
    .fill(
      "Sicil;Eğitim;Tarih;Puan;Eğitmen\r\n" +
        "1002;İkinci Eğitim;12.03.2024;85;Dış Eğitmen\r\n" +
        "7777;İkinci Eğitim;12.03.2024;90;Dış Eğitmen\r\n" +
        "1003;Olmayan Eğitim;12.03.2024;70;Dış Eğitmen\r\n" +
        "1003;İkinci Eğitim;bozuk tarih;70;Dış Eğitmen\r\n",
    );
  await s.click('button:has-text("Denetle")');
  await s.waitForTimeout(1500);
  kontrol(await s.getByText("Okunan sütunlar").isVisible(), "hangi sütunun nasıl okunduğu ekranda");
  kontrol(await s.getByText(/1 satır yazılacak/).isVisible(), "aktarımda yalnız geçerli satır sayılıyor");
  kontrol(await s.getByText(/Atlanan 3 satır/).isVisible(), "atlanan satırlar gerekçeleriyle listeleniyor");
  kontrol(
    await s.getByText("Eğitim adı katalogda eşleşmedi.").first().isVisible(),
    "katalogda olmayan eğitimin gerekçesi yazıyor",
  );

  await s.getByRole("button", { name: /^Aktar/ }).click();
  await s.waitForTimeout(500);
  await s.getByRole("alertdialog").getByRole("button", { name: "Aktar" }).click();
  await s.waitForTimeout(2500);
  /* ⚠ Yukarıdaki sınıf kaydıyla AYNI bilinen açık: aktarımdan sonra da özet
     paneli çıkmıyor, form sıfırlanıyor. Kayıt yazılıyor (altındaki defter
     denetimleri geçiyor). Bilerek kırmızı. */
  kontrol(await s.getByText(/1 kayıt deftere yazıldı/).isVisible(), "geçmiş kayıt deftere alındı");

  await s.goto(`${ADRES}/kayitlar`, { waitUntil: "networkidle" });
  await s.getByLabel("Kaynak süzgeci").selectOption("aktarim");
  await s.waitForTimeout(500);
  const aktarimMetni = await s.locator("table").first().innerText();
  kontrol(
    aktarimMetni.includes("Dış aktarım"),
    `aktarılan kayıt 'Dış aktarım' kaynağıyla duruyor${
      aktarimMetni.includes("Dış aktarım") ? "" : ` — süzülmüş defterde: ${aktarimMetni.slice(0, 400).replace(/\s+/g, " ")}`
    }`,
  );
  kontrol(await s.getByText("Ayşe Demir").first().isVisible(), "aktarılan kayıt kişiye bağlanmış");

  /* 18. EĞİTİM PAKETİ — paket mantığının TEK gerçek sınavı: pakete yazılan
     kural, paketin ÜYELERİNİ kioskta kişiye düşürüyor mu? Paket ekranını
     açıp "1 eğitim" yazdığını görmek hiçbir şey ispat etmez. */
  await s.goto(`${ADRES}/egitimler`, { waitUntil: "networkidle" });
  await s.fill('input[name="ad"]', "Paket Eğitimi");
  await s.click('button:has-text("Oluştur")');
  await s.waitForURL(/\/egitimler\/egt_/, { timeout: 15000 });
  const paketEgitimId = new URL(s.url()).pathname.split("/").pop();
  await kartEkle(s, "Kural kartı");
  await s.waitForTimeout(900);
  const pkBaslik = s.locator('input[placeholder="Başlık"]').first();
  await pkBaslik.fill("Paketten gelen kart");
  await pkBaslik.blur();
  await s.waitForTimeout(700);
  const pkSure = s.locator('input[type="number"][class*="w-20"]').first();
  await pkSure.fill("1");
  await pkSure.blur();
  await s.waitForTimeout(700);
  await s.click('button:has-text("Yayınla")');
  await s.waitForTimeout(2000);

  await s.goto(`${ADRES}/gruplar`, { waitUntil: "networkidle" });
  kontrol(await s.getByText("Eğitim paketleri").first().isVisible(), "paket sayfası açılıyor");
  await s.fill('input[name="ad"]', "Oryantasyon");
  await s.click('button:has-text("Oluştur")');
  await s.waitForTimeout(2000);
  kontrol(await s.getByText("Oryantasyon").first().isVisible(), "paket açıldı");
  kontrol(
    await s.getByText("Kural yazılmamış — kimseye düşmüyor").isVisible(),
    "kuralsız paket kimseye düşmediğini SÖYLÜYOR",
  );
  kontrol(await s.getByText(/Paket boş/).isVisible(), "boş paketin hiçbir şey atamadığı yazıyor");

  await s.click('button:has-text("Düzenle")');
  await s.waitForTimeout(600);
  await s.locator('button:has-text("Paket Eğitimi")').first().click();
  await s.waitForTimeout(400);
  await s.getByRole("button", { name: /^Kaydet/ }).click();
  await s.waitForTimeout(2500);
  kontrol(await s.getByText("1 eğitim").first().isVisible(), "paket üyesi kaydedildi");

  /* Kural PAKETE yazılıyor — tek tek eğitimlere değil. */
  await s.goto(`${ADRES}/atama`, { waitUntil: "networkidle" });
  await s.getByRole("button", { name: "Eğitim paketi" }).click();
  await s.waitForTimeout(400);
  await s.selectOption('select[name="hedefId"]', { label: "Oryantasyon (1 eğitim)" });
  await s.getByRole("button", { name: "Montaj", exact: true }).click();
  await s.click('button:has-text("Atamayı ekle")');
  await s.waitForTimeout(2500);
  kontrol(await s.getByText(/1 paket kuralı/).isVisible(), "paket kuralı listede paket olarak ayrılıyor");

  /* ASIL ÖLÇÜM: Montaj bölümündeki 1003, daha önce "bekleyen eğitiminiz yok"
     diyordu. Paket kuralı yazıldıktan sonra paketin ÜYESİ kioskta ona düşmeli. */
  await k.goto(`${ADRES}/kiosk`, { waitUntil: "networkidle" });
  await k.fill("#kiosk-sicil", "1003");
  await k.click('button:has-text("Devam")');
  await k.waitForTimeout(2000);
  kontrol(
    await k.getByText("Paket Eğitimi").isVisible(),
    "PAKETE yazılan kural, paketin üyesini kioskta kişiye düşürüyor",
  );

  /* Paket ilerlemesi ekrana yansıyor mu (kaç kişi paketi bitirdi). */
  await s.goto(`${ADRES}/gruplar`, { waitUntil: "networkidle" });
  kontrol(await s.getByText(/kişi paketi bitirdi/).isVisible(), "paket ilerlemesi kişi sayısıyla görünüyor");

  /* 19. QR ETİKETLERİ — dijitalleşmenin anahtarı asılabilir bir etiket. */
  await s.goto(`${ADRES}/egitimler/qr`, { waitUntil: "networkidle" });
  kontrol(await s.getByText("QR etiketleri").first().isVisible(), "QR etiket sayfası açılıyor");
  /* Göreli yol telefonda AÇILMAZ; bunu basmadan önce söylemek zorundayız. */
  kontrol(
    await s.getByText("Kurulum adresi tanımlı değil.").isVisible(),
    "temel adres yokken etiket basmadan önce uyarılıyor",
  );
  const qrKareler = s.locator('svg[role="img"][aria-label*="QR kod"]');
  kontrol((await qrKareler.count()) >= 3, `yayındaki her eğitim için QR üretildi (${await qrKareler.count()})`);
  const qrYolVerisi = await qrKareler.first().locator("path").getAttribute("d");
  kontrol(!!qrYolVerisi && qrYolVerisi.length > 200, "QR matrisi gerçekten çizilmiş (boş kare değil)");
  kontrol(
    (await s.locator('svg[aria-label*="Paket Eğitimi"]').count()) === 1,
    "etiket hangi eğitimi açtığını ekran okuyucuya da söylüyor",
  );

  await s.click('button:has-text("Seçimi temizle")');
  await s.waitForTimeout(400);
  kontrol(
    await s.getByText("Yazdırılacak etiket seçin").isVisible(),
    "seçim boşalınca ne yapılacağı yazıyor",
  );

  /* QR uç noktası: kare bir görsel ama kurulumun iç ağ adresini taşıyor. */
  const qrCevap = await s.request.get(`${ADRES}/api/qr?egitim=${paketEgitimId}`);
  kontrol(qrCevap.ok() && (await qrCevap.text()).includes("<svg"), "QR uç noktası SVG üretiyor");
  const qrYabanci = await y.request.get(`${ADRES}/api/qr?egitim=${paketEgitimId}`);
  kontrol(qrYabanci.status() === 403, "QR uç noktası oturumsuz isteği reddediyor");

  /* 20. QR YOLU — `/kiosk?egitim=<id>`: liste atlanır, eğitim doğrudan açılır. */
  await k.goto(`${ADRES}/kiosk?egitim=egt_olmayan`, { waitUntil: "networkidle" });
  kontrol(
    await k.getByText(/etiketin eğitimi şu anda yayında değil/).isVisible(),
    "geçersiz QR hedefi kullanıcıya söyleniyor (sessiz kapı yok)",
  );

  const yuksekteId = egitimYolu.split("/").pop();
  await k.goto(`${ADRES}/kiosk?egitim=${yuksekteId}`, { waitUntil: "networkidle" });
  kontrol(await k.getByText("Yüksekte Çalışma").isVisible(), "QR ile gelen kişi hangi eğitimin açılacağını önden görüyor");
  kontrol(await k.getByText("Eğitimi aç").isVisible(), "QR yolunda düğme 'Eğitimi aç' oluyor");
  await k.fill("#kiosk-sicil", "1003");
  await k.click('button:has-text("Eğitimi aç")');
  await k.waitForTimeout(2500);
  kontrol(
    await k.getByText(/size atanmış görünmüyor/).isVisible(),
    "atanmamış QR eğitimi açılmıyor ama kapı NAZİKÇE kapanıyor",
  );
  kontrol(await k.getByText("Paket Eğitimi").isVisible(), "atanmamış QR'da kişinin GERÇEK bekleyenleri yine gösteriliyor");

  await k.goto(`${ADRES}/kiosk?egitim=${paketEgitimId}`, { waitUntil: "networkidle" });
  await k.fill("#kiosk-sicil", "1003");
  await k.click('button:has-text("Eğitimi aç")');
  await k.waitForTimeout(3000);
  kontrol(await k.getByText("Sayfa 1/1").isVisible(), "QR ile gelindiğinde LİSTE ATLANIYOR, eğitim doğrudan açılıyor");
  kontrol(await k.getByText("Paketten gelen kart").isVisible(), "doğrudan açılan eğitim paketin üyesi");
  await k.locator('button[aria-label="Eğitimden çık"]').click();
  await k.waitForTimeout(800);

  /* 21. PERSONEL — liste, maliyet merkezi eşlemesi, eşlemenin GERÇEKTEN
     bölüm/amir yazması. Bölüm burada değişiyor: bu yüzden en sonda. */
  await s.goto(`${ADRES}/personel`, { waitUntil: "networkidle" });
  kontrol(await s.getByText("Personel").first().isVisible(), "personel sayfası açılıyor");
  kontrol(await s.getByText("4 kayıt").first().isVisible(), "personel kaynağındaki kayıt sayısı görünüyor");
  kontrol(await s.getByText("Mehmet Öz").isVisible(), "personel listesi kişileri gösteriyor");
  // Rol yalın: herkes operatördür, YALNIZ amir yapılanlar rozet taşır.
  kontrol((await s.locator("span.chip", { hasText: "Amir" }).count()) === 1, "amir rolü listede rozetle ayrılıyor");

  await s.fill('input[placeholder="Ada, sicile veya maliyet merkezine göre ara"]', "1003");
  await s.waitForTimeout(500);
  kontrol(!(await s.getByText("Ali Yılmaz").isVisible()), "arama listeyi süzüyor");
  kontrol(await s.getByText("Mehmet Öz").isVisible(), "aranan kişi listede kalıyor");
  await s.fill('input[placeholder="Ada, sicile veya maliyet merkezine göre ara"]', "");
  await s.waitForTimeout(500);

  /* Rol yalın: bir kişi AMİR YAPILIR ve ancak o zaman eşlemede amir olarak
     seçilebilir. Ayşe'yi amir yapıyoruz ki eşlemenin yazdığı amir, personel
     dosyasında ZATEN yazan amirden (9001) FARKLI olsun — yoksa "amiri gerçekten
     eşleme mi yazdı" sorusu ölçülemez, sayı tesadüfen tutardı. */
  await s.locator('button[aria-label="Ayşe Demir kaydını düzenle"]').click();
  await s.waitForTimeout(600);
  await s.getByRole("button", { name: "Amir", exact: true }).click();
  await s.getByRole("button", { name: "Kaydet" }).last().click();
  await s.waitForTimeout(2500);
  kontrol(
    (await s.locator("span.chip", { hasText: "Amir" }).count()) === 2,
    "rolü değiştirilen kişi listede amir olarak görünüyor",
  );

  /* MALİYET MERKEZİ EŞLEMESİ VERİDİR: fabrika kendi kodunu kendi bağlar. */
  await s.fill('input[placeholder="264302"]', "264302");
  await s.locator('input[list="mm-bolum-listesi"]').fill("Boyahane");
  // Amir SEÇİLİR, yazılmaz. Kutunun adı yok; şıkkının değeriyle bulunuyor.
  await s.locator('select:has(option[value="1002"])').selectOption("1002");
  await s.getByRole("button", { name: /^Kaydet/ }).click();
  await s.waitForTimeout(2500);
  kontrol(await s.getByText("264302").first().isVisible(), "maliyet merkezi eşlemesi tanımlandı");
  kontrol(await s.getByText("Boyahane").first().isVisible(), "eşlemenin bölümü listede görünüyor");

  /* ASIL ÖLÇÜM: kişiye yalnız KOD yazılıyor; bölüm ve amir elle değil
     EŞLEMEDEN gelmeli. Mehmet dosyada "Montaj / 9001" idi. */
  await s.locator('button[aria-label="Mehmet Öz kaydını düzenle"]').click();
  await s.waitForTimeout(600);
  await s.locator('input[list="mm-listesi"]').fill("264302");
  await s.waitForTimeout(400);
  kontrol(
    await s.getByText(/Bu koddan gelen: bölüm/).isVisible(),
    "kod girilince hangi bölüm/amirin geleceği ÖNCEDEN yazıyor",
  );
  // Pencerenin kendi "Kaydet"i EN SONDA çizilir; eşleme bölümündeki aynı adlı
  // düğmeyle karışmasın diye sonuncusu alınıyor.
  await s.getByRole("button", { name: "Kaydet" }).last().click();
  await s.waitForTimeout(2500);

  const mehmetSatiri = s.locator("tr", { hasText: "Mehmet Öz" }).first();
  kontrol(await mehmetSatiri.getByText("Boyahane").isVisible(), "eşleme kişinin BÖLÜMÜNÜ gerçekten yazdı");
  kontrol(await mehmetSatiri.getByText("1002").isVisible(), "eşleme kişinin AMİRİNİ gerçekten yazdı (9001 değil 1002)");
  kontrol(!(await mehmetSatiri.getByText("Montaj").isVisible()), "eski bölüm eşlemeyle EZİLDİ (iki gerçek yarışmıyor)");

  /* "Tüm listeye uygula": eşleme sonradan değişince tek düğmeyle düzeltilir.
     Maliyet merkezi olmayan satıra DOKUNULMAZ — o yüzden sayı 1. */
  await s.click('button:has-text("Tüm listeye uygula")');
  await s.waitForTimeout(2500);
  kontrol(await s.getByText(/1 kayda uygulandı/).isVisible(), "toplu uygulama yalnız kodu olan kaydı etkiliyor");

  /* 22. YETKİ MATRİSİ — yeni yüzeyler doğru rolü istiyor mu (gerçek HTTP). */
  for (const yol of ["/kayitlar", "/kayitlar/sinif", "/kayitlar/aktarim", "/gruplar", "/egitimler/qr", "/personel"]) {
    await y.goto(`${ADRES}${yol}`, { waitUntil: "networkidle" });
    kontrol(y.url().includes("/giris"), `oturumsuz kullanıcı ${yol} sayfasından girişe atılıyor`);
  }
  const yabanciCsv = await y.request.get(`${ADRES}/api/disa-aktar`);
  kontrol(yabanciCsv.status() === 403, "dışa aktarma uç noktası oturumsuz isteği reddediyor");

  /* YOL DOLAŞIMI: medya kimliği hesapsız bir uç noktadan geliyor; `../` veri
     klasörünün dışına çıkabilseydi personel dosyası tek istekle okunurdu. */
  for (const kotuId of ["..%2F..%2Fpersonel.csv", "....%2F%2Fflowtrain.db", "..%5C..%5Cpersonel.csv"]) {
    let govde = "";
    let durum = 0;
    try {
      const c = await y.request.get(`${ADRES}/api/medya/${kotuId}`);
      durum = c.status();
      govde = await c.text();
    } catch {
      /* istek hiç kurulamadıysa da kapı kapalı demektir */
    }
    kontrol(durum !== 200 && !govde.includes("Ali Yılmaz"), `yol dolaşımı reddediliyor: ${kotuId}`);
  }

  /* 23. SÜRÜMLÜ YAYIN — kayıt gerçekten bir İÇERİĞE atıf yapıyor mu?
     (`docs/SURUMLU-YAYIN.md`, 2. adım: saha artık taslağı değil yayınlanan
     sürümü oynatıyor.)

     Bu zincir yalnız burada ölçülebilir: yayınla → kioskta oynat → içeriği
     değiştirip yeniden yayınla → kioskta YENİ içeriğin, defterde ESKİ kaydın
     eski sürüm numarasıyla durduğunu gör. Depo sınavı sürümlerin ayrı
     durduğunu gösteriyor; gerçek soru, oynatıcının hangisini okuduğu. */
  await s.bringToFront();
  await s.goto(`${ADRES}/egitimler`, { waitUntil: "networkidle" });
  await s.fill('input[name="ad"]', "Sürüm Denemesi");
  await s.click('button:has-text("Oluştur")');
  await s.waitForURL(/\/egitimler\/egt_/, { timeout: 15000 });
  const surumYolu = new URL(s.url()).pathname;

  await kartEkle(s, "Kural kartı");
  await s.waitForTimeout(900);
  const svBaslik = s.locator('input[placeholder="Başlık"]').first();
  await svBaslik.fill("BİRİNCİ SÜRÜMÜN KARTI");
  await svBaslik.blur();
  await s.waitForTimeout(700);
  const svSure = s.locator('input[type="number"][class*="w-20"]').first();
  await svSure.fill("1");
  await svSure.blur();
  await s.waitForTimeout(700);

  await s.click('button:has-text("Yayınla")');
  await s.waitForTimeout(2000);
  kontrol(await s.getByText("Yayında · sürüm 1").isVisible(), "ilk yayın 1. sürümü açar");

  await s.goto(`${ADRES}/atama`, { waitUntil: "networkidle" });
  await s.selectOption('select[name="hedefId"]', { label: "Sürüm Denemesi" });
  await s.getByRole("button", { name: "Kaynak", exact: true }).click();
  await s.click('button:has-text("Atamayı ekle")');
  await s.waitForTimeout(2000);

  /* 1. sürümü kioskta tamamla (1001'in PIN'i var, imza tek adım). */
  await k.bringToFront();
  await k.goto(`${ADRES}/kiosk`, { waitUntil: "networkidle" });
  await k.fill("#kiosk-sicil", "1001");
  await k.click('button:has-text("Devam")');
  await k.waitForTimeout(1500);
  await k.locator('button:has-text("Sürüm Denemesi")').click();
  await k.waitForTimeout(3500);
  kontrol(await k.getByText("BİRİNCİ SÜRÜMÜN KARTI").isVisible(), "kioskta yayınlanan sürümün kartı oynuyor");
  await k.locator("button.kiosk-btn-primary").first().click();
  await k.waitForTimeout(1200);
  await k.locator('input[inputmode="numeric"]').first().fill("1234");
  await k.click('button:has-text("Onayla ve bitir")');
  await k.waitForTimeout(3000);
  kontrol(await k.getByText("Tamamlandı").isVisible(), "1. sürüm kioskta tamamlandı");

  /* İŞİN KALBİ: YAYINDAKİ EĞİTİMİ YERİNDE DÜZENLE — kiosktan düşürmeden.
     Belgedeki doğrulama beklentisi tam olarak bu üç adım. */
  await s.bringToFront();
  await s.goto(`${ADRES}${surumYolu}`, { waitUntil: "networkidle" });
  const svBaslik2 = s.locator('input[placeholder="Başlık"]').first();
  kontrol(await svBaslik2.isEnabled(), "yayındaki eğitim taslağa alınmadan düzenlenebiliyor");
  await svBaslik2.fill("İKİNCİ SÜRÜMÜN KARTI");
  await svBaslik2.blur();
  await s.waitForTimeout(1200);
  kontrol(await s.getByText("Yayınlanmamış değişiklik").first().isVisible(), "yayınlanmamış değişiklik rozeti yanıyor");
  kontrol(await s.getByText("Bu değişiklikler sahada yok.").isVisible(), "şerit farkı açıkça söylüyor");
  kontrol(await s.getByText("Yayında · sürüm 1").isVisible(), "sahadaki sürüm numarası DEĞİŞMEDİ");

  /* KİOSK HÂLÂ ESKİ SÜRÜMÜ OYNATIYOR. Ürünün bütün vaadi bu satırda:
     hazırlayan 7. kartı yazarken vardiyadaki işçi eğitimini alabiliyor.
     1002'nin bu eğitimde kaydı yok; oturum bilerek tamamlanmıyor. */
  await k.bringToFront();
  await k.goto(`${ADRES}/kiosk`, { waitUntil: "networkidle" });
  await k.fill("#kiosk-sicil", "1002");
  await k.click('button:has-text("Devam")');
  await k.waitForTimeout(1500);
  await k.locator('button:has-text("Sürüm Denemesi")').click();
  await k.waitForTimeout(2500);
  kontrol(
    await k.getByText("BİRİNCİ SÜRÜMÜN KARTI").isVisible(),
    "TASLAK DEĞİŞTİ AMA KİOSK HÂLÂ YAYINLANAN SÜRÜMÜ OYNATIYOR",
  );
  kontrol(!(await k.getByText("İKİNCİ SÜRÜMÜN KARTI").isVisible()), "yayınlanmamış kart sahaya sızmadı");
  await k.click('button[aria-label="Eğitimden çık"]');
  await k.waitForTimeout(800);

  /* "YAYINDAKİ HÂLİNE DÖN" — taslağı sahadakine eşitler, veri kaybı yok. */
  await s.bringToFront();
  await s.click('button:has-text("Yayındaki hâline dön")');
  await s.waitForTimeout(500);
  await s.getByRole("alertdialog").getByRole("button", { name: "Yayındaki hâline dön" }).click();
  await s.waitForTimeout(2500);
  kontrol(
    (await s.locator('input[placeholder="Başlık"]').first().inputValue()) === "BİRİNCİ SÜRÜMÜN KARTI",
    "yayındaki hâline dön taslağı geri getirdi",
  );
  kontrol(
    !(await s.getByText("Yayınlanmamış değişiklik").first().isVisible()),
    "geri dönünce rozet söndü (taslak = yayın)",
  );

  /* ŞİMDİ GERÇEKTEN YAYINLA — 2. sürüm açılmalı. */
  const svBaslik3 = s.locator('input[placeholder="Başlık"]').first();
  await svBaslik3.fill("İKİNCİ SÜRÜMÜN KARTI");
  await svBaslik3.blur();
  await s.waitForTimeout(1200);
  await s.click('button:has-text("Yayınla")');
  await s.waitForTimeout(2500);
  kontrol(await s.getByText("Yayında · sürüm 2").isVisible(), "değişen içerik 2. sürümü açar");

  /* 9001'in bu eğitimde kaydı yok — yeni sürümü o görüyor. */
  await k.bringToFront();
  await k.goto(`${ADRES}/kiosk`, { waitUntil: "networkidle" });
  await k.fill("#kiosk-sicil", "9001");
  await k.click('button:has-text("Devam")');
  await k.waitForTimeout(1500);
  await k.locator('button:has-text("Sürüm Denemesi")').click();
  await k.waitForTimeout(2500);
  kontrol(await k.getByText("İKİNCİ SÜRÜMÜN KARTI").isVisible(), "yayınlandıktan sonra kiosk YENİ sürümü oynatıyor");
  await k.click('button[aria-label="Eğitimden çık"]');
  await k.waitForTimeout(800);

  /* ESKİ KAYIT ESKİ SÜRÜME ATIF YAPMAYA DEVAM EDİYOR. İşin bütün sebebi bu:
     kayıt "sürüm 1" diyorsa, 1. sürümün içeriği hâlâ okunabilir olmalı. */
  await s.bringToFront();
  await s.goto(`${ADRES}/kayitlar`, { waitUntil: "networkidle" });
  await s.locator('button[aria-label="1001 · Sürüm Denemesi kaydını aç"]').click();
  await s.waitForTimeout(600);
  kontrol(
    await s.getByText("Sürüm 1").isVisible(),
    "1. sürümde alınan kayıt, 2. sürüm yayınlandıktan SONRA da sürüm 1 diyor",
  );
  await s.getByRole("button", { name: "Kapat" }).click();
  await s.waitForTimeout(300);

  await tarayici.close();
  bitir();
} catch (h) {
  console.error("\n✗ Akış koptu:", h.message);
  hata++;
  bitir(1);
}
