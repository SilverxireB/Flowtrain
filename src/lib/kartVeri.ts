/**
 * YENİ KART TİPLERİNİN VERİSİ — hepsi MEVCUT sütunlardan okunur.
 *
 * Beş yeni kart tipi geldi ve veritabanına tek bir sütun eklenmedi. Sebebi
 * ilke: her kart tipi kendi sütununu isteseydi şema kart tipi sayısı kadar
 * büyür, göç listesi uzar ve eski kayıtlar her sürümde yeniden yazılırdı.
 * Bunun yerine `metin` / `metinKarsi` / `gorselIdler` alanları, tipe göre
 * okunan KÜÇÜK bir satır dili taşıyor.
 *
 * Dil, hazırlayanın elle yazabileceği kadar sade tutuldu — editörde yardımcı
 * alanlar var ama dosyaya bakan biri de ne olduğunu anlar:
 *
 *   kontrolListesi  metin: her satır bir madde
 *   karsilastirma   metin: `sol | sağ`; İLK satır sütun başlıkları
 *   vaka            metin: olay · metinKarsi: çıkarılan ders
 *   onceSonra       gorselIdler[0] önce, [1] sonra · metin/metinKarsi alt yazı
 *   sayiVurgu       metin: `sayı | etiket` (ör. `3 sn | düşme süresi`)
 *
 * Sınav: `node tests/kartVeri.test.mjs`
 */

/** Boş satırları atarak satırlara böler. */
export function satirlar(metin: string | undefined): string[] {
  return (metin ?? "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s !== "");
}

/** `sol | sağ` satırını ikiye böler; ayırıcı yoksa sağ taraf boş kalır. */
function ikiyeBol(satir: string): [string, string] {
  const i = satir.indexOf("|");
  if (i === -1) return [satir.trim(), ""];
  return [satir.slice(0, i).trim(), satir.slice(i + 1).trim()];
}

export interface KontrolMaddesi {
  metin: string;
}

export function kontrolMaddeleri(metin: string | undefined): KontrolMaddesi[] {
  return satirlar(metin).map((s) => ({ metin: s.replace(/^[-•]\s*/, "") }));
}

export interface Karsilastirma {
  basliklar: [string, string];
  satirlar: [string, string][];
}

/**
 * İLK SATIR BAŞLIKTIR. Tabloyu başlıksız çizmek "hangi kolon hangisi"
 * sorusunu okuyucuya bırakırdı; iki kolonlu bir güvenlik tablosunda bu,
 * doğru ile yanlışı karıştırmak demek.
 */
export function karsilastirmaTablosu(metin: string | undefined): Karsilastirma {
  const ham = satirlar(metin);
  if (ham.length === 0) return { basliklar: ["", ""], satirlar: [] };
  const [solBaslik, sagBaslik] = ikiyeBol(ham[0]);
  return {
    basliklar: [solBaslik, sagBaslik],
    satirlar: ham.slice(1).map(ikiyeBol),
  };
}

export interface SayiVurgusu {
  sayi: string;
  etiket: string;
}

/**
 * `sayı | etiket`. Ayırıcı yoksa satırın İLK boşluğa kadarki kısmı sayı
 * sayılır — `3 saniyede düşer` gibi doğal yazımı da kabul etmek için.
 */
export function sayiVurgulari(metin: string | undefined): SayiVurgusu[] {
  return satirlar(metin).map((s) => {
    if (s.includes("|")) {
      const [sayi, etiket] = ikiyeBol(s);
      return { sayi, etiket };
    }
    const bosluk = s.indexOf(" ");
    if (bosluk === -1) return { sayi: s, etiket: "" };
    return { sayi: s.slice(0, bosluk), etiket: s.slice(bosluk + 1).trim() };
  });
}

export interface OnceSonra {
  onceId?: string;
  sonraId?: string;
  onceYazi: string;
  sonraYazi: string;
}

export function onceSonra(sayfa: {
  gorselIdler?: string[];
  gorselId?: string;
  metin?: string;
  metinKarsi?: string;
}): OnceSonra {
  // Tekil `gorselId` geriye dönük ilk görsel sayılır (kart tipi değiştirilmiş
  // olabilir; kullanıcı görselini kaybetmemeli).
  const idler = sayfa.gorselIdler?.length ? sayfa.gorselIdler : sayfa.gorselId ? [sayfa.gorselId] : [];
  return {
    onceId: idler[0],
    sonraId: idler[1],
    onceYazi: (sayfa.metin ?? "").trim(),
    sonraYazi: (sayfa.metinKarsi ?? "").trim(),
  };
}
