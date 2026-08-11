/**
 * ALT YOL (basePath) — `npm test`
 *
 * NEDEN: kurum uygulamayı çoğu zaman kökte değil, var olan bir sitenin ALTINDA
 * yayına alıyor (`https://intranet/flowtrain`). Next `basePath` verilince
 * `<Link>`, `router.push` ve `_next` statiklerini düzeltir; KODDA ELLE YAZILMIŞ
 * mutlak yolları düzeltmez.
 *
 * Bu kusur GELİŞTİRMEDE HİÇ GÖRÜNMEZ — kökte çalışırken her şey doğru. Yalnız
 * müşteri sunucusunda, canlıya alma günü çıkar: görseller gelmez, indirme boş
 * döner, yükleme 404 alır. FlowSign'ı `/flowsign` altına alan ekip tam bunu
 * yaşadı ve yirmi küsur yeri elle yamalamak zorunda kaldı.
 *
 * Sınav iki şeye bakar:
 *  1. `yol()` yardımcısının kendisi doğru mu (saf mantık)
 *  2. Kaynakta yardımcıdan geçmeyen mutlak yol kaldı mı (tarama)
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { kontrol, esit, bitir } from "./yardim.mjs";

/* ── 1. Yardımcının mantığı ─────────────────────────────────────────────────
   `yol.ts` modül yüklenirken ortam değişkenini okuyor; sınavda ikisini de
   denemek için değeri BURADA kurup modülü ondan sonra alıyoruz. */
process.env.NEXT_PUBLIC_TEMEL_YOL = "/flowtrain";
const { yol, medyaYolu, TEMEL_YOL } = await import("../src/lib/yol.ts");

esit(TEMEL_YOL, "/flowtrain", "önek ortamdan okunur");
esit(yol("/api/medya"), "/flowtrain/api/medya", "mutlak yolun başına önek gelir");
esit(medyaYolu("mdy_x.png"), "/flowtrain/api/medya/mdy_x.png", "medya adresi önekli kurulur");

// Çift önek: zaten önekli bir yol ikinci kez geçerse bozulmamalı.
esit(yol("/flowtrain/api/medya"), "/flowtrain/api/medya", "önekli yola ikinci önek eklenmez");
esit(yol("/flowtrainx/api"), "/flowtrain/flowtrainx/api", "benzeyen ama farklı yol önek alır");

// Dışarıya ve göreliye DOKUNMAZ: yanlış yerde çağrılsa bile adresi bozmasın.
esit(yol("https://ornek/x"), "https://ornek/x", "dış adrese dokunulmaz");
esit(yol("//ornek/x"), "//ornek/x", "şema-göreli adrese dokunulmaz");
esit(yol("data:image/png;base64,AAA"), "data:image/png;base64,AAA", "data: adresine dokunulmaz");
esit(yol("api/medya"), "api/medya", "göreli yola dokunulmaz");
esit(yol("#bolum"), "#bolum", "çapaya dokunulmaz");

/* ── 2. Kaynak taraması ─────────────────────────────────────────────────────
   Elle yazılmış `/api/...` kaldı mı? `<Link href="/...">` ARANMAZ: Next onu
   kendisi düzeltiyor. Aranan şey `fetch`, `src`, ham `<a href>` ve XHR. */
const KAYNAK = fileURLToPath(new URL("../src", import.meta.url));

/** Yardımcıdan geçmeden `/api/` ile başlayan adres kuran desenler. */
const DESENLER = [
  { ad: "fetch", re: /fetch\(\s*[`"']\/api\// },
  { ad: "src", re: /src=\{?\s*[`"']\/api\// },
  { ad: "a href", re: /href=\{?\s*[`"']\/api\// },
  { ad: "XHR open", re: /\.open\(\s*[`"'][A-Z]+[`"']\s*,\s*[`"']\/api\// },
  { ad: "EventSource", re: /new EventSource\(\s*[`"']\/api\// },
];

function dosyalar(klasor) {
  const cikti = [];
  for (const ad of readdirSync(klasor)) {
    const y = join(klasor, ad);
    if (statSync(y).isDirectory()) cikti.push(...dosyalar(y));
    else if (/\.(ts|tsx)$/.test(ad)) cikti.push(y);
  }
  return cikti;
}

/**
 * YORUMLAR AYIKLANIR.
 *
 * Bu depoda açıklamalar uzun ve içlerinde örnek kod var: `yol.ts` kötü
 * kullanımı örnekliyor, `api/qr/route.ts` ucun nasıl çağrılacağını
 * `<img src="/api/qr?...">` diye yazıyor. İkisi de gerçek kod değil. Dosyayı
 * listeden elle çıkarmak yerine yorumu atmak doğrusu: yarın başka bir dosyaya
 * örnek yazılınca sınav yine yanlış alarm vermesin.
 *
 * Kaba ama yeterli: `//`den önce iki nokta varsa (`https://`) satır yorumu
 * sayılmaz.
 */
function yorumsuz(metin) {
  return metin.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

const sapanlar = [];
for (const y of dosyalar(KAYNAK)) {
  const metin = yorumsuz(readFileSync(y, "utf8"));
  for (const d of DESENLER) {
    if (d.re.test(metin)) sapanlar.push(`${y.replace(KAYNAK, "src")} (${d.ad})`);
  }
}

kontrol(
  sapanlar.length === 0,
  sapanlar.length === 0
    ? "kaynakta yardımcıdan geçmeyen mutlak /api/ yolu yok"
    : `alt yolda kırılacak adres(ler): ${sapanlar.join(", ")}`,
);

bitir("alt yol");
