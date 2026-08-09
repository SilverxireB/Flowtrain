/**
 * SINAV ÇÖZÜCÜSÜ — Node'un modül çözümlemesini kaynak koduna yaklaştırır.
 *
 * NEDEN GEREKLİ: kaynak dosyalar birbirini `./arama` gibi UZANTISIZ çağırıyor
 * (Next/TypeScript böyle çözer) ve bazıları `@/lib/...` takma yolunu
 * kullanıyor. Düz Node ESM ikisini de bulamaz. Bu yüzden saf mantık
 * dosyalarının bir kısmı sınavsız kalıyordu — sınavlanamayan dosya, kimsenin
 * bakmadığı dosyadır.
 *
 * NE YAPMAZ: derleme YAPMAZ, dönüştürme YAPMAZ. Birim sınavlar
 * KÜÇÜLTÜLMEMİŞ kaynağı koşmaya devam ediyor (`CLAUDE.md` — SWC tuzağı);
 * burada değişen tek şey dosyanın nerede aranacağı.
 *
 * `--conditions=react-server` ile birlikte kullanılır (bkz. `kos.mjs`):
 * `server-only` paketi o koşul altında boş modüle çözülür, yoksa depoya
 * dokunan her dosya içeri alınırken hata fırlatırdı.
 */
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";

const KOK = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const UZANTILAR = [".ts", ".tsx", "/index.ts"];

registerHooks({
  resolve(belirtec, baglam, sonraki) {
    // `@/lib/x` → <kök>/src/lib/x
    if (belirtec.startsWith("@/")) {
      const taban = join(KOK, "src", belirtec.slice(2));
      for (const u of UZANTILAR) {
        if (existsSync(taban + u)) return { url: pathToFileURL(taban + u).href, shortCircuit: true };
      }
    }

    // `./x` / `../x` → aynı dosya, uzantısı eklenmiş hâli
    if (belirtec.startsWith(".") && baglam.parentURL?.startsWith("file:")) {
      const taban = resolve(dirname(fileURLToPath(baglam.parentURL)), belirtec);
      for (const u of UZANTILAR) {
        if (existsSync(taban + u)) return { url: pathToFileURL(taban + u).href, shortCircuit: true };
      }
    }

    return sonraki(belirtec, baglam);
  },
});
