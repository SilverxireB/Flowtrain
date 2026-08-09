"use client";

import { useRef, useState } from "react";
import Icon from "@/components/Icon";
import { pptxCoz, type PptxGorsel } from "@/lib/pptx";

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
 */
export default function IceriAktar({
  onPdfKartlari,
  onPptxKartlari,
}: {
  /** PDF: sayfa görüntüsü + türetilmiş başlık. */
  onPdfKartlari: (kartlar: { gorselId: string; baslik: string }[]) => Promise<void>;
  /** PPTX: gerçek metin kartları. */
  onPptxKartlari: (kartlar: { baslik: string; metin: string; gorselIdler: string[] }[]) => Promise<void>;
}) {
  const [durum, setDurum] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [not, setNot] = useState<string | null>(null);
  const girdi = useRef<HTMLInputElement>(null);
  const kilit = useRef(false);

  async function sec(e: React.ChangeEvent<HTMLInputElement>) {
    const dosya = e.target.files?.[0];
    e.target.value = "";
    if (!dosya || kilit.current) return;

    kilit.current = true;
    setHata(null);
    setNot(null);
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

  return (
    <div className="card border-dashed p-5">
      <div className="flex flex-wrap items-center gap-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
          <Icon name="upload" size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Elinizdeki dosyadan başlayın</p>
          <p className="text-sm text-muted">
            <strong className="text-ink">PowerPoint (.pptx)</strong> — her slaydın başlığı, metni ve resimleri
            düzenlenebilir karta dönüşür. <strong className="text-ink">PDF</strong> — her sayfa görüntü olarak
            eklenir; metni sonradan değiştiremezsiniz.
          </p>
        </div>
        <button onClick={() => girdi.current?.click()} disabled={!!durum} className="btn-ghost">
          {durum ? "Çalışıyor…" : "Dosya seç"}
        </button>
        <input
          ref={girdi}
          type="file"
          accept="application/pdf,.pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation,.pptx"
          onChange={sec}
          className="hidden"
        />
      </div>

      {durum ? (
        <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-accent" aria-live="polite">
          <Icon name="hourglass" size={16} /> {durum}
        </p>
      ) : null}
      {not ? (
        <p className="mt-4 rounded-xl border border-line bg-paper px-4 py-3 text-sm text-muted" aria-live="polite">
          {not}
        </p>
      ) : null}
      {hata ? (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-brand/30 bg-brand-soft px-4 py-3 text-sm font-semibold text-brand-dark"
        >
          {hata}
        </p>
      ) : null}
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
    const ctx = tuval.getContext("2d")!;
    const goruntu = sayfa.getViewport({ scale: (tuval.width / olcek.width) * 2 });
    await sayfa.render({ canvas: tuval, canvasContext: ctx, viewport: goruntu }).promise;

    const parca = await new Promise<Blob | null>((c) => tuval.toBlob(c, "image/jpeg", 0.86));
    if (!parca) throw new Error(`Sayfa ${n} görüntüye çevrilemedi.`);

    const id = await medyaYukle(new File([parca], `s${n}.jpg`, { type: "image/jpeg" }));
    kartlar.push({ gorselId: id, baslik: `${dosya.name.replace(/\.pdf$/i, "")} — ${n}` });
  }

  setDurum(`${kartlar.length} sayfa ekleniyor…`);
  await onBitti(kartlar);
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
  const cevap = await fetch("/api/medya", { method: "POST", body: form });
  const sonuc = await cevap.json();
  if (!cevap.ok) throw new Error(sonuc.hata ?? "Yükleme başarısız.");
  return sonuc.id as string;
}
