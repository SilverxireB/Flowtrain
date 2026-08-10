/**
 * KART METNİ BİÇİMLENDİRME — küçük, kapalı bir işaretleme dili.
 *
 * NEDEN WYSIWYG DEĞİL: (1) kapalı ağ ürününe editör kütüphanesi giremez;
 * (2) HTML saklamak kioska sınırsız biçim sokar ve iki fotoğraf yan yana
 * gelince düzen dağılır; (3) düz metin dosyada okunur kalır, CSV/PDF
 * çıktısında biçim işaretleri tek satırda temizlenir, sürüm farkı
 * karşılaştırılabilir.
 *
 * NEDEN TAM MARKDOWN DEĞİL: başlık seviyeleri, bağlantı, tablo, kod bloğu
 * kioskta ya anlamsız ya zararlı. Dil, kartın taşıyabileceği kadar: vurgu,
 * madde, sıra, uyarı.
 *
 *   **kalın**          → vurgulu
 *   - madde            → madde işaretli liste
 *   1. adım            → numaralı liste
 *   !! dikkat          → uyarı satırı (kırmızı şerit)
 *   boş satır          → paragraf ayrımı
 *
 * Sınav: `node tests/bicim.test.mjs`
 */

export type ParcaTipi = "duz" | "kalin";

export interface Parca {
  tip: ParcaTipi;
  metin: string;
}

export type BlokTipi = "paragraf" | "madde" | "sirali" | "uyari";

export interface Blok {
  tip: BlokTipi;
  /** `paragraf` ve `uyari` tek satır taşır; listeler her madde için bir satır. */
  satirlar: Parca[][];
}

/**
 * Satır içi vurgu ayrıştırması.
 *
 * DÜZ DÖNGÜ, KAPANIŞ YOK. `csv.ts`teki nota bakın: parametre yakalayıp birden
 * çok kez çağrılan yardımcı, küçültücü satır içine alırken serbest değişken
 * bırakabiliyor. Bu dosya da kioskta koşuyor; aynı deseni üretmiyoruz.
 */
export function parcalariCoz(satir: string): Parca[] {
  const parcalar: Parca[] = [];
  let tampon = "";
  let kalinda = false;

  for (let i = 0; i < satir.length; i++) {
    const cift = satir[i] === "*" && satir[i + 1] === "*";
    if (!cift) {
      tampon += satir[i];
      continue;
    }
    if (tampon !== "") parcalar.push({ tip: kalinda ? "kalin" : "duz", metin: tampon });
    tampon = "";
    kalinda = !kalinda;
    i++; // ikinci yıldız
  }

  /* KAPANMAMIŞ VURGU DÜZ METİNDİR. Yazarken `**` yazıp devam eden kişi,
     cümlesinin yarısının bir anda kalınlaşmasını görmemeli; kapanınca
     kalınlaşsın. */
  if (tampon !== "") parcalar.push({ tip: kalinda ? "duz" : "duz", metin: tampon });
  return parcalar.length > 0 ? parcalar : [{ tip: "duz", metin: "" }];
}

/** Metni bloklara ayırır. Boş metin boş dizi döner (çizecek bir şey yok). */
export function bloklariCoz(metin: string | undefined): Blok[] {
  if (!metin || metin.trim() === "") return [];

  const bloklar: Blok[] = [];
  let acik: Blok | null = null;

  const kapat = () => {
    if (acik) bloklar.push(acik);
    acik = null;
  };

  for (const ham of metin.replace(/\r\n/g, "\n").split("\n")) {
    const satir = ham.trim();

    if (satir === "") {
      kapat();
      continue;
    }

    if (satir.startsWith("!!")) {
      kapat();
      bloklar.push({ tip: "uyari", satirlar: [parcalariCoz(satir.slice(2).trim())] });
      continue;
    }

    const maddeMi = satir.startsWith("- ") || satir.startsWith("• ");
    const siraliEslesme = satir.match(/^(\d+)[.)]\s+(.*)$/);

    if (maddeMi) {
      if (!acik || acik.tip !== "madde") {
        kapat();
        acik = { tip: "madde", satirlar: [] };
      }
      acik.satirlar.push(parcalariCoz(satir.slice(2).trim()));
      continue;
    }

    if (siraliEslesme) {
      if (!acik || acik.tip !== "sirali") {
        kapat();
        acik = { tip: "sirali", satirlar: [] };
      }
      acik.satirlar.push(parcalariCoz(siraliEslesme[2].trim()));
      continue;
    }

    /* Düz satırlar AYNI paragrafta birikir: kart metninde tek satır sonu
       "yeni paragraf" değil, "satır kaydır" demektir. Paragraf boş satırla
       ayrılır — yazarken beklenen davranış budur. */
    if (!acik || acik.tip !== "paragraf") {
      kapat();
      acik = { tip: "paragraf", satirlar: [] };
    }
    acik.satirlar.push(parcalariCoz(satir));
  }

  kapat();
  return bloklar;
}

/**
 * Biçim işaretlerinden arındırılmış düz metin.
 * CSV/PDF çıktısı, arama ve ekran okuyucu özeti bunu kullanır — belgede
 * `**` görmek kimseye bir şey anlatmaz.
 */
export function duzMetin(metin: string | undefined): string {
  return bloklariCoz(metin)
    .flatMap((b) => b.satirlar.map((s) => s.map((p) => p.metin).join("")))
    .join("\n");
}

/* ── biçim şeridinin saf yanı ───────────────────────────────────────────────
   Editörün şerit düğmeleri bu dosyada duruyor çünkü DİLİ yazan da okuyan da
   burası. Bileşenin içinde kalsaydı sınavlanamazdı: `.tsx` dosyaları JSX
   yüzünden sınav koşucusuna doğrudan girmiyor — ve imleç hesabı, sessizce
   bozulduğunda yalnız "yazarken tuhaf davranıyor" diye fark edilen türden. */

export type BicimIsi = "kalin" | "madde" | "sirali" | "uyari";

export interface BicimSonuc {
  metin: string;
  /** Yeni seçimin başı ve sonu — imleç doğru yere bırakılmazsa şerit yazmayı yavaşlatır. */
  basla: number;
  bitir: number;
}

/** Satır başındaki HERHANGİ bir biçim öneki — tipler arası geçişte üst üste binmesin. */
const HERHANGI_ONEK = /^(?:[-•]\s+|\d+[.)]\s+|!!\s*)/;

const HEDEF_ONEK: Record<Exclude<BicimIsi, "kalin">, RegExp> = {
  madde: /^[-•]\s+/,
  sirali: /^\d+[.)]\s+/,
  uyari: /^!!\s*/,
};

/* İkisi de MODÜL SEVİYESİNDE: `csv.ts`teki küçültücü tuzağı (parametre
   yakalayıp birden çok kez çağrılan yardımcı) burada da mümkündü. */
function onekiCikar(satir: string): string {
  return satir.replace(HERHANGI_ONEK, "");
}

function onekMetni(is: BicimIsi, sira: number): string {
  if (is === "sirali") return `${sira}. `;
  if (is === "uyari") return "!! ";
  return "- ";
}

/**
 * Saf biçim uygulaması: metin + seçim → yeni metin + yeni seçim.
 *
 * Her düğme AÇAR/KAPATIR. İkinci basışta işareti kaldırmak, "yanlışlıkla
 * bastım" durumunun tek makul karşılığı; kaldırmasaydı `****kalın****` gibi
 * kioska sızan bozuk metinler üretilirdi.
 */
export function bicimUygula(metin: string, basla: number, bitir: number, is: BicimIsi): BicimSonuc {
  if (is === "kalin") {
    const secim = metin.slice(basla, bitir);

    // Yıldızlar seçimin İÇİNDE (kullanıcı `**söz**` bloğunu seçmiş).
    if (secim.length >= 4 && secim.startsWith("**") && secim.endsWith("**")) {
      const ic = secim.slice(2, -2);
      return { metin: metin.slice(0, basla) + ic + metin.slice(bitir), basla, bitir: basla + ic.length };
    }

    // Yıldızlar seçimin DIŞINDA (kullanıcı kalın sözcüğe çift tıklamış).
    if (basla >= 2 && metin.slice(basla - 2, basla) === "**" && metin.slice(bitir, bitir + 2) === "**") {
      return {
        metin: metin.slice(0, basla - 2) + secim + metin.slice(bitir + 2),
        basla: basla - 2,
        bitir: bitir - 2,
      };
    }

    const yeni = `${metin.slice(0, basla)}**${secim}**${metin.slice(bitir)}`;
    // Seçim varsa imleç sarmalanan metnin SONUNA, yoksa yıldızların ARASINA.
    const imlec = secim === "" ? basla + 2 : bitir + 4;
    return { metin: yeni, basla: imlec, bitir: imlec };
  }

  /* Satır önekleri SEÇİMİN DEĞDİĞİ TÜM SATIRLARA uygulanır. Yalnız seçili
     karakterlere uygulamak, satırın ortasında `- ` bırakırdı. */
  const blokBas = basla === 0 ? 0 : metin.lastIndexOf("\n", basla - 1) + 1;
  const bulunan = metin.indexOf("\n", bitir);
  const blokSon = bulunan === -1 ? metin.length : bulunan;

  const bloktakiSatirlar = metin.slice(blokBas, blokSon).split("\n");
  const desen = HEDEF_ONEK[is];
  const dolu = bloktakiSatirlar.filter((s) => s.trim() !== "");
  const hepsiVar = dolu.length > 0 && dolu.every((s) => desen.test(s));

  const yeniSatirlar: string[] = [];
  let sayac = 0;
  for (const s of bloktakiSatirlar) {
    if (hepsiVar) {
      yeniSatirlar.push(onekiCikar(s));
      continue;
    }
    // Blok içindeki boş satır paragraf ayrımıdır; numaralandırmaya girmez.
    // Tek satırlık boş blok istisna: imleci boş satıra koyup listeye başlamak.
    if (s.trim() === "" && bloktakiSatirlar.length > 1) {
      yeniSatirlar.push(s);
      continue;
    }
    sayac++;
    yeniSatirlar.push(onekMetni(is, sayac) + onekiCikar(s));
  }

  const yeniBlok = yeniSatirlar.join("\n");
  const yeniMetin = metin.slice(0, blokBas) + yeniBlok + metin.slice(blokSon);
  const son = blokBas + yeniBlok.length;
  // İmleç yalnızca bir satırdaydıysa yazmaya devam edebilsin diye satır sonuna
  // bırakılır; seçim varsa değiştirilen blok seçili kalır.
  return basla === bitir
    ? { metin: yeniMetin, basla: son, bitir: son }
    : { metin: yeniMetin, basla: blokBas, bitir: son };
}
