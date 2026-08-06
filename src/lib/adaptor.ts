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
