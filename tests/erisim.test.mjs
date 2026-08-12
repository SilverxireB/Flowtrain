/**
 * ERİŞİLEBİLİRLİK ve DOKUNMA HEDEFİ SINAVI — `npm test`
 *
 * NEDEN KAYNAK OKUYOR: bu kuralların hiçbiri çalışma zamanında patlamaz.
 * 44px'lik bir düğme eldivenle ıskalanır ama hata vermez; alt metni olmayan
 * bir görsel ekran okuyucuda yok sayılır ama hiçbir günlüğe düşmez. Tek
 * bekçi, kuralı kaynağa bakarak tutan bir sınav. `sinir.test.mjs` aynı
 * yöntemi ürünün diğer sessiz kuralları için kullanıyor.
 *
 * KAPSAM: kiosk yüzeyleri (kiosk, oynatıcı, ziyaretçi tableti). Kokpit
 * yüzeylerinin ölçüsü ayrıdır (44px, fare ve klavye) ve buraya karıştırılmaz —
 * karıştırılsaydı kokpit ekranları da 72px'lik düğmelerle dolar, yoğun bir
 * liste ekranı kullanılamaz hâle gelirdi.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { kontrol, esit, bitir } from "./yardim.mjs";

/**
 * Yorumları çıkarır. Gerekli, çünkü kuralların BİR KISMI "şu sınıf burada
 * kullanılmasın" diyor ve o sınıfın adı çoğu zaman gerekçeyi anlatan yorumda
 * geçiyor — yorum yüzünden sınav düşerse insanlar gerekçe yazmaktan vazgeçer.
 */
function yorumsuz(metin) {
  return metin.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
}

/**
 * Açılış `<button …>` etiketleri.
 *
 * DÜZ REGEX YETMİYOR: `onClick={() => basla(x)}` içindeki `>` etiketi erken
 * kapatıyor ve `className` hiç görünmüyordu — sınav "72px altında düğme var"
 * diye yanlış alarm veriyordu. Süslü/parantez derinliği sayılarak yürünür.
 */
function acilisEtiketleri(metin, ad) {
  const cikti = [];
  let i = metin.indexOf(`<${ad}`);
  while (i !== -1) {
    let derinlik = 0;
    let j = i + ad.length + 1;
    for (; j < metin.length; j++) {
      const c = metin[j];
      if (c === "{" || c === "(") derinlik++;
      else if (c === "}" || c === ")") derinlik--;
      else if (c === ">" && derinlik === 0) break;
    }
    cikti.push(metin.slice(i, j + 1));
    i = metin.indexOf(`<${ad}`, j);
  }
  return cikti;
}

function dosyalar(kok) {
  const cikti = [];
  for (const ad of readdirSync(kok)) {
    const yol = join(kok, ad);
    if (statSync(yol).isDirectory()) cikti.push(...dosyalar(yol));
    else if (ad.endsWith(".tsx")) cikti.push(yol);
  }
  return cikti;
}

const KIOSK_KOKLERI = ["src/app/kiosk", "src/components/oyun", "src/app/ziyaretci/oyna"];
const kioskDosyalari = KIOSK_KOKLERI.flatMap(dosyalar).map((yol) => ({
  yol: yol.replace(/\\/g, "/"),
  metin: yorumsuz(readFileSync(yol, "utf8")),
}));
const tumTsx = dosyalar("src").map((yol) => ({
  yol: yol.replace(/\\/g, "/"),
  metin: yorumsuz(readFileSync(yol, "utf8")),
}));

kontrol(kioskDosyalari.length >= 4, `kiosk yüzeyi dosyaları bulundu (${kioskDosyalari.length})`);

/* ── 1. `.kiosk-btn` gerçekten 72px ─────────────────────────────────────────
   Sınıfın tanımı tek yerde (`globals.css`); ölçü oradan kayarsa aşağıdaki
   bütün denetimler anlamsızlaşır. */
const css = readFileSync("src/styles/globals.css", "utf8");
kontrol(/\.kiosk-btn\b[\s\S]*?min-h-\[72px\]/.test(css), "`.kiosk-btn` en az 72px yüksekliğinde");
kontrol(/\.kiosk-btn\b[\s\S]*?focus-visible:ring/.test(css), "`.kiosk-btn` odak halkası taşıyor");
kontrol(/\.kiosk-secenek\b[\s\S]*?py-5/.test(css), "`.kiosk-secenek` satırı kalın dolgulu (72px'lik hedef)");
kontrol(/\.kiosk-secenek\b[\s\S]*?focus-visible:ring/.test(css), "`.kiosk-secenek` odak halkası taşıyor");
kontrol(/\.input-base\b[\s\S]*?focus:ring/.test(css), "metin alanı odak halkası taşıyor");

/* ── 2. Kiosk yüzeyinde KOKPİT düğme sınıfları yok ──────────────────────────
   `.btn-icon` 36px, `.btn-primary`/`.btn-ghost` ~44px. Üçü de eldivenle
   ıskalanıyor; kioskta yerleri yok. */
const KOKPIT_SINIFLARI = ["btn-icon", "btn-primary", "btn-ghost"];
for (const sinif of KOKPIT_SINIFLARI) {
  // `kiosk-btn-primary` kokpit sınıfı DEĞİL; önüne tire gelen eşleşme elenir.
  const kacaklar = kioskDosyalari.filter((d) => new RegExp(`(?<![\\w-])${sinif}(?![\\w-])`).test(d.metin));
  kontrol(
    kacaklar.length === 0,
    kacaklar.length === 0
      ? `kiosk yüzeyinde \`${sinif}\` kullanılmıyor`
      : `kiosk yüzeyinde kokpit sınıfı \`${sinif}\`: ${kacaklar.map((k) => k.yol).join(", ")}`,
  );
}

/* ── 3. Her düğme ya kiosk sınıfı taşır ya da 72px'i açıkça yazar ───────────
   Çıkış (×) düğmesi gibi görsel olarak sade duran hedefler de KUTU olarak
   büyük olmalı; küçük görünmesi küçük olmasını gerektirmiyor. */
// Sınıf adı düz dizede de olabilir şablon dizesinde de — açılış etiketinin
// tamamına bakılır.
const DUGME_ISTISNA = /(kiosk-btn|kiosk-secenek|h-\[72px\]|min-h-\[72px\])/;
for (const d of kioskDosyalari) {
  const dugmeler = acilisEtiketleri(d.metin, "button");
  const kucukler = dugmeler.filter((b) => !DUGME_ISTISNA.test(b));
  kontrol(
    kucukler.length === 0,
    kucukler.length === 0
      ? `${d.yol}: bütün düğmeler 72px hedefinde`
      : `${d.yol}: 72px altında düğme var → ${kucukler[0].replace(/\s+/g, " ").slice(0, 90)}`,
  );
}

/* ── 4. Simge-yalnız düğmede etiket var ─────────────────────────────────────
   İçinde yalnız `<Icon .../>` olan bir düğme ekran okuyucuda "düğme" diye
   okunur — hangi düğme olduğu söylenmez. */
for (const d of kioskDosyalari) {
  const blok = d.metin.match(/<button[\s\S]*?<\/button>/g) ?? [];
  const etiketsiz = blok.filter((b) => {
    const govde = b.replace(/<button[\s\S]*?>/, "").replace(/<\/button>/, "");
    const yaziVar = govde.replace(/<Icon[^/]*\/>/g, "").replace(/[\s{}]/g, "") !== "";
    return !yaziVar && !/aria-label=/.test(b);
  });
  kontrol(
    etiketsiz.length === 0,
    etiketsiz.length === 0
      ? `${d.yol}: simge-yalnız düğmelerin etiketi var`
      : `${d.yol}: etiketsiz simge düğmesi → ${etiketsiz[0].replace(/\s+/g, " ").slice(0, 90)}`,
  );
}

/* ── 5. Her <img> alt taşır ────────────────────────────────────────────────
   Kiosk görselleri süs değil, çoğu zaman kuralın kendisi. */
for (const d of tumTsx) {
  const gorseller = d.metin.match(/<img[\s\S]*?\/>/g) ?? [];
  const altsiz = gorseller.filter((g) => !/\balt=/.test(g));
  kontrol(
    altsiz.length === 0,
    altsiz.length === 0 ? `${d.yol}: görsellerde alt var` : `${d.yol}: alt metni olmayan görsel`,
  );
}

/* ── 6. Native `confirm()` YOK ──────────────────────────────────────────────
   Kurumsal/kiosk Chrome profillerinde tamamen bastırılabiliyor: kullanıcı
   "sildim ama olmadı" diyor, oysa diyalog hiç açılmamış. */
const nativeOnay = tumTsx.filter((d) => /(?<![\w.])confirm\s*\(\s*["'`]/.test(d.metin));
kontrol(
  nativeOnay.length === 0,
  nativeOnay.length === 0 ? "hiçbir yerde native confirm() yok" : `native confirm(): ${nativeOnay.map((d) => d.yol).join(", ")}`,
);

/* ── 7. Hata kutuları duyuruluyor ──────────────────────────────────────────
   Ekranın ortasında beliren kırmızı kutu, ekranı görmeyen kişiye hiçbir şey
   söylemiyordu. */
// YALNIZ metin kutuları: `uyari` kartı da kırmızıdır ama o İÇERİKtir, bir
// olay bildirimi değil — canlı bölge yapılırsa her sayfa geçişinde okunur.
for (const d of kioskDosyalari) {
  const kutular = (d.metin.match(/<p[\s\S]{0,400}?>/g) ?? []).filter((p) => /bg-brand-soft|bg-orta/.test(p));
  const duyurusuz = kutular.filter((p) => !/role="(alert|status)"/.test(p));
  kontrol(
    duyurusuz.length === 0,
    duyurusuz.length === 0
      ? `${d.yol}: hata/uyarı metinleri duyuruluyor (role)`
      : `${d.yol}: role taşımayan uyarı metni → ${duyurusuz[0].replace(/\s+/g, " ").slice(0, 90)}`,
  );
}

/* ── 8. İlerleme çubuğu rolü ───────────────────────────────────────────────
   Renk tek başına bilgi taşıyamaz. */
const oyun = kioskDosyalari.find((d) => d.yol.endsWith("components/oyun/EgitimOyun.tsx"));
kontrol(!!oyun, "oynatıcı bulundu");
kontrol(oyun && /role="progressbar"/.test(oyun.metin), "ilerleme çubuğunun rolü tanımlı");
kontrol(oyun && /aria-valuenow=/.test(oyun.metin), "ilerleme çubuğu değerini bildiriyor");

/* ── 9. Sınav şıkları radyo/onay kutusu ────────────────────────────────────
   Tek seçimlik soruda kaç şıktan kaçının seçilebileceğini rol söyler. */
kontrol(oyun && /role=\{cokluSecim \? "checkbox" : "radio"\}/.test(oyun.metin), "şıklar radyo/onay kutusu rolü taşıyor");
kontrol(oyun && /aria-checked=/.test(oyun.metin), "şıkların seçili durumu duyuruluyor");
kontrol(oyun && /radiogroup/.test(oyun.metin), "tek seçimlik sorular radyo grubunda");

/* ── 10. Sicil alanının etiketi var ────────────────────────────────────────
   Yer tutucu (`placeholder`) etiket DEĞİLDİR: yazmaya başlayınca kaybolur. */
const kiosk = kioskDosyalari.find((d) => d.yol.endsWith("app/kiosk/Kiosk.tsx"));
kontrol(!!kiosk, "kiosk ekranı bulundu");
kontrol(
  kiosk && (/<label[^>]*htmlFor="kiosk-sicil"/.test(kiosk.metin) || /aria-label="Sicil/.test(kiosk.metin)),
  "sicil alanının etiketi var",
);

/* ── 11. Otomatik odak kaçışı kapatılmamış ─────────────────────────────────
   Kart okuyucu için odak alanda tutuluyor AMA koşulsuz geri çekmek klavyeyle
   "Devam" düğmesine ulaşmayı imkânsız kılıyordu. Koşul (relatedTarget) yerinde
   duruyor mu? */
kontrol(kiosk && /relatedTarget/.test(kiosk.metin), "odak geri çekme koşullu — klavye kullanıcısı kilitlenmiyor");

/* ── 12. Hareket azaltma tercihi karşılanıyor ──────────────────────────────── */
kontrol(/prefers-reduced-motion/.test(css), "hareket azaltma tercihi karşılanıyor");

/* ── 13. Renk kontrastı — durum metni koyu tonda ────────────────────────────
   `#16a34a` beyaz üstünde 3.30:1, WCAG AA'nın 4.5:1 eşiğini geçmiyor. Metinde
   koyu karşılıkları kullanılmalı. */
const tw = readFileSync("tailwind.config.ts", "utf8");
esit(/iyi:\s*\{[^}]*dark:\s*"(#[0-9a-f]{6})"/i.exec(tw)?.[1], "#15803d", "iyi/dark metin tonu duruyor");
esit(/orta:\s*\{[^}]*dark:\s*"(#[0-9a-f]{6})"/i.exec(tw)?.[1], "#b45309", "orta/dark metin tonu duruyor");
const acikDurumMetni = tumTsx.filter((d) => /text-(iyi|orta)(?!-dark)\b/.test(d.metin));
kontrol(
  acikDurumMetni.length === 0,
  acikDurumMetni.length === 0
    ? "durum renkleri metinde koyu tonuyla kullanılıyor"
    : `açık durum tonu metinde: ${acikDurumMetni.map((d) => d.yol).join(", ")}`,
);

/* ── 14. Kiosk dayanıklılığı yerinde ───────────────────────────────────────
   Wake Lock / donma bekçisi / gece yenilemesi. Üçü de görünmez çalışır ve
   çalışmadıklarında kimse fark etmez — bu yüzden varlıkları sınavla tutulur. */
const bekci = kioskDosyalari.find((d) => d.yol.endsWith("components/oyun/KioskBekci.tsx"));
kontrol(!!bekci, "kiosk bekçisi bulundu");
kontrol(bekci && /wakeLock/.test(bekci.metin), "ekran uyanık tutuluyor (Wake Lock)");
kontrol(bekci && /visibilitychange/.test(bekci.metin), "sekme geri gelince kilit YENİDEN alınıyor");
kontrol(bekci && /location\.reload\(\)/.test(bekci.metin), "donma/gece yenilemesi var");
kontrol(bekci && /navigator\.onLine/.test(bekci.metin), "ağ kopması ekranda görünüyor");
// EN KRİTİK: oturum sürerken yenileme YOK — yarım oturum ve kaybolmuş imza demek.
kontrol(bekci && /if \(mesgulRef\.current\) return;/.test(bekci.metin), "meşgulken hiçbir yenileme yapılmıyor");
kontrol(
  kiosk && /<KioskBekci mesgul \/>/.test(kiosk.metin),
  "kiosk oyun ekranında bekçi meşgul kipinde",
);

/* ── 15. Ağ koptuğunda kilit açılıyor ──────────────────────────────────────
   Sunucu eylemi reddedilince `kilit.current = false` satırına hiç gelinmiyor,
   düğme sessizce ölüyordu. Tek çare tableti yeniden başlatmaktı.

   LİSTE KİOSK KLASÖRLERİNDEN DEĞİL, ELLE YAZILIYOR — ve bu bilinçli.
   Kural eskiden `kioskDosyalari` üzerinden ölçülüyordu; o küme yalnız üç
   kiosk kökünü kapsadığı için AMİR TABLETİ (`/ekibim`) kuralın dışında kaldı
   ve orada gerçekten uygulanmamıştı (11 Ağustos 2026 incelemesi). Kusur
   kodda değil, sınavın KAPSAMINDA idi.

   Ölçüt "dokunmatik, tek elle kullanılan, sunucu eylemi başlatan yüzey";
   `/ekibim` kokpit sınıflarını kullandığı için kiosk stil kümesine
   giremiyor ama ağ kuralı onun için de geçerli. Buraya yeni bir oynatma
   yüzeyi eklendiğinde bu listeye de eklenmeli. */
const AG_KURALI = [
  "app/kiosk/Kiosk.tsx",
  "components/oyun/EgitimOyun.tsx",
  "app/ziyaretci/oyna/[id]/Tablet.tsx",
  "app/ekibim/Ekip.tsx",
];
for (const ad of AG_KURALI) {
  const d = tumTsx.find((x) => x.yol.endsWith(ad));
  kontrol(!!d, `${ad}: dosya bulundu`);
  kontrol(d && /\} catch \{/.test(d.metin), `${ad}: sunucu eylemi hatası yakalanıyor`);
}

bitir("erişilebilirlik");
