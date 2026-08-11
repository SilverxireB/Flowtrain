/**
 * SÜRÜMLÜ YAYIN SINAVI — `npm test`
 *
 * NEDEN SINAVLI: bu işin bütün değeri "bu kişi tam olarak neyi izledi"
 * sorusuna cevap verebilmek. Buradaki hatalar sessizdir ve yıllar sonra,
 * denetimde, düzeltilemeyecekleri anda görünür:
 *  · anlık görüntü taslakla birlikte değişirse kayıt yine hiçbir şeye atıf
 *    yapmaz — iş yapılmamış olur;
 *  · sürüm numarası yeniden kullanılırsa iki farklı içerik tek numarada
 *    birleşir;
 *  · "yayındaki hâline dön" yarım dönerse hazırlayan geri aldığını sanır ve
 *    fark ettiği ilk yer saha olur.
 *
 * İKİ KATMAN: önce saf mantık (`surum.ts`) tek başına, sonra deponun gerçek
 * SQLite üstündeki davranışı. İkincisi geçici bir veri klasörü kurar,
 * kurulumun verisine dokunmaz.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  icerikImzasi,
  oynanacakYayin,
  sonYayin,
  sonrakiSurum,
  yayinlanmamisDegisiklikVar,
} from "../src/lib/surum.ts";
import { kontrol, esit, bitir } from "./yardim.mjs";

/* ══ 1. SAF MANTIK ═════════════════════════════════════════════════════════ */

/* ── Hangi sürüm oynatılacak ─────────────────────────────────────────────── */

esit(sonYayin([]), null, "yayını olmayan eğitimde son yayın yok");
esit(
  sonYayin([
    { surum: 1, yayinZamani: "2026-01-01T00:00:00.000Z" },
    { surum: 3, yayinZamani: "2026-03-01T00:00:00.000Z" },
    { surum: 2, yayinZamani: "2026-02-01T00:00:00.000Z" },
  ]).surum,
  3,
  "en büyük sürüm numarası seçilir (liste sırası önemsiz)",
);

/* SAAT DEĞİL SÜRÜM: kapalı ağdaki kutuda saat geri alınabilir ya da hiç
   kurulmamış olabilir. Zaman damgasına bakan bir seçim, saati bozuk bir
   makinede eski içeriği sahaya geri koyardı. */
esit(
  sonYayin([
    { surum: 1, yayinZamani: "2027-12-31T00:00:00.000Z" },
    { surum: 2, yayinZamani: "2020-01-01T00:00:00.000Z" },
  ]).surum,
  2,
  "zaman damgası ileri olsa bile küçük sürüm seçilmez",
);

const uc = [
  { surum: 1, yayinZamani: "2026-01-01T00:00:00.000Z" },
  { surum: 2, yayinZamani: "2026-02-01T00:00:00.000Z" },
];
esit(oynanacakYayin("yayin", uc).surum, 2, "yayındaki eğitim son sürümünü oynatır");
esit(oynanacakYayin("taslak", uc), null, "taslağa alınan eğitim sahaya ÇIKMAZ (görüntüsü dursa bile)");
esit(oynanacakYayin("yayin", []), null, "anlık görüntüsü olmayan eğitim oynatılamaz");

/* ── Yeni sürümün numarası ───────────────────────────────────────────────── */

esit(sonrakiSurum(1, null), 1, "hiç yayınlanmamış eğitimin ilk yayını 1. sürümdür");
esit(sonrakiSurum(1, 1), 2, "her yeni yayın bir artırır");
esit(sonrakiSurum(2, 2), 3, "artış son YAYINDAN devam eder");

/* GÖÇ YOLU: sürümlü yayından önce yayınlanıp taslağa alınmış eğitimin anlık
   görüntüsü yok ama `egitim.surum` kadar kayıt o numaraya atıf yapıyor. Aynı
   numarayı yeniden kullanmak iki farklı içeriği tek sürümde birleştirirdi. */
esit(sonrakiSurum(3, null, true), 4, "eski kurulumda yayınlanmış eğitimin numarası yeniden KULLANILMAZ");
esit(sonrakiSurum(3, null, false), 3, "hiç yayınlanmamış eğitimde numara olduğu gibi kalır");
esit(sonrakiSurum(5, 2), 6, "eğitim numarası yayından ileriyse ondan devam eder (numara geri gitmez)");
esit(sonrakiSurum(0, null), 1, "bozuk/sıfır numara 1'e çekilir");

/* ── İçerik imzası ───────────────────────────────────────────────────────── */

const AYAR = {
  ad: "Yüksekte Çalışma",
  gecmeNotu: 70,
  denemeHakki: 2,
  soruSayisi: 5,
  karisik: true,
  kategori: "İSG",
  zorunlu: true,
};
const KART = { tip: "kural", baslik: "Emniyet kemeri", metin: "Her zaman tak.", gorselIdler: [], asgariSure: 8 };
const SORU = { tip: "dogruYanlis", metin: "Kemer takılır.", secenekler: ["Doğru", "Yanlış"], dogru: [0] };
const taban = { ayarlar: AYAR, sayfalar: [KART], sorular: [SORU] };

esit(
  icerikImzasi(taban),
  icerikImzasi({ ayarlar: { ...AYAR }, sayfalar: [{ ...KART }], sorular: [{ ...SORU }] }),
  "aynı içerik aynı imzayı verir",
);

/* İMZA KİMLİK TAŞIMAZ: anlık görüntü ile taslak aynı kartı farklı satırlarda
   tutabilir. Kimlik imzaya girseydi rozet hiç sönmez, "yayınlanmamış
   değişiklik var" uyarısı kalıcı bir gürültüye dönerdi. */
esit(
  icerikImzasi({ ...taban, sayfalar: [{ ...KART, id: "syf_1" }] }),
  icerikImzasi({ ...taban, sayfalar: [{ ...KART, id: "syf_2" }] }),
  "kart kimliği imzaya GİRMEZ",
);

const farkli = [
  ["kart metni", { ...taban, sayfalar: [{ ...KART, metin: "Bazen tak." }] }],
  ["kart başlığı", { ...taban, sayfalar: [{ ...KART, baslik: "Kemer" }] }],
  ["kart tipi", { ...taban, sayfalar: [{ ...KART, tip: "uyari" }] }],
  ["asgari süre", { ...taban, sayfalar: [{ ...KART, asgariSure: 20 }] }],
  ["kart görseli", { ...taban, sayfalar: [{ ...KART, gorselId: "med_1" }] }],
  ["çoklu görsel", { ...taban, sayfalar: [{ ...KART, gorselIdler: ["med_1"] }] }],
  ["kart sayısı", { ...taban, sayfalar: [KART, { ...KART, baslik: "İkinci" }] }],
  ["kart SIRASI", { ...taban, sayfalar: [{ ...KART, baslik: "İkinci" }, KART] }],
  ["bölüm başlığı", { ...taban, sayfalar: [{ ...KART, bolum: "Acil durum" }] }],
  ["soru metni", { ...taban, sorular: [{ ...SORU, metin: "Kemer takılmaz." }] }],
  ["doğru cevap", { ...taban, sorular: [{ ...SORU, dogru: [1] }] }],
  ["şıklar", { ...taban, sorular: [{ ...SORU, secenekler: ["Evet", "Hayır"] }] }],
  ["soru sayısı", { ...taban, sorular: [] }],
  ["geçme notu", { ...taban, ayarlar: { ...AYAR, gecmeNotu: 90 } }],
  ["deneme hakkı", { ...taban, ayarlar: { ...AYAR, denemeHakki: 3 } }],
  ["sorulacak soru sayısı", { ...taban, ayarlar: { ...AYAR, soruSayisi: 3 } }],
  ["karıştırma", { ...taban, ayarlar: { ...AYAR, karisik: false } }],
  ["eğitim adı", { ...taban, ayarlar: { ...AYAR, ad: "Başka" } }],
  ["tekrar süresi", { ...taban, ayarlar: { ...AYAR, tekrarAy: 12 } }],
];
for (const [ne, icerik] of farkli) {
  kontrol(icerikImzasi(icerik) !== icerikImzasi(taban), `${ne} değişince imza değişir`);
}

/* Kart sırası imzaya SIRAYLA giriyor; iki kartı yer değiştirmek gerçek bir
   içerik değişikliğidir (işçi başka sırada okur). */
kontrol(
  yayinlanmamisDegisiklikVar({ ...taban, sayfalar: [KART, { ...KART, baslik: "İki" }] }, {
    ...taban,
    sayfalar: [{ ...KART, baslik: "İki" }, KART],
  }),
  "kart sırası değişmesi yayınlanmamış değişiklik sayılır",
);
kontrol(!yayinlanmamisDegisiklikVar(taban, taban), "değişiklik yoksa rozet yanmaz");
kontrol(yayinlanmamisDegisiklikVar(taban, null), "hiç yayınlanmamış eğitimin TAMAMI yayınlanmamış değişikliktir");

/* ══ 2. DEPO — gerçek SQLite ═══════════════════════════════════════════════ */

const klasor = mkdtempSync(join(tmpdir(), "flowtrain-surum-"));
process.env.FLOWTRAIN_DATA = klasor;

// DİNAMİK İÇE AKTARIM ŞART: `db.ts` veri klasörünü modül yüklenirken okuyor.
const depo = await import("../src/lib/depo.ts");
const { db } = await import("../src/lib/db.ts");
const { bolumAnahtari } = await import("../src/lib/bolumler.ts");

const e = depo.egitimOlustur("Yüksekte Çalışma", "hazirlayan");
depo.egitimGuncelle(e.id, { kategori: "İSG", zorunlu: true, gecmeNotu: 80, aciklama: "Kemer ve korkuluk" });
const k1 = depo.sayfaEkle(e.id, { tip: "kural", baslik: "Emniyet kemeri", metin: "Her zaman tak." });
const k2 = depo.sayfaEkle(e.id, { tip: "uyari", baslik: "Düşme", metin: "3 metre öldürür." });
depo.soruEkle(e.id, { tip: "dogruYanlis", metin: "Kemer takılır.", secenekler: ["Doğru", "Yanlış"], dogru: [0] });
depo.ayarYaz(bolumAnahtari(e.id), JSON.stringify({ [k2.id]: "Acil durum" }));

/* ── Yayınlanmadan önce saha boş ──────────────────────────────────────────── */
esit(depo.yayinlariGetir(e.id), [], "yayınlanmamış eğitimin anlık görüntüsü yok");
esit(depo.sonYayinGetir(e.id), null, "son yayın yok");
kontrol(depo.yayinlanmamisDegisiklik(e.id), "hiç yayınlanmamış eğitimde rozet yanar");

/* ── İlk yayın ────────────────────────────────────────────────────────────── */
const ilk = depo.yayinla(e.id, "onaylayan");
esit(ilk, { surum: 1, yeni: true }, "ilk yayın 1. sürümü açar");
esit(depo.egitimGetir(e.id).durum, "yayin", "eğitim sahaya çıktı");
esit(depo.egitimGetir(e.id).onaylayan, "onaylayan", "yayınlayan kaydedildi");
kontrol(!depo.yayinlanmamisDegisiklik(e.id), "yayınladıktan hemen sonra rozet söner");

const y1 = depo.sonYayinGetir(e.id);
esit(y1.surum, 1, "son yayın 1. sürüm");
esit(y1.ad, "Yüksekte Çalışma", "künyede ad var");
esit(y1.gecmeNotu, 80, "künyede sınav ayarları var");
esit(y1.kategori, "İSG", "künyede katalog alanları var");
esit(y1.zorunlu, true, "mantıksal alan sınırda çevrildi");
esit(y1.bolumler, { [k2.id]: "Acil durum" }, "BÖLÜM BAŞLIKLARI da anlık görüntüye girdi");

const i1 = depo.yayinIcerigi(y1);
esit(i1.sayfalar.map((s) => s.baslik), ["Emniyet kemeri", "Düşme"], "kartlar sırasıyla alındı");
esit(i1.sayfalar.map((s) => s.id), [k1.id, k2.id], "kart kimlikleri korundu (bölüm başlığı bağlı kalsın)");
esit(i1.sorular.length, 1, "sorular alındı");
esit(i1.sorular[0].dogru, [0], "cevap anahtarı anlık görüntüde duruyor");

/* ── DEĞİŞMEDEN yeniden yayın ikinci bir sürüm ÜRETMEZ ────────────────────── */
esit(depo.yayinla(e.id, "onaylayan"), { surum: 1, yeni: false }, "içerik aynıysa yeni sürüm açılmaz");
esit(depo.yayinlariGetir(e.id).length, 1, "ikizi olan sürüm numarası oluşmadı");

/* ── TASLAĞI DEĞİŞTİR — anlık görüntü DEĞİŞMEZ ────────────────────────────
   İşin bütün mesele bu: hazırlayan yazarken sahadaki eğitim yerinde durur. */
depo.sayfaGuncelle(k1.id, { metin: "DEĞİŞTİ — taslak" });
const k3 = depo.sayfaEkle(e.id, { tip: "kural", baslik: "Yeni kart" });
depo.egitimGuncelle(e.id, { gecmeNotu: 50 });

esit(depo.yayinIcerigi(depo.sonYayinGetir(e.id)).sayfalar[0].metin, "Her zaman tak.", "yayınlanan kart metni DEĞİŞMEDİ");
esit(depo.yayinIcerigi(depo.sonYayinGetir(e.id)).sayfalar.length, 2, "taslağa eklenen kart yayına sızmadı");
esit(depo.sonYayinGetir(e.id).gecmeNotu, 80, "yayınlanan geçme notu değişmedi");
esit(depo.sayfalariGetir(e.id).length, 3, "taslak kendi yoluna devam etti");
kontrol(depo.yayinlanmamisDegisiklik(e.id), "yayınlanmamış değişiklik rozeti yandı");

/* ── İkinci yayın ─────────────────────────────────────────────────────────── */
const ikinci = depo.yayinla(e.id, "onaylayan2");
esit(ikinci, { surum: 2, yeni: true }, "değişen taslak yeni sürüm açar");
esit(depo.egitimGetir(e.id).surum, 2, "eğitimin sürüm numarası ilerledi");
esit(depo.yayinlariGetir(e.id).map((y) => y.surum), [2, 1], "iki sürüm de duruyor, yenisi başta");

/* 1. SÜRÜM DOKUNULMADAN DURUYOR. Kayıt bu: üç yıl sonra "sürüm 1'i izleyen
   kişi neyi gördü" sorusunun cevabı burası. */
const eski = depo.yayinIcerigi(depo.yayinGetir(e.id, 1));
esit(eski.sayfalar[0].metin, "Her zaman tak.", "1. sürümün içeriği yeni yayından sonra da aynı");
esit(eski.sayfalar.length, 2, "1. sürümde yeni kart yok");
esit(depo.yayinGetir(e.id, 1).gecmeNotu, 80, "1. sürümün sınav ayarı korundu");
esit(depo.yayinGetir(e.id, 2).gecmeNotu, 50, "2. sürüm yeni ayarı taşıyor");

/* ── YAYINDAKİ HÂLİNE DÖN ─────────────────────────────────────────────────── */
depo.sayfaSil(k2.id);
depo.sayfaGuncelle(k1.id, { metin: "yine değişti" });
depo.soruEkle(e.id, { tip: "dogruYanlis", metin: "Fazladan soru", secenekler: ["A", "B"], dogru: [0] });
depo.egitimGuncelle(e.id, { ad: "Yanlış ad", gecmeNotu: 10 });

esit(depo.yayindanGeriDon(e.id), 2, "geri dönüş son sürümü hedefler");
esit(depo.sayfalariGetir(e.id).map((s) => s.id), [k1.id, k2.id, k3.id], "silinen kart geri geldi, kimlikler aynı");
esit(depo.sayfalariGetir(e.id)[0].metin, "DEĞİŞTİ — taslak", "kart metni 2. sürümdeki hâline döndü");
esit(depo.sorulariGetir(e.id).length, 1, "fazladan soru temizlendi");
esit(depo.egitimGetir(e.id).ad, "Yüksekte Çalışma", "eğitim adı geri geldi");
esit(depo.egitimGetir(e.id).gecmeNotu, 50, "sınav ayarı 2. sürümdeki hâline döndü");
esit(depo.egitimGetir(e.id).aciklama, "Kemer ve korkuluk", "açıklama korundu");
kontrol(!depo.yayinlanmamisDegisiklik(e.id), "geri dönüşten sonra rozet söner (taslak = yayın)");

/* ESKİ SÜRÜME DÖNMEK de mümkün — anlık görüntüler zaten saklanıyor. */
esit(depo.yayindanGeriDon(e.id, 1), 1, "1. sürüme dönülebiliyor");
esit(depo.sayfalariGetir(e.id).map((s) => s.baslik), ["Emniyet kemeri", "Düşme"], "1. sürümün kartları geldi");
esit(depo.sayfalariGetir(e.id)[0].metin, "Her zaman tak.", "1. sürümün metni geldi");
esit(depo.egitimGetir(e.id).gecmeNotu, 80, "1. sürümün geçme notu geldi");
esit(
  JSON.parse(depo.ayarOku(bolumAnahtari(e.id))),
  { [k2.id]: "Acil durum" },
  "bölüm başlıkları da geri geldi (kart kimliği korunduğu için eşleme gerekmedi)",
);
/* Geri dönmek YAYINI DEĞİŞTİRMEZ: taslak eskiye çekildi, sahada hâlâ 2. sürüm
   var. Yoksa "geri al" düğmesi sessizce bir yayından düşürme aracı olurdu. */
esit(depo.sonYayinGetir(e.id).surum, 2, "geri dönmek sahadaki sürümü DEĞİŞTİRMEZ");
esit(depo.egitimGetir(e.id).durum, "yayin", "geri dönmek eğitimi sahadan indirmez");
kontrol(depo.yayinlanmamisDegisiklik(e.id), "eski sürüme dönmek yayınlanmamış değişikliktir");

/* Eski hâli yeniden yayınlamak YENİ bir sürümdür — 1. sürümün üstüne yazmaz. */
esit(depo.yayinla(e.id, "onaylayan").surum, 3, "eski içeriğin yeniden yayını 3. sürüm olur");
esit(depo.yayinGetir(e.id, 1).surum, 1, "1. sürüm yerinde duruyor (kayıt üstüne yazılmaz)");

/* ── Kenar durumlar ───────────────────────────────────────────────────────── */
const bos = depo.egitimOlustur("Kartsız", "hazirlayan");
esit(depo.yayinla(bos.id, "onaylayan"), null, "kartsız eğitim yayınlanmaz");
esit(depo.egitimGetir(bos.id).durum, "taslak", "başarısız yayın eğitimi sahaya çıkarmaz");
esit(depo.yayindanGeriDon(bos.id), null, "yayını olmayan eğitimde geri dönülecek bir şey yok");
esit(depo.yayinla("egt_yok", "onaylayan"), null, "olmayan eğitim yayınlanmaz");
esit(depo.yayinGetir(e.id, 99), null, "olmayan sürüm null döner");
kontrol(!depo.yayinlanmamisDegisiklik("egt_yok"), "olmayan eğitimde rozet yanmaz");

/* Eğitim silinse bile ANLIK GÖRÜNTÜ AYAKTA KALIR: kayıt kaydın bağlantısına
   değil kendisine yaslanır (`oturum` ve `ziyaretciOturum` ile aynı gerekçe). */
const silinecek = depo.egitimOlustur("Silinecek", "hazirlayan");
depo.sayfaEkle(silinecek.id, { tip: "kural", baslik: "Tek kart" });
depo.yayinla(silinecek.id, "onaylayan");
depo.egitimSil(silinecek.id);
esit(depo.yayinlariGetir(silinecek.id).length, 1, "eğitim silinse de yayınlanmış sürüm defterde kalır");
esit(depo.yayinIcerigi(depo.sonYayinGetir(silinecek.id)).sayfalar.length, 1, "silinen eğitimin içeriği de duruyor");

/* ══ 3. SAHANIN OKUDUĞU YER ════════════════════════════════════════════════
   2. adım: kiosk, ziyaretçi tableti ve amir tableti artık taslağı değil
   yayınlanan sürümü okuyor. Buradaki hata tek yönde ve sessiz: ekranda
   hiçbir şey değişmez, yalnız kayıttaki sürüm numarası izlenen içeriği
   göstermemeye başlar. */

const s = depo.egitimOlustur("Kimyasal Güvenliği", "hazirlayan");
depo.egitimGuncelle(s.id, { gecmeNotu: 60, tekrarAy: 12, denemeHakki: 2 });
depo.sayfaEkle(s.id, { tip: "kural", baslik: "Eldiven", metin: "Nitril eldiven tak." });
depo.soruEkle(s.id, { tip: "dogruYanlis", metin: "Eldiven takılır.", secenekler: ["Doğru", "Yanlış"], dogru: [0] });
depo.soruEkle(s.id, { tip: "dogruYanlis", metin: "Gözlük takılır.", secenekler: ["Doğru", "Yanlış"], dogru: [0] });
/* Kimlikler METİNDEN yakalanıyor, sıradan değil: `sorulariGetir` kimliğe göre
   sıralıyor (`ORDER BY id`) ve aynı milisaniyede açılan iki sorunun sırası
   rastgele ekten geliyor — oluşturma sırası değil. */
const q1 = depo.sorulariGetir(s.id).find((q) => q.metin === "Eldiven takılır.").id;
const q2 = depo.sorulariGetir(s.id).find((q) => q.metin === "Gözlük takılır.").id;

esit(depo.sahadakiEgitim(s.id), null, "yayınlanmamış eğitim SAHADA YOK");
esit(depo.sahadakiIcerik(s.id), null, "yayınlanmamış eğitimin sahada içeriği de yok");

depo.yayinla(s.id, "onaylayan");

/* ── Künye yayınlanan sürümden geliyor ───────────────────────────────────── */
esit(depo.sahadakiEgitim(s.id).gecmeNotu, 60, "sahadaki geçme notu yayından");
esit(depo.sahadakiEgitim(s.id).surum, 1, "sahadaki sürüm numarası yayından");
esit(depo.sahadakiIcerik(s.id).sayfalar[0].metin, "Nitril eldiven tak.", "sahadaki kart yayından");

/* TASLAKTA DEĞİŞTİR — saha kımıldamamalı. Yalnız kartlar değil SINAV
   AYARLARI da: geçme notunu 90'a çekmek, henüz yayınlanmamış bir kuralı
   sahada uygulamaya başlamak olurdu. */
depo.egitimGuncelle(s.id, { gecmeNotu: 90, tekrarAy: 3, ad: "Yeni ad (taslak)" });
depo.sayfaGuncelle(depo.sayfalariGetir(s.id)[0].id, { metin: "TASLAK metni" });
depo.soruGuncelle(q1, { metin: "Eldiven takılmaz." });

esit(depo.sahadakiEgitim(s.id).gecmeNotu, 60, "taslaktaki geçme notu SAHAYA ÇIKMADI");
esit(depo.sahadakiEgitim(s.id).tekrarAy, 12, "taslaktaki tekrar süresi SAHAYA ÇIKMADI (atama motoru bunu okuyor)");
esit(depo.sahadakiEgitim(s.id).ad, "Kimyasal Güvenliği", "taslaktaki ad sahaya çıkmadı");
esit(depo.sahadakiIcerik(s.id).sayfalar[0].metin, "Nitril eldiven tak.", "taslaktaki kart metni sahaya çıkmadı");
esit(
  depo.sahadakiIcerik(s.id).sorular.find((x) => x.id === q1).metin,
  "Eldiven takılır.",
  "taslaktaki soru metni sahaya çıkmadı",
);
/* Taslaktan kalanlar: kimlik, durum, hazırlayan — künye değil yönetim bilgisi. */
esit(depo.sahadakiEgitim(s.id).id, s.id, "kimlik taslaktan (kayıtların bağı)");
esit(depo.sahadakiEgitim(s.id).hazirlayan, "hazirlayan", "hazırlayan taslaktan");

/* ── Sahadan indirme hâlâ `durum` ile ─────────────────────────────────────── */
depo.egitimGuncelle(s.id, { durum: "taslak" });
esit(depo.sahadakiEgitim(s.id), null, "taslağa alınan eğitim, görüntüsü DURSA BİLE sahada yok");
kontrol(
  !depo.sahadakiEgitimler().some((x) => x.id === s.id),
  "taslağa alınan eğitim saha listesinden düşer (kimseye atanmaz)",
);
depo.yayinla(s.id, "onaylayan"); // içerik değişti (taslakta oynadık) → 2. sürüm
esit(depo.sahadakiEgitim(s.id).surum, 2, "yeniden yayınlanınca saha yeni sürüme geçer");
esit(depo.sahadakiEgitim(s.id).gecmeNotu, 90, "yayınlandıktan SONRA yeni ayar sahaya çıkar");

/* ── Puanlama oturumun sürümünden ────────────────────────────────────────── */
esit(
  depo.yayinSorulariKimlikle(s.id, 1, [q1])[0].metin,
  "Eldiven takılır.",
  "1. sürümün sorusu ESKİ metniyle okunuyor",
);
esit(
  depo.yayinSorulariKimlikle(s.id, 2, [q1])[0].metin,
  "Eldiven takılmaz.",
  "2. sürümün sorusu yeni metniyle okunuyor",
);
esit(
  depo.yayinSorulariKimlikle(s.id, 1, [q2, q1]).map((x) => x.id),
  [q2, q1],
  "sıra oturumdaki sırayla aynı (IN sırayı korumaz)",
);
esit(depo.yayinSorulariKimlikle(s.id, 1, [q1])[0].dogru, [0], "cevap anahtarı sürümden okunuyor");
esit(depo.yayinSorulariKimlikle(s.id, 99, [q1]), [], "olmayan sürümde soru yok");
esit(depo.yayinSorulariKimlikle(s.id, 1, ["sor_yok"]), [], "tanınmayan soru kimliği elenir");
esit(depo.yayinSorulariKimlikle(s.id, 1, []), [], "boş istek boş döner");

/* ── Saha listesi ─────────────────────────────────────────────────────────── */
const saha = depo.sahadakiEgitimler();
kontrol(saha.some((x) => x.id === s.id), "yayındaki eğitim saha listesinde");
kontrol(!saha.some((x) => x.id === bos.id), "kartsız/yayınlanmamış eğitim saha listesinde YOK");
esit(
  saha.find((x) => x.id === s.id).gecmeNotu,
  90,
  "saha listesindeki künye de yayından geliyor (atama motorunun malzemesi)",
);

/* ══ 4. KAYIT DEFTERİ KÜNYESİ ══════════════════════════════════════════════
   Kayıt "sürüm 1" diyorsa yanında 1. sürümün adı ve tekrar süresi yazmalı.
   Defter bunları eskiden taslaktan okuyordu: eğitim yeniden adlandırıldığında
   geçen yılın sertifikası bugünkü adla basılıyor, tekrar süresi 12 aydan 6 aya
   çekildiğinde de geçmiş sertifikaların geçerliliği GERİYE DÖNÜK kısalıyordu. */

const d = depo.egitimOlustur("Forklift", "hazirlayan");
depo.egitimGuncelle(d.id, { tekrarAy: 12, kategori: "Ekipman" });
depo.sayfaEkle(d.id, { tip: "kural", baslik: "Yük kaldırma" });
depo.yayinla(d.id, "onaylayan");

// Taslakta ad, kategori ve tekrar süresi değişip YENİ sürüm yayınlanıyor.
depo.egitimGuncelle(d.id, { ad: "Forklift (yenilendi)", tekrarAy: 6, kategori: "İSG" });
depo.yayinla(d.id, "onaylayan");
esit(depo.sonYayinGetir(d.id).surum, 2, "ikinci sürüm açıldı");

const kunye = new Map(depo.yayinKunyeleri().map((y) => [depo.yayinAnahtari(y.egitimId, y.surum), y]));
esit(kunye.get(depo.yayinAnahtari(d.id, 1)).ad, "Forklift", "1. sürümün künyesinde ESKİ ad duruyor");
esit(kunye.get(depo.yayinAnahtari(d.id, 1)).tekrarAy, 12, "1. sürümün tekrar süresi 12 ay kaldı");
esit(kunye.get(depo.yayinAnahtari(d.id, 1)).kategori, "Ekipman", "1. sürümün kategorisi korundu");
esit(kunye.get(depo.yayinAnahtari(d.id, 2)).ad, "Forklift (yenilendi)", "2. sürüm yeni adı taşıyor");
esit(kunye.get(depo.yayinAnahtari(d.id, 2)).tekrarAy, 6, "2. sürümün tekrar süresi 6 ay");
esit(depo.egitimGetir(d.id).ad, "Forklift (yenilendi)", "taslak bugünkü adı taşımaya devam ediyor");
esit(kunye.get(depo.yayinAnahtari(d.id, 99)), undefined, "olmayan sürümün künyesi yok (defter taslağa düşer)");

/* ── temizlik ──────────────────────────────────────────────────────────────── */
db().close();
try {
  rmSync(klasor, { recursive: true, force: true });
} catch {
  /* Windows'ta dosya kilidi geç bırakılabiliyor; klasör zaten tmp'de. */
}

bitir("sürümlü yayın");
