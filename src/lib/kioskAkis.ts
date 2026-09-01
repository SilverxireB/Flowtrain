/**
 * KİOSK AKIŞ KARARLARI — saf (yan etkisiz), sunucu ve tarayıcı bağımlılığı yok.
 *
 * NEDEN AYRI DOSYA: kiosk'un "kaç dokunuşta biter" sorusu bir teslim ölçütü
 * (`docs/YOLHARITASI.md` — hiçbir akış 3 dokunuştan uzun değildir). Bu kararı
 * bir React bileşeninin içine gömmek, sınavla korunamaz hâle getirirdi.
 *
 * DOKUNUŞ SAYIMI (içerik ilerletme HARİÇ — o akış değil, okuma):
 *   listeyle : Devam → Başla → Onayla ve bitir → (sonuç kendi kapanır) = 3
 *   QR ile   : Devam → Onayla ve bitir                                  = 2
 * Sonuç ekranındaki "Bitir" dördüncü dokunuştu; geri sayımla kaldırıldı.
 *
 * Sınav: `node tests/oynatici.test.mjs`
 */

/** Sonuç ekranı kioskta kaç saniye sonra kendiliğinden kapanır. */
export const KIOSK_SONUC_OTO_SN = 20;

/**
 * QR bağlantısındaki eğitim parametresi.
 *
 * SÖZLEŞME (Hat B ile): QR'ın içeriği `/kiosk?egitim=<egitimId>`. Aynı ad iki
 * kez gönderilirse Next dizi verir — İLKİ alınır; kim olduğunu bilmediğimiz
 * bir ikinci değeri kabul etmek, asılı QR'ın anlamını belirsizleştirirdi.
 */
export function qrEgitimId(param: string | string[] | undefined | null): string | null {
  const ham = Array.isArray(param) ? param[0] : param;
  if (typeof ham !== "string") return null;
  const temiz = ham.trim();
  return temiz === "" ? null : temiz;
}

/**
 * Sicil okutulduktan sonra ekranda ne olacak.
 *
 * `atanmamis`: QR istasyonun başında asılı ve işçi okuttu ama o eğitim ona
 * atanmamış. Kapıyı sessizce kapatmak yerine NAZİK bir açıklama veriyoruz ve
 * kişinin GERÇEK bekleyenlerini yine gösteriyoruz — boşuna gelmiş olmasın.
 */
export type KioskAcilis =
  | { tip: "liste" }
  | { tip: "basla"; egitimId: string }
  | { tip: "atanmamis"; egitimId: string };

export function kioskAcilisi(istenenEgitimId: string | null, bekleyenEgitimIdleri: string[]): KioskAcilis {
  if (!istenenEgitimId) return { tip: "liste" };
  if (bekleyenEgitimIdleri.includes(istenenEgitimId)) return { tip: "basla", egitimId: istenenEgitimId };
  return { tip: "atanmamis", egitimId: istenenEgitimId };
}

/** Sınav sonrası gösterilecek öğretme kutusu — bir soru, bir açıklama. */
export interface YanlisAciklama {
  soruId: string;
  metin: string;
  aciklama?: string;
}

/**
 * Yanlış cevaplanan soruların açıklamalarını çıkarır.
 *
 * NEDEN DOĞRU CEVAP GÖNDERİLMİYOR: burada dönen şey "hangi şık doğruydu"
 * değil, hazırlayanın yazdığı AÇIKLAMA. Cevap anahtarı istemciye hiç inmez
 * (`kiosk/eylemler.ts`); kişi yalnız kendi yanlışını ve o yanlışın neden
 * yanlış olduğunu görür. Sınav bir ceza değil, öğretme anıdır — ama bu an
 * cevap verildikten SONRA gelir, önce değil.
 *
 * Sırası soruların sorulma sırasıdır: kişi ekranda gördüğü akışı hatırlar.
 */
export function yanlisAciklamalari(
  sorular: { id: string; metin: string; aciklama?: string }[],
  yanlisSoruIdleri: string[],
): YanlisAciklama[] {
  const yanlis = new Set(yanlisSoruIdleri);
  const cikti: YanlisAciklama[] = [];
  for (const s of sorular) {
    if (!yanlis.has(s.id)) continue;
    cikti.push({ soruId: s.id, metin: s.metin, aciklama: s.aciklama });
  }
  return cikti;
}

/* ── sahtecilik kapıları — SAF KARAR, ÇİZİM DEĞİL ─────────────────────────
   Bu iki karar `EgitimOyun.tsx` içinde satır içi ifadelerdi ve
   `tests/guvenlik.test.mjs` onları KAYNAK METNİ ARAYARAK ölçüyordu: değişken
   adını değiştirmek — davranışı zerre değiştirmeden — sınavı düşürüyordu.
   Tersi çok daha kötüydü: ifadeyi bozup adları koruyan bir değişiklik
   sınavdan GEÇERDİ. Yani sınav, ölçtüğünü sandığı şeyi ölçmüyordu.

   Kararlar buraya alındı; artık davranışın kendisi ölçülüyor. Kapıların
   NEDEN var olduğu `EgitimOyun.tsx`teki çağrı yerlerinde yazılı. */

export type OyunAsamasi = "icerik" | "sinav" | "imza" | "sonuc";

/**
 * İçerik bittiğinde hangi aşama açılır?
 *
 * İMZA ASLA SINAVIN ÖNÜNE GEÇMEZ. Sıra içerik → sınav → imza; imza ekranı
 * sınavdan önce açılsaydı kişi cevaplarını görmeden değil, GÖRDÜKTEN sonra
 * imzalamış sayılırdı ve imzanın anlamı kalmazdı.
 *
 * Provada soru yoksa `sonuc`a gidilir: prova kayıt üretmez, imzalanacak bir
 * şey yoktur. Gerçek oturumda soru yoksa `imza`ya gidilir — ziyaretçi
 * bilgilendirmesi tam olarak budur ("okudum, onaylıyorum").
 */
export function sonrakiAsama(sinavSoruSayisi: number, prova: boolean): OyunAsamasi {
  if (sinavSoruSayisi > 0) return "sinav";
  return prova ? "sonuc" : "imza";
}

/**
 * "İleri" açık mı?
 *
 * İki kapı birden: asgari süre dolmadan ve karttaki video bitmeden ilerlenmez.
 * PROVADA KAPI YOK — yazan kişi eğitimi almıyor, düzeni kontrol ediyor ve
 * provada hiçbir kayıt düşmüyor, yani kapının koruduğu bir şey yok.
 */
export function ileriAcikMi(durum: { prova: boolean; kalanSaniye: number; videoBekliyor: boolean }): boolean {
  if (durum.prova) return true;
  return durum.kalanSaniye <= 0 && !durum.videoBekliyor;
}
