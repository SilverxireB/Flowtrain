/**
 * AKTİF SÜZGEÇ ÇİPLERİ SINAVI.
 *
 * Flow süzgeç dilinde panel kapalı başlar ve uygulanınca toplanır; bedeli
 * de şu: kapalı panel neyin seçildiğini gizler. Çipler o bedeli ödüyor.
 * Yanlış çip listesi, olmayan çipten DAHA KÖTÜ — ekran yalan söyler.
 *
 * Koşum: `node --experimental-strip-types tests/suzgec-cipleri.test.mjs`
 */
import { suzgecCipleri } from "../src/lib/suzgecCipleri.ts";
import { kontrol, esit, bitir } from "./yardim.mjs";

const BOS = {
  sorgu: "",
  egitimId: "",
  bolum: "",
  kaynak: "",
  sonuc: "",
  baslangicGun: "",
  bitisGun: "",
};

const adlar = {
  egitimAdi: (id) => ({ egt_1: "İSG Temel", egt_2: "Yüksekte Çalışma" })[id],
  kaynakAdi: (k) => ({ kiosk: "Kiosk", amir: "Amir gözetiminde" })[k],
};

/* ── 1. boş süzgeç hiç çip üretmez ────────────────────────────────────────── */

esit(suzgecCipleri(BOS), [], "boş süzgeçte çip yok");
esit(suzgecCipleri({ ...BOS, sorgu: "   " }), [], "yalnız boşluk aramada çip yok");

/* ── 2. her alan kendi çipini üretir ──────────────────────────────────────── */

const hepsi = suzgecCipleri(
  { ...BOS, sorgu: "Betül", egitimId: "egt_1", bolum: "Montaj", kaynak: "amir", sonuc: "gecti" },
  adlar,
);
esit(hepsi.map((c) => c.anahtar), ["sorgu", "egitim", "bolum", "kaynak", "sonuc"], "beş alan beş çip");
esit(hepsi.find((c) => c.anahtar === "sorgu").deger, "Betül", "arama çipi sorguyu yazıyor");
esit(hepsi.find((c) => c.anahtar === "egitim").deger, "İSG Temel", "eğitim çipi ADI yazıyor, kimliği değil");
esit(hepsi.find((c) => c.anahtar === "kaynak").deger, "Amir gözetiminde", "kaynak çipi etiketi yazıyor");
esit(hepsi.find((c) => c.anahtar === "bolum").alan, "Bölüm", "alan adı okunur");

/* Arama çipi KIRPILMIŞ değeri taşır: baştaki/sondaki boşluk çipte durmaz. */
esit(suzgecCipleri({ ...BOS, sorgu: "  Ali  " })[0].deger, "Ali", "arama değeri kırpılıyor");

/* ── 3. ETİKET BULUNAMAZSA ham değer yazılır ──────────────────────────────── */

esit(
  suzgecCipleri({ ...BOS, egitimId: "egt_silinmis" }, adlar)[0].deger,
  "egt_silinmis",
  "adı bulunamayan eğitimde kimlik yazılıyor (sessiz boş çip değil)",
);
esit(suzgecCipleri({ ...BOS, egitimId: "egt_1" })[0].deger, "egt_1", "sözlük verilmezse ham değer");

/* ── 4. TARİH TEK ÇİP ─────────────────────────────────────────────────────── */

const aralik = suzgecCipleri({ ...BOS, baslangicGun: "2026-08-01", bitisGun: "2026-08-12" });
esit(aralik.length, 1, "başlangıç + bitiş TEK çip (kullanıcının kafasındaki tek 'aralık')");
esit(aralik[0].deger, "2026-08-01 – 2026-08-12", "aralık iki uçla yazılıyor");
esit(aralik[0].temizle, { baslangicGun: "", bitisGun: "" }, "tarih çipi İKİ ucu birden siliyor");

esit(
  suzgecCipleri({ ...BOS, baslangicGun: "2026-08-12", bitisGun: "2026-08-12" })[0].deger,
  "2026-08-12",
  "tek günlük aralık tek tarih yazıyor (2026-08-12 – 2026-08-12 değil)",
);

/* YARIM ARALIK GEÇERLİ bir süzgeçtir ve çipte görünmeli — boş bırakmak
   kullanıcıya "tarih süzgeci yok" dedirtirdi. */
esit(suzgecCipleri({ ...BOS, baslangicGun: "2026-08-01" })[0].deger, "2026-08-01 sonrası", "yalnız başlangıç");
esit(suzgecCipleri({ ...BOS, bitisGun: "2026-08-12" })[0].deger, "2026-08-12 öncesi", "yalnız bitiş");

/* ── 5. ÇİP EYLEM TAŞIR — yaması yalnız kendi alanını sıfırlar ────────────── */

for (const [alan, deger, beklenen] of [
  ["sorgu", "Ali", { sorgu: "" }],
  ["egitimId", "egt_1", { egitimId: "" }],
  ["bolum", "Montaj", { bolum: "" }],
  ["kaynak", "kiosk", { kaynak: "" }],
  ["sonuc", "gecti", { sonuc: "" }],
]) {
  const c = suzgecCipleri({ ...BOS, [alan]: deger })[0];
  esit(c.temizle, beklenen, `${alan} çipi yalnız kendi alanını temizliyor`);
}

/* Çip kaldırıldığında GERİYE KALAN süzgeç bozulmamalı. */
const cok = { ...BOS, bolum: "Montaj", sonuc: "gecti" };
const bolumCipi = suzgecCipleri(cok).find((c) => c.anahtar === "bolum");
const sonrasi = { ...cok, ...bolumCipi.temizle };
esit(sonrasi.sonuc, "gecti", "bir çipi kaldırmak diğer süzgeci düşürmüyor");
esit(suzgecCipleri(sonrasi).map((c) => c.anahtar), ["sonuc"], "kaldırılan çip listeden çıkıyor");

/* ── 6. anahtarlar TEKİL (liste çizimi için) ──────────────────────────────── */

const anahtarlar = suzgecCipleri(
  { sorgu: "a", egitimId: "b", bolum: "c", kaynak: "d", sonuc: "e", baslangicGun: "2026-01-01", bitisGun: "2026-01-02" },
).map((c) => c.anahtar);
esit(new Set(anahtarlar).size, anahtarlar.length, "çip anahtarları tekil");
kontrol(anahtarlar.length === 6, `dolu süzgeç altı çip veriyor (${anahtarlar.length})`);

bitir("süzgeç çipleri");
