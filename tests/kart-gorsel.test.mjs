/**
 * KART GÖRSEL KÜMESİ — tek gerçek mi?
 *
 * Bu sınav bir hatanın mezar taşı. `kartGorselleri` ÜÇ yerde vardı ve ikisi
 * farklı şey yapıyordu: editör/yayın kontrolü tarafındaki liste doluysa tekil
 * `gorselId`'yi atıyor, kiosk oynatıcısındaki onu listenin başına koyuyordu.
 * Yani YAYIN ÖNCESİ KONTROLÜN GÖRDÜĞÜ küme ile SAHANIN ÇİZDİĞİ küme farklı
 * işlevlerden geliyordu. İkisi de yorumunda "TEK YERDE" diyordu.
 *
 * Bugün patlamıyordu çünkü tüm yazıcılar `gorselId === gorselIdler[0]`
 * değişmezini koruyor — o değişmezi bozan tek bir yazıcı yeterdi. Aşağıdaki
 * 3. bölüm tam olarak o bozuk veriyi kurup üç çağırma yolunun AYNI cevabı
 * verdiğini ölçüyor.
 *
 * Koşum: `node --experimental-strip-types tests/kart-gorsel.test.mjs`
 */
import { kartGorselleri, gorselYamasi, siraDegistir, gorselMi, boyutMetni } from "../src/lib/editorMedya.ts";
import { onceSonra } from "../src/lib/kartVeri.ts";

let gecen = 0;
let kalan = 0;

function esit(ad, bulunan, beklenen) {
  const a = JSON.stringify(bulunan);
  const b = JSON.stringify(beklenen);
  if (a === b) {
    gecen++;
  } else {
    kalan++;
    console.error(`  ✗ ${ad}\n    beklenen: ${b}\n    bulunan : ${a}`);
  }
}

function dogru(ad, kosul) {
  esit(ad, !!kosul, true);
}

/* ── 1. temel anlam: liste doluysa GERÇEK odur ────────────────────────────── */

esit("boş kart boş liste verir", kartGorselleri({ gorselIdler: [] }), []);
esit("yalnız tekil alan tek görsel sayılır", kartGorselleri({ gorselId: "a.png", gorselIdler: [] }), ["a.png"]);
esit("liste doluysa liste döner", kartGorselleri({ gorselId: "a.png", gorselIdler: ["a.png", "b.png"] }), [
  "a.png",
  "b.png",
]);
esit("liste alanı hiç yoksa (eski satır) tekil alan okunur", kartGorselleri({ gorselId: "a.png" }), ["a.png"]);
esit("hiçbir alan yoksa boş", kartGorselleri({}), []);

/* ── 2. bozuk veriye dayanıklılık ─────────────────────────────────────────── */

esit("boş dizeler elenir", kartGorselleri({ gorselIdler: ["", "b.png", ""] }), ["b.png"]);
esit("tekrar eden kimlik bir kez çizilir", kartGorselleri({ gorselIdler: ["a.png", "a.png", "b.png"] }), [
  "a.png",
  "b.png",
]);
esit("tümü boş dizeyse boş liste", kartGorselleri({ gorselIdler: ["", ""] }), []);
esit("boş dizelik tekil alan görsel sayılmaz", kartGorselleri({ gorselId: "", gorselIdler: [] }), []);

/* ── 3. AYRIŞMANIN KENDİSİ — değişmez bozulduğunda üç yol da aynı demeli ──
   `gorselId` listenin ilki DEĞİL. Eski kodda:
     editör  → ["b.png"]          (tekil alanı atıyordu)
     kiosk   → ["a.png","b.png"]  (tekil alanı başa koyuyordu)
   Artık ikisi de aynı işlevi çağırıyor; `onceSonra` da öyle. */

const bozuk = { gorselId: "a.png", gorselIdler: ["b.png", "c.png"] };
esit("değişmez bozukken liste kazanır (tek anlam)", kartGorselleri(bozuk), ["b.png", "c.png"]);

const os = onceSonra(bozuk);
esit("onceSonra AYNI kümeden okuyor — önce", os.onceId, "b.png");
esit("onceSonra AYNI kümeden okuyor — sonra", os.sonraId, "c.png");

/* Oynatıcı tarafı aynı işlevi yeniden dışa aktarıyor mu? İçe aktarma yolu
   değişmedi ama arkasındaki gerçek tek olmalı. */
const { kartGorselleri: oynaticininki } = await import("../src/components/oyun/gorseller.ts");
dogru("oynatıcı ile lib AYNI işlevi paylaşıyor", oynaticininki === kartGorselleri);
esit("oynatıcı yolundan da aynı cevap", oynaticininki(bozuk), ["b.png", "c.png"]);

/* ── 4. yazıcı ile okuyucu birbirini tutuyor mu? ──────────────────────────
   `gorselYamasi` sınavsızdı — oysa `gorselId === gorselIdler[0]` değişmezini
   KURAN yer orası. Bozulursa 3. bölümdeki durum gerçek veride doğar. */

for (const idler of [[], ["a.png"], ["a.png", "b.png"], ["x.jpg", "y.jpg", "z.jpg"]]) {
  const yama = gorselYamasi(idler);
  esit(`yama tekil alanı listenin ilkinden türetiyor (${idler.length})`, yama.gorselId, idler[0] ?? null);
  esit(`yama listeyi olduğu gibi taşıyor (${idler.length})`, yama.gorselIdler, idler);
  /* Yamanın ürettiği kart geri okunduğunda aynı listeyi vermeli — yazma ile
     okumanın kapandığı yer burası. */
  esit(
    `yaz → oku turu aynı listeyi veriyor (${idler.length})`,
    kartGorselleri({ gorselId: yama.gorselId ?? undefined, gorselIdler: yama.gorselIdler }),
    idler,
  );
}

/* ── 5. sıra değiştirme ───────────────────────────────────────────────────── */

esit("bir öne alır", siraDegistir(["a", "b", "c"], 1, -1), ["b", "a", "c"]);
esit("bir arkaya alır", siraDegistir(["a", "b", "c"], 1, 1), ["a", "c", "b"]);
esit("baştan yukarı gitmez", siraDegistir(["a", "b"], 0, -1), ["a", "b"]);
esit("sondan aşağı gitmez", siraDegistir(["a", "b"], 1, 1), ["a", "b"]);
esit("sıra değiştirme özgün listeyi bozmaz", (() => {
  const l = ["a", "b"];
  siraDegistir(l, 0, 1);
  return l;
})(), ["a", "b"]);

/* ── 6. kimlikten tür ve boyut ────────────────────────────────────────────── */

dogru("png görsel", gorselMi("mdy_x.png"));
dogru("büyük harfli JPEG görsel", gorselMi("mdy_x.JPEG"));
dogru("webp görsel", gorselMi("mdy_x.webp"));
dogru("mp4 görsel DEĞİL", !gorselMi("mdy_x.mp4"));
dogru("uzantısız kimlik görsel değil", !gorselMi("mdy_x"));

esit("sıfır boyut çizgi", boyutMetni(0), "—");
esit("küçük dosya KB", boyutMetni(2048), "2 KB");
esit("çok küçük dosya en az 1 KB", boyutMetni(10), "1 KB");
esit("büyük dosya MB", boyutMetni(3 * 1024 * 1024), "3.0 MB");

console.log(
  kalan === 0 ? `kart görseli: ${gecen}/${gecen} ✓` : `kart görseli: ${gecen}/${gecen + kalan} — ${kalan} KALDI`,
);
process.exit(kalan === 0 ? 0 : 1);
