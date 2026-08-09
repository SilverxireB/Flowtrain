/**
 * EĞİTİM PAKETİ KURALLARI SINAVI (Hat B) — `npm test`
 *
 * NEDEN SINAVLI: `depo.kurallariCozulmus()` atama motorunun GİRDİSİDİR. Paket
 * kuralı üyelerine yanlış açılırsa iki yönde de sessizdir:
 *  · fazla açarsa fabrikanın yarısına almadığı eğitim atanır ve pano yalan
 *    söyler;
 *  · eksik açarsa kimseye atanmaz ve kimse fark etmez — zorunlu bir İSG
 *    eğitimi hiç kimsenin listesinde görünmez.
 *
 * NEDEN GERÇEK DEPOYLA: açma kararı VERİYE bağlı (paket üyeliği) ve
 * `depo.ts` içinde yaşıyor. Sahte bir kopyayı sınavlamak, kopyanın doğru
 * olduğunu sınavlamaktan başka bir şey olmazdı. Geçici bir veri klasörü
 * kurulur; kurulumun verisine hiç dokunulmaz.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { kontrol, esit, bitir } from "./yardim.mjs";

const klasor = mkdtempSync(join(tmpdir(), "flowtrain-paket-"));
process.env.FLOWTRAIN_DATA = klasor;

// DİNAMİK İÇE AKTARIM ŞART: `db.ts` veri klasörünü modül yüklenirken okuyor.
// Statik `import` yukarı taşınır ve ayar hiç görülmezdi.
const depo = await import("../src/lib/depo.ts");
const { db } = await import("../src/lib/db.ts");

const e1 = depo.egitimOlustur("Yüksekte Çalışma", "hazirlayan");
const e2 = depo.egitimOlustur("Kimyasal Güvenliği", "hazirlayan");
const e3 = depo.egitimOlustur("Forklift", "hazirlayan");
const tekil = depo.egitimOlustur("Tekil Eğitim", "hazirlayan");

/* ── 1. Tek eğitime yazılan kural aynen geçer ─────────────────────────────── */
depo.kuralEkle({ egitimId: tekil.id, kosul: { bolum: ["Kaynak"] }, sonTarih: "2026-12-31", aktif: true });
let cozulmus = depo.kurallariCozulmus();
esit(cozulmus.length, 1, "tek eğitime yazılan kural bir kural üretir");
esit(cozulmus[0].egitimId, tekil.id, "kural kendi eğitimine bağlı kalır");
esit(cozulmus[0].kosul.bolum, ["Kaynak"], "koşul korunur");

/* ── 2. Paket kuralı ÜYELERİNE açılır ─────────────────────────────────────
   Paket kuralında `egitimId` BOŞTUR: mantıken tek bir eğitim yoktur. */
const paket = depo.grupOlustur("Oryantasyon");
depo.grupUyeleriYaz(paket.id, [e1.id, e2.id, e3.id]);
const paketKurali = depo.kuralEkle({
  egitimId: "",
  grupId: paket.id,
  kosul: { hat: ["A"] },
  sonTarih: "2026-06-30",
  aktif: true,
});
esit(depo.kurallariGetir().find((k) => k.id === paketKurali.id).egitimId, "", "paket kuralı eğitime çapalanmıyor");

cozulmus = depo.kurallariCozulmus();
esit(cozulmus.length, 4, "üç üyeli paket üç kural üretir (artı tekil kural)");
const paketten = cozulmus.filter((k) => k.grupId === paket.id);
esit(paketten.map((k) => k.egitimId).sort(), [e1.id, e2.id, e3.id].sort(), "paketin HER üyesi kapsanır");
esit(paketten[0].kosul.hat, ["A"], "paket kuralının koşulu her üyeye taşınır");
esit(paketten[0].sonTarih, "2026-06-30", "son tarih her üyeye taşınır");
esit(new Set(paketten.map((k) => k.id)).size, 1, "açılan kuralların hepsi aynı kuraldan türer (aynı kimlik)");
// Açılan kurallar atama motoruna gidiyor: `egitimId` boş kalırsa motor
// eğitimi bulamaz ve kural sessizce hiçbir şey atamaz.
kontrol(paketten.every((k) => !!k.egitimId), "açılan her kuralın eğitimi dolu");

/* ── 3. Pakete sonradan eklenen eğitim, kural yeniden yazılmadan kapsanır ───
   Paketin var olma sebebi bu. Kurallar tek tek eğitime yazılsaydı paket
   değiştikçe kuralları elle güncellemek gerekir ve biri mutlaka unutulurdu. */
const e4 = depo.egitimOlustur("İlk Yardım", "hazirlayan");
depo.grupUyeleriYaz(paket.id, [e1.id, e2.id, e3.id, e4.id]);
esit(
  depo.kurallariCozulmus().filter((k) => k.grupId === paket.id).length,
  4,
  "pakete eklenen eğitim kural değişmeden kapsanır",
);

/* ── 4. Paketten çıkarılan eğitim kapsam DIŞI kalır ───────────────────────── */
depo.grupUyeleriYaz(paket.id, [e1.id, e2.id]);
esit(
  depo.kurallariCozulmus().filter((k) => k.grupId === paket.id).map((k) => k.egitimId).sort(),
  [e1.id, e2.id].sort(),
  "paketten çıkan eğitim atanmaz",
);

/* ── 5. ÜYESİZ paket hiçbir şey atamaz ─────────────────────────────────────
   EN KRİTİK: `kurallar.ts`te BOŞ KOŞUL "herkesi kapsar" demektir. Üyesiz bir
   paket kuralı elenmezse, boş bir paket tüm fabrikaya boş bir atama üretirdi. */
const bosPaket = depo.grupOlustur("Boş Paket");
depo.kuralEkle({ egitimId: "", grupId: bosPaket.id, kosul: {}, aktif: true });
esit(depo.kurallariCozulmus().filter((k) => k.grupId === bosPaket.id).length, 0, "üyesiz paket kuralı ELENİR");
// Ve boş `egitimId` sahte bir atama olarak sızmıyor.
kontrol(depo.kurallariCozulmus().every((k) => !!k.egitimId), "çözülmüş kuralların hiçbiri boş eğitimli değil");

/* ── 6. Paket silinince kuralı da gider ────────────────────────────────────
   Şemada `grupId` ON DELETE CASCADE. Kalsaydı hiçbir pakete karşılık
   gelmeyen, atama üretmeyen kurallar listede birikirdi. */
const gecici = depo.grupOlustur("Geçici");
depo.grupUyeleriYaz(gecici.id, [e1.id]);
depo.kuralEkle({ egitimId: "", grupId: gecici.id, kosul: {}, aktif: true });
esit(depo.kurallariCozulmus().filter((k) => k.grupId === gecici.id).length, 1, "paket dururken kural çalışır");
depo.grupSil(gecici.id);
esit(depo.kurallariGetir().filter((k) => k.grupId === gecici.id).length, 0, "silinen paketin kuralı geride kalmaz");
esit(depo.kurallariCozulmus().filter((k) => k.grupId === gecici.id).length, 0, "silinmiş paket atama üretmez");

/* ── 7. Aynı eğitim iki paketten gelirse iki kural üretir ──────────────────
   Eleme burada YAPILMAZ: iki kuralın son tarihi ve koşulu farklı olabilir;
   hangisinin geçerli olduğuna kural motoru karar verir. */
const p2 = depo.grupOlustur("İkinci Paket");
depo.grupUyeleriYaz(p2.id, [e1.id]);
depo.kuralEkle({ egitimId: "", grupId: p2.id, kosul: { bolum: ["Montaj"] }, aktif: true });
esit(depo.kurallariCozulmus().filter((k) => k.egitimId === e1.id).length, 2, "aynı eğitim iki paketten iki kural alır");

/* ── 8. Pasif kural da çözülür (eleme atama servisinde) ───────────────────── */
const pasifPaket = depo.grupOlustur("Pasif");
depo.grupUyeleriYaz(pasifPaket.id, [e2.id]);
depo.kuralEkle({ egitimId: "", grupId: pasifPaket.id, kosul: {}, aktif: false });
const pasif = depo.kurallariCozulmus().filter((k) => k.grupId === pasifPaket.id);
esit(pasif.length, 1, "pasif paket kuralı da açılır");
esit(pasif[0].aktif, false, "pasiflik bilgisi kaybolmaz — eleme kural motorunun işi");

/* ── 9. Silinen eğitim paketten de düşer ──────────────────────────────────── */
depo.egitimSil(e2.id);
kontrol(
  depo.kurallariCozulmus().every((k) => k.egitimId !== e2.id),
  "silinen eğitim hiçbir paketten atanmaya devam etmez",
);

/* ── temizlik ──────────────────────────────────────────────────────────────── */
db().close();
try {
  rmSync(klasor, { recursive: true, force: true });
} catch {
  /* Windows'ta dosya kilidi geç bırakılabiliyor; klasör zaten tmp'de. */
}

bitir("paket kuralları");
