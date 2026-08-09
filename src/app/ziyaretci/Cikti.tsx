"use client";

import { useState } from "react";
import Icon from "@/components/Icon";
import { useToast } from "@/components/Toast";
import { ziyaretciPdfIndir, type ZiyaretciPdfSatiri } from "@/lib/ziyaretciPdf";

/**
 * ZİYARETÇİ DEFTERİ ÇIKTISI.
 *
 * İKİ BİÇİM, İKİ İŞ: CSV denetim BELGESİdir (tam liste, Excel'de süzülür);
 * PDF kapıdaki klasöre kaldırılacak okunur listedir. Birini ötekinin yerine
 * saymak, ilk denetimde eksik belge demek olurdu.
 *
 * ARALIK TEK YERDE SEÇİLİR ve iki çıktı da onu kullanır — ekranda "PDF hangi
 * aralığı aldı" sorusunu bırakmamak için.
 */
const ARALIKLAR: { gun: number; etiket: string }[] = [
  { gun: 1, etiket: "Bugün" },
  { gun: 7, etiket: "Son 7 gün" },
  { gun: 30, etiket: "Son 30 gün" },
  { gun: 90, etiket: "Son 90 gün" },
  { gun: 0, etiket: "Tümü" },
];

export default function Cikti() {
  const [gun, setGun] = useState(30);
  const [mesgul, setMesgul] = useState(false);
  const { show, toast } = useToast();

  const etiket = ARALIKLAR.find((a) => a.gun === gun)?.etiket ?? "";

  async function pdfIndir() {
    if (mesgul) return;
    setMesgul(true);
    show("PDF hazırlanıyor…", "busy");
    try {
      const c = await fetch(`/api/ziyaretci/disa-aktar?bicim=json&gun=${gun}`);
      if (!c.ok) throw new Error(String(c.status));
      const veri = (await c.json()) as { satirlar: ZiyaretciPdfSatiri[]; tarih: string };
      if (veri.satirlar.length === 0) {
        show("Bu aralıkta kayıt yok.", "error");
        return;
      }
      await ziyaretciPdfIndir(veri.satirlar, veri.tarih, etiket);
      show("PDF indirildi.");
    } catch {
      // Sebebi söylemek gerekir: sessiz bir "hiçbir şey olmadı", kullanıcıya
      // düğmenin bozuk olduğunu düşündürüyordu.
      show("Çıktı alınamadı. Bağlantıyı kontrol edip tekrar deneyin.", "error");
    } finally {
      setMesgul(false);
    }
  }

  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-semibold">Defteri dışa aktar</h2>
          <p className="mt-1 text-sm text-muted">
            CSV denetim belgesidir (tam liste); PDF kapıdaki klasöre kaldırılacak özet listedir.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block font-semibold">Aralık</span>
            <select
              value={gun}
              onChange={(e) => setGun(Number(e.target.value))}
              className="input-base py-2 text-sm"
            >
              {ARALIKLAR.map((a) => (
                <option key={a.gun} value={a.gun}>
                  {a.etiket}
                </option>
              ))}
            </select>
          </label>

          {/* CSV doğrudan bağlantı: tarayıcının kendi indirmesi, ara bellek yok. */}
          <a href={`/api/ziyaretci/disa-aktar?gun=${gun}`} className="btn-ghost text-sm" download>
            <Icon name="download" size={16} /> CSV
          </a>
          <button onClick={pdfIndir} disabled={mesgul} className="btn-primary text-sm">
            <Icon name="print" size={16} /> {mesgul ? "Hazırlanıyor…" : "PDF"}
          </button>
        </div>
      </div>
      {toast}
    </section>
  );
}
