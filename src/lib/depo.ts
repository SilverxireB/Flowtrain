import "server-only";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { db, kimlik, simdi } from "./db";
import * as pinIslem from "./pin";
import type { Egitim, Grup, Kural, Medya, Oturum, Sayfa, Soru } from "./tipler";
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
    kategori: (r.kategori as string) ?? "",
    zorunlu: !!r.zorunlu,
    sureDk: (r.sureDk as number) ?? undefined,
    egitmen: (r.egitmen as string) ?? undefined,
    olusturma: r.olusturma as string,
    guncelleme: r.guncelleme as string,
  };
}

function sayfadan(r: Satir): Sayfa {
  return {
    id: r.id as string,
    egitimId: r.egitimId as string,
    sira: r.sira as number,
    tip: r.tip as Sayfa["tip"],
    baslik: r.baslik as string,
    metin: (r.metin as string) ?? undefined,
    metinKarsi: (r.metinKarsi as string) ?? undefined,
    gorselId: (r.gorselId as string) ?? undefined,
    gorselIdler: JSON.parse((r.gorselIdler as string) ?? "[]"),
    videoId: (r.videoId as string) ?? undefined,
    asgariSure: r.asgariSure as number,
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
    gorselId: (r.gorselId as string) ?? undefined,
    aciklama: (r.aciklama as string) ?? undefined,
  };
}

function kuraldan(r: Satir): Kural {
  return {
    id: r.id as string,
    // Paket kuralında NULL — tip boyunca boş dizeye düşürülür ki her çağıran
    // ayrı ayrı null denetimi yazmasın; `if (k.egitimId)` ikisini de kapsar.
    egitimId: (r.egitimId as string) ?? "",
    grupId: (r.grupId as string) ?? undefined,
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
    sorulanSoruIdleri: JSON.parse((r.sorulanSoruIdleri as string) ?? "[]"),
    puan: (r.puan as number) ?? undefined,
    sonuc: (r.sonuc as Oturum["sonuc"]) ?? undefined,
    senkron: r.senkron as Oturum["senkron"],
    kaynak: ((r.kaynak as Oturum["kaynak"]) ?? "kiosk") as Oturum["kaynak"],
    egitmen: (r.egitmen as string) ?? undefined,
    notlar: (r.notlar as string) ?? undefined,
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
    kategori: "",
    zorunlu: false,
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
  "kategori",
  "zorunlu",
  "sureDk",
  "egitmen",
  "durum",
  "onaylayan",
  "surum",
] as const;

/** SQLite'ta boolean yok; sınırda çevrilecek alanlar tek listede. */
const MANTIKSAL = new Set(["karisik", "zorunlu"]);

export function egitimGuncelle(id: string, yama: Partial<Egitim>): void {
  const alanlar = GUNCELLENEBILIR.filter((a) => yama[a] !== undefined);
  if (alanlar.length === 0) return;
  const set = alanlar.map((a) => `${a}=@${a}`).join(", ");
  const deger: Satir = { id, guncelleme: simdi() };
  for (const a of alanlar) {
    deger[a] = MANTIKSAL.has(a) ? (yama[a] ? 1 : 0) : ((yama[a] as unknown) ?? null);
  }
  db().prepare(`UPDATE egitim SET ${set}, guncelleme=@guncelleme WHERE id=@id`).run(deger);
}

/** Katalog süzgeci için kullanılan kategoriler (boşlar elenir). */
export function kategorileriGetir(): string[] {
  return (db().prepare("SELECT DISTINCT kategori k FROM egitim WHERE kategori<>'' ORDER BY k").all() as { k: string }[])
    .map((r) => r.k);
}

export function egitimSil(id: string): void {
  db().prepare("DELETE FROM egitim WHERE id=?").run(id);
}

/**
 * Eğitimi kopyala — "yeni eğitim = boş sayfa değil, geçen yılın kopyası".
 * Sayfa ve sorular yeni kimliklerle çoğaltılır; kopya HER ZAMAN taslak doğar.
 */
export function egitimKopyala(id: string, hazirlayan: string): Egitim | null;

export function egitimKopyala(
  id: string,
  hazirlayan: string,
  esleme: Map<string, string>,
): Egitim | null;
/**
 * Eğitimi kopyala — "yeni eğitim = boş sayfa değil, geçen yılın kopyası".
 *
 * İsteğe bağlı `esleme` haritası ESKİ sayfa kimliğinden yenisine yazılır.
 * Çağıran, sayfa kimliğine bağlı yan verilerini (editördeki bölüm başlıkları
 * gibi) kopyayla taşıyabilsin diye: o veriler `Sayfa` içinde durmadığı için
 * burada kendiliğinden gelmiyorlar, ve haritayı dışarı vermeden taşımanın
 * yolu yok — kopyanın sayfaları yeni kimlikler alıyor.
 */
export function egitimKopyala(id: string, hazirlayan: string, esleme?: Map<string, string>): Egitim | null {
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
    kategori: kaynak.kategori,
    zorunlu: kaynak.zorunlu,
    sureDk: kaynak.sureDk,
    egitmen: kaynak.egitmen,
  });
  for (const s of sayfalariGetir(id)) {
    const eklenen = sayfaEkle(yeni.id, { ...s, id: undefined as unknown as string });
    esleme?.set(s.id, eklenen.id);
  }
  for (const q of sorulariGetir(id)) {
    soruEkle(yeni.id, {
      tip: q.tip,
      metin: q.metin,
      secenekler: q.secenekler,
      dogru: q.dogru,
      gorselId: q.gorselId,
      aciklama: q.aciklama,
    });
  }
  return egitimGetir(yeni.id);
}

/* ── sayfa ────────────────────────────────────────────────────────────────── */

export function sayfalariGetir(egitimId: string): Sayfa[] {
  return db()
    .prepare("SELECT * FROM sayfa WHERE egitimId=? ORDER BY sira")
    .all(egitimId)
    .map((r) => sayfadan(r as Satir));
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
    gorselIdler: veri.gorselIdler ?? [],
    videoId: veri.videoId,
    asgariSure: veri.asgariSure ?? ASGARI_SURE_VARSAYILAN[veri.tip],
  };
  db()
    .prepare(
      `INSERT INTO sayfa (id,egitimId,sira,tip,baslik,metin,metinKarsi,gorselId,gorselIdler,videoId,asgariSure)
       VALUES (@id,@egitimId,@sira,@tip,@baslik,@metin,@metinKarsi,@gorselId,@gorselIdler,@videoId,@asgariSure)`,
    )
    .run({
      ...sayfa,
      metin: sayfa.metin ?? null,
      metinKarsi: sayfa.metinKarsi ?? null,
      gorselId: sayfa.gorselId ?? null,
      gorselIdler: JSON.stringify(sayfa.gorselIdler),
      videoId: sayfa.videoId ?? null,
    });
  return sayfa;
}

export function sayfaGuncelle(id: string, yama: Partial<Sayfa>): void {
  const alanlar = (
    ["sira", "tip", "baslik", "metin", "metinKarsi", "gorselId", "gorselIdler", "videoId", "asgariSure"] as const
  ).filter((a) => yama[a] !== undefined);
  if (alanlar.length === 0) return;
  const set = alanlar.map((a) => `${a}=@${a}`).join(", ");
  const deger: Satir = { id };
  for (const a of alanlar) {
    deger[a] = a === "gorselIdler" ? JSON.stringify(yama.gorselIdler ?? []) : (yama[a] ?? null);
  }
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

/** Sıra GARANTİ ALTINDA: `ORDER BY` olmadan karıştırmasız sınav SQLite'ın
    keyfine kalıyordu. */
export function sorulariGetir(egitimId: string): Soru[] {
  return db().prepare("SELECT * FROM soru WHERE egitimId=? ORDER BY id").all(egitimId).map((r) => sorudan(r as Satir));
}

/** Belirli kimliklerdeki sorular — oturumun sabitlenmiş setini geri okumak için. */
export function sorulariKimlikle(idler: string[]): Soru[] {
  if (idler.length === 0) return [];
  const yer = idler.map(() => "?").join(",");
  const bulunan = db()
    .prepare(`SELECT * FROM soru WHERE id IN (${yer})`)
    .all(...idler)
    .map((r) => sorudan(r as Satir));
  // Sıra oturumdaki sırayla aynı olmalı; `IN` sırayı korumaz.
  const karta = new Map(bulunan.map((s) => [s.id, s]));
  return idler.map((id) => karta.get(id)).filter((s): s is Soru => !!s);
}

export function soruEkle(egitimId: string, veri: Omit<Soru, "id" | "egitimId">): Soru {
  const soru: Soru = { id: kimlik("sor"), egitimId, ...veri };
  db()
    .prepare("INSERT INTO soru (id,egitimId,tip,metin,secenekler,dogru,gorselId,aciklama) VALUES (?,?,?,?,?,?,?,?)")
    .run(
      soru.id,
      egitimId,
      soru.tip,
      soru.metin,
      JSON.stringify(soru.secenekler),
      JSON.stringify(soru.dogru),
      soru.gorselId ?? null,
      soru.aciklama ?? null,
    );
  return soru;
}

export function soruGuncelle(id: string, yama: Partial<Soru>): void {
  const mevcut = db().prepare("SELECT * FROM soru WHERE id=?").get(id) as Satir | undefined;
  if (!mevcut) return;
  const s = { ...sorudan(mevcut), ...yama };
  db()
    .prepare("UPDATE soru SET tip=?, metin=?, secenekler=?, dogru=?, gorselId=?, aciklama=? WHERE id=?")
    .run(
      s.tip,
      s.metin,
      JSON.stringify(s.secenekler),
      JSON.stringify(s.dogru),
      s.gorselId ?? null,
      s.aciklama ?? null,
      id,
    );
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
    .prepare("INSERT INTO kural (id,egitimId,grupId,kosul,sonTarih,aktif) VALUES (?,?,?,?,?,?)")
    .run(k.id, k.egitimId || null, k.grupId ?? null, JSON.stringify(k.kosul), k.sonTarih ?? null, k.aktif ? 1 : 0);
  return k;
}

export function kuralGuncelle(id: string, yama: Partial<Kural>): void {
  const mevcut = db().prepare("SELECT * FROM kural WHERE id=?").get(id) as Satir | undefined;
  if (!mevcut) return;
  const k = { ...kuraldan(mevcut), ...yama };
  db()
    .prepare("UPDATE kural SET egitimId=?, grupId=?, kosul=?, sonTarih=?, aktif=? WHERE id=?")
    .run(k.egitimId || null, k.grupId ?? null, JSON.stringify(k.kosul), k.sonTarih ?? null, k.aktif ? 1 : 0, id);
}

/**
 * Kural motoru YALNIZ eğitim bilir; paket kuralı burada üyelerine AÇILIR.
 *
 * Açma depoda yapılır çünkü paket üyeliği veridir; `kurallar.ts` saf mantık
 * olarak kalmalı ve veritabanına bakmamalı. Paket boşsa kural hiçbir şey
 * atamaz — "boş koşul herkesi kapsar" kuralıyla karıştırılmasın diye
 * üyesiz paket kuralı ELENİR, yoksa boş bir paket tüm fabrikaya boş atama
 * üretirdi.
 */
export function kurallariCozulmus(): Kural[] {
  const gruplar = new Map(gruplariGetir().map((g) => [g.id, g.egitimIdleri]));
  const cikti: Kural[] = [];
  for (const k of kurallariGetir()) {
    if (!k.grupId) {
      if (k.egitimId) cikti.push(k);
      continue;
    }
    for (const egitimId of gruplar.get(k.grupId) ?? []) {
      cikti.push({ ...k, egitimId });
    }
  }
  return cikti;
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
  sorulanSoruIdleri: string[];
  kaynak?: Oturum["kaynak"];
}): Oturum {
  const o: Oturum = {
    id: kimlik("otr"),
    kaynak: veri.gozeten ? "amir" : "kiosk",
    ...veri,
    baslangic: simdi(),
    sayfaSureleri: {},
    senkron: "bekliyor",
  };
  db()
    .prepare(
      `INSERT INTO oturum (id,egitimId,egitimSurum,sicil,gozeten,cihaz,baslangic,sayfaSureleri,sorulanSoruIdleri,senkron,kaynak)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    )
    .run(
      o.id,
      o.egitimId,
      o.egitimSurum,
      o.sicil,
      o.gozeten ?? null,
      o.cihaz,
      o.baslangic,
      "{}",
      JSON.stringify(o.sorulanSoruIdleri),
      "bekliyor",
      o.kaynak,
    );
  return o;
}

/**
 * SINIF EĞİTİMİ / DIŞ AKTARIM KAYDI — ekranda kart dönmeden yazılan tamamlama.
 *
 * Neden var: her eğitim kioskta verilmez. Eğitmen otuz kişiye sınıfta anlatır;
 * kayıt yine de aynı defterde durmalı, yoksa panonun "tamamlanma" sayısı
 * gerçeği göstermez. `kaynak` alanı bu kaydın ekranda dönmediğini AÇIKÇA
 * söyler — denetimde kiosk kaydıyla karıştırılmaz.
 */
export function oturumKaydet(veri: {
  egitimId: string;
  egitimSurum: number;
  sicil: string;
  kaynak: Oturum["kaynak"];
  bitis: string;
  gozeten?: string;
  egitmen?: string;
  notlar?: string;
  puan?: number;
}): Oturum {
  const o: Oturum = {
    id: kimlik("otr"),
    egitimId: veri.egitimId,
    egitimSurum: veri.egitimSurum,
    sicil: veri.sicil,
    gozeten: veri.gozeten,
    cihaz: veri.kaynak,
    baslangic: veri.bitis,
    bitis: veri.bitis,
    sayfaSureleri: {},
    sorulanSoruIdleri: [],
    puan: veri.puan,
    sonuc: "gecti",
    senkron: "bekliyor",
    kaynak: veri.kaynak,
    egitmen: veri.egitmen,
    notlar: veri.notlar,
  };
  db()
    .prepare(
      `INSERT INTO oturum (id,egitimId,egitimSurum,sicil,gozeten,cihaz,baslangic,bitis,sayfaSureleri,sorulanSoruIdleri,puan,sonuc,senkron,kaynak,egitmen,notlar)
       VALUES (?,?,?,?,?,?,?,?,'{}','[]',?,'gecti','bekliyor',?,?,?)`,
    )
    .run(
      o.id,
      o.egitimId,
      o.egitimSurum,
      o.sicil,
      o.gozeten ?? null,
      o.cihaz,
      o.baslangic,
      o.bitis,
      o.puan ?? null,
      o.kaynak,
      o.egitmen ?? null,
      o.notlar ?? null,
    );
  return o;
}

/**
 * Yarıda bırakılmış eski oturumları kapatır.
 * Kiosk kimlik istemediği için biri başkasının sicilini yazıp "Başla"ya
 * deneme hakkı kadar basarsa o kişiyi eğitimden KALICI olarak kilitleyebilirdi;
 * kazara yarıda bırakan işçi de her seferinde bir hak yakıyordu.
 */
export function eskiOturumlariKapat(sicil: string, egitimId: string, saat = 2): number {
  const sinir = new Date(Date.now() - saat * 3_600_000).toISOString();
  /* SEBEP YAZILIYOR: defterde "iptal" satırının neden iptal olduğu
     görünmezse denetçi ağ kopmasıyla vazgeçmeyi ayırt edemez ve her iptal
     şüpheli görünür. */
  const r = db()
    .prepare(
      "UPDATE oturum SET bitis=?, sonuc='iptal', senkron='gonderildi', " +
        "notlar=COALESCE(notlar, ?) WHERE sicil=? AND egitimId=? AND bitis IS NULL AND baslangic < ?",
    )
    .run(simdi(), `${saat} saat içinde tamamlanmadı, kendiliğinden kapatıldı`, sicil, egitimId, sinir);
  return r.changes;
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

/**
 * Oturumu geçme/kalma üretmeden kapatır.
 * PIN kilidi gibi durumlarda çağrılır: kapanmayan oturum, aynı kimliğin
 * sınırsız kez yeniden denenmesine izin verirdi.
 */
export function oturumIptal(id: string, sebep: string): void {
  db()
    .prepare("UPDATE oturum SET bitis=?, sonuc='iptal', senkron='gonderildi' WHERE id=? AND bitis IS NULL")
    .run(simdi(), id);
  izBirak("kiosk", `oturum iptal (${sebep}): ${id}`);
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

/* ── PIN (işçi imzası) ─────────────────────────────────────────────────────
   Mantık `pin.ts`te ve SINAVLI: bu dosya `server-only` taşıdığı için buradaki
   kod sınav yazılamayan bir yerdi. Aşağısı yalnız veritabanını bağlar. */

export { PIN_DENEME_SINIRI, PIN_KILIT_DK, type PinSonucu } from "./pin";

/** Hesap şifreleri de aynı reçeteyle özetlenir (kişiye özel tuz + scrypt). */
function ozetle(deger: string, tuz: string): string {
  return scryptSync(deger, tuz, 32).toString("hex");
}

export function pinKur(sicil: string, pin: string): void {
  pinIslem.pinKur(db(), sicil, pin, simdi());
}

export function pinVarMi(sicil: string): boolean {
  return pinIslem.pinVarMi(db(), sicil);
}

export function pinDogrula(sicil: string, pin: string): pinIslem.PinSonucu {
  return pinIslem.pinDogrula(db(), sicil, pin, simdi());
}

export function pinSifirla(sicil: string): void {
  pinIslem.pinSifirla(db(), sicil);
}

export function pinDurumlari(): { sicil: string; olusturma: string; kilitli: boolean }[] {
  return pinIslem.pinDurumlari(db(), simdi());
}

/* ── hesap (kokpit kullanıcıları) ───────────────────────────────────────── */

export type { Rol, Hesap } from "./yetki";

export function hesaplariListele(): import("./yetki").Hesap[] {
  return db().prepare("SELECT kullanici,ad,rol,sicil FROM hesap ORDER BY ad").all() as import("./yetki").Hesap[];
}

export function hesapOlustur(h: import("./yetki").Hesap & { sifre: string }): void {
  const tuz = randomBytes(16).toString("hex");
  db()
    .prepare("INSERT INTO hesap (kullanici,ad,rol,ozet,tuz,sicil,olusturma) VALUES (?,?,?,?,?,?,?)")
    .run(h.kullanici, h.ad, h.rol, ozetle(h.sifre, tuz), tuz, h.sicil ?? null, simdi());
}

export function hesapDogrula(kullanici: string, sifre: string): import("./yetki").Hesap | null {
  const r = db().prepare("SELECT * FROM hesap WHERE kullanici=?").get(kullanici) as
    | (import("./yetki").Hesap & { ozet: string; tuz: string })
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

/* ── eğitim paketi (grup) ─────────────────────────────────────────────────── */

export function gruplariGetir(): Grup[] {
  const gruplar = db().prepare("SELECT * FROM grup ORDER BY ad").all() as Satir[];
  const uyeler = db().prepare("SELECT grupId, egitimId FROM grupUye ORDER BY sira").all() as {
    grupId: string;
    egitimId: string;
  }[];
  return gruplar.map((g) => ({
    id: g.id as string,
    ad: g.ad as string,
    aciklama: (g.aciklama as string) ?? undefined,
    olusturma: g.olusturma as string,
    egitimIdleri: uyeler.filter((u) => u.grupId === g.id).map((u) => u.egitimId),
  }));
}

export function grupGetir(id: string): Grup | null {
  return gruplariGetir().find((g) => g.id === id) ?? null;
}

export function grupOlustur(ad: string, aciklama?: string): Grup {
  const g: Grup = { id: kimlik("grp"), ad, aciklama, olusturma: simdi(), egitimIdleri: [] };
  db()
    .prepare("INSERT INTO grup (id,ad,aciklama,olusturma) VALUES (?,?,?,?)")
    .run(g.id, g.ad, g.aciklama ?? null, g.olusturma);
  return g;
}

export function grupGuncelle(id: string, yama: { ad?: string; aciklama?: string }): void {
  const mevcut = grupGetir(id);
  if (!mevcut) return;
  db()
    .prepare("UPDATE grup SET ad=?, aciklama=? WHERE id=?")
    .run(yama.ad ?? mevcut.ad, yama.aciklama ?? mevcut.aciklama ?? null, id);
}

export function grupSil(id: string): void {
  db().prepare("DELETE FROM grup WHERE id=?").run(id);
}

/** Üyeler TEK yazımda değişir — yarım kalan liste paketi bozar. */
export function grupUyeleriYaz(grupId: string, egitimIdleri: string[]): void {
  const sil = db().prepare("DELETE FROM grupUye WHERE grupId=?");
  const ekle = db().prepare("INSERT INTO grupUye (grupId,egitimId,sira) VALUES (?,?,?)");
  db().transaction(() => {
    sil.run(grupId);
    egitimIdleri.forEach((egitimId, i) => ekle.run(grupId, egitimId, i));
  })();
}

/* ── medya kütüphanesi ────────────────────────────────────────────────────── */

/**
 * Medya kayıtları.
 *
 * VARSAYILAN KÜTÜPHANE GÖRÜNÜMÜ: içe aktarılan sayfa görselleri (`kutuphaneDisi`)
 * elenir — kırk sayfalık bir sunum seçiciyi kullanılamaz hâle getirirdi.
 * `hepsi: true` bakım işleri içindir (öksüz taraması gibi): orada tam liste
 * gerekir, yoksa temizlik göremediği dosyayı hiç silmez.
 */
export function medyalariGetir(hepsi = false): Medya[] {
  // Ham satır DÖNDÜRÜLMÜYOR: SQLite boş alanı `null`, mantıksalı 0/1 verir;
  // tip ise `altMetin?: string` ve `kutuphaneDisi: boolean` diyor. Dönüşüm
  // sınırda yapılmazsa `null` ekranlara sızar ve `?? varsayilan` kontrolleri
  // sessizce yanlış çalışır.
  const sorgu = hepsi
    ? "SELECT * FROM medya ORDER BY olusturma DESC"
    : "SELECT * FROM medya WHERE kutuphaneDisi=0 ORDER BY olusturma DESC";
  return db()
    .prepare(sorgu)
    .all()
    .map((satir) => {
      const r = satir as Satir;
      return {
        id: r.id as string,
        ad: r.ad as string,
        tip: r.tip as string,
        boyut: r.boyut as number,
        yukleyen: r.yukleyen as string,
        olusturma: r.olusturma as string,
        altMetin: (r.altMetin as string) ?? undefined,
        kutuphaneDisi: !!r.kutuphaneDisi,
      };
    });
}

export function medyaKaydet(m: Omit<Medya, "olusturma" | "kutuphaneDisi"> & { kutuphaneDisi?: boolean }): void {
  db()
    .prepare(
      "INSERT INTO medya (id,ad,tip,boyut,yukleyen,olusturma,altMetin,kutuphaneDisi) VALUES (?,?,?,?,?,?,?,?) " +
        "ON CONFLICT(id) DO UPDATE SET ad=excluded.ad",
    )
    .run(m.id, m.ad, m.tip, m.boyut, m.yukleyen, simdi(), m.altMetin ?? null, m.kutuphaneDisi ? 1 : 0);
}

/**
 * Alt metni AYRI yazılır: `medyaKaydet` yükleme anında çağrılıyor ve o an
 * kimse görselin ne gösterdiğini yazmış olmaz. Çakışma çözümünde alt metni
 * korunuyor — yeniden yükleme yazılmış açıklamayı silmemeli.
 */
export function medyaAltMetinYaz(id: string, altMetin: string): void {
  db().prepare("UPDATE medya SET altMetin=? WHERE id=?").run(altMetin.trim() || null, id);
}

export function medyaSil(id: string): void {
  db().prepare("DELETE FROM medya WHERE id=?").run(id);
}

/** Bir görselin kaç kartta/soruda kullanıldığı — silmeden önce sorulur. */
export function medyaKullanimi(id: string): number {
  const s = db()
    .prepare("SELECT COUNT(*) n FROM sayfa WHERE gorselId=? OR videoId=? OR gorselIdler LIKE ?")
    .get(id, id, `%"${id}"%`) as { n: number };
  const q = db().prepare("SELECT COUNT(*) n FROM soru WHERE gorselId=?").get(id) as { n: number };
  return s.n + q.n;
}

/**
 * Tüm medyaların kullanım sayısı — TEK sorguda.
 *
 * Kütüphane ekranı her görsel için ayrı `medyaKullanimi` çağırıyordu; birkaç
 * yüz görselde sorun değil ama kütüphane bir kez binleri görünce ekran açılışı
 * bini aşkın sorguya bağlanır. Referanslar bellekte sayılıyor: kaynak üç
 * sütunda (tekil görsel, video, JSON dizi) dağınık, SQL ile toplamak
 * okunmaz bir sorgu üretirdi.
 */
export function medyaKullanimlariGetir(): Record<string, number> {
  const sayac: Record<string, number> = {};
  const say = (id: unknown) => {
    if (typeof id === "string" && id) sayac[id] = (sayac[id] ?? 0) + 1;
  };

  for (const r of db().prepare("SELECT gorselId, videoId, gorselIdler FROM sayfa").all() as Satir[]) {
    say(r.gorselId);
    say(r.videoId);
    // gorselIdler'in ilki gorselId ile AYNI kayıttır (editör ikisini birlikte
    // yazıyor); iki kez saymamak için tekil alanla eşleşen atlanır.
    for (const g of JSON.parse((r.gorselIdler as string) ?? "[]") as string[]) {
      if (g !== r.gorselId) say(g);
    }
  }
  for (const r of db().prepare("SELECT gorselId FROM soru").all() as Satir[]) say(r.gorselId);
  return sayac;
}

/**
 * Hiçbir kartta/soruda geçmeyen medya kimlikleri.
 *
 * Kart silinince `data/medya/` altındaki dosya diskte kalıyor ve kütüphanede
 * kullanımı sıfır görünen bir kayda dönüşüyor. Silmeyi çekirdek YAPMAZ —
 * dosyayı kaldırmak geri alınamaz ve kararı insan verir; burada yalnız liste
 * üretilir, temizlik düğmesi ekranın işidir.
 */
export function oksuzMedyalar(): string[] {
  const kullanim = medyaKullanimlariGetir();
  // TAM liste taranıyor: içe aktarılan sayfa görselleri kütüphanede
  // görünmüyor ama kartı silindiğinde diskte kalan asıl çöp onlar.
  return medyalariGetir(true)
    .filter((m) => !kullanim[m.id])
    .map((m) => m.id);
}

/* ── maliyet merkezi eşlemesi ─────────────────────────────────────────────── */

export interface MmEsleme {
  kod: string;
  bolum: string;
  amirSicil: string;
}

export function mmEslemeleriGetir(): MmEsleme[] {
  return db().prepare("SELECT kod,bolum,amirSicil FROM mmEsleme ORDER BY kod").all() as MmEsleme[];
}

export function mmEslemeKaydet(kod: string, bolum: string, amirSicil: string): void {
  db()
    .prepare(
      "INSERT INTO mmEsleme (kod,bolum,amirSicil) VALUES (?,?,?) " +
        "ON CONFLICT(kod) DO UPDATE SET bolum=excluded.bolum, amirSicil=excluded.amirSicil",
    )
    .run(kod.trim(), bolum.trim(), amirSicil.trim());
}

export function mmEslemeSil(kod: string): void {
  db().prepare("DELETE FROM mmEsleme WHERE kod=?").run(kod);
}
