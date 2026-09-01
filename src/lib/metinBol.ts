import type { KartTipi } from "./tipler";

/**
 * YAPIŞTIR VE BÖL — elindeki metni kart taslaklarına çevirir.
 *
 * NEDEN VAR: kimse sıfırdan başlamıyor. İSG uzmanının elinde Word'den,
 * talimattan, prosedürden kalma bir metin var ve vakti yok. Ürünün gerçek
 * vaadi "sıfırdan etkileyici eğitim yarat" değil, "elindekini sahada işe
 * yarayan eğitime çevir" — bu modül o çevirinin ilk adımı.
 *
 * KALIP İŞİ, TAHMİN DEĞİL. Bölme kuralları metnin KENDİ biçiminden okunur:
 * boş satır bölümü ayırır, kısa ve noktasız ilk satır başlıktır, numaralı
 * liste adımdır. Anlamı çözmeye çalışmaz — çalışsaydı yanıldığında hazırlayan
 * fark etmeden yanlış tipte kart yayınlardı. Şüphede kalınca en yalın tipe
 * (`kural`) düşer: yanlış tip seçmektense düz metin bırakmak yeğdir.
 *
 * SONUÇ TASLAKTIR: editöre öneri olarak düşer, hazırlayan görür ve düzeltir.
 *
 * Sınav: `node tests/metin-bol.test.mjs`
 */

export interface KartTaslagi {
  tip: KartTipi;
  baslik: string;
  metin: string;
  /** Neden bu tip seçildi — panelde tek kelimeyle gösterilir. */
  gerekce: string;
}

/** Başlık sayılmak için en fazla bu kadar karakter. */
const BASLIK_TAVANI = 70;

/**
 * Tehlike sözcükleri KÖK olarak aranır, tam sözcük olarak değil.
 *
 * TÜRKÇE TUZAĞI: `\b(yasak)\b` "yasaktır"ı BULMAZ — ek geldiği anda sözcük
 * sınırı kaybolur ve JS'in `\b`i zaten ASCII'ye göre çalışır. Türkçe eklemeli
 * bir dil olduğu için gerçek metinde sözcükler neredeyse hep ekli geçiyor
 * ("ölümle", "yaralanmaya", "riskli"). Kök başta aranır, arkasına ne gelirse
 * gelsin. Karşılaştırma da Türkçe küçültmeyle yapılır (İ/ı).
 */
const TEHLIKE_KOKLERI = ["yasak", "asla", "tehlike", "ölüm", "yaralan", "dikkat", "uyarı", "risk", "kaza"];

function tehlikeVar(metin: string): boolean {
  const k = metin.toLocaleLowerCase("tr");
  return TEHLIKE_KOKLERI.some((kok) => new RegExp(`(^|[^a-zçğıöşü])${kok}`).test(k));
}

function temizSatirlar(ham: string): string[] {
  return ham.replace(/\r\n/g, "\n").split("\n").map((s) => s.trimEnd());
}

/** `1.` `1)` `1-` `a)` gibi sıra imleri. */
function siraliMi(satir: string): boolean {
  return /^\s*(\d{1,2}[.)-]|[a-zçğıöşü][.)])\s+\S/i.test(satir);
}

/** `-` `•` `*` madde imleri. */
function maddeliMi(satir: string): boolean {
  return /^\s*[-•*]\s+\S/.test(satir);
}

function imiSil(satir: string): string {
  return satir.replace(/^\s*(\d{1,2}[.)-]|[a-zçğıöşü][.)]|[-•*])\s+/i, "").trim();
}

/**
 * Başlık mı? Kısa, cümle noktalamasıyla bitmeyen, liste imi taşımayan satır.
 * Tamamı büyük harfle yazılmışsa uzunluk aranmaz — o zaten başlıktır.
 */
function baslikMi(satir: string): boolean {
  const s = satir.trim();
  if (!s || siraliMi(s) || maddeliMi(s)) return false;
  const buyukHarfli = s.length > 3 && s === s.toLocaleUpperCase("tr") && /[A-ZÇĞİÖŞÜ]/.test(s);
  if (buyukHarfli) return true;
  if (s.length > BASLIK_TAVANI) return false;
  return !/[.!?:;]$/.test(s);
}

/** Bir bölümü tek karta çevirir. */
function bolumdenKart(satirlar: string[]): KartTaslagi | null {
  const dolu = satirlar.filter((s) => s.trim() !== "");
  if (dolu.length === 0) return null;

  let baslik = "";
  let govde = dolu;
  if (dolu.length > 1 && baslikMi(dolu[0])) {
    baslik = dolu[0].trim().replace(/[:：]$/, "");
    govde = dolu.slice(1);
  } else if (dolu.length > 1 && siraliMi(dolu[0])) {
    /* NUMARALI BAŞLIK — "1. Genel", "2. Kapsam", "3. Sorumluluklar".
       Türkçe İSG ve kalite prosedürlerinin standart başlık biçimi tam olarak
       bu, ve `baslikMi` numaralı satırı asla başlık saymadığı için başlık
       gövdeye adım olarak düşüyordu: kart "Adımlar" diye adlandırılıyor,
       kırk kartlık bir prosedür haritada "Adımlar, Adımlar, Adımlar" diye
       okunmaz hâle geliyordu. Ürünün en güçlü kapısı, en yaygın kaynak
       belgede başlıkları siliyordu.

       AYIRT EDİCİ ŞEY ALT SATIRLAR: gerçek bir listede onlar da numaralıdır
       ("1. Vanayı kapatın / 2. Basıncı boşaltın"). Altında numaralı satır
       yoksa bu bir liste maddesi değil, bölüm başlığıdır. */
    const kalan = dolu.slice(1);
    const numarasiz = imiSil(dolu[0]);
    if (kalan.every((s) => !siraliMi(s)) && baslikMi(numarasiz)) {
      baslik = numarasiz.replace(/[:：]$/, "");
      govde = kalan;
    }
  }

  const sirali = govde.filter(siraliMi).length;
  const maddeli = govde.filter(maddeliMi).length;

  /* ADIM: satırların ÇOĞU numaralıysa. Tek numaralı satır bir listeyi değil,
     cümle içinde geçen bir sayıyı gösteriyor olabilir. */
  if (govde.length >= 2 && sirali >= Math.ceil(govde.length / 2)) {
    return {
      tip: "adim",
      baslik: baslik || "Adımlar",
      metin: govde.map(imiSil).join("\n"),
      gerekce: "numaralı liste",
    };
  }

  if (govde.length >= 2 && maddeli >= Math.ceil(govde.length / 2)) {
    return {
      tip: "kontrolListesi",
      baslik: baslik || "Kontrol listesi",
      metin: govde.map(imiSil).join("\n"),
      gerekce: "madde listesi",
    };
  }

  const tumu = [baslik, ...govde].join(" ");
  if (tehlikeVar(tumu)) {
    return {
      tip: "uyari",
      baslik: baslik || kisalt(govde[0]),
      metin: govde.join("\n"),
      gerekce: "tehlike sözcüğü",
    };
  }

  return {
    tip: "kural",
    baslik: baslik || kisalt(govde[0]),
    metin: baslik ? govde.join("\n") : govde.slice(1).join("\n"),
    gerekce: "düz metin",
  };
}

/** Başlıksız bölümde ilk cümleden başlık türetilir. */
function kisalt(satir: string): string {
  const s = (satir ?? "").trim();
  if (s.length <= BASLIK_TAVANI) return s.replace(/[.!?]$/, "");
  const kesme = s.slice(0, BASLIK_TAVANI);
  const bosluk = kesme.lastIndexOf(" ");
  return (bosluk > 20 ? kesme.slice(0, bosluk) : kesme) + "…";
}

/**
 * Metni kart taslaklarına böler.
 *
 * BOŞ SATIR BÖLER. Word'den yapıştırılan metinde paragraf ayrımı budur ve
 * hazırlayanın zaten bildiği tek kuraldır — "başlıkları ## ile işaretle" gibi
 * bir söz dizimi öğretmek, yapıştırmayı yazmaktan yavaş yapardı.
 *
 * BOŞ SATIR HİÇ YOKSA: her satır kendi kartı olurdu ve elli satırlık bir
 * talimat elli kart üretirdi. O durumda başlık gibi duran satırlar bölme
 * noktası sayılır.
 */
export function metniKartlaraBol(ham: string): KartTaslagi[] {
  const satirlar = temizSatirlar(ham);
  if (satirlar.every((s) => s.trim() === "")) return [];

  const bosSatirVar = satirlar.some((s, i) => s.trim() === "" && i > 0 && i < satirlar.length - 1);
  const bolumler: string[][] = [];
  let su: string[] = [];

  for (const satir of satirlar) {
    const bos = satir.trim() === "";

    if (bosSatirVar) {
      if (bos) {
        if (su.length) bolumler.push(su);
        su = [];
      } else su.push(satir);
      continue;
    }

    /* Boş satırsız metin: başlık gibi duran satır YENİ bölüm başlatır — ama
       yalnız elimizde zaten gövde varsa (arka arkaya iki başlık tek karttır). */
    if (bos) continue;
    if (baslikMi(satir) && su.length > 1) {
      bolumler.push(su);
      su = [satir];
    } else su.push(satir);
  }
  if (su.length) bolumler.push(su);

  const kartlar: KartTaslagi[] = [];
  for (const b of bolumler) {
    const k = bolumdenKart(b);
    if (k && (k.baslik.trim() || k.metin.trim())) kartlar.push(k);
  }
  return kartlar;
}
