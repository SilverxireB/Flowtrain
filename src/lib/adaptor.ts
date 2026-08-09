import type { Kisi, Oturum } from './tipler'

/**
 * ADAPTÖR SINIRI — ürünü satılabilir tutan yer.
 *
 * Çekirdek yalnız bu iki arayüzü bilir. Bir fabrikada personel OPM'den gelir
 * ve kayıt OPM'e döner; başka bir müşteride personel haftalık bir CSV'dir ve
 * kayıt yalnız burada durur. İkisi de aynı koddur.
 *
 * Sıra ÖNEMLİ: önce CSV uygulanır (ürünün standart sürümü odur), OPM ikinci
 * uygulama olarak gelir. Tersi yapılırsa çekirdek OPM'in veri modeline göre
 * şekillenir ve sınır kâğıt üstünde kalır.
 */

export interface PersonelKaynagi {
  ad: string
  listele(): Promise<Kisi[]>
  bul(sicil: string): Promise<Kisi | null>
  /** Bir amire bağlı kişiler — amir tabletinin ekip listesi buradan çıkar. */
  ekip(amirSicil: string): Promise<Kisi[]>
  /** Varsa önbelleği düşürür ("kaynak değişti, yeniden oku"). */
  tazele?(): void
  /**
   * Kaynak buradan YÖNETİLEBİLİYORSA (CSV dosyası gibi) bu alan doludur.
   * OPM webservice'i tek yönlü okursa `undefined` kalır ve `/personel`
   * ekranı kendini salt okunur gösterir — ekran adaptörü SORMAZ, yeteneğe bakar.
   */
  yonetim?: PersonelYonetimi

  /**
   * `/personel` listesinin tam kayıtları — maliyet merkezi dahil.
   *
   * `listele()` çekirdek tipi `Kisi`yi döner ve maliyet merkezi orada YOKTUR
   * (OPM'e özel alan çekirdeğe girmez). Ekranın o sütuna ihtiyacı var, ama
   * onu `yonetim`den okumak salt okunur kaynakta listeyi BOŞ bırakıyordu:
   * "düzenlenemez" ile "hiç kayıt yok" bambaşka şeyler. Görüntüleme ve
   * düzenleme yetenekleri bu yüzden ayrı.
   */
  kayitlar?(): Promise<PersonelKaydi[]>
}

/**
 * PERSONEL KAYNAĞININ YÖNETİLEBİLİR YÜZÜ.
 *
 * Kayıt ÜÇ ŞEYDİR: sicil, ad, maliyet merkezi — artı rol. Bölüm ve amir
 * TÜRETİLİR (maliyet merkezi eşlemesinden), elle yazılmaz: iki gerçek
 * yarışırsa her dış aktarım el emeğini ezer.
 */
export interface PersonelKaydi {
  sicil: string
  ad: string
  maliyetMerkezi: string
  /** 'Amir' ya da serbest metin; boş/tanınmayan her değer operatör sayılır. */
  gorev: string
  /** Türetilmiş — yalnız gösterilir. */
  bolum: string
  /** Türetilmiş — yalnız gösterilir. */
  amirSicil: string
  hat: string
  iseGiris: string
}

export type PersonelYama = Partial<Pick<PersonelKaydi, 'ad' | 'maliyetMerkezi' | 'gorev'>>

export interface AktarimSonucu {
  yeni: number
  guncellenen: number
  /** Eşlemesi tanımlı olmayan maliyet merkezi kodları — bölüm/amir boş kaldı. */
  eslemesizKodlar: string[]
}

export interface PersonelYonetimi {
  kayitlar(): PersonelKaydi[]
  guncelle(sicil: string, yama: PersonelYama): boolean
  /** Dış aktarım dosyası (sicil · ad · maliyet merkezi) → kaynağa birleştir. */
  iceAktar(metin: string): AktarimSonucu
  /** Maliyet merkezi eşlemesini kaynaktaki HERKESE yeniden uygular. */
  eslemeyiUygula(): { uygulanan: number; eslemesizKodlar: string[] }
}

export interface KayitHedefi {
  ad: string
  /**
   * Tamamlanan oturumu dışarıya bildirir.
   * Başarısız olursa oturum `senkron: 'hata'` ile bekler ve yeniden denenir —
   * kayıt ASLA sessizce düşmez.
   */
  gonder(oturum: Oturum): Promise<void>
}
