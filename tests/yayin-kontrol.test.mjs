/**
 * YAYINA HAZIRLIK ŞİDDET AYRIMI SINAVI — `npm test`
 *
 * NEDEN SINAVLI: liste "engellemez, söyler" ilkesiyle çalışıyor ve bu doğru —
 * zorunlu tutulan her kontrol ikinci haftada anlamsız bir metin yazılarak
 * aşılır. Ama her kusuru AYNI sarı satırda göstermek, "kioskta üstte boşluk
 * görünür" (kozmetik) ile "metni olmayan soru" (işçi ilerleyemez) arasındaki
 * farkı siliyordu. İnceleme sırasında "3 uyarı" rozetiyle yayınlanan bir
 * eğitimde işçinin karşısına cevaplanamayan bir soru ekranı çıktı.
 *
 * Buradaki ayrım GÖRSEL değil MANTIKSAL: hangi kusurun sahayı durdurduğu
 * kararı `yayinKontrolu` içinde veriliyor, rozet ve onay penceresi ona
 * bakıyor. Renk değişse de bu sınav ayakta kalır.
 */
import { yayinKontrolu } from "../src/lib/yayinKontrolu.ts";
import { kontrol, esit, bitir } from "./yardim.mjs";

const EGITIM = {
  id: "egt_1",
  ad: "Yüksekte Çalışma",
  surum: 1,
  durum: "taslak",
  hazirlayan: "h",
  gecmeNotu: 70,
  denemeHakki: 2,
  soruSayisi: 1,
  karisik: true,
  kategori: "",
  zorunlu: false,
  olusturma: "2026-01-01",
  guncelleme: "2026-01-01",
};

const KART = {
  id: "syf_1",
  egitimId: "egt_1",
  sira: 1,
  tip: "kural",
  baslik: "Emniyet kemeri",
  metin: "Her zaman tak.",
  gorselIdler: [],
  asgariSure: 8,
};

const SORU = {
  id: "sor_1",
  egitimId: "egt_1",
  tip: "coktanSecmeli",
  metin: "Kemer takılır mı?",
  secenekler: ["Evet", "Hayır"],
  dogru: [0],
};

const durumlari = (sayfalar, sorular) =>
  yayinKontrolu(EGITIM, sayfalar, sorular, []).map((k) => k.durum);
const kilitler = (sayfalar, sorular) =>
  yayinKontrolu(EGITIM, sayfalar, sorular, []).filter((k) => k.durum === "kilit");

/* ── Temiz eğitimde kilit yok ─────────────────────────────────────────────── */
esit(kilitler([KART], [SORU]).length, 0, "kusursuz eğitimde kilit yok");
kontrol(durumlari([KART], [SORU]).every((d) => d === "tamam"), "kusursuz eğitimde her satır tamam");

/* ── SAHADA KİLİTLEYENLER ─────────────────────────────────────────────────── */

const kilitDurumlari = [
  ["metni boş soru", [{ ...SORU, metin: "   " }]],
  ["boş şıklı soru", [{ ...SORU, secenekler: ["Evet", ""] }]],
  ["doğrusu işaretlenmemiş soru", [{ ...SORU, dogru: [] }]],
  ["görselsiz işaretleme sorusu", [{ ...SORU, tip: "gorselIsaret", gorselId: undefined, secenekler: [] }]],
  ["tek adımlı sıralama sorusu", [{ ...SORU, tip: "siralama", secenekler: ["Tek"], dogru: [] }]],
];
for (const [ad, sorular] of kilitDurumlari) {
  const k = kilitler([KART], sorular);
  kontrol(k.length > 0, `${ad} KİLİT olarak işaretleniyor`);
}

/* ── KOZMETİK KUSURLAR KİLİT DEĞİL ────────────────────────────────────────
   Ayrımın değeri burada: hepsi kilit sayılsaydı rozet yine tek renge döner ve
   fark yeniden kaybolurdu. */
const kozmetikler = [
  ["başlıksız kart", [{ ...KART, baslik: "" }], [SORU]],
  ["içeriksiz kart", [{ ...KART, metin: "" }], [SORU]],
  ["havuzdan küçük soru sayısı", [KART], [SORU]],
];
for (const [ad, sayfalar, sorular] of kozmetikler) {
  const liste = yayinKontrolu({ ...EGITIM, soruSayisi: 5 }, sayfalar, sorular, []);
  const k = liste.filter((x) => x.durum === "kilit");
  esit(k.length, 0, `${ad} kilit DEĞİL (uyarı olarak kalıyor)`);
  kontrol(liste.some((x) => x.durum === "uyari"), `${ad} yine de uyarı olarak söyleniyor`);
}

/* ── Sayfasızlık hâlâ tek gerçek ENGEL ────────────────────────────────────── */
const bos = yayinKontrolu(EGITIM, [], [], []);
kontrol(bos.some((k) => k.durum === "engel"), "sayfasız eğitim engel taşıyor");
esit(
  bos.filter((k) => k.durum === "engel").length,
  1,
  "engel tek satır — geri kalanı engellemez, söyler",
);

/* ── Sınavsız eğitim kusur DEĞİL ──────────────────────────────────────────
   "Okudum, onaylıyorum" kaydı geçerli bir kullanım; soru havuzunun boş olması
   kilit ya da uyarı üretmemeli. */
const sinavsiz = yayinKontrolu(EGITIM, [KART], [], []);
esit(sinavsiz.filter((k) => k.durum === "kilit").length, 0, "sınavsız eğitimde kilit yok");
kontrol(
  sinavsiz.some((k) => k.durum === "tamam" && /imzalı okuma/.test(k.metin)),
  "sınavsız eğitim bilgi satırıyla geçiyor",
);

/* ── Kilit metinleri SAHAYI anlatıyor ─────────────────────────────────────
   "boş şık var" kullanıcıya bir şey söylemiyor; "kioskta boş kutu görünür"
   söylüyor. Rozet rengi tek başına "önemli" der, "işçi durur" demez. */
const bosSikListe = kilitler([KART], [{ ...SORU, secenekler: ["Evet", ""] }]);
kontrol(
  /kiosk/i.test(bosSikListe[0].metin),
  `kilit metni sahada ne olacağını yazıyor (${bosSikListe[0].metin})`,
);

bitir("yayın kontrolü");
