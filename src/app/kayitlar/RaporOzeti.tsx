"use client";

import Icon from "@/components/Icon";
import type { AktarimRaporu } from "@/lib/kayitAktarim";

/**
 * ÇÖZÜMLEME RAPORU — sınıf kaydı ve geçmiş aktarımı AYNI raporu gösterir.
 *
 * HER ATLANAN SATIR SEBEBİYLE BİRLİKTE LİSTELENİR. "412 kayıt alındı" demek
 * kolaydı; asıl soru atlanan 38'in hangileri olduğu. Sessizce düşen bir satır
 * denetimde "o kişi eğitimi almadı" demektir — bunu ekranda göstermeyen bir
 * aktarım aracı, veriyi kaybetmenin en sessiz yoludur.
 */
export default function RaporOzeti({ rapor, yazilan }: { rapor: AktarimRaporu; yazilan?: number }) {
  const atlananlar = rapor.satirlar.filter((s) => s.durum === "atlandi");
  const uyarililar = rapor.satirlar.filter((s) => s.durum === "gecerli" && !!s.uyari);

  return (
    <div className="mt-4 space-y-3">
      <div
        className={`rounded-xl border px-4 py-3 text-sm ${
          yazilan !== undefined ? "border-iyi/40 bg-iyi/10" : "border-line bg-wash"
        }`}
      >
        <p className="font-semibold">
          {yazilan !== undefined ? (
            <>
              {yazilan} kayıt deftere yazıldı
              {rapor.atlanan > 0 ? `, ${rapor.atlanan} satır atlandı.` : "."}
            </>
          ) : (
            <>
              {rapor.gecerli} satır yazılacak
              {rapor.atlanan > 0 ? `, ${rapor.atlanan} satır atlanacak.` : "."}
            </>
          )}
        </p>
        {uyarililar.length > 0 ? (
          <p className="mt-1 text-muted">{uyarililar.length} satır uyarılı — yazılır ama kontrol edilmeli.</p>
        ) : null}
      </div>

      {uyarililar.length > 0 ? (
        <ul className="space-y-1 text-sm">
          {uyarililar.slice(0, 50).map((s) => (
            <li key={`u${s.satirNo}`} className="rounded-lg border border-orta/40 bg-orta/5 px-3 py-2">
              <span className="font-mono text-xs text-muted">satır {s.satirNo}</span>{" "}
              <span className="font-semibold">{s.ozet}</span>
              <span className="ml-1 text-orta-dark">— {s.uyari}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {atlananlar.length > 0 ? (
        <details open className="card p-4">
          <summary className="cursor-pointer text-sm font-semibold">
            <Icon name="warning" size={14} className="inline text-brand" /> Atlanan {atlananlar.length} satır
          </summary>
          <ul className="mt-3 space-y-1 text-sm">
            {atlananlar.slice(0, 200).map((s) => (
              <li key={`a${s.satirNo}-${s.ozet}`} className="flex flex-wrap gap-x-2 border-b border-line py-1.5 last:border-0">
                <span className="font-mono text-xs text-muted">satır {s.satirNo}</span>
                <span className="font-semibold">{s.ozet}</span>
                <span className="text-brand-dark">{s.sebep}</span>
              </li>
            ))}
          </ul>
          {atlananlar.length > 200 ? (
            <p className="mt-2 text-xs text-muted">İlk 200 satır gösteriliyor.</p>
          ) : null}
        </details>
      ) : null}
    </div>
  );
}
