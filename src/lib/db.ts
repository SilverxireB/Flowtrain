import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

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

CREATE TABLE IF NOT EXISTS kural (
  id TEXT PRIMARY KEY,
  egitimId TEXT NOT NULL REFERENCES egitim(id) ON DELETE CASCADE,
  kosul TEXT NOT NULL,
  sonTarih TEXT,
  aktif INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS ix_kural_egitim ON kural(egitimId);

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
`;

export function db(): Database.Database {
  if (_db) return _db;
  if (!existsSync(VERI_KLASORU)) mkdirSync(VERI_KLASORU, { recursive: true });
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
  ];
  for (const sorgu of ekle) {
    try {
      d.exec(sorgu);
    } catch {
      /* sütun zaten var */
    }
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
