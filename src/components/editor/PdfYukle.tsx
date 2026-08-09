"use client";

import { useRef, useState } from "react";
import Icon from "@/components/Icon";

/**
 * "YÜKLE" KAPISI — ürünün en önemli tek özelliği.
 *
 * İçerik üretmeyi kolaylaştırmaya çalışmıyoruz, üretmeyi ORTADAN KALDIRIYORUZ:
 * fabrikada ISG sunumu, kalite talimatı, prosedür PDF'i zaten var. "Gel bunları
 * bizim editörde yeniden yaz" demek uyarlamayı öldürür. Elindeki PDF'i at,
 * her sayfa bir karta dönüşsün.
 *
 * ÇEVİRİM TARAYICIDA YAPILIR (pdfjs + canvas): sunucuya PDF ayrıştırıcı,
 * ImageMagick, Ghostscript kurmaya gerek yok — kapalı ağda "önce şu paketi
 * kurun" diyen her adım kurulumu haftalarca geciktirir.
 *
 * PPTX YOK (bilinçli): PowerPoint'te "PDF olarak kaydet" tek tıktır ve
 * kendi çizim motorumuzla slaytları yeniden çizmeye çalışmak — yazı tipi,
 * animasyon, SmartArt — bitmeyen bir kuyudur.
 */
export default function PdfYukle({
  egitimId,
  onBitti,
}: {
  egitimId: string;
  onBitti: (kartlar: { gorselId: string; baslik: string }[]) => Promise<void>;
}) {
  const [durum, setDurum] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const girdi = useRef<HTMLInputElement>(null);
  const kilit = useRef(false);

  async function sec(e: React.ChangeEvent<HTMLInputElement>) {
    const dosya = e.target.files?.[0];
    e.target.value = "";
    if (!dosya || kilit.current) return;

    kilit.current = true;
    setHata(null);
    setDurum("PDF açılıyor…");

    try {
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

        const form = new FormData();
        form.append("dosya", new File([parca], `s${n}.jpg`, { type: "image/jpeg" }));
        // Kütüphaneye GİRMESİN: kırk sayfalık sunum kütüphaneyi kırk tane
        // `s7.jpg` ile doldurur, yeniden kullanılacak fotoğraf aralarında
        // kaybolur. Bu görseller zaten kendi kartlarına bağlı.
        form.append("kutuphane", "hayir");
        const cevap = await fetch("/api/medya", { method: "POST", body: form });
        const sonuc = await cevap.json();
        if (!cevap.ok) throw new Error(sonuc.hata ?? "Yükleme başarısız.");

        kartlar.push({ gorselId: sonuc.id, baslik: `${dosya.name.replace(/\.pdf$/i, "")} — ${n}` });
      }

      setDurum(`${kartlar.length} sayfa ekleniyor…`);
      await onBitti(kartlar);
      setDurum(null);
    } catch (h) {
      setHata(h instanceof Error ? h.message : "PDF okunamadı.");
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
            PDF yükleyin — her sayfa bir karta dönüşür. (PowerPoint için: &quot;PDF olarak kaydet&quot;.)
          </p>
        </div>
        <button onClick={() => girdi.current?.click()} disabled={!!durum} className="btn-ghost">
          {durum ? "Çalışıyor…" : "PDF seç"}
        </button>
        <input ref={girdi} type="file" accept="application/pdf" onChange={sec} className="hidden" />
      </div>

      {durum ? (
        <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-accent" aria-live="polite">
          <Icon name="hourglass" size={16} /> {durum}
        </p>
      ) : null}
      {hata ? (
        <p role="alert" className="mt-4 rounded-xl border border-brand/30 bg-brand-soft px-4 py-3 text-sm font-semibold text-brand-dark">
          {hata}
        </p>
      ) : null}
    </div>
  );
}
