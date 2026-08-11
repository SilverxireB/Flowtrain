// FlowTrain veri modeli.
//
// KURAL: bu dosya kimlik kaynağını (CSV / OPM / manuel) ve kayıt hedefini
// TANIMAZ. Personel `Kisi` olarak gelir, tamamlama `Oturum` olarak çıkar;
// ikisinin nereden gelip nereye gittiği adaptörlerin işidir.

export type KartTipi =
  | 'kural'
  | 'yapYapma'
  | 'adim'
  | 'uyari'
  | 'video'
  | 'kontrolListesi'
  | 'karsilastirma'
  | 'vaka'
  | 'onceSonra'
  | 'sayiVurgu'

/**
 * Soru tipleri.
 *
 * DÖRT YENİ TİP DE ŞIKLARDAN SEÇİLİR, hiçbirinde yazı yazılmaz. Kiosk eldivenle
 * kullanılıyor: klavyeyle boşluk doldurtmak, en çok öğreten soruyu en az
 * cevaplanan soru yapardı. `bosluk` bu yüzden "cümleyi tamamlayan şıkkı seç"
 * biçiminde çalışır.
 */
export type SoruTipi =
  | 'coktanSecmeli'
  | 'dogruYanlis'
  | 'cokluSecim'
  | 'bosluk'
  | 'siralama'
  | 'eslestirme'
  | 'gorselIsaret'

/**
 * TEK KAYNAK: editördeki düğmeler, kiosk'taki çizim ve rehberdeki referans
 * tablosu hep buradan türer. Yeni bir kart tipi eklenince üçü birden güncellenir
 * — rehber elle bakılmaz, kendiliğinden doğru kalır.
 */
export const KART_ETIKET: Record<KartTipi, string> = {
  kural: 'Kural kartı',
  yapYapma: 'Yap / Yapma',
  adim: 'Adım adım',
  uyari: 'Tehlike uyarısı',
  video: 'Video',
  kontrolListesi: 'Kontrol listesi',
  karsilastirma: 'Karşılaştırma tablosu',
  vaka: 'Vaka / olay',
  onceSonra: 'Önce — sonra',
  sayiVurgu: 'Sayı vurgusu',
}

export const KART_ACIKLAMA: Record<KartTipi, string> = {
  kural: 'Tek cümlelik kural + isteğe bağlı görsel.',
  yapYapma: 'İki kolon: doğru davranış yeşil, yanlış davranış kırmızı.',
  adim: 'Numaralı adımlar — her satır bir adım.',
  uyari: 'Sabit kırmızı düzen. YALNIZ gerçek tehlike için; her sayfa kırmızıysa kırmızı hiçbir şey anlatmaz.',
  video: 'Yerel diskteki video. İlk izlemede ileri sarılamaz.',
  kontrolListesi: 'İşaretlenecek maddeler — vardiya başı kontrolleri gibi. Her satır bir madde.',
  karsilastirma: 'İki kolonlu tablo. İlk satır sütun başlıklarıdır: `Doğru | Yanlış`.',
  vaka: 'Gerçek bir olay ve ondan çıkan ders. Kural anlatmak yerine kuralın NEDEN var olduğunu gösterir.',
  onceSonra: 'İki görsel yan yana: bozuk hâli ve düzeltilmiş hâli.',
  sayiVurgu: 'Büyük rakamlar. `3 sn | düşme süresi` gibi; her satır bir rakam.',
}

export const SORU_ETIKET: Record<SoruTipi, string> = {
  coktanSecmeli: 'Çoktan seçmeli',
  dogruYanlis: 'Doğru / Yanlış',
  cokluSecim: 'Çoklu seçim',
  bosluk: 'Boşluk doldurma',
  siralama: 'Sıralama',
  eslestirme: 'Eşleştirme',
  gorselIsaret: 'Görselde işaretleme',
}

export const SORU_ACIKLAMA: Record<SoruTipi, string> = {
  coktanSecmeli: 'Tek doğru şık.',
  dogruYanlis: 'İki şık, biri doğru.',
  cokluSecim: 'Birden çok doğru. Eksik işaretleme yarım puan almaz.',
  bosluk: 'Cümlede `___` bırakın; kişi boşluğu dolduran şıkkı seçer.',
  siralama: 'Şıkları DOĞRU sırada yazın; kişiye karışık gösterilir ve sıralaması istenir.',
  eslestirme: 'Her satır bir çift: `sol | sağ`. Kişi solu sağla eşler.',
  gorselIsaret: 'Görsel üzerinde bölgeler tanımlanır; kişi tehlikeli olanı işaretler.',
}

export type EgitimDurumu = 'taslak' | 'yayin'

/** `iptal`: yarıda kesilmiş oturum (ör. PIN kilidi) — geçme/kalma sayılmaz. */
export type Sonuc = 'gecti' | 'kaldi' | 'iptal'

/** Sınav varsayılanları — hazırlayan hiçbirine dokunmadan yayınlayabilmeli. */
export const SINAV_VARSAYILAN = {
  gecmeNotu: 70,
  denemeHakki: 2,
  soruSayisi: 5,
  karisik: true,
} as const

/** Bir kartın en az ne kadar ekranda kalması gerektiği (saniye). */
export const ASGARI_SURE_VARSAYILAN: Record<KartTipi, number> = {
  kural: 8,
  yapYapma: 12,
  adim: 10,
  uyari: 8,
  video: 0, // videoda süreyi videonun kendisi belirler
  kontrolListesi: 12,
  karsilastirma: 14, // iki kolonu karşılaştırmak okumaktan yavaştır
  vaka: 16, // anlatı; acele okunursa dersi geçer
  onceSonra: 10,
  sayiVurgu: 6, // rakam bir bakışta okunur
}

export interface Egitim {
  id: string
  ad: string
  aciklama?: string
  surum: number
  durum: EgitimDurumu
  hazirlayan: string
  onaylayan?: string
  gecmeNotu: number
  denemeHakki: number
  soruSayisi: number
  karisik: boolean
  /** Tekrar gerekiyorsa kaç ay sonra (sertifika geçerliliği). */
  tekrarAy?: number
  /** Katalog süzgeci — serbest metin, fabrika kendi listesini kurar. */
  kategori: string
  /** Yasal zorunluluk mu? Denetim raporu bunu ayrı sayar. */
  zorunlu: boolean
  /** Planlanan süre (dakika) — sınıf kaydında ve katalogda gösterilir. */
  sureDk?: number
  /** Sınıf eğitiminde varsayılan eğitmen adı. */
  egitmen?: string
  olusturma: string
  guncelleme: string
}

/**
 * EĞİTİM PAKETİ — atama kuralı tek eğitime değil pakete de yazılabilir.
 * Pakete sonradan eklenen eğitim kural yeniden yazılmadan kapsanır.
 */
export interface Grup {
  id: string
  ad: string
  aciklama?: string
  olusturma: string
  /** Sıralı üye eğitim kimlikleri. */
  egitimIdleri: string[]
}

export interface Medya {
  id: string
  ad: string
  tip: string
  boyut: number
  yukleyen: string
  olusturma: string
  /**
   * Görselin NE GÖSTERDİĞİ — ekran okuyucuya okunan metin.
   *
   * Kart görseli çoğu zaman süs değil KURALIN KENDİSİDİR (doğru kaldırma
   * duruşu, doğru KKD, doğru istifleme). Dosya adı ("IMG_2841.jpg") bunu
   * söylemez; kart başlığı da görselin kendisini değil bağlamı anlatır.
   */
  altMetin?: string
  /**
   * Kütüphane seçicisinde GÖRÜNMEZ ama kaydı vardır.
   *
   * PDF/PPTX'ten gelen sayfa görselleri buraya düşer: kırk sayfalık bir sunum
   * kütüphaneyi çöple doldururdu. Ama satırın hiç olmaması iki şeyi sessizce
   * bozuyordu — `oksuzMedyalar()` onları göremediği için kartı silinen sayfa
   * diskte sonsuza kadar kalıyordu, ve alt metin yazımı (bir UPDATE) hiçbir
   * satır bulamayıp kayboluyordu. Kayıt var, yalnız listede görünmüyor.
   */
  kutuphaneDisi: boolean
}

export interface Sayfa {
  id: string
  egitimId: string
  sira: number
  tip: KartTipi
  baslik: string
  metin?: string
  /** yapYapma kartında sağ kolon; diğerlerinde kullanılmaz. */
  metinKarsi?: string
  gorselId?: string
  /** Birden çok görsel. Tekil `gorselId` ilk görsel olarak korunur. */
  gorselIdler: string[]
  videoId?: string
  asgariSure: number
}

export interface Soru {
  id: string
  egitimId: string
  tip: SoruTipi
  metin: string
  secenekler: string[]
  /** Doğru seçeneklerin indeksleri. dogruYanlis'ta tek eleman. */
  dogru: number[]
  gorselId?: string
  /** Yanlış cevaplayana gösterilir — sınav öğretmenin yerine geçer. */
  aciklama?: string
}

/** Atama kişi kişi değil KURAL olarak yazılır; yeni personel kendiliğinden kapsanır. */
export interface Kural {
  id: string
  /** Tek eğitime yazılan kural. `grupId` doluysa boş olabilir. */
  egitimId: string
  /** Pakete yazılan kural — paketin tüm üyeleri kapsanır. */
  grupId?: string
  kosul: {
    bolum?: string[]
    hat?: string[]
    gorev?: string[]
    /**
     * KİŞİYE ÖZEL ATAMA — adı geçen siciller.
     *
     * Kural motoru "kişi kişi atama yapma" diyor ve haklı: listeye sonradan
     * düşen personeli kural kendiliğinden kapsar. Ama bir İSTİSNA sınıfı var
     * ve o politika değil, olay: ramak kala yaşayan kişiye tekrar eğitimi,
     * yeni göreve geçene ek eğitim, bir kişinin eksiği. Bunlar bölüm/hat/görev
     * ile ifade edilemez çünkü kişiye özgüdür.
     *
     * AYRI BİR ATAMA YOLU AÇILMADI, koşula bir boyut eklendi: son tarih,
     * kiosk, pano, tamamlama kaydı ve denetim izi olduğu gibi çalışıyor. En
     * önemlisi atama GÖRÜNÜR kalıyor — "bu kişi bu eğitimi neden aldı"nın
     * cevabı kurallar listesinde duruyor, kimsenin hatırlamasına kalmıyor.
     *
     * Verildiğinde diğer boyutlar gibi VE ile bağlanır; tek başına
     * kullanıldığında (olağan hâli) yalnız o kişileri kapsar.
     */
    sicil?: string[]
    /** İşe girişinden itibaren ilk N gün içinde tamamlanmalı. */
    iseGirisIcindeGun?: number
  }
  sonTarih?: string
  aktif: boolean
}

/**
 * Bir kişinin bir eğitimi tamamlama denemesi.
 * `gozeten` doluysa oturum amir tabletinde, gözetim altında yapılmıştır —
 * kâğıt imzadan daha güçlü bir denetim kaydıdır.
 */
export interface Oturum {
  id: string
  egitimId: string
  egitimSurum: number
  sicil: string
  gozeten?: string
  cihaz: string
  baslangic: string
  bitis?: string
  /** sayfaId -> ekranda kalınan saniye. İçerik geri bildirimi için. */
  sayfaSureleri: Record<string, number>
  /** Bu oturumda sorulan soruların kimlikleri (açılışta sabitlenir). */
  sorulanSoruIdleri: string[]
  puan?: number
  sonuc?: Sonuc
  senkron: 'bekliyor' | 'gonderildi' | 'hata'
  /** Kaydın nereden doğduğu — rapor süzgeci `cihaz` serbest metnine güvenemez. */
  kaynak: OturumKaynagi
  /** Sınıf eğitiminde dersi veren. */
  egitmen?: string
  notlar?: string
}

/**
 * `sinif`: eğitmen anlattı, katılım listesi girildi (ekranda kart dönmedi).
 * `aktarim`: başka bir sistemden taşınan geçmiş kayıt — canlıya geçerken
 * herkesin "eksik" görünmemesi için şart.
 */
export type OturumKaynagi = 'kiosk' | 'amir' | 'sinif' | 'aktarim'

export const KAYNAK_ETIKET: Record<OturumKaynagi, string> = {
  kiosk: 'Kiosk',
  amir: 'Amir gözetiminde',
  sinif: 'Sınıf eğitimi',
  aktarim: 'Dış aktarım',
}

/** Personel adaptöründen gelir — FlowTrain bu kaydı ASLA yazmaz. */
export interface Kisi {
  sicil: string
  ad: string
  bolum?: string
  hat?: string
  gorev?: string
  amirSicil?: string
  iseGiris?: string
}

export interface Iz {
  id: string
  kim: string
  ne: string
  neZaman: string
}
