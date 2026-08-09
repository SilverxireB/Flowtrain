/**
 * ZİYARETÇİ ÇIKTISI ve KVKK SAKLAMA SÜRESİ SINAVI — `npm test`
 *
 * NEDEN SINAVLI: bu dosyadaki tek bir yanlış SİLME üretir. Silinen ziyaretçi
 * kaydı geri gelmez ve kimse fark etmez — fark edildiği an, denetimde "geçen
 * ayki ziyaretçi listesini verin" dendiği andır.
 *
 * İkinci taraf da az tehlikeli değil: çıktı eksik satır verirse denetime
 * eksik belge götürülür, ve eksik belge hiç belge olmamasından kötüdür.
 */
import {
  SAKLAMA_KAPALI,
  SAKLAMA_SECENEKLERI,
  saklamaGunuTemizle,
  saklamaSiniri,
  damgaKisalt,
  ziyaretciSatirlari,
  ciktiOzeti,
  ZIYARETCI_BASLIKLARI,
} from "../src/lib/ziyaretciCikti.ts";
import { csvYaz } from "../src/lib/csv.ts";
import { kontrol, esit, bitir } from "./yardim.mjs";

/* ── gün sayısının temizlenmesi ─────────────────────────────────────────────
   Ayar kutusuna elle "-5" yazan kişi bütün defteri silmesin. */
esit(saklamaGunuTemizle(90), 90, "geçerli gün aynen kalır");
esit(saklamaGunuTemizle("90"), 90, "metin sayıya çevrilir");
esit(saklamaGunuTemizle(0), SAKLAMA_KAPALI, "sıfır = temizlik kapalı");
esit(saklamaGunuTemizle(-5), SAKLAMA_KAPALI, "negatif gün temizliği açmaz");
esit(saklamaGunuTemizle("abc"), SAKLAMA_KAPALI, "okunamayan değer temizliği açmaz");
esit(saklamaGunuTemizle(undefined), SAKLAMA_KAPALI, "boş ayar temizliği açmaz");
esit(saklamaGunuTemizle(0.9), SAKLAMA_KAPALI, "birden küçük kesir sıfıra iner (yarım günlük saklama olmaz)");
esit(saklamaGunuTemizle(90.7), 90, "kesir aşağı yuvarlanır");
esit(saklamaGunuTemizle(99999), 3650, "saçma büyük değer on yılla sınırlanır");
esit(SAKLAMA_SECENEKLERI[0].gun, SAKLAMA_KAPALI, "ekranda ilk seçenek 'sınırsız' — varsayılan silmemek");

/* ── saklama sınırı ─────────────────────────────────────────────────────────
   VARSAYILAN SİLMEMEK: kurulumdan sonra kimsenin haberi olmadan kayıt silen
   bir ürün, ilk denetimde savunulamaz. */
const SIMDI = "2026-08-09T12:00:00.000Z";
esit(saklamaSiniri(SAKLAMA_KAPALI, SIMDI), null, "temizlik kapalıyken sınır yok");
esit(saklamaSiniri(-1, SIMDI), null, "geçersiz gün sınır üretmez");
esit(saklamaSiniri(90, "bozuk tarih"), null, "okunamayan şimdi damgası sınır üretmez");
esit(saklamaSiniri(1, SIMDI), "2026-08-08T12:00:00.000Z", "bir günlük sınır tam 24 saat geriye gider");
esit(saklamaSiniri(30, SIMDI).slice(0, 10), "2026-07-10", "otuz günlük sınır doğru tarihe düşer");

// SINIR DAHİL DEĞİLDİR (`kayitZamani < sinir`): silme kararında şüphe kaydın
// lehinedir — tam sınıra düşen kayıt durur.
const sinir = saklamaSiniri(30, SIMDI);
kontrol(!(sinir < sinir), "tam sınırdaki kayıt silinmez");
kontrol("2026-07-09T23:59:00.000Z" < sinir, "sınırdan bir dakika eski kayıt silinir");
kontrol(!("2026-07-10T12:00:01.000Z" < sinir), "sınırdan bir saniye yeni kayıt durur");

/* ── damga kısaltma ─────────────────────────────────────────────────────────
   ISO düzeni KORUNUR: Excel'de tarihe göre sıralanabilmeli. */
esit(damgaKisalt("2026-08-07T09:12:33.000Z"), "2026-08-07 09:12", "damga gün ve dakikaya iner");
esit(damgaKisalt(undefined), "", "tamamlanmamış kayıtta boş hücre");
esit(damgaKisalt(""), "", "boş damga boş hücre");

/* ── dışa aktarım satırları ─────────────────────────────────────────────────
   Denetimde sorulan soru: kim, ne zaman geldi, NEYİ izledi. */
const kayit = (o) => ({
  ziyaretci: {
    id: "z1",
    ad: "Ali Veli",
    firma: "Kaynak Ltd",
    ziyaretEttigi: "Mehmet Bey",
    cevaplar: {},
    egitimIdleri: ["e1", "e2"],
    kayitZamani: "2026-08-07T09:12:00.000Z",
    kaydeden: "ayse",
    ...o.ziyaretci,
  },
  durum: "tamam",
  biten: 2,
  toplam: 2,
  egitimAdlari: ["Genel İSG", "Yüksekte çalışma"],
  ...o,
});

const satir = ziyaretciSatirlari([kayit({})])[0];
esit(satir.ad, "Ali Veli", "ad satıra geçer");
esit(satir.firma, "Kaynak Ltd", "firma satıra geçer");
esit(satir.durum, "Tamamlandı", "durum TÜRKÇE etiketle yazılır, kod adıyla değil");
esit(satir.ilerleme, "2/2", "ilerleme okunur biçimde");
// Eğitim KİMLİĞİ değil ADI yazılır: denetimde `egt_ab12` hiçbir şey anlatmaz.
esit(satir.bilgilendirmeler, "Genel İSG | Yüksekte çalışma", "izlenen bilgilendirmeler adlarıyla listelenir");
kontrol(!satir.bilgilendirmeler.includes(";"), "ayraç noktalı virgül DEĞİL (CSV sütununu ikiye bölerdi)");
esit(satir.kaydeden, "ayse", "kaydı kimin açtığı belgede durur");

const bos = ziyaretciSatirlari([
  kayit({ ziyaretci: { firma: undefined, ziyaretEttigi: undefined, tamamlanma: undefined }, durum: "bekliyor", biten: 0 }),
])[0];
esit(bos.firma, "", "firma boşsa hücre boş kalır, 'undefined' yazmaz");
esit(bos.tamamlanma, "", "tamamlanmamış kayıtta tamamlanma hücresi boş");
esit(bos.durum, "Bekliyor", "yarım kalan ziyaretçi 'Bekliyor' yazar");

// SÜZGEÇ ÇIKTIYI KISALTMAZ: her kayıt bir satır. Denetim belgesinde sessizce
// düşen satır, "o kişi hiç gelmedi" demektir.
esit(ziyaretciSatirlari([kayit({}), kayit({}), kayit({})]).length, 3, "her kayıt bir satır üretir");
esit(ziyaretciSatirlari([]).length, 0, "kayıt yoksa satır yok");

// Her başlığın karşılığı olmalı; olmayan başlık Excel'de boş sütun demek.
for (const b of ZIYARETCI_BASLIKLARI) {
  kontrol(b.anahtar in satir, `"${b.etiket}" sütununun karşılığı var`);
}

/* ── CSV bütünleşmesi ─────────────────────────────────────────────────────── */
const csv = csvYaz(ZIYARETCI_BASLIKLARI, ziyaretciSatirlari([kayit({})]));
kontrol(csv.startsWith("﻿"), "CSV BOM ile başlar (Türkçe Excel bozuk okumasın)");
kontrol(csv.split("\r\n")[0].includes("Ad soyad;Firma"), "başlık satırı noktalı virgülle ayrılır");
kontrol(csv.includes("Ali Veli"), "kayıt CSV gövdesine düşer");

/* ── özet ───────────────────────────────────────────────────────────────────
   PDF başlığındaki "12 ziyaretçi · 10 tamamlandı · 2 yarım" satırı. */
esit(ciktiOzeti([]), { toplam: 0, tamam: 0, yarim: 0 }, "boş defterin özeti sıfır");
esit(
  ciktiOzeti([kayit({}), kayit({ durum: "bekliyor" }), kayit({ durum: "basladi" })]),
  { toplam: 3, tamam: 1, yarim: 2 },
  "yarıda kalan ziyaretçiler 'yarım' sayılır",
);

bitir("ziyaretçi çıktısı");
