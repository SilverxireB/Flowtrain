/**
 * Tüm sınavları koşar — `npm test`
 * Bir sınav düşerse çıkış kodu 1 olur (derleme hattı buna bakar).
 */
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const klasor = dirname(fileURLToPath(import.meta.url));
const dosyalar = readdirSync(klasor).filter((d) => d.endsWith(".test.mjs")).sort();

let dusen = 0;
for (const d of dosyalar) {
  console.log(`\n── ${d} ${"─".repeat(Math.max(0, 60 - d.length))}`);
  const r = spawnSync(
    process.execPath,
    ["--experimental-strip-types", "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", join(klasor, d)],
    { stdio: "inherit" },
  );
  if (r.status !== 0) dusen++;
}

console.log(`\n${dosyalar.length - dusen}/${dosyalar.length} sınav dosyası geçti.`);
process.exit(dusen ? 1 : 0);
