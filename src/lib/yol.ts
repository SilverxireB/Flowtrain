/**
 * ALT YOL (basePath) FARKINDA ADRES KURMA.
 *
 * NEDEN: kurum uygulamayı çoğu zaman kökte değil, var olan bir IIS/nginx
 * sitesinin ALTINDA yayına alır — `https://intranet/flowtrain`. Next'e
 * `basePath` verilince `<Link>`, `router.push` ve `_next` statikleri
 * kendiliğinden düzelir; ama KODDA ELLE YAZILMIŞ mutlak yollar düzelmez:
 *
 *   fetch("/api/medya")            → /api/medya        (404, kök arıyor)
 *   <img src={`/api/medya/${id}`}> → /api/medya/...    (görsel gelmez)
 *   <a href="/api/disa-aktar">     → /api/disa-aktar   (indirme boş)
 *
 * FlowSign'ı `/flowsign` altına alan ekip tam bu duvara çarptı ve yirmi
 * küsur yeri elle `/flowsign` yazarak yamaladı — çalışıyor ama bir sonraki
 * güncellemede yama kayboluyor. O yüzden burada önek SABİT YAZILMAZ, tek bir
 * yerden okunur.
 *
 * KÖKTE ÇALIŞIRKEN `TEMEL_YOL` boş dizedir ve `yol("/api/x")` aynen
 * `/api/x` döner — yani varsayılan kurulumda hiçbir şey değişmez.
 *
 * AYARLAMA: `FLOWTRAIN_TEMEL_YOL=/flowtrain npm run build`
 * (derleme anında gömülür; `next.config.mjs` hem `basePath`e hem de
 * `NEXT_PUBLIC_TEMEL_YOL`a aynı değeri verir.)
 *
 * Sınav: `node tests/yol.test.mjs`
 */

/** Derlemede gömülen alt yol. Kökte kurulumda boş dize. */
export const TEMEL_YOL = (process.env.NEXT_PUBLIC_TEMEL_YOL ?? "").replace(/\/+$/, "");

/**
 * Uygulama içi mutlak yolun başına alt yolu ekler.
 *
 * DIŞ ADRESLERE ve göreli yollara DOKUNMAZ: `http://…`, `data:`, `#` ve
 * `/` ile başlamayan her şey olduğu gibi döner. Bu tolerans bilinçli —
 * yardımcı, yanlış yerde çağrıldığında adresi bozmamalı.
 *
 * ÇİFT ÖNEK KORUMASI: zaten önekli bir yol ikinci kez geçerse
 * `/flowtrain/flowtrain/...` üretilmez.
 */
export function yol(adres: string): string {
  if (!TEMEL_YOL) return adres;
  if (!adres.startsWith("/") || adres.startsWith("//")) return adres;
  if (adres === TEMEL_YOL || adres.startsWith(`${TEMEL_YOL}/`)) return adres;
  return `${TEMEL_YOL}${adres}`;
}

/**
 * Medya dosyasının adresi.
 *
 * Kimlik veritabanında YOL OLARAK DEĞİL, sade kimlik olarak duruyor
 * (`mdy_x9f2.png`) ve adres her çizimde burada kuruluyor. FlowSign'ın en pahalı
 * hatası buydu: `/media/...` yolları JSON'a yazılmıştı, alt yola taşınınca
 * VERİNİN KENDİSİ yanlış kaldı ve elle düzeltmek gerekti. Kimlik saklamak,
 * dağıtım biçimini veriye sızdırmamak demek — burada öyle kalsın.
 */
export function medyaYolu(medyaId: string): string {
  return yol(`/api/medya/${medyaId}`);
}
