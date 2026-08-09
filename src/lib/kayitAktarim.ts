/**
 * GEÇMİŞ KAYIT AKTARIMI ve SINIF LİSTESİ ÇÖZÜMLEMESİ — saf mantık.
 *
 * NEDEN VAR (aktarım): canlıya geçişin şartı. Kurulumun ilk günü defter boşsa
 * pano herkesi "eksik" gösterir; fabrika ürüne bakıp "bu liste yanlış" der ve
 * bir daha açmaz. Geçen yılların tamamlamaları içeri alınmadan panonun hiçbir
 * sayısı doğru olmaz.
 *
 * NEDEN VAR (sınıf): her eğitim kioskta verilmez. Eğitmen otuz kişiye sınıfta
 * anlatır; kayıt yine aynı deftere düşmelidir.
 *
 * NEDEN SAF VE NEDEN AYRI DOSYA: burada verilen her karar bir KAYIT üretir ya
 * da bir kaydı sessizce düşürür. Sessizce düşen satır, denetimde "almadı"
 * demektir. Bu yüzden çözümleme veritabanından ayrıldı: her satırın neden
 * atlandığı sınavlanabilir olsun ve ekranda tek tek gösterilebilsin.
 *
 * Sınav önerisi: `tests/aktarim.test.mjs`
 */
import { nrm } from "./arama";

export type AktarimAlani = "sicil" | "egitim" | "tarih" | "puan" | "egitmen" | "notlar";

/**
 * SÜTUN TAKMA ADLARI — dosya bize BAŞKA bir sistemden gelir.
 *
 * Başlığı "Registry Number" olan bir dosyayı "sicil sütunu yok" diye geri
 * çevirmek, kullanıcıyı Excel'de sütun adı düzeltmeye zorlar; ikinci denemede
 * vazgeçer. Karşılaştırma `nrm` ile Türkçe duyarlı yapılır ("SİCİL", "Sicil No",
 * "sicil_no" aynı kapıya çıkar).
 */
export const SUTUN_TAKMA_ADLARI: Record<AktarimAlani, string[]> = {
  sicil: ["sicil", "sicil no", "sicil numarasi", "personel no", "personel numarasi", "registry number", "registry no", "employee id", "employee number", "badge"],
  egitim: ["egitim", "egitim adi", "egitim kodu", "ders", "ders adi", "kurs", "kurs adi", "training", "training name", "course", "course name"],
  tarih: ["tarih", "tamamlama", "tamamlama tarihi", "bitis", "bitis tarihi", "katilim tarihi", "completion date", "completed", "date"],
  puan: ["puan", "skor", "basari notu", "score", "grade"],
  egitmen: ["egitmen", "egitici", "hoca", "instructor", "trainer"],
  notlar: ["not", "notlar", "aciklama", "note", "notes", "comment", "remarks"],
};

/** Başlıklar içinde bir alanın sütununu bul: önce tam eşleşme, sonra içerme. */
export function sutunBul(basliklar: string[], takmalar: string[]): string | undefined {
  for (const b of basliklar) {
    if (takmalar.includes(nrm(b))) return b;
  }
  for (const b of basliklar) {
    const n = nrm(b);
    for (const t of takmalar) {
      if (n.includes(t)) return b;
    }
  }
  return undefined;
}

export function sutunlariEsle(basliklar: string[]): Partial<Record<AktarimAlani, string>> {
  const esleme: Partial<Record<AktarimAlani, string>> = {};
  for (const alan of Object.keys(SUTUN_TAKMA_ADLARI) as AktarimAlani[]) {
    const bulunan = sutunBul(basliklar, SUTUN_TAKMA_ADLARI[alan]);
    if (bulunan !== undefined) esleme[alan] = bulunan;
  }
  return esleme;
}

/**
 * Tarihi `YYYY-AA-GG`e indirger; çözemezse null.
 *
 * GÜN/AY SIRASI KORUNUR: dört haneli parça yılsa başta `YYYY-AA-GG`, sondaysa
 * `GG.AA.YYYY` okunur. Rakamları sıralayıp tahmin etmek 03.05 ile 05.03'ü eşit
 * sayardı — bir kişinin sertifika geçerliliğini iki ay kaydıran bir hata.
 * ABD biçimi (AA/GG/YYYY) BİLEREK desteklenmiyor: `05/03/2024` iki biçimde de
 * geçerli görünür ve hangisi olduğunu dosyaya bakarak anlamanın yolu yoktur.
 */
export function tarihiCoz(ham: string): string | null {
  const parcalar = (ham ?? "").match(/\d+/g);
  if (!parcalar || parcalar.length < 3) return null;
  const [a, b, c] = parcalar.map(Number);
  const [yil, ay, gun] = String(parcalar[0]).length === 4 ? [a, b, c] : [c, b, a];
  if (yil < 1900 || yil > 2999 || ay < 1 || ay > 12 || gun < 1 || gun > 31) return null;
  return `${yil}-${String(ay).padStart(2, "0")}-${String(gun).padStart(2, "0")}`;
}

/**
 * Tarih → kayıt damgası.
 *
 * SAAT UYDURULMAZ: geçmiş kayıtta yalnız gün bilinir. Gün ortasına rastgele bir
 * saat yazmak, süre ölçümüne ve anomali paneline gerçek olmayan bir sayı
 * sokardı. Başlangıç ve bitiş aynı damgadır; süresi "ölçülmedi" demektir.
 */
export function gunDamgasi(gun: string): string {
  return `${gun}T00:00:00.000Z`;
}

export interface AktarimEgitimi {
  id: string;
  ad: string;
  surum: number;
  durum: "taslak" | "yayin";
}

export interface AktarimBaglami {
  /** Personel kaynağındaki siciller — tanınmayan sicile kayıt yazılmaz. */
  siciller: string[];
  egitimler: AktarimEgitimi[];
  /** Defterde ZATEN olan kayıtlar: `sicil|egitimId|YYYY-AA-GG`. */
  mevcutAnahtarlar: string[];
}

export interface AktarimKaydi {
  sicil: string;
  egitimId: string;
  egitimSurum: number;
  /** ISO damga — `depo.oturumKaydet` bunu hem başlangıç hem bitiş yazar. */
  bitis: string;
  puan?: number;
  egitmen?: string;
  notlar?: string;
}

export interface AktarimSatiri {
  /** Dosyadaki satır numarası (başlık 1'dir, veri 2'den başlar). */
  satirNo: number;
  ozet: string;
  durum: "gecerli" | "atlandi";
  /** Atlanma sebebi — ekranda satır satır gösterilir, sessizce düşen yok. */
  sebep?: string;
  /** Kayıt yazılır ama dikkat çeker (yayında olmayan eğitim gibi). */
  uyari?: string;
  kayit?: AktarimKaydi;
}

export interface AktarimRaporu {
  satirlar: AktarimSatiri[];
  gecerli: number;
  atlanan: number;
  uyarili: number;
  sutunlar: Partial<Record<AktarimAlani, string>>;
  /** Dosyada bulunamayan ZORUNLU sütunlar. Doluysa hiçbir satır okunamaz. */
  eksikSutunlar: AktarimAlani[];
}

/** Boş rapor — ekran "henüz denetlenmedi" durumunu ayırt edebilsin diye. */
export function bosRapor(): AktarimRaporu {
  return { satirlar: [], gecerli: 0, atlanan: 0, uyarili: 0, sutunlar: {}, eksikSutunlar: [] };
}

function anahtar(sicil: string, egitimId: string, gun: string): string {
  return `${sicil}|${egitimId}|${gun}`;
}

function raporToparla(satirlar: AktarimSatiri[], sutunlar: Partial<Record<AktarimAlani, string>>, eksikSutunlar: AktarimAlani[]): AktarimRaporu {
  return {
    satirlar,
    gecerli: satirlar.filter((s) => s.durum === "gecerli").length,
    atlanan: satirlar.filter((s) => s.durum === "atlandi").length,
    uyarili: satirlar.filter((s) => !!s.uyari).length,
    sutunlar,
    eksikSutunlar,
  };
}

/** Eğitim adı/kimliği → eğitim. Aynı ada sahip iki eğitim varsa dizi iki elemanlı olur. */
function egitimDizini(egitimler: AktarimEgitimi[]): Map<string, AktarimEgitimi[]> {
  const dizin = new Map<string, AktarimEgitimi[]>();
  for (const e of egitimler) {
    for (const k of [nrm(e.ad), nrm(e.id)]) {
      const liste = dizin.get(k) ?? [];
      liste.push(e);
      dizin.set(k, liste);
    }
  }
  return dizin;
}

/**
 * DIŞ SİSTEMDEN GELEN CSV → yazılabilir kayıtlar + atlama gerekçeleri.
 *
 * `kayitlar` `csvOku` çıktısıdır (başlıklar küçültülmüş). Hiçbir satır sessizce
 * düşmez: her satır ya `gecerli` ya `atlandi` olarak raporda yer alır.
 */
export function aktarimiCoz(kayitlar: Record<string, string>[], baglam: AktarimBaglami): AktarimRaporu {
  if (kayitlar.length === 0) return bosRapor();

  const basliklar = Object.keys(kayitlar[0]);
  const sutunlar = sutunlariEsle(basliklar);
  const eksik = (["sicil", "egitim", "tarih"] as AktarimAlani[]).filter((a) => !sutunlar[a]);
  if (eksik.length > 0) return raporToparla([], sutunlar, eksik);

  const sicilKumesi = new Set(baglam.siciller.map((s) => s.trim()));
  const dizin = egitimDizini(baglam.egitimler);
  const gorulen = new Set(baglam.mevcutAnahtarlar);

  const satirlar: AktarimSatiri[] = [];
  for (let i = 0; i < kayitlar.length; i++) {
    const ham = kayitlar[i];
    const satirNo = i + 2; // başlık satırı 1
    const sicil = (ham[sutunlar.sicil!] ?? "").trim();
    const egitimAdi = (ham[sutunlar.egitim!] ?? "").trim();
    const tarihHam = (ham[sutunlar.tarih!] ?? "").trim();
    const ozet = [sicil || "—", egitimAdi || "—", tarihHam || "—"].join(" · ");

    if (!sicil) {
      satirlar.push({ satirNo, ozet, durum: "atlandi", sebep: "Sicil boş." });
      continue;
    }
    if (!sicilKumesi.has(sicil)) {
      satirlar.push({ satirNo, ozet, durum: "atlandi", sebep: "Sicil personel listesinde yok." });
      continue;
    }

    const adaylar = dizin.get(nrm(egitimAdi)) ?? [];
    if (adaylar.length === 0) {
      satirlar.push({ satirNo, ozet, durum: "atlandi", sebep: "Eğitim adı katalogda eşleşmedi." });
      continue;
    }
    if (adaylar.length > 1) {
      satirlar.push({ satirNo, ozet, durum: "atlandi", sebep: "Aynı adda birden çok eğitim var — hangisi olduğu belirsiz." });
      continue;
    }
    const egitim = adaylar[0];

    const gun = tarihiCoz(tarihHam);
    if (!gun) {
      satirlar.push({ satirNo, ozet, durum: "atlandi", sebep: "Tarih okunamadı (GG.AA.YYYY ya da YYYY-AA-GG bekleniyor)." });
      continue;
    }

    const a = anahtar(sicil, egitim.id, gun);
    if (gorulen.has(a)) {
      satirlar.push({ satirNo, ozet, durum: "atlandi", sebep: "Bu kişi, bu eğitim ve bu tarih için kayıt zaten var." });
      continue;
    }
    gorulen.add(a);

    // Puan okunamıyorsa satır ATILMAZ: puan denetimin zorunlu alanı değil,
    // tamamlamanın kendisi zorunlu. Boş bırakılır ve uyarı düşülür.
    const puanHam = sutunlar.puan ? (ham[sutunlar.puan] ?? "").trim() : "";
    const puanSayi = puanHam ? Number(puanHam.replace(",", ".")) : NaN;
    const puan = Number.isFinite(puanSayi) ? Math.round(puanSayi) : undefined;

    const uyarilar: string[] = [];
    if (egitim.durum !== "yayin") uyarilar.push("Eğitim yayında değil (taslak).");
    if (puanHam && puan === undefined) uyarilar.push(`Puan okunamadı: "${puanHam}".`);

    satirlar.push({
      satirNo,
      ozet,
      durum: "gecerli",
      uyari: uyarilar.length > 0 ? uyarilar.join(" ") : undefined,
      kayit: {
        sicil,
        egitimId: egitim.id,
        egitimSurum: egitim.surum,
        bitis: gunDamgasi(gun),
        puan,
        egitmen: sutunlar.egitmen ? (ham[sutunlar.egitmen] ?? "").trim() || undefined : undefined,
        notlar: sutunlar.notlar ? (ham[sutunlar.notlar] ?? "").trim() || undefined : undefined,
      },
    });
  }

  return raporToparla(satirlar, sutunlar, []);
}

/**
 * SINIF KATILIM LİSTESİ → kayıtlar.
 *
 * Eğitmen listeyi çoğu zaman kâğıttan ya da bir e-postadan YAPIŞTIRIR: her
 * satırda sicil, bazen yanında ad soyad. Bu yüzden satırın ilk parçası sicil
 * sayılır, gerisi yok sayılır — kullanıcıyı listeyi temizlemeye zorlamak,
 * kaydı hiç girmemesine yol açar.
 */
export function sinifListesiniCoz(
  hamListe: string,
  egitimId: string,
  gun: string,
  egitmen: string,
  notlar: string,
  baglam: AktarimBaglami,
): AktarimRaporu {
  const egitim = baglam.egitimler.find((e) => e.id === egitimId);
  if (!egitim) {
    return raporToparla([{ satirNo: 0, ozet: "—", durum: "atlandi", sebep: "Eğitim seçilmedi." }], {}, []);
  }
  if (!tarihiCoz(gun)) {
    return raporToparla([{ satirNo: 0, ozet: "—", durum: "atlandi", sebep: "Tarih geçersiz." }], {}, []);
  }

  const sicilKumesi = new Set(baglam.siciller.map((s) => s.trim()));
  const gorulen = new Set(baglam.mevcutAnahtarlar);
  const satirlar: AktarimSatiri[] = [];
  const hamSatirlar = hamListe.split(/\r?\n/);

  for (let i = 0; i < hamSatirlar.length; i++) {
    const metin = hamSatirlar[i].trim();
    if (!metin) continue;
    const satirNo = i + 1;
    const sicil = metin.split(/[\s;,\t]+/)[0].trim();

    if (!sicilKumesi.has(sicil)) {
      satirlar.push({ satirNo, ozet: metin, durum: "atlandi", sebep: "Sicil personel listesinde yok." });
      continue;
    }
    const a = anahtar(sicil, egitim.id, gun);
    if (gorulen.has(a)) {
      satirlar.push({ satirNo, ozet: metin, durum: "atlandi", sebep: "Bu kişi için bu tarihte kayıt zaten var." });
      continue;
    }
    gorulen.add(a);

    satirlar.push({
      satirNo,
      ozet: metin,
      durum: "gecerli",
      uyari: egitim.durum !== "yayin" ? "Eğitim yayında değil (taslak)." : undefined,
      kayit: {
        sicil,
        egitimId: egitim.id,
        egitimSurum: egitim.surum,
        bitis: gunDamgasi(gun),
        egitmen: egitmen.trim() || undefined,
        notlar: notlar.trim() || undefined,
      },
    });
  }

  if (satirlar.length === 0) {
    satirlar.push({ satirNo: 0, ozet: "—", durum: "atlandi", sebep: "Katılımcı listesi boş." });
  }
  return raporToparla(satirlar, {}, []);
}
