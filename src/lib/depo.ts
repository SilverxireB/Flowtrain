import "server-only";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { db, kimlik, simdi } from "./db";
import type { Egitim, Kural, Oturum, Sayfa, Soru } from "./tipler";
import { ASGARI_SURE_VARSAYILAN, SINAV_VARSAYILAN } from "./tipler";

/* ── satır ↔ nesne dönüşümleri ─────────────────────────────────────────────
   SQLite'ta boolean ve dizi yoktur; sınırda TEK yerde çevrilir. Çağıran taraf
   asla `karisik === 1` gibi bir şey görmez — o kaçak bir kez sızarsa her
   ekranda ayrı ayrı düzeltilir. */

type Satir = Record<string, unknown>;

function egitimden(r: Satir): Egitim {
  return {
    id: r.id as string,
    ad: r.ad as string,
    aciklama: (r.aciklama as string) ?? undefined,
    surum: r.surum as number,
    durum: r.durum as Egitim["durum"],
    hazirlayan: r.hazirlayan as string,
    onaylayan: (r.onaylayan as string) ?? undefined,
    gecmeNotu: r.gecmeNotu as number,
    denemeHakki: r.denemeHakki as number,
    soruSayisi: r.soruSayisi as number,
    karisik: !!r.karisik,
    tekrarAy: (r.tekrarAy as number) ?? undefined,
    olusturma: r.olusturma as string,
    guncelleme: r.guncelleme as string,
  };
}

function sorudan(r: Satir): Soru {
  return {
    id: r.id as string,
    egitimId: r.egitimId as string,
    tip: r.tip as Soru["tip"],
    metin: r.metin as string,
    secenekler: JSON.parse(r.secenekler as string),
    dogru: JSON.parse(r.dogru as string),
  };
}

function kuraldan(r: Satir): Kural {
  return {
    id: r.id as string,
    egitimId: r.egitimId as string,
    kosul: JSON.parse(r.kosul as string),
    sonTarih: (r.sonTarih as string) ?? undefined,
    aktif: !!r.aktif,
  };
}

function oturumdan(r: Satir): Oturum {
  return {
    id: r.id as string,
    egitimId: r.egitimId as string,
    egitimSurum: r.egitimSurum as number,
    sicil: r.sicil as string,
    gozeten: (r.gozeten as string) ?? undefined,
    cihaz: r.cihaz as string,
    baslangic: r.baslangic as string,
    bitis: (r.bitis as string) ?? undefined,
    sayfaSureleri: JSON.parse(r.sayfaSureleri as string),
    puan: (r.puan as number) ?? undefined,
    sonuc: (r.sonuc as Oturum["sonuc"]) ?? undefined,
    senkron: r.senkron as Oturum["senkron"],
  };
}

/* ── eğitim ───────────────────────────────────────────────────────────────── */

export function egitimleriListele(): Egitim[] {
  return db().prepare("SELECT * FROM egitim ORDER BY guncelleme DESC").all().map((r) => egitimden(r as Satir));
}

export function yayindakiEgitimler(): Egitim[] {
  return db().prepare("SELECT * FROM egitim WHERE durum='yayin' ORDER BY ad").all().map((r) => egitimden(r as Satir));
}

export function egitimGetir(id: string): Egitim | null {
  const r = db().prepare("SELECT * FROM egitim WHERE id=?").get(id) as Satir | undefined;
  return r ? egitimden(r) : null;
}

export function egitimOlustur(ad: string, hazirlayan: string): Egitim {
  const t = simdi();
  const e: Egitim = {
    id: kimlik("egt"),
    ad,
    surum: 1,
    durum: "taslak",
    hazirlayan,
    ...SINAV_VARSAYILAN,
    olusturma: t,
    guncelleme: t,
  };
  db()
    .prepare(
      `INSERT INTO egitim (id,ad,aciklama,surum,durum,hazirlayan,onaylayan,gecmeNotu,denemeHakki,soruSayisi,karisik,tekrarAy,olusturma,guncelleme)
       VALUES (@id,@ad,NULL,@surum,@durum,@hazirlayan,NULL,@gecmeNotu,@denemeHakki,@soruSayisi,@karisik,NULL,@olusturma,@guncelleme)`,
    )
    .run({ ...e, karisik: e.karisik ? 1 : 0 });
  return e;
}

const GUNCELLENEBILIR = [
  "ad",
  "aciklama",
  "gecmeNotu",
  "denemeHakki",
  "soruSayisi",
  "karisik",
  "tekrarAy",
  "durum",
  "onaylayan",
  "surum",
] as const;

export function egitimGuncelle(id: string, yama: Partial<Egitim>): void {
  const alanlar = GUNCELLENEBILIR.filter((a) => yama[a] !== undefined);
  if (alanlar.length === 0) return;
  const set = alanlar.map((a) => `${a}=@${a}`).join(", ");
  const deger: Satir = { id, guncelleme: simdi() };
  for (const a of alanlar) deger[a] = a === "karisik" ? (yama.karisik ? 1 : 0) : (yama[a] as unknown);
  db().prepare(`UPDATE egitim SET ${set}, guncelleme=@guncelleme WHERE id=@id`).run(deger);
}

export function egitimSil(id: string): void {
  db().prepare("DELETE FROM egitim WHERE id=?").run(id);
}

/**
 * Eğitimi kopyala — "yeni eğitim = boş sayfa değil, geçen yılın kopyası".
 * Sayfa ve sorular yeni kimliklerle çoğaltılır; kopya HER ZAMAN taslak doğar.
 */
export function egitimKopyala(id: string, hazirlayan: string): Egitim | null {
  const kaynak = egitimGetir(id);
  if (!kaynak) return null;
  const yeni = egitimOlustur(`${kaynak.ad} (kopya)`, hazirlayan);
  egitimGuncelle(yeni.id, {
    aciklama: kaynak.aciklama,
    gecmeNotu: kaynak.gecmeNotu,
    denemeHakki: kaynak.denemeHakki,
    soruSayisi: kaynak.soruSayisi,
    karisik: kaynak.karisik,
    tekrarAy: kaynak.tekrarAy,
  });
  for (const s of sayfalariGetir(id)) {
    sayfaEkle(yeni.id, { ...s, id: undefined as unknown as string });
  }
  for (const q of sorulariGetir(id)) {
    soruEkle(yeni.id, { tip: q.tip, metin: q.metin, secenekler: q.secenekler, dogru: q.dogru });
  }
  return egitimGetir(yeni.id);
}

/* ── sayfa ────────────────────────────────────────────────────────────────── */

export function sayfalariGetir(egitimId: string): Sayfa[] {
  return db()
    .prepare("SELECT * FROM sayfa WHERE egitimId=? ORDER BY sira")
    .all(egitimId)
    .map((r) => r as unknown as Sayfa);
}

export function sayfaEkle(egitimId: string, veri: Partial<Sayfa> & { tip: Sayfa["tip"] }): Sayfa {
  const enSon = db().prepare("SELECT MAX(sira) s FROM sayfa WHERE egitimId=?").get(egitimId) as { s: number | null };
  const sayfa: Sayfa = {
    id: kimlik("syf"),
    egitimId,
    sira: veri.sira ?? (enSon.s ?? 0) + 1,
    tip: veri.tip,
    baslik: veri.baslik ?? "",
    metin: veri.metin,
    metinKarsi: veri.metinKarsi,
    gorselId: veri.gorselId,
    videoId: veri.videoId,
    asgariSure: veri.asgariSure ?? ASGARI_SURE_VARSAYILAN[veri.tip],
  };
  db()
    .prepare(
      `INSERT INTO sayfa (id,egitimId,sira,tip,baslik,metin,metinKarsi,gorselId,videoId,asgariSure)
       VALUES (@id,@egitimId,@sira,@tip,@baslik,@metin,@metinKarsi,@gorselId,@videoId,@asgariSure)`,
    )
    .run({
      ...sayfa,
      metin: sayfa.metin ?? null,
      metinKarsi: sayfa.metinKarsi ?? null,
      gorselId: sayfa.gorselId ?? null,
      videoId: sayfa.videoId ?? null,
    });
  return sayfa;
}

export function sayfaGuncelle(id: string, yama: Partial<Sayfa>): void {
  const alanlar = (["sira", "tip", "baslik", "metin", "metinKarsi", "gorselId", "videoId", "asgariSure"] as const).filter(
    (a) => yama[a] !== undefined,
  );
  if (alanlar.length === 0) return;
  const set = alanlar.map((a) => `${a}=@${a}`).join(", ");
  const deger: Satir = { id };
  for (const a of alanlar) deger[a] = yama[a] ?? null;
  db().prepare(`UPDATE sayfa SET ${set} WHERE id=@id`).run(deger);
}

export function sayfaSil(id: string): void {
  db().prepare("DELETE FROM sayfa WHERE id=?").run(id);
}

/** Sıralama tek yazımda gönderilir — yarım kalan sıralama listeyi bozar. */
export function sayfalariSirala(egitimId: string, sirali: string[]): void {
  const g = db().prepare("UPDATE sayfa SET sira=? WHERE id=? AND egitimId=?");
  db().transaction(() => sirali.forEach((id, i) => g.run(i + 1, id, egitimId)))();
}

/* ── soru ─────────────────────────────────────────────────────────────────── */

export function sorulariGetir(egitimId: string): Soru[] {
  return db().prepare("SELECT * FROM soru WHERE egitimId=?").all(egitimId).map((r) => sorudan(r as Satir));
}

export function soruEkle(egitimId: string, veri: Omit<Soru, "id" | "egitimId">): Soru {
  const soru: Soru = { id: kimlik("sor"), egitimId, ...veri };
  db()
    .prepare("INSERT INTO soru (id,egitimId,tip,metin,secenekler,dogru) VALUES (?,?,?,?,?,?)")
    .run(soru.id, egitimId, soru.tip, soru.metin, JSON.stringify(soru.secenekler), JSON.stringify(soru.dogru));
  return soru;
}

export function soruGuncelle(id: string, yama: Partial<Soru>): void {
  const mevcut = db().prepare("SELECT * FROM soru WHERE id=?").get(id) as Satir | undefined;
  if (!mevcut) return;
  const s = { ...sorudan(mevcut), ...yama };
  db()
    .prepare("UPDATE soru SET tip=?, metin=?, secenekler=?, dogru=? WHERE id=?")
    .run(s.tip, s.metin, JSON.stringify(s.secenekler), JSON.stringify(s.dogru), id);
}

export function soruSil(id: string): void {
  db().prepare("DELETE FROM soru WHERE id=?").run(id);
}

export function soruIstatistikleri(egitimId: string): { soruId: string; deneme: number; yanlis: number }[] {
  return db()
    .prepare(
      `SELECT i.soruId soruId, i.deneme deneme, i.yanlis yanlis
       FROM soruIstatistik i JOIN soru s ON s.id = i.soruId WHERE s.egitimId=?`,
    )
    .all(egitimId) as { soruId: string; deneme: number; yanlis: number }[];
}

/* ── kural ────────────────────────────────────────────────────────────────── */

export function kurallariGetir(egitimId?: string): Kural[] {
  const sorgu = egitimId ? "SELECT * FROM kural WHERE egitimId=?" : "SELECT * FROM kural";
  const satirlar = egitimId ? db().prepare(sorgu).all(egitimId) : db().prepare(sorgu).all();
  return satirlar.map((r) => kuraldan(r as Satir));
}

export function kuralEkle(veri: Omit<Kural, "id">): Kural {
  const k: Kural = { id: kimlik("krl"), ...veri };
  db()
    .prepare("INSERT INTO kural (id,egitimId,kosul,sonTarih,aktif) VALUES (?,?,?,?,?)")
    .run(k.id, k.egitimId, JSON.stringify(k.kosul), k.sonTarih ?? null, k.aktif ? 1 : 0);
  return k;
}

export function kuralGuncelle(id: string, yama: Partial<Kural>): void {
  const mevcut = db().prepare("SELECT * FROM kural WHERE id=?").get(id) as Satir | undefined;
  if (!mevcut) return;
  const k = { ...kuraldan(mevcut), ...yama };
  db()
    .prepare("UPDATE kural SET kosul=?, sonTarih=?, aktif=? WHERE id=?")
    .run(JSON.stringify(k.kosul), k.sonTarih ?? null, k.aktif ? 1 : 0, id);
}

export function kuralSil(id: string): void {
  db().prepare("DELETE FROM kural WHERE id=?").run(id);
}

/* ── oturum ───────────────────────────────────────────────────────────────── */

export function oturumlariGetir(filtre?: { sicil?: string; egitimId?: string }): Oturum[] {
  const kosul: string[] = [];
  const deger: unknown[] = [];
  if (filtre?.sicil) {
    kosul.push("sicil=?");
    deger.push(filtre.sicil);
  }
  if (filtre?.egitimId) {
    kosul.push("egitimId=?");
    deger.push(filtre.egitimId);
  }
  const nerede = kosul.length ? `WHERE ${kosul.join(" AND ")}` : "";
  return db()
    .prepare(`SELECT * FROM oturum ${nerede} ORDER BY baslangic DESC`)
    .all(...deger)
    .map((r) => oturumdan(r as Satir));
}

export function oturumGetir(id: string): Oturum | null {
  const r = db().prepare("SELECT * FROM oturum WHERE id=?").get(id) as Satir | undefined;
  return r ? oturumdan(r) : null;
}

export function oturumBaslat(veri: {
  egitimId: string;
  egitimSurum: number;
  sicil: string;
  gozeten?: string;
  cihaz: string;
}): Oturum {
  const o: Oturum = {
    id: kimlik("otr"),
    ...veri,
    baslangic: simdi(),
    sayfaSureleri: {},
    senkron: "bekliyor",
  };
  db()
    .prepare(
      `INSERT INTO oturum (id,egitimId,egitimSurum,sicil,gozeten,cihaz,baslangic,sayfaSureleri,senkron)
       VALUES (?,?,?,?,?,?,?,?,?)`,
    )
    .run(o.id, o.egitimId, o.egitimSurum, o.sicil, o.gozeten ?? null, o.cihaz, o.baslangic, "{}", "bekliyor");
  return o;
}

export function oturumBitir(
  id: string,
  veri: { sayfaSureleri: Record<string, number>; puan: number; sonuc: "gecti" | "kaldi"; yanlisSoruIdleri: string[]; sorulanSoruIdleri: string[] },
): void {
  const d = db();
  d.transaction(() => {
    d.prepare("UPDATE oturum SET bitis=?, sayfaSureleri=?, puan=?, sonuc=? WHERE id=?").run(
      simdi(),
      JSON.stringify(veri.sayfaSureleri),
      veri.puan,
      veri.sonuc,
      id,
    );
    // İçerik kalite sinyali: hangi soru kaç kez soruldu, kaç kez yanlış yapıldı.
    const artir = d.prepare(
      `INSERT INTO soruIstatistik (soruId,deneme,yanlis) VALUES (?,1,?)
       ON CONFLICT(soruId) DO UPDATE SET deneme=deneme+1, yanlis=yanlis+excluded.yanlis`,
    );
    for (const sid of veri.sorulanSoruIdleri) artir.run(sid, veri.yanlisSoruIdleri.includes(sid) ? 1 : 0);
  })();
}

export function senkronIsaretle(id: string, durum: Oturum["senkron"]): void {
  db().prepare("UPDATE oturum SET senkron=? WHERE id=?").run(durum, id);
}

export function bekleyenSenkronlar(): Oturum[] {
  return db()
    .prepare("SELECT * FROM oturum WHERE bitis IS NOT NULL AND senkron<>'gonderildi' ORDER BY bitis")
    .all()
    .map((r) => oturumdan(r as Satir));
}

/* ── PIN (işçi imzası) ────────────────────────────────────────────────────── */

function ozetle(deger: string, tuz: string): string {
  return scryptSync(deger, tuz, 32).toString("hex");
}

/**
 * PIN'i düz metin TUTMA. Dört haneli bir sırrın kaba kuvvete dayanması zaten
 * mümkün değil — burada amaç sızıntıda listeyi olduğu gibi vermemek ve aynı
 * PIN'i kullanan iki kişinin özetinin eşleşmemesi (kişiye özel tuz).
 */
export function pinKur(sicil: string, pin: string): void {
  const tuz = randomBytes(16).toString("hex");
  db()
    .prepare("INSERT INTO pin (sicil,ozet,tuz,olusturma) VALUES (?,?,?,?) ON CONFLICT(sicil) DO UPDATE SET ozet=excluded.ozet, tuz=excluded.tuz")
    .run(sicil, ozetle(pin, tuz), tuz, simdi());
}

export function pinVarMi(sicil: string): boolean {
  return !!db().prepare("SELECT 1 FROM pin WHERE sicil=?").get(sicil);
}

export function pinDogrula(sicil: string, pin: string): boolean {
  const r = db().prepare("SELECT ozet,tuz FROM pin WHERE sicil=?").get(sicil) as { ozet: string; tuz: string } | undefined;
  if (!r) return false;
  const a = Buffer.from(r.ozet, "hex");
  const b = Buffer.from(ozetle(pin, r.tuz), "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/* ── hesap (kokpit kullanıcıları) ─────────────────────────────────────────── */

export type Rol = "yonetici" | "hazirlayan" | "onaylayan" | "amir";

export interface Hesap {
  kullanici: string;
  ad: string;
  rol: Rol;
  /** Amir hesabı bir personel siciliyle eşleşir — ekip listesi ondan çıkar. */
  sicil?: string;
}

export function hesaplariListele(): Hesap[] {
  return db().prepare("SELECT kullanici,ad,rol,sicil FROM hesap ORDER BY ad").all() as Hesap[];
}

export function hesapOlustur(h: Hesap & { sifre: string }): void {
  const tuz = randomBytes(16).toString("hex");
  db()
    .prepare("INSERT INTO hesap (kullanici,ad,rol,ozet,tuz,sicil,olusturma) VALUES (?,?,?,?,?,?,?)")
    .run(h.kullanici, h.ad, h.rol, ozetle(h.sifre, tuz), tuz, h.sicil ?? null, simdi());
}

export function hesapDogrula(kullanici: string, sifre: string): Hesap | null {
  const r = db().prepare("SELECT * FROM hesap WHERE kullanici=?").get(kullanici) as
    | (Hesap & { ozet: string; tuz: string })
    | undefined;
  if (!r) return null;
  const a = Buffer.from(r.ozet, "hex");
  const b = Buffer.from(ozetle(sifre, r.tuz), "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return { kullanici: r.kullanici, ad: r.ad, rol: r.rol, sicil: r.sicil ?? undefined };
}

export function hesapSil(kullanici: string): void {
  db().prepare("DELETE FROM hesap WHERE kullanici=?").run(kullanici);
}

export function hesapSayisi(): number {
  return (db().prepare("SELECT COUNT(*) n FROM hesap").get() as { n: number }).n;
}

/* ── denetim izi ──────────────────────────────────────────────────────────── */

export function izBirak(kim: string, ne: string): void {
  db().prepare("INSERT INTO iz (id,kim,ne,neZaman) VALUES (?,?,?,?)").run(kimlik("iz"), kim, ne, simdi());
}

export function izleriGetir(limit = 200): { id: string; kim: string; ne: string; neZaman: string }[] {
  return db().prepare("SELECT * FROM iz ORDER BY neZaman DESC LIMIT ?").all(limit) as {
    id: string;
    kim: string;
    ne: string;
    neZaman: string;
  }[];
}

/* ── ayar ─────────────────────────────────────────────────────────────────── */

export function ayarOku(anahtar: string, varsayilan = ""): string {
  const r = db().prepare("SELECT deger FROM ayar WHERE anahtar=?").get(anahtar) as { deger: string } | undefined;
  return r?.deger ?? varsayilan;
}

export function ayarYaz(anahtar: string, deger: string): void {
  db()
    .prepare("INSERT INTO ayar (anahtar,deger) VALUES (?,?) ON CONFLICT(anahtar) DO UPDATE SET deger=excluded.deger")
    .run(anahtar, deger);
}
