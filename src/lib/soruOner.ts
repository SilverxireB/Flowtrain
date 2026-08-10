import { kontrolMaddeleri, karsilastirmaTablosu, satirlar, sayiVurgulari } from "./kartVeri";
import type { KartTipi, Sayfa, Soru, SoruTipi } from "./tipler";

/**
 * KARTTAN SORU ÖNERİSİ — kalıpla, yapay zekâsız.
 *
 * NEDEN VAR: hazırlayan kartları yazıyor, sonra sınav bölümüne geliyor ve
 * duruyor. Soru yazmak içerik yazmaktan farklı bir kas; ürün burada terk
 * ediliyordu. Oysa kartların çoğu sorunun cevabını ZATEN taşıyor: `adim`
 * kartındaki sıra bir sıralama sorusudur, `yapYapma` kartının karşı kolonu
 * yanlış bir ifadedir, `sayiVurgu` kartındaki sayı çoktan seçmelinin doğru
 * şıkkıdır. Kalıp bunları çıkarıyor.
 *
 * NEDEN YAPAY ZEKÂ DEĞİL: ürün kapalı ağda çalışır (internet, VPN, SSO yok).
 * Dil modeli çağıran bir öneri, ürünün var olma sebebiyle çelişirdi. Buradaki
 * her kural deterministik: aynı karttan hep aynı soru çıkar, sınavla korunur.
 *
 * ÖNERİ TASLAKTIR, KARAR HAZIRLAYANINDIR. Üretilen soru doğrudan yayına
 * girmez; editöre "öneri" olarak düşer, hazırlayan okur, düzeltir, atar.
 * `guven` alanı bunu sıralamak için: düşük güvenli öneri listede sonra gelir
 * ve "gözden geçir" damgası taşır.
 *
 * ÇELDİRİCİ UYDURULMAZ. Yanlış şıkkı kalıpla üretmek (sayıyı iki katına
 * çıkarmak gibi) yalnız SAYIDA güvenli. Metin çeldiricisi aynı eğitimin BAŞKA
 * kartlarından alınır — gerçek cümlelerdir, konuyla ilgilidir ve o kart için
 * yanlıştır. Hiçbiri bulunamazsa şık BOŞ bırakılır: uydurma bir çeldirici,
 * sınavı sorunun kendisinden değil dilinden çözülür hâle getirir.
 *
 * Sınav: `node tests/soru-oner.test.mjs`
 */

export interface Oneri {
  tip: SoruTipi;
  metin: string;
  secenekler: string[];
  dogru: number[];
  /** Hangi karttan çıktı — editörde "3. karttan" diye gösterilir. */
  kaynakSayfaId: string;
  /**
   * 1 = kart bunu doğrudan söylüyor · 2 = kalıp sağlam ama ifade elden geçmeli
   * · 3 = iskelet var, şıkları hazırlayan doldurmalı.
   */
  guven: 1 | 2 | 3;
}

/** Cümlenin sonundaki noktalama ifadeyi soru gövdesinde bozuyordu. */
function sadeCumle(s: string): string {
  return s
    .replace(/^[-•]\s*/, "")
    .replace(/^\d+[.)]\s*/, "")
    .replace(/^!!\s*/, "")
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.;:]+$/, "");
}

/** İlk anlamlı satır — başlık boşsa metinden devralınır. */
function ilkCumle(metin: string | undefined): string {
  const s = satirlar(metin)[0];
  return s ? sadeCumle(s) : "";
}

/**
 * SAYI ÇELDİRİCİLERİ — birimi koruyarak.
 *
 * "2 metre" için çeldirici "4 metre" olmalı, "4" değil: birimi düşen şık
 * gözle ayırt ediliyor ve soru okunmadan çözülüyordu.
 */
function sayiCeldiricileri(sayi: string): string[] {
  const eslesme = /^(\d+(?:[.,]\d+)?)\s*(.*)$/.exec(sayi.trim());
  if (!eslesme) return [];
  const deger = Number(eslesme[1].replace(",", "."));
  if (!Number.isFinite(deger) || deger <= 0) return [];
  const birim = eslesme[2].trim();
  const yaz = (n: number) => {
    const yuvarlak = Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ",");
    return birim ? `${yuvarlak} ${birim}` : yuvarlak;
  };
  /* Üçü de gerçekçi: yarısı, bir fazlası, iki katı. Rastgele sayı üretmek
     "hangisi mantıklı" oyununa dönüşüyordu. */
  const adaylar = [deger * 2, deger + 1, deger / 2].map(yaz);
  return [...new Set(adaylar)].filter((a) => a !== yaz(deger)).slice(0, 3);
}

/** Başka kartlardan gelen, bu kart için YANLIŞ olan gerçek cümleler. */
function baskaKartCumleleri(sayfa: Sayfa, hepsi: Sayfa[], adet: number): string[] {
  const kendi = new Set([sadeCumle(sayfa.baslik), ...satirlar(sayfa.metin).map(sadeCumle)]);
  const havuz: string[] = [];
  for (const s of hepsi) {
    if (s.id === sayfa.id) continue;
    for (const c of [s.baslik, ...satirlar(s.metin)].map(sadeCumle)) {
      if (c.length >= 8 && c.length <= 90 && !kendi.has(c) && !havuz.includes(c)) havuz.push(c);
    }
  }
  return havuz.slice(0, adet);
}

/** Şık dizisini istenen uzunluğa boş şıkla tamamlar (uydurma yapılmaz). */
function doldur(secenekler: string[], enAz: number): string[] {
  const c = [...secenekler];
  while (c.length < enAz) c.push("");
  return c;
}

type Uretici = (sayfa: Sayfa, hepsi: Sayfa[]) => Oneri[];

const URETICILER: Partial<Record<KartTipi, Uretici>> = {
  /* ADIM → SIRALAMA. Sıra kartta zaten doğru yazılı; `secenekler` doğru sırada
     saklanır, oynatıcı karıştırarak sorar (`siralamaDogruMu` kimliğe bakar). */
  adim: (sayfa) => {
    const adimlar = satirlar(sayfa.metin).map(sadeCumle).filter(Boolean);
    if (adimlar.length < 2) return [];
    return [
      {
        tip: "siralama",
        metin: `${sayfa.baslik.trim() || "Bu iş"} — adımları doğru sıraya koyun.`,
        secenekler: adimlar.slice(0, 6),
        dogru: adimlar.slice(0, 6).map((_, i) => i),
        kaynakSayfaId: sayfa.id,
        guven: 1,
      },
    ];
  },

  /* YAP/YAPMA → DOĞRU-YANLIŞ. Karşı kolon TANIMI GEREĞİ yanlış davranıştır;
     onu ifade olarak sormak kartın öğrettiği ayrımı birebir sınar. */
  yapYapma: (sayfa) => {
    const yanlis = ilkCumle(sayfa.metinKarsi);
    const dogru = ilkCumle(sayfa.metin);
    const cikti: Oneri[] = [];
    if (yanlis) {
      cikti.push({
        tip: "dogruYanlis",
        metin: yanlis,
        secenekler: ["Doğru", "Yanlış"],
        dogru: [1],
        kaynakSayfaId: sayfa.id,
        guven: 1,
      });
    }
    if (dogru && cikti.length === 0) {
      cikti.push({
        tip: "dogruYanlis",
        metin: dogru,
        secenekler: ["Doğru", "Yanlış"],
        dogru: [0],
        kaynakSayfaId: sayfa.id,
        guven: 2,
      });
    }
    return cikti;
  },

  /* SAYI VURGUSU → ÇOKTAN SEÇMELİ. Kartın tek amacı bir sayıyı akılda
     bırakmak; çeldiriciler o sayıdan türetilir, birim korunur. */
  sayiVurgu: (sayfa) => {
    const vurgular = sayiVurgulari(sayfa.metin).filter((v) => v.sayi.trim() !== "");
    if (vurgular.length === 0) return [];
    const v = vurgular[0];
    const celdiriciler = sayiCeldiricileri(v.sayi);
    if (celdiriciler.length === 0) return [];
    const etiket = v.etiket.trim() || sayfa.baslik.trim();
    return [
      {
        tip: "coktanSecmeli",
        metin: etiket ? `${etiket} — kaç?` : "Doğru değer hangisidir?",
        secenekler: [v.sayi.trim(), ...celdiriciler].slice(0, 4),
        dogru: [0],
        kaynakSayfaId: sayfa.id,
        guven: etiket ? 1 : 2,
      },
    ];
  },

  /* KONTROL LİSTESİ → ÇOKLU SEÇİM. Doğrular karttan, çeldiriciler BAŞKA
     kartlardan (gerçek cümle, bu kart için yanlış). */
  kontrolListesi: (sayfa, hepsi) => {
    const maddeler = kontrolMaddeleri(sayfa.metin).map((m) => sadeCumle(m.metin)).filter(Boolean);
    if (maddeler.length < 2) return [];
    const dogrular = maddeler.slice(0, 3);
    const celdiriciler = baskaKartCumleleri(sayfa, hepsi, 2);
    return [
      {
        tip: "cokluSecim",
        metin: `${sayfa.baslik.trim() || "Bu iş"} — hangileri kontrol edilir?`,
        secenekler: doldur([...dogrular, ...celdiriciler], dogrular.length + 1),
        dogru: dogrular.map((_, i) => i),
        kaynakSayfaId: sayfa.id,
        guven: celdiriciler.length > 0 ? 1 : 3,
      },
    ];
  },

  /* KARŞILAŞTIRMA → EŞLEŞTİRME. Tablo zaten çiftlerden oluşuyor. */
  karsilastirma: (sayfa) => {
    const tablo = karsilastirmaTablosu(sayfa.metin);
    const cift = tablo.satirlar.filter(([sol, sag]) => sol && sag).slice(0, 4);
    if (cift.length < 2) return [];
    return [
      {
        tip: "eslestirme",
        metin: `${sayfa.baslik.trim() || "Aşağıdakileri"} eşleştirin.`,
        secenekler: cift.map(([sol, sag]) => `${sadeCumle(sol)} | ${sadeCumle(sag)}`),
        dogru: cift.map((_, i) => i),
        kaynakSayfaId: sayfa.id,
        guven: 1,
      },
    ];
  },

  /* KURAL ve UYARI → DOĞRU-YANLIŞ. Kartın söylediği ifade DOĞRUdur; ayrıca
     yanlış bir varyant uydurmuyoruz (olumsuzlama çevirisi Türkçede güvenilmez
     ve "her zaman/asla" kalıbı soruyu okumadan çözdürür). */
  kural: (sayfa) => {
    const c = ilkCumle(sayfa.metin) || sadeCumle(sayfa.baslik);
    if (c.length < 12) return [];
    return [
      { tip: "dogruYanlis", metin: c, secenekler: ["Doğru", "Yanlış"], dogru: [0], kaynakSayfaId: sayfa.id, guven: 2 },
    ];
  },

  uyari: (sayfa) => {
    const c = ilkCumle(sayfa.metin) || sadeCumle(sayfa.baslik);
    if (c.length < 12) return [];
    return [
      { tip: "dogruYanlis", metin: c, secenekler: ["Doğru", "Yanlış"], dogru: [0], kaynakSayfaId: sayfa.id, guven: 2 },
    ];
  },
};

/** Aynı soruyu iki kez önermemek için sadeleştirilmiş imza. */
function imza(o: { tip: string; metin: string }): string {
  return `${o.tip}::${o.metin.toLocaleLowerCase("tr").replace(/\s+/g, " ").trim()}`;
}

/**
 * Eğitimin kartlarından soru önerir.
 *
 * ZATEN VAR OLAN SORU YENİDEN ÖNERİLMEZ: hazırlayan öneriyi bir kez alıp
 * düzenledikten sonra düğmeye tekrar bastığında aynı soruyu ikinci kez
 * eklemek, sınav havuzunu sessizce kopyalarla şişirirdi.
 */
export function sorulariOner(sayfalar: Sayfa[], mevcut: Pick<Soru, "tip" | "metin">[] = []): Oneri[] {
  const gorulen = new Set(mevcut.map(imza));
  const cikti: Oneri[] = [];

  for (const sayfa of sayfalar) {
    const uretici = URETICILER[sayfa.tip];
    if (!uretici) continue;
    for (const oneri of uretici(sayfa, sayfalar)) {
      if (!oneri.metin.trim()) continue;
      const a = imza(oneri);
      if (gorulen.has(a)) continue;
      gorulen.add(a);
      cikti.push(oneri);
    }
  }

  /* Güvene göre sırala, kart sırasını koru: hazırlayan listenin başındakileri
     olduğu gibi alabilsin, elden geçmesi gerekenler sona düşsün. */
  return cikti.sort((a, b) => a.guven - b.guven);
}
