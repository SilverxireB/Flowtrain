/**
 * GEÇMİŞ KAYIT AKTARIMI, SINIF LİSTESİ ve KAYIT SÜZGECİ SINAVI (Hat C) —
 * `npm test`
 *
 * NEDEN SINAVLI: bu üç saf fonksiyonun yanlışı da SESSİZDİR.
 *  · Aktarımda düşen bir satır, denetimde "o kişi o eğitimi almadı" demektir.
 *    Canlıya geçişin şartı bu dosya: geçmiş kayıtlar içeri alınmadan pano
 *    herkesi "eksik" gösterir ve fabrika ürüne bir daha bakmaz.
 *  · Süzgeç fazla eleyince liste KISALIR, kullanıcı "demek ki yokmuş" der.
 *    Eksik belge, hiç belge olmamasından kötüdür.
 */
import {
  tarihiCoz,
  gunDamgasi,
  sutunlariEsle,
  sutunBul,
  aktarimiCoz,
  sinifListesiniCoz,
  bosRapor,
  SUTUN_TAKMA_ADLARI,
} from "../src/lib/kayitAktarim.ts";
import { kayitlariSuz, kayitGunu, suzgecAcikMi, BOS_SUZGEC, sayfala, sureMetni, zamanMetni } from "../src/lib/rapor.ts";
import { kontrol, esit, bitir } from "./yardim.mjs";

/* ── tarih çözümü ───────────────────────────────────────────────────────────
   EN TEHLİKELİ YER: gün/ay karışması bir kişinin sertifika geçerliliğini iki
   ay kaydırır ve kimse fark etmez. */
esit(tarihiCoz("2024-05-03"), "2024-05-03", "ISO tarih aynen okunur");
esit(tarihiCoz("03.05.2024"), "2024-05-03", "GG.AA.YYYY doğru çözülür");
esit(tarihiCoz("3/5/2024"), "2024-05-03", "eğik çizgili biçim de okunur");
// 03.05 ile 05.03 AYNI DEĞİLDİR: rakamları sıralayıp tahmin etmek iki ay kaydırırdı.
kontrol(tarihiCoz("03.05.2024") !== tarihiCoz("05.03.2024"), "gün/ay sırası korunuyor");
esit(tarihiCoz("05.03.2024"), "2024-03-05", "ters sıra ters sonucu verir");
esit(tarihiCoz(""), null, "boş tarih okunmaz");
esit(tarihiCoz("geçen yıl"), null, "serbest metin okunmaz");
esit(tarihiCoz("32.05.2024"), null, "olmayan gün reddedilir");
esit(tarihiCoz("03.13.2024"), null, "olmayan ay reddedilir");
esit(tarihiCoz("03.05.1800"), null, "makul olmayan yıl reddedilir");
esit(gunDamgasi("2024-05-03"), "2024-05-03T00:00:00.000Z", "geçmiş kayda saat UYDURULMAZ");

/* ── sütun eşlemesi ─────────────────────────────────────────────────────────
   Dosya BAŞKA bir sistemden gelir; başlığı düzeltmeye zorlanan kullanıcı
   ikinci denemede vazgeçer. */
esit(sutunBul(["Sicil No", "Eğitim"], SUTUN_TAKMA_ADLARI.sicil), "Sicil No", "Türkçe başlık bulunur");
esit(sutunBul(["Registry Number"], SUTUN_TAKMA_ADLARI.sicil), "Registry Number", "İngilizce başlık bulunur");
esit(sutunBul(["SİCİL"], SUTUN_TAKMA_ADLARI.sicil), "SİCİL", "büyük harf ve Türkçe İ eşleşir");
esit(sutunBul(["Bölüm"], SUTUN_TAKMA_ADLARI.sicil), undefined, "ilgisiz başlık eşleşmez");
const esleme = sutunlariEsle(["sicil", "eğitim adı", "tamamlama tarihi", "puan"]);
esit(esleme.sicil, "sicil", "sicil sütunu eşlendi");
esit(esleme.egitim, "eğitim adı", "eğitim sütunu eşlendi");
esit(esleme.tarih, "tamamlama tarihi", "tarih sütunu eşlendi");
esit(esleme.puan, "puan", "puan sütunu eşlendi");
esit(esleme.egitmen, undefined, "olmayan sütun eşlenmez");

/* ── aktarım ────────────────────────────────────────────────────────────── */
const baglam = {
  siciller: ["1001", "1002"],
  egitimler: [
    { id: "e1", ad: "Yüksekte Çalışma", surum: 3, durum: "yayin" },
    { id: "e2", ad: "Taslak Eğitim", surum: 1, durum: "taslak" },
  ],
  mevcutAnahtarlar: [],
};
const satir = (o) => ({ sicil: "1001", egitim: "Yüksekte Çalışma", tarih: "03.05.2024", ...o });

esit(aktarimiCoz([], baglam), bosRapor(), "boş dosya boş rapor verir");

const eksik = aktarimiCoz([{ ad: "Ali", tarih: "03.05.2024" }], baglam);
esit(eksik.eksikSutunlar, ["sicil", "egitim"], "zorunlu sütun yoksa hangileri olduğu söylenir");
esit(eksik.satirlar.length, 0, "zorunlu sütun yoksa hiçbir satır okunmaz");

const iyi = aktarimiCoz([satir({})], baglam);
esit(iyi.gecerli, 1, "geçerli satır kayda dönüşür");
esit(iyi.kayitlarVarMi, undefined, "rapor beklenmedik alan taşımıyor");
esit(iyi.satirlar[0].kayit.egitimId, "e1", "eğitim adı kimliğe çevrilir");
esit(iyi.satirlar[0].kayit.egitimSurum, 3, "kayıt eğitimin SÜRÜMÜNE atıf yapar");
esit(iyi.satirlar[0].kayit.bitis, "2024-05-03T00:00:00.000Z", "damga günün başına oturur");
esit(iyi.satirlar[0].satirNo, 2, "satır numarası başlık satırını sayar");

/* HİÇBİR SATIR SESSİZCE DÜŞMEZ: geçerli olmayan satır da raporda yer alır ve
   sebebi yazılıdır. Sessizce düşen satır denetimde "almadı" demektir. */
const karisik = aktarimiCoz(
  [
    satir({}),
    satir({ sicil: "" }),
    satir({ sicil: "9999" }),
    satir({ egitim: "Olmayan Eğitim" }),
    satir({ tarih: "geçen yıl" }),
    satir({ sicil: "1002", egitim: "Taslak Eğitim" }),
  ],
  baglam,
);
esit(karisik.satirlar.length, 6, "her giren satır raporda çıkar");
kontrol(
  karisik.satirlar.filter((s) => s.durum === "atlandi").every((s) => !!s.sebep),
  "atlanan her satırın sebebi yazılı",
);
esit(karisik.satirlar[1].sebep, "Sicil boş.", "boş sicil söylenir");
esit(karisik.satirlar[2].sebep, "Sicil personel listesinde yok.", "tanınmayan sicile kayıt yazılmaz");
esit(karisik.satirlar[3].sebep, "Eğitim adı katalogda eşleşmedi.", "tanınmayan eğitim söylenir");
kontrol(karisik.satirlar[4].sebep.startsWith("Tarih okunamadı"), "okunamayan tarih söylenir");
// Taslak eğitim kaydı YAZILIR ama uyarı düşer — ürün kararı vermez, görünür kılar.
esit(karisik.satirlar[5].durum, "gecerli", "taslak eğitim kaydı atılmaz");
kontrol(karisik.satirlar[5].uyari.includes("yayında değil"), "taslak eğitim uyarı düşer");

// Aynı ada sahip iki eğitim → belirsizlik. Tahmin etmek yanlış eğitime kayıt
// yazmaktan başka bir şey değil.
const ikizli = aktarimiCoz([satir({})], {
  ...baglam,
  egitimler: [
    { id: "e1", ad: "Yüksekte Çalışma", surum: 1, durum: "yayin" },
    { id: "e3", ad: "Yüksekte Çalışma", surum: 1, durum: "yayin" },
  ],
});
esit(ikizli.gecerli, 0, "aynı adlı iki eğitimde tahmin yapılmaz");

// Yineleme: hem dosya içinde hem defterde olana karşı.
const yinelenen = aktarimiCoz([satir({}), satir({})], baglam);
esit(yinelenen.gecerli, 1, "dosya içindeki yineleme ikinci kez yazılmaz");
esit(yinelenen.atlanan, 1, "yinelenen satır raporda görünür");
const zatenVar = aktarimiCoz([satir({})], { ...baglam, mevcutAnahtarlar: ["1001|e1|2024-05-03"] });
esit(zatenVar.gecerli, 0, "defterde zaten olan kayıt tekrar yazılmaz");

// Puan zorunlu DEĞİL: tamamlamanın kendisi zorunlu. Okunamayan puan satırı
// düşürmez, uyarı düşer.
const puanli = aktarimiCoz([{ ...satir({}), puan: "85" }], baglam);
esit(puanli.satirlar[0].kayit.puan, 85, "puan okunur");
const puanVirgul = aktarimiCoz([{ ...satir({}), puan: "84,6" }], baglam);
esit(puanVirgul.satirlar[0].kayit.puan, 85, "Türkçe ondalık virgülü okunur ve yuvarlanır");
const puanBozuk = aktarimiCoz([{ ...satir({}), puan: "geçti" }], baglam);
esit(puanBozuk.gecerli, 1, "okunamayan puan satırı düşürmez");
esit(puanBozuk.satirlar[0].kayit.puan, undefined, "okunamayan puan boş bırakılır");
kontrol(puanBozuk.uyarili === 1, "okunamayan puan uyarı olarak sayılır");

/* ── sınıf listesi ──────────────────────────────────────────────────────────
   Eğitmen listeyi kâğıttan yapıştırır: "1001 Ali Veli" gibi satırlar gelir. */
const sinif = sinifListesiniCoz("1001 Ali Veli\n1002\n\n9999 Yabancı", "e1", "2024-05-03", "Hoca", "", baglam);
esit(sinif.gecerli, 2, "sicilin yanındaki ad yok sayılır, iki kişi kaydedilir");
esit(sinif.atlanan, 1, "tanınmayan sicil atlanır ve raporda görünür");
esit(sinif.satirlar[0].kayit.egitmen, "Hoca", "eğitmen kayda geçer");
esit(sinif.satirlar[0].kayit.bitis, "2024-05-03T00:00:00.000Z", "sınıf kaydı gün damgası taşır");
esit(sinifListesiniCoz("", "e1", "2024-05-03", "", "", baglam).gecerli, 0, "boş liste kayıt üretmez");
kontrol(
  sinifListesiniCoz("", "e1", "2024-05-03", "", "", baglam).satirlar[0].sebep.includes("boş"),
  "boş listenin sebebi söylenir",
);
esit(sinifListesiniCoz("1001", "yok", "2024-05-03", "", "", baglam).gecerli, 0, "eğitim seçilmeden kayıt olmaz");
esit(sinifListesiniCoz("1001", "e1", "bozuk", "", "", baglam).gecerli, 0, "geçersiz tarihle kayıt olmaz");
esit(sinifListesiniCoz("1001\n1001", "e1", "2024-05-03", "", "", baglam).gecerli, 1, "aynı kişi iki kez yazılmaz");

/* ── kayıt süzgeci ─────────────────────────────────────────────────────────── */
const k = (o) => ({
  id: "o1",
  egitimId: "e1",
  egitimAdi: "Yüksekte Çalışma",
  egitimSurum: 1,
  kategori: "İSG",
  zorunlu: true,
  sicil: "1001",
  ad: "Ali Veli",
  bolum: "Kaynak",
  baslangic: "2026-03-01T08:00:00.000Z",
  bitis: "2026-03-01T08:20:00.000Z",
  sonuc: "gecti",
  kaynak: "kiosk",
  ...o,
});
const defter = [
  k({}),
  k({ id: "o2", sicil: "1002", ad: "Ayşe Şahin", bolum: "Montaj", sonuc: "kaldi", kaynak: "amir" }),
  k({ id: "o3", sicil: "1003", ad: "Can Öz", bitis: undefined, sonuc: undefined, kaynak: "sinif" }),
  k({ id: "o4", egitimId: "e2", baslangic: "2026-06-01T08:00:00.000Z", bitis: "2026-06-01T08:30:00.000Z", kaynak: "aktarim" }),
];

esit(kayitlariSuz(defter, BOS_SUZGEC).length, 4, "boş süzgeç HİÇBİR ŞEYİ elemez");
kontrol(!suzgecAcikMi(BOS_SUZGEC), "boş süzgeç 'kapalı' sayılır");
kontrol(suzgecAcikMi({ ...BOS_SUZGEC, bolum: "Kaynak" }), "dolu alan süzgeci açar");
esit(kayitlariSuz(defter, { ...BOS_SUZGEC, egitimId: "e2" }).length, 1, "eğitim süzgeci");
esit(kayitlariSuz(defter, { ...BOS_SUZGEC, bolum: "Montaj" }).length, 1, "bölüm süzgeci");
esit(kayitlariSuz(defter, { ...BOS_SUZGEC, kaynak: "aktarim" }).length, 1, "kaynak süzgeci");
esit(kayitlariSuz(defter, { ...BOS_SUZGEC, sonuc: "kaldi" }).length, 1, "sonuç süzgeci");
// Yarım kalan oturum "açık": bitişi olmayan kayıt tarih süzgecinden de düşmemeli.
esit(kayitlariSuz(defter, { ...BOS_SUZGEC, sonuc: "acik" }).length, 1, "açık oturum süzgeci bitmemişleri bulur");
esit(kayitGunu({ baslangic: "2026-03-01T08:00:00.000Z" }), "2026-03-01", "bitişi olmayan kayıt başlangıç gününe düşer");
esit(
  kayitGunu({ baslangic: "2026-03-01T08:00:00.000Z", bitis: "2026-03-02T01:00:00.000Z" }),
  "2026-03-02",
  "bitiş önceliklidir — denetim 'ne zaman tamamlandı' diye sorar",
);
esit(kayitlariSuz(defter, { ...BOS_SUZGEC, baslangicGun: "2026-05-01" }).length, 1, "tarih alt sınırı");
esit(kayitlariSuz(defter, { ...BOS_SUZGEC, bitisGun: "2026-03-31" }).length, 3, "tarih üst sınırı");
esit(kayitlariSuz(defter, { ...BOS_SUZGEC, baslangicGun: "2026-03-01", bitisGun: "2026-03-01" }).length, 3, "tek günlük aralık, o gün DAHİL");
// Türkçe duyarlı arama: "ayse" yazan kişi "Ayşe"yi bulmalı.
esit(kayitlariSuz(defter, { ...BOS_SUZGEC, sorgu: "ayse" }).length, 1, "arama Türkçe duyarlı");
esit(kayitlariSuz(defter, { ...BOS_SUZGEC, sorgu: "1003" }).length, 1, "sicille de aranabilir");
esit(kayitlariSuz(defter, { ...BOS_SUZGEC, bolum: "Kaynak", sonuc: "gecti" }).length, 2, "süzgeçler VE ile birleşir");
esit(kayitlariSuz(defter, { ...BOS_SUZGEC, bolum: "Yok" }).length, 0, "eşleşme yoksa boş liste");

/* ── biçimlendirme ve sayfalama ─────────────────────────────────────────────── */
esit(sayfala([1, 2, 3, 4, 5], 2, 2).gorunen, [3, 4], "ikinci sayfa doğru dilim");
esit(sayfala([1, 2, 3], 99, 2).gecerliSayfa, 2, "sınır dışı sayfa geri çekilir");
esit(sayfala([], 1, 10).sonSayfa, 1, "boş listede de bir sayfa vardır");
esit(sureMetni(45), "45 sn", "kısa süre saniyeyle");
esit(sureMetni(600), "10 dk", "orta süre dakikayla");
esit(sureMetni(7200), "2 sa 0 dk", "uzun süre saatle");
esit(sureMetni(undefined), "—", "ölçülmemiş süre tire");
esit(sureMetni(0), "—", "sıfır süre tire (sınıf/aktarım kaydı)");
esit(zamanMetni("2026-03-01T08:00:00.000Z"), "2026-03-01 08:00", "damga okunur biçimde");
esit(zamanMetni(undefined), "—", "damga yoksa tire");

bitir("aktarım ve süzgeç");
