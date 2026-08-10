/**
 * Sınav motoru sınavı — `npm test`
 *
 * NEDEN: buradan çıkan "geçti/kaldı" kurumun eğitim kaydına yazılıyor. Yanlış
 * puanlama denetimde "eğitimi almış" görünen ama almamış bir personel üretir.
 */
import {
  sinaviKur,
  puanla,
  soruDogruMu,
  gectiMi,
  karistir,
  tohumla,
  zorSorular,
  kolaySorular,
  siralamaDogruMu,
  eslestirmeDogruMu,
  eslestirmeCifti,
  bolgeCoz,
  bolgeVurusu,
} from "../src/lib/sinav.ts";
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

/* ══ YENİ SORU TİPLERİ ══════════════════════════════════════════════════════
   Dördü de cevabı `number[]` olarak veriyor ama ÜÇÜ FARKLI kural işletiyor.
   En tehlikelisi sıralama: küme karşılaştırması cevabı sıralıyor, yani yanlış
   sıralayan herkesi doğru sayardı — ve bunu kimse fark etmezdi, çünkü soru
   "cevaplanmış" görünür. */

const tipli = (tip, secenekler, dogru = []) => ({
  id: "s",
  egitimId: "e",
  tip,
  metin: "",
  secenekler,
  dogru,
});

/* ── sıralama: SIRA ÖNEMLİ ───────────────────────────────────────────────── */
const sira3 = tipli("siralama", ["önce", "sonra", "en son"]);
kontrol(soruDogruMu(sira3, [0, 1, 2]), "doğru sıra geçer");
kontrol(!soruDogruMu(sira3, [1, 0, 2]), "iki adım yer değiştirince KALIR");
kontrol(!soruDogruMu(sira3, [2, 1, 0]), "ters sıra kalır");
kontrol(!soruDogruMu(sira3, [0, 1]), "eksik sıralama kalır");
kontrol(!soruDogruMu(sira3, [0, 1, 2, 2]), "fazla eleman kalır");
kontrol(!soruDogruMu(sira3, []), "boş cevap kalır");
kontrol(siralamaDogruMu(tipli("siralama", []), []), "şıksız sıralama boş cevapla tutarlı");

/* ── eşleştirme: konum = eşleşme ─────────────────────────────────────────── */
const esl = tipli("eslestirme", ["Kask | Baş", "Gözlük | Göz", "Eldiven | El"]);
kontrol(soruDogruMu(esl, [0, 1, 2]), "hepsi doğru eşlenince geçer");
kontrol(!soruDogruMu(esl, [1, 0, 2]), "iki eşleşme karışınca kalır");
/* KISMİ DOĞRUYA PUAN YOK — çoklu seçimdeki kuralın aynısı. */
kontrol(!soruDogruMu(esl, [0, 1]), "eksik eşleştirme kalır (kısmi doğru geçmez)");

esit(eslestirmeCifti("Kask | Baş"), { sol: "Kask", sag: "Baş" }, "çift ayrılır");
esit(eslestirmeCifti("  Kask  |  Baş  "), { sol: "Kask", sag: "Baş" }, "boşluklar kırpılır");
esit(eslestirmeCifti("ayırıcısız"), { sol: "ayırıcısız", sag: "" }, "ayırıcı yoksa sağ boş");

/* ── boşluk doldurma: çoktan seçmeliyle aynı puanlanır ───────────────────── */
const bosluk = tipli("bosluk", ["kilitlenir", "kapatılır", "işaretlenir"], [0]);
kontrol(soruDogruMu(bosluk, [0]), "doğru şık geçer");
kontrol(!soruDogruMu(bosluk, [1]), "yanlış şık kalır");
kontrol(!soruDogruMu(bosluk, [0, 1]), "iki şık işaretlemek geçmez");

/* ── görselde işaretleme ─────────────────────────────────────────────────── */
const gorsel = tipli("gorselIsaret", ["10,10,20,20 | açık şalter", "60,60,20,20 | dağınık kablo", "0,80,10,10 | temiz alan"], [0, 1]);
kontrol(soruDogruMu(gorsel, [0, 1]), "iki tehlikeyi de işaretleyen geçer");
kontrol(soruDogruMu(gorsel, [1, 0]), "işaretleme SIRASI önemsizdir");
kontrol(!soruDogruMu(gorsel, [0]), "bir tehlikeyi kaçıran kalır");
kontrol(!soruDogruMu(gorsel, [0, 1, 2]), "güvenli bölgeyi de işaretleyen kalır");

esit(bolgeCoz("10,20,30,40 | şalter"), { x: 10, y: 20, g: 30, y2: 40, etiket: "şalter" }, "bölge çözülür");
esit(bolgeCoz("10,20,30,40"), { x: 10, y: 20, g: 30, y2: 40, etiket: "" }, "etiketsiz bölge");
esit(bolgeCoz("bozuk"), null, "bozuk bölge null döner (kart çökmez)");
esit(bolgeCoz("10,20 | eksik"), null, "eksik ölçü null döner");

/* Vuruş testi: ölçüler YÜZDE olduğu için cihaz genişliğinden bağımsız. */
const bolgeler = ["10,10,20,20 | a", "50,50,20,20 | b"];
esit(bolgeVurusu(bolgeler, 15, 15), [0], "ilk bölgenin içi");
esit(bolgeVurusu(bolgeler, 55, 55), [1], "ikinci bölgenin içi");
esit(bolgeVurusu(bolgeler, 90, 90), [], "boşluğa tıklamak hiçbir bölge vermez");
esit(bolgeVurusu(bolgeler, 30, 30), [0], "kenar dahildir (sınırda kalan tıklama kaybolmaz)");
esit(bolgeVurusu(["bozuk", "10,10,20,20 | a"], 15, 15), [1], "bozuk bölge atlanır, sağlam olan bulunur");

/* ── doğrusu işaretlenmemiş soru ─────────────────────────────────────────
   Küme karşılaştırması boş `dogru` ile boş cevabı eşit sayıyordu: hazırlayan
   doğru şıkkı işaretlemeyi unutmuşsa, soruyu BOŞ BIRAKAN herkes puan alıyordu.
   Sessiz ve tam ters yönde bir hata. */
const dogrusuz = tipli("coktanSecmeli", ["a", "b"], []);
kontrol(!soruDogruMu(dogrusuz, []), "doğrusu işaretlenmemiş soru boş cevaba PUAN VERMEZ");
kontrol(!soruDogruMu(dogrusuz, [0]), "doğrusu işaretlenmemiş soruda hiçbir şık doğru değildir");

/* Puanlama bütünü: yeni tipler karışık bir sınavda doğru sayılıyor mu? */
const karisikSinav = [
  { ...tipli("siralama", ["a", "b"]), id: "q1" },
  { ...tipli("eslestirme", ["A | 1", "B | 2"]), id: "q2" },
  { ...tipli("gorselIsaret", ["0,0,50,50 | x"], [0]), id: "q3" },
];
const sonuc = puanla(karisikSinav, { q1: [0, 1], q2: [1, 0], q3: [0] });
esit(sonuc.dogruSayisi, 2, "yalnız yanlış eşleştirme düşer");
esit(sonuc.yanlisSoruIdleri, ["q2"], "düşen soru doğru işaretlenir");

/* ── kolay sorular: zor sorunun simetriği ────────────────────────────────── */
{
  const ist = [
    { soruId: "a", deneme: 20, yanlis: 0 },  // hiç yanlış yok, yeterince denendi
    { soruId: "b", deneme: 3, yanlis: 0 },   // yanlış yok AMA az denendi
    { soruId: "c", deneme: 20, yanlis: 1 },  // bir kişi yanlış yapmış
  ];
  esit(kolaySorular(ist), ["a"], "yalnız yeterince denenmiş ve hiç yanlış yapılmamış soru kolay sayılır");
  esit(kolaySorular([]), [], "istatistik yoksa kolay soru yok");
}

bitir("sinav");
