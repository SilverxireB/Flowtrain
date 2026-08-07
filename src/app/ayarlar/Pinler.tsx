"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { useConfirm } from "@/components/ConfirmDialog";
import { pinSifirlaEylem } from "@/app/eylemler";
import { eslesir } from "@/lib/arama";

/**
 * PIN yönetimi.
 *
 * SIFIRLAMA YOLU OLMAK ZORUNDA: PIN kişinin imzasıdır ve unutulur. Ayrıca ilk
 * PIN "güven-ilk-kullanımda" belirlendiği için, bir başkası tarafından
 * belirlenmiş olma ihtimali her zaman vardır — kişinin kendi imzasına geri
 * dönmesinin başka yolu yok. Sıfırlama denetim izine düşer.
 */
export default function Pinler({
  kayitlar,
  adlar,
}: {
  kayitlar: { sicil: string; olusturma: string; kilitli: boolean }[];
  adlar: Record<string, string>;
}) {
  const router = useRouter();
  const [bekle, gecis] = useTransition();
  const { confirm, dialog } = useConfirm();
  const [sorgu, setSorgu] = useState("");

  const suzulmus = useMemo(
    () => kayitlar.filter((k) => eslesir(adlar[k.sicil] ?? "", sorgu) || eslesir(k.sicil, sorgu)),
    [kayitlar, adlar, sorgu],
  );

  if (kayitlar.length === 0) {
    return <p className="card p-6 text-sm text-muted">Henüz kimse PIN belirlemedi.</p>;
  }

  return (
    <div className="space-y-3">
      <input
        value={sorgu}
        onChange={(e) => setSorgu(e.target.value)}
        placeholder="Ada veya sicile göre ara"
        className="input-base"
        aria-label="PIN kayıtlarında ara"
      />

      <ul className="card divide-y divide-line">
        {suzulmus.slice(0, 50).map((k) => (
          <li key={k.sicil} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{adlar[k.sicil] ?? k.sicil}</span>
              <span className="block text-sm text-muted">
                Sicil {k.sicil} · {k.olusturma.slice(0, 10)}
              </span>
            </span>
            {k.kilitli ? (
              <span className="chip border-orta/40 bg-orta/10 text-xs text-orta-dark">
                <Icon name="lock" size={14} /> Kilitli
              </span>
            ) : null}
            <button
              onClick={() =>
                confirm(
                  {
                    title: "PIN sıfırlansın mı?",
                    message: `${adlar[k.sicil] ?? k.sicil} bir sonraki eğitiminde yeni bir PIN belirleyecek. Geçmiş kayıtlar etkilenmez.`,
                    danger: true,
                    confirmLabel: "Sıfırla",
                  },
                  () => gecis(async () => (await pinSifirlaEylem(k.sicil), router.refresh())),
                )
              }
              disabled={bekle}
              className="btn-ghost text-sm"
            >
              <Icon name="refresh" size={16} /> Sıfırla
            </button>
          </li>
        ))}
        {suzulmus.length === 0 ? <li className="px-4 py-6 text-center text-muted">Eşleşen kayıt yok.</li> : null}
      </ul>
      {suzulmus.length > 50 ? (
        <p className="text-xs text-muted">İlk 50 kayıt gösteriliyor — aramayı daraltın.</p>
      ) : null}
      {dialog}
    </div>
  );
}
