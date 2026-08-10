import Database from "better-sqlite3";
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * SQLite deposu — tek dosya, veri klasörünün içinde.
 *
 * NEDEN JSON DEĞİL: Sign self-host'ta `data/*.json` 10-20 ofis kullanıcısı için
 * yeterliydi. Burada hacim kişi × eğitim × deneme ile çarpılıyor (400 kişi,
 * yıllar boyu) ve amir tableti "ekibimin eksikleri" sorgusunu her açılışta
 * soruyor. Dosyayı baştan sona okuyan bir depo bunu taşımaz.
 *
 * VERİ KLASÖRÜ = YEDEK YERİ. Tek klasör kopyalanınca kurulum taşınır; kurulum
 * belgesinde söylenen tek yedek talimatı budur.
 */
export const VERI_KLASORU = process.env.FLOWTRAIN_DATA ?? join(process.cwd(), "data");

let _db: Database.Database | null = null;

const SEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS egitim (
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

CREATE TABLE IF NOT EXISTS sayfa (
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
CREATE INDEX IF NOT EXISTS ix_sayfa_egitim ON sayfa(egitimId, sira);

CREATE TABLE IF NOT EXISTS soru (
  id TEXT PRIMARY KEY,
  egitimId TEXT NOT NULL REFERENCES egitim(id) ON DELETE CASCADE,
  tip TEXT NOT NULL,
  metin TEXT NOT NULL,
  secenekler TEXT NOT NULL,
  dogru TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_soru_egitim ON soru(egitimId);

/* egitimId NULL OLABİLİR: pakete yazılan kuralda mantıken tek bir eğitim
   yoktur, grupId sütunu doludur. NOT NULL olsaydı paket kuralı bir üye
   eğitime "çapalanmak" zorunda kalır ve o eğitim silindiğinde CASCADE
   kuralı da sessizce götürürdü. İkisinden biri dolu olmalı. */
CREATE TABLE IF NOT EXISTS kural (
  id TEXT PRIMARY KEY,
  egitimId TEXT REFERENCES egitim(id) ON DELETE CASCADE,
  grupId TEXT REFERENCES grup(id) ON DELETE CASCADE,
  kosul TEXT NOT NULL,
  sonTarih TEXT,
  aktif INTEGER NOT NULL DEFAULT 1,
  CHECK (egitimId IS NOT NULL OR grupId IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS ix_kural_egitim ON kural(egitimId);
/* ix_kural_grup BURADA DEĞİL, göçten SONRA kuruluyor: var olan bir kurulumda
   CREATE TABLE IF NOT EXISTS boş geçer ve tabloda henüz grupId sütunu yoktur.
   İndeks burada olsaydı "no such column: grupId" ile PATLAR, exec tüm betiği
   yarıda keser ve ALTINDAKİ tablolar (grup, medya, mmEsleme) hiç oluşmazdı.
   Yeni kurulumda görünmeyen, yalnız YÜKSELTMEDE çıkan bir hata. */

CREATE TABLE IF NOT EXISTS oturum (
  id TEXT PRIMARY KEY,
  egitimId TEXT NOT NULL,
  egitimSurum INTEGER NOT NULL,
  sicil TEXT NOT NULL,
  gozeten TEXT,
  cihaz TEXT NOT NULL DEFAULT 'kiosk',
  baslangic TEXT NOT NULL,
  bitis TEXT,
  sayfaSureleri TEXT NOT NULL DEFAULT '{}',
  /* Oturum açılırken SEÇİLEN soru kimlikleri. Bitişte havuzdan yeniden
     üretilseydi, arada havuza tek bir soru eklenmesi permütasyonu değiştirip
     kişiyi HİÇ GÖRMEDİĞİ sorulardan puanlardı. */
  sorulanSoruIdleri TEXT NOT NULL DEFAULT '[]',
  puan INTEGER,
  sonuc TEXT,
  senkron TEXT NOT NULL DEFAULT 'bekliyor'
);
CREATE INDEX IF NOT EXISTS ix_oturum_sicil ON oturum(sicil, egitimId);
CREATE INDEX IF NOT EXISTS ix_oturum_egitim ON oturum(egitimId);
CREATE INDEX IF NOT EXISTS ix_oturum_senkron ON oturum(senkron);

/* Sorunun kaç kez sorulup kaç kez yanlış yapıldığı — İÇERİK KALİTE SİNYALİ.
   Ayrı tabloda tutulur çünkü oturum silinse de sinyal kalmalı. */
CREATE TABLE IF NOT EXISTS soruIstatistik (
  soruId TEXT PRIMARY KEY,
  deneme INTEGER NOT NULL DEFAULT 0,
  yanlis INTEGER NOT NULL DEFAULT 0
);

/* İşçi PIN'i — imza yerine geçer. Düz metin TUTULMAZ.
   hataliDeneme/kilitBitis: dört haneli bir sır kaba kuvvete 10.000 denemede
   düşer. Tek gerçek savunma denemeyi PAHALI kılmaktır. */
CREATE TABLE IF NOT EXISTS pin (
  sicil TEXT PRIMARY KEY,
  ozet TEXT NOT NULL,
  tuz TEXT NOT NULL,
  olusturma TEXT NOT NULL,
  hataliDeneme INTEGER NOT NULL DEFAULT 0,
  kilitBitis TEXT
);

CREATE TABLE IF NOT EXISTS hesap (
  kullanici TEXT PRIMARY KEY,
  ad TEXT NOT NULL,
  rol TEXT NOT NULL,
  ozet TEXT NOT NULL,
  tuz TEXT NOT NULL,
  sicil TEXT,
  olusturma TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS iz (
  id TEXT PRIMARY KEY,
  kim TEXT NOT NULL,
  ne TEXT NOT NULL,
  neZaman TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_iz_zaman ON iz(neZaman);

CREATE TABLE IF NOT EXISTS ayar (
  anahtar TEXT PRIMARY KEY,
  deger TEXT NOT NULL
);

/* ── ZİYARETÇİ DEFTERİ ─────────────────────────────────────────────────────
   Ziyaretçi personel DEĞİLDİR: sicili, amiri, PIN'i, atama kuralı yoktur ve
   panoya düşmez. Bu yüzden oturum tablosuna karışmaz, kendi defterinde
   yaşar — yoksa fabrikanın tamamlanma oranı her ay yüzlerce misafirle
   sulanırdı.

   DİKKAT: burası bir şablon dize; yorumlarda ters tırnak KULLANILMAZ, dizeyi
   kapatır ve dosya derlenmez. */

/* Kayıt ekranındaki sorular. Şık → eğitim eşlemesi KODDA DEĞİL BURADA:
   her fabrika kendi sorusunu yazsın, kurulum için yazılımcı gerekmesin. */
CREATE TABLE IF NOT EXISTS ziyaretciSoru (
  id TEXT PRIMARY KEY,
  sira INTEGER NOT NULL,
  metin TEXT NOT NULL,
  tip TEXT NOT NULL DEFAULT 'evetHayir',
  secenekler TEXT NOT NULL DEFAULT '["Evet","Hayır"]',
  eslesme TEXT NOT NULL DEFAULT '{}',
  aktif INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS ziyaretci (
  id TEXT PRIMARY KEY,
  ad TEXT NOT NULL,
  firma TEXT,
  ziyaretEttigi TEXT,
  cevaplar TEXT NOT NULL DEFAULT '{}',
  egitimIdleri TEXT NOT NULL DEFAULT '[]',
  kayitZamani TEXT NOT NULL,
  tamamlanma TEXT,
  kaydeden TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_ziyaretci_zaman ON ziyaretci(kayitZamani);

/* egitimId sütununda KASITLI OLARAK yabancı anahtar yok: eğitim sonradan
   silinse bile "bu kişiye şu gün şu bilgilendirme verildi" kaydı ayakta
   kalmalı. Denetimde işe yarayan şey kaydın kendisi, bağlantısı değil. */
CREATE TABLE IF NOT EXISTS ziyaretciOturum (
  id TEXT PRIMARY KEY,
  ziyaretciId TEXT NOT NULL REFERENCES ziyaretci(id) ON DELETE CASCADE,
  egitimId TEXT NOT NULL,
  egitimAdi TEXT NOT NULL DEFAULT '',
  egitimSurum INTEGER NOT NULL,
  baslangic TEXT NOT NULL,
  bitis TEXT,
  sayfaSureleri TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS ix_ziyaretciOturum_z ON ziyaretciOturum(ziyaretciId);

/* Maliyet merkezi → bölüm + amir eşlemesi. OPM'den (ya da OPM dışa aktarım
   dosyasından) gelen kayıtta yalnız maliyet merkezi kodu vardır; bölümü ve
   amiri bu tablo belirler. EŞLEME VERİDİR, KODDA DEĞİL — ziyaretçi soru
   eşlemesiyle aynı gerekçe: her fabrika kendi kodlarını kendisi bağlar.
   OPM'e özel alanlar çekirdek tiplere GİRMEZ; bu tablo adaptör tarafının
   sözlüğüdür, Kisi tipi yine yalnız bölüm/amir görür. */
CREATE TABLE IF NOT EXISTS mmEsleme (
  kod TEXT PRIMARY KEY,
  bolum TEXT NOT NULL DEFAULT '',
  amirSicil TEXT NOT NULL DEFAULT ''
);

/* ── EĞİTİM PAKETİ (grup) ──────────────────────────────────────────────────
   "Oryantasyon" = beş eğitim. Atama kuralı pakete yazılınca içindekiler
   topluca düşer; pakete sonradan eklenen eğitim, kural yeniden yazılmadan
   herkese gider. Kurallar tek tek eğitime yazılsaydı paket değiştikçe
   kuralları elle güncellemek gerekirdi ve biri mutlaka unutulurdu. */
CREATE TABLE IF NOT EXISTS grup (
  id TEXT PRIMARY KEY,
  ad TEXT NOT NULL,
  aciklama TEXT,
  olusturma TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS grupUye (
  grupId TEXT NOT NULL REFERENCES grup(id) ON DELETE CASCADE,
  egitimId TEXT NOT NULL REFERENCES egitim(id) ON DELETE CASCADE,
  sira INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (grupId, egitimId)
);

/* Medya kütüphanesi — dosyalar zaten veri/medya'da; bu tablo onların
   ADINI ve nereden geldiğini tutar. Dosya adı tek başına "kkd fotoğrafı mı,
   forklift mi" sorusunu cevaplamıyordu, hazırlayan her seferinde yeniden
   yüklüyordu. */
CREATE TABLE IF NOT EXISTS medya (
  id TEXT PRIMARY KEY,
  ad TEXT NOT NULL DEFAULT '',
  tip TEXT NOT NULL DEFAULT '',
  boyut INTEGER NOT NULL DEFAULT 0,
  yukleyen TEXT NOT NULL DEFAULT '',
  olusturma TEXT NOT NULL,
  altMetin TEXT,
  kutuphaneDisi INTEGER NOT NULL DEFAULT 0
);
`;

/**
 * `FLOWTRAIN_TOHUM` — BOŞ bir veri klasörünü hazır bir klasörden doldurur.
 *
 * Dosya sistemi kalıcı olmayan bir sunucuda (vitrin dağıtımı: her soğuk
 * açılışta boş bir geçici klasör) uygulama kurulum ekranıyla karşılıyordu.
 * Bu değişken verildiğinde hazır klasör bir kez kopyalanır; link her
 * açıldığında aynı dolu kurulum gelir.
 *
 * İKİ KAPI: değişken yoksa (self-host'ta HEP yok) tek bir okumadır, hiçbir şey
 * değişmez; veri klasöründe ZATEN veritabanı varsa hiç dokunulmaz — kurulmuş
 * bir kutunun verisi asla ezilmez.
 */
function tohumKlasorunuAc(): void {
  const kaynak = process.env.FLOWTRAIN_TOHUM;
  if (!kaynak) return;
  if (existsSync(join(VERI_KLASORU, "flowtrain.db"))) return;

  const mutlak = resolve(kaynak);
  if (!existsSync(mutlak) || mutlak === resolve(VERI_KLASORU)) return;
  /* `-shm` KOPYALANMAZ: paylaşımlı bellek indeksidir, açılışta yeniden
     üretilir; başka bir makineden gelen kalıntı SQLite'ı yanıltır. */
  cpSync(mutlak, VERI_KLASORU, { recursive: true, filter: (y) => !y.endsWith("-shm") });
}

export function db(): Database.Database {
  if (_db) return _db;
  if (!existsSync(VERI_KLASORU)) mkdirSync(VERI_KLASORU, { recursive: true });
  tohumKlasorunuAc();
  if (!existsSync(join(VERI_KLASORU, "medya"))) mkdirSync(join(VERI_KLASORU, "medya"), { recursive: true });
  const d = new Database(join(VERI_KLASORU, "flowtrain.db"));
  d.exec(SEMA);
  gocleriUygula(d);
  _db = d;
  return d;
}

/**
 * `CREATE TABLE IF NOT EXISTS` var olan tabloya YENİ SÜTUN eklemez — kurulum
 * güncellendiğinde eski veritabanı sessizce eksik sütunla kalır ve ilk sorguda
 * patlar. Eklemeler burada, "zaten var" hatasını yutarak uygulanır.
 */
function gocleriUygula(d: Database.Database): void {
  const ekle = [
    "ALTER TABLE pin ADD COLUMN hataliDeneme INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE pin ADD COLUMN kilitBitis TEXT",
    "ALTER TABLE oturum ADD COLUMN sorulanSoruIdleri TEXT NOT NULL DEFAULT '[]'",

    /* Katalog alanları: kategori süzer, zorunlu/planlanan süre denetim
       raporunda görünür, egitmen sınıf eğitiminin varsayılanıdır. */
    "ALTER TABLE egitim ADD COLUMN kategori TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE egitim ADD COLUMN zorunlu INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE egitim ADD COLUMN sureDk INTEGER",
    "ALTER TABLE egitim ADD COLUMN egitmen TEXT",

    /* Oturumun nereden geldiği: kiosk · amir tableti · sınıf · dış aktarım.
       `cihaz` serbest metindi ve rapor süzgeci ona güvenemiyordu. */
    "ALTER TABLE oturum ADD COLUMN kaynak TEXT NOT NULL DEFAULT 'kiosk'",
    "ALTER TABLE oturum ADD COLUMN egitmen TEXT",
    "ALTER TABLE oturum ADD COLUMN notlar TEXT",

    /* Soruya görsel ve "neden yanlış" açıklaması. */
    "ALTER TABLE soru ADD COLUMN gorselId TEXT",
    "ALTER TABLE soru ADD COLUMN aciklama TEXT",

    /* Kartta birden çok görsel (JSON dizi). Tekil `gorselId` korunur:
       eski kayıtlar ve tek görselli kartlar onu kullanmaya devam eder. */
    "ALTER TABLE sayfa ADD COLUMN gorselIdler TEXT NOT NULL DEFAULT '[]'",

    /* Görselin ne gösterdiği — ekran okuyucu için. */
    "ALTER TABLE medya ADD COLUMN altMetin TEXT",

    /* İçe aktarılan sayfa görselleri: kaydı var, kütüphane listesinde yok. */
    "ALTER TABLE medya ADD COLUMN kutuphaneDisi INTEGER NOT NULL DEFAULT 0",
  ];
  for (const sorgu of ekle) {
    try {
      d.exec(sorgu);
    } catch {
      /* sütun zaten var */
    }
  }

  kuralTablosunuTazele(d);

  // Sütunu göç garanti ettikten SONRA: şemanın içinde olsaydı var olan
  // kurulumda betiği yarıda keserdi (yukarıdaki nota bkz).
  d.exec("CREATE INDEX IF NOT EXISTS ix_kural_grup ON kural(grupId)");
}

/**
 * `kural.egitimId`i NULL kabul eder hâle getirir (paket kuralları için).
 *
 * SQLite sütun kısıtını `ALTER` ile gevşetemez; tablo yeniden kurulur. Eski
 * kurulumlarda paket kuralı bir üye eğitime çapalanmıştı — bu göç o çapaları
 * da temizler, çünkü çapa eğitimi silinseydi `ON DELETE CASCADE` paket
 * kuralını da sessizce götürürdü.
 *
 * Yalnız GEREKİYORSA çalışır: sütun zaten NULL kabul ediyorsa hiçbir şey
 * yapılmaz, yoksa her açılışta tablo boşuna yeniden kurulurdu.
 */
function kuralTablosunuTazele(d: Database.Database): void {
  const sutunlar = d.pragma("table_info(kural)") as { name: string; notnull: number }[];
  const egitimIdSutunu = sutunlar.find((s) => s.name === "egitimId");
  if (!egitimIdSutunu || egitimIdSutunu.notnull === 0) return;

  /* KAYNAK SÜTUN VAR MI DİYE BAKILIYOR. Eski kurulumların bir kısmında kural
     tablosunda grupId hiç yok; sorguya körlemesine yazılsaydı "no such column"
     ile patlar, yarım kalan göç yeni tabloyu geride bırakır ve bir sonraki
     açılışta "table kural_yeni already exists" derdi. */
  const grupIdVar = sutunlar.some((s) => s.name === "grupId");
  const grupIfadesi = grupIdVar ? "NULLIF(grupId,'')" : "NULL";
  const egitimIfadesi = grupIdVar
    ? "CASE WHEN grupId IS NOT NULL AND grupId <> '' THEN NULL ELSE egitimId END"
    : "egitimId";

  // Yabancı anahtar denetimi kapalıyken yapılır: tablo bir an için DROP edilir
  // ve açık denetim ara durumda kuralları silerdi.
  d.pragma("foreign_keys = OFF");
  try {
    // Yarım kalmış bir denemeden artakalmış olabilir.
    d.exec("DROP TABLE IF EXISTS kural_yeni");
    // TEK İŞLEM: ortada kesilirse tablo eski hâline döner, yarım şema kalmaz.
    d.transaction(() => {
      d.exec(`
        CREATE TABLE kural_yeni (
          id TEXT PRIMARY KEY,
          egitimId TEXT REFERENCES egitim(id) ON DELETE CASCADE,
          grupId TEXT REFERENCES grup(id) ON DELETE CASCADE,
          kosul TEXT NOT NULL,
          sonTarih TEXT,
          aktif INTEGER NOT NULL DEFAULT 1,
          CHECK (egitimId IS NOT NULL OR grupId IS NOT NULL)
        );
        INSERT INTO kural_yeni (id,egitimId,grupId,kosul,sonTarih,aktif)
          SELECT id, ${egitimIfadesi}, ${grupIfadesi}, kosul, sonTarih, aktif FROM kural;
        DROP TABLE kural;
        ALTER TABLE kural_yeni RENAME TO kural;
        CREATE INDEX IF NOT EXISTS ix_kural_egitim ON kural(egitimId);
      `);
    })();
  } finally {
    d.pragma("foreign_keys = ON");
  }
}

/** Sınavlarda bellek içi depo kurmak için (diske hiç dokunmaz). */
export function bellekDb(): Database.Database {
  const d = new Database(":memory:");
  d.exec(SEMA);
  return d;
}

export function simdi(): string {
  return new Date().toISOString();
}

export function bugun(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Kimlik: `crypto.randomUUID` her ortamda var (Node 19+, tarayıcı).
 * Zaman damgalı önek listeleri kronolojik sıralar — ayrı sıra sütunu gerekmez.
 */
export function kimlik(onek: string): string {
  return `${onek}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
