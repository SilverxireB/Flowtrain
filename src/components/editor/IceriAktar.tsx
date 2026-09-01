"use client";

import { useRef, useState } from "react";
import Icon from "@/components/Icon";
import { pptxCoz, type PptxGorsel } from "@/lib/pptx";
import { pdfSayfaBasligi, type PdfMetinParcasi } from "@/lib/pdfBaslik";
import { yol } from "@/lib/yol";

/**
 * "YÜKLE" KAPISI — ürünün en önemli tek özelliği.
 *
 * İçerik üretmeyi kolaylaştırmaya çalışmıyoruz, üretmeyi ORTADAN KALDIRIYORUZ:
 * fabrikada İSG sunumu, kalite talimatı, prosedür PDF'i zaten var. "Gel bunları
 * bizim editörde yeniden yaz" demek uyarlamayı öldürür.
 *
 * ÇEVİRİM TARAYICIDA YAPILIR: sunucuya PDF ayrıştırıcı, ImageMagick,
 * Ghostscript kurmaya gerek yok — kapalı ağda "önce şu paketi kurun" diyen her
 * adım kurulumu haftalarca geciktirir.
 *
 * İKİ KAPI, İKİ FARKLI SONUÇ — ve fark kullanıcıya SÖYLENİR:
 *
 *  - PDF → her sayfa bir GÖRSEL kart. Sayfa neyse o; metin görüntünün içinde
 *    kalır, düzenlenemez ve ekran okuyucu okuyamaz. Ama kaynağa birebir sadık.
 *  - PPTX → her slayttan BAŞLIK + METİN + GÖRSELLER çıkarılır, gerçek kart
 *    olur. Düzenlenebilir, kioskta okunur puntoda çizilir, ekran okuyucu okur.
 *    Karşılığında slaydın yerleşimi/teması gelmez — zaten kiosk kartına
 *    dönüştürülecekti.
 *
 * PPTX neden slayt GÖRÜNTÜSÜ değil: pptx'te slaydı çizmek yazı tipi, tema,
 * SmartArt ve animasyon motorunu yeniden yazmak demek. Bunu yarım yapmak
 * PDF kapısından daha kötü bir sonuç verir; ayrıştırma ise ürünün ruhuna uygun.
 *
 * ⭐ VARSAYILAN YOL PDF (kullanıcı kararı, 29.08.2026).
 * İki kapı da duruyor ama artık EŞİT DEĞİL. Sebep sahada ölçüldü: bir OKR
 * slaydı aktarıldığında tablo hücreleri okuma sırasına dizilip "Key Result"
 * ve "Objective" öksüz satırlara döndü — çünkü `pptx.ts` `a:tbl` okumuyor ve
 * anlam YERLEŞİMDEYDİ. Kullanıcı: "sunumu çok düzgün şekilde yazılı
 * aktaramayız, o özellik de diğeri gibi olmalı."
 *
 * PowerPoint'in kendi PDF çıktısı slaydı POWERPOINT'İN ÇİZDİĞİ GİBİ veriyor —
 * bizim yeniden çizmeye çalışmamızın asla ulaşamayacağı sadakat. Bu yüzden
 * ekran tek yol gösteriyor: "PowerPoint'te PDF olarak kaydet, onu yükle."
 * PPTX kapısı SİLİNMEDİ, ikinci seçenek oldu: metni düzenlenebilir isteyen
 * (arama, çeviri, ekran okuyucu) bilerek onu seçer. Yazılan 517 satırlık
 * ayrıştırıcı da çöpe gitmiyor.
 */
export default function IceriAktar({
  onPdfKartlari,
  onPptxKartlari,
  sade = false,
}: {
  /** PDF: sayfa görüntüsü + türetilmiş başlık. */
  onPdfKartlari: (kartlar: { gorselId: string; baslik: string }[]) => Promise<void>;
  /** PPTX: gerçek metin kartları. */
  onPptxKartlari: (kartlar: { baslik: string; metin: string; gorselIdler: string[] }[]) => Promise<void>;
  /**
   * KARTI OLAN EĞİTİMDEKİ SADE KİP.
   *
   * Kapı eskiden YALNIZ bomboş eğitimde çiziliyordu (`sayfalar.length === 0`).
   * Tek kart eklendiği anda PDF/PPTX yükleme yolu ortadan kalkıyordu — oysa
   * iki eylem de kartları SONA EKLİYOR, gizlemenin teknik bir sebebi yok.
   * Kullanıcı bunu "yükleme çalışmıyor" diye bildirdi ve haklıydı: özellik
   * duruyordu, kapısı yoktu.
   *
   * Boş eğitimde büyük çağrı olarak kalıyor (ürünün en önemli tek özelliği,
   * ilk ekranda görünmeli); kart varken kart ekleme düğmelerinin yanında
   * sade bir düğmeye iniyor. TEK BİLEŞEN: ikinci bir kopya zamanla ayrışırdı.
   */
  sade?: boolean;
}) {
  const [durum, setDurum] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [not, setNot] = useState<string | null>(null);
  /* İKİ AYRI GİRDİ: tek girdiye iki türü birden kabul ettirmek, dosya
     seçicisinde "hangisini seçsem" sorusunu kullanıcıya geri veriyordu.
     Ayrı düğme = ayrı `accept` = seçicide yalnız doğru dosyalar. */
  const girdiPdf = useRef<HTMLInputElement>(null);
  const girdiPptx = useRef<HTMLInputElement>(null);
  const kilit = useRef(false);

  async function sec(e: React.ChangeEvent<HTMLInputElement>) {
    const dosya = e.target.files?.[0];
    e.target.value = "";
    if (!dosya || kilit.current) return;

    kilit.current = true;
    setHata(null);
    setNot(null);
    /* Tür DOSYA ADINDAN okunuyor, hangi düğmeye basıldığından değil:
       kullanıcı seçiciye "tüm dosyalar" deyip pptx de seçebiliyor. */
    const pptx = /\.pptx$/i.test(dosya.name);

    try {
      if (pptx) await pptxAktar(dosya, setDurum, setNot, onPptxKartlari);
      else await pdfAktar(dosya, setDurum, onPdfKartlari);
      setDurum(null);
    } catch (h) {
      setHata(
        h instanceof Error
          ? pptx
            ? `${h.message} Sunumu PowerPoint'te "PDF olarak kaydet" ile dışa aktarıp PDF olarak deneyin.`
            : h.message
          : "Dosya okunamadı.",
      );
      setDurum(null);
    } finally {
      kilit.current = false;
    }
  }

  /* Dosya girdisi ve geri bildirim şeritleri iki kipte de aynı — yalnız
     çevresindeki kabuk değişiyor. */
  const dosyaGirdileri = (
    <>
      <input ref={girdiPdf} type="file" accept="application/pdf,.pdf" onChange={sec} className="hidden" />
      <input
        ref={girdiPptx}
        type="file"
        accept="application/vnd.openxmlformats-officedocument.presentationml.presentation,.pptx"
        onChange={sec}
        className="hidden"
      />
    </>
  );
  const geriBildirim = (
    <>
      {durum ? (
        <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-accent" aria-live="polite">
          <Icon name="hourglass" size={16} /> {durum}
        </p>
      ) : null}
      {not ? (
        <p className="mt-3 rounded-flow border border-line bg-paper px-4 py-3 text-sm text-muted" aria-live="polite">
          {not}
        </p>
      ) : null}
      {hata ? (
        <p
          role="alert"
          className="mt-3 rounded-flow border border-brand/30 bg-brand-soft px-4 py-3 text-sm font-semibold text-brand-dark"
        >
          {hata}
        </p>
      ) : null}
    </>
  );

  if (sade) {
    return (
      <div className="w-full">
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => girdiPdf.current?.click()} disabled={!!durum} className="btn-ghost text-sm">
            <Icon name="upload" size={16} /> {durum ? "Çalışıyor…" : "PDF yükle"}
          </button>
          {/* İKİNCİL YOL SESSİZ DURUR: aynı ağırlıkta iki düğme, "hangisi
              doğru" sorusunu geri verirdi. */}
          <button
            onClick={() => girdiPptx.current?.click()}
            disabled={!!durum}
            className="text-sm text-muted underline underline-offset-2 hover:text-ink disabled:opacity-40"
          >
            PowerPoint&apos;ten metin aktar
          </button>
        </div>
        {dosyaGirdileri}
        {geriBildirim}
      </div>
    );
  }

  return (
    <div className="card border-dashed p-5">
      <div className="flex flex-wrap items-center gap-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-flow bg-accent-soft text-accent">
          <Icon name="upload" size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Elinizdeki dosyadan başlayın</p>
          {/* TEK YOL GÖSTERİLİYOR. Sunum için "önce PDF olarak kaydet" demek
              fazladan bir adım gibi duruyor ama sonucu kat kat iyi: slayt
              PowerPoint'in çizdiği gibi geliyor. */}
          <p className="text-sm text-muted">
            Her sayfa bir karta dönüşür. Sunumunuz varsa PowerPoint&apos;te{" "}
            <strong className="text-ink">Farklı kaydet → PDF</strong> deyip buraya o dosyayı yükleyin — slaytlar
            tablosuyla, şemasıyla, olduğu gibi gelir.
          </p>
        </div>
        <button onClick={() => girdiPdf.current?.click()} disabled={!!durum} className="btn-primary">
          <Icon name="upload" size={16} /> {durum ? "Çalışıyor…" : "PDF seç"}
        </button>
        {dosyaGirdileri}
      </div>

      {/* İKİNCİL YOL — bilerek seçilir, önerilmez. */}
      <p className="mt-3 border-t border-line pt-3 text-sm text-muted">
        Metni sonradan düzenlemek, çevirmek ya da ekran okuyucuya okutmak istiyorsanız{" "}
        <button
          onClick={() => girdiPptx.current?.click()}
          disabled={!!durum}
          className="font-semibold text-accent underline underline-offset-2 disabled:opacity-40"
        >
          PowerPoint dosyasından metin aktarabilirsiniz
        </button>
        . Bu yolda slaydın yerleşimi gelmez: tablolar ve şemalar düz metne iner.
      </p>

      {geriBildirim}
    </div>
  );
}

/* ── PDF ──────────────────────────────────────────────────────────────────── */

async function pdfAktar(
  dosya: File,
  setDurum: (s: string | null) => void,
  onBitti: (k: { gorselId: string; baslik: string }[]) => Promise<void>,
): Promise<void> {
  setDurum("PDF açılıyor…");
  const pdfjs = await import("pdfjs-dist");
  // İşçi dosyası KENDİ sunucumuzdan gelir (`public/pdf.worker.min.mjs`,
  // `npm run pdf-isci` ile kopyalanır). İki sebep: (1) CDN'den worker
  // çekmek kapalı ağda sessizce takılır ve "yükleme hiç bitmiyor" görünür;
  // (2) `new URL(..., import.meta.url)` ile paketleyiciye gömdürmek
  // derlemeyi patlatıyor — minifiye .mjs'i SWC ayrıştıramıyor.
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const belge = await pdfjs.getDocument({ data: await dosya.arrayBuffer() }).promise;
  const kartlar: { gorselId: string; baslik: string }[] = [];

  for (let n = 1; n <= belge.numPages; n++) {
    setDurum(`Sayfa ${n}/${belge.numPages} dönüştürülüyor…`);
    const sayfa = await belge.getPage(n);

    // Ölçek 2: kiosk ekranında okunacak, 1'de metin bulanık çıkıyor.
    const olcek = sayfa.getViewport({ scale: 2 });
    const tuval = document.createElement("canvas");
    tuval.width = Math.min(olcek.width, 2200);
    tuval.height = Math.round((tuval.width / olcek.width) * olcek.height);
    const goruntu = sayfa.getViewport({ scale: (tuval.width / olcek.width) * 2 });
    /* YALNIZ `canvas` VERİLİR — eskiden `canvasContext` de birlikte
       gönderiliyordu. pdf.js'in kendi sözleşmesi bunu desteklemiyor:
       `canvasContext` geriye dönük uyumluluk içindir ve kullanılacaksa
       `canvas` null olmak ZORUNDA (bkz. pdfjs-dist RenderParameters).
       Eski hâlin gerçek tarayıcıda bozuk olduğu ÖLÇÜLMEDİ; burada sözleşmeye
       uyuluyor, o kadar. */
    await sayfa.render({ canvas: tuval, viewport: goruntu }).promise;

    const parca = await new Promise<Blob | null>((c) => tuval.toBlob(c, "image/jpeg", 0.86));
    if (!parca) throw new Error(`Sayfa ${n} görüntüye çevrilemedi.`);

    const id = await medyaYukle(new File([parca], `s${n}.jpg`, { type: "image/jpeg" }));
    kartlar.push({ gorselId: id, baslik: (await sayfaBasligi(sayfa)) || `${dosya.name.replace(/\.pdf$/i, "")} — ${n}` });
  }

  setDurum(`${kartlar.length} sayfa ekleniyor…`);
  await onBitti(kartlar);
}

/**
 * PDF sayfasının METİN KATMANINDAN başlık çıkarır.
 *
 * Sayfa görüntüye çevriliyor ama metin katmanı hâlâ orada duruyor ve bugüne
 * kadar hiç okunmuyordu; kartlar `talimat — 1` diye doğuyordu. Seçim mantığı
 * `pdfBaslik.ts`te ve sınavlı — burada yalnız pdf.js'in parça biçimi o
 * modülün beklediği şekle çevriliyor.
 *
 * TARANMIŞ PDF'TE METİN KATMANI YOKTUR (fotokopi → PDF, ki fabrikada çok
 * yaygın). O durumda liste boş gelir, işlev boş döner ve çağıran dosya adına
 * düşer. Bu bir hata değil; sessizce eski davranışa dönmek doğru olan.
 *
 * `x/y/boy` dönüşüm matrisinden: `[4]` yatay, `[5]` dikey konum, `[3]` dikey
 * ölçek yani punto. `height` alanı bazı pdf.js sürümlerinde 0 geliyor, o
 * yüzden matris önce denenir.
 */
async function sayfaBasligi(sayfa: { getTextContent: () => Promise<{ items: unknown[] }> }): Promise<string> {
  try {
    const icerik = await sayfa.getTextContent();
    const parcalar: PdfMetinParcasi[] = [];
    for (const ham of icerik.items) {
      const o = ham as { str?: string; transform?: number[]; height?: number };
      if (typeof o.str !== "string" || !o.transform) continue;
      parcalar.push({
        metin: o.str,
        x: o.transform[4] ?? 0,
        y: o.transform[5] ?? 0,
        boy: Math.abs(o.transform[3] ?? 0) || o.height || 1,
      });
    }
    return pdfSayfaBasligi(parcalar);
  } catch {
    /* Metin katmanı okunamadıysa aktarım DURMAZ: kartların görüntüsü zaten
       hazır, başlık ikincil. Dosya adına düşmek yeterli. */
    return "";
  }
}

/* ── PPTX ─────────────────────────────────────────────────────────────────── */

async function pptxAktar(
  dosya: File,
  setDurum: (s: string | null) => void,
  setNot: (s: string | null) => void,
  onBitti: (k: { baslik: string; metin: string; gorselIdler: string[] }[]) => Promise<void>,
): Promise<void> {
  setDurum("Sunum açılıyor…");
  const { slaytlar, atlanan } = await pptxCoz(await dosya.arrayBuffer());

  const taban = dosya.name.replace(/\.pptx$/i, "");
  const kartlar: { baslik: string; metin: string; gorselIdler: string[] }[] = [];
  /* Aynı görsel birden çok slaytta geçebilir (bölüm ayracı, ikon). Bir kez
     yükleyip kimliği paylaşmak hem diski hem yükleme süresini yarıya indiriyor. */
  const yuklenen = new Map<string, string>();

  for (let n = 0; n < slaytlar.length; n++) {
    const s = slaytlar[n];
    // BOŞ SLAYT ATLANIR: bölüm ayracı ve kapak slaytları çoğu sunumda
    // görselsiz ve metinsizdir; boş kart hazırlayana silinecek iş çıkarır.
    if (!s.baslik && !s.metin && s.gorseller.length === 0) continue;

    setDurum(`Slayt ${n + 1}/${slaytlar.length} aktarılıyor…`);
    const gorselIdler: string[] = [];
    for (const g of s.gorseller) {
      const varOlan = yuklenen.get(g.ad);
      if (varOlan) {
        if (!gorselIdler.includes(varOlan)) gorselIdler.push(varOlan);
        continue;
      }
      const id = await medyaYukle(dosyayaCevir(g));
      yuklenen.set(g.ad, id);
      gorselIdler.push(id);
    }
    kartlar.push({ baslik: s.baslik || `${taban} — ${n + 1}`, metin: s.metin, gorselIdler });
  }

  if (kartlar.length === 0) throw new Error("Sunumda karta dönüştürülebilecek içerik bulunamadı.");

  setDurum(`${kartlar.length} kart ekleniyor…`);
  await onBitti(kartlar);

  /* NE GELMEDİĞİ SÖYLENİR. Sessizce düşen içerik, hazırlayanın ancak kioskta
     fark ettiği bir eksiktir; burada söylenirse eksik slaydı elle tamamlar. */
  const notlar: string[] = [`${kartlar.length} kart eklendi.`];
  if (slaytlar.length > kartlar.length) notlar.push(`${slaytlar.length - kartlar.length} boş slayt atlandı.`);
  if (atlanan.length > 0) {
    notlar.push(
      `${atlanan.length} resim aktarılamadı (Office'in EMF/WMF gibi kendine özgü biçimleri). ` +
        "Gerekliyse o resimleri PowerPoint'te sağ tıklayıp PNG olarak kaydedip elle ekleyin.",
    );
  }
  notlar.push("Slaydın yerleşimi, teması ve konuşmacı notları GELMEZ — metin ve resimler gelir.");
  setNot(notlar.join(" "));
}

/** PPTX görselini yükleme kapısının beklediği `File`a çevirir. */
function dosyayaCevir(g: PptxGorsel): File {
  const ad = g.ad.slice(g.ad.lastIndexOf("/") + 1);
  return new File([new Uint8Array(g.veri) as BlobPart], ad, { type: g.tur });
}

/**
 * Tek dosyayı medya kapısına yükler, kimliğini döndürür.
 *
 * KÜTÜPHANEYE GİRMEZ (`kutuphane=hayir`): kırk slaytlık bir sunum kütüphaneyi
 * kırk tane `image7.png` ile doldurur, yeniden kullanılacak fotoğraf aralarında
 * kaybolur. Bu görseller zaten kendi kartlarına bağlı.
 */
async function medyaYukle(dosya: File): Promise<string> {
  const form = new FormData();
  form.append("dosya", dosya);
  form.append("kutuphane", "hayir");
  const cevap = await fetch(yol("/api/medya"), { method: "POST", body: form });
  const sonuc = await cevap.json();
  if (!cevap.ok) throw new Error(sonuc.hata ?? "Yükleme başarısız.");
  return sonuc.id as string;
}
