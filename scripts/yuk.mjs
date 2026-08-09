/**
 * YÜK DENEMESİ — `node scripts/yuk.mjs`
 *
 * NEDEN VAR: bugünkü demo veride 1003 kişi ama yalnız 3 eğitim ve 2 kayıt var.
 * Gerçek fabrikada 1000+ kişi × 60+ eğitim × yıllar boyu tamamlama olacak ve
 * hiçbir ekranı o hacimde hiç ölçmedik. Ölçmeden yapılan iyileştirme tahmindir;
 * ölçmeden yapılan "iyi görünüyor" ise kurulumun ilk haftasında patlar.
 *
 * NE ÖLÇER: ekranların ARKASINDAKİ işi. Tarayıcı açmaz, sunucu kurmaz —
 * `/pano`, `/ekibim`, `/kiosk` ve `/kayitlar` hangi fonksiyonları çağırıyorsa
 * burada aynıları aynı sırayla çağrılır. Çizim maliyeti dışarıda kalır ama
 * darboğazlar orada değil, veri toplama yolunda.
 *
 * KABUL ÖLÇÜTLERİ (ekrandaki insana göre, sunucuya göre değil):
 *  · KIOSK 1 saniye — işçi eldivenli eliyle sicilini girdi ve AYAKTA bekliyor.
 *    Bir saniyeyi geçen liste, hattı durduran bir kuyruk demektir.
 *  · KOKPİT 3 saniye — hazırlayan/amir masada oturuyor, sekme açılışı bu kadar
 *    beklemeyi taşır; üstü "ürün donuyor" olarak okunur.
 *
 * VERİ KLASÖRÜ: her koşuda geçici bir klasör kurulur (`mkdtemp`), kurulumun
 * `data/` klasörüne ASLA dokunulmaz — orası kullanıcının gerçek verisi.
 *
 * Bayraklar `tests/kos.mjs`teki ile aynı; betik kendini onlarla yeniden
 * çağırır ki kullanıcı `node scripts/yuk.mjs` yazabilsin.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const BU = fileURLToPath(import.meta.url);
const KOK = resolve(dirname(BU), "..");

/* ── kendini doğru bayraklarla yeniden çağır ───────────────────────────────
   `--experimental-strip-types` TS dosyalarını, `cozucu.mjs` uzantısız ve
   `@/lib/...` yollarını, `--conditions=react-server` ise `server-only`i çözer.
   Üçü olmadan `src/lib` içeri alınamaz. */
if (!process.env.FLOWTRAIN_YUK_ICERIDE) {
  const bayraklar = [
    "--experimental-strip-types",
    "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
    "--disable-warning=ExperimentalWarning",
    "--conditions=react-server",
    "--import",
    pathToFileURL(join(KOK, "tests", "cozucu.mjs")).href,
  ];
  const r = spawnSync(process.execPath, [...bayraklar, BU, ...process.argv.slice(2)], {
    stdio: "inherit",
    env: { ...process.env, FLOWTRAIN_YUK_ICERIDE: "1" },
  });
  process.exit(r.status ?? 1);
}

/* ── hacim ────────────────────────────────────────────────────────────────── */

const KISI = Number(process.env.YUK_KISI ?? 1000);
const EGITIM = Number(process.env.YUK_EGITIM ?? 60);
const KURAL = Number(process.env.YUK_KURAL ?? 40);
const OTURUM = Number(process.env.YUK_OTURUM ?? 20000);
/** Toplu sertifikanın ekrandaki üst sınırı (`Defter.tsx` · SERTIFIKA_SINIRI). */
const SERTIFIKA = 200;

const KIOSK_OLCUT = 1000;
const KOKPIT_OLCUT = 3000;

const BOLUMLER = ["Kaynak", "Montaj", "Boyahane", "Pres", "Kalite", "Bakım", "Lojistik", "Depo", "Kalıphane", "Isıl İşlem", "Ar-Ge", "İdari"];
const HATLAR = ["Hat 1", "Hat 2", "Hat 3", "Hat 4", "Hat 5", "Ofis"];
const GOREVLER = ["Operatör", "Forklift", "Kaynakçı", "Tekniker", "Vardiya Amiri", "Kalite Kontrol", "Depocu", "Mühendis"];
const KATEGORILER = ["İSG", "Kalite", "Çevre", "Makine", "Oryantasyon", "Yetkinlik"];
const KAYNAKLAR = ["kiosk", "kiosk", "kiosk", "amir", "sinif", "aktarim"];

/** Tekrarlanabilir rastgelelik — iki koşunun sayıları karşılaştırılabilsin. */
let tohum = 20260809;
function rast() {
  tohum = (tohum * 1103515245 + 12345) & 0x7fffffff;
  return tohum / 0x7fffffff;
}
const sec = (dizi) => dizi[Math.floor(rast() * dizi.length)];

/* ── ortam ────────────────────────────────────────────────────────────────── */

const veri = mkdtempSync(join(tmpdir(), "flowtrain-yuk-"));
process.env.FLOWTRAIN_DATA = veri;

const amirler = [];
const siciller = [];
let personelCsv = "﻿Sicil;Ad;Bölüm;Hat;Görev;Amir;İşe giriş\r\n";
for (let i = 0; i < KISI; i++) {
  const sicil = String(100000 + i);
  siciller.push(sicil);
  // Her 20 kişide bir amir: 1000 kişide 50 ekip, gerçek bir fabrika oranı.
  const amirMi = i % 20 === 0;
  if (amirMi) amirler.push(sicil);
  const amir = amirMi ? "" : amirler[Math.floor(i / 20)] ?? amirler[0];
  const yil = 2015 + Math.floor(rast() * 11);
  personelCsv +=
    `${sicil};Personel ${i} Soyad${i % 97};${BOLUMLER[i % BOLUMLER.length]};${HATLAR[i % HATLAR.length]};` +
    `${GOREVLER[i % GOREVLER.length]};${amir};${yil}-0${1 + (i % 9)}-1${i % 10}\r\n`;
}
writeFileSync(join(veri, "personel.csv"), personelCsv, "utf8");

/* İçe aktarımlar ORTAM KURULDUKTAN SONRA: `db.ts` veri klasörünü modül
   yüklenirken bir kez okuyor (`VERI_KLASORU`), üstten import edilseydi geçici
   klasör değil kurulumun `data/` klasörü açılırdı. */
const { db, bugun } = await import("../src/lib/db.ts");
const depo = await import("../src/lib/depo.ts");
const { personelKaynagi } = await import("../src/lib/adaptorlar/index.ts");
const { tumAtamalar, ekibinDurumu, kisininBekleyenleri, kisiyeAtananlar } = await import("../src/lib/atamaServis.ts");
const { atamalariCikar, atamaDurumu, acikMi, DURUM_ETIKET } = await import("../src/lib/kurallar.ts");
const { ayEkle } = await import("../src/lib/kurallar.ts");
const { beklenenSure, gecenSure, gozetenOzetleri } = await import("../src/lib/anomali.ts");
const rapor = await import("../src/lib/rapor.ts");
const { csvYaz } = await import("../src/lib/csv.ts");
const { KAYNAK_ETIKET } = await import("../src/lib/tipler.ts");
const { kayitDefteriPdfKur } = await import("../src/lib/kayitPdf.ts");
const { panoPdfKur } = await import("../src/lib/panoPdf.ts");
const { sertifikaKur } = await import("../src/lib/sertifika.ts");

/* ── veri üretimi ─────────────────────────────────────────────────────────── */

console.log(`Veri klasörü: ${veri}`);
process.stdout.write("Hacim üretiliyor… ");
const uretimBasi = performance.now();

const egitimIdleri = [];
for (let i = 0; i < EGITIM; i++) {
  const e = depo.egitimOlustur(`${KATEGORILER[i % KATEGORILER.length]} — Eğitim ${i + 1}`, "yuk");
  egitimIdleri.push(e.id);
  depo.egitimGuncelle(e.id, {
    // Beşte biri taslak: gerçek katalogda hep yayında olmayan içerik bulunur.
    durum: i % 5 === 0 ? "taslak" : "yayin",
    kategori: KATEGORILER[i % KATEGORILER.length],
    zorunlu: i % 4 === 0,
    tekrarAy: i % 3 === 0 ? 12 : undefined,
    surum: 1 + (i % 4),
    sureDk: 15 + (i % 5) * 10,
  });
  // Sayfa ve soru sayısı panonun anomali taramasını gerçekçi kılar:
  // `beklenenSure` sayfaların asgari sürelerini topluyor.
  for (let s = 0; s < 6; s++) {
    depo.sayfaEkle(e.id, { tip: s === 0 ? "kapak" : "metin", baslik: `Kart ${s + 1}`, metin: "Gövde".repeat(20), asgariSure: 10 + s * 2 });
  }
  for (let q = 0; q < 8; q++) {
    depo.soruEkle(e.id, { tip: "tekSecim", metin: `Soru ${q + 1}?`, secenekler: ["A", "B", "C", "D"], dogru: [q % 4] });
  }
}

/* Kurallar: birkaçı TÜM FABRİKAYI kapsar (boş koşul), gerisi bölüm/hat/görev
   kırılımında. Gerçek kurulumda dağılım böyle: iki üç zorunlu ISG eğitimi
   herkese, kalanı role göre. */
for (let i = 0; i < KURAL; i++) {
  const kosul =
    i < 4
      ? {}
      : i % 3 === 0
        ? { bolum: [BOLUMLER[i % BOLUMLER.length], BOLUMLER[(i + 3) % BOLUMLER.length]] }
        : i % 3 === 1
          ? { hat: [HATLAR[i % HATLAR.length]] }
          : { gorev: [GOREVLER[i % GOREVLER.length], GOREVLER[(i + 2) % GOREVLER.length]] };
  if (i % 7 === 0) kosul.iseGirisIcindeGun = 30;
  depo.kuralEkle({ egitimId: egitimIdleri[i % EGITIM], kosul, aktif: true });
}

/* Oturumlar TEK İŞLEMDE yazılıyor: `depo.oturumKaydet` her satır için ayrı
   işlem açar, 20 bin satırda betik dakikalarca sürerdi. Yazılan satırın ŞEKLİ
   depoyla birebir aynı — ölçüm gerçek veriyi okuyor. */
const oturumEkle = db().prepare(
  `INSERT INTO oturum (id,egitimId,egitimSurum,sicil,gozeten,cihaz,baslangic,bitis,sayfaSureleri,sorulanSoruIdleri,puan,sonuc,senkron,kaynak,egitmen,notlar)
   VALUES (?,?,?,?,?,?,?,?,'{}','[]',?,?,?,?,?,?)`,
);
db().transaction(() => {
  for (let i = 0; i < OTURUM; i++) {
    const sicil = siciller[Math.floor(rast() * siciller.length)];
    const egitimId = egitimIdleri[Math.floor(rast() * egitimIdleri.length)];
    const kaynak = sec(KAYNAKLAR);
    // Son 36 aya yayılmış: aylık trend grafiği ve geçerlilik hesabı çalışsın.
    const gunOnce = Math.floor(rast() * 1080);
    const bas = new Date(Date.now() - gunOnce * 86_400_000);
    const olculdu = kaynak === "kiosk" || kaynak === "amir";
    const bit = olculdu ? new Date(bas.getTime() + (120 + Math.floor(rast() * 1800)) * 1000) : bas;
    const acik = olculdu && rast() < 0.03; // yarım kalmış oturumlar
    const zar = rast();
    const sonuc = acik ? null : zar < 0.82 ? "gecti" : zar < 0.94 ? "kaldi" : "iptal";
    oturumEkle.run(
      `otr_y${i.toString(36)}`,
      egitimId,
      1 + (i % 4),
      sicil,
      kaynak === "amir" ? amirler[i % amirler.length] : null,
      kaynak,
      bas.toISOString(),
      acik ? null : bit.toISOString(),
      sonuc === "gecti" ? 70 + Math.floor(rast() * 31) : sonuc === "kaldi" ? 30 + Math.floor(rast() * 40) : null,
      sonuc,
      rast() < 0.02 ? "hata" : "gonderildi",
      kaynak,
      kaynak === "sinif" ? `Eğitmen ${i % 12}` : null,
      null,
    );
  }
})();

console.log(`${Math.round(performance.now() - uretimBasi)} ms`);

/* ── ölçüm ────────────────────────────────────────────────────────────────── */

const olcumler = [];

/**
 * Bir yolu ölçer. `tekrar` verilirse EN KÖTÜ süre raporlanır: ortalama, tek
 * bir yavaş amirin ekranını gizler ve kabul ölçütü tam da o kişi için var.
 */
async function olc(bolum, ad, olcut, is, tekrar = 1) {
  let enKotu = 0;
  let sonuc;
  for (let i = 0; i < tekrar; i++) {
    const t = performance.now();
    sonuc = await is(i);
    enKotu = Math.max(enKotu, performance.now() - t);
  }
  olcumler.push({ bolum, ad, ms: enKotu, olcut, not: typeof sonuc === "string" ? sonuc : "" });
  return sonuc;
}

/* ── çekirdek yapı taşları (darboğazı yere sabitlemek için) ─────────────── */

await olc("Çekirdek", "depo.oturumlariGetir() — tüm defter", null, () => {
  const o = depo.oturumlariGetir();
  return `${o.length} oturum`;
});
await olc("Çekirdek", "personelKaynagi().listele()", null, async () => `${(await personelKaynagi().listele()).length} kişi`);
await olc("Çekirdek", "depo.kurallariCozulmus()", null, () => `${depo.kurallariCozulmus().length} kural`);

const kisiler = await personelKaynagi().listele();
const kurallar = depo.kurallariCozulmus().filter((k) => k.aktif);
const egitimKarti = new Map(depo.egitimleriListele().map((e) => [e.id, e]));
const yayindaki = kurallar.filter((k) => egitimKarti.get(k.egitimId)?.durum === "yayin");

const hamAtamalar = await olc("Çekirdek", "kurallar.atamalariCikar() — kişi × kural", null, () => atamalariCikar(kisiler, yayindaki));
olcumler[olcumler.length - 1].not = `${hamAtamalar.length} atama`;

const tumOturumlar = depo.oturumlariGetir();
await olc("Çekirdek", "kurallar.atamaDurumu() — atama başına defter taraması", null, () => {
  const g = bugun();
  for (const a of hamAtamalar) atamaDurumu(a, tumOturumlar, egitimKarti.get(a.egitimId), g);
  return `${hamAtamalar.length} × ${tumOturumlar.length}`;
});

/* ── ölçek eğrisi: darboğaz doğrusal mı, kareli mi? ───────────────────────
   "Yavaş" tek başına bir bulgu değil; makine alınca geçer. Kareli büyüyen bir
   yol ise fabrika büyüdükçe KÖTÜLEŞİR ve donanımla kapatılamaz. Bu yüzden aynı
   fonksiyon artan kişi sayısıyla ölçülüyor: sayı ikiye katlanınca süre dörde
   katlanıyorsa cevap bellidir. */

const egri = [];
for (const n of [125, 250, 500, 1000]) {
  const alt = kisiler.slice(0, n);
  const t = performance.now();
  const c = atamalariCikar(alt, yayindaki);
  egri.push({ kisi: n, atama: c.length, ms: performance.now() - t });
}

/* ── çekirdek düzeltmesinin karşılığı (PROTOTİP — src'ye YAZILMADI) ───────
   İki darboğaz da paylaşılan dosyalarda (`kurallar.ts`, `atamaServis.ts`) ve
   Hat C onlara dokunmuyor. Ama "yavaş" demek yetmez; düzeltmenin ne kazandırdığı
   ölçülmeden koordinatör önceliklendiremez. Aşağıdaki iki karşılık, aynı
   sonucu üreten indeksli sürümlerdir — ölçüm için burada durur. */

const protoAtamalar = [];
const protoCikar = () => {
  const cikti = [];
  // TEK FARK: `cikti.find(...)` yerine Map. Dizide arama, atama sayısı
  // büyüdükçe her yeni atamada baştan taranıyor — kareli maliyetin kaynağı bu.
  const karta = new Map();
  for (const kisi of kisiler) {
    for (const kural of yayindaki) {
      if (!kural.aktif) continue;
      const k = kural.kosul;
      const uyar = (secim, deger) => !secim || secim.length === 0 || (deger != null && secim.includes(deger));
      if (!uyar(k.bolum, kisi.bolum) || !uyar(k.hat, kisi.hat) || !uyar(k.gorev, kisi.gorev)) continue;
      const anahtar = `${kisi.sicil}|${kural.egitimId}`;
      const st = kural.sonTarih ?? null;
      const mevcut = karta.get(anahtar);
      if (mevcut) {
        if (st && (!mevcut.sonTarih || st < mevcut.sonTarih)) mevcut.sonTarih = st;
        continue;
      }
      const yeni = { sicil: kisi.sicil, egitimId: kural.egitimId, sonTarih: st };
      karta.set(anahtar, yeni);
      cikti.push(yeni);
    }
  }
  return cikti;
};
{
  const t = performance.now();
  protoAtamalar.push(...protoCikar());
  olcumler.push({
    bolum: "Prototip",
    ad: "atamalariCikar — dizi araması yerine Map",
    ms: performance.now() - t,
    olcut: null,
    not: `${protoAtamalar.length} atama`,
  });
}
{
  // İkinci darboğaz: her atama için TÜM defter taranıyor. Oturumlar bir kez
  // `sicil|egitimId` kovalarına ayrılırsa tarama atama başına 1-2 satıra düşer.
  const t = performance.now();
  const kova = new Map();
  for (const o of tumOturumlar) {
    if (!o.bitis) continue;
    const a = `${o.sicil}|${o.egitimId}`;
    const l = kova.get(a);
    if (l) l.push(o);
    else kova.set(a, [o]);
  }
  const g = bugun();
  for (const a of hamAtamalar) atamaDurumu(a, kova.get(`${a.sicil}|${a.egitimId}`) ?? [], egitimKarti.get(a.egitimId), g);
  olcumler.push({
    bolum: "Prototip",
    ad: "atamaDurumu — defter sicil|eğitim kovalarına ayrılmış",
    ms: performance.now() - t,
    olcut: null,
    not: `${kova.size} kova`,
  });
}

/* ── kiosk: işçi ayakta bekliyor ────────────────────────────────────────── */

await olc(
  "Kiosk",
  "kisininBekleyenleri(sicil) — sicil girildikten sonra liste",
  KIOSK_OLCUT,
  (i) => kisininBekleyenleri(siciller[i * 97 % siciller.length]),
  10,
);
await olc("Kiosk", "kisiyeAtananlar(sicil) — tümü (QR ile doğrudan açış)", KIOSK_OLCUT, (i) => kisiyeAtananlar(siciller[(i * 31) % siciller.length]), 10);

/* ── amir tableti ────────────────────────────────────────────────────────── */

await olc("Amir tableti", "ekibinDurumu(amirSicil) — /ekibim açılışı", KOKPIT_OLCUT, (i) => ekibinDurumu(amirler[i % amirler.length]), 5);

/* ── pano ────────────────────────────────────────────────────────────────── */

const atamaSatirlari = await olc("Pano", "tumAtamalar() — pano ve katalogun temeli", KOKPIT_OLCUT, () => tumAtamalar());
olcumler[olcumler.length - 1].not = `${atamaSatirlari.length} atama`;

await olc("Pano", "kırılımlar (bölüm + kategori + zorunlu)", KOKPIT_OLCUT, () => {
  rapor.kirilimCikar(atamaSatirlari.map((s) => ({ ad: s.kisi?.bolum || "(bölümsüz)", acik: acikMi(s.durum) })));
  rapor.kirilimCikar(atamaSatirlari.map((s) => ({ ad: s.egitim.kategori || "(kategorisiz)", acik: acikMi(s.durum) })));
  return `${atamaSatirlari.filter((s) => s.egitim.zorunlu).length} zorunlu atama`;
});

await olc("Pano", "aylikTrend() — son 12 ay", KOKPIT_OLCUT, () => rapor.aylikTrend(tumOturumlar, bugun().slice(0, 7)));

await olc("Pano", "anomali taraması — eğitim başına gözeten özeti", KOKPIT_OLCUT, () => {
  const cikti = depo.egitimleriListele().flatMap((e) => {
    const beklenen = beklenenSure(depo.sayfalariGetir(e.id));
    if (beklenen <= 0) return [];
    const olculenler = depo.oturumlariGetir({ egitimId: e.id }).filter((o) => o.kaynak === "kiosk" || o.kaynak === "amir");
    return gozetenOzetleri(olculenler, beklenen).filter((o) => o.supheli);
  });
  return `${cikti.length} şüpheli desen`;
});

await olc("Pano", "bekleyenSenkronlar()", KOKPIT_OLCUT, () => `${depo.bekleyenSenkronlar().length} bekleyen`);

/* ── kayıt defteri ───────────────────────────────────────────────────────── */

const defterSatirlari = await olc("Kayıt defteri", "sunucu birleştirmesi (oturum + eğitim + kişi)", KOKPIT_OLCUT, () => {
  const kisiKarti = new Map(kisiler.map((k) => [k.sicil, k]));
  return depo.oturumlariGetir().map((o) => {
    const e = egitimKarti.get(o.egitimId);
    const k = kisiKarti.get(o.sicil);
    const bitisGunu = o.bitis?.slice(0, 10);
    return {
      id: o.id,
      egitimId: o.egitimId,
      egitimAdi: e?.ad ?? `(silinmiş eğitim · ${o.egitimId})`,
      egitimSurum: o.egitimSurum,
      kategori: e?.kategori ?? "",
      zorunlu: !!e?.zorunlu,
      sicil: o.sicil,
      ad: k?.ad ?? "",
      bolum: k?.bolum ?? "",
      baslangic: o.baslangic,
      bitis: o.bitis,
      sureSn: o.bitis && o.bitis !== o.baslangic ? gecenSure(o) : undefined,
      puan: o.puan,
      sonuc: o.sonuc,
      kaynak: o.kaynak,
      egitmen: o.egitmen,
      gozeten: o.gozeten,
      notlar: o.notlar,
      gecerlilikBitis: o.sonuc === "gecti" && bitisGunu && e?.tekrarAy ? ayEkle(bitisGunu, e.tekrarAy) : undefined,
    };
  });
});
olcumler[olcumler.length - 1].not = `${defterSatirlari.length} satır`;

/* İSTEMCİYE GİDEN YÜK ayrı ölçülüyor: sunucu tarafı 50 ms sürse bile defter
   satırlarının tamamı tarayıcıya iniyor (süzgeç orada, her tuşta anında
   çalışsın diye). Ekranın gerçek açılış süresi bu yükün de fonksiyonu.
   Sıkıştırılmış hâli ölçülüyor çünkü Next yanıtları gzip'liyor — ham boyut
   telaş yaratır, tel üstünde giden şey bu değildir. */
const { gzipSync } = await import("node:zlib");
await olc("Kayıt defteri", "istemciye giden yük (JSON · gzip)", KOKPIT_OLCUT, () => {
  const ham = Buffer.from(JSON.stringify(defterSatirlari), "utf8");
  const sikisik = gzipSync(ham).length;
  return `${(ham.length / 1_048_576).toFixed(1)} MB ham · ${(sikisik / 1_048_576).toFixed(2)} MB tel üstünde`;
});
/* Beş katı hacim (100 bin kayıt ≈ on yıllık defter) yalnız YÜK olarak
   ölçülüyor: sınırın nerede olduğu bugünden bilinsin. */
await olc("Kayıt defteri", "aynı yük 5× hacimde (≈100 bin kayıt)", null, () => {
  const bes = [defterSatirlari, defterSatirlari, defterSatirlari, defterSatirlari, defterSatirlari].flat();
  const ham = Buffer.from(JSON.stringify(bes), "utf8");
  return `${(ham.length / 1_048_576).toFixed(1)} MB ham · ${(gzipSync(ham).length / 1_048_576).toFixed(2)} MB tel üstünde`;
});

const suzulmus = await olc("Kayıt defteri", "kayitlariSuz() + sayfala() — süzgeç her tuşta", KOKPIT_OLCUT, () => {
  const s = rapor.kayitlariSuz(defterSatirlari, { ...rapor.BOS_SUZGEC, sorgu: "personel 4", sonuc: "gecti" });
  rapor.sayfala(s, 3, 20);
  return s;
});
olcumler[olcumler.length - 1].not = `${suzulmus.length} eşleşme`;

const kunye = {
  kurum: "Yük Denemesi Fabrikası",
  belge: "Eğitim kayıt defteri",
  uretim: rapor.damgaMetni(new Date()),
  kayitSayisi: defterSatirlari.length,
  suzgec: "Süzgeç yok — tüm kayıtlar.",
};

const SONUC_ETIKET = { gecti: "Geçti", kaldi: "Kaldı", iptal: "İptal" };
await olc("Kayıt defteri", "CSV üretimi — tüm kayıtlar", KOKPIT_OLCUT, () => {
  const govde = csvYaz(
    [
      { anahtar: "tamamlama", etiket: "Tamamlama" },
      { anahtar: "sicil", etiket: "Sicil" },
      { anahtar: "ad", etiket: "Ad" },
      { anahtar: "bolum", etiket: "Bölüm" },
      { anahtar: "egitim", etiket: "Eğitim" },
      { anahtar: "surum", etiket: "Sürüm" },
      { anahtar: "sonuc", etiket: "Sonuç" },
      { anahtar: "kaynak", etiket: "Kaynak" },
      { anahtar: "kayitNo", etiket: "Kayıt no" },
    ],
    defterSatirlari.map((k) => ({
      tamamlama: rapor.zamanMetni(k.bitis),
      sicil: k.sicil,
      ad: k.ad,
      bolum: k.bolum,
      egitim: k.egitimAdi,
      surum: k.egitimSurum,
      sonuc: k.sonuc ? SONUC_ETIKET[k.sonuc] : "Açık",
      kaynak: KAYNAK_ETIKET[k.kaynak] ?? k.kaynak,
      kayitNo: k.id,
    })),
  );
  const tam = rapor.kunyeliCsv(kunye, govde);
  return `${(Buffer.byteLength(tam, "utf8") / 1_048_576).toFixed(1)} MB`;
});

/* PDF İKİ AYRI ÖLÇÜTLE ölçülüyor, çünkü iki ayrı iş:
   · Süzülmüş bir liste (ekranın uyardığı 2000 satır sınırının altı) OKUNACAK
     bir belgedir ve kokpit ölçütüne tabidir.
   · Tüm defterin dökümü 477 sayfalık bir tomar — ekran bunu açıkça uyarıp
     CSV'ye yönlendiriyor (`Defter.tsx` · PDF_UYARI_SATIRI). Bilerek istenen bir
     toplu döküm; anında olması beklenmez, ama sınırsız da olmamalı. */
const PDF_TOPLU_OLCUT = 10_000;
await olc("Kayıt defteri", "PDF — süzülmüş liste (2000 satır, ekranın uyarı sınırı)", KOKPIT_OLCUT, async () => {
  const doc = await kayitDefteriPdfKur(defterSatirlari.slice(0, 2000), { ...kunye, kayitSayisi: 2000 });
  return `${doc.getNumberOfPages()} sayfa`;
});
await olc("Kayıt defteri", "PDF — tüm defterin dökümü (ekran uyarıyor)", PDF_TOPLU_OLCUT, async () => {
  const doc = await kayitDefteriPdfKur(defterSatirlari, kunye);
  return `${doc.getNumberOfPages()} sayfa`;
});

await olc("Kayıt defteri", `toplu sertifika — ${SERTIFIKA} kişi`, KOKPIT_OLCUT, async () => {
  const gecenler = defterSatirlari.filter((k) => k.sonuc === "gecti").slice(0, SERTIFIKA);
  const doc = await sertifikaKur(
    gecenler.map((k) => ({
      ad: k.ad,
      sicil: k.sicil,
      bolum: k.bolum,
      egitimAdi: k.egitimAdi,
      egitimSurum: k.egitimSurum,
      kategori: k.kategori,
      zorunlu: k.zorunlu,
      tamamlama: k.bitis ?? k.baslangic,
      gecerlilikBitis: k.gecerlilikBitis,
      puan: k.puan,
      kaynakEtiket: KAYNAK_ETIKET[k.kaynak] ?? k.kaynak,
      egitmen: k.egitmen,
      belgeNo: k.id,
    })),
    { ...kunye, belge: "Eğitim kayıt belgesi", kayitSayisi: gecenler.length },
  );
  return `${doc.getNumberOfPages()} sayfa`;
});

/* ── pano çıktıları ──────────────────────────────────────────────────────── */

await olc("Pano", "/api/disa-aktar — tam atama CSV'si", KOKPIT_OLCUT, () => {
  const govde = csvYaz(
    [
      { anahtar: "sicil", etiket: "Sicil" },
      { anahtar: "ad", etiket: "Ad" },
      { anahtar: "bolum", etiket: "Bölüm" },
      { anahtar: "egitim", etiket: "Eğitim" },
      { anahtar: "durum", etiket: "Durum" },
      { anahtar: "sonTarih", etiket: "Son tarih" },
    ],
    atamaSatirlari.map((s) => ({
      sicil: s.sicil,
      ad: s.kisi?.ad ?? "",
      bolum: s.kisi?.bolum ?? "",
      egitim: s.egitim.ad,
      durum: DURUM_ETIKET[s.durum],
      sonTarih: s.sonTarih ?? "",
    })),
  );
  return `${(Buffer.byteLength(govde, "utf8") / 1_048_576).toFixed(1)} MB`;
});

await olc("Pano", "PDF özeti", KOKPIT_OLCUT, async () => {
  const bolumler = rapor.kirilimCikar(atamaSatirlari.map((s) => ({ ad: s.kisi?.bolum || "(bölümsüz)", acik: acikMi(s.durum) })));
  const kategoriler = rapor.kirilimCikar(atamaSatirlari.map((s) => ({ ad: s.egitim.kategori || "(kategorisiz)", acik: acikMi(s.durum) })));
  const doc = await panoPdfKur(
    {
      toplam: atamaSatirlari.length,
      tamam: atamaSatirlari.filter((s) => !acikMi(s.durum)).length,
      oran: 72,
      durumlar: [],
      bolumler: bolumler.map((b) => ({ ad: b.ad, toplam: b.toplam, acik: b.acik })),
      kategoriler: kategoriler.map((k) => ({ ad: k.ad, toplam: k.toplam, acik: k.acik })),
      zorunlu: { toplam: 0, acik: 0, oran: 0 },
      aylar: rapor.aylikTrend(tumOturumlar, bugun().slice(0, 7)).map((a) => ({ etiket: rapor.ayEtiketi(a.ay), gecti: a.gecti, kaldi: a.kaldi })),
      gecikenler: atamaSatirlari
        .filter((s) => s.durum === "gecikti" || s.durum === "suresiDoldu" || s.durum === "kaldi")
        .slice(0, 200)
        .map((s) => ({ ad: s.kisi?.ad ?? "", sicil: s.sicil, egitim: s.egitim.ad, sonTarih: s.sonTarih ?? "" })),
    },
    { ...kunye, belge: "Eğitim durumu", kayitSayisi: atamaSatirlari.length, suzgec: "Süzgeç yok — tüm atamalar." },
  );
  return `${doc.getNumberOfPages()} sayfa`;
});

/* ── tablo ────────────────────────────────────────────────────────────────── */

const ms = (n) => (n >= 1000 ? `${(n / 1000).toFixed(2)} s` : `${Math.round(n)} ms`);
const gen = (dizi) => Math.max(...dizi.map((s) => s.length));

const sutunlar = olcumler.map((o) => ({
  bolum: o.bolum,
  ad: o.ad,
  sure: ms(o.ms),
  olcut: o.olcut ? ms(o.olcut) : "—",
  durum: o.olcut === null ? "·" : o.ms <= o.olcut ? "GEÇTİ" : "AŞILDI",
  not: o.not,
}));
const g = {
  bolum: gen([...sutunlar.map((s) => s.bolum), "Yüzey"]),
  ad: gen([...sutunlar.map((s) => s.ad), "Yol"]),
  sure: gen([...sutunlar.map((s) => s.sure), "Süre"]),
  olcut: gen([...sutunlar.map((s) => s.olcut), "Ölçüt"]),
  durum: gen([...sutunlar.map((s) => s.durum), "Durum"]),
};
const satir = (s) =>
  `${s.bolum.padEnd(g.bolum)} │ ${s.ad.padEnd(g.ad)} │ ${s.sure.padStart(g.sure)} │ ${s.olcut.padStart(g.olcut)} │ ${s.durum.padEnd(g.durum)} │ ${s.not}`;

console.log(
  `\nHACİM: ${KISI} kişi · ${EGITIM} eğitim · ${KURAL} kural · ${tumOturumlar.length} oturum · ${atamaSatirlari.length} atama`,
);
console.log(`ÖLÇÜT: kiosk ${KIOSK_OLCUT} ms (işçi ayakta bekliyor) · kokpit ${KOKPIT_OLCUT} ms\n`);
console.log(satir({ bolum: "Yüzey", ad: "Yol", sure: "Süre", olcut: "Ölçüt", durum: "Durum", not: "Not" }));
console.log(`${"─".repeat(g.bolum)}─┼─${"─".repeat(g.ad)}─┼─${"─".repeat(g.sure)}─┼─${"─".repeat(g.olcut)}─┼─${"─".repeat(g.durum)}─┼─────`);
for (const s of sutunlar) console.log(satir(s));

console.log("\nÖLÇEK EĞRİSİ — atamalariCikar(): kişi ikiye katlanınca süre kaça katlanıyor?");
for (let i = 0; i < egri.length; i++) {
  const e = egri[i];
  const kat = i === 0 ? "" : ` (önceki ölçümün ${(e.ms / egri[i - 1].ms).toFixed(1)} katı)`;
  console.log(`  ${String(e.kisi).padStart(5)} kişi · ${String(e.atama).padStart(6)} atama · ${ms(e.ms).padStart(8)}${kat}`);
}

const asilanlar = olcumler.filter((o) => o.olcut !== null && o.ms > o.olcut);
console.log(
  asilanlar.length === 0
    ? "\nTüm kabul ölçütleri karşılandı."
    : `\n${asilanlar.length} yol ölçütü AŞTI:\n` + asilanlar.map((o) => `  · ${o.bolum} — ${o.ad}: ${ms(o.ms)} (ölçüt ${ms(o.olcut)})`).join("\n"),
);

/* Geçici klasör silinir: her koşu temiz başlasın ve disk dolmasın. Silme
   başarısız olursa (Windows'ta WAL dosyası kilitli kalabilir) yol yazdırılır. */
try {
  db().close();
  rmSync(veri, { recursive: true, force: true });
} catch {
  console.log(`\n(Geçici klasör silinemedi, elle silinebilir: ${veri})`);
}

process.exit(asilanlar.length === 0 ? 0 : 1);
