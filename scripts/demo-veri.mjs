/**
 * DEMO VERİSİ — `npm run demo`
 *
 * Neden var: veri klasörü `.gitignore`'da (kurulumun kendi verisi repoya asla
 * girmez). Depoyu başka bir makineye çektiğinizde uygulama BOŞ açılır — demo
 * eğitim, ziyaretçi bilgilendirmeleri, kayıt soruları ve görseller yoktur.
 * Bu betik onları `ornek/` klasöründen yeniden kurar.
 *
 * TEKRAR ÇALIŞTIRILABİLİR: aynı adlı eğitimleri silip yeniden yazar. Kendi
 * yazdığınız eğitimlere ve ziyaretçi kayıtlarına DOKUNMAZ.
 *
 * Ürettiği her şey SAHTEDİR — 1000 kişilik personel listesi de, eğitim
 * içeriği de. Gerçek fabrika verisiyle değiştirin.
 *
 *   node scripts/demo-veri.mjs            # kur
 *   node scripts/demo-veri.mjs --sil      # yalnız demo içeriği kaldır
 */
import Database from "better-sqlite3";
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

const KOK = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const VERI = process.env.FLOWTRAIN_DATA ?? join(KOK, "data");
const ORNEK = join(KOK, "ornek");
const MEDYA = join(VERI, "medya");

const SIL = process.argv.includes("--sil");
const TAHLIYE = "ziyaretci-tahliye.webm";

/* ── veritabanı ───────────────────────────────────────────────────────────── */

if (!existsSync(VERI)) mkdirSync(VERI, { recursive: true });
if (!existsSync(MEDYA)) mkdirSync(MEDYA, { recursive: true });

const d = new Database(join(VERI, "flowtrain.db"));
d.pragma("foreign_keys = ON");

// Uygulama hiç açılmadıysa tablolar yoktur; şemayı kurmak uygulamanın işi.
const tabloVar = d.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='egitim'").get();
if (!tabloVar) {
  console.error("Veritabanı henüz kurulmamış. Önce `npm run dev` (ya da `npm start`) ile uygulamayı bir kez açın.");
  process.exit(1);
}

const simdi = () => new Date().toISOString();
const kimlik = (o) => `${o}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const HAZIRLAYAN = d.prepare("SELECT kullanici FROM hesap ORDER BY olusturma LIMIT 1").get()?.kullanici ?? "demo";

/* ── içerik ───────────────────────────────────────────────────────────────── */

const ONAY =
  "Bu bilgilendirmeyi baştan sona izlediğimi, anladığımı ve sahada bu kurallara uyacağımı onaylıyorum.\n\n" +
  '"Tamamla" dediğinizde adınız, saatiniz ve izlediğiniz bilgilendirme kayda geçer.';

/**
 * KİMLİKLER SABİT, rastgele DEĞİL.
 *
 * Betik eğitimi silip yeniden yazıyor. Kimlik her seferinde değişseydi
 * tamamlanmış oturumlar ve ziyaretçi kayıtları OLMAYAN bir eğitimi gösterirdi:
 * kişi eğitimi almış olduğu hâlde panoda "eksik" görünür, ziyaretçinin tableti
 * "bilgilendirme bulunamadı" derdi. Kimlik sabit kalınca yeniden çalıştırmak
 * içeriği tazeler, geçmişi bozmaz.
 */
const ID_CALISAN = "egt_demo_isg_saha";
const ID_ZIY_GENEL = "egt_demo_ziy_genel";
const ID_ZIY_YUKSEKLIK = "egt_demo_ziy_yukseklik";

/** Çalışan eğitimi: beş kart tipinin beşi, üç soru tipinin üçü, sınavlı. */
const CALISAN = {
  id: ID_CALISAN,
  ad: "İSG Temel Saha Güvenliği",
  aciklama:
    "Üretim sahasına giren herkesin yılda bir tamamlaması gereken temel iş sağlığı ve güvenliği eğitimi. " +
    "Demo içeriktir — kendi fabrikanızın gerçeğiyle değiştirin.",
  ayar: { durum: "yayin", gecmeNotu: 80, denemeHakki: 2, soruSayisi: 8, karisik: 1, tekrarAy: 12 },
  kartlar: [
    { tip: "kural", baslik: "Bu eğitim kimin için?", asgariSure: 8, metin:
      "Üretim sahasına giren herkes için: operatör, bakımcı, forklift sürücüsü, amir, stajyer ve ziyaretçi.\n\n" +
      "Yaklaşık 12 dakika sürer. Sonunda 8 soruluk kısa bir sınav var; geçme notu 80." },
    { tip: "uyari", baslik: "Bu sahada can alan üç şey", asgariSure: 12, metin:
      "1. Yüksekten düşme\n2. Araç ve yük altında kalma\n3. Beklenmedik anda enerjilenen makine\n\n" +
      "Üçünün de ortak yanı şu: kaza anında karar verecek zaman yoktur. Karar önceden verilir — şimdi." },
    { tip: "kural", baslik: "Sarı çizginin içinde zorunlu KKD", gorselId: "mdy_demo_kkd.png", asgariSure: 10, metin:
      "Baret, koruyucu gözlük ve çelik burunlu ayakkabı her zaman zorunludur — beş dakikalık iş için de, ziyaretçi için de.\n\n" +
      "Gürültü, kimyasal ve kaynak işlerinde ek KKD vardır; tabelası işin başında asılıdır." },
    { tip: "yapYapma", baslik: "KKD'yi doğru kullanmak", asgariSure: 12,
      metin: "Vardiya başında KKD'ni gözden geçir.\nGözlüğü baretin üstünde değil, gözünde taşı.\nHasarlı KKD'yi amirine ver, yenisini al.",
      metinKarsi: "Çatlak baret, çizik gözlük, delik eldivenle işe başlama.\n\"İki dakikalık iş\" diye kulaklığı çıkarma.\nDönen parçaya yakın çalışırken eldiven kullanma — kaptırır." },
    { tip: "adim", baslik: "Vardiya başı beş kontrol", asgariSure: 12, metin:
      "Çalışma alanında dökülmüş sıvı ya da yerde kablo var mı?\nAcil stop düğmesi erişilebilir mi, kapağı sağlam mı?\n" +
      "Makine koruyucuları (kapak, ızgara, fotosel) yerinde mi?\nYangın söndürücünün ve acil çıkışın önü açık mı?\n" +
      "Kullanacağın el aleti, sapan ve kaldırma ekipmanı sağlam mı?" },
    { tip: "uyari", baslik: "Elini makinenin içine sokuyorsan: LOTO", gorselId: "mdy_demo_loto.png", asgariSure: 12, metin:
      "Sıkışma giderme, temizlik, kalıp değişimi, ayar — hepsi dahil.\n\n" +
      "Enerjiyi kesmek TEK BAŞINA yetmez: kilit ve etiket olmadan bir başkası aynı şalteri farkında olmadan açabilir." },
    { tip: "adim", baslik: "LOTO — sırayı bozma", asgariSure: 14, metin:
      "İşi durdur, amirine haber ver.\nEnerjiyi ana şalterden kes; basınçlı havayı ve hidroliği boşalt.\n" +
      "Kendi kilidini tak — ortak kilit değil, senin kilidin.\nEtikete adını, tarihi ve sebebi yaz.\n" +
      "Start düğmesine basarak makinenin gerçekten durduğunu test et.\nİş bitince kilidi yalnız sen sök." },
    { tip: "yapYapma", baslik: "Forklift ve yaya aynı koridorda", gorselId: "mdy_demo_forklift.png", asgariSure: 12,
      metin: "Koridora girmeden dur ve iki yana bak.\nSürücüyle göz teması kur, el işaretini bekle.\nYaya yolunda, sarı çizginin dışında yürü.",
      metinKarsi: "Forklifti arkasından ya da yükün altından geçme.\nKulaklıkla veya telefona bakarak koridora çıkma.\nForklifte, çatala ya da paletin üstüne binme." },
    { tip: "kural", baslik: "Kimyasala dokunmadan önce", gorselId: "mdy_demo_kimyasal.png", asgariSure: 12, metin:
      "Etiketi olmayan hiçbir kaptan bir şey kullanma; kokusunu almaya çalışma.\nPiktogramı tanı, Güvenlik Bilgi Formunu (GBF/MSDS) oku.\n\n" +
      "Kimyasalı ASLA içecek şişesine aktarma. Sahada en sık yapılan ve en çok can alan hata budur." },
    { tip: "adim", baslik: "Kimyasal cilde ya da göze sıçradıysa", asgariSure: 14, metin:
      "Bulaşan giysiyi hemen çıkar.\nEn yakın göz duşuna / vücut duşuna git, en az 15 dakika bol suyla yıka.\n" +
      "Yıkarken birinden amiri ve ilk yardımcıyı çağırmasını iste.\nKimyasalın etiketini ya da adını yanına aldır — revirde ilk sorulacak şey odur.\n" +
      "\"Geçti\" deyip işe dönme; kayıt açılmadan alandan ayrılma." },
    { tip: "video", baslik: "Tahliye: alarmdan toplanma alanına", videoId: TAHLIYE, asgariSure: 0,
      metin: "Video kendiliğinden başlar ve bitmeden ileri geçemezsin." },
    { tip: "adim", baslik: "Yangın alarmı çaldığında", asgariSure: 12, metin:
      "Makineni güvenli konumda durdur, enerjisini kes.\nEşyanı bırak; asansör kullanma.\n" +
      "En yakın acil çıkıştan yürüyerek çık — koşma, itme.\nToplanma alanında ekibinle dur, sayıma katıl.\n" +
      "\"Tahliye bitti\" anonsu yapılmadan binaya dönme." },
    { tip: "kural", baslik: "Ramak kala: kimse yaralanmadıysa da bildir", asgariSure: 10, metin:
      "Ramak kala, kıl payı atlatılmış kazadır: düşmeyen yük, kaymadığın yağ lekesi, basıldığında durdurmayan acil stop.\n\n" +
      "Bildirim kimseyi suçlamak için değil, aynı olayın ikinci kez ve daha kötü biçimde olmasını engellemek içindir." },
  ],
  sorular: (() => {
    const DY = ["Doğru", "Yanlış"];
    return [
      { tip: "coktanSecmeli", metin: "Koridorda karşıdan forklift geliyor. Yaya olarak doğru davranış hangisidir?",
        secenekler: ["Dur, sürücüyle göz teması kur, el işareti verirse geç", "Hızlanıp forkliftten önce geçmeye çalış", "Duvara yaslanıp sürücünün fark etmesini bekle", "Sürücüye seslenip yürümeye devam et"], dogru: [0] },
      { tip: "coktanSecmeli", metin: "Bakım için durdurulan bir makinenin LOTO kilidini kim açabilir?",
        secenekler: ["Kilidi takan kişinin kendisi", "Vardiya amiri", "Bir sonraki vardiyada makineyi kullanacak operatör", "Yedek anahtarı olan herkes"], dogru: [0] },
      { tip: "coktanSecmeli", metin: "Bir kimyasalla çalışmadan önce ilk bakılacak şey nedir?",
        secenekler: ["Kabın etiketi ve Güvenlik Bilgi Formu (GBF/MSDS)", "Maddenin rengi ve kokusu", "Yanındaki arkadaşının nasıl kullandığı", "Kabın ne kadar dolu olduğu"], dogru: [0] },
      { tip: "coktanSecmeli", metin: "Kimyasal göze sıçradı. İlk yapılacak nedir?",
        secenekler: ["Göz duşunda en az 15 dakika bol suyla yıkamak", "Gözü kuru bezle silip revire yürümek", "Göz damlası damlatıp işe devam etmek", "Vardiya bitimini bekleyip doktora gitmek"], dogru: [0] },
      { tip: "coktanSecmeli", metin: "Vardiya başı kontrolde acil stop düğmesinin kapağının kırık olduğunu gördün. Ne yaparsın?",
        secenekler: ["Makineyi çalıştırmadan amirine bildirir, arıza kaydı açtırırsın", "Kapak kozmetiktir, çalışmaya başlarsın", "Bantla yapıştırıp devam edersin", "Bir sonraki vardiyaya not bırakıp çalışırsın"], dogru: [0] },
      { tip: "dogruYanlis", metin: "Kulak koruyucunun zorunlu olduğu bir alana, iş iki dakika sürecekse kulaklıksız girilebilir.", secenekler: DY, dogru: [1] },
      { tip: "dogruYanlis", metin: "Ramak kala olayında kimse yaralanmadığı için bildirim yapmaya gerek yoktur.", secenekler: DY, dogru: [1] },
      { tip: "dogruYanlis", metin: "Enerjiyi kesmek tek başına yeterli değildir; kilit ve etiket de takılır.", secenekler: DY, dogru: [0] },
      { tip: "dogruYanlis", metin: "İş bitince kaldırılacaksa, acil çıkışın önüne kısa süreliğine palet bırakılabilir.", secenekler: DY, dogru: [1] },
      { tip: "cokluSecim", metin: "Sarı çizginin içinde HER ZAMAN zorunlu olan KKD'ler hangileridir?",
        secenekler: ["Baret", "Koruyucu gözlük", "Çelik burunlu ayakkabı", "Kaynak maskesi", "Toz maskesi"], dogru: [0, 1, 2] },
      { tip: "cokluSecim", metin: "LOTO uygulamasının adımları hangileridir?",
        secenekler: ["Enerjiyi kesmek", "Kendi kilidini takmak", "Etiket yazmak (ad, tarih, sebep)", "Çalıştırmayı deneyerek test etmek", "İş bitince kilidi ilk gelenin sökmesi"], dogru: [0, 1, 2, 3] },
      { tip: "cokluSecim", metin: "Aşağıdakilerden hangileri ramak kala olarak bildirilir?",
        secenekler: ["Zemine dökülen ve kimsenin kaymadığı yağ", "Lifleri açılmış, kopmak üzere olan sapan", "Basıldığında makineyi durdurmayan acil stop", "Vardiya sonunda yapılan rutin temizlik", "Sipariş edilen eldivenlerin depoya gelmesi"], dogru: [0, 1, 2] },
    ];
  })(),
  /* Kurallar `personel.csv`deki bölüm/hat/görev adlarına dayanır; kendi
     listenizi koyduğunuzda bunları güncelleyin. Üçüncü kuralın tarihi geçmiş:
     panoda "eksik" ile "gecikti" farkı görünsün diye. */
  kurallar: [
    { kosul: {}, sonTarih: "2026-12-31", aktif: 1 },
    { kosul: { bolum: ["Kaynak", "Presleme", "Bakım"] }, sonTarih: "2026-09-30", aktif: 1 },
    { kosul: { hat: ["Hat 1"], gorev: ["Forklift", "Sevkiyat", "Depocu"] }, sonTarih: "2026-07-31", aktif: 1 },
    /* PASİF: `iseGirisIcindeGun` son tarihi kişinin işe giriş tarihinden
       hesaplar ve iki kural birden düşerse ERKEN olan kazanır. Koşulsuz açık
       bırakılırsa 2015'te işe girmiş herkesin son tarihi 2015 olur ve pano
       baştan sona "gecikti" olur. Kural tipi görünsün diye duruyor. */
    { kosul: { iseGirisIcindeGun: 3 }, sonTarih: null, aktif: 0 },
  ],
};

/** Ziyaretçi bilgilendirmeleri: SINAVSIZ (soru havuzu boş kalmalı). */
const ZIYARETCI = [
  {
    id: ID_ZIY_GENEL,
    ad: "Ziyaretçi Genel İSG Bilgilendirmesi",
    aciklama: "Sahaya giren HER ziyaretçinin izlemesi zorunlu temel bilgilendirme. Yaklaşık 3 dakika, sınav yok.",
    varsayilan: true,
    kartlar: [
      { tip: "kural", baslik: "Hoş geldiniz", asgariSure: 8, metin:
        "Bu bilgilendirme yaklaşık 3 dakika sürer ve sınavı yoktur.\n\n" +
        "Sonunda \"Tamamla\" diyeceksiniz; o an adınız ve saat kayda geçer. Bilgilendirme bitmeden saha girişi verilmez." },
      { tip: "uyari", baslik: "Ziyaretçilerin başına gelen üç şey", asgariSure: 12, metin:
        "1. Refakatçisinden ayrılıp yanlış alana girmek\n2. Forkliftin arkasından geçmek\n3. Yağlı zeminde kaymak\n\n" +
        "Üçü de burayı bilmemekten oluyor. Bilmediğiniz için suçlanmazsınız — ama sormadığınız için sorumlusunuz." },
      { tip: "kural", baslik: "Sahada zorunlu donanım", gorselId: "mdy_ziy_kkd.png", asgariSure: 10, metin:
        "Baret, koruyucu gözlük, reflektörlü yelek ve kapalı ayakkabı. Kapıda teslim edilir, çıkışta geri verilir.\n\n" +
        "Sandalet, topuklu ayakkabı ya da şort ile üretim alanına girilmez — hiçbir istisnası yok." },
      { tip: "yapYapma", baslik: "Sahada yürürken", asgariSure: 12,
        metin: "Yaya yolunda, sarı çizginin içinde yürüyün.\nRefakatçinizin bir adım arkasında kalın.\nForklift görürseniz durun, sürücü sizi görene kadar bekleyin.",
        metinKarsi: "Refakatçinizden ayrılmayın, tek başınıza dolaşmayın.\nMakinelere, düğmelere ve vanalara dokunmayın.\nİzin almadan fotoğraf ve video çekmeyin." },
      { tip: "adim", baslik: "Bir şey ters giderse", asgariSure: 10, metin:
        "Olduğunuz yerde durun, koşmayın.\nRefakatçinize söyleyin — Türkçe bilmiyorsanız işaret edin.\n" +
        "Yaralanma varsa kimseyi yerinden oynatmayın, yardım çağırın.\nKendi başınıza müdahale etmeyin." },
      { tip: "video", baslik: "Acil durumda tahliye", videoId: TAHLIYE, asgariSure: 0, metin:
        "Video kendiliğinden başlar ve bitmeden ileri geçemezsiniz.\nToplanma alanını şimdi öğrenin; alarm çaldığında öğrenecek vaktiniz olmaz." },
      { tip: "adim", baslik: "Alarm çaldığında", asgariSure: 12, metin:
        "Bulunduğunuz işi bırakın, eşyanızı almayın.\nRefakatçinizi takip edin; yalnızsanız yeşil çıkış işaretlerini izleyin.\n" +
        "Asansör kullanmayın, yürüyün, itmeyin.\nToplanma alanında ziyaretçi olduğunuzu söyleyin — sayımda adınız ayrı okunur.\n" +
        "\"Tahliye bitti\" anonsu olmadan binaya dönmeyin." },
      { tip: "kural", baslik: "Onay", asgariSure: 10, metin: ONAY },
    ],
  },
  {
    id: ID_ZIY_YUKSEKLIK,
    ad: "Yüksekte Çalışma — Ziyaretçi ve Yüklenici Ek Bilgilendirmesi",
    aciklama: "Sahada 2 metre ve üzerinde çalışacak ziyaretçi/yüklenici için EK bilgilendirme. Kayıt ekranında soruya göre seçilir.",
    varsayilan: false,
    kartlar: [
      { tip: "kural", baslik: "Bu bilgilendirme kimin için?", asgariSure: 8, metin:
        "Sahada platform, merdiven, sepetli araç ya da çatı üstünde çalışacak yüklenici ve ziyaretçiler için.\n\n" +
        "Genel bilgilendirmenin YERİNE GEÇMEZ; onun üstüne eklenir. İkisini de izlemeden yüksekte işe başlanmaz." },
      { tip: "uyari", baslik: "Burada yükseklik 2 metrede başlar", asgariSure: 12, metin:
        "İki metre alçak görünür. Bu fabrikada kalıcı sakatlıkla biten düşmelerin çoğu üç metrenin altından oldu.\n\n" +
        "\"Bir dakikalık iş\" diye kemersiz çıkılan merdiven, en sık tekrarlanan cümledir." },
      { tip: "kural", baslik: "Kemer, ankraj, izin", gorselId: "mdy_ziy_yukseklik.png", asgariSure: 12, metin:
        "Üçü birden olmadan iş başlamaz: paraşüt tipi emniyet kemeri, size gösterilen ankraj noktası ve imzalı çalışma izni.\n\n" +
        "Ankrajı saha sorumlusu gösterir. Korkuluğa, boruya ya da gözünüze sağlam görünen bir yere kendi başınıza bağlanmayın." },
      { tip: "adim", baslik: "İşe başlamadan önce", asgariSure: 14, metin:
        "Çalışma iznini saha sorumlusuyla birlikte doldurun ve imzalatın.\nKemerin dikişlerini, tokalarını ve halatın kancasını gözle kontrol edin.\n" +
        "Düşmüş, darbe almış ya da tarihi geçmiş kemeri kullanmayın — teslim edin.\nAnkraj noktasını saha sorumlusuna gösterterek doğrulayın.\n" +
        "Altınızdaki alanı bariyerle kapatın; kimse altınızda çalışmasın.\nAletleri bağlayın; düşen bir anahtar aşağıda ölüm demektir." },
      { tip: "yapYapma", baslik: "Yukarıdayken", asgariSure: 12,
        metin: "Kemeri her an bağlı tutun, yer değiştirirken bile.\nMerdivende üç nokta temasını koruyun.\nRüzgâr ve yağmurda işi durdurup sorun.",
        metinKarsi: "Kemeri \"bir saniye\" için bile çözmeyin.\nKorkuluğa tırmanmayın, üstüne oturmayın.\nYükü elden ele değil, halatla indirip çıkarın." },
      { tip: "kural", baslik: "Onay", asgariSure: 10, metin: ONAY },
    ],
  },
];

const TUMU = [CALISAN, ...ZIYARETCI];

/* ── kurulum ──────────────────────────────────────────────────────────────── */

/* Demo eğitimleri temizle — sizin yazdıklarınıza dokunulmaz.
   Hem sabit kimliğe hem ada bakılır: eski sürümler rastgele kimlikle
   yazılmıştı, onlar da yakalansın. */
for (const e of TUMU) {
  d.prepare("DELETE FROM egitim WHERE id=? OR ad=?").run(e.id, e.ad); // sayfa/soru/kural CASCADE
}

if (SIL) {
  d.prepare("DELETE FROM ziyaretciSoru").run();
  d.prepare("DELETE FROM ayar WHERE anahtar='ziyaretciVarsayilanEgitimler'").run();
  console.log("✓ demo içerik kaldırıldı (ziyaretçi kayıtlarınız ve kendi eğitimleriniz duruyor)");
  d.close();
  process.exit(0);
}

// Görseller ve video veri klasörüne kopyalanır (ornek/ repoda, data/ değil).
let medyaSayisi = 0;
if (existsSync(join(ORNEK, "medya"))) {
  for (const ad of readdirSync(join(ORNEK, "medya"))) {
    copyFileSync(join(ORNEK, "medya", ad), join(MEDYA, ad));
    medyaSayisi++;
  }
}

const egitimEkle = d.prepare(
  `INSERT INTO egitim (id,ad,aciklama,surum,durum,hazirlayan,onaylayan,gecmeNotu,denemeHakki,soruSayisi,karisik,tekrarAy,olusturma,guncelleme)
   VALUES (@id,@ad,@aciklama,1,@durum,@hazirlayan,@onaylayan,@gecmeNotu,@denemeHakki,@soruSayisi,@karisik,@tekrarAy,@t,@t)`,
);
const sayfaEkle = d.prepare(
  `INSERT INTO sayfa (id,egitimId,sira,tip,baslik,metin,metinKarsi,gorselId,videoId,asgariSure)
   VALUES (?,?,?,?,?,?,?,?,?,?)`,
);
const soruEkle = d.prepare("INSERT INTO soru (id,egitimId,tip,metin,secenekler,dogru) VALUES (?,?,?,?,?,?)");
const kuralEkle = d.prepare("INSERT INTO kural (id,egitimId,kosul,sonTarih,aktif) VALUES (?,?,?,?,?)");

const kimlikler = new Map();

d.transaction(() => {
  for (const e of TUMU) {
    const id = e.id;
    const t = simdi();
    kimlikler.set(e.ad, id);

    egitimEkle.run({
      id, ad: e.ad, aciklama: e.aciklama, t,
      durum: e.ayar?.durum ?? "yayin",
      hazirlayan: HAZIRLAYAN, onaylayan: HAZIRLAYAN,
      gecmeNotu: e.ayar?.gecmeNotu ?? 70,
      // Ziyaretçide deneme hakkı kavramı yok; 99 pratikte sınırsız.
      denemeHakki: e.ayar?.denemeHakki ?? 99,
      soruSayisi: e.ayar?.soruSayisi ?? 0,
      karisik: e.ayar?.karisik ?? 0,
      tekrarAy: e.ayar?.tekrarAy ?? null,
    });

    e.kartlar.forEach((k, i) =>
      sayfaEkle.run(kimlik("syf"), id, i + 1, k.tip, k.baslik,
        k.metin ?? null, k.metinKarsi ?? null, k.gorselId ?? null, k.videoId ?? null, k.asgariSure),
    );
    for (const s of e.sorular ?? []) {
      soruEkle.run(kimlik("sor"), id, s.tip, s.metin, JSON.stringify(s.secenekler), JSON.stringify(s.dogru));
    }
    for (const k of e.kurallar ?? []) {
      kuralEkle.run(kimlik("krl"), id, JSON.stringify(k.kosul), k.sonTarih, k.aktif);
    }
  }

  /* Ziyaretçi kurulumu: varsayılan bilgilendirme + örnek kayıt sorusu.
     Soru → bilgilendirme eşlemesi VERİDİR; ekrandan düzenlenir. */
  const varsayilanlar = ZIYARETCI.filter((z) => z.varsayilan).map((z) => kimlikler.get(z.ad));
  d.prepare("INSERT INTO ayar (anahtar,deger) VALUES (?,?) ON CONFLICT(anahtar) DO UPDATE SET deger=excluded.deger")
    .run("ziyaretciVarsayilanEgitimler", JSON.stringify(varsayilanlar));

  const yukseklikId = kimlikler.get(ZIYARETCI[1].ad);
  d.prepare("DELETE FROM ziyaretciSoru").run();
  d.prepare("INSERT INTO ziyaretciSoru (id,sira,metin,tip,secenekler,eslesme,aktif) VALUES (?,1,?,?,?,?,1)").run(
    kimlik("zsr"),
    "Sahada yüksekte (2 metre ve üzeri) çalışma yapacak mısınız?",
    "evetHayir",
    JSON.stringify(["Evet", "Hayır"]),
    JSON.stringify({ 0: [yukseklikId], 1: [] }),
  );

  d.prepare("INSERT INTO iz (id,kim,ne,neZaman) VALUES (?,?,?,?)").run(
    kimlik("iz"), HAZIRLAYAN, `demo verisi kuruldu (${TUMU.length} eğitim, ${medyaSayisi} medya)`, simdi(),
  );
})();

/* ── personel listesi ─────────────────────────────────────────────────────── */

const personelHedef = join(VERI, "personel.csv");
let personelNot = "zaten var, dokunulmadı";
if (!existsSync(personelHedef)) {
  const kaynak = existsSync(join(ORNEK, "personel-1000.csv"))
    ? join(ORNEK, "personel-1000.csv")
    : join(ORNEK, "personel.csv");
  copyFileSync(kaynak, personelHedef);
  personelNot = `${kaynak.split(/[\\/]/).pop()} kopyalandı`;
}

console.log("✓ demo verisi kuruldu\n");
for (const e of TUMU) {
  const id = kimlikler.get(e.ad);
  const say = (t) => d.prepare(`SELECT COUNT(*) n FROM ${t} WHERE egitimId=?`).get(id).n;
  console.log(`  ${e.ad}`);
  console.log(`    ${say("sayfa")} kart · ${say("soru")} soru · ${say("kural")} atama kuralı`);
}
console.log(`\n  medya         : ${medyaSayisi} dosya → data/medya`);
console.log(`  personel.csv  : ${personelNot}`);
console.log(`  ziyaretçi     : 1 varsayılan bilgilendirme, 1 kayıt sorusu`);
console.log(`\nAyarlar → \"Personel dosyasını yeniden oku\" demeyi unutmayın.`);
d.close();
