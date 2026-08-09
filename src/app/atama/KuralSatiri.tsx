"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { useConfirm } from "@/components/ConfirmDialog";
import { kuralDurumEylem, kuralSilEylem } from "./eylemler";
import type { Kural } from "@/lib/tipler";

/**
 * Kural satırı.
 *
 * PAKET KURALI GÖRSEL OLARAK AYRI: aynı listede "Yüksekte Çalışma" ile
 * "Oryantasyon (5 eğitim)" yan yana durur ve ikisi aynı görünürse, paketten
 * eğitim çıkaran kişi kaç kişinin neyi kaybettiğini anlamaz. Klasör ikonu,
 * farklı rozet ve üye listesi bu ayrımı taşır.
 */
export default function KuralSatiri({
  kural,
  hedefAdi,
  paketMi,
  uyeAdlari,
  yayinda,
  kisiSayisi,
}: {
  kural: Kural;
  hedefAdi: string;
  paketMi: boolean;
  /** Paket kuralında üye eğitimlerin adları (tek eğitim kuralında boş). */
  uyeAdlari: string[];
  /** Tek eğitim kuralında eğitim yayında mı; paket kuralında en az bir üye yayında mı. */
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
        <span
          className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
            paketMi ? "bg-accent-soft text-accent" : "bg-line text-muted"
          }`}
        >
          <Icon name={paketMi ? "folder" : "book"} size={18} />
        </span>

        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            {hedefAdi}
            {paketMi ? (
              <span className="ml-2 align-middle text-xs font-bold uppercase tracking-wider text-accent">Paket</span>
            ) : null}
          </p>
          <p className="mt-1 text-sm text-muted">{parcalar.length ? parcalar.join(" · ") : "Tüm personel"}</p>

          {paketMi ? (
            <p className="mt-1 text-xs text-muted">
              {uyeAdlari.length > 0 ? (
                <>
                  {uyeAdlari.length} eğitim: {uyeAdlari.join(" · ")}
                </>
              ) : (
                <span className="text-orta-dark">Paket boş — bu kural hiçbir şey atamıyor.</span>
              )}
            </p>
          ) : null}

          <div className="mt-2 flex flex-wrap gap-2">
            <span className="chip text-xs">
              <Icon name="users" size={14} /> {kisiSayisi} kişi
            </span>
            {paketMi && uyeAdlari.length > 0 ? (
              <span className="chip text-xs text-muted">
                {kisiSayisi * uyeAdlari.length} atama
              </span>
            ) : null}
            {!yayinda ? (
              <span className="chip border-orta/40 bg-orta/10 text-xs text-orta-dark">
                <Icon name="warning" size={14} />{" "}
                {paketMi ? "Hiçbir üyesi yayında değil — kimseye düşmüyor" : "Eğitim taslakta — kimseye düşmüyor"}
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
                  message: paketMi
                    ? `${kisiSayisi} kişinin paket ataması kalkar (${uyeAdlari.length} eğitim). Paket ve eğitimler silinmez, tamamlanmış kayıtlar SİLİNMEZ.`
                    : `${kisiSayisi} kişinin ataması kalkar. Tamamlanmış kayıtlar SİLİNMEZ.`,
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
