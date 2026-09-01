/**
 * OTURUM KAPANIŞI — çift gönderim sayaçları şişiriyor muydu?
 *
 * NEDEN BU DOSYA VAR: `depo.oturumBitir` `UPDATE ... WHERE id=?` yazıyordu,
 * `bitis IS NULL` şartı YOKTU. Kardeşleri `oturumIptal` ve
 * `eskiOturumlariKapat` o şartı taşıyordu — atlanan tek yer, çift gönderimin
 * EN ÇOK olduğu yerdi: kioskta "Onayla ve bitir"e çift basmak, ağ yavaşken
 * sayfayı yenilemek, tablet uykudan uyanınca isteğin tekrar gitmesi.
 *
 * Etkisi kaydı çoğaltmak değildi (aynı satır ikinci kez yazılıyordu) ama
 * `soruIstatistik` sayaçları iki kez artıyordu. O sayaç içerik kalitesinin
 * TEK ölçüsü: "bu soru 40 kez soruldu, 12 kez yanlış yapıldı". Sessizce
 * şişen bir sinyalle iyi bir soru "çok zor" damgası yiyip değiştirilirdi —
 * yani hata veriyi değil, İNSANIN KARARINI bozuyordu.
 *
 * Gerçek SQLite üstünde ölçülüyor; geçici veri klasörü kurulur, kurulumun
 * verisine dokunulmaz.
 *
 * Koşum: `node --experimental-strip-types tests/oturum-kapanis.test.mjs`
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { kontrol, esit, bitir } from "./yardim.mjs";

const klasor = mkdtempSync(join(tmpdir(), "flowtrain-oturum-"));
process.env.FLOWTRAIN_DATA = klasor;

// DİNAMİK İÇE AKTARIM ŞART: `db.ts` veri klasörünü modül yüklenirken okuyor.
const depo = await import("../src/lib/depo.ts");
const { db } = await import("../src/lib/db.ts");

/* ── hazırlık ─────────────────────────────────────────────────────────────── */

const e = depo.egitimOlustur("LOTO", "hazirlayan");
const s1 = depo.soruEkle(e.id, {
  tip: "dogruYanlis",
  metin: "Enerji kesilir.",
  secenekler: ["Doğru", "Yanlış"],
  dogru: [0],
});
const s2 = depo.soruEkle(e.id, {
  tip: "dogruYanlis",
  metin: "Kilit takılır.",
  secenekler: ["Doğru", "Yanlış"],
  dogru: [0],
});

const oturum = depo.oturumBaslat({
  sicil: "1001",
  egitimId: e.id,
  egitimSurum: 1,
  kaynak: "kiosk",
  cihaz: "kiosk-sinav",
  sorulanSoruIdleri: [s1.id, s2.id],
});

const kapanis = {
  sayfaSureleri: { a: 10 },
  puan: 50,
  sonuc: "kaldi",
  yanlisSoruIdleri: [s2.id],
  sorulanSoruIdleri: [s1.id, s2.id],
};

/** `soruIstatistik` satırını okur; hiç yoksa sıfırlı sayar. */
function sayac(soruId) {
  const r = depo.soruIstatistikleri(e.id).find((x) => x.soruId === soruId);
  return { deneme: r?.deneme ?? 0, yanlis: r?.yanlis ?? 0 };
}

/* ── 1. ilk kapanış yazar ─────────────────────────────────────────────────── */

esit(sayac(s1.id), { deneme: 0, yanlis: 0 }, "oturum açıkken sayaç boş");

depo.oturumBitir(oturum.id, kapanis);

const ilk = depo.oturumGetir(oturum.id);
kontrol(!!ilk.bitis, "ilk kapanış bitiş damgası yazdı");
esit(ilk.sonuc, "kaldi", "sonuç yazıldı");
esit(ilk.puan, 50, "puan yazıldı");
esit(sayac(s1.id), { deneme: 1, yanlis: 0 }, "doğru yapılan soru bir kez sorulmuş sayıldı");
esit(sayac(s2.id), { deneme: 1, yanlis: 1 }, "yanlış yapılan soru bir yanlışla sayıldı");

/* ── 2. ASIL ÖLÇÜM: ikinci kapanış sayaçlara DOKUNMAMALI ──────────────────── */

const ilkDamga = ilk.bitis;
depo.oturumBitir(oturum.id, { ...kapanis, puan: 100, sonuc: "gecti" });

esit(sayac(s1.id), { deneme: 1, yanlis: 0 }, "ÇİFT GÖNDERİM deneme sayacını artırmadı");
esit(sayac(s2.id), { deneme: 1, yanlis: 1 }, "ÇİFT GÖNDERİM yanlış sayacını artırmadı");

/* Kapanmış oturumun kendisi de değişmemeli: ilk kapanış kayıttır
   (CLAUDE.md 7). İkinci istek 100 puan ve "geçti" taşıyordu — kabul
   edilseydi kalan biri geçmiş görünürdü. */
const ikinci = depo.oturumGetir(oturum.id);
esit(ikinci.puan, 50, "kapanmış oturumun puanı ikinci istekle DEĞİŞMEDİ");
esit(ikinci.sonuc, "kaldi", "kapanmış oturumun sonucu ikinci istekle DEĞİŞMEDİ");
esit(ikinci.bitis, ilkDamga, "bitiş damgası ilk kapanışın damgası olarak kaldı");

/* ── 3. üçüncü, dördüncü… hep aynı ────────────────────────────────────────── */

depo.oturumBitir(oturum.id, kapanis);
depo.oturumBitir(oturum.id, kapanis);
esit(sayac(s1.id), { deneme: 1, yanlis: 0 }, "üst üste gönderim sayacı hâlâ şişirmiyor");

/* ── 4. AYRI bir oturum normal sayıyor (koruma fazla kapatmıyor) ──────────── */

const digerOturum = depo.oturumBaslat({
  sicil: "1002",
  egitimId: e.id,
  egitimSurum: 1,
  kaynak: "kiosk",
  cihaz: "kiosk-sinav",
  sorulanSoruIdleri: [s1.id],
});
depo.oturumBitir(digerOturum.id, {
  sayfaSureleri: {},
  puan: 100,
  sonuc: "gecti",
  yanlisSoruIdleri: [],
  sorulanSoruIdleri: [s1.id],
});
esit(sayac(s1.id), { deneme: 2, yanlis: 0 }, "başka kişinin oturumu sayacı normal artırıyor");

/* ── 5. iptal edilmiş oturum sonradan 'tamamlandı' yapılamaz ──────────────── */

const iptalli = depo.oturumBaslat({
  sicil: "1003",
  egitimId: e.id,
  egitimSurum: 1,
  kaynak: "kiosk",
  cihaz: "kiosk-sinav",
  sorulanSoruIdleri: [s1.id],
});
depo.oturumIptal(iptalli.id, "PIN kilidi");
depo.oturumBitir(iptalli.id, {
  sayfaSureleri: {},
  puan: 100,
  sonuc: "gecti",
  yanlisSoruIdleri: [],
  sorulanSoruIdleri: [s1.id],
});
esit(depo.oturumGetir(iptalli.id).sonuc, "iptal", "iptal edilen oturum 'geçti'ye çevrilemiyor");
esit(sayac(s1.id), { deneme: 2, yanlis: 0 }, "iptalli oturum sayaca hiç dokunmuyor");

/* ── temizlik ─────────────────────────────────────────────────────────────── */
db().close();
try {
  rmSync(klasor, { recursive: true, force: true });
} catch {
  /* Windows'ta dosya kilidi geç bırakılabiliyor; klasör zaten tmp'de. */
}

bitir("oturum kapanışı");
