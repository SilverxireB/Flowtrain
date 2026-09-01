/**
 * OYNATICI ve KİOSK AKIŞI SINAVI — `npm test`
 *
 * NEDEN SINAVLI: buradaki iki karar da sessizce yanlış olabilir.
 *  · QR'dan gelen eğitimin açılıp açılmayacağı — yanlışı "atanmamış eğitimin
 *    kaydı" ya da "işçi istasyonda kaldı, eğitim açılmadı" demek.
 *  · Yanlış cevap açıklamalarının NE ZAMAN ve NE KADARI gönderildiği — fazlası
 *    cevap anahtarını sızdırır, eksiği sınavı ceza hâline getirir.
 */
import { qrEgitimId, kioskAcilisi, yanlisAciklamalari, KIOSK_SONUC_OTO_SN } from "../src/lib/kioskAkis.ts";
import {
  kartGorselleri,
  gorselIzgaraSinifi,
  gorselYukseklikSinifi,
  sayiIzgaraSinifi,
  sayiPuntoSinifi,
} from "../src/components/oyun/gorseller.ts";
import { kontrol, esit, bitir } from "./yardim.mjs";

/* ── QR parametresi ─────────────────────────────────────────────────────────
   Hat B ile SÖZLEŞME: QR'ın içeriği `/kiosk?egitim=<egitimId>`. */
esit(qrEgitimId("egt_1"), "egt_1", "düz parametre okunur");
esit(qrEgitimId("  egt_1  "), "egt_1", "boşluk kırpılır (etiket yazdırılırken araya girebiliyor)");
esit(qrEgitimId(""), null, "boş parametre yok sayılır");
esit(qrEgitimId("   "), null, "yalnız boşluk yok sayılır");
esit(qrEgitimId(undefined), null, "parametre yoksa null");
esit(qrEgitimId(null), null, "null parametre null döner");
// Aynı ad iki kez gönderilirse Next dizi verir; ikinci değerin nereden geldiği
// bilinmiyor — asılı QR'ın anlamı belirsizleşmesin diye İLKİ alınır.
esit(qrEgitimId(["egt_1", "egt_2"]), "egt_1", "dizi gelirse ilk değer alınır");
esit(qrEgitimId([]), null, "boş dizi null döner");

/* ── kiosk açılışı ─────────────────────────────────────────────────────────── */
esit(kioskAcilisi(null, ["a", "b"]).tip, "liste", "QR yoksa liste gösterilir");
esit(kioskAcilisi(null, []).tip, "liste", "bekleyeni olmayan kişi de listeye düşer");
esit(kioskAcilisi("a", ["a", "b"]), { tip: "basla", egitimId: "a" }, "atanmış QR eğitimi doğrudan açılır");
// EN KRİTİK: atanmamış eğitim AÇILMAZ. Açılsaydı denetimde "almadığı eğitimi
// almış görünen kişi" kaydı üretilirdi.
esit(kioskAcilisi("c", ["a", "b"]), { tip: "atanmamis", egitimId: "c" }, "atanmamış QR eğitimi açılmaz");
esit(kioskAcilisi("a", []), { tip: "atanmamis", egitimId: "a" }, "hiç bekleyeni olmayana QR eğitimi açılmaz");
kontrol(KIOSK_SONUC_OTO_SN > 0, "sonuç ekranı kioskta kendiliğinden kapanır (dördüncü dokunuş kalkar)");

/* ── yanlış cevap açıklamaları ─────────────────────────────────────────────── */
const havuz = [
  { id: "s1", metin: "Birinci", aciklama: "Birincinin açıklaması" },
  { id: "s2", metin: "İkinci" },
  { id: "s3", metin: "Üçüncü", aciklama: "Üçüncünün açıklaması" },
];

esit(yanlisAciklamalari(havuz, []), [], "her şey doğruysa açıklama listesi boş");
esit(
  yanlisAciklamalari(havuz, ["s3", "s1"]).map((y) => y.soruId),
  ["s1", "s3"],
  "sıra sorulma sırasıdır, yanlış listesinin sırası değil",
);
esit(
  yanlisAciklamalari(havuz, ["s1"]),
  [{ soruId: "s1", metin: "Birinci", aciklama: "Birincinin açıklaması" }],
  "yanlış sorunun metni ve açıklaması birlikte gelir",
);
// DOĞRU CEVAP GÖNDERİLMEZ: dönen nesnede `dogru`/`secenekler` yok. Cevap
// anahtarının istemciye inmemesi ürünün sattığı şeyi koruyan kural.
kontrol(
  yanlisAciklamalari(havuz, ["s1"]).every((y) => !("dogru" in y) && !("secenekler" in y)),
  "açıklama kutusu cevap anahtarı taşımıyor",
);
esit(yanlisAciklamalari(havuz, ["s2"])[0].aciklama, undefined, "açıklaması olmayan soruda metin uydurulmaz");
// Doğru yapılan soru listeye GİRMEZ: giren her satır, kişinin görmediği bir
// sorunun cevabını eline verirdi.
esit(yanlisAciklamalari(havuz, ["s2"]).length, 1, "yalnız yanlış yapılanlar listeye girer");
esit(yanlisAciklamalari([], ["s1"]), [], "boş soru setinden açıklama çıkmaz");

/* ── kart görselleri ───────────────────────────────────────────────────────── */
esit(kartGorselleri({ gorselIdler: [] }), [], "görselsiz kart boş liste verir");
esit(kartGorselleri({ gorselId: "g1", gorselIdler: [] }), ["g1"], "eski tekil görsel korunur");
esit(kartGorselleri({ gorselIdler: ["g1", "g2"] }), ["g1", "g2"], "çoklu görsel sırasıyla gelir");
/* LİSTE DOLUYSA GERÇEK ODUR — ve bu beklenti bilerek değiştirildi.
   Buradaki kiosk kopyası tekil `gorselId`'yi listenin BAŞINA koyuyordu,
   `lib` tarafındaki ikizi ise liste doluyken onu ATIYORDU: aynı karttan iki
   farklı görsel kümesi, üstelik yayın öncesi kontrol birini, sahanın çizdiği
   ekran diğerini çağırıyordu. Bu satır o ayrışmayı sınavla KORUYORDU.
   Artık tek işlev var (`lib/editorMedya.ts`) ve tekil alan bir kaynak değil
   `gorselIdler[0]`dan türeyen bir alan; gerekçe orada yazılı.
   Ayrıntılı ölçüm: `tests/kart-gorsel.test.mjs`. */
esit(
  kartGorselleri({ gorselId: "kapak", gorselIdler: ["g1"] }),
  ["g1"],
  "liste doluyken tekil alan değil LİSTE geçerli (tek anlam)",
);
esit(
  kartGorselleri({ gorselId: "g1", gorselIdler: ["g1", "g2"] }),
  ["g1", "g2"],
  "aynı görsel iki alanda da varsa bir kez çizilir",
);
esit(kartGorselleri({ gorselIdler: ["g1", "", "g2"] }), ["g1", "g2"], "boş kimlik atlanır");
esit(kartGorselleri({}), [], "gorselIdler tanımsızsa çökmez (eski kayıt)");

/* ── ızgara: kiosk düzeni bozulmasın ───────────────────────────────────────── */
kontrol(!gorselIzgaraSinifi(1).includes("grid"), "tek görsel ızgaraya girmez, tam genişlikte durur");
kontrol(gorselIzgaraSinifi(2).includes("grid-cols-2"), "iki görsel yan yana");
kontrol(gorselIzgaraSinifi(3).includes("grid"), "üç görsel ızgaraya girer");
kontrol(gorselIzgaraSinifi(5).includes("sm:grid-cols-3"), "üçten fazlası geniş ekranda üç sütuna açılır");
// Yükseklik sınırı OLMAZSA tek bir dikey fotoğraf ekranı yiyor ve "İleri"
// düğmesi kaydırmadan görünmüyordu.
for (const adet of [1, 2, 3, 6]) {
  kontrol(/max-h-\[\d+vh\]/.test(gorselYukseklikSinifi(adet)), `${adet} görselde yükseklik sınırı var`);
}
kontrol(
  parseInt(gorselYukseklikSinifi(1).match(/\d+/)[0], 10) > parseInt(gorselYukseklikSinifi(4).match(/\d+/)[0], 10),
  "görsel sayısı arttıkça her biri alçalır",
);

/* ── sayı vurgusu düzeni ─────────────────────────────────────────────────────
   Rakam kartının bütün değeri "bir bakışta okunması". Sabit punto bırakılınca
   üç rakamlı bir değer ("120 kg") iki sütunlu dizilimde kutudan taşıyor ve
   satır kayıyordu — kart hem okunmaz hem çirkin oluyordu. */
kontrol(!sayiIzgaraSinifi(1).includes("grid-cols"), "tek rakam ızgaraya girmez, tam genişlik kalır");
kontrol(sayiIzgaraSinifi(2).includes("grid-cols-2"), "iki rakam yan yana");
kontrol(sayiIzgaraSinifi(5).includes("sm:grid-cols-3"), "üç ve fazlası geniş ekranda üç sütun");

const punto = (s) => Number(s.match(/text-(\d)xl/)[1]);
kontrol(punto(sayiPuntoSinifi(1)) > punto(sayiPuntoSinifi(2)), "iki rakamda punto küçülür");
kontrol(punto(sayiPuntoSinifi(2)) > punto(sayiPuntoSinifi(4)), "kalabalıkta daha da küçülür");
kontrol(punto(sayiPuntoSinifi(9)) >= 4, "punto bir yerden sonra durur — okunaksız kadar küçülmez");

bitir("oynatıcı");
