"use client";

import { useMemo, useState } from "react";
import Icon from "@/components/Icon";
import { eslesir } from "@/lib/arama";

export interface EtiketVerisi {
  id: string;
  ad: string;
  kategori: string;
  yayinda: boolean;
  baglanti: string;
  /** SVG `path` verisi — modül birimi 1. */
  yol: string;
  /** viewBox kenarı (sessiz alan dâhil). */
  kenar: number;
}

/**
 * YAZDIRMA YALNIZ CSS İLE.
 *
 * Dış kütüphane yok (kapalı ağ), ekran görüntüsü yok, sunucuda PDF üretimi yok:
 * tarayıcının kendi yazdırma penceresi hem A4'ü hem yazıcıyı zaten biliyor.
 * `@page` kenar boşluğunu, `break-inside: avoid` bir etiketin iki sayfaya
 * bölünmesini, `.yazdirma-gizle` de süzgeç/başlık gibi ekrana ait her şeyi
 * halleder.
 *
 * `-webkit-print-color-adjust` ŞART: tarayıcıların bir kısmı "mürekkep
 * tasarrufu" için zemin dolgularını basmaz. QR kodun zemini beyaz olduğu için
 * sorun çıkarmaz ama kenarlık ve etiket çerçevesi kayboluyordu.
 */
const YAZDIRMA_CSS = `
@page { size: A4 portrait; margin: 10mm; }
@media print {
  .yazdirma-gizle { display: none !important; }
  html, body { background: #fff !important; }
  .etiket-izgara { grid-template-columns: repeat(3, 1fr) !important; gap: 4mm !important; }
  .etiket {
    break-inside: avoid;
    page-break-inside: avoid;
    box-shadow: none !important;
    border-color: #999 !important;
  }
  .etiket, .etiket * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`;

export default function Etiketler({ etiketler, kategoriler }: { etiketler: EtiketVerisi[]; kategoriler: string[] }) {
  // Taslaklar seçili GELMEZ: kioskta açılmayan bir eğitimin etiketi ölü bağlantı.
  const [secili, setSecili] = useState<Set<string>>(() => new Set(etiketler.filter((e) => e.yayinda).map((e) => e.id)));
  const [sorgu, setSorgu] = useState("");
  const [kategori, setKategori] = useState("");
  const [adresGoster, setAdresGoster] = useState(false);

  const suzulmus = useMemo(
    () => etiketler.filter((e) => (!kategori || e.kategori === kategori) && (eslesir(e.ad, sorgu) || eslesir(e.kategori, sorgu))),
    [etiketler, sorgu, kategori],
  );

  const basilacak = etiketler.filter((e) => secili.has(e.id));

  function degistir(id: string) {
    setSecili((s) => {
      const y = new Set(s);
      if (y.has(id)) y.delete(id);
      else y.add(id);
      return y;
    });
  }

  return (
    <div>
      <style dangerouslySetInnerHTML={{ __html: YAZDIRMA_CSS }} />

      <section className="yazdirma-gizle mt-6">
        <div className="flex flex-wrap items-center gap-3">
          <label className="min-w-[14rem] flex-1">
            <span className="sr-only">Eğitim ara</span>
            <input
              value={sorgu}
              onChange={(e) => setSorgu(e.target.value)}
              placeholder="Eğitim adı ya da kategori"
              className="input-base"
            />
          </label>
          <label className="shrink-0">
            <span className="sr-only">Kategori süzgeci</span>
            <select value={kategori} onChange={(e) => setKategori(e.target.value)} className="input-base w-auto">
              <option value="">Tüm kategoriler</option>
              {kategoriler.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => setSecili(new Set([...secili, ...suzulmus.map((e) => e.id)]))}
            className="btn-ghost text-sm"
          >
            Görünenleri seç
          </button>
          <button type="button" onClick={() => setSecili(new Set())} className="btn-ghost text-sm">
            Seçimi temizle
          </button>
        </div>

        <ul className="card mt-4 divide-y divide-line p-0">
          {suzulmus.length === 0 ? (
            <li className="p-8 text-center text-muted">Eşleşen eğitim yok.</li>
          ) : (
            suzulmus.map((e) => (
              <li key={e.id}>
                <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-wash">
                  <input
                    type="checkbox"
                    checked={secili.has(e.id)}
                    onChange={() => degistir(e.id)}
                    className="h-4 w-4 accent-accent"
                  />
                  <span className="min-w-0 flex-1 truncate font-semibold">{e.ad}</span>
                  {e.kategori ? <span className="shrink-0 text-xs text-muted">{e.kategori}</span> : null}
                  {e.yayinda ? null : (
                    <span className="chip shrink-0 border-orta/40 bg-orta/10 text-[11px] text-orta-dark">
                      <Icon name="warning" size={11} /> Taslak — kioskta açılmaz
                    </span>
                  )}
                </label>
              </li>
            ))
          )}
        </ul>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={adresGoster}
              onChange={(e) => setAdresGoster(e.target.checked)}
              className="h-4 w-4 accent-accent"
            />
            Etikete adresi de yaz
            <span className="text-xs">(okuyucu çalışmazsa elle girilebilsin)</span>
          </label>
          <span className="ml-auto flex items-center gap-3">
            <span className="text-sm text-muted">
              <strong className="text-ink">{basilacak.length}</strong> etiket seçili
            </span>
            <button
              type="button"
              onClick={() => window.print()}
              disabled={basilacak.length === 0}
              className="btn-primary text-sm"
            >
              <Icon name="print" size={16} /> Yazdır
            </button>
          </span>
        </div>
      </section>

      {basilacak.length > 0 ? (
        <div className="etiket-izgara mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {basilacak.map((e) => (
            <div key={e.id} className="etiket card flex flex-col items-center gap-2 p-4 text-center">
              <svg
                viewBox={`0 0 ${e.kenar} ${e.kenar}`}
                className="h-auto w-full max-w-[38mm]"
                shapeRendering="crispEdges"
                role="img"
                aria-label={`${e.ad} eğitimini açan QR kod`}
              >
                <rect width={e.kenar} height={e.kenar} fill="#ffffff" />
                <path d={e.yol} fill="#18181b" />
              </svg>
              <p className="text-sm font-bold leading-tight">{e.ad}</p>
              {e.kategori ? <p className="text-xs text-muted">{e.kategori}</p> : null}
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">Okut ve eğitime başla</p>
              {adresGoster ? <p className="break-all font-mono text-[9px] text-muted">{e.baglanti}</p> : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="yazdirma-gizle card mt-8 p-8 text-center text-muted">
          Yazdırılacak etiket seçin — seçtikleriniz burada önizlenir.
        </p>
      )}
    </div>
  );
}
