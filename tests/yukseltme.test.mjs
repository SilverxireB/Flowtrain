/**
 * YÜKSELTME YOLU SINAVI — `npm test`
 *
 * NEDEN BU DOSYA VAR: uçtan uca sınav her koşuda SIFIRDAN bir veri klasörü
 * kuruyor, yani şemanın yalnız "yeni kurulum" yolunu görüyor. Oysa müşteride
 * olan tek yol diğeri: dolu bir veritabanının üstüne yeni sürüm gelir. O yolda
 * gerçek bir hata çıktı ve YALNIZ gözle bakınca görüldü —
 * `CREATE INDEX ... ON kural(grupId)` şema betiğinin ortasındaydı, var olan
 * kurulumda `kural` tablosunda henüz grupId sütunu olmadığı için "no such
 * column" ile patlıyor, `exec` betiği YARIDA kesiyor ve altındaki tablolar
 * (grup, medya, mmEsleme) hiç oluşmuyordu. Uygulama açılıyor, ilk paket
 * sorgusunda çöküyordu.
 *
 * Burada eski şemalı bir veritabanı elle kurulur, `db()` çalıştırılır ve
 * göçün ne yaptığına bakılır. Sınavlanan şey şema betiğinin SIRASI.
 */
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import Database from "better-sqlite3";
import { kontrol, esit, bitir } from "./yardim.mjs";

const DB_MODULU = pathToFileURL(join(process.cwd(), "src", "lib", "db.ts")).href;

/**
 * `db.ts` veri klasörünü MODÜL YÜKLENİRKEN okuyor ve açtığı bağlantıyı modül
 * seviyesinde saklıyor. Aynı süreçte ikinci bir açılışı ölçebilmek için modülün
 * TAZE bir örneği gerekiyor; sorgu dizesi Node'un modül önbelleğini atlatır.
 * (Derleme ya da dönüştürme yok — dosya aynı dosya.)
 */
let sayac = 0;
async function dbAc(klasor) {
  process.env.FLOWTRAIN_DATA = klasor;
  const modul = await import(`${DB_MODULU}?tazele=${++sayac}`);
  return modul.db();
}

/* ── ESKİ ŞEMA ─────────────────────────────────────────────────────────────
   S1 öncesi kurulumun gerçek hâli: kural tek eğitime ÇAPALI (egitimId NOT
   NULL, grupId YOK), katalog alanları yok, oturumun kaynağı yok, paket/medya/
   maliyet merkezi tabloları hiç yok. */
const ESKI_SEMA = `
CREATE TABLE egitim (
  id TEXT PRIMARY KEY,
  ad TEXT NOT NULL,
  aciklama TEXT,
  surum INTEGER NOT NULL DEFAULT 1,
  durum TEXT NOT NULL DEFAULT 'taslak',
  hazirlayan TEXT NOT NULL,
  onaylayan TEXT,
  gecmeNotu INTEGER NOT NULL DEFAULT 70,
  denemeHakki INTEGER NOT NULL DEFAULT 2,
  soruSayisi INTEGER NOT NULL DEFAULT 5,
  karisik INTEGER NOT NULL DEFAULT 1,
  tekrarAy INTEGER,
  olusturma TEXT NOT NULL,
  guncelleme TEXT NOT NULL
);
CREATE TABLE sayfa (
  id TEXT PRIMARY KEY,
  egitimId TEXT NOT NULL REFERENCES egitim(id) ON DELETE CASCADE,
  sira INTEGER NOT NULL,
  tip TEXT NOT NULL,
  baslik TEXT NOT NULL DEFAULT '',
  metin TEXT,
  metinKarsi TEXT,
  gorselId TEXT,
  videoId TEXT,
  asgariSure INTEGER NOT NULL DEFAULT 8
);
CREATE TABLE soru (
  id TEXT PRIMARY KEY,
  egitimId TEXT NOT NULL REFERENCES egitim(id) ON DELETE CASCADE,
  tip TEXT NOT NULL,
  metin TEXT NOT NULL,
  secenekler TEXT NOT NULL,
  dogru TEXT NOT NULL
);
CREATE TABLE oturum (
  id TEXT PRIMARY KEY,
  egitimId TEXT NOT NULL,
  egitimSurum INTEGER NOT NULL,
  sicil TEXT NOT NULL,
  gozeten TEXT,
  cihaz TEXT NOT NULL DEFAULT 'kiosk',
  baslangic TEXT NOT NULL,
  bitis TEXT,
  sayfaSureleri TEXT NOT NULL DEFAULT '{}',
  puan INTEGER,
  sonuc TEXT,
  senkron TEXT NOT NULL DEFAULT 'bekliyor'
);
CREATE TABLE pin (
  sicil TEXT PRIMARY KEY,
  ozet TEXT NOT NULL,
  tuz TEXT NOT NULL,
  olusturma TEXT NOT NULL
);
CREATE TABLE hesap (
  kullanici TEXT PRIMARY KEY,
  ad TEXT NOT NULL,
  rol TEXT NOT NULL,
  ozet TEXT NOT NULL,
  tuz TEXT NOT NULL,
  sicil TEXT,
  olusturma TEXT NOT NULL
);
CREATE TABLE iz (id TEXT PRIMARY KEY, kim TEXT NOT NULL, ne TEXT NOT NULL, neZaman TEXT NOT NULL);
CREATE TABLE ayar (anahtar TEXT PRIMARY KEY, deger TEXT NOT NULL);
`;

/** Eski kural tablosu — YÜKSELTMENİN ASIL KONUSU. */
const ESKI_KURAL = `
CREATE TABLE kural (
  id TEXT PRIMARY KEY,
  egitimId TEXT NOT NULL REFERENCES egitim(id) ON DELETE CASCADE,
  kosul TEXT NOT NULL,
  sonTarih TEXT,
  aktif INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX ix_kural_egitim ON kural(egitimId);
`;

function eskiKurulumKur(kuralSemasi) {
  const klasor = mkdtempSync(join(tmpdir(), "flowtrain-yukselt-"));
  const d = new Database(join(klasor, "flowtrain.db"));
  d.exec(ESKI_SEMA);
  d.exec(kuralSemasi);

  const zaman = "2025-01-05T08:00:00.000Z";
  d.prepare(
    "INSERT INTO egitim (id,ad,surum,durum,hazirlayan,olusturma,guncelleme) VALUES (?,?,?,?,?,?,?)",
  ).run("egt_eski1", "Yüksekte Çalışma", 3, "yayin", "yonetici", zaman, zaman);
  d.prepare(
    "INSERT INTO egitim (id,ad,surum,durum,hazirlayan,olusturma,guncelleme) VALUES (?,?,?,?,?,?,?)",
  ).run("egt_eski2", "Forklift", 1, "yayin", "yonetici", zaman, zaman);
  /* TASLAKTAKİ eğitim — sürümlü yayın göçünün ELEDİĞİ hâl. `onaylayan` dolu:
     bir zamanlar yayınlanmış, sonra taslağa alınmış. İçeriği o günden beri
     değişmiş olabilir, dolayısıyla "sürüm 2" diye görüntülenemez. */
  d.prepare(
    "INSERT INTO egitim (id,ad,surum,durum,hazirlayan,onaylayan,olusturma,guncelleme) VALUES (?,?,?,?,?,?,?,?)",
  ).run("egt_eski3", "Kimyasal", 2, "taslak", "yonetici", "mudur", zaman, zaman);
  d.prepare("INSERT INTO sayfa (id,egitimId,sira,tip,baslik,asgariSure) VALUES (?,?,?,?,?,?)").run(
    "sf_eski1",
    "egt_eski1",
    0,
    "kural",
    "Emniyet kemeri",
    8,
  );
  d.prepare("INSERT INTO soru (id,egitimId,tip,metin,secenekler,dogru) VALUES (?,?,?,?,?,?)").run(
    "sr_eski1",
    "egt_eski1",
    "dogruYanlis",
    "Kemer takılır.",
    '["Doğru","Yanlış"]',
    "[0]",
  );
  d.prepare(
    "INSERT INTO oturum (id,egitimId,egitimSurum,sicil,baslangic,bitis,puan,sonuc) VALUES (?,?,?,?,?,?,?,?)",
  ).run("otr_eski1", "egt_eski1", 3, "1001", zaman, zaman, 90, "gecti");
  d.prepare("INSERT INTO pin (sicil,ozet,tuz,olusturma) VALUES (?,?,?,?)").run("1001", "ozet", "tuz", zaman);
  return { klasor, d };
}

/* ══ 1. TAM ESKİ ŞEMA (grupId hiç yok) ═════════════════════════════════════ */

const eski = eskiKurulumKur(ESKI_KURAL);
eski.d
  .prepare("INSERT INTO kural (id,egitimId,kosul,sonTarih,aktif) VALUES (?,?,?,?,?)")
  .run("krl_1", "egt_eski1", '{"bolum":["Kaynak"]}', "2026-12-31", 1);
eski.d.prepare("INSERT INTO kural (id,egitimId,kosul,aktif) VALUES (?,?,?,?)").run("krl_2", "egt_eski1", '{"hat":["Hat 1"]}', 1);
eski.d.prepare("INSERT INTO kural (id,egitimId,kosul,aktif) VALUES (?,?,?,?)").run("krl_3", "egt_eski2", '{"gorev":["Forklift"]}', 0);
// Editörde açılmış bölüm başlığı — anlık görüntüye girmezse yayınlanan
// eğitim bölümsüz kalır.
eski.d
  .prepare("INSERT INTO ayar (anahtar,deger) VALUES (?,?)")
  .run("bolumler:egt_eski1", '{"sf_eski1":"Giriş"}');
eski.d.close();

const d = await dbAc(eski.klasor);

/* ── Şema betiği YARIDA KESİLMEDİ ────────────────────────────────────────
   Asıl regresyon bu: indeks göçten önce kurulsaydı `exec` burada patlar ve
   altındaki tablolar hiç oluşmazdı. Tabloların varlığı sırayı sınavlar. */
const tablolar = new Set(
  d.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((s) => s.name),
);
for (const t of ["grup", "grupUye", "medya", "mmEsleme", "ziyaretci", "ziyaretciSoru", "ziyaretciOturum", "soruIstatistik"]) {
  kontrol(tablolar.has(t), `yükseltmede '${t}' tablosu oluştu (şema betiği yarıda kesilmedi)`);
}
kontrol(!tablolar.has("kural_yeni"), "geçici göç tablosu geride bırakılmadı");

const indeksler = new Set(
  d.prepare("SELECT name FROM sqlite_master WHERE type='index'").all().map((s) => s.name),
);
kontrol(indeksler.has("ix_kural_grup"), "grupId indeksi göçten SONRA kuruldu");
kontrol(indeksler.has("ix_kural_egitim"), "egitimId indeksi korundu");

/* ── Hiçbir kural kaybolmadı ─────────────────────────────────────────────
   Tablo yeniden kuruluyor; satırların taşınmadığı bir göç, fabrikanın tüm
   atama kurallarını SESSİZCE siler ve kimse aynı gün fark etmez. */
const kurallar = d.prepare("SELECT * FROM kural ORDER BY id").all();
esit(kurallar.length, 3, "üç kuralın üçü de göçten sağ çıktı");
esit(
  kurallar.map((k) => k.egitimId),
  ["egt_eski1", "egt_eski1", "egt_eski2"],
  "kuralların eğitim bağı korundu",
);
esit(kurallar[0].kosul, '{"bolum":["Kaynak"]}', "koşul metni bozulmadı");
esit(kurallar[0].sonTarih, "2026-12-31", "son tarih korundu");
esit(kurallar[2].aktif, 0, "pasif kural pasif kaldı");
esit(
  kurallar.map((k) => k.grupId),
  [null, null, null],
  "eski kurallarda paket bağı boş",
);

/* ── egitimId artık NULL kabul ediyor ────────────────────────────────────── */
const kuralSutunlari = d.pragma("table_info(kural)");
const egitimIdSutunu = kuralSutunlari.find((s) => s.name === "egitimId");
kontrol(!!egitimIdSutunu, "kural tablosunda egitimId duruyor");
esit(egitimIdSutunu.notnull, 0, "egitimId artık NULL kabul ediyor (paket kuralı için)");
kontrol(
  kuralSutunlari.some((s) => s.name === "grupId"),
  "grupId sütunu eklendi",
);

/* Paket kuralı GERÇEKTEN yazılabiliyor mu — sütunun gevşemesi tek başına
   yetmez, CHECK ve yabancı anahtar da geçmeli. */
d.prepare("INSERT INTO grup (id,ad,olusturma) VALUES (?,?,?)").run("grp_1", "Oryantasyon", "2026-01-01T00:00:00.000Z");
let paketKuraliYazildi = true;
try {
  d.prepare("INSERT INTO kural (id,grupId,kosul,aktif) VALUES (?,?,?,?)").run("krl_paket", "grp_1", '{"bolum":["Montaj"]}', 1);
} catch {
  paketKuraliYazildi = false;
}
kontrol(paketKuraliYazildi, "eğitimsiz paket kuralı yazılabiliyor");

/* İkisi de boş bir kural YAZILAMAZ: CHECK kısıtı göçte kaybolursa kimseye
   düşmeyen ölü kurallar birikir. */
let bosKuralReddedildi = false;
try {
  d.prepare("INSERT INTO kural (id,kosul,aktif) VALUES (?,?,?)").run("krl_bos", "{}", 1);
} catch {
  bosKuralReddedildi = true;
}
kontrol(bosKuralReddedildi, "hedefsiz kural CHECK kısıtına takılıyor");

/* ── Yeni sütunlar açıldı, eski satırlar varsayılanlarını aldı ───────────── */
const sutunAdlari = (tablo) => d.pragma(`table_info(${tablo})`).map((s) => s.name);
for (const [tablo, sutun] of [
  ["egitim", "kategori"],
  ["egitim", "zorunlu"],
  ["egitim", "sureDk"],
  ["egitim", "egitmen"],
  ["oturum", "kaynak"],
  ["oturum", "egitmen"],
  ["oturum", "notlar"],
  ["oturum", "sorulanSoruIdleri"],
  ["sayfa", "gorselIdler"],
  ["soru", "gorselId"],
  ["soru", "aciklama"],
  ["pin", "hataliDeneme"],
  ["pin", "kilitBitis"],
  ["medya", "altMetin"],
]) {
  kontrol(sutunAdlari(tablo).includes(sutun), `${tablo}.${sutun} göçle eklendi`);
}

const eskiOturum = d.prepare("SELECT * FROM oturum WHERE id='otr_eski1'").get();
esit(eskiOturum.kaynak, "kiosk", "kaynağı olmayan eski kayıt 'kiosk' sayılıyor");
esit(eskiOturum.sorulanSoruIdleri, "[]", "eski oturumun soru seti boş dizi");
esit(eskiOturum.puan, 90, "eski kaydın puanı korundu");
esit(eskiOturum.sonuc, "gecti", "eski kaydın sonucu korundu");
esit(d.prepare("SELECT hataliDeneme FROM pin WHERE sicil='1001'").get().hataliDeneme, 0, "eski PIN sayacı sıfırdan başlıyor");
esit(d.prepare("SELECT COUNT(*) n FROM egitim").get().n, 3, "eğitimler yerinde");
esit(d.prepare("SELECT COUNT(*) n FROM sayfa").get().n, 1, "sayfalar yerinde");
esit(d.prepare("SELECT COUNT(*) n FROM soru").get().n, 1, "sorular yerinde");

/* ── SAHADAKİ EĞİTİMLERİN ANLIK GÖRÜNTÜSÜ ────────────────────────────────
   Sürümlü yayın göçü (`docs/SURUMLU-YAYIN.md`). Bu göç olmasaydı, okuma yeri
   yayına çevrildiğinde (2. adım) görüntüsü olmayan her eğitim sahadan
   DÜŞERDİ: yükseltmenin ertesi sabahı kioska gelen işçi "size atanmış eğitim
   yok" görürdü. Yeni kurulumda hiç görünmeyen, YALNIZ yükseltmede çıkan bir
   hata — bu dosyanın var olma sebebinin aynısı. */
const y1 = d.prepare("SELECT * FROM yayinSurum WHERE egitimId='egt_eski1'").get();
kontrol(!!y1, "sahadaki eğitimin anlık görüntüsü göçte alındı");
esit(y1.surum, 3, "SÜRÜM NUMARASI KAYDIRILMADI (var olan kayıtlar bu numaraya atıf yapıyor)");
esit(y1.ad, "Yüksekte Çalışma", "künye eğitimden dolduruldu");
esit(y1.yayinlayan, "yonetici", "onaylayanı olmayan eski kayıtta hazırlayan yazıldı");
esit(y1.bolumler, '{"sf_eski1":"Giriş"}', "bölüm başlıkları da anlık görüntüye alındı");

const g1Sayfalar = d.prepare("SELECT * FROM yayinSayfa WHERE yayinId=?").all(y1.id);
esit(g1Sayfalar.length, 1, "yayınlanan kart anlık görüntüye girdi");
esit(g1Sayfalar[0].sayfaId, "sf_eski1", "kart kimliği korundu (bölüm başlığı ona bağlı)");
esit(g1Sayfalar[0].baslik, "Emniyet kemeri", "kart içeriği taşındı");
const g1Sorular = d.prepare("SELECT * FROM yayinSoru WHERE yayinId=?").all(y1.id);
esit(g1Sorular.length, 1, "soru anlık görüntüye girdi");
esit(g1Sorular[0].dogru, "[0]", "cevap anahtarı taşındı");

esit(
  d.prepare("SELECT COUNT(*) n FROM yayinSurum WHERE egitimId='egt_eski2'").get().n,
  1,
  "kartsız da olsa sahadaki eğitimin görüntüsü alınır (bugünkü davranışı bozmamak için)",
);
/* TASLAKTAKİ eğitim DIŞARIDA: içeriği yayınlandığı andakinden farklı olabilir
   ve onu "sürüm 2" diye kaydetmek denetime yalan söylerdi. İlk yayınında
   numara 3 olur (`surum.ts` — sonrakiSurum). */
esit(
  d.prepare("SELECT COUNT(*) n FROM yayinSurum WHERE egitimId='egt_eski3'").get().n,
  0,
  "taslaktaki eğitimin anlık görüntüsü ALINMAZ",
);

/* ── Yabancı anahtar ihlali yok ──────────────────────────────────────────
   Göç `foreign_keys = OFF` ile çalışıyor (tablo bir an için DROP ediliyor);
   kapatılan denetim geri açılmazsa ya da satırlar bozulursa iz burada kalır. */
esit(d.pragma("foreign_key_check"), [], "yabancı anahtar ihlali yok");
esit(d.pragma("foreign_keys", { simple: true }), 1, "yabancı anahtar denetimi göçten sonra AÇIK");
esit(d.pragma("integrity_check", { simple: true }), "ok", "veritabanı bütünlüğü sağlam");

/* ── İKİNCİ AÇILIŞ GÖÇÜ TEKRARLAMIYOR ────────────────────────────────────
   Ölçüm dolaylı değil: göç yeniden koşsaydı grupId'si dolu bir satırın
   egitimId'sini NULL'a çeker (çapa temizliği). Satır olduğu gibi kalıyorsa
   `kuralTablosunuTazele` erken dönmüş demektir. */
d.prepare("INSERT INTO kural (id,egitimId,grupId,kosul,aktif) VALUES (?,?,?,?,?)").run(
  "krl_capa",
  "egt_eski1",
  "grp_1",
  '{"bolum":["Kaynak"]}',
  1,
);

const d2 = await dbAc(eski.klasor);
const capa = d2.prepare("SELECT * FROM kural WHERE id='krl_capa'").get();
esit(capa.egitimId, "egt_eski1", "ikinci açılış göçü TEKRARLAMIYOR (çapa satırına dokunulmadı)");
esit(d2.prepare("SELECT COUNT(*) n FROM kural").get().n, 5, "ikinci açılışta kural sayısı değişmedi");
kontrol(
  !d2.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='kural_yeni'").get(),
  "ikinci açılış geçici tablo bırakmadı",
);
esit(d2.pragma("foreign_key_check"), [], "ikinci açılıştan sonra da yabancı anahtar ihlali yok");
/* Anlık görüntü göçü de bir kez çalışır: her açılışta yeniden alsaydı
   (egitimId, surum) tekilliğine takılıp uygulamayı hiç açtırmazdı. */
esit(
  d2.prepare("SELECT COUNT(*) n FROM yayinSurum").get().n,
  2,
  "ikinci açılış ikinci bir anlık görüntü almadı",
);
esit(
  d2.prepare("SELECT COUNT(*) n FROM yayinSayfa").get().n,
  1,
  "ikinci açılışta anlık görüntü kartları çoğalmadı",
);

/* ══ 2. YARIM YÜKSELTİLMİŞ ŞEMA (grupId var ama egitimId hâlâ NOT NULL) ════
   Ara sürümlerin bıraktığı hâl: paket kuralı bir ÜYE eğitime çapalanmıştı.
   Göç o çapaları temizlemeli — temizlemezse çapa eğitimi silindiğinde
   ON DELETE CASCADE paket kuralını da sessizce götürür. */

const yarim = eskiKurulumKur(`
CREATE TABLE kural (
  id TEXT PRIMARY KEY,
  egitimId TEXT NOT NULL REFERENCES egitim(id) ON DELETE CASCADE,
  grupId TEXT,
  kosul TEXT NOT NULL,
  sonTarih TEXT,
  aktif INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX ix_kural_egitim ON kural(egitimId);
CREATE TABLE grup (id TEXT PRIMARY KEY, ad TEXT NOT NULL, aciklama TEXT, olusturma TEXT NOT NULL);
`);
yarim.d.prepare("INSERT INTO grup (id,ad,olusturma) VALUES (?,?,?)").run("grp_ory", "Oryantasyon", "2025-06-01T00:00:00.000Z");
yarim.d
  .prepare("INSERT INTO kural (id,egitimId,grupId,kosul,aktif) VALUES (?,?,?,?,?)")
  .run("krl_capali", "egt_eski1", "grp_ory", '{"bolum":["Montaj"]}', 1);
yarim.d
  .prepare("INSERT INTO kural (id,egitimId,grupId,kosul,aktif) VALUES (?,?,?,?,?)")
  .run("krl_tekil", "egt_eski2", "", '{"hat":["Hat 2"]}', 1);
yarim.d.close();

const d3 = await dbAc(yarim.klasor);
const capali = d3.prepare("SELECT * FROM kural WHERE id='krl_capali'").get();
esit(capali.grupId, "grp_ory", "paket kuralının paket bağı korundu");
esit(capali.egitimId, null, "paket kuralının eğitim çapası temizlendi (CASCADE tuzağı)");
const tekil = d3.prepare("SELECT * FROM kural WHERE id='krl_tekil'").get();
esit(tekil.egitimId, "egt_eski2", "tekil kuralın eğitim bağı korundu");
esit(tekil.grupId, null, "boş dize paket bağı NULL'a çevrildi");
esit(
  d3.pragma("table_info(kural)").find((s) => s.name === "egitimId").notnull,
  0,
  "yarım yükseltmede de egitimId gevşetildi",
);
const yarimTablolar = new Set(
  d3.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((s) => s.name),
);
for (const t of ["grupUye", "medya", "mmEsleme"]) {
  kontrol(yarimTablolar.has(t), `yarım yükseltmede '${t}' tablosu oluştu`);
}
esit(d3.pragma("foreign_key_check"), [], "yarım yükseltmede yabancı anahtar ihlali yok");

/* ══ 3. BOŞ KLASÖR — yeni kurulum yolu bozulmadı ═══════════════════════════ */
const yeniKlasor = mkdtempSync(join(tmpdir(), "flowtrain-yeni-"));
const d4 = await dbAc(yeniKlasor);
const yeniTablolar = new Set(
  d4.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((s) => s.name),
);
for (const t of ["egitim", "kural", "grup", "grupUye", "medya", "mmEsleme", "oturum", "pin"]) {
  kontrol(yeniTablolar.has(t), `yeni kurulumda '${t}' tablosu var`);
}
esit(
  d4.pragma("table_info(kural)").find((s) => s.name === "egitimId").notnull,
  0,
  "yeni kurulumda egitimId zaten NULL kabul ediyor",
);
kontrol(
  new Set(d4.prepare("SELECT name FROM sqlite_master WHERE type='index'").all().map((s) => s.name)).has("ix_kural_grup"),
  "yeni kurulumda grupId indeksi var",
);

/* ══ 4. KURALIN KENDİSİ KAYNAKTA DURUYOR MU ═══════════════════════════════
   Yukarıdaki üç bölüm davranışı ölçüyor; bu bölüm kuralı ADIYLA koruyor.
   `ix_kural_grup` şema betiğinin içine geri taşınırsa hata yeniden doğar ve
   sebebi (sıra) yorumdan okunmadıkça anlaşılmaz. */
const dbKaynak = readFileSync(join(process.cwd(), "src", "lib", "db.ts"), "utf8");
const semaMetni = dbKaynak.match(/const SEMA = `([\s\S]*?)\n`;/)?.[1] ?? "";
kontrol(semaMetni.length > 0, "şema betiği kaynakta bulundu");
/* Yalnız GERÇEK ifadeye bakılıyor: kuralı anlatan yorumun kendisi de aynı adı
   içeriyor ve düz metin araması onu sınav ihlali sanıyordu. */
const INDEKS_IFADESI = /CREATE\s+INDEX[^;]*ix_kural_grup/i;
kontrol(
  !INDEKS_IFADESI.test(semaMetni),
  "grupId indeksi şema betiğinin İÇİNDE değil (var olan kurulumda betiği yarıda keserdi)",
);
const gocGovdesi = dbKaynak.slice(dbKaynak.indexOf("function gocleriUygula"));
kontrol(
  /gocleriUygula\(d\)/.test(dbKaynak) && INDEKS_IFADESI.test(gocGovdesi),
  "grupId indeksi göç işlevinin içinde kuruluyor",
);

bitir("yükseltme");
