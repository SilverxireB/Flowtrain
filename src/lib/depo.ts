import "server-only";
import { bolumAnahtari, bolumleriCoz } from "./bolumler";
import { db, kimlik, simdi } from "./db";
import { ozetDogru, ozetle, tuzUret } from "./parola";
import * as pinIslem from "./pin";
import {
  oynanacakYayin,
  sahayaUygula,
  sonYayin,
  sonrakiSurum,
  yayinlanmamisDegisiklikVar,
  type ImzaIcerik,
} from "./surum";
import type { Egitim, Grup, Kural, Medya, Oturum, Sayfa, Soru, YayinIcerik, YayinSurum } from "./tipler";
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

/* ── yayınlanmış sürüm (anlık görüntü) ─────────────────────────────────────
   Taslak ile yayın ayrı iki nesne (`docs/SURUMLU-YAYIN.md`). Yukarıdaki
   egitim/sayfa/soru işlevleri TASLAĞA bakar ve editör onlara yazmaya devam
   eder; buradakiler sahanın oynattığı kayda bakar.

   BURADA UPDATE YOKTUR. Yayınlanan sürüm kayıttır (CLAUDE.md 7): içeriği
   değişmez, değişiklik yeni bir sürümdür. Hangi sürümün oynatılacağı ve
   yeni sürümün numarası kararları `surum.ts`te — saf ve sınavlı. */

function yayindan(r: Satir): YayinSurum {
  return {
    id: r.id as string,
    egitimId: r.egitimId as string,
    surum: r.surum as number,
    ad: r.ad as string,
    aciklama: (r.aciklama as string) ?? undefined,
    gecmeNotu: r.gecmeNotu as number,
    denemeHakki: r.denemeHakki as number,
    soruSayisi: r.soruSayisi as number,
    karisik: !!r.karisik,
    tekrarAy: (r.tekrarAy as number) ?? undefined,
    kategori: (r.kategori as string) ?? "",
    zorunlu: !!r.zorunlu,
    sureDk: (r.sureDk as number) ?? undefined,
    egitmen: (r.egitmen as string) ?? undefined,
    bolumler: bolumleriCoz((r.bolumler as string) ?? "{}"),
    yayinlayan: r.yayinlayan as string,
    yayinZamani: r.yayinZamani as string,
  };
}

/** Bir eğitimin tüm sürümleri, yenisi başta ("3. sürüme dön" listesi). */
export function yayinlariGetir(egitimId: string): YayinSurum[] {
  const cikti: YayinSurum[] = [];
  for (const r of db().prepare("SELECT * FROM yayinSurum WHERE egitimId=? ORDER BY surum DESC").all(egitimId)) {
    cikti.push(yayindan(r as Satir));
  }
  return cikti;
}

/**
 * Sahanın oynatacağı sürüm.
 *
 * Seçim SQL'de değil `surum.ts`te: `ORDER BY surum DESC LIMIT 1` de aynı
 * cevabı verirdi ama sınavlanamaz ve ikinci okuma yerinde farklı yazılırdı.
 * Bir eğitimin sürüm sayısı avuç içi kadar — hepsini okumak bedava.
 */
export function sonYayinGetir(egitimId: string): YayinSurum | null {
  return sonYayin(yayinlariGetir(egitimId));
}

export function yayinGetir(egitimId: string, surum: number): YayinSurum | null {
  const r = db().prepare("SELECT * FROM yayinSurum WHERE egitimId=? AND surum=?").get(egitimId, surum) as
    | Satir
    | undefined;
  return r ? yayindan(r) : null;
}

/**
 * Sürümün kartları ve soruları.
 *
 * `Sayfa`/`Soru` tipleriyle döner ve KİMLİKLER TASLAKTAKİYLE AYNIDIR
 * (bkz. `db.ts` şema notu): oynatıcı, sınav kurucu ve soru istatistiği
 * anlık görüntüyü ayrı bir tip olarak tanımak zorunda kalmaz.
 */
export function yayinIcerigi(yayin: YayinSurum): YayinIcerik {
  const sayfalar: Sayfa[] = [];
  for (const ham of db().prepare("SELECT * FROM yayinSayfa WHERE yayinId=? ORDER BY sira").all(yayin.id)) {
    const r = ham as Satir;
    sayfalar.push({
      id: r.sayfaId as string,
      egitimId: yayin.egitimId,
      sira: r.sira as number,
      tip: r.tip as Sayfa["tip"],
      baslik: r.baslik as string,
      metin: (r.metin as string) ?? undefined,
      metinKarsi: (r.metinKarsi as string) ?? undefined,
      gorselId: (r.gorselId as string) ?? undefined,
      gorselIdler: JSON.parse((r.gorselIdler as string) ?? "[]"),
      videoId: (r.videoId as string) ?? undefined,
      asgariSure: r.asgariSure as number,
    });
  }

  const sorular: Soru[] = [];
  for (const ham of db().prepare("SELECT * FROM yayinSoru WHERE yayinId=? ORDER BY sira").all(yayin.id)) {
    const r = ham as Satir;
    sorular.push({
      id: r.soruId as string,
      egitimId: yayin.egitimId,
      tip: r.tip as Soru["tip"],
      metin: r.metin as string,
      secenekler: JSON.parse(r.secenekler as string),
      dogru: JSON.parse(r.dogru as string),
      gorselId: (r.gorselId as string) ?? undefined,
      aciklama: (r.aciklama as string) ?? undefined,
    });
  }

  return { yayin, sayfalar, sorular };
}

export function sonYayinIcerigi(egitimId: string): YayinIcerik | null {
  const y = sonYayinGetir(egitimId);
  return y ? yayinIcerigi(y) : null;
}

/* ── SAHANIN OKUDUĞU YER ───────────────────────────────────────────────────
   Kiosk, ziyaretçi tableti ve amir tableti YALNIZ buradan okur. Taslağa bakan
   bir oynatma yolu kalırsa, hazırlayan yazarken sahadaki işçi yarım içerik
   görür — sürümlü yayının bütün sebebi bu.

   Dönen `Egitim` künyesi yayınlanan sürümden gelir (`sahayaUygula`): geçme
   notu, deneme hakkı ve tekrar süresi de sahaya ancak yayınlanınca çıkar. */

/** Sahadaki eğitim — künyesi yayınlanan sürümden. Sahaya çıkmamışsa `null`. */
export function sahadakiEgitim(egitimId: string): Egitim | null {
  const e = egitimGetir(egitimId);
  if (!e) return null;
  const y = oynanacakYayin(e.durum, yayinlariGetir(egitimId));
  return y ? sahayaUygula(e, y) : null;
}

export interface SahadakiIcerik {
  /** Künyesi yayınlanan sürümden uygulanmış eğitim. */
  egitim: Egitim;
  yayin: YayinSurum;
  sayfalar: Sayfa[];
  sorular: Soru[];
}

/** Sahadaki eğitim + o sürümün kartları ve soruları — oynatıcının tek kapısı. */
export function sahadakiIcerik(egitimId: string): SahadakiIcerik | null {
  const e = egitimGetir(egitimId);
  if (!e) return null;
  const y = oynanacakYayin(e.durum, yayinlariGetir(egitimId));
  if (!y) return null;
  const icerik = yayinIcerigi(y);
  return { egitim: sahayaUygula(e, y), yayin: y, sayfalar: icerik.sayfalar, sorular: icerik.sorular };
}

/**
 * Sahadaki TÜM eğitimler — atama motorunun malzemesi.
 *
 * Sürümleri TEK sorguda okur: eğitim başına ayrı sorgu, 60 eğitimlik bir
 * katalogda panonun her açılışına 60 sorgu eklerdi (`scripts/yuk.mjs` ölçütü
 * kokpit için 3 sn).
 */
export function sahadakiEgitimler(): Egitim[] {
  const surumler = new Map<string, YayinSurum[]>();
  for (const r of db().prepare("SELECT * FROM yayinSurum").all()) {
    const y = yayindan(r as Satir);
    const liste = surumler.get(y.egitimId);
    if (liste) liste.push(y);
    else surumler.set(y.egitimId, [y]);
  }

  const cikti: Egitim[] = [];
  for (const e of egitimleriListele()) {
    const y = oynanacakYayin(e.durum, surumler.get(e.id) ?? []);
    if (y) cikti.push(sahayaUygula(e, y));
  }
  return cikti;
}

/**
 * Belirli bir SÜRÜMÜN soruları, verilen kimlik sırasıyla.
 *
 * Puanlama bunu kullanır: kişi oturumu hangi sürümle açtıysa o sürümden
 * puanlanır. Taslaktan okunsaydı, oturum açıkken yapılan bir düzeltme
 * (şıkkın sırası değişti, doğru cevap düzeltildi) kişiyi GÖRMEDİĞİ bir
 * anahtarla puanlardı — ve kayıt yine "sürüm N" derdi.
 */
export function yayinSorulariKimlikle(egitimId: string, surum: number, idler: string[]): Soru[] {
  if (idler.length === 0) return [];
  const yayin = yayinGetir(egitimId, surum);
  if (!yayin) return [];

  const yer = idler.map(() => "?").join(",");
  const karta = new Map<string, Soru>();
  for (const ham of db()
    .prepare(`SELECT * FROM yayinSoru WHERE yayinId=? AND soruId IN (${yer})`)
    .all(yayin.id, ...idler)) {
    const r = ham as Satir;
    karta.set(r.soruId as string, {
      id: r.soruId as string,
      egitimId,
      tip: r.tip as Soru["tip"],
      metin: r.metin as string,
      secenekler: JSON.parse(r.secenekler as string),
      dogru: JSON.parse(r.dogru as string),
      gorselId: (r.gorselId as string) ?? undefined,
      aciklama: (r.aciklama as string) ?? undefined,
    });
  }
  // Sıra oturumdakiyle aynı olmalı; `IN` sırayı korumaz.
  return idler.map((id) => karta.get(id)).filter((s): s is Soru => !!s);
}

/** Taslağın yayınlanabilir parçaları — TEK okuma, hem imza hem yazım kullanır. */
interface TaslakParcalari {
  sayfalar: Sayfa[];
  sorular: Soru[];
  bolumler: Record<string, string>;
}

function taslakParcalari(egitimId: string): TaslakParcalari {
  const sayfalar = sayfalariGetir(egitimId);
  return {
    sayfalar,
    sorular: sorulariGetir(egitimId),
    // Silinmiş kartların öksüz başlıkları burada elenir; anlık görüntüye
    // hiçbir zaman ölü satır girmez.
    bolumler: bolumleriCoz(ayarOku(bolumAnahtari(egitimId)), sayfalar.map((s) => s.id)),
  };
}

/* İmza görünümü — taslak ile yayın AYNI GÖZLE bakılmalı, yoksa "değişiklik
   var" rozeti hiç sönmez ya da hiç yanmaz. İki kurucu da satırları düz
   yapılara çevirir; kimlik taşımazlar (gerekçe `surum.ts`). */

function imzaSayfalari(sayfalar: Sayfa[], bolumler: Record<string, string>): ImzaIcerik["sayfalar"] {
  const cikti: ImzaIcerik["sayfalar"] = [];
  for (const s of sayfalar) {
    cikti.push({
      tip: s.tip,
      baslik: s.baslik,
      metin: s.metin,
      metinKarsi: s.metinKarsi,
      gorselId: s.gorselId,
      gorselIdler: s.gorselIdler,
      videoId: s.videoId,
      asgariSure: s.asgariSure,
      bolum: bolumler[s.id],
    });
  }
  return cikti;
}

function imzaIcerigi(
  ayarlar: ImzaIcerik["ayarlar"],
  sayfalar: Sayfa[],
  sorular: Soru[],
  bolumler: Record<string, string>,
): ImzaIcerik {
  const soruListesi: ImzaIcerik["sorular"] = [];
  for (const q of sorular) {
    soruListesi.push({
      tip: q.tip,
      metin: q.metin,
      secenekler: q.secenekler,
      dogru: q.dogru,
      gorselId: q.gorselId,
      aciklama: q.aciklama,
    });
  }
  return { ayarlar, sayfalar: imzaSayfalari(sayfalar, bolumler), sorular: soruListesi };
}

/** `Egitim` ve `YayinSurum` ayar alanları aynı adları taşıyor — tek kurucu yeter. */
function ayarImzasi(k: Egitim | YayinSurum): ImzaIcerik["ayarlar"] {
  return {
    ad: k.ad,
    aciklama: k.aciklama,
    gecmeNotu: k.gecmeNotu,
    denemeHakki: k.denemeHakki,
    soruSayisi: k.soruSayisi,
    karisik: k.karisik,
    tekrarAy: k.tekrarAy,
    kategori: k.kategori,
    zorunlu: k.zorunlu,
    sureDk: k.sureDk,
    egitmen: k.egitmen,
  };
}

/**
 * Taslakta yayınlanmamış değişiklik var mı — editördeki rozetin cevabı.
 *
 * Hiç yayınlanmamış eğitimde EVET döner (tamamı yayınlanmamıştır).
 */
export function yayinlanmamisDegisiklik(egitimId: string): boolean {
  const e = egitimGetir(egitimId);
  if (!e) return false;
  const parca = taslakParcalari(egitimId);
  const onceki = sonYayinIcerigi(egitimId);
  return yayinlanmamisDegisiklikVar(
    imzaIcerigi(ayarImzasi(e), parca.sayfalar, parca.sorular, parca.bolumler),
    onceki ? imzaIcerigi(ayarImzasi(onceki.yayin), onceki.sayfalar, onceki.sorular, onceki.yayin.bolumler) : null,
  );
}

/**
 * YAYINLA — o anki taslağın atomik anlık görüntüsünü alır.
 *
 * Kartsız eğitim yayınlanmaz (`null`): boş bir eğitim sahada "size atanmış
 * eğitim" diye görünür ve tamamlanamaz.
 *
 * İÇERİK AYNIYSA YENİ SÜRÜM ÜRETİLMEZ (`yeni: false`), eğitim yalnız sahaya
 * geri alınır. Taslağa alınıp hiç değiştirilmeden yayınlanan eğitim, ikizi
 * olan bir sürüm numarası bırakmamalı — kayıt sürüm numarasına atıf yapıyor.
 *
 * Tek işlemde yazılır: anlık görüntü yarım kalıp `egitim.surum` ileri
 * giderse, o numaraya atıf yapan kayıtların işaret ettiği içerik hiç var
 * olmamış olurdu.
 */
export function yayinla(egitimId: string, yayinlayan: string): { surum: number; yeni: boolean } | null {
  const e = egitimGetir(egitimId);
  if (!e) return null;
  const parca = taslakParcalari(egitimId);
  if (parca.sayfalar.length === 0) return null;

  const onceki = sonYayinIcerigi(egitimId);
  const taslakImza = imzaIcerigi(ayarImzasi(e), parca.sayfalar, parca.sorular, parca.bolumler);
  const oncekiImza = onceki
    ? imzaIcerigi(ayarImzasi(onceki.yayin), onceki.sayfalar, onceki.sorular, onceki.yayin.bolumler)
    : null;

  if (onceki && !yayinlanmamisDegisiklikVar(taslakImza, oncekiImza)) {
    egitimGuncelle(egitimId, { durum: "yayin", onaylayan: yayinlayan, surum: onceki.yayin.surum });
    return { surum: onceki.yayin.surum, yeni: false };
  }

  const surum = sonrakiSurum(e.surum, onceki?.yayin.surum ?? null, !!e.onaylayan);
  const yayinId = kimlik("yay");
  const zaman = simdi();
  const d = db();

  const surumYaz = d.prepare(
    `INSERT INTO yayinSurum (id,egitimId,surum,ad,aciklama,gecmeNotu,denemeHakki,soruSayisi,karisik,
       tekrarAy,kategori,zorunlu,sureDk,egitmen,bolumler,yayinlayan,yayinZamani)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  );
  const sayfaYaz = d.prepare(
    `INSERT INTO yayinSayfa (yayinId,sayfaId,sira,tip,baslik,metin,metinKarsi,gorselId,gorselIdler,videoId,asgariSure)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
  );
  const soruYaz = d.prepare(
    `INSERT INTO yayinSoru (yayinId,soruId,sira,tip,metin,secenekler,dogru,gorselId,aciklama)
     VALUES (?,?,?,?,?,?,?,?,?)`,
  );

  d.transaction(() => {
    surumYaz.run(
      yayinId,
      egitimId,
      surum,
      e.ad,
      e.aciklama ?? null,
      e.gecmeNotu,
      e.denemeHakki,
      e.soruSayisi,
      e.karisik ? 1 : 0,
      e.tekrarAy ?? null,
      e.kategori,
      e.zorunlu ? 1 : 0,
      e.sureDk ?? null,
      e.egitmen ?? null,
      JSON.stringify(parca.bolumler),
      yayinlayan,
      zaman,
    );
    // Sıra BURADA sıkıştırılıyor: taslakta silinen kartlar `sira` sütununda
    // boşluk bırakıyor ve anlık görüntüde 1..n olması karşılaştırmayı
    // (ve ileride diff ekranını) okunur kılar.
    parca.sayfalar.forEach((s, i) =>
      sayfaYaz.run(
        yayinId,
        s.id,
        i + 1,
        s.tip,
        s.baslik,
        s.metin ?? null,
        s.metinKarsi ?? null,
        s.gorselId ?? null,
        JSON.stringify(s.gorselIdler),
        s.videoId ?? null,
        s.asgariSure,
      ),
    );
    parca.sorular.forEach((q, i) =>
      soruYaz.run(
        yayinId,
        q.id,
        i + 1,
        q.tip,
        q.metin,
        JSON.stringify(q.secenekler),
        JSON.stringify(q.dogru),
        q.gorselId ?? null,
        q.aciklama ?? null,
      ),
    );
    egitimGuncelle(egitimId, { durum: "yayin", onaylayan: yayinlayan, surum });
  })();

  return { surum, yeni: true };
}

/**
 * YAYINDAKİ HÂLİNE DÖN — taslağı bir yayınlanmış sürümden yeniden kurar.
 *
 * `surum` verilmezse en son yayın. Geri dönen sürüm numarası döner, hedef
 * yoksa `null`.
 *
 * TASLAK SİLİNİYOR AMA KAYIT SİLİNMİYOR: taslak kayıt değildir, sahada
 * karşılığı yoktur ve zaten yayınlanan hâli olduğu gibi duruyor. Bu yüzden
 * "geri al" veri kaybı değil, iki nesneden birinin diğerine eşitlenmesidir.
 *
 * Kartlar ve sorular KENDİ ESKİ KİMLİKLERİYLE geri yazılır: bölüm başlıkları
 * kart kimliğine bağlı (yeniden eşleme gerekmez) ve soru istatistiği
 * (`soruIstatistik`) soru kimliğiyle toplanıyor — kimlik yenilenseydi
 * içerik kalite sinyali her geri alışta sıfırlanırdı.
 */
export function yayindanGeriDon(egitimId: string, surum?: number): number | null {
  const hedef = surum === undefined ? sonYayinGetir(egitimId) : yayinGetir(egitimId, surum);
  if (!hedef) return null;
  const icerik = yayinIcerigi(hedef);
  const d = db();

  d.transaction(() => {
    d.prepare("DELETE FROM sayfa WHERE egitimId=?").run(egitimId);
    d.prepare("DELETE FROM soru WHERE egitimId=?").run(egitimId);

    const sayfaYaz = d.prepare(
      `INSERT INTO sayfa (id,egitimId,sira,tip,baslik,metin,metinKarsi,gorselId,gorselIdler,videoId,asgariSure)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    );
    for (const s of icerik.sayfalar) {
      sayfaYaz.run(
        s.id,
        egitimId,
        s.sira,
        s.tip,
        s.baslik,
        s.metin ?? null,
        s.metinKarsi ?? null,
        s.gorselId ?? null,
        JSON.stringify(s.gorselIdler),
        s.videoId ?? null,
        s.asgariSure,
      );
    }

    const soruYaz = d.prepare(
      "INSERT INTO soru (id,egitimId,tip,metin,secenekler,dogru,gorselId,aciklama) VALUES (?,?,?,?,?,?,?,?)",
    );
    for (const q of icerik.sorular) {
      soruYaz.run(
        q.id,
        egitimId,
        q.tip,
        q.metin,
        JSON.stringify(q.secenekler),
        JSON.stringify(q.dogru),
        q.gorselId ?? null,
        q.aciklama ?? null,
      );
    }

    ayarYaz(bolumAnahtari(egitimId), JSON.stringify(hedef.bolumler));

    /* Ayarlar TEK UPDATE ile yazılıyor, `egitimGuncelle` ile değil: yamada
       `undefined` alanlar atlanıyor, yani anlık görüntüde BOŞ olan bir alan
       (açıklama silinmişti, tekrar süresi kaldırılmıştı) taslakta olduğu gibi
       kalırdı — "yayındaki hâline dön" yarım dönerdi. */
    d.prepare(
      `UPDATE egitim SET ad=?, aciklama=?, gecmeNotu=?, denemeHakki=?, soruSayisi=?, karisik=?,
         tekrarAy=?, kategori=?, zorunlu=?, sureDk=?, egitmen=?, guncelleme=? WHERE id=?`,
    ).run(
      hedef.ad,
      hedef.aciklama ?? null,
      hedef.gecmeNotu,
      hedef.denemeHakki,
      hedef.soruSayisi,
      hedef.karisik ? 1 : 0,
      hedef.tekrarAy ?? null,
      hedef.kategori,
      hedef.zorunlu ? 1 : 0,
      hedef.sureDk ?? null,
      hedef.egitmen ?? null,
      simdi(),
      egitimId,
    );
  })();

  return hedef.surum;
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

/* Hesap şifrelerinin özeti `parola.ts`te — aynı reçeteyi konsoldan çalışan
   kurtarma aracı da kullanıyor; iki kopya olsaydı biri değişince şifreler
   sessizce "yanlış" olurdu. */

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
  const tuz = tuzUret();
  db()
    .prepare("INSERT INTO hesap (kullanici,ad,rol,ozet,tuz,sicil,olusturma) VALUES (?,?,?,?,?,?,?)")
    .run(h.kullanici, h.ad, h.rol, ozetle(h.sifre, tuz), tuz, h.sicil ?? null, simdi());
}

export function hesapDogrula(kullanici: string, sifre: string): import("./yetki").Hesap | null {
  const r = db().prepare("SELECT * FROM hesap WHERE kullanici=?").get(kullanici) as
    | (import("./yetki").Hesap & { ozet: string; tuz: string })
    | undefined;
  if (!r) return null;
  if (!ozetDogru(r.ozet, r.tuz, sifre)) return null;
  return { kullanici: r.kullanici, ad: r.ad, rol: r.rol, sicil: r.sicil ?? undefined };
}

export function hesapSil(kullanici: string): void {
  db().prepare("DELETE FROM hesap WHERE kullanici=?").run(kullanici);
}

/**
 * Şifreyi değiştirir. Yeni TUZ da üretilir — aynı tuzu korumak, eski özetle
 * yeni özeti karşılaştırılabilir kılardı.
 *
 * Şifre geri OKUNAMAZ (scrypt özeti); unutulduğunda tek yol budur. Kapalı
 * ağda e-posta ile sıfırlama diye bir şey yok: kurtarma yetkisi, sunucunun
 * dosya sistemine erişebilen kişide olmak zorunda.
 */
export function hesapSifreDegistir(kullanici: string, yeniSifre: string): boolean {
  const tuz = tuzUret();
  const r = db()
    .prepare("UPDATE hesap SET ozet=?, tuz=? WHERE kullanici=?")
    .run(ozetle(yeniSifre, tuz), tuz, kullanici);
  return r.changes > 0;
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
