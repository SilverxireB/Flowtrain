/**
 * KAYIT DEFTERİ MANTIĞI — saf, sunucu bağımlılığı yok.
 *
 * NEDEN AYRI DOSYA VE NEDEN SAF: defterdeki süzgeç bir görünüm ayrıntısı değil,
 * DENETİM ARACIDIR. "Şubat ayında Kaynak bölümünde kim yüksekte çalışma eğitimi
 * aldı" sorusunun cevabı eksikse, eksikliği kimse ekranda göremez — liste
 * kısalır, kullanıcı "demek ki yokmuş" der. Bu yüzden süzgeç ve kırılımlar
 * veritabanı sorgusuna değil saf fonksiyonlara yazıldı: sınav yazılabilsin.
 *
 * Sınav önerisi: `tests/rapor.test.mjs`
 */
import { eslesir } from "./arama";
import { BOM } from "./csv";
import type { OturumKaynagi, Sonuc } from "./tipler";

/**
 * Defterin tek satırı — oturum + eğitim + kişi tek düzlemde.
 *
 * Ekran ve dışa aktarım AYNI satırı görür. İkisi ayrı ayrı birleştirilseydi
 * CSV'de olan bir sütun ekranda olmayabilirdi ve denetimde "ekranda başka,
 * belgede başka" durumu doğardı.
 */
export interface KayitSatiri {
  id: string;
  egitimId: string;
  egitimAdi: string;
  egitimSurum: number;
  kategori: string;
  zorunlu: boolean;
  sicil: string;
  ad: string;
  bolum: string;
  baslangic: string;
  bitis?: string;
  /** Sunucu damgalarından ölçülen süre (saniye). Sınıf/aktarım kaydında yok. */
  sureSn?: number;
  puan?: number;
  sonuc?: Sonuc;
  kaynak: OturumKaynagi;
  egitmen?: string;
  gozeten?: string;
  notlar?: string;
  /** Eğitimde tekrar süresi varsa sertifikanın geçerlilik bitişi (`YYYY-AA-GG`). */
  gecerlilikBitis?: string;
}

/** `acik`: bitmemiş oturum — geçti/kaldı/iptal hiçbiri değil. */
export type SonucSuzgeci = Sonuc | "acik" | "";

export interface KayitSuzgeci {
  /** Kişi adı ya da sicil — Türkçe duyarlı (`arama.ts`). */
  sorgu: string;
  egitimId: string;
  bolum: string;
  kaynak: OturumKaynagi | "";
  sonuc: SonucSuzgeci;
  /** GG dahil: `YYYY-AA-GG`. Boşsa sınır yok. */
  baslangicGun: string;
  bitisGun: string;
}

export const BOS_SUZGEC: KayitSuzgeci = {
  sorgu: "",
  egitimId: "",
  bolum: "",
  kaynak: "",
  sonuc: "",
  baslangicGun: "",
  bitisGun: "",
};

/**
 * Satırın takvimdeki yeri.
 *
 * BİTİŞ ÖNCELİKLİ: denetim "ne zaman tamamlandı" diye sorar, "ne zaman
 * başlandı" diye değil. Yarım kalan oturumda bitiş yoktur; o zaman başlangıç
 * kullanılır, yoksa satır tarih süzgecinden tamamen düşer ve açık oturumlar
 * görünmez olurdu.
 */
export function kayitGunu(k: Pick<KayitSatiri, "baslangic" | "bitis">): string {
  return (k.bitis ?? k.baslangic ?? "").slice(0, 10);
}

function sonucEslesir(k: KayitSatiri, istenen: SonucSuzgeci): boolean {
  if (!istenen) return true;
  if (istenen === "acik") return !k.bitis;
  return k.sonuc === istenen;
}

/** Süzgeç — boş alan "sınırlama yok" demektir, hepsi VE ile birleşir. */
export function kayitlariSuz(satirlar: KayitSatiri[], s: KayitSuzgeci): KayitSatiri[] {
  return satirlar.filter((k) => {
    if (s.egitimId && k.egitimId !== s.egitimId) return false;
    if (s.bolum && k.bolum !== s.bolum) return false;
    if (s.kaynak && k.kaynak !== s.kaynak) return false;
    if (!sonucEslesir(k, s.sonuc)) return false;
    const gun = kayitGunu(k);
    if (s.baslangicGun && gun < s.baslangicGun) return false;
    if (s.bitisGun && gun > s.bitisGun) return false;
    if (s.sorgu && !eslesir(k.ad, s.sorgu) && !eslesir(k.sicil, s.sorgu)) return false;
    return true;
  });
}

export function suzgecAcikMi(s: KayitSuzgeci): boolean {
  return !!(s.sorgu || s.egitimId || s.bolum || s.kaynak || s.sonuc || s.baslangicGun || s.bitisGun);
}

/**
 * Süzgecin insan okunur özeti.
 *
 * BELGEYE YAZILIR: süzülmüş bir listeyi başlıksız basmak, denetimde "bu liste
 * neyin listesi" sorusunu cevapsız bırakır. Eksik belge, hiç belge olmamasından
 * kötüdür — o yüzden çıktının hangi süzgeçle alındığı belgenin üstünde durur.
 */
export function suzgecOzeti(s: KayitSuzgeci, egitimAdi: string, kaynakEtiket: string, sonucEtiket: string): string {
  const parcalar: string[] = [];
  if (s.egitimId) parcalar.push(`eğitim: ${egitimAdi}`);
  if (s.bolum) parcalar.push(`bölüm: ${s.bolum}`);
  if (s.kaynak) parcalar.push(`kaynak: ${kaynakEtiket}`);
  if (s.sonuc) parcalar.push(`sonuç: ${sonucEtiket}`);
  if (s.baslangicGun || s.bitisGun) parcalar.push(`tarih: ${s.baslangicGun || "başlangıç"} – ${s.bitisGun || "bugün"}`);
  if (s.sorgu) parcalar.push(`arama: "${s.sorgu}"`);
  return parcalar.length === 0 ? "Süzgeç yok — tüm kayıtlar." : parcalar.join(" · ");
}

/* ── belge künyesi (denetim uyumu) ────────────────────────────────────────── */

/**
 * HER DIŞA AKTARIMIN ÜSTÜNDE DURAN DÖRT CEVAP.
 *
 * Bir denetçi masasındaki kâğıda ya da açtığı Excel dosyasına bakıp dört soruyu
 * sorar: **kimin**, **neyin listesi**, **ne zaman üretildi**, **kaç kayıt**.
 * Bugüne kadar sertifikada bu izlenebilirlik vardı (sürüm + belge no) ama CSV
 * ve PDF'te yoktu: elde "flowtrain-kayit-defteri-2026-08-09.csv" adında,
 * içinde hangi fabrikaya ait olduğu yazmayan bir dosya kalıyordu. İki
 * kurulumun çıktısı yan yana konduğunda hangisinin hangisi olduğu
 * ayırt edilemezdi — denetimde bu, belgenin hükmünü düşürür.
 *
 * Künye TEK yerde tanımlı: dört belge (defter CSV/PDF, pano CSV/PDF) ayrı ayrı
 * yazsaydı biri güncellenip diğerleri geride kalır ve aynı denetim dosyasında
 * iki farklı künye biçimi olurdu.
 */
export interface BelgeKunyesi {
  /** Kurulumun sahibi fabrika/kurum. Ayarlardan okunur. */
  kurum: string;
  /** Belgenin ne olduğu — "Eğitim kayıt defteri", "Eğitim durumu (atamalar)". */
  belge: string;
  /** Belgenin basıldığı an: `YYYY-AA-GG SS:DD`. */
  uretim: string;
  kayitSayisi: number;
  /** Süzgeç özeti — `suzgecOzeti` çıktısı ya da "Süzgeç yok — tüm kayıtlar." */
  suzgec: string;
}

/**
 * Kurum adı girilmemişse BOŞ BIRAKILMAZ, açıkça söylenir.
 *
 * Sessiz boşluk, belgeyi basanın eksiği fark etmemesi demek. Denetçi
 * "(kurum adı girilmemiş)" yazan bir belgeye baktığında eksiğin ne olduğunu
 * bilir; boş bir satıra baktığında belgeyi biz mi kırptık diye sorar.
 */
export const KURUM_BOS = "(kurum adı girilmemiş)";

export function kurumAdiMetni(ham?: string): string {
  return (ham ?? "").trim() || KURUM_BOS;
}

/** `YYYY-AA-GG SS:DD` — belgenin basıldığı an (yerel saat, ISO'nun Z'si değil). */
export function damgaMetni(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Künyenin üç satırlık okunur hâli — PDF başlığı ve sayfa altı bunu basar. */
export function kunyeSatirlari(k: BelgeKunyesi): string[] {
  return [
    `${k.kurum} · ${k.belge}`,
    `Üretim: ${k.uretim} · ${k.kayitSayisi} kayıt`,
    `Süzgeç: ${k.suzgec}`,
  ];
}

/**
 * Künye + tablo — Türkçe Excel'in doğru açtığı tek dosya.
 *
 * Künye TABLONUN ÜSTÜNE yazılır, altına değil: Excel'de dosyayı açan kişi
 * ilk gördüğü şeyin belgenin kimliği olmasını bekler, 8000 satır kaydırıp
 * dipnot aramaz. `csvYaz` çıktısı BOM ile başlar; BOM dosyanın EN BAŞINDA
 * kalmalı (ortada kalırsa Excel kodlamayı yine yanlış okur), o yüzden
 * gövdenin BOM'u kırpılıp künyenin önüne alınır.
 */
export function kunyeliCsv(k: BelgeKunyesi, govde: string): string {
  const alanlar: [string, string][] = [
    ["Kurum", k.kurum],
    ["Belge", k.belge],
    ["Üretim", k.uretim],
    ["Kayıt sayısı", String(k.kayitSayisi)],
    ["Süzgeç", k.suzgec],
  ];
  // Değerde `;` ya da tırnak olabilir (süzgeç özeti serbest metindir).
  const kacir = (s: string) => (/[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const bas = alanlar.map(([a, d]) => `${a};${kacir(d)}`).join("\r\n");
  return `${BOM}${bas}\r\n\r\n${govde.startsWith(BOM) ? govde.slice(BOM.length) : govde}`;
}

/* ── biçimlendirme ────────────────────────────────────────────────────────── */

/** `2026-08-07T14:32:10.000Z` → `2026-08-07 14:32`. Boşsa tire. */
export function zamanMetni(iso?: string): string {
  return iso ? iso.slice(0, 16).replace("T", " ") : "—";
}

export function sureMetni(sn?: number): string {
  if (sn === undefined || sn <= 0) return "—";
  if (sn < 60) return `${sn} sn`;
  const dk = Math.round(sn / 60);
  return dk < 90 ? `${dk} dk` : `${Math.floor(dk / 60)} sa ${dk % 60} dk`;
}

/** Sayfalama — sınır dışına taşan sayfa numarası sessizce geri çekilir. */
export function sayfala<T>(liste: T[], sayfa: number, boyut: number): { gorunen: T[]; gecerliSayfa: number; sonSayfa: number } {
  const sonSayfa = Math.max(1, Math.ceil(liste.length / boyut));
  const gecerliSayfa = Math.min(Math.max(1, sayfa), sonSayfa);
  return { gorunen: liste.slice((gecerliSayfa - 1) * boyut, gecerliSayfa * boyut), gecerliSayfa, sonSayfa };
}

/* ── düzeltme kaydı ───────────────────────────────────────────────────────── */

/**
 * DÜZELTME BAĞI — bugün NOTUN İÇİNDE taşınıyor, bilerek.
 *
 * Kayıt düzenlenmez, silinmez (`CLAUDE.md` 7. kural); yanlış bir kayıt YENİ bir
 * kayıtla düzeltilir. Ama iki satırın bağı yoktu: denetçi "hangi kaydı
 * düzeltiyor" sorusunu nottaki serbest cümleden okumaya çalışıyordu ve o cümle
 * her seferinde başka biçimde yazılıyordu.
 *
 * DOĞRU ÇÖZÜM ÇEKİRDEKTEDİR: `Oturum.duzeltir` alanı (`docs/istek-C.md` · 4).
 * Alan çekirdek tipe girer ve dört hattı birden ilgilendirir, o yüzden Hat C
 * onu yazmıyor. Buradaki önek, alan gelene kadar bağı MAKİNE OKUYABİLİR kılar:
 * defter iki satırı da işaretler, çıktıda bağ görünür, alan geldiğinde bu
 * ayrıştırma tek yerde silinir.
 *
 * Önek Türkçe ve okunur: not alanı denetçinin de okuduğu bir alan, oraya
 * `#REF:otr_x` gibi bir işaret koymak belgeyi teknik gürültüye çevirirdi.
 */
export const DUZELTME_ONEKI = "Düzeltme:";

/** Yeni kaydın notu — düzeltilen belgenin numarası her zaman BAŞTA durur. */
export function duzeltmeNotu(duzeltilenBelgeNo: string, kullaniciNotu: string): string {
  const kuyruk = kullaniciNotu.trim();
  return `${DUZELTME_ONEKI} ${duzeltilenBelgeNo} numaralı kaydın yerine geçer.${kuyruk ? ` ${kuyruk}` : ""}`;
}

/** Nottan düzeltilen kaydın kimliğini çıkarır; düzeltme notu değilse undefined. */
export function duzeltilenBelgeNo(notlar?: string): string | undefined {
  const m = (notlar ?? "").match(/^Düzeltme:\s*(\S+)/);
  return m ? m[1] : undefined;
}

export interface DuzeltmeHaritasi {
  /** Düzeltilen kaydın kimliği → onu düzelten kayıt kimlikleri. */
  duzeltilenler: Map<string, string[]>;
  /** Düzeltme kaydının kimliği → düzelttiği kaydın kimliği. */
  duzeltenler: Map<string, string>;
}

/**
 * Defterdeki düzeltme bağlarının tamamı — TEK geçişte.
 *
 * Satır başına ayrı arama yapılsaydı 20 bin satırlık defterde kareli bir
 * tarama olurdu (yük denemesinin çekirdekte ortaya çıkardığı hatanın aynısı).
 */
export function duzeltmeHaritasi(satirlar: Pick<KayitSatiri, "id" | "notlar">[]): DuzeltmeHaritasi {
  const duzeltilenler = new Map<string, string[]>();
  const duzeltenler = new Map<string, string>();
  for (const s of satirlar) {
    const eski = duzeltilenBelgeNo(s.notlar);
    if (!eski || eski === s.id) continue;
    duzeltenler.set(s.id, eski);
    const liste = duzeltilenler.get(eski);
    if (liste) liste.push(s.id);
    else duzeltilenler.set(eski, [s.id]);
  }
  return { duzeltilenler, duzeltenler };
}

/* ── pano kırılımları ─────────────────────────────────────────────────────── */

export interface Kirilim {
  ad: string;
  toplam: number;
  acik: number;
  /** Tamamlanma yüzdesi (0-100). Toplam sıfırsa 0. */
  oran: number;
}

/**
 * Ada göre grupla, açık/kapalı say.
 *
 * TEK FONKSİYON, ÜÇ KIRILIM: bölüm, kategori ve zorunluluk aynı hesabı ister.
 * Üçünü ayrı ayrı yazmak, birinde düzeltilen yuvarlama hatasının diğer ikisinde
 * kalması demekti.
 */
export function kirilimCikar(olculer: { ad: string; acik: boolean }[]): Kirilim[] {
  const kutu = new Map<string, { toplam: number; acik: number }>();
  for (const o of olculer) {
    const k = kutu.get(o.ad) ?? { toplam: 0, acik: 0 };
    k.toplam++;
    if (o.acik) k.acik++;
    kutu.set(o.ad, k);
  }
  return [...kutu.entries()]
    .map(([ad, k]) => ({ ad, toplam: k.toplam, acik: k.acik, oran: Math.round(((k.toplam - k.acik) / k.toplam) * 100) }))
    .sort((a, b) => b.acik - a.acik || a.ad.localeCompare(b.ad, "tr"));
}

export interface AyOzeti {
  /** `YYYY-AA`. */
  ay: string;
  gecti: number;
  kaldi: number;
  toplam: number;
}

/** `2026-01` + (-1) → `2025-12`. Ay taşması elle yürütülür (Date kurmaya değmez). */
export function ayKaydir(ay: string, adim: number): string {
  const yil = Number(ay.slice(0, 4));
  const no = Number(ay.slice(5, 7)) - 1 + adim;
  const yeniYil = yil + Math.floor(no / 12);
  const yeniAy = ((no % 12) + 12) % 12;
  return `${yeniYil}-${String(yeniAy + 1).padStart(2, "0")}`;
}

/**
 * Aylık tamamlanma seyri.
 *
 * BOŞ AYLAR DA DÖNER: yalnız kaydı olan aylar listelenseydi, hiç eğitim
 * verilmeyen ay grafikte hiç görünmez ve seyir kesintisiz gibi okunurdu —
 * oysa anlatmak istediğimiz şey tam da o boşluk.
 */
export function aylikTrend(
  satirlar: Pick<KayitSatiri, "bitis" | "sonuc">[],
  sonAy: string,
  adet = 12,
): AyOzeti[] {
  const kutu = new Map<string, { gecti: number; kaldi: number }>();
  for (const k of satirlar) {
    if (!k.bitis || (k.sonuc !== "gecti" && k.sonuc !== "kaldi")) continue;
    const ay = k.bitis.slice(0, 7);
    const s = kutu.get(ay) ?? { gecti: 0, kaldi: 0 };
    if (k.sonuc === "gecti") s.gecti++;
    else s.kaldi++;
    kutu.set(ay, s);
  }

  const cikti: AyOzeti[] = [];
  for (let i = adet - 1; i >= 0; i--) {
    const ay = ayKaydir(sonAy, -i);
    const s = kutu.get(ay) ?? { gecti: 0, kaldi: 0 };
    cikti.push({ ay, gecti: s.gecti, kaldi: s.kaldi, toplam: s.gecti + s.kaldi });
  }
  return cikti;
}

const AY_ADI = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

export function ayEtiketi(ay: string): string {
  return `${AY_ADI[Number(ay.slice(5, 7)) - 1] ?? ay.slice(5, 7)} ${ay.slice(2, 4)}`;
}
