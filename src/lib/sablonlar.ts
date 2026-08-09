import type { KartTipi } from "./tipler";

/**
 * İSKELET ŞABLONLAR — içerik DEĞİL, kalıp.
 *
 * Boş sayfa insanı dondurur; "neyi nereye yazacağım" sorusu ilk eğitimi bir
 * haftaya yayar. Şablon bu soruyu ortadan kaldırır: kartlar ve başlıklar
 * hazır gelir, hazırlayan yalnız kendi fabrikasının gerçeğini doldurur.
 *
 * BİLEREK İÇERİK YOK: yerine hazır metin koysaydık iki kötü şeyden biri olurdu
 * — ya kimse okumadan yayınlar (yanlış bilgi hatta çıkar), ya da "bunlar bizim
 * kurallarımız değil" deyip şablonu hiç kullanmaz. Yer tutucular soru sorar,
 * cevap vermez.
 */
export interface Sablon {
  id: string;
  ad: string;
  not: string;
  kartlar: { tip: KartTipi; baslik: string; metin?: string; metinKarsi?: string }[];
  sorular: { metin: string; secenekler: string[]; dogru: number[] }[];
}

export const SABLONLAR: Sablon[] = [
  {
    id: "isg",
    ad: "İş güvenliği eğitimi",
    not: "5 kart + 2 soru · kural, tehlike, yap-yapma",
    kartlar: [
      { tip: "kural", baslik: "Bu eğitim ne anlatıyor?", metin: "Tek cümleyle: kim, neyi, neden bilmeli?" },
      { tip: "uyari", baslik: "En büyük tehlike nedir?", metin: "Burada yalnız GERÇEK tuzağı yazın." },
      {
        tip: "yapYapma",
        baslik: "Doğru ve yanlış davranış",
        metin: "Yapılması gereken",
        metinKarsi: "Kesinlikle yapılmaması gereken",
      },
      { tip: "adim", baslik: "Adım adım nasıl yapılır", metin: "Birinci adım\nİkinci adım\nÜçüncü adım" },
      { tip: "kural", baslik: "Bir sorun görürsen ne yaparsın?", metin: "Kime, nasıl haber verilir?" },
    ],
    sorular: [
      { metin: "En büyük tehlike aşağıdakilerden hangisidir?", secenekler: ["", "", ""], dogru: [0] },
      { metin: "Bu kural yalnız belirli görevler için geçerlidir.", secenekler: ["Doğru", "Yanlış"], dogru: [1] },
    ],
  },
  {
    id: "makine",
    ad: "Makine kullanım talimatı",
    not: "4 kart + 1 soru · adım adım ağırlıklı",
    kartlar: [
      { tip: "kural", baslik: "Hangi makine, hangi iş?", metin: "Makinenin adı ve ne için kullanıldığı." },
      { tip: "adim", baslik: "Çalıştırma sırası", metin: "1. adım\n2. adım\n3. adım" },
      { tip: "uyari", baslik: "Bu makinede ne olursa durdurulur?", metin: "Durdurma şartı ve acil durdurma yeri." },
      { tip: "adim", baslik: "Kapatma ve temizlik", metin: "1. adım\n2. adım" },
    ],
    sorular: [{ metin: "Makine hangi durumda derhal durdurulur?", secenekler: ["", "", ""], dogru: [0] }],
  },
  {
    id: "oryantasyon",
    ad: "İşe giriş oryantasyonu",
    not: "4 kart + 1 soru · yeni personelin ilk günü",
    kartlar: [
      { tip: "kural", baslik: "Hoş geldiniz", metin: "Fabrika, vardiya düzeni ve kime bağlı çalışıldığı." },
      { tip: "kural", baslik: "Nerede ne var?", metin: "Yemekhane, soyunma odası, revir, acil çıkış." },
      { tip: "uyari", baslik: "İlk günden bilinmesi gerekenler", metin: "Sahada geçerli olan bir tane kesin kural." },
      { tip: "video", baslik: "Sahayı tanıyın", metin: "Telefonla çekilmiş kısa bir tur videosu yeterlidir." },
    ],
    sorular: [{ metin: "Acil durumda toplanma alanı neresidir?", secenekler: ["", "", ""], dogru: [0] }],
  },
  {
    id: "kkd",
    ad: "Kişisel koruyucu donanım (KKD)",
    not: "4 kart + 2 soru · hangi işte hangi KKD",
    kartlar: [
      { tip: "kural", baslik: "Bu sahada hangi KKD zorunlu?", metin: "Kapıdan girerken takılması gerekenleri sayın." },
      {
        tip: "yapYapma",
        baslik: "Doğru ve yanlış kullanım",
        metin: "Tam takılmış, sağlam, doğru beden",
        metinKarsi: "Boyna asılmış, çatlak, başkasının bedeni",
      },
      { tip: "adim", baslik: "Kullanım öncesi kontrol", metin: "Ne kontrol edilir\nHasar varsa ne yapılır\nKime haber verilir" },
      { tip: "kural", baslik: "Nereden alınır, ne zaman değişir?", metin: "Depo/dolap yeri ve değişim sıklığı." },
    ],
    sorular: [
      { metin: "Bu bölümde hangi KKD zorunludur?", secenekler: ["", "", ""], dogru: [0] },
      { metin: "Hasarlı KKD idareten kullanılabilir.", secenekler: ["Doğru", "Yanlış"], dogru: [1] },
    ],
  },
  {
    id: "yuksekte",
    ad: "Yüksekte çalışma",
    not: "5 kart + 2 soru · izin, bağlantı noktası, düşme",
    kartlar: [
      { tip: "kural", baslik: "Ne zaman 'yüksekte çalışma' sayılır?", metin: "Sahada geçerli yükseklik sınırı ve kapsam." },
      { tip: "uyari", baslik: "İzin belgesi olmadan çıkılmaz", metin: "İzni kim verir, hangi durumda verilmez?" },
      { tip: "adim", baslik: "Çıkmadan önce", metin: "Ekipman kontrolü\nBağlantı noktasının seçimi\nAlan emniyeti" },
      {
        tip: "yapYapma",
        baslik: "Emniyet kemeri kullanımı",
        metin: "İki kanca sırayla, her an bir bağlı",
        metinKarsi: "Korkuluğa, boruya, geçici bir yere bağlamak",
      },
      { tip: "kural", baslik: "Düşme olursa ne yapılır?", metin: "Askıda kalma travması ve ilk müdahale çağrısı." },
    ],
    sorular: [
      { metin: "Emniyet kemeri hangi noktaya bağlanır?", secenekler: ["", "", ""], dogru: [0] },
      { metin: "Kısa süreli işlerde izin belgesi aranmaz.", secenekler: ["Doğru", "Yanlış"], dogru: [1] },
    ],
  },
  {
    id: "loto",
    ad: "Enerji kesme ve kilitleme (LOTO)",
    not: "5 kart + 2 soru · bakım öncesi enerji yalıtımı",
    kartlar: [
      { tip: "kural", baslik: "Neden kilitliyoruz?", metin: "Beklenmedik çalışma ve artık enerji nedir?" },
      { tip: "adim", baslik: "Kilitleme sırası", metin: "Haber ver\nDurdur\nAyır\nKilitle ve etiketle\nSıfır enerjiyi doğrula" },
      { tip: "uyari", baslik: "Başkasının kilidi açılmaz", metin: "Kilidi yalnız takan kişi açar. İstisnası nasıl işler?" },
      { tip: "kural", baslik: "Etikette ne yazar?", metin: "Kim, ne zaman, hangi iş için." },
      { tip: "adim", baslik: "İşi bitirince", metin: "Alanı boşalt\nKilitleri kaldır\nEnerjiyi ver ve haber ver" },
    ],
    sorular: [
      { metin: "Kilidi kim açabilir?", secenekler: ["", "", ""], dogru: [0] },
      { metin: "Enerji ayrıldıktan sonra sıfır enerji doğrulaması yapılmalıdır.", secenekler: ["Doğru", "Yanlış"], dogru: [0] },
    ],
  },
  {
    id: "forklift",
    ad: "Saha trafiği ve forklift",
    not: "4 kart + 2 soru · yaya ile araç aynı sahada",
    kartlar: [
      { tip: "kural", baslik: "Yaya yolları nerede?", metin: "Sahada yürünebilecek ve yürünemeyecek yerler." },
      { tip: "uyari", baslik: "Forklift sizi görmeyebilir", metin: "Kör nokta, yüklü sürüşte ileri görüş, geri manevra." },
      {
        tip: "yapYapma",
        baslik: "Karşılaşma anında",
        metin: "Göz teması kur, dur, geçmesini bekle",
        metinKarsi: "Arkasından geçmek, yükün altından yürümek",
      },
      { tip: "kural", baslik: "Hız ve öncelik", metin: "Saha hız sınırı ve kavşaklarda kimin önceliği var?" },
    ],
    sorular: [
      { metin: "Forklift ile karşılaşınca ilk ne yapılır?", secenekler: ["", "", ""], dogru: [0] },
      { metin: "Kaldırılmış yükün altından hızlıca geçilebilir.", secenekler: ["Doğru", "Yanlış"], dogru: [1] },
    ],
  },
  {
    id: "kimyasal",
    ad: "Kimyasal ve güvenlik bilgi formu",
    not: "4 kart + 2 soru · etiket, GBF, dökülme",
    kartlar: [
      { tip: "kural", baslik: "Bu bölümde hangi kimyasallar var?", metin: "Adları ve ne için kullanıldıkları." },
      { tip: "kural", baslik: "Etiketi okumak", metin: "Hangi işaret neyi anlatır? Güvenlik bilgi formu nerede duruyor?" },
      { tip: "uyari", baslik: "Asla karıştırılmaz", metin: "Sahada gerçekten tehlikeli olan karışımı yazın." },
      { tip: "adim", baslik: "Dökülme olursa", metin: "Alanı boşalt\nHaber ver\nSet çek / emdir\nAtığı doğru kaba at" },
    ],
    sorular: [
      { metin: "Güvenlik bilgi formuna nereden ulaşılır?", secenekler: ["", "", ""], dogru: [0] },
      { metin: "Küçük dökülmeler haber verilmeden temizlenebilir.", secenekler: ["Doğru", "Yanlış"], dogru: [1] },
    ],
  },
  {
    id: "acil",
    ad: "Acil durum ve tahliye",
    not: "4 kart + 2 soru · alarm, çıkış, toplanma",
    kartlar: [
      { tip: "kural", baslik: "Alarmı duyduğunuzda", metin: "İşi bırakma, makineyi kapatma, çıkışa yönelme." },
      { tip: "adim", baslik: "Tahliye yolu", metin: "En yakın çıkış\nİkinci çıkış\nToplanma alanı" },
      { tip: "uyari", baslik: "Geri dönülmez", metin: "Eşya için binaya dönmek, arama ekibini de riske atar." },
      { tip: "kural", baslik: "Toplanma alanında", metin: "Sayım nasıl yapılır, eksik kişi nasıl bildirilir?" },
    ],
    sorular: [
      { metin: "Toplanma alanı neresidir?", secenekler: ["", "", ""], dogru: [0] },
      { metin: "Alarm sırasında eşya almak için geri dönülebilir.", secenekler: ["Doğru", "Yanlış"], dogru: [1] },
    ],
  },
];
