/**
 * TASARIM DİLİ SINAVI — Flow ailesine uyum kodda tutuluyor mu?
 *
 * NEDEN BU DOSYA VAR: bu depoda kurallar sınavla yaşıyor, sınavın
 * kapsamadığı her kural sessizce çürüyor (incelemenin kendi meta-bulgusu).
 * Tasarım dili en kolay çürüyen kural türü: bir sayfaya tek bir hex yazmak
 * derlemeyi bozmaz, hiçbir uyarı vermez ve koyu temada o yer bozuk kalır.
 *
 * Ölçülen şey GÖRÜNÜM DEĞİL, SÖZLEŞME: renk token'dan mı geliyor, iki tema
 * aynı token kümesini dolduruyor mu, odak dili ikiye ayrılmış mı.
 * Görünümün kendisi gözle ve tarayıcıda ölçülüyor.
 *
 * Kaynak: `docs/FLOWUI-DILI.md` · `FlowUI/src/pages/DesignSystem/`
 *
 * Koşum: `node --experimental-strip-types tests/tasarim-dili.test.mjs`
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { kontrol, esit, bitir } from "./yardim.mjs";

const oku = (y) => readFileSync(y, "utf8");
/** Yorumları söker. Kural KODU ölçüyor; bir kuralı ANLATAN yorumun içindeki
    örnek hex, kuralın ihlali değildir (bu sınav tam da ona takıldı). */
const yorumsuz = (m) => m.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const duz = (y) => y.split("\\").join("/");

const tokenler = oku("src/styles/flow-tokens.css");
const global = oku("src/styles/flow-global.css");
const kokCss = oku("src/styles/globals.css");
const tw = oku("tailwind.config.ts");

/* Kaynaktaki bütün .ts/.tsx dosyaları. */
const kaynaklar = [];
(function tara(kok) {
  for (const ad of readdirSync(kok)) {
    const yol = join(kok, ad);
    if (statSync(yol).isDirectory()) tara(yol);
    else if (ad.endsWith(".tsx") || ad.endsWith(".ts")) kaynaklar.push({ yol: duz(yol), metin: oku(yol) });
  }
})("src");

kontrol(kaynaklar.length > 100, `kaynak dosyaları tarandı (${kaynaklar.length})`);

/* ══ 1. TEMA SÖZLEŞMESİ EKSİKSİZ Mİ? ══════════════════════════════════════
   FlowUI kuralı: "Yeni tema = token sözleşmesini EKSİKSİZ doldurmak. Bir
   token atlanırsa değeri açık temadan SIZAR ve tema yamalı görünür."
   Bu, gözle en zor yakalanan hata türü: sayfa çalışır, yalnız bir köşe
   yanlış renktedir ve kimse fark etmez. */

function blokAl(css, secici) {
  const i = css.indexOf(secici);
  if (i === -1) return "";
  const bas = css.indexOf("{", i);
  let derinlik = 0;
  for (let j = bas; j < css.length; j++) {
    if (css[j] === "{") derinlik++;
    else if (css[j] === "}") {
      derinlik--;
      if (derinlik === 0) return css.slice(bas, j);
    }
  }
  return "";
}

const acikBlok = blokAl(tokenler, ':root[data-tema="acik"]');
const koyuBlok = blokAl(tokenler, ':root[data-tema="koyu"]');
kontrol(acikBlok.length > 500, "açık tema bloğu bulundu");
kontrol(koyuBlok.length > 500, "koyu tema bloğu bulundu");

const jetonAdlari = (blok) => new Set([...blok.matchAll(/(--flow-[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
const acikJetonlar = jetonAdlari(acikBlok);
const koyuJetonlar = jetonAdlari(koyuBlok);

/* Yalnız AÇIK temada tanımlı olup koyuda olmayanlar RİSKLİDİR: koyu tema
   onları açıktan miras alır ve lacivert zeminde açık tema rengi kalır.

   AMA hepsi değil. Bazıları ORTAK `:root` bloğundan geliyor — durum
   renkleri (success/warning/danger/info) orada KOYU zemin için seçilmiş,
   açık tema onları eziyor. Yani koyuda "eksik" görünen şey aslında ortak
   tabanın kendisi. Sızıntı sayılan tek şey: ne koyuda ne ortakta olan. */
const ortakBlok = tokenler.slice(tokenler.lastIndexOf(":root {"));
const ortakJetonlar = jetonAdlari(ortakBlok);
const koyudaEksik = [...acikJetonlar].filter((t) => !koyuJetonlar.has(t) && !ortakJetonlar.has(t));
/* Bilerek tek yerde duranlar — türetilmiş oldukları için her temada kendi
   yüzeyini alıyorlar. */
const MAZUR = new Set([
  "--flow-glass-panel", // yüzeyden türetiliyor
  "--flow-glass-panel-kenar", // aynı gerekçe
]);
const gercektenEksik = koyudaEksik.filter((t) => !MAZUR.has(t));
esit(gercektenEksik, [], `koyu tema sözleşmeyi eksiksiz dolduruyor${gercektenEksik.length ? ` (eksik: ${gercektenEksik.join(", ")})` : ""}`);

/* İki temanın da zorunlu çekirdeği. */
for (const zorunlu of [
  "--flow-bg", "--flow-surface", "--flow-surface-2", "--flow-hover", "--flow-border",
  "--flow-text", "--flow-text-2", "--flow-text-muted", "--flow-link",
  "--flow-primary", "--flow-primary-strong", "--flow-primary-soft", "--flow-primary-contrast",
  "--flow-pill-accent", "--flow-pill-glow", "--flow-pill-fill",
  "--flow-logo-yazi",
]) {
  kontrol(acikJetonlar.has(zorunlu) && koyuJetonlar.has(zorunlu), `${zorunlu} iki temada da tanımlı`);
}

/* `color-scheme` İKİ TEMADA DA bildirilmeli: tarayıcının kendi çizdiği
   parçalar (açılır liste, kaydırma çubuğu, takvim) yoksa işletim sisteminin
   moduna göre açılıyor ve koyu sayfada beyaz bir liste patlıyor. */
kontrol(/color-scheme:\s*light/.test(acikBlok), "açık tema color-scheme bildiriyor");
kontrol(/color-scheme:\s*dark/.test(koyuBlok), "koyu tema color-scheme bildiriyor");

/* ══ 1b. KONTRAST GÖRÜŞ DEĞİL, ÖLÇÜ ═══════════════════════════════════════
   Bu bölüm bir sorunun cevabı olarak doğdu: "buradaki renkler doğru
   kontrastta mı?". Gözle bakıp "bence yeterli" demek bu depoda kabul
   edilebilir bir cevap değil — WCAG'ın formülü belli, token'lar hex,
   yani hesap YAPILABİLİR. Yapılabilen şeyi kanıya bırakmak, bir sonraki
   token ayarında sessizce eşiğin altına düşmek demek.

   Gerçekte iki kez oldu: `--flow-text-muted` hem açık (#5c6689) hem koyu
   (#9aa6d6) temada FlowUI'ın ölçülen değerinden bir kademe soluktu ve
   tabloların "atanmamış / — / sürüm 1" sütunları okunmuyordu.

   EŞİK 4.5:1 (WCAG AA, normal punto). Metin token'ları hem sayfa zemini
   hem kart yüzeyi üstünde ölçülüyor — ikisinde de metin taşıyorlar. */
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

function jetonDegeri(blok, ad) {
  const m = blok.match(new RegExp(`${ad}\s*:\s*([^;]+);`));
  return m ? m[1].trim() : null;
}

function isik(hex) {
  let h = hex.slice(1);
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  const kanal = [0, 2, 4]
    .map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * kanal[0] + 0.7152 * kanal[1] + 0.0722 * kanal[2];
}

function kontrastOrani(a, b) {
  const [x, y] = [isik(a), isik(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/* ⚠ TEK İSTİSNA — GİZLENMİYOR, YAZILIYOR.
   `--flow-text-muted` FlowUI'ın kendi değeri (#7d89c4) ve FlowUI'da da
   `surface-2` üstünde 4.2:1 veriyor, yani kendi eşiğinin altında.
   FlowTrain daha önce bu tonu #c3cbe4'e çekmişti (10.1:1) ama o zaman
   text/text-2/muted birbirinden ayrışmıyor, tablolar ve künyeler tek
   parlaklıkta düzleşiyordu — kullanıcının "tam benzeyemedi" dediği yer.
   Karar: TON FlowUI ile aynı kalsın, açık kaydedilsin. Muted zaten
   ikincil etiket rengidir; okunması gereken metin `--flow-text-2`. */
const ISTISNA = {
  "koyu --flow-text-muted --flow-surface-2": {
    esik: 4.1,
    sebep: "FlowUI'da da 4.2 · muted yalnız ikincil etiket",
  },
};

const METIN_JETONLARI = ["--flow-text", "--flow-text-2", "--flow-text-muted", "--flow-govde", "--flow-link"];
const ZEMIN_JETONLARI = ["--flow-bg", "--flow-surface", "--flow-surface-2"];

for (const [temaAdi, blok] of [["açık", acikBlok], ["koyu", koyuBlok]]) {
  for (const metinAd of METIN_JETONLARI) {
    const metin = jetonDegeri(blok, metinAd);
    if (!metin || !HEX.test(metin)) continue;
    for (const zeminAd of ZEMIN_JETONLARI) {
      const zemin = jetonDegeri(blok, zeminAd);
      if (!zemin || !HEX.test(zemin)) continue;
      const o = kontrastOrani(metin, zemin);
      const istisna = ISTISNA[`${temaAdi} ${metinAd} ${zeminAd}`];
      kontrol(
        o >= (istisna ? istisna.esik : 4.5),
        `${temaAdi}: ${metinAd} × ${zeminAd} = ${o.toFixed(1)}:1 ` +
          (istisna ? `(FlowUI ile eşitlendi — ${istisna.sebep})` : "(AA 4.5 eşiği)"),
      );
    }
  }
}

/* HİYERARŞİ DE KORUNMALI. Yalnız "hepsi eşiğin üstünde" yetmez: dördü de
   16:1 olsaydı sınav geçerdi ama başlık, gövde ve sakin bilgi tek bir
   parlaklıkta ezilir, sayfa düzleşirdi. Başlık en parlak, sakin bilgi en
   sönük olmak zorunda — ARADAKİ FARK bilgi taşıyor.

   ⚠ SIRAYA YALNIZ FLOWUI'IN KENDİ ÜÇ TONU GİRER (text · text-2 · muted).
   `--flow-govde` FlowUI'da bir `--flow-*` jetonu değil, Bootstrap'ın gövde
   rengi (#a6b0cf koyu / #495057 açık) ve rampada sabit bir yeri yok:
   koyuda text-2'den sakin, açıkta text-2'den parlak. Sıraya sokmak
   FlowUI'da olmayan bir kural uydurmak olurdu. */
for (const [temaAdi, blok] of [["açık", acikBlok], ["koyu", koyuBlok]]) {
  const zemin = jetonDegeri(blok, "--flow-bg");
  const sirali = ["--flow-text", "--flow-text-2", "--flow-text-muted"]
    .map((ad) => ({ ad, deger: jetonDegeri(blok, ad) }))
    .filter((x) => x.deger && HEX.test(x.deger))
    .map((x) => ({ ...x, oran: kontrastOrani(x.deger, zemin) }));
  for (let i = 1; i < sirali.length; i++) {
    kontrol(
      sirali[i].oran <= sirali[i - 1].oran,
      `${temaAdi}: ${sirali[i].ad} (${sirali[i].oran.toFixed(1)}) ` +
        `${sirali[i - 1].ad}'den (${sirali[i - 1].oran.toFixed(1)}) daha sakin`,
    );
  }
}

/* TABLO KENDİ JETONUNU KULLANIR ve içindeki bağlantı rengi MİRAS ALIR.
   İkisi de "tablolar hâlâ aynı değil" şikâyetinin parçasıydı: hücreler
   `--flow-text-2` ile soluk yazılıyordu ve satır başlıkları global
   `a { color: primary }` yüzünden 3.7:1 mavi oluyordu. */
kontrol(
  /\.flow-tablo\s*\{[^}]*color:\s*var\(--flow-text\)/.test(global),
  "tablo `--flow-text` (başlık tonu) kullanıyor",
);
kontrol(
  /\.flow-tablo td\s*\{[^}]*color:\s*var\(--flow-text-2\)/.test(global),
  "hücre `--flow-text-2` (sakin ton) — başlıkla hücre ayrışıyor",
);
/* ⚠ KIRPMA GERİ GELMESİN DİYE SINAVLI. Bir kez "FlowUI'da kırpma yok"
   diye kaldırılmıştı; o ölçüm `.flow-inline-table`e yapılmıştı, oysa
   kokpit tablosunda (SimpleDataTable) 220px + nowrap + ellipsis var. */
kontrol(
  /\.flow-tablo td\s*\{[^}]*max-width:\s*220px[\s\S]*?text-overflow:\s*ellipsis/.test(global),
  "hücre kırpılıyor (FlowUI kokpit tablosu: 220px + ellipsis)",
);
kontrol(
  /:where\(\.flow-tablo\)\s*tbody\s*a\s*\{[^}]*color:\s*inherit/.test(global),
  "tablo içindeki bağlantı rengini miras alıyor (mavi 3.7:1 değil)",
);

/* DÜĞME METİN RENGİNİ KENDİ SÖYLER — yoksa etiketine göre değişir.
   `<button class="btn-ghost">` gövde rengini miras alır, ama
   `<Link className="btn-ghost">` global `a { color: primary }` kuralını
   yakalar ve MAVİ çıkar. Aynı şeritte yan yana duran iki düğme farklı
   renkte oluyordu ve koyu zeminde mavi olan 3.7:1 ile AA eşiğinin altına
   düşüyordu. Renk bildirimi olmayan bir düğme sınıfı, bu hatayı bekleyen
   bir tuzaktır. */
const dugmeSiniflari = [...kokCss.matchAll(/\.(btn-[a-z0-9-]+)\s*\{/g)].map((m) => m[1]);
for (const ad of dugmeSiniflari) {
  const govde = blokAl(kokCss, `.${ad} {`);
  if (/^btn-(icon|kiosk)/.test(ad)) continue; // kendi bloklarında bildiriyorlar
  kontrol(
    /text-(ink|ink-2|govde|muted|white|paper)/.test(govde) || /color:/.test(govde),
    `.${ad} metin rengini kendi bildiriyor (etikete göre değişmiyor)`,
  );
}

/* ══ 2. HEX YAZILMAZ ══════════════════════════════════════════════════════
   Renk daima token'dan. Sayfaya yazılan bir hex temayla dönmez. */

/* İstisnalar ve HER BİRİNİN SEBEBİ — liste gerekçesiz uzatılamaz. */
const HEX_MAZERETI = {
  "src/app/egitimler/qr/Etiketler.tsx": "kâğıda basılıyor; QR kontrastı sabit olmak zorunda",
  "src/lib/qr.ts": "QR matrisi — yazdırma çıktısı",
  "src/components/Logo.tsx": "marka; koyu yüzey zorlaması (`onDark`) için beyaz",
  "src/components/ConfirmDialog.tsx": "kiosk kipi tema ne olursa olsun koyu",
  "src/app/layout.tsx": "tarayıcı tema rengi — token değeriyle aynı, meta etiketi var() alamaz",
  "src/lib/pptx.ts": "dosya çözümleme, arayüz değil",
};

/* YORUMSUZ metinde aranıyor: bir hatayı ANLATAN yorum ("`#001e64` lacivert
   zeminde görünmüyordu") kuralın ihlali değil, kaydıdır. */
const hexli = kaynaklar.filter(
  (d) =>
    /#[0-9a-fA-F]{6}\b/.test(yorumsuz(d.metin)) &&
    !d.yol.startsWith("src/lib/pdf") &&
    !d.yol.includes("sertifika") &&
    !d.yol.includes("panoPdf") &&
    !d.yol.includes("ziyaretciPdf"),
);
const izinsizHex = hexli.filter((d) => !(d.yol in HEX_MAZERETI));
esit(izinsizHex.map((d) => d.yol), [], `arayüzde gerekçesiz hex yok${izinsizHex.length ? ` (${izinsizHex.map((d) => d.yol).join(", ")})` : ""}`);

/* ══ 3. TAILWIND STOK PALETİ KULLANILMAZ ══════════════════════════════════
   `bg-slate-800` temayla dönmez ve Flow paletinin dışındadır. */
const stok = /\b(bg|text|border|ring|from|to|via)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3}\b/;
const stokKullananlar = kaynaklar.filter((d) => stok.test(yorumsuz(d.metin)));
esit(stokKullananlar.map((d) => d.yol), [], "Tailwind stok paleti kullanılmıyor");

/* `bg-white` de yasak: koyu temada beyaz kalır ve kart parlayan bir levhaya
   döner. Opaklıklı kullanım (`bg-white/15`) KOYU yüzeylerin üstünde meşru. */
const beyazKullananlar = kaynaklar.filter((d) => /\bbg-white\b(?!\/)/.test(yorumsuz(d.metin)));
esit(beyazKullananlar.map((d) => d.yol), [], "düz `bg-white` kalmadı (yerine `bg-yuzey`)");
kontrol(!/\bbg-white\b(?!\/)/.test(yorumsuz(kokCss)), "globals.css'te de düz `bg-white` yok");

/* ══ 3b. KÖŞE YARIÇAPI DİLDEN GELİR ═══════════════════════════════════════
   FlowUI ölçeği: kart 12px (`--flow-radius`), küçük eleman 8px
   (`--flow-radius-sm`). Sayfaya sabit yarıçap yazılmaz; Tailwind'in kendi
   ölçeği (`rounded-2xl` = 16px) Flow ailesinin dışındadır ve iki ürün yan
   yana durduğunda kartların köşesi tutmuyordu.

   HAP BİÇİMLİ ÖĞELER KURAL DIŞI (`rounded-full`) — FlowUI da `.rounded-pill`i
   ayrı tutuyor: hap bir yarıçap değil, bir biçim kararıdır. */
const tailwindYaricap = /rounded-(?:sm|md|lg|xl|2xl|3xl)/;
const yaricapKacaklari = kaynaklar.filter((d) => tailwindYaricap.test(yorumsuz(d.metin)));
esit(yaricapKacaklari.map((d) => d.yol), [], "Tailwind stok yarıçapı kullanılmıyor (yerine `rounded-flow`)");
kontrol(!tailwindYaricap.test(yorumsuz(kokCss)), "globals.css'te de stok yarıçap yok");
kontrol(/rounded-flow/.test(kokCss) || kaynaklar.some((d) => /rounded-flow/.test(d.metin)), "Flow yarıçapı kullanımda");
kontrol(/"flow":\s*"var\(--flow-radius\)"|flow: "var\(--flow-radius\)"/.test(tw), "`rounded-flow` token'a bağlı");

/* ══ 3c. TEMA ÜSTÜ RENK ÖN PLANDA KULLANILMAZ ═════════════════════════════
   `lacivert` ve `--flow-logo-*` tema üstüdür: marka kimliği ekranın koyu ya
   da açık olmasına bakmaz. Ama tam bu yüzden TEMA YÜZEYİNİN ÜSTÜNDE metin
   veya simge rengi olarak kullanılamazlar — koyu tema zemini de lacivert
   (#111756) ve marka laciverti (#001e64) orada GÖRÜNMÜYOR.

   Üç yerde birden yaşandı ve üçü de yalnız koyu temada bozuktu: kiosk kartı,
   OPM aktarım ve içe aktarım simgeleri `bg-lacivert/10 text-lacivert`
   yazıyordu. Kullanıcı ekran görüntüsüyle bildirdi.

   AYNI SINIF HATA `bg-ink text-white`: koyu temada `ink` zaten beyaza yakın,
   yani beyaz üstüne beyaz. Rehber sekmesi ve bildirim böyle çiziliyordu.
   FlowUI'ın "kontrast rengi nerede kullanılır" kuralı ikisini de kapsıyor:
   kontrast rengi YALNIZ dolgu üstünde; yüzey üstündeki metin tema metnini
   kullanır. */
const onPlandaMarka = kaynaklar.filter((d) => /text-lacivert/.test(yorumsuz(d.metin)));
esit(onPlandaMarka.map((d) => d.yol), [], "tema üstü marka rengi metin/simge olarak kullanılmıyor");

const beyazUstuneBeyaz = kaynaklar.filter((d) => /bg-ink(?!\/)[^"`]*text-white/.test(yorumsuz(d.metin)));
esit(beyazUstuneBeyaz.map((d) => d.yol), [], "`bg-ink text-white` yok (koyu temada beyaz üstüne beyaz)");

/* ══ 4. ODAK DİLİ İKİYE AYRILMIŞ ══════════════════════════════════════════
   Yazı girişi ve textarea → imza halkası (`--flow-ring`).
   Seçici, düğme, onay kutusu → tema vurgusu (`--flow-pill-accent`).
   İkisi karışırsa markanın imzası hiçbir yerde görünmez olur. */

const halkaBlogu = kokCss.slice(kokCss.indexOf("input:not("));
kontrol(/--flow-ring\)/.test(halkaBlogu), "yazı alanı odağı imza halkası kullanıyor");
kontrol(/--flow-ring-soft\)/.test(kokCss), "hover'da halkanın yumuşak hâli var");

/* Halka SEÇİCİYE ve DÜĞMEYE bulaşmamalı. */
for (const disarida of ["hidden", "checkbox", "radio", "submit", "button", "file", "range", "color"]) {
  kontrol(kokCss.includes(`:not([type="${disarida}"])`), `halka kapsamı ${disarida} tipini dışlıyor`);
}
kontrol(!/^select[^{]*--flow-ring/m.test(global), "seçici imza halkası ALMIYOR");
kontrol(/select:focus[\s\S]{0,200}--flow-pill-glow/.test(global), "seçici odağı hap ışığı kullanıyor");
kontrol(
  /\.btn-primary:focus-visible[\s\S]{0,300}--flow-pill-glow/.test(kokCss),
  "düğme odağı hap ışığı kullanıyor (halka değil)",
);

/* TUZAK: giriş alanına `background:` KISAYOLU yazmak halkanın
   `background-image` katmanını siler. FlowUI'da iki dosyada yaşandı. */
kontrol(
  !/input[^{]*\{[^}]*[^-]background:\s/.test(kokCss),
  "giriş alanı kuralında `background:` kısayolu yok (halkayı silerdi)",
);

/* ══ 4b. NATIVE `<select>` KULLANILMAZ ════════════════════════════════════
   FlowUI'ın el kitabındaki kural: "`<select>` ve `<Form.Select>`
   kullanılmaz — açılır listeyi işletim sistemi çizer, CSS oraya işlemez."

   Bu kuralı önce UYARLAMAYA çalıştım (yeni npm paketi yasak diye) ve
   `color-scheme` + zemin oyunlarıyla native listeyi temaya uydurmayı
   denedim. ÜÇ KEZ başarısız oldu ve her seferinde kullanıcı ekran
   görüntüsüyle bildirdi:
     · `option`a zemin yazmak → Chrome listeyi "stilli" kipe sokup AÇIK açıyor
     · zemini kaldırmak → kutu tarayıcının grisine düşüyor (#3b3b3b)
     · zemini `box-shadow`a taşımak → yine stilli kip
   Kural doğruydu, uyarlamam yanlıştı. `FlowSecici` menüyü kendisi çiziyor;
   paket eklenmedi.

   TEK İSTİSNA `FlowSecici`nin KENDİSİ — o da `<select>` çizmiyor, sözlükte
   geçen tek yer olduğu için burada elenmesi gerekiyor. */
const nativeSecici = kaynaklar.filter(
  (d) => /<select[\s>]/.test(yorumsuz(d.metin)) && d.yol !== "src/components/FlowSecici.tsx",
);
esit(nativeSecici.map((d) => d.yol), [], "native `<select>` kalmadı (yerine `FlowSecici`)");
kontrol(/role="listbox"/.test(oku("src/components/FlowSecici.tsx")), "kendi menümüz listbox deseni kullanıyor");
kontrol(
  /aria-activedescendant/.test(oku("src/components/FlowSecici.tsx")),
  "klavye konumu ekran okuyucuya bildiriliyor",
);
kontrol(
  /\.flow-secici-menu[\s\S]{0,300}--flow-surface-2/.test(global),
  "menü yüzeyden BİR TON AÇIK (kontrolün üstüne binince ayrışsın)",
);

/* ══ 5. ONAY KUTUSU TAMAMEN ÇİZİLİYOR ═════════════════════════════════════
   FlowUI ölçümü: `accent-color` YETMEZ — yalnız işaretli hâli boyar, BOŞ
   kutu tarayıcının çizimi kalır ve temayla ilgisi olmaz. */
kontrol(/input\[type="checkbox"\][\s\S]{0,400}appearance:\s*none/.test(global), "onay kutusu tarayıcı çizimini kapatıyor");
kontrol(/input\[type="checkbox"\]:checked::after/.test(global), "onay kutusunun tiki kendi çizimimiz");
const accentColorKullananlar = kaynaklar.filter((d) => /\baccent-accent\b/.test(d.metin));
esit(accentColorKullananlar.map((d) => d.yol), [], "`accent-color` kısayoluna dayanan onay kutusu kalmadı");

/* ══ 6. HAREKET AZALTMA HER İMZA HAREKETİNDE KARŞILANIYOR ═════════════════
   Bekleme ve uyarı hareketleri erişilebilirlik tercihinde DURMALI ama
   TAŞIDIKLARI BİLGİ kaybolmamalı. */
kontrol(/prefers-reduced-motion/.test(global), "global katman hareket azaltmayı karşılıyor");
const spinnerCss = oku("src/components/FlowSpinner.module.css");
kontrol(/prefers-reduced-motion/.test(spinnerCss), "spinner hareket azaltmayı karşılıyor");
kontrol(
  /prefers-reduced-motion[\s\S]{0,400}\.flow-alarm::before/.test(global),
  "uyarı göstergesinde yayılma durur (simge kalır)",
);

/* ══ 7. TAILWIND RENKLERİ TOKEN'A BAĞLI ═══════════════════════════════════ */
kontrol(/const jeton = \(ad: string\)/.test(tw), "Tailwind renkleri token köprüsünden geçiyor");
kontrol(/<alpha-value>/.test(tw), "opaklık değiştiricisi korunuyor (177 kullanım)");
for (const ad of ["--flow-text", "--flow-bg", "--flow-border", "--flow-surface", "--flow-primary"]) {
  kontrol(tw.includes(ad), `Tailwind ${ad} token'ına bağlı`);
}
kontrol(
  !/#[0-9a-fA-F]{6}/.test(yorumsuz(tw).replace(/lacivert:\s*"#001e64"/, "")),
  "Tailwind yapılandırmasında marka laciverti dışında hex yok",
);

/* ══ 8. LOGO KOYU ZEMİNDE OKUNUR ══════════════════════════════════════════ */
kontrol(/--flow-logo-yazi/.test(oku("src/components/Logo.tsx")), "logo yazısı token'dan renk alıyor");
kontrol(/logo-isaret-koyu/.test(kokCss), "logo işareti temaya göre seçiliyor");

bitir("tasarım dili");
