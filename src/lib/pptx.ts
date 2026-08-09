/**
 * PPTX İÇE AKTARMA — dış bağımlılık YOK (kapalı ağ kuralı, `csv.ts` gibi).
 *
 * NEDEN METİN ÇIKARIMI, SLAYT GÖRÜNTÜSÜ DEĞİL: pptx'ten görüntü üretmek
 * slaydı yeniden ÇİZMEK demek — yazı tipi, SmartArt, tema renkleri, animasyon.
 * Tarayıcıda bunu doğru yapmak imkânsıza yakın ve yanlış yapmak PDF kapısından
 * daha kötü bir sonuç verir. Metin çıkarımı ise ürünün ruhuna uyuyor: içerik
 * FlowTrain kartına dönüşünce DÜZENLENEBİLİR kalır, kioskta okunabilir puntoda
 * çizilir ve ekran okuyucu okuyabilir. Slayt görüntüsü olsaydı hepsi kaybolurdu.
 *
 * NASIL: .pptx bir ZIP arşividir. Merkezi dizini kendimiz ayrıştırıyoruz,
 * deflate edilmiş girdileri tarayıcının yerleşik `DecompressionStream`i açıyor.
 * Slayt XML'i (`ppt/slides/slideN.xml`) başlığı ve gövde metnini,
 * ilişki dosyası (`ppt/slides/_rels/slideN.xml.rels`) görselleri veriyor.
 *
 * SAF VE SINAVLANABİLİR: bu dosya DOM'a, ağa, depoya dokunmaz. Girdi bayt,
 * çıktı veri. Tek çevre bağımlılığı `DecompressionStream` ve `TextDecoder`;
 * ikisi de Node 20+ ve Chrome'da var, yani sınavlar da koşabilir.
 *
 * NE OKUMAZ (bilinçli, bkz. `pptxCoz` dönüşündeki `atlanan`):
 *  - Slayt düzeni/asıl slayttaki (layout/master) metin ve logolar — her slayda
 *    tekrar eden fabrika logosunu kart kart eklemek içeriği çöpe çevirirdi.
 *  - Konuşmacı notları, animasyon, geçiş, ses.
 *  - EMF/WMF/TIFF gibi Windows'a özgü görseller — medya kapısı kabul etmiyor.
 *  - SmartArt'ın çizimi (içindeki METİN gelir, şekiller gelmez).
 */

/* ── ZIP okuyucu ──────────────────────────────────────────────────────────── */

/** Arşivdeki tek girdi. `sikisik` HAM baytlar — açılmamış. */
export interface ZipGirdi {
  ad: string;
  /** 0 = saklandı (sıkıştırma yok), 8 = deflate. Başkasını açamayız. */
  yontem: number;
  sikisik: Uint8Array;
  acikBoyut: number;
}

const EOCD_IMZA = 0x06054b50;
const MERKEZ_IMZA = 0x02014b50;
const YEREL_IMZA = 0x04034b50;

/**
 * Arşivin girdilerini MERKEZİ DİZİNDEN okur.
 *
 * Yerel başlıkları baştan tarayıp gitmek daha kısa olurdu ama PowerPoint
 * girdileri "veri tanımlayıcı" (data descriptor) ile yazabiliyor: o durumda
 * yerel başlıktaki boyut alanları SIFIRDIR ve akış nerede bittiğini ancak
 * açtıktan sonra anlarsınız. Merkezi dizin gerçek boyutları taşır.
 */
export function zipGirdileri(veri: Uint8Array): ZipGirdi[] {
  const g = new DataView(veri.buffer, veri.byteOffset, veri.byteLength);

  // EOCD sondadır ama arkasında 64 KB'a kadar arşiv yorumu olabilir.
  let eocd = -1;
  const enErken = Math.max(0, veri.length - 65557);
  for (let i = veri.length - 22; i >= enErken; i--) {
    if (g.getUint32(i, true) === EOCD_IMZA) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("ZIP sonu bulunamadı — dosya bir arşiv değil ya da bozuk.");

  const adet = g.getUint16(eocd + 10, true);
  const merkez = g.getUint32(eocd + 16, true);
  if (merkez === 0xffffffff) throw new Error("ZIP64 arşivler desteklenmiyor.");

  const girdiler: ZipGirdi[] = [];
  let p = merkez;
  for (let n = 0; n < adet && p + 46 <= veri.length; n++) {
    if (g.getUint32(p, true) !== MERKEZ_IMZA) break;
    const yontem = g.getUint16(p + 10, true);
    const sikisikBoyut = g.getUint32(p + 20, true);
    const acikBoyut = g.getUint32(p + 24, true);
    const adUzunluk = g.getUint16(p + 28, true);
    const ekUzunluk = g.getUint16(p + 30, true);
    const yorumUzunluk = g.getUint16(p + 32, true);
    const yerel = g.getUint32(p + 42, true);
    const ad = new TextDecoder("utf-8").decode(veri.subarray(p + 46, p + 46 + adUzunluk));
    p += 46 + adUzunluk + ekUzunluk + yorumUzunluk;

    // Klasör kaydı: adı "/" ile biter, içeriği yok.
    if (ad.endsWith("/")) continue;
    if (sikisikBoyut === 0xffffffff || yerel === 0xffffffff) throw new Error("ZIP64 arşivler desteklenmiyor.");
    if (yerel + 30 > veri.length || g.getUint32(yerel, true) !== YEREL_IMZA) continue;

    // Yerel başlıktaki ad/ek uzunlukları merkezdekinden FARKLI olabilir
    // (ek alanlar yerelde daha uzundur); veri başlangıcı yerelden okunur.
    const yerelAdUzunluk = g.getUint16(yerel + 26, true);
    const yerelEkUzunluk = g.getUint16(yerel + 28, true);
    const bas = yerel + 30 + yerelAdUzunluk + yerelEkUzunluk;
    girdiler.push({ ad, yontem, acikBoyut, sikisik: veri.subarray(bas, bas + sikisikBoyut) });
  }
  return girdiler;
}

/**
 * Girdinin içeriğini açar.
 *
 * Deflate'i KENDİMİZ yazmıyoruz: `DecompressionStream("deflate-raw")` hem
 * Chrome'da (kiosk ve kokpit) hem Node 20+'ta yerleşik. Kendi inflate'imizi
 * yazmak yüzlerce satır ve her biri sessizce bozuk çıktı üretme riski.
 */
export async function girdiAc(girdi: ZipGirdi): Promise<Uint8Array> {
  if (girdi.yontem === 0) return girdi.sikisik;
  if (girdi.yontem !== 8) throw new Error(`Desteklenmeyen sıkıştırma (yöntem ${girdi.yontem}).`);
  if (typeof DecompressionStream === "undefined") {
    throw new Error("Tarayıcınız sıkıştırılmış dosya açmayı desteklemiyor (DecompressionStream yok).");
  }

  const akis = new Blob([girdi.sikisik as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(akis).arrayBuffer());
}

/* ── küçük XML ayrıştırıcı ────────────────────────────────────────────────── */

export interface XmlDugum {
  /** Öntakılı ad, örneğin "p:sp". Arama YEREL adla yapılır. */
  ad: string;
  nitelikler: Record<string, string>;
  cocuklar: XmlDugum[];
  /** Yalnız bu düğümün doğrudan metni — çocukların metni dahil değil. */
  metin: string;
}

const VARLIKLAR: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

/** XML varlıklarını çözer (`&amp;`, `&#252;`, `&#xFC;`). */
export function varlikCoz(metin: string): string {
  if (metin.indexOf("&") < 0) return metin;
  return metin.replace(/&(#[xX]?[0-9a-fA-F]+|[a-zA-Z]+);/g, (tam, kod: string) => {
    if (kod[0] !== "#") return VARLIKLAR[kod] ?? tam;
    const onaltilik = kod[1] === "x" || kod[1] === "X";
    const sayi = onaltilik ? parseInt(kod.slice(2), 16) : parseInt(kod.slice(1), 10);
    return Number.isFinite(sayi) && sayi > 0 ? String.fromCodePoint(sayi) : tam;
  });
}

const NITELIK_KALIBI = /([\w:.-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;

function nitelikleriCoz(parca: string): Record<string, string> {
  const n: Record<string, string> = {};
  NITELIK_KALIBI.lastIndex = 0;
  let e = NITELIK_KALIBI.exec(parca);
  while (e) {
    n[e[1]] = varlikCoz(e[3] ?? e[4] ?? "");
    e = NITELIK_KALIBI.exec(parca);
  }
  return n;
}

/**
 * XML metnini ağaca çevirir.
 *
 * DOMParser KULLANILMIYOR: bu dosyanın sunucuda ve sınavlarda da koşması
 * gerekiyor, DOMParser yalnız tarayıcıda var. Ayrıca ihtiyacımız olan şey
 * OOXML'in dar bir alt kümesi — tam bir XML uyumluluğu aramıyoruz.
 *
 * Kapanmayan etiket ağacı bozmaz: yığın boşalırsa fazladan kapanışlar yutulur.
 */
export function xmlAyristir(metin: string): XmlDugum {
  const kok: XmlDugum = { ad: "#kok", nitelikler: {}, cocuklar: [], metin: "" };
  const yigin: XmlDugum[] = [kok];
  let i = 0;

  while (i < metin.length) {
    const ac = metin.indexOf("<", i);
    if (ac < 0) break;
    if (ac > i) yigin[yigin.length - 1].metin += varlikCoz(metin.slice(i, ac));

    if (metin.startsWith("<!--", ac)) {
      const s = metin.indexOf("-->", ac);
      i = s < 0 ? metin.length : s + 3;
      continue;
    }
    if (metin.startsWith("<![CDATA[", ac)) {
      const s = metin.indexOf("]]>", ac);
      yigin[yigin.length - 1].metin += metin.slice(ac + 9, s < 0 ? metin.length : s);
      i = s < 0 ? metin.length : s + 3;
      continue;
    }
    if (metin.startsWith("<?", ac) || metin.startsWith("<!", ac)) {
      const s = metin.indexOf(">", ac);
      i = s < 0 ? metin.length : s + 1;
      continue;
    }

    const kapa = metin.indexOf(">", ac);
    if (kapa < 0) break;
    const etiket = metin.slice(ac + 1, kapa);
    i = kapa + 1;

    if (etiket[0] === "/") {
      if (yigin.length > 1) yigin.pop();
      continue;
    }

    const kendiKapanan = etiket.endsWith("/");
    const govde = kendiKapanan ? etiket.slice(0, -1) : etiket;
    const bosluk = govde.search(/\s/);
    const ad = (bosluk < 0 ? govde : govde.slice(0, bosluk)).trim();
    if (!ad) continue;

    const dugum: XmlDugum = {
      ad,
      nitelikler: bosluk < 0 ? {} : nitelikleriCoz(govde.slice(bosluk)),
      cocuklar: [],
      metin: "",
    };
    yigin[yigin.length - 1].cocuklar.push(dugum);
    if (!kendiKapanan) yigin.push(dugum);
  }

  return kok;
}

/**
 * Öntakısız ad. OOXML'de öntakı ("p", "a", "r") sözleşmedir, ZORUNLULUK
 * değil — belge kendi öntakısını seçebilir. Yerel adla aramak dosyayı
 * PowerPoint'in kaprisinden bağımsız kılar.
 */
export function yerelAd(ad: string): string {
  const k = ad.indexOf(":");
  return k < 0 ? ad : ad.slice(k + 1);
}

/** Ağaçta verilen YEREL ada sahip tüm düğümler — belge sırasında. */
export function dugumleriBul(kok: XmlDugum, yerel: string): XmlDugum[] {
  const bulunan: XmlDugum[] = [];
  const yigin: XmlDugum[] = [kok];
  while (yigin.length > 0) {
    const d = yigin.pop()!;
    if (d !== kok && yerelAd(d.ad) === yerel) bulunan.push(d);
    // Ters ekleniyor ki yığından belge SIRASINDA çıksın.
    for (let i = d.cocuklar.length - 1; i >= 0; i--) yigin.push(d.cocuklar[i]);
  }
  return bulunan;
}

/** İlk eşleşen düğüm, yoksa null. */
export function dugumBul(kok: XmlDugum, yerel: string): XmlDugum | null {
  return dugumleriBul(kok, yerel)[0] ?? null;
}

/* ── slayt metni ──────────────────────────────────────────────────────────── */

function paragrafMetni(p: XmlDugum): string {
  let s = "";
  const yigin: XmlDugum[] = [p];
  while (yigin.length > 0) {
    const d = yigin.pop()!;
    const y = yerelAd(d.ad);
    // "t" = metin parçası, "br" = satır sonu. Alan (a:fld) da içinde t taşır.
    if (y === "t") s += d.metin;
    else if (y === "br") s += "\n";
    for (let i = d.cocuklar.length - 1; i >= 0; i--) yigin.push(d.cocuklar[i]);
  }
  return s;
}

/**
 * Bir metin gövdesinin (`a:txBody`) düz metni.
 *
 * Her paragraf bir satır. BOŞ PARAGRAFLAR ATILIR: PowerPoint şablonlarında
 * madde listesinin altında düzine boş paragraf bulunur, hepsini taşımak kartı
 * baştan yarım ekran boşlukla açardı.
 */
export function metniTopla(dugum: XmlDugum): string {
  const satirlar: string[] = [];
  for (const p of dugumleriBul(dugum, "p")) {
    const s = paragrafMetni(p).replace(/[ \t]+$/g, "");
    if (s.trim() !== "") satirlar.push(s);
  }
  return satirlar.join("\n");
}

/** Yer tutucu tipi (`p:ph type=...`) — başlık mı gövde mi olduğunu söyler. */
function yerTutucuTipi(sekil: XmlDugum): string {
  const ph = dugumBul(sekil, "ph");
  return ph ? (ph.nitelikler.type ?? "") : "";
}

const BASLIK_TIPLERI = ["title", "ctrTitle"];

export interface SlaytIcerik {
  baslik: string;
  metin: string;
  /** Görsellerin ilişki kimlikleri (rId…), slayttaki sırayla. */
  gorselIliskiIdleri: string[];
}

/**
 * Tek slaydın içeriği.
 *
 * BAŞLIK YER TUTUCUDAN GELİR. Yer tutucu yoksa (elle çizilmiş kutulara yazılmış
 * sunumlar — sahada çok yaygın) ilk metin bloğunun İLK SATIRI başlık sayılır:
 * insan da o slayda baktığında aynı şeyi yapardı, ve başlıksız kart kioskta
 * "nerede olduğumu bilmiyorum" hissi veriyor.
 */
export function slaytCoz(kok: XmlDugum): SlaytIcerik {
  const agac = dugumBul(kok, "spTree") ?? kok;
  let baslik = "";
  const govdeler: string[] = [];
  const gorselIliskiIdleri: string[] = [];

  // spTree'nin ÜST düzey çocukları belge sırasında geziliyor; şeklin içine
  // inildikten sonra o dalın tamamı o şekle aittir.
  const yigin: XmlDugum[] = [agac];
  const gezilen: XmlDugum[] = [];
  while (yigin.length > 0) {
    const d = yigin.pop()!;
    gezilen.push(d);
    for (let i = d.cocuklar.length - 1; i >= 0; i--) yigin.push(d.cocuklar[i]);
  }

  const islenmis = new Set<XmlDugum>();
  for (const d of gezilen) {
    if (islenmis.has(d)) continue;
    const y = yerelAd(d.ad);

    if (y === "sp" || y === "graphicFrame") {
      // Tablo hücreleri de a:p taşır; graphicFrame böylece metnini verir.
      const metin = metniTopla(d);
      const tip = y === "sp" ? yerTutucuTipi(d) : "";
      if (metin !== "") {
        if (!baslik && BASLIK_TIPLERI.includes(tip)) baslik = metin.replace(/\n+/g, " ").trim();
        else govdeler.push(metin);
      }
      // Şeklin İÇİNDEKİ dolgu görseli (arka plan deseni) kart görseli değil;
      // yalnız p:pic içindeki blip alınıyor.
      for (const alt of dugumleriBul(d, "blip")) islenmis.add(alt);
    } else if (y === "blip") {
      const rid = d.nitelikler["r:embed"] ?? d.nitelikler.embed;
      if (rid && !gorselIliskiIdleri.includes(rid)) gorselIliskiIdleri.push(rid);
    }
  }

  if (!baslik && govdeler.length > 0) {
    const satirlar = govdeler[0].split("\n");
    baslik = satirlar[0].trim();
    govdeler[0] = satirlar.slice(1).join("\n");
  }

  return { baslik, metin: govdeler.filter((s) => s.trim() !== "").join("\n\n"), gorselIliskiIdleri };
}

/* ── ilişkiler ve yollar ──────────────────────────────────────────────────── */

/** `.rels` dosyası → { rId: hedef yol }. Hedef, rels'in sahibine GÖRELİDİR. */
export function iliskileriCoz(xml: string): Record<string, string> {
  const harita: Record<string, string> = {};
  for (const r of dugumleriBul(xmlAyristir(xml), "Relationship")) {
    const id = r.nitelikler.Id;
    const hedef = r.nitelikler.Target;
    // Dış bağlantı (TargetMode="External") arşivde DEĞİL: kapalı ağda zaten
    // erişilemez, kartta kırık görsel bırakmaktansa hiç almamak doğru.
    if (id && hedef && r.nitelikler.TargetMode !== "External") harita[id] = hedef;
  }
  return harita;
}

/** Göreli hedefi arşiv köküne göre normalleştirir ("ppt/slides" + "../media/x"). */
export function yolCoz(temelKlasor: string, hedef: string): string {
  if (hedef.startsWith("/")) return hedef.slice(1);
  const parcalar = temelKlasor.split("/").filter((p) => p !== "");
  for (const p of hedef.split("/")) {
    if (p === "" || p === ".") continue;
    if (p === "..") parcalar.pop();
    else parcalar.push(p);
  }
  return parcalar.join("/");
}

/**
 * Slayt dosyalarının SUNUM SIRASI.
 *
 * `slide1, slide2…` adlarına göre sıralamak yanlış: PowerPoint slayt silip
 * eklerken numaraları yeniden kullanır, gerçek sıra `presentation.xml`in
 * `sldIdLst` listesindedir. Sıra bozuk gelirse hazırlayan kırk kartı elle
 * taşımak zorunda kalır — özellik faydadan çok iş çıkarır.
 */
export function slaytSirasi(sunumXml: string, sunumIliskileri: Record<string, string>): string[] {
  const sirali: string[] = [];
  const liste = dugumBul(xmlAyristir(sunumXml), "sldIdLst");
  if (!liste) return sirali;
  for (const s of dugumleriBul(liste, "sldId")) {
    const rid = s.nitelikler["r:id"] ?? s.nitelikler.id;
    const hedef = rid ? sunumIliskileri[rid] : undefined;
    if (hedef) sirali.push(yolCoz("ppt", hedef));
  }
  return sirali;
}

/* ── bütün ────────────────────────────────────────────────────────────────── */

/**
 * Medya kapısının kabul ettiği görsel türleri.
 * PPTX içinde EMF/WMF/TIFF de bulunur (Office bunları Windows'a özgü üretir);
 * onları yükleyemeyiz, sayısını kullanıcıya SÖYLERİZ — sessizce düşürmek
 * "sunumumda 12 resim vardı, 7'si geldi" şaşkınlığı demek.
 */
const GORSEL_TURLERI: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

export interface PptxGorsel {
  /** Arşivdeki yol — kullanıcıya "hangi resim atlandı" derken kullanılır. */
  ad: string;
  /** MIME türü — medya kapısı bunu bekliyor. */
  tur: string;
  veri: Uint8Array;
}

export interface PptxSlayt {
  baslik: string;
  metin: string;
  gorseller: PptxGorsel[];
}

export interface PptxSonuc {
  slaytlar: PptxSlayt[];
  /** Okunamayan/desteklenmeyen görsellerin arşiv yolları. */
  atlanan: string[];
}

/** Uzantıdan MIME. Bilinmeyen tür `null` döner ve atlanır. */
function gorselTuru(yol: string): string | null {
  const nokta = yol.lastIndexOf(".");
  if (nokta < 0) return null;
  return GORSEL_TURLERI[yol.slice(nokta + 1).toLocaleLowerCase("en")] ?? null;
}

/**
 * PPTX arşivini slaytlara çevirir.
 *
 * Girdi bayt, çıktı veri: ağ yok, DOM yok, depo yok. Yükleme ve kart yazımı
 * çağıranın işi (`IceriAktar.tsx`).
 */
export async function pptxCoz(kaynak: ArrayBuffer | Uint8Array): Promise<PptxSonuc> {
  const veri = kaynak instanceof Uint8Array ? kaynak : new Uint8Array(kaynak);
  const girdiler = new Map<string, ZipGirdi>();
  for (const g of zipGirdileri(veri)) girdiler.set(g.ad, g);

  if (!girdiler.has("ppt/presentation.xml")) {
    throw new Error("Arşivin içinde sunum bulunamadı — bu dosya bir PowerPoint sunumu değil.");
  }

  const cozucu = new TextDecoder("utf-8");
  const sunumXml = cozucu.decode(await girdiAc(girdiler.get("ppt/presentation.xml")!));
  const sunumRels = girdiler.get("ppt/_rels/presentation.xml.rels");
  const sunumIliskileri = sunumRels ? iliskileriCoz(cozucu.decode(await girdiAc(sunumRels))) : {};

  let yollar = slaytSirasi(sunumXml, sunumIliskileri);
  if (yollar.length === 0) {
    // Yedek: ilişki listesi okunamadıysa dosya adlarındaki sayıya göre sırala.
    yollar = [...girdiler.keys()]
      .filter((a) => /^ppt\/slides\/slide\d+\.xml$/.test(a))
      .sort((a, b) => slaytNumarasi(a) - slaytNumarasi(b));
  }
  if (yollar.length === 0) throw new Error("Sunumda slayt bulunamadı.");

  const slaytlar: PptxSlayt[] = [];
  const atlanan: string[] = [];

  for (const yol of yollar) {
    const girdi = girdiler.get(yol);
    if (!girdi) continue;

    const icerik = slaytCoz(xmlAyristir(cozucu.decode(await girdiAc(girdi))));
    const klasor = yol.slice(0, yol.lastIndexOf("/"));
    const relsYolu = `${klasor}/_rels/${yol.slice(yol.lastIndexOf("/") + 1)}.rels`;
    const rels = girdiler.get(relsYolu);
    const iliskiler = rels ? iliskileriCoz(cozucu.decode(await girdiAc(rels))) : {};

    const gorseller: PptxGorsel[] = [];
    for (const rid of icerik.gorselIliskiIdleri) {
      const hedef = iliskiler[rid];
      if (!hedef) continue;
      const gorselYolu = yolCoz(klasor, hedef);
      const tur = gorselTuru(gorselYolu);
      const gorselGirdi = girdiler.get(gorselYolu);
      if (!tur || !gorselGirdi) {
        if (!atlanan.includes(gorselYolu)) atlanan.push(gorselYolu);
        continue;
      }
      gorseller.push({ ad: gorselYolu, tur, veri: await girdiAc(gorselGirdi) });
    }

    slaytlar.push({ baslik: icerik.baslik, metin: icerik.metin, gorseller });
  }

  return { slaytlar, atlanan };
}

function slaytNumarasi(yol: string): number {
  const e = /slide(\d+)\.xml$/.exec(yol);
  return e ? Number(e[1]) : 0;
}
