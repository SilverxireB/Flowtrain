/**
 * SÜRÜMLÜ YAYIN — saf mantık.
 *
 * Karar (`docs/SURUMLU-YAYIN.md`): taslak ile yayın AYRI İKİ NESNEDİR.
 * Düzenleme her zaman taslakta yürür; "Yayınla" o anın anlık görüntüsünü alır
 * ve saha (kiosk · ziyaretçi tableti · amir tableti) HER ZAMAN son yayınlanan
 * sürümü oynatır.
 *
 * Bu dosyada veritabanı YOKTUR. Üç karar burada yaşıyor çünkü üçü de sessizce
 * yanlış olabilir ve yanlışları ancak aylar sonra denetimde görünürdü:
 *  · hangi sürüm oynatılacak,
 *  · yeni yayının sürüm numarası ne olacak,
 *  · taslak yayından farklı mı (yayınlanmamış değişiklik var mı).
 *
 * Depo (`depo.ts`) satırları toplar, kararı BURAYA sorar. SQL'e gömülmüş bir
 * `ORDER BY surum DESC LIMIT 1` de doğru cevabı verirdi, ama o cevap
 * sınavlanamaz ve ikinci bir okuma yerinde farklı yazılırdı.
 */

import type { Egitim, EgitimDurumu, YayinSurum } from "./tipler";

/** Sürüm seçimi için gereken en az bilgi — çağıran daha zengin bir kayıt verebilir. */
export interface SurumOzeti {
  surum: number;
  yayinZamani: string;
}

/**
 * En son yayınlanan sürüm.
 *
 * Ölçüt SÜRÜM NUMARASI, zaman damgası değil: damga makinenin saatinden gelir
 * ve kapalı ağdaki bir kutuda saat geri alınabilir (ya da hiç kurulmamıştır).
 * Sürüm numarası veritabanının kendi ürettiği tek artan sayıdır. Eşitlik
 * olamaz — (egitimId, surum) tekildir — ama olursa sonra yazılan kazanır.
 */
export function sonYayin<T extends SurumOzeti>(yayinlar: readonly T[]): T | null {
  let en: T | null = null;
  for (const y of yayinlar) {
    if (!en || y.surum > en.surum) en = y;
  }
  return en;
}

/**
 * Sahada OYNATILACAK sürüm — yoksa `null` (eğitim sahaya çıkmaz).
 *
 * İki kapı var ve ikisi de gerekli:
 *  · `durum` hâlâ sahadan indirme düğmesidir ("Taslağa al"). Anlık görüntü
 *    duruyor olsa bile indirilmiş eğitim oynatılmaz.
 *  · Anlık görüntüsü olmayan eğitim oynatılamaz. Sürümlü yayından ÖNCE
 *    yayınlanmış eğitimlerin görüntüsü göçte üretilir (`db.ts`); yine de
 *    burada `null` dönmek, "yayında görünüp içeriği olmayan eğitim" hâlini
 *    sessiz bir boş ekrana değil, çağıranın ele alacağı bir duruma çevirir.
 */
export function oynanacakYayin<T extends SurumOzeti>(durum: EgitimDurumu, yayinlar: readonly T[]): T | null {
  if (durum !== "yayin") return null;
  return sonYayin(yayinlar);
}

/**
 * Yeni yayının sürüm numarası.
 *
 * `oncedenYayinlanmis` (= `egitim.onaylayan` dolu) YALNIZ göç yolu için var:
 * sürümlü yayından önce yayınlanıp sonra taslağa alınmış bir eğitimin anlık
 * görüntüsü yoktur, ama `egitim.surum` kadar kayıt o numaraya atıf yapar.
 * Aynı numarayı yeniden kullanmak, iki farklı içeriği tek sürüm numarasında
 * birleştirir ve denetimde "bu kişi neyi izledi" sorusunu geri getirir.
 *
 * Bu adımdan sonra her yayın bir anlık görüntü bırakır; ilk şık normal yol,
 * ikinci şık yalnız eski kurulumlarda bir kez çalışır.
 */
export function sonrakiSurum(
  egitimSurumu: number,
  sonYayinSurumu: number | null,
  oncedenYayinlanmis = false,
): number {
  const taban = Math.max(1, egitimSurumu);
  if (sonYayinSurumu !== null) return Math.max(taban, sonYayinSurumu) + 1;
  return oncedenYayinlanmis ? taban + 1 : taban;
}

/**
 * SAHADAKİ HÂLİYLE EĞİTİM — taslak satırının üstüne yayınlanan sürümün künyesi.
 *
 * NEDEN GEREKLİ: sahayı ilgilendiren yalnız kartlar değil. Geçme notu, deneme
 * hakkı, kaç soru sorulacağı, tekrar süresi — hepsi taslakta anında değişiyor
 * ve hepsi işçinin bugün karşılaşacağı kuralı belirliyor. Yalnız kartları
 * yayından okusaydık, hazırlayan geçme notunu 70'ten 90'a çektiği anda henüz
 * yayınlanmamış bir kural sahada uygulanmaya başlardı — işin çözmeye çalıştığı
 * sorunun aynısı, başka kılıkta.
 *
 * TASLAKTAN KALANLAR bilerek: `id` (kayıtların bağı), `durum` (sahadan indirme
 * düğmesi taslak tarafındadır), `hazirlayan`/`onaylayan` ve zaman damgaları
 * (eğitimin künyesi değil, yönetim bilgisi).
 */
export function sahayaUygula(egitim: Egitim, yayin: YayinSurum): Egitim {
  return {
    ...egitim,
    surum: yayin.surum,
    ad: yayin.ad,
    aciklama: yayin.aciklama,
    gecmeNotu: yayin.gecmeNotu,
    denemeHakki: yayin.denemeHakki,
    soruSayisi: yayin.soruSayisi,
    karisik: yayin.karisik,
    tekrarAy: yayin.tekrarAy,
    kategori: yayin.kategori,
    zorunlu: yayin.zorunlu,
    sureDk: yayin.sureDk,
    egitmen: yayin.egitmen,
  };
}

/* ── içerik imzası ─────────────────────────────────────────────────────────
   "Taslak yayından farklı mı" sorusunun cevabı. İmza KİMLİK TAŞIMAZ: anlık
   görüntü kendi satırlarında yaşıyor ve kart sırası değişmeden yeniden
   yazıldığında kimlikler farklı olabilir. Kıyaslanan şey İŞÇİNİN GÖRECEĞİ
   şeydir — sıra, metin, görsel, süre, sınav ayarları.

   Bölüm başlığı da SIRAYLA giriyor (kart kimliğiyle değil): başlık kartın
   üstünde başlar, hangi kimlikte durduğu okuyan için görünmez. */

export interface ImzaAyar {
  ad: string;
  aciklama?: string;
  gecmeNotu: number;
  denemeHakki: number;
  soruSayisi: number;
  karisik: boolean;
  tekrarAy?: number;
  kategori: string;
  zorunlu: boolean;
  sureDk?: number;
  egitmen?: string;
}

export interface ImzaSayfa {
  tip: string;
  baslik: string;
  metin?: string;
  metinKarsi?: string;
  gorselId?: string;
  gorselIdler: string[];
  videoId?: string;
  asgariSure: number;
  /** Bu kartın ÜSTÜNDE başlayan bölümün adı (varsa). */
  bolum?: string;
}

export interface ImzaSoru {
  tip: string;
  metin: string;
  secenekler: string[];
  dogru: number[];
  gorselId?: string;
  aciklama?: string;
}

export interface ImzaIcerik {
  ayarlar: ImzaAyar;
  sayfalar: ImzaSayfa[];
  sorular: ImzaSoru[];
}

/* Yardımcılar MODÜL SEVİYESİNDE — `CLAUDE.md`: parametre yakalayıp birden çok
   kez çağrılan yardımcı, küçültücü satır içine aldığında serbest değişken
   bırakıyor (`ayiriciBul` hatası). Buradakiler yalnız kendi argümanını görür
   ve doğrudan `map`e verilebilir. */

function ayarImzasi(a: ImzaAyar): unknown[] {
  return [
    a.ad,
    a.aciklama ?? "",
    a.gecmeNotu,
    a.denemeHakki,
    a.soruSayisi,
    a.karisik,
    a.tekrarAy ?? null,
    a.kategori,
    a.zorunlu,
    a.sureDk ?? null,
    a.egitmen ?? "",
  ];
}

function sayfaImzasi(s: ImzaSayfa): unknown[] {
  return [
    s.tip,
    s.baslik,
    s.metin ?? "",
    s.metinKarsi ?? "",
    s.gorselId ?? "",
    s.gorselIdler,
    s.videoId ?? "",
    s.asgariSure,
    s.bolum ?? "",
  ];
}

function soruImzasi(q: ImzaSoru): unknown[] {
  return [q.tip, q.metin, q.secenekler, q.dogru, q.gorselId ?? "", q.aciklama ?? ""];
}

/**
 * İçeriğin karşılaştırılabilir hâli.
 *
 * ÖZET (hash) DEĞİL, düz metin: kapalı ağ ürününde ek bağımlılık yok, ve
 * hiçbir yere YAZILMIYOR — yalnız bellekte iki tarafın eşitliğine bakılıyor.
 * Saklansaydı biçimi değiştiğinde eski satırlar sessizce "değişmiş" görünürdü.
 */
export function icerikImzasi(i: ImzaIcerik): string {
  return JSON.stringify([ayarImzasi(i.ayarlar), i.sayfalar.map(sayfaImzasi), i.sorular.map(soruImzasi)]);
}

/**
 * Taslakta yayınlanmamış değişiklik var mı?
 *
 * Hiç yayın yoksa CEVAP EVET: yayınlanmamış bir eğitimin tamamı yayınlanmamış
 * değişikliktir. Rozet bunu gösterir, "Yayınla" düğmesi de buna bakar —
 * değişiklik yokken yeniden yayınlamak, içeriği aynı ikinci bir sürüm üretir
 * ve sürüm numarası anlamını kaybederdi.
 */
export function yayinlanmamisDegisiklikVar(taslak: ImzaIcerik, yayin: ImzaIcerik | null): boolean {
  if (!yayin) return true;
  return icerikImzasi(taslak) !== icerikImzasi(yayin);
}
