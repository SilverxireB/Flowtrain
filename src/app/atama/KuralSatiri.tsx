"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { useConfirm } from "@/components/ConfirmDialog";
import { kuralDurumEylem, kuralSilEylem } from "@/app/eylemler";
import type { Kural } from "@/lib/tipler";

export default function KuralSatiri({
  kural,
  egitimAdi,
  yayinda,
  kisiSayisi,
}: {
  kural: Kural;
  egitimAdi: string;
  yayinda: boolean;
  kisiSayisi: number;
}) {
  const router = useRouter();
  const [bekle, gecis] = useTransition();
  const { confirm, dialog } = useConfirm();

  const parcalar: string[] = [];
  if (kural.kosul.bolum?.length) parcalar.push(`Bölüm: ${kural.kosul.bolum.join(", ")}`);
  if (kural.kosul.hat?.length) parcalar.push(`Hat: ${kural.kosul.hat.join(", ")}`);
  if (kural.kosul.gorev?.length) parcalar.push(`Görev: ${kural.kosul.gorev.join(", ")}`);
  if (kural.kosul.iseGirisIcindeGun) parcalar.push(`İşe girişten ${kural.kosul.iseGirisIcindeGun} gün içinde`);
  if (kural.sonTarih) parcalar.push(`Son tarih: ${kural.sonTarih}`);

  return (
    <li className={`card p-5 ${kural.aktif ? "" : "opacity-60"}`}>
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{egitimAdi}</p>
          <p className="mt-1 text-sm text-muted">{parcalar.length ? parcalar.join(" · ") : "Tüm personel"}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="chip text-xs">
              <Icon name="users" size={14} /> {kisiSayisi} kişi
            </span>
            {!yayinda ? (
              <span className="chip border-orta/40 bg-orta/10 text-xs text-orta">
                <Icon name="warning" size={14} /> Eğitim taslakta — kimseye düşmüyor
              </span>
            ) : null}
            {!kural.aktif ? <span className="chip text-xs text-muted">Kapalı</span> : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => gecis(async () => (await kuralDurumEylem(kural.id, !kural.aktif), router.refresh()))}
            disabled={bekle}
            className="btn-ghost text-sm"
          >
            {kural.aktif ? "Kapat" : "Aç"}
          </button>
          <button
            onClick={() =>
              confirm(
                {
                  title: "Kural silinsin mi?",
                  message: `${kisiSayisi} kişinin ataması kalkar. Tamamlanmış kayıtlar SİLİNMEZ.`,
                  danger: true,
                },
                () => gecis(async () => (await kuralSilEylem(kural.id), router.refresh())),
              )
            }
            className="btn-icon hover:text-brand"
            aria-label="Kuralı sil"
          >
            <Icon name="trash" size={16} />
          </button>
        </div>
      </div>
      {dialog}
    </li>
  );
}
