/**
 * Ziyaretçi mantığı sınavı — `npm test`
 *
 * NEDEN SINAVLI: burada verilen karar "bu kişi sahaya girmeden önce neyi
 * izleyecek". Yanlışı iki yönde de sessizdir — fazla verirse ziyaretçi
 * sıkılır ve kimse şikâyet etmez; EKSİK verirse kimse fark etmez, çünkü
 * ziyaretçi kendisine ne verilmesi gerektiğini bilmez. Fark edildiği an,
 * kaza olduktan sonradır.
 */
import {
  egitimleriCoz,
  cevapEksikMi,
  eksikSorular,
  ilerleme,
  ayniGun,
  kayitHatasi,
} from "../src/lib/ziyaretci.ts";
import { kontrol, esit, bitir } from "./yardim.mjs";

const soru = (o) => ({
  id: "s1",
  sira: 1,
  metin: "Soru",
  tip: "evetHayir",
  secenekler: ["Evet", "Hayır"],
  eslesme: {},
  aktif: true,
  ...o,
});

// ── varsayılanlar ───────────────────────────────────────────────────────────
esit(JSON.stringify(egitimleriCoz([], [], {})), "[]", "hiçbir şey yoksa liste boş");
esit(
  JSON.stringify(egitimleriCoz(["genel"], [], {})),
  '["genel"]',
  "soru olmasa da varsayılan verilir",
);
// EN KRİTİK KURAL: zorunlu bilgilendirme her zaman listede ve HER ZAMAN başta.
esit(
  JSON.stringify(egitimleriCoz(["genel"], [soru({ eslesme: { 0: ["yukseklik"] } })], { s1: [0] })),
  '["genel","yukseklik"]',
  "varsayılan başta, soru eklediği sonra gelir",
);
esit(
  JSON.stringify(egitimleriCoz(["genel"], [soru({ eslesme: { 0: ["genel"] } })], { s1: [0] })),
  '["genel"]',
  "aynı eğitim iki kaynaktan gelse de bir kez verilir",
);

// ── şık eşlemesi ────────────────────────────────────────────────────────────
esit(
  JSON.stringify(egitimleriCoz([], [soru({ eslesme: { 0: ["yukseklik"] } })], { s1: [1] })),
  "[]",
  "eşlemesi olmayan şık hiçbir şey bağlamaz",
);
esit(
  JSON.stringify(egitimleriCoz([], [soru({ eslesme: { 0: ["a"], 1: ["b"] } })], { s1: [1] })),
  '["b"]',
  "işaretlenen şıkkın eğitimi gelir, ötekininki gelmez",
);
esit(
  JSON.stringify(
    egitimleriCoz([], [soru({ tip: "cokluSecim", secenekler: ["a", "b", "c"], eslesme: { 0: ["x"], 2: ["z"] } })], {
      s1: [0, 2],
    }),
  ),
  '["x","z"]',
  "çoklu seçimde her işaretli şık eklenir",
);
// Cevaplanmayan soru bilgilendirme BAĞLAMAZ — kapı burada değil kayıt
// ekranında (eksikSorular) kapanır; burada sessizce eklemek daha kötü olurdu.
esit(
  JSON.stringify(egitimleriCoz([], [soru({ eslesme: { 0: ["yukseklik"] } })], {})),
  "[]",
  "cevaplanmayan soru hiçbir şey bağlamaz",
);
esit(
  JSON.stringify(egitimleriCoz([], [soru({ aktif: false, eslesme: { 0: ["yukseklik"] } })], { s1: [0] })),
  "[]",
  "pasif soru cevaplansa bile bağlamaz",
);

// ── sıra ────────────────────────────────────────────────────────────────────
// Tablette bu sırayla akacak; soru sırası ekrandaki sırayla aynı olmalı.
esit(
  JSON.stringify(
    egitimleriCoz(
      [],
      [
        soru({ id: "s2", sira: 2, eslesme: { 0: ["ikinci"] } }),
        soru({ id: "s1", sira: 1, eslesme: { 0: ["birinci"] } }),
      ],
      { s1: [0], s2: [0] },
    ),
  ),
  '["birinci","ikinci"]',
  "çıktı soru sırasını izler, dizideki sırayı değil",
);

// ── eksik cevap ─────────────────────────────────────────────────────────────
kontrol(cevapEksikMi(soru({}), {}), "cevapsız soru eksiktir");
kontrol(!cevapEksikMi(soru({}), { s1: [0] }), "cevaplanan soru eksik değildir");
kontrol(cevapEksikMi(soru({}), { s1: [] }), "boş dizi cevap sayılmaz");
esit(eksikSorular([soru({}), soru({ id: "s2", aktif: false })], {}).length, 1, "pasif soru eksik listesine girmez");

// ── ilerleme ────────────────────────────────────────────────────────────────
esit(ilerleme([], []).durum, "bekliyor", "boş liste tamam sayılmaz");
esit(ilerleme(["a", "b"], []).durum, "bekliyor", "hiçbiri bitmediyse bekliyor");
esit(ilerleme(["a", "b"], ["a"]).durum, "basladi", "biri bittiyse başladı");
esit(ilerleme(["a", "b"], ["a", "b"]).durum, "tamam", "hepsi bittiyse tamam");
esit(ilerleme(["a", "b"], ["a"]).siradaki, "b", "sıradaki, bitmemişlerin ilki");
esit(ilerleme(["a", "b"], ["a", "b"]).siradaki, null, "hepsi bitince sıradaki yok");
esit(ilerleme(["a", "b"], ["a"]).biten, 1, "biten sayısı doğru");
// Listede olmayan bir eğitimin kaydı ilerlemeyi ŞİŞİRMEMELİ: eğitim listeden
// çıkarıldıysa eski kaydı "tamamlandı" saymaya yetmez.
esit(ilerleme(["a", "b"], ["a", "c"]).biten, 1, "listede olmayan biten sayılmaz");
esit(ilerleme(["a", "b"], ["a", "c"]).durum, "basladi", "yabancı kayıt tamam yapmaz");

// ── gün kırılımı ────────────────────────────────────────────────────────────
kontrol(ayniGun("2026-08-07T09:00:00.000Z", "2026-08-07T23:00:00.000Z"), "aynı günün iki saati aynı gündür");
kontrol(!ayniGun("2026-08-07T23:59:00.000Z", "2026-08-08T00:01:00.000Z"), "gece yarısı gün değiştirir");

// ── kayıt doğrulaması ───────────────────────────────────────────────────────
esit(kayitHatasi("Ali Veli"), null, "geçerli ad kabul edilir");
kontrol(kayitHatasi("") !== null, "boş ad reddedilir");
kontrol(kayitHatasi("  a  ") !== null, "boşluk kırpıldıktan sonra kısa kalan ad reddedilir");
kontrol(kayitHatasi("x".repeat(81)) !== null, "çok uzun ad reddedilir");

bitir("ziyaretçi");
