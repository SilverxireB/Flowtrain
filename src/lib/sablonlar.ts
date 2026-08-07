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
];
