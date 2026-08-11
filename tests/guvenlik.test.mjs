/**
 * GÜVENLİK VE YETKİ TURU — `npm test`
 *
 * ÜÇ SORUYU BEKÇİLER:
 *  1. Her yüzey doğru rolü istiyor mu — ve düğmeyi gizlemekle yetinmeyip
 *     SUNUCU EYLEMİ de kapılı mı? Bu ürünün en sessiz kural ailesi: bozulunca
 *     ekranda hiçbir şey değişmez, yalnız yanlış kişi yanlış yere girer.
 *  2. Sahtecilik önlemleri hâlâ ayakta mı? (`CLAUDE.md` 5: v1 kapsamı,
 *     ertelenmez.) Oynatıcı bu dalgada değişti; ölçüler yeniden alınıyor.
 *  3. Girdi sınırları: uzun metin, bozuk CSV, dev dosya, yol dolaşımı.
 *
 * NEDEN KAYNAK TARAMASI: kapıların bir kısmı `redirect()` çağırıyor ve
 * `next/headers` olmadan çalıştırılamıyor. Kapının VARLIĞINI kaynakta,
 * DAVRANIŞINI uçtan uca sınavda ölçüyoruz — ikisi birbirinin yerini tutmaz.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { kontrol, esit, bitir } from "./yardim.mjs";

function dosyalar(kok, ad) {
  const cikti = [];
  for (const girdi of readdirSync(kok)) {
    const yol = join(kok, girdi);
    if (statSync(yol).isDirectory()) cikti.push(...dosyalar(yol, ad));
    else if (girdi === ad) cikti.push(yol);
  }
  return cikti;
}

const duz = (yol) => yol.replace(/\\/g, "/");
const oku = (yol) => readFileSync(yol, "utf8");

/* ══ 1. YETKİ MATRİSİ — yüzey × rol ════════════════════════════════════════
   Beklenen rol burada YAZILI duruyor. Bir sayfanın kapısı sessizce
   gevşetilirse (ya da hiç konmazsa) sınav düşer ve gerekçe okunur. */
const SAYFA_ROLU = {
  "src/app/atama/page.tsx": "hazirlayan",
  "src/app/ayarlar/page.tsx": "yonetici",
  "src/app/egitimler/page.tsx": "hazirlayan",
  "src/app/egitimler/[id]/page.tsx": "hazirlayan",
  "src/app/egitimler/qr/page.tsx": "hazirlayan",
  "src/app/ekibim/page.tsx": "amir",
  "src/app/gruplar/page.tsx": "hazirlayan",
  "src/app/kayitlar/page.tsx": "hazirlayan",
  "src/app/kayitlar/sinif/page.tsx": "hazirlayan",
  "src/app/kayitlar/aktarim/page.tsx": "hazirlayan",
  "src/app/pano/page.tsx": "hazirlayan",
  "src/app/personel/page.tsx": "yonetici",
  // Ziyaretçi masası ROL ARAMAZ, GİRİŞ ARAR: dört rolün hiçbiri oraya
  // oturmuyor (güvenlik görevlisine "yönetici" vermek fazla yetki olurdu).
  "src/app/ziyaretci/page.tsx": "girisli",
  "src/app/ziyaretci/sorular/page.tsx": "girisli",
};

/* Kapısız olması GEREKEN yüzeyler. Buraya biri kapı koyarsa ürünün var olma
   sebebi kırılır: işçilerin ve ziyaretçilerin kurumsal hesabı yok. */
const KAPISIZ_SAYFALAR = [
  "src/app/kiosk/page.tsx",
  "src/app/kurulum/page.tsx",
  "src/app/giris/page.tsx",
  "src/app/page.tsx",
  "src/app/ziyaretci/oyna/[id]/page.tsx",
];

const sayfalar = dosyalar("src/app", "page.tsx").map(duz);
esit(
  sayfalar.filter((y) => !(y in SAYFA_ROLU) && !KAPISIZ_SAYFALAR.includes(y)),
  [],
  "matriste yeri olmayan sayfa yok (yeni yüzey sessizce eklenemez)",
);

for (const [yol, beklenen] of Object.entries(SAYFA_ROLU)) {
  const metin = oku(yol);
  if (beklenen === "girisli") {
    kontrol(/kapiGirisli\(/.test(metin), `${yol}: giriş kapısı var`);
    continue;
  }
  const rol = metin.match(/\bkapi\(\s*"([a-z]+)"/)?.[1];
  esit(rol, beklenen, `${yol}: kapı '${beklenen}' rolünü istiyor`);
}

for (const yol of KAPISIZ_SAYFALAR) {
  const metin = oku(yol);
  kontrol(!/^\s*kapi(Girisli)?\(/m.test(metin), `${yol}: bilerek kapısız (hesapsız yüzey)`);
}

/* ══ 2. SUNUCU EYLEMLERİ — düğmeyi gizlemek önlem değildir ═════════════════
   İstemci düğmeyi çizmese bile eylem çağrılabilir: Next sunucu eylemleri
   adreslenebilir uç noktalardır. Her eylemin gövdesinde kapı ARANIR. */
const KAPISIZ_EYLEMLER = new Set([
  // Kapıdan ÖNCE gelenler.
  "girisEylem",
  "cikisEylem",
  "kurulumEylem",
  // Kiosk: kimliği doğrulanan CİHAZ, kişi sicil + PIN ile atfedilir.
  "siciliAra",
  "oturumBaslat",
  "oturumTamamla",
  // Ziyaretçi tableti ziyaretçinin eline verilir; orada kokpit oturumu olmamalı.
  "bilgilendirmeBaslatEylem",
  "bilgilendirmeTamamlaEylem",
]);

let eylemSayisi = 0;
const kapisizBulunanlar = [];
for (const yol of dosyalar("src/app", "eylemler.ts")) {
  const metin = oku(yol);
  kontrol(/^"use server";/m.test(metin), `${duz(yol)}: "use server" başlığı var`);
  const desen = /^export (?:async )?function (\w+)\(/gm;
  const bulgular = [];
  let e;
  while ((e = desen.exec(metin))) bulgular.push({ ad: e[1], bas: e.index });
  bulgular.push({ ad: null, bas: metin.length });
  for (let i = 0; i < bulgular.length - 1; i++) {
    eylemSayisi++;
    const govde = metin.slice(bulgular[i].bas, bulgular[i + 1].bas);
    const kapili = /\bkapi(?:Girisli)?\(/.test(govde);
    if (kapili === KAPISIZ_EYLEMLER.has(bulgular[i].ad)) {
      kapisizBulunanlar.push(`${duz(yol)}#${bulgular[i].ad}${kapili ? " (beklenmedik kapı)" : " (KAPISIZ)"}`);
    }
  }
}
kontrol(eylemSayisi > 40, `sunucu eylemleri tarandı (${eylemSayisi} adet)`);
esit(kapisizBulunanlar, [], "her sunucu eylemi ya kapılı ya da bilinçli istisna listesinde");

/* Yeni yüzeylerin eylemleri ADIYLA da isteniyor: liste yukarıda otomatik
   taranıyor ama bu dört yüzey bu dalganın konusu, rolleri yazılı dursun. */
const EYLEM_ROLU = [
  ["src/app/kayitlar/eylemler.ts", "hazirlayan"],
  ["src/app/gruplar/eylemler.ts", "hazirlayan"],
  ["src/app/personel/eylemler.ts", "yonetici"],
  ["src/app/atama/eylemler.ts", "hazirlayan"],
];
for (const [yol, rol] of EYLEM_ROLU) {
  const metin = oku(yol);
  const roller = [...metin.matchAll(/\bkapi\(\s*"([a-z]+)"/g)].map((m) => m[1]);
  kontrol(roller.length > 0, `${yol}: kapı çağrısı var`);
  kontrol(
    roller.every((r) => r === rol),
    `${yol}: tüm eylemler '${rol}' rolünü istiyor (${[...new Set(roller)].join(", ")})`,
  );
}

/* Kayıt DÜZENLENMEZ, SİLİNMEZ (CLAUDE.md 7). Defter eylemlerinde güncelleme
   ya da silme çağrısı belirirse denetim değeri biter. */
const kayitEylem = oku("src/app/kayitlar/eylemler.ts");
// Yalnız GERÇEK çağrıya bakılıyor: kuralı anlatan yorumun kendisi de aynı
// adları içeriyor ve düz metin araması onu ihlal sanıyordu.
kontrol(
  !/depo\.(oturumGuncelle|oturumSil|oturumIptal)\(/.test(kayitEylem),
  "kayıt defteri eylemleri kaydı DEĞİŞTİRMİYOR/SİLMİYOR",
);

/* ══ 3. API UÇLARI ═════════════════════════════════════════════════════════
   `/api/medya/[id]` GET bilerek açık: kiosk hesapsızdır ve kart görselini
   oradan çeker. Kapatılırsa işçinin ekranında hiçbir görsel görünmez. */
const ACIK_UCLAR = ["src/app/api/medya/[id]/route.ts"];
for (const yol of dosyalar("src/app/api", "route.ts")) {
  const d = duz(yol);
  const metin = oku(yol);
  if (ACIK_UCLAR.includes(d)) {
    kontrol(!/aktifHesap\(/.test(metin), `${d}: bilerek hesapsız (kiosk görseli)`);
    // Açık uç noktanın tek savunması girdi temizliği — yol dolaşımı burada durur.
    kontrol(/replace\(\/\[\^a-zA-Z0-9\._-\]\/g, ""\)/.test(metin), `${d}: kimlik beyaz listeyle temizleniyor`);
    kontrol(/X-Content-Type-Options/.test(metin), `${d}: tarayıcı tür tahmini kapalı`);
    continue;
  }
  kontrol(/aktifHesap\(/.test(metin), `${d}: kimlik aranıyor`);
  kontrol(/status: 403/.test(metin), `${d}: yetkisiz istek 403 ile dönüyor`);
}

/* ══ 4. SAHTECİLİK ÖNLEMLERİ — oynatıcı değişti, yeniden ölçülüyor ═════════ */
const oyun = oku("src/components/oyun/EgitimOyun.tsx");
const editor = oku("src/app/egitimler/[id]/Editor.tsx");
const kioskEylem = oku("src/app/kiosk/eylemler.ts");
const kioskEkran = oku("src/app/kiosk/Kiosk.tsx");

/* 4a. PIN SONDA. Aşama sırası: içerik → sınav → imza. İmza ekranı sınavdan
   önce açılırsa kişi cevaplarını gördükten sonra imzalamış olmaz. */
kontrol(
  /setAsama\(sinavSorulari\.length > 0 \? "sinav" : prova \? "sonuc" : "imza"\)/.test(oyun),
  "içerik bitince soru varsa SINAV, yoksa imza açılıyor (imza asla sınavın önüne geçmiyor)",
);
kontrol(/else setAsama\("imza"\)/.test(oyun), "son sorudan sonra imza aşamasına geçiliyor");

/* 4b. PIN İŞÇİDE. İmza ekranı PIN alanı çiziyor ve PIN sunucuya gidiyor;
   puan istemcide hesaplanmıyor (gerçek oturumda cevap anahtarı zaten yok). */
kontrol(/PinAlani deger=\{pin\}/.test(oyun), "imza ekranı PIN alanı çiziyor");
kontrol(/onBitir\?\.\(\{[\s\S]*?pin,/.test(oyun), "PIN sunucuya gönderiliyor (istemci karar vermiyor)");
kontrol(/\/\^\\d\{4\}\$\/\.test\(gonderi\.pin\)/.test(kioskEylem), "sunucu PIN biçimini yeniden doğruluyor");
kontrol(/depo\.pinDogrula\(oturum\.sicil, gonderi\.pin\)/.test(kioskEylem), "PIN sunucuda doğrulanıyor");
kontrol(/=== "kilitli"/.test(kioskEylem), "PIN kilidi sunucuda işliyor");
kontrol(
  /depo\.oturumIptal\(oturumId, "PIN kilidi"\)/.test(kioskEylem),
  "kilitte oturum kapanıyor (aynı oturumla sınırsız deneme yok)",
);

/* 4c. CEVAP ANAHTARI İSTEMCİYE İNMEZ. */
kontrol(/export type GizliSoru = Omit<Soru, "dogru">/.test(kioskEylem), "kiosk soru tipi cevap anahtarını dışlıyor");
kontrol(/sorular: GizliSoru\[\]/.test(kioskEylem), "oyun verisi gizli soru tipini taşıyor");

/* 4d. ASGARİ SÜRE. İstemci kapısı: süre dolmadan İleri açılmaz ve sekme
   arkadayken sayaç DURUR ("telefonu cebe koyup beklemek izlemek değildir"). */
kontrol(
  /const ileriAcik = prova \|\| \(kalan <= 0 && !videoBekliyor\)/.test(oyun),
  "asgari süre dolmadan İleri açılmıyor (kapıyı YALNIZ prova atlar)",
);
/* Provanın kapıyı atlaması güvenlik açığı DEĞİL: prova hiçbir şey yazmaz
   (`provaRef.current` erken döner, sunucuya oturum açılmaz) ve editöre
   zaten yetkili kişi giriyor. Kapı, KAYIT ÜRETEN yolu korumak için var. */
kontrol(/if \(provaRef\.current\) return;/.test(editor), "prova sunucuya hiçbir şey yazmıyor");
kontrol(/disabled=\{!ileriAcik\}/.test(oyun), "İleri düğmesi kapıya bağlı");
kontrol(
  /if \(document\.visibilityState !== "visible"\) return;/.test(oyun),
  "sekme arkadayken süre sayacı durmuş durumda",
);
kontrol(/v\.currentTime > enUzak \+ 0\.4/.test(oyun), "videoda ileri sarma engelleniyor");

/* 4e. SÜRE ÖLÇÜSÜ SUNUCU SAATİNDEN. Asgari süre kapısı İSTEMCİDE; telafi
   eden kontrol, sahteciliği ölçen sayının sahteciyi dinlememesi.
   Uydurma bir `sayfaSureleri` gönderen istemci ölçüyü kandıramamalı. */
const { gecenSure, hizliMi, beklenenSure } = await import("../src/lib/anomali.ts");
const uydurma = {
  baslangic: "2026-05-01T08:00:00.000Z",
  bitis: "2026-05-01T08:00:04.000Z",
  sayfaSureleri: { s1: 600, s2: 900 },
};
esit(gecenSure(uydurma), 4, "süre sunucu damgalarından ölçülüyor, istemcinin sayısından değil");
kontrol(hizliMi(uydurma, beklenenSure([{ asgariSure: 30 }, { asgariSure: 30 }])), "uydurma süre anomaliyi gizleyemiyor");

/* 4f. OTURUMUN SORU SETİ SABİT. */
kontrol(
  /sorulanSoruIdleri: sinav\.map\(\(q\) => q\.id\)/.test(kioskEylem),
  "sorulan sorular oturum açılırken sabitleniyor",
);
kontrol(/if \(oturum\.bitis\) return \{ hata: "Bu oturum zaten kapandı\." \}/.test(kioskEylem), "kapanan oturum tekrar kapatılamıyor");
kontrol(/bekleyen\.some\(\(b\) => b\.egitim\.id === egitimId\)/.test(kioskEylem), "atanmamış eğitim için oturum açılmıyor");
kontrol(/gecmis\.length >= egitim\.denemeHakki/.test(kioskEylem), "deneme hakkı sunucuda sayılıyor");

/* 4g. KİOSK KİŞİSEL VERİ SIZDIRMIYOR. Hesapsız uç noktadan dönen kişi
   nesnesi ekranda gösterilenle SINIRLI — organizasyon şeması çıkarılamaz. */
kontrol(
  /kisi: \{ sicil: kisi\.sicil, ad: kisi\.ad, bolum: kisi\.bolum \}/.test(kioskEylem),
  "kiosk yalnız sicil/ad/bölüm döndürüyor (amir, hat, işe giriş gitmiyor)",
);
kontrol(/interface KioskKisi/.test(kioskEylem) && !/iseGiris:/.test(kioskEylem.match(/interface KioskKisi[\s\S]*?\n}/)?.[0] ?? ""),
  "işe giriş tarihi kiosk cevabında yok (ilk PIN kapısının sırrı)");

/* 4h. QR HEDEFİ SUNUCUDA ÇÖZÜLÜYOR. Adres çubuğuna yazılan bir kimlikle
   yayında olmayan eğitim açılmamalı.

   Kapı `depo.sahadakiEgitim`: yalnız yayında OLAN ve yayınlanmış bir anlık
   görüntüsü BULUNAN eğitim geçer (`durum === "yayin"` denetiminden dar).
   Ham `egitimGetir` burada kullanılmamalı — taslak da geçerdi. */
const kioskSayfa = oku("src/app/kiosk/page.tsx");
kontrol(
  /depo\.sahadakiEgitim\(istenen\)/.test(kioskSayfa) && !/depo\.egitimGetir/.test(kioskSayfa),
  "QR hedefi yalnız SAHADAKİ eğitim için açılıyor",
);
kontrol(/hedefGecersiz/.test(kioskEkran), "geçersiz QR hedefi kullanıcıya söyleniyor");

/* 4i. SAHA TASLAĞI OYNATMAZ (`docs/SURUMLU-YAYIN.md` — 2. adım).
   Bu bir güvenlik kuralı kadar bir KAYIT kuralı: oynatılan içerik ile kayda
   düşen sürüm numarası aynı şeyi göstermek zorunda. Oynatma yüzeylerinden
   birinin taslağa geri dönmesi sessizdir — ekranda hiçbir şey değişmez,
   yalnız kayıt anlamsızlaşır. Bu yüzden kural KAYNAKTA tutuluyor. */
const oynatmaYuzeyleri = [
  ["kiosk", kioskEylem],
  ["ziyaretçi tableti", oku("src/app/ziyaretci/oyna/[id]/page.tsx")],
];
for (const [ad, kaynak] of oynatmaYuzeyleri) {
  kontrol(/depo\.sahadaki(Icerik|Egitim)\(/.test(kaynak), `${ad} sahadaki (yayınlanmış) sürümü okuyor`);
  kontrol(
    !/depo\.sayfalariGetir\(/.test(kaynak) && !/depo\.sorulariGetir\(/.test(kaynak),
    `${ad} taslak kart/soru tablosuna DOKUNMUYOR`,
  );
}
/* Puanlama oturumun kendi sürümünden: oturum açıkken yapılan bir düzeltme
   kişiyi görmediği cevap anahtarıyla puanlamamalı. */
kontrol(
  /depo\.yayinSorulariKimlikle\(oturum\.egitimId, oturum\.egitimSurum, oturum\.sorulanSoruIdleri\)/.test(kioskEylem),
  "puanlama oturumun SÜRÜMÜNDEKİ sorulardan yapılıyor",
);
kontrol(
  /depo\.yayinGetir\(oturum\.egitimId, oturum\.egitimSurum\)/.test(kioskEylem),
  "geçme notu da oturumun sürümünden okunuyor",
);

/* ══ 5. XSS — kaçırılmamış HTML yok ════════════════════════════════════════
   React varsayılan olarak kaçırıyor; tek delik `dangerouslySetInnerHTML`.
   İzinli tek kullanım sabit bir yazdırma CSS'i (etiket sayfası). */
const tsxDosyalari = [];
(function tara(kok) {
  for (const ad of readdirSync(kok)) {
    const yol = join(kok, ad);
    if (statSync(yol).isDirectory()) tara(yol);
    else if (ad.endsWith(".tsx")) tsxDosyalari.push({ yol: duz(yol), metin: oku(yol) });
  }
})("src");

const hamHtml = tsxDosyalari.filter((d) => d.metin.includes("dangerouslySetInnerHTML"));
esit(
  hamHtml.map((d) => d.yol),
  ["src/app/egitimler/qr/Etiketler.tsx"],
  "ham HTML yalnız bir yerde (yazdırma CSS'i)",
);
for (const d of hamHtml) {
  /* İçerik SABİT olmalı: değişken bir dizeye açılırsa kullanıcı verisi
     doğrudan belgeye yazılır. */
  const kullanim = d.metin.match(/dangerouslySetInnerHTML=\{\{ __html: (\w+) \}\}/)?.[1];
  kontrol(!!kullanim, `${d.yol}: ham HTML tek bir sabitten geliyor`);
  kontrol(
    new RegExp(`const ${kullanim} = \``).test(d.metin),
    `${d.yol}: '${kullanim}' modül düzeyinde sabit (kullanıcı verisi değil)`,
  );
}
kontrol(!tsxDosyalari.some((d) => /href=\{["'`]?javascript:/.test(d.metin)), "javascript: bağlantısı yok");

/* ══ 6. GİRDİ SINIRLARI ════════════════════════════════════════════════════ */
const { csvOku, csvYaz, satiriBol } = await import("../src/lib/csv.ts");
const { aktarimiCoz, sinifListesiniCoz, tarihiCoz } = await import("../src/lib/kayitAktarim.ts");

/* 6a. Bozuk CSV çökmemeli — okunamayan satır ATLANMALI, süreç durmamalı. */
const BOZUK = [
  ['tırnak kapanmamış', 'Sicil;Egitim;Tarih\r\n1001;"Yüksekte;12.03.2024'],
  ["sütun eksik", "Sicil;Egitim;Tarih\r\n1001;Yüksekte"],
  ["sütun fazla", "Sicil;Egitim;Tarih\r\n1001;Yüksekte;12.03.2024;fazla;bir;şey"],
  ["boş satırlar", "Sicil;Egitim;Tarih\r\n\r\n\r\n1001;Yüksekte;12.03.2024\r\n"],
  ["yalnız başlık", "Sicil;Egitim;Tarih"],
  ["hiç ayırıcı yok", "tek bir satır"],
  ["NUL ve kontrol karakteri", "Sicil;Egitim;Tarih\r\n1001;Yük sekte;12.03.2024"],
];
for (const [ad, metin] of BOZUK) {
  let patladi = false;
  try {
    csvOku(metin);
  } catch {
    patladi = true;
  }
  kontrol(!patladi, `bozuk CSV çökmüyor: ${ad}`);
}

/* 6b. Çok uzun metin. Bir hücre 100.000 karakter olabilir (kopyalanmış bir
   e-posta gövdesi); ayrıştırıcı bunu taşımalı, çıktı kaçırılmalı. */
const cokUzun = "A".repeat(100_000);
const uzunSatir = csvOku(`Sicil;Egitim;Tarih\r\n1001;${cokUzun};12.03.2024`);
esit(uzunSatir.length, 1, "100k karakterlik hücre okunabiliyor");
esit(uzunSatir[0].egitim.length, 100_000, "uzun hücre kırpılmadan geliyor");
kontrol(csvYaz([{ anahtar: "a", etiket: "A" }], [{ a: 'içinde "tırnak"; ve ayırıcı' }]).includes('""tırnak""'),
  "CSV çıktısında tırnak kaçırılıyor (hücre bölünmüyor)");
kontrol(
  !csvYaz([{ anahtar: "a", etiket: "A" }], [{ a: "satır\niçi" }]).split("\r\n")[1].endsWith("satır"),
  "hücre içi satır sonu hücreyi bölmüyor",
);
esit(satiriBol('a;"b;c";d', ";"), ["a", "b;c", "d"], "tırnaklı hücredeki ayırıcı hücreyi bölmüyor");

/* 6c. Aktarım: her atlanan satır SEBEBİYLE listeleniyor — sessizce düşen yok. */
const baglam = {
  siciller: ["1001"],
  egitimler: [{ id: "egt_1", ad: "Yüksekte Çalışma", surum: 2, durum: "yayin" }],
  mevcutAnahtarlar: [],
};
const rapor = aktarimiCoz(
  csvOku(
    "Sicil;Egitim;Tarih\r\n" +
      "1001;Yüksekte Çalışma;12.03.2024\r\n" +
      "9999;Yüksekte Çalışma;12.03.2024\r\n" +
      ";Yüksekte Çalışma;12.03.2024\r\n" +
      "1001;Olmayan Eğitim;12.03.2024\r\n" +
      "1001;Yüksekte Çalışma;bozuk tarih\r\n" +
      `1001;${cokUzun};12.03.2024\r\n`,
  ),
  baglam,
);
esit(rapor.gecerli, 1, "yalnız geçerli satır yazılacak");
esit(rapor.atlanan, 5, "atlanan satırların hepsi raporda");
kontrol(
  rapor.satirlar.filter((s) => s.durum === "atlandi").every((s) => !!s.sebep),
  "her atlanan satırın gerekçesi yazılı",
);
esit(tarihiCoz("2024-03-12"), "2024-03-12", "ISO tarih okunuyor");
esit(tarihiCoz("12.03.2024"), "2024-03-12", "GG.AA.YYYY okunuyor");
esit(tarihiCoz("32.13.2024"), null, "olmayan tarih reddediliyor");
esit(tarihiCoz("bozuk tarih"), null, "tarih olmayan metin reddediliyor");
esit(tarihiCoz("3/5/24"), null, "iki haneli yıl reddediliyor");
/* SÖZLEŞME (eski açık risk kapandı).
   `05/03/2024` Avrupa'da 5 Mart, ABD'de 3 Mayıs — ikisi de geçerli bir gün,
   yani doğrulama bunu yakalayamaz. Ayrıştırıcı eskiden sessizce GÜN ÖNCE
   okuyordu ve ABD dışa aktarımından gelen kayıt iki ay kayıyordu. Artık
   tahmin edilmiyor: satır gerekçesiyle atlanıyor. Bu doğrulama, biri
   "kolaylık olsun" diye tahmini geri getirirse sessiz kalmasın diye var. */
esit(tarihiCoz("05/03/2024"), null, "belirsiz eğik çizgili tarih tahmin EDİLMEZ, reddedilir");
esit(tarihiCoz("25/03/2024"), "2024-03-25", "gün 12'den büyükse belirsizlik yok, okunur");

/* Mükerrer koruması: aynı dosya ikinci kez yüklenince kayıt ÇOĞALMAMALI. */
const ikinciKez = aktarimiCoz(csvOku("Sicil;Egitim;Tarih\r\n1001;Yüksekte Çalışma;12.03.2024"), {
  ...baglam,
  mevcutAnahtarlar: ["1001|egt_1|2024-03-12"],
});
esit(ikinciKez.gecerli, 0, "defterde olan kayıt ikinci kez yazılmıyor");
esit(ikinciKez.atlanan, 1, "mükerrer satır gerekçesiyle atlanıyor");

/* 6d. Sınıf listesi: yapıştırılan kâğıt liste kirli gelir. */
const sinif = sinifListesiniCoz(
  "10109369 Bülent Sandıkçı\n1001\n\n   \n1001 tekrar\nabc\n" + cokUzun,
  "egt_1",
  "2026-03-01",
  "Eğitmen Kişi",
  "",
  baglam,
);
esit(sinif.gecerli, 1, "kirli listeden yalnız tanınan sicil geçiyor");
kontrol(
  sinif.satirlar.filter((s) => s.durum === "atlandi").every((s) => !!s.sebep),
  "sınıf listesinde atlanan her satırın gerekçesi var",
);
kontrol(
  sinif.satirlar.some((s) => /zaten var/i.test(s.sebep ?? "")),
  "aynı sicil listede iki kez varsa ikincisi atlanıyor",
);

/* 6e. Dosya boyutu sınırları KODDA yazılı. */
kontrol(/const AKTARIM_SINIRI = \d+/.test(kayitEylem), "aktarımda satır sınırı var");
const medyaUc = oku("src/app/api/medya/route.ts");
kontrol(/const EN_BUYUK = /.test(medyaUc), "medya yüklemede boyut sınırı var");
kontrol(
  /content-length[\s\S]{0,400}status: 413/.test(medyaUc),
  "boyut GÖVDE OKUNMADAN reddediliyor (dev dosya belleğe alınmıyor)",
);
kontrol(/turTutuyorMu\(/.test(medyaUc), "dosyanın gerçek türüne bakılıyor (istemci beyanına değil)");
kontrol(/const IZINLI/.test(medyaUc), "yüklenebilir türler beyaz listeyle sınırlı");

/* 6f. YOL DOLAŞIMI. Medya kimliğindeki `../` veri klasörünün dışına
   çıkarabilirdi; beyaz liste dışındaki her karakter siliniyor. */
const temizle = (id) => id.replace(/[^a-zA-Z0-9._-]/g, "");
for (const kotu of ["../../personel.csv", "..%2Fflowtrain.db", "/etc/passwd", "..\\..\\flowtrain.db"]) {
  const temiz = temizle(kotu);
  kontrol(!temiz.includes("/") && !temiz.includes("\\"), `yol ayırıcısı temizleniyor: ${kotu}`);
}
kontrol(temizle("....//flowtrain.db") === "....flowtrain.db", "iki kez uygulanan dolaşım da düşüyor (ayırıcı hiç kalmıyor)");

/* 6g. Açık yönlendirme. Giriş sonrası `next` yalnız İÇ yol olabilir. */
const { guvenliYol } = await import("../src/lib/yetki.ts");
for (const kotu of ["//kotu.example", "/\\kotu.example", "http://kotu.example", "/\tkotu", "javascript:alert(1)"]) {
  esit(guvenliYol(kotu), "/", `dış adres reddediliyor: ${JSON.stringify(kotu)}`);
}
esit(guvenliYol("/pano"), "/pano", "iç yol korunuyor");

bitir("güvenlik");
