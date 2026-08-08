import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { BOM, ayiriciBul, csvOku, satiriBol } from "../csv";
import { mmEslemeleriGetir } from "../depo";
import { onbellegiTemizle, personelDosyaYolu } from "./csvPersonel";
import type { AktarimSonucu, PersonelKaydi, PersonelYama, PersonelYonetimi } from "../adaptor";

/**
 * CSV KAYNAĞININ YÖNETİLEBİLİR YÜZÜ — `/personel` ekranının arka yüzü.
 *
 * ADAPTÖR TARAFINDADIR ve öyle kalmalı: dosya biçimi, sütun takma adları,
 * BOM, ayırıcı — hepsi CSV'ye özgü ayrıntı. Çekirdek bunları bilmez, ekran
 * yalnız `PersonelKaynagi.yonetim` yeteneğini görür. OPM webservice adaptörü
 * geldiğinde kendi yönetimini yazar ya da hiç yazmaz; ekran ikisinde de çalışır.
 *
 * DOSYA OLDUĞU GİBİ KORUNUR: kurumun bıraktığı dosyada bizim tanımadığımız
 * sütunlar olabilir. Satır düzenlenirken dosya baştan kurulmaz, yalnız hedef
 * hücreler değişir — aksi hâlde her düzenleme kurumun sütunlarını silerdi.
 */

/* csvPersonel.ts ile AYNI takma adlar + OPM dışa aktarımının İngilizce
   başlıkları. Ayrışırlarsa ekran başka, adaptör başka kişi okur. */
const TAKMA: Record<keyof Omit<PersonelKaydi, "sicil">, string[]> = {
  ad: ["ad", "adı", "ad soyad", "adsoyad", "isim", "name and surname", "trainee"],
  bolum: ["bölüm", "bolum", "departman"],
  hat: ["hat", "line"],
  gorev: ["görev", "gorev", "unvan", "pozisyon", "rol"],
  amirSicil: ["amir", "amirsicil", "amir sicil", "amir sicili", "yönetici", "yonetici"],
  iseGiris: ["işegiriş", "isegiris", "işe giriş", "ise giris", "giriş tarihi", "giris tarihi"],
  maliyetMerkezi: ["maliyet merkezi", "maliyetmerkezi", "cost center", "costcenter", "mm"],
};
const SICIL_TAKMA = ["sicil", "sicil no", "sicilno", "personel no", "registry number"];

/** Sütun henüz yoksa bu etiketle açılır. */
const ETIKET: Record<keyof Omit<PersonelKaydi, "sicil">, string> = {
  ad: "Ad",
  bolum: "Bölüm",
  hat: "Hat",
  gorev: "Görev",
  amirSicil: "Amir",
  iseGiris: "İşe giriş",
  maliyetMerkezi: "Maliyet merkezi",
};

type Alan = keyof Omit<PersonelKaydi, "sicil">;

interface Dosya {
  ayirici: string;
  basliklar: string[];
  satirlar: string[][];
}

function dosyaOku(): Dosya {
  const yol = personelDosyaYolu();
  if (!existsSync(yol)) {
    return {
      ayirici: ";",
      basliklar: ["Sicil", "Ad", "Maliyet merkezi", "Görev", "Bölüm", "Amir", "Hat", "İşe giriş"],
      satirlar: [],
    };
  }
  const metin = readFileSync(yol, "utf8").replace(/^﻿/, "");
  const ham = metin.split(/\r?\n/).filter((s) => s.trim() !== "");
  if (ham.length === 0) return { ayirici: ";", basliklar: [], satirlar: [] };

  const ayirici = ayiriciBul(ham[0]);
  return {
    ayirici,
    basliklar: satiriBol(ham[0], ayirici),
    satirlar: ham.slice(1).map((s) => satiriBol(s, ayirici)),
  };
}

function hucreKacir(deger: string, ayirici: string): string {
  return deger.includes('"') || deger.includes(ayirici) || deger.includes("\n")
    ? `"${deger.replace(/"/g, '""')}"`
    : deger;
}

function dosyaYaz(d: Dosya): void {
  const satir = (hucreler: string[]) => hucreler.map((h) => hucreKacir(h, d.ayirici)).join(d.ayirici);
  writeFileSync(personelDosyaYolu(), BOM + [satir(d.basliklar), ...d.satirlar.map(satir)].join("\r\n") + "\r\n", "utf8");
  // Dosya değişti: adaptörün mtime önbelleği aynı milisaniyeye düşerse bayat
  // liste okunur. Elle düşürmek bunu kesin çözer.
  onbellegiTemizle();
}

function indeksBul(basliklar: string[], adaylar: string[]): number {
  const kucuk = basliklar.map((b) => b.toLocaleLowerCase("tr"));
  for (const a of adaylar) {
    const i = kucuk.indexOf(a);
    if (i !== -1) return i;
  }
  return -1;
}

/** Sütunu bul; yoksa dosyaya EKLE (mevcut satırlara boş hücre açılır). */
function indeksSagla(d: Dosya, alan: Alan): number {
  const i = indeksBul(d.basliklar, TAKMA[alan]);
  if (i !== -1) return i;
  d.basliklar.push(ETIKET[alan]);
  for (const s of d.satirlar) s.push("");
  return d.basliklar.length - 1;
}

/** Maliyet merkezi eşlemesini tek satıra uygular; kod tanımsızsa DOKUNMAZ. */
function eslemeyiSatiraUygula(d: Dosya, satir: string[], kod: string): boolean {
  const es = mmEslemeleriGetir().find((e) => e.kod === kod.trim());
  if (!es) return false;
  if (es.bolum) satir[indeksSagla(d, "bolum")] = es.bolum;
  if (es.amirSicil) satir[indeksSagla(d, "amirSicil")] = es.amirSicil;
  return true;
}

/* ── okuma ────────────────────────────────────────────────────────────────── */

function kayitlariOku(): PersonelKaydi[] {
  const d = dosyaOku();
  const iSicil = indeksBul(d.basliklar, SICIL_TAKMA);
  if (iSicil === -1) return [];

  const alanlar = Object.keys(TAKMA) as Alan[];
  const indeksler = Object.fromEntries(alanlar.map((a) => [a, indeksBul(d.basliklar, TAKMA[a])])) as Record<Alan, number>;

  const cikti: PersonelKaydi[] = [];
  for (const s of d.satirlar) {
    const sicil = (s[iSicil] ?? "").trim();
    if (!sicil) continue;
    const al = (i: number) => (i === -1 ? "" : (s[i] ?? "").trim());
    cikti.push({
      sicil,
      ad: al(indeksler.ad),
      maliyetMerkezi: al(indeksler.maliyetMerkezi),
      gorev: al(indeksler.gorev),
      bolum: al(indeksler.bolum),
      amirSicil: al(indeksler.amirSicil),
      hat: al(indeksler.hat),
      iseGiris: al(indeksler.iseGiris),
    });
  }
  return cikti;
}

/* ── düzenleme ────────────────────────────────────────────────────────────── */

function guncelle(sicil: string, yama: PersonelYama): boolean {
  const d = dosyaOku();
  const iSicil = indeksBul(d.basliklar, SICIL_TAKMA);
  if (iSicil === -1) return false;

  const satir = d.satirlar.find((s) => (s[iSicil] ?? "").trim() === sicil.trim());
  if (!satir) return false;

  for (const alan of ["ad", "maliyetMerkezi", "gorev"] as const) {
    const deger = yama[alan];
    if (deger === undefined) continue;
    satir[indeksSagla(d, alan)] = deger.trim();
  }

  // Maliyet merkezi değiştiyse bölüm/amir eşlemeden YENİDEN yazılır — ekranda
  // elle girilmezler, tek gerçek kaynak eşlemedir.
  if (yama.maliyetMerkezi !== undefined) eslemeyiSatiraUygula(d, satir, yama.maliyetMerkezi);

  dosyaYaz(d);
  return true;
}

/* ── içe aktarım ──────────────────────────────────────────────────────────── */

function ilkDolu(kayit: Record<string, string>, adaylar: string[]): string {
  for (const a of adaylar) {
    const v = kayit[a];
    if (v != null && v.trim() !== "") return v.trim();
  }
  return "";
}

/**
 * Dış aktarım dosyasını kaynakla BİRLEŞTİRİR: var olan sicil güncellenir, yeni
 * sicil eklenir, dosyada olup aktarımda olmayan kayıt SİLİNMEZ (elle eklenen
 * kişi kaybolmasın; silme kararı insanın işidir).
 */
function iceAktar(metin: string): AktarimSonucu {
  const kayitlar = csvOku(metin);
  const d = dosyaOku();
  if (d.basliklar.length === 0) d.basliklar.push("Sicil");
  const iSicil = indeksBul(d.basliklar, SICIL_TAKMA) === -1 ? 0 : indeksBul(d.basliklar, SICIL_TAKMA);
  const satirHaritasi = new Map(d.satirlar.map((s) => [(s[iSicil] ?? "").trim(), s]));

  const eslemesiz = new Set<string>();
  const sonuc: AktarimSonucu = { yeni: 0, guncellenen: 0, eslemesizKodlar: [] };

  for (const k of kayitlar) {
    const sicil = ilkDolu(k, SICIL_TAKMA);
    if (!sicil) continue;
    const ad = ilkDolu(k, TAKMA.ad);
    const mm = ilkDolu(k, TAKMA.maliyetMerkezi);

    let satir = satirHaritasi.get(sicil);
    if (satir) {
      sonuc.guncellenen++;
    } else {
      satir = d.basliklar.map(() => "");
      satir[iSicil] = sicil;
      d.satirlar.push(satir);
      satirHaritasi.set(sicil, satir);
      sonuc.yeni++;
    }

    if (ad) satir[indeksSagla(d, "ad")] = ad;
    if (mm) {
      satir[indeksSagla(d, "maliyetMerkezi")] = mm;
      if (!eslemeyiSatiraUygula(d, satir, mm)) eslemesiz.add(mm);
    }
  }

  dosyaYaz(d);
  sonuc.eslemesizKodlar = [...eslemesiz].sort();
  return sonuc;
}

/**
 * Eşlemeyi kaynaktaki HERKESE yeniden uygular — eşleme sonradan tanımlandığında
 * ya da bir kodun bölümü/amiri değiştiğinde tek düğmeyle düzeltilir.
 * Maliyet merkezi olmayan satıra DOKUNULMAZ.
 */
function eslemeyiUygula(): { uygulanan: number; eslemesizKodlar: string[] } {
  const d = dosyaOku();
  const iMm = indeksBul(d.basliklar, TAKMA.maliyetMerkezi);
  if (iMm === -1) return { uygulanan: 0, eslemesizKodlar: [] };

  const eslemesiz = new Set<string>();
  let uygulanan = 0;
  for (const satir of d.satirlar) {
    const mm = (satir[iMm] ?? "").trim();
    if (!mm) continue;
    if (eslemeyiSatiraUygula(d, satir, mm)) uygulanan++;
    else eslemesiz.add(mm);
  }

  dosyaYaz(d);
  return { uygulanan, eslemesizKodlar: [...eslemesiz].sort() };
}

export const csvPersonelYonetim: PersonelYonetimi = {
  kayitlar: kayitlariOku,
  guncelle,
  iceAktar,
  eslemeyiUygula,
};
