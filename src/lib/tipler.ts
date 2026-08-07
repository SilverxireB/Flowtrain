// FlowTrain veri modeli.
//
// KURAL: bu dosya kimlik kaynağını (CSV / OPM / manuel) ve kayıt hedefini
// TANIMAZ. Personel `Kisi` olarak gelir, tamamlama `Oturum` olarak çıkar;
// ikisinin nereden gelip nereye gittiği adaptörlerin işidir.

export type KartTipi = 'kural' | 'yapYapma' | 'adim' | 'uyari' | 'video'

export type SoruTipi = 'coktanSecmeli' | 'dogruYanlis' | 'cokluSecim'

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
}

export const KART_ACIKLAMA: Record<KartTipi, string> = {
  kural: 'Tek cümlelik kural + isteğe bağlı görsel.',
  yapYapma: 'İki kolon: doğru davranış yeşil, yanlış davranış kırmızı.',
  adim: 'Numaralı adımlar — her satır bir adım.',
  uyari: 'Sabit kırmızı düzen. YALNIZ gerçek tehlike için; her sayfa kırmızıysa kırmızı hiçbir şey anlatmaz.',
  video: 'Yerel diskteki video. İlk izlemede ileri sarılamaz.',
}

export const SORU_ETIKET: Record<SoruTipi, string> = {
  coktanSecmeli: 'Çoktan seçmeli',
  dogruYanlis: 'Doğru / Yanlış',
  cokluSecim: 'Çoklu seçim',
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
  olusturma: string
  guncelleme: string
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
}

/** Atama kişi kişi değil KURAL olarak yazılır; yeni personel kendiliğinden kapsanır. */
export interface Kural {
  id: string
  egitimId: string
  kosul: {
    bolum?: string[]
    hat?: string[]
    gorev?: string[]
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
  /** sayfaId -> ekranda kalınan saniye. Anomali tespiti buradan çıkar. */
  sayfaSureleri: Record<string, number>
  puan?: number
  sonuc?: Sonuc
  senkron: 'bekliyor' | 'gonderildi' | 'hata'
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
