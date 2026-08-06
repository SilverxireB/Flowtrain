"use client";

import { useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { useConfirm } from "@/components/ConfirmDialog";
import { hesapEkleEylem, hesapSilEylem } from "@/app/eylemler";
import type { Hesap, Rol } from "@/lib/depo";

const ROL_ADI: Record<Rol, string> = {
  yonetici: "Yönetici",
  hazirlayan: "Hazırlayan",
  onaylayan: "Onaylayan",
  amir: "Amir",
};

export default function HesapYonetimi({ hesaplar, benKullanici }: { hesaplar: Hesap[]; benKullanici: string }) {
  const router = useRouter();
  const [bekle, gecis] = useTransition();
  const { confirm, dialog } = useConfirm();
  const [hata, gonder] = useFormState(hesapEkleEylem, null);

  return (
    <div className="space-y-4">
      <ul className="card divide-y divide-line">
        {hesaplar.map((h) => (
          <li key={h.kullanici} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{h.ad}</span>
              <span className="block text-sm text-muted">
                {h.kullanici} · {ROL_ADI[h.rol]}
                {h.sicil ? ` · sicil ${h.sicil}` : ""}
              </span>
            </span>
            {h.kullanici === benKullanici ? (
              <span className="chip text-xs text-muted">Siz</span>
            ) : (
              <button
                onClick={() =>
                  confirm(
                    { title: "Hesap silinsin mi?", message: `${h.ad} (${h.kullanici}) artık giriş yapamaz.`, danger: true },
                    () => gecis(async () => (await hesapSilEylem(h.kullanici), router.refresh())),
                  )
                }
                disabled={bekle}
                className="btn-icon hover:text-brand"
                aria-label="Hesabı sil"
              >
                <Icon name="trash" size={16} />
              </button>
            )}
          </li>
        ))}
      </ul>

      <form action={gonder} className="card space-y-3 p-4">
        <p className="text-sm font-semibold">Yeni hesap</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <input name="ad" placeholder="Ad soyad" className="input-base" />
          <input name="kullanici" placeholder="Kullanıcı adı" required className="input-base" />
          <input name="sifre" type="password" placeholder="Şifre (en az 6)" required className="input-base" />
          <select name="rol" defaultValue="hazirlayan" className="input-base">
            {(Object.keys(ROL_ADI) as Rol[]).map((r) => (
              <option key={r} value={r}>
                {ROL_ADI[r]}
              </option>
            ))}
          </select>
          <input name="sicil" placeholder="Sicil (amir için gerekli)" className="input-base sm:col-span-2" />
        </div>
        {hata ? (
          <p role="alert" className="rounded-xl border border-brand/30 bg-brand-soft px-4 py-2.5 text-sm font-semibold text-brand-dark">
            {hata}
          </p>
        ) : null}
        <Gonder />
      </form>

      {dialog}
    </div>
  );
}

function Gonder() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary text-sm">
      <Icon name="plus" size={16} /> {pending ? "Ekleniyor…" : "Hesap ekle"}
    </button>
  );
}
