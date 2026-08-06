/**
 * Sınav motoru sınavı — `npm test`
 *
 * NEDEN: buradan çıkan "geçti/kaldı" kurumun eğitim kaydına yazılıyor. Yanlış
 * puanlama denetimde "eğitimi almış" görünen ama almamış bir personel üretir.
 */
import { sinaviKur, puanla, soruDogruMu, gectiMi, karistir, tohumla, zorSorular } from "../src/lib/sinav.ts";
import { kontrol, esit, bitir } from "./yardim.mjs";

const soru = (id, dogru, tip = "coktanSecmeli") => ({
  id,
  egitimId: "e",
  tip,
  metin: id,
  secenekler: ["A", "B", "C", "D"],
  dogru,
});

// ── tek soru doğruluğu ──────────────────────────────────────────────────────
kontrol(soruDogruMu(soru("s1", [2]), [2]), "tek doğru şık işaretlendi");
kontrol(!soruDogruMu(soru("s1", [2]), [1]), "yanlış şık");
kontrol(!soruDogruMu(soru("s1", [2]), []), "boş cevap yanlıştır");
kontrol(soruDogruMu(soru("s1", [0, 2], "cokluSecim"), [2, 0]), "çoklu seçimde sıra önemsiz");
// HEP YA DA HİÇ: güvenlik eğitiminde "üç önlemden ikisini biliyorum" geçmez.
kontrol(!soruDogruMu(soru("s1", [0, 2], "cokluSecim"), [0]), "çoklu seçimde eksik işaret yanlıştır");
kontrol(!soruDogruMu(soru("s1", [0, 2], "cokluSecim"), [0, 1, 2]), "çoklu seçimde fazla işaret yanlıştır");
kontrol(soruDogruMu(soru("s1", [0], "dogruYanlis"), [0, 0]), "yinelenen işaret tekilleştirilir");

// ── puanlama ────────────────────────────────────────────────────────────────
const sorular = [soru("a", [0]), soru("b", [1]), soru("c", [2]), soru("d", [3])];
esit(puanla(sorular, { a: [0], b: [1], c: [2], d: [3] }).puan, 100, "hepsi doğru → 100");
esit(puanla(sorular, { a: [0], b: [1], c: [2], d: [0] }).puan, 75, "3/4 → 75");
esit(puanla(sorular, {}).puan, 0, "hiç cevaplanmadı → 0");
esit(puanla(sorular, { a: [0], b: [1], c: [2], d: [0] }).yanlisSoruIdleri, ["d"], "yanlış soru kimlikleri döner");
// Soru yoksa 0: "soru eklemeyi unuttum" diye herkesin geçmesi felaket olurdu.
esit(puanla([], {}).puan, 0, "soru yoksa puan 0 — herkes geçmez");
esit(puanla([soru("a", [0]), soru("b", [1]), soru("c", [2])], { a: [0], b: [1] }).puan, 67, "2/3 yuvarlanır");

kontrol(gectiMi(70, 70), "eşik dahil geçer");
kontrol(!gectiMi(69, 70), "eşiğin altı kalır");

// ── tohumlu karıştırma ──────────────────────────────────────────────────────
const havuz = Array.from({ length: 20 }, (_, i) => soru(`q${i}`, [0]));
const t = tohumla("otr_abc");
esit(
  sinaviKur(havuz, 5, true, t).map((s) => s.id),
  sinaviKur(havuz, 5, true, t).map((s) => s.id),
  "aynı tohum aynı seti verir — yenile tuşuyla kolay set aranamaz",
);
kontrol(
  JSON.stringify(sinaviKur(havuz, 5, true, tohumla("otr_abc")).map((s) => s.id)) !==
    JSON.stringify(sinaviKur(havuz, 5, true, tohumla("otr_xyz")).map((s) => s.id)),
  "farklı oturum farklı set alır — aynı dokunma deseni 12 kere işlemez",
);
esit(sinaviKur(havuz, 5, true, t).length, 5, "istenen sayıda soru gelir");
esit(sinaviKur(havuz, 50, true, t).length, 20, "havuzdan fazlası istenirse havuz kadar gelir");
esit(
  sinaviKur(havuz, 3, false, t).map((s) => s.id),
  ["q0", "q1", "q2"],
  "karışık kapalıysa havuz sırası korunur",
);
esit(new Set(sinaviKur(havuz, 20, true, t).map((s) => s.id)).size, 20, "karıştırma soru kaybetmez/çoğaltmaz");
esit(karistir([1, 2, 3], 7).length, 3, "karıştırma uzunluğu korur");

// ── içerik kalite sinyali ───────────────────────────────────────────────────
const ist = [
  { soruId: "kolay", deneme: 50, yanlis: 5 },
  { soruId: "zor", deneme: 50, yanlis: 39 },
  { soruId: "az-veri", deneme: 4, yanlis: 4 },
];
esit(zorSorular(ist).map((z) => z.soruId), ["zor"], "yalnız çoğunluğun yanlış yaptığı soru işaretlenir");
// Az denemeli soru işaretlenmez: 4 kişiden 4'ü yanlış yaptı diye içerik
// suçlanamaz — desen değil rastlantı olabilir.
kontrol(!zorSorular(ist).some((z) => z.soruId === "az-veri"), "az denemeli soru sinyal sayılmaz");

bitir("sinav");
