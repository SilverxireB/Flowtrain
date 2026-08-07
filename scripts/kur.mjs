/**
 * TEK KOMUTLA KURULUM — `npm run kur` (ya da kur.bat / kur.command çift tıkla).
 *
 * NEDEN JS, NEDEN .bat DEĞİL: mantığın tamamı burada olunca Windows, macOS ve
 * Linux'ta AYNI kod çalışıyor ve ben bunu sınayabiliyorum. `.bat` dosyası
 * yalnız "node scripts/kur.mjs" diyen üç satır — içinde koşul, sürüm
 * karşılaştırması, tırnak kaçışı yok. Kurulum betiği, kurulumun kendisinden
 * daha kırılgan olmamalı.
 *
 * Yaptıkları: Node sürümünü kontrol et → bağımlılıkları kur → derle →
 * veri klasörünü ve örnek personel dosyasını hazırla → sunucuyu başlat →
 * tarayıcıyı aç.
 */
import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const KOK = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = process.env.PORT ?? "3000";
const ADRES = `http://localhost:${PORT}`;

const yaz = (s = "") => console.log(s);
const basari = (s) => yaz(`  \x1b[32m✓\x1b[0m ${s}`);
const bilgi = (s) => yaz(`  \x1b[36m·\x1b[0m ${s}`);
const hata = (s) => yaz(`  \x1b[31m✗\x1b[0m ${s}`);

yaz();
yaz("  \x1b[1mFlowTrain kurulumu\x1b[0m");
yaz("  ──────────────────");
yaz();

/* ── 1. Node sürümü ────────────────────────────────────────────────────────
   Next 14 ve `better-sqlite3` eski Node'da tuhaf yerlerde patlıyor; hatayı
   burada, anlaşılır bir cümleyle vermek saatler kazandırıyor. */
const ana = Number(process.versions.node.split(".")[0]);
if (ana < 20) {
  hata(`Node sürümünüz ${process.versions.node} — en az 20.9 gerekiyor.`);
  yaz();
  yaz("    https://nodejs.org adresinden LTS sürümünü kurun,");
  yaz("    sonra bu dosyayı tekrar çalıştırın.");
  yaz();
  process.exit(1);
}
basari(`Node ${process.versions.node}`);

/* npm Windows'ta `npm.cmd`; `shell: true` olmadan "bulunamadı" der. */
const npmCalistir = (...args) => {
  const r = spawnSync("npm", args, { cwd: KOK, stdio: "inherit", shell: true });
  if (r.status !== 0) {
    yaz();
    hata(`"npm ${args.join(" ")}" başarısız oldu.`);
    yaz("    Yukarıdaki hata mesajı sebebi söylüyor. Takılırsanız KURULUM.md'ye bakın.");
    yaz();
    process.exit(1);
  }
};

/* ── 2. Bağımlılıklar ─────────────────────────────────────────────────────── */
if (existsSync(join(KOK, "node_modules", "next"))) {
  bilgi("Bağımlılıklar zaten kurulu, atlanıyor.");
} else {
  bilgi("Bağımlılıklar kuruluyor (birkaç dakika sürebilir)…");
  yaz();
  /* `--ignore-scripts` ŞART, süs değil.
     `better-sqlite3`ün kendi install betiği yok ama `binding.gyp` dosyası var;
     npm bunu görünce varsayılan olarak `node-gyp rebuild` başlatıyor ve C++
     derleyicisi olmayan makinede "Could not find any Visual Studio installation"
     ile ölüyor. Oysa derlemeye HİÇ gerek yok: paket Node-API tabanlı hazır
     ikiliyi kendi içinde taşıyor (prebuilds/). Derleyicisi olan makinede de
     aynı ikili kullanılıyor, yani bu bayrak her yerde doğru.

     Bedeli: atlanan `postinstall` adımını (PDF işçisi) elle çağırmak. */
  npmCalistir("install", "--ignore-scripts");
  yaz();
  npmCalistir("run", "pdf-isci");
  basari("Bağımlılıklar kuruldu");
}

/* ── 3. Derleme ───────────────────────────────────────────────────────────── */
bilgi("Uygulama derleniyor…");
yaz();
npmCalistir("run", "build");
yaz();
basari("Derleme tamam");

/* ── 4. Veri klasörü + örnek personel listesi ──────────────────────────────
   Örnek dosya YALNIZ yoksa kopyalanır: gerçek personel listesinin üstüne
   örnek veri yazmak, bir sonraki kurulumda kimsenin fark etmeyeceği bir
   felaket olurdu. */
const veri = process.env.FLOWTRAIN_DATA ?? join(KOK, "data");
mkdirSync(join(veri, "medya"), { recursive: true });

const personel = join(veri, "personel.csv");
if (!existsSync(personel)) {
  copyFileSync(join(KOK, "ornek", "personel.csv"), personel);
  basari("Örnek personel listesi kopyalandı (6 kişi) — kendi listenizle değiştirin");
} else {
  bilgi("Personel listesi zaten var, dokunulmadı.");
}
basari(`Veri klasörü: ${veri}`);

/* ── 5. Sunucu ────────────────────────────────────────────────────────────── */
yaz();
yaz(`  \x1b[1mAçılıyor:\x1b[0m ${ADRES}`);
yaz("  Kapatmak için bu pencerede Ctrl+C.");
yaz();

const sunucu = spawn("npm", ["start", "--", "-p", PORT], {
  cwd: KOK,
  stdio: "inherit",
  shell: true,
  env: { ...process.env, FLOWTRAIN_DATA: veri },
});

/* Tarayıcıyı sunucu GERÇEKTEN cevap verince aç: hemen açmak "bu site
   açılamıyor" sayfası gösteriyor ve insan kurulumun bozuk olduğunu sanıyor. */
(async () => {
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 500));
    try {
      const c = await fetch(ADRES);
      if (c.status < 500) break;
    } catch {
      /* henüz ayakta değil */
    }
  }
  const komut =
    process.platform === "win32" ? ["cmd", ["/c", "start", "", ADRES]]
    : process.platform === "darwin" ? ["open", [ADRES]]
    : ["xdg-open", [ADRES]];
  try {
    spawn(komut[0], komut[1], { stdio: "ignore", detached: true }).unref();
  } catch {
    /* tarayıcı açılamadıysa adres zaten ekranda yazılı */
  }
})();

const kapat = () => {
  sunucu.kill();
  process.exit(0);
};
process.on("SIGINT", kapat);
process.on("SIGTERM", kapat);
sunucu.on("exit", (kod) => process.exit(kod ?? 0));
