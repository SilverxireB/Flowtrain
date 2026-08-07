"use client";

import Link from "next/link";
import { useTransition } from "react";
import Icon from "@/components/Icon";
import { useConfirm } from "@/components/ConfirmDialog";
import { ziyaretciSilEylem } from "./eylemler";
import { ZIYARETCI_DURUM_ETIKET, type Ziyaretci, type ZiyaretciIlerleme } from "@/lib/ziyaretci";

/**
 * Listedeki tek ziyaretçi.
 *
 * Tamamlanmamış kayıtta "Tableti aç" HER ZAMAN açıktır: ziyaretçinin deneme
 * hakkı yoktur, tablet kilitlenirse ya da sayfa yenilenirse aynı yerden devam
 * edilir (sunucu yarım oturumu yeniden kullanır).
 */
export default function ZiyaretciSatiri({
  ziyaretci,
  ilerleme,
  egitimAdlari,
}: {
  ziyaretci: Ziyaretci;
  ilerleme: ZiyaretciIlerleme;
  egitimAdlari: string[];
}) {
  const [bekliyor, calistir] = useTransition();
  const { confirm, dialog } = useConfirm();
  const tamam = ilerleme.durum === "tamam";

  function sil() {
    confirm(
      {
        title: "Ziyaretçi kaydı silinsin mi?",
        message: `${ziyaretci.ad} kaydı ve verilen bilgilendirmelerin kaydı birlikte silinir. Bu geri alınamaz.`,
        confirmLabel: "Sil",
        danger: true,
      },
      () => calistir(() => void ziyaretciSilEylem(ziyaretci.id)),
    );
  }

  return (
    <li className="card p-4">
      <div className="flex flex-wrap items-start gap-3">
        <span
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${
            tamam ? "bg-iyi/10 text-iyi-dark" : "bg-accent-soft text-accent-dark"
          }`}
        >
          <Icon name={tamam ? "check" : "clock"} size={20} />
        </span>

        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            {ziyaretci.ad}
            {ziyaretci.firma ? <span className="font-normal text-muted"> · {ziyaretci.firma}</span> : null}
          </p>
          <p className="mt-0.5 text-sm text-muted">
            {new Date(ziyaretci.kayitZamani).toLocaleTimeString("tr", { hour: "2-digit", minute: "2-digit" })}
            {ziyaretci.ziyaretEttigi ? ` · ${ziyaretci.ziyaretEttigi} ziyareti` : ""}
            {" · "}
            {ZIYARETCI_DURUM_ETIKET[ilerleme.durum]} {ilerleme.biten}/{ilerleme.toplam}
          </p>
          <p className="mt-1 truncate text-xs text-muted">{egitimAdlari.join(" › ")}</p>
        </div>

        <div className="flex items-center gap-2">
          {tamam ? (
            <span className="chip border-iyi/40 bg-iyi/5 text-xs text-iyi-dark">
              <Icon name="check" size={14} />
              {ziyaretci.tamamlanma
                ? new Date(ziyaretci.tamamlanma).toLocaleTimeString("tr", { hour: "2-digit", minute: "2-digit" })
                : "Tamam"}
            </span>
          ) : (
            <Link href={`/ziyaretci/oyna/${ziyaretci.id}`} className="btn-primary text-sm">
              <Icon name="play" size={16} /> Tableti aç
            </Link>
          )}
          <button onClick={sil} disabled={bekliyor} className="btn-icon hover:text-brand" aria-label="Kaydı sil">
            <Icon name="trash" size={16} />
          </button>
        </div>
      </div>
      {dialog}
    </li>
  );
}
