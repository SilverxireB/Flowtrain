import "server-only";
import { db, kimlik, simdi } from "./db";
import { ayarOku, ayarYaz, izBirak } from "./depo";
import { ilerleme, type Ziyaretci, type ZiyaretciOturum, type ZiyaretciSoru } from "./ziyaretci";
import { SAKLAMA_KAPALI, saklamaGunuTemizle, saklamaSiniri } from "./ziyaretciCikti";

/**
 * ZİYARETÇİ DEFTERİ DEPOSU — `depo.ts`ten AYRI dosya, bilerek.
 *
 * Ziyaretçi ürünün ikinci ve bağımsız dünyası: personel listesine, atama
 * motoruna ve panoya hiç dokunmaz. İki dünyayı aynı dosyaya koymak, zamanla
 * birinin sorgusunun ötekine sızmasıyla biter.
 *
 * Karar mantığı burada DEĞİL `ziyaretci.ts`te (saf ve sınavlı); bu dosya
 * yalnız veritabanını bağlar.
 */

type Satir = Record<string, unknown>;

const VARSAYILAN_ANAHTAR = "ziyaretciVarsayilanEgitimler";
const SAKLAMA_ANAHTAR = "ziyaretciSaklamaGun";

/* ── satır ↔ nesne ────────────────────────────────────────────────────────── */

function ziyaretciden(r: Satir): Ziyaretci {
  return {
    id: r.id as string,
    ad: r.ad as string,
    firma: (r.firma as string) ?? undefined,
    ziyaretEttigi: (r.ziyaretEttigi as string) ?? undefined,
    cevaplar: JSON.parse(r.cevaplar as string),
    egitimIdleri: JSON.parse(r.egitimIdleri as string),
    kayitZamani: r.kayitZamani as string,
    tamamlanma: (r.tamamlanma as string) ?? undefined,
    kaydeden: r.kaydeden as string,
  };
}

function sorudan(r: Satir): ZiyaretciSoru {
  return {
    id: r.id as string,
    sira: r.sira as number,
    metin: r.metin as string,
    tip: r.tip as ZiyaretciSoru["tip"],
    secenekler: JSON.parse(r.secenekler as string),
    eslesme: JSON.parse(r.eslesme as string),
    aktif: !!r.aktif,
  };
}

function oturumdan(r: Satir): ZiyaretciOturum & { egitimAdi: string } {
  return {
    id: r.id as string,
    ziyaretciId: r.ziyaretciId as string,
    egitimId: r.egitimId as string,
    egitimAdi: r.egitimAdi as string,
    egitimSurum: r.egitimSurum as number,
    baslangic: r.baslangic as string,
    bitis: (r.bitis as string) ?? undefined,
    sayfaSureleri: JSON.parse(r.sayfaSureleri as string),
  };
}

/* ── kayıt soruları ───────────────────────────────────────────────────────── */

export function sorulariGetir(): ZiyaretciSoru[] {
  return db().prepare("SELECT * FROM ziyaretciSoru ORDER BY sira").all().map((r) => sorudan(r as Satir));
}

export function soruEkle(veri: Partial<ZiyaretciSoru>): ZiyaretciSoru {
  const enSon = db().prepare("SELECT MAX(sira) s FROM ziyaretciSoru").get() as { s: number | null };
  const soru: ZiyaretciSoru = {
    id: kimlik("zsr"),
    sira: (enSon.s ?? 0) + 1,
    metin: veri.metin ?? "",
    tip: veri.tip ?? "evetHayir",
    secenekler: veri.secenekler ?? ["Evet", "Hayır"],
    eslesme: veri.eslesme ?? {},
    aktif: veri.aktif ?? true,
  };
  db()
    .prepare("INSERT INTO ziyaretciSoru (id,sira,metin,tip,secenekler,eslesme,aktif) VALUES (?,?,?,?,?,?,?)")
    .run(soru.id, soru.sira, soru.metin, soru.tip, JSON.stringify(soru.secenekler), JSON.stringify(soru.eslesme), soru.aktif ? 1 : 0);
  return soru;
}

export function soruGuncelle(id: string, yama: Partial<ZiyaretciSoru>): void {
  const mevcut = db().prepare("SELECT * FROM ziyaretciSoru WHERE id=?").get(id) as Satir | undefined;
  if (!mevcut) return;
  const s = { ...sorudan(mevcut), ...yama };
  db()
    .prepare("UPDATE ziyaretciSoru SET sira=?, metin=?, tip=?, secenekler=?, eslesme=?, aktif=? WHERE id=?")
    .run(s.sira, s.metin, s.tip, JSON.stringify(s.secenekler), JSON.stringify(s.eslesme), s.aktif ? 1 : 0, id);
}

export function soruSil(id: string): void {
  db().prepare("DELETE FROM ziyaretciSoru WHERE id=?").run(id);
}

/** Sıralama tek yazımda gönderilir — yarım kalan sıralama listeyi bozar. */
export function sorulariSirala(sirali: string[]): void {
  const g = db().prepare("UPDATE ziyaretciSoru SET sira=? WHERE id=?");
  db().transaction(() => sirali.forEach((id, i) => g.run(i + 1, id)))();
}

/* ── varsayılan (kaldırılamaz) bilgilendirmeler ───────────────────────────── */

export function varsayilanEgitimler(): string[] {
  try {
    const v = JSON.parse(ayarOku(VARSAYILAN_ANAHTAR, "[]"));
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function varsayilanEgitimleriYaz(idler: string[]): void {
  ayarYaz(VARSAYILAN_ANAHTAR, JSON.stringify([...new Set(idler)]));
}

/* ── ziyaretçi ────────────────────────────────────────────────────────────── */

export function ziyaretciGetir(id: string): Ziyaretci | null {
  const r = db().prepare("SELECT * FROM ziyaretci WHERE id=?").get(id) as Satir | undefined;
  return r ? ziyaretciden(r) : null;
}

/** Son N gün — liste ekranı bunu kullanır (varsayılan: bugün ve dün). */
export function ziyaretcileriGetir(gun = 2): Ziyaretci[] {
  const sinir = new Date(Date.now() - gun * 86_400_000).toISOString();
  return db()
    .prepare("SELECT * FROM ziyaretci WHERE kayitZamani >= ? ORDER BY kayitZamani DESC")
    .all(sinir)
    .map((r) => ziyaretciden(r as Satir));
}

export function ziyaretciKaydet(veri: {
  ad: string;
  firma?: string;
  ziyaretEttigi?: string;
  cevaplar: Record<string, number[]>;
  egitimIdleri: string[];
  kaydeden: string;
}): Ziyaretci {
  const z: Ziyaretci = { id: kimlik("zyt"), ...veri, kayitZamani: simdi() };
  db()
    .prepare(
      `INSERT INTO ziyaretci (id,ad,firma,ziyaretEttigi,cevaplar,egitimIdleri,kayitZamani,tamamlanma,kaydeden)
       VALUES (?,?,?,?,?,?,?,NULL,?)`,
    )
    .run(
      z.id, z.ad, z.firma ?? null, z.ziyaretEttigi ?? null,
      JSON.stringify(z.cevaplar), JSON.stringify(z.egitimIdleri), z.kayitZamani, z.kaydeden,
    );
  return z;
}

export function ziyaretciSil(id: string): void {
  db().prepare("DELETE FROM ziyaretci WHERE id=?").run(id);
}

/**
 * Dışa aktarım için tarih aralığı.
 * `gun <= 0` → defterin tamamı. Liste ekranındaki `ziyaretcileriGetir`ten
 * ayrı tutuluyor: orada varsayılan iki gün ve bu ekran kararı, çıktıya
 * karışmamalı.
 */
export function ziyaretcileriAralikta(gun: number): Ziyaretci[] {
  if (gun <= 0) {
    return db()
      .prepare("SELECT * FROM ziyaretci ORDER BY kayitZamani DESC")
      .all()
      .map((r) => ziyaretciden(r as Satir));
  }
  return ziyaretcileriGetir(gun);
}

/* ── saklama süresi (KVKK) ────────────────────────────────────────────────── */

export function saklamaGunu(): number {
  return saklamaGunuTemizle(ayarOku(SAKLAMA_ANAHTAR, String(SAKLAMA_KAPALI)));
}

export function saklamaGunuYaz(gun: number): number {
  const temiz = saklamaGunuTemizle(gun);
  ayarYaz(SAKLAMA_ANAHTAR, String(temiz));
  return temiz;
}

/**
 * Süresi dolmuş kaç kayıt var.
 * Sayı EKRANDA yazılır: "eski kayıtlar silinecek" cümlesi üç kayıtla üç bin
 * kaydı aynı gösteriyordu. Tüm defteri belleğe almadan sayılır.
 */
export function eskiSayisi(): number {
  const sinir = saklamaSiniri(saklamaGunu(), simdi());
  if (!sinir) return 0;
  const r = db().prepare("SELECT COUNT(*) n FROM ziyaretci WHERE kayitZamani < ?").get(sinir) as { n: number };
  return r.n;
}

/**
 * Süresi dolmuş ziyaretçi kayıtlarını siler.
 *
 * ZİYARETÇİ OTURUMLARI DA GİDER: `ziyaretciOturum` tablosu ziyaretçiye
 * `ON DELETE CASCADE` ile bağlı. "Adı sildik ama izlediklerinin kaydı duruyor"
 * hâli KVKK açısından yarım bir silme olurdu.
 *
 * DENETİM İZİ SESSİZ SİLMEYE KARŞI: kaç kayıt, hangi sınırdan eski, hangi
 * ayarla. İz olmadan "veriyi biz mi sildik, hiç mi girmedik" sorusunun cevabı
 * yok. Silinecek bir şey yoksa iz de bırakılmaz — günlüğü boş satırla
 * doldurmak izin kendisini okunmaz yapardı.
 */
export function eskileriTemizle(kim = "sistem"): { silinen: number; sinir: string } | null {
  const gun = saklamaGunu();
  const sinir = saklamaSiniri(gun, simdi());
  if (!sinir) return null;

  const r = db().prepare("DELETE FROM ziyaretci WHERE kayitZamani < ?").run(sinir);
  if (r.changes === 0) return { silinen: 0, sinir };

  izBirak(kim, `ziyaretçi saklama temizliği: ${r.changes} kayıt silindi (${gun} günden eski, sınır ${sinir.slice(0, 10)})`);
  return { silinen: r.changes, sinir };
}

/* ── bilgilendirme oturumları ─────────────────────────────────────────────── */

export function oturumlariGetir(ziyaretciId: string): (ZiyaretciOturum & { egitimAdi: string })[] {
  return db()
    .prepare("SELECT * FROM ziyaretciOturum WHERE ziyaretciId=? ORDER BY baslangic")
    .all(ziyaretciId)
    .map((r) => oturumdan(r as Satir));
}

export function bitenEgitimIdleri(ziyaretciId: string): string[] {
  return db()
    .prepare("SELECT DISTINCT egitimId FROM ziyaretciOturum WHERE ziyaretciId=? AND bitis IS NOT NULL")
    .all(ziyaretciId)
    .map((r) => (r as { egitimId: string }).egitimId);
}

/**
 * Yarım kalan oturumu YENİDEN KULLANIR.
 *
 * Ziyaretçinin deneme hakkı yoktur; tablet elinden düşüp sayfa yenilenirse
 * yeni bir satır açmak, tek bir bilgilendirme için defterde onlarca yarım
 * kayıt bırakırdı.
 */
export function oturumBaslat(veri: {
  ziyaretciId: string;
  egitimId: string;
  egitimAdi: string;
  egitimSurum: number;
}): ZiyaretciOturum {
  const acik = db()
    .prepare("SELECT * FROM ziyaretciOturum WHERE ziyaretciId=? AND egitimId=? AND bitis IS NULL")
    .get(veri.ziyaretciId, veri.egitimId) as Satir | undefined;
  if (acik) return oturumdan(acik);

  const o: ZiyaretciOturum = { id: kimlik("zot"), ...veri, baslangic: simdi(), sayfaSureleri: {} };
  db()
    .prepare(
      `INSERT INTO ziyaretciOturum (id,ziyaretciId,egitimId,egitimAdi,egitimSurum,baslangic,sayfaSureleri)
       VALUES (?,?,?,?,?,?,'{}')`,
    )
    .run(o.id, o.ziyaretciId, o.egitimId, veri.egitimAdi, o.egitimSurum, o.baslangic);
  return o;
}

/**
 * Oturumu kapatır ve ziyaretçinin TÜM listesi bittiyse tamamlanma damgası
 * atar. İkisi tek işlemde: damga atılmadan yarıda kalan bir yazım, ziyaretçiyi
 * "her şeyi bitirdi ama listede duruyor" hâlinde bırakırdı.
 */
export function oturumBitir(oturumId: string, sayfaSureleri: Record<string, number>): { tamamlandi: boolean } {
  const d = db();
  let tamamlandi = false;

  d.transaction(() => {
    const o = d.prepare("SELECT * FROM ziyaretciOturum WHERE id=?").get(oturumId) as Satir | undefined;
    if (!o || o.bitis) return;

    d.prepare("UPDATE ziyaretciOturum SET bitis=?, sayfaSureleri=? WHERE id=?")
      .run(simdi(), JSON.stringify(sayfaSureleri), oturumId);

    const z = ziyaretciGetir(o.ziyaretciId as string);
    if (!z || z.tamamlanma) return;

    if (ilerleme(z.egitimIdleri, bitenEgitimIdleri(z.id)).durum === "tamam") {
      d.prepare("UPDATE ziyaretci SET tamamlanma=? WHERE id=?").run(simdi(), z.id);
      tamamlandi = true;
    }
  })();

  return { tamamlandi };
}
