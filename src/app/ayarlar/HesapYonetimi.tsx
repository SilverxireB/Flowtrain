"use client";

import { useState, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { hesapEkleEylem, hesapSifreDegistirEylem, hesapSilEylem } from "@/app/eylemler";
import type { Hesap, Rol } from "@/lib/depo";

const ROL_ADI: Record<Rol, string> = {
  yonetici: "Yönetici",
  hazirlayan: "Hazırlayan",
  onaylayan: "Onaylayan",
  amir: "Amir",
};

export default function HesapYonetimi({ hesaplar, benKullanici }: { hesaplar: Hesap[]; benKullanici: string }) {
  /* ŞİFRE DEĞİŞTİRME — hangi hesabın satırı açık ve ne yazıldı.
     Ayrı bir sayfa değil satır içi: devir anında yönetici zaten bu listeye
     bakıyor ve şifre değiştirmek için başka bir ekrana gitmek, adımın
     unutulmasının en kolay yolu (`docs/CANLIYA-GECIS.md` devir maddesi). */
  const [sifreAcik, setSifreAcik] = useState<string | null>(null);
  const [yeniSifre, setYeniSifre] = useState("");
  const [sifreNotu, setSifreNotu] = useState<string | null>(null);
  const router = useRouter();
  const [bekle, gecis] = useTransition();
  const { confirm, dialog } = useConfirm();
  const { show, toast } = useToast();
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
            <button
              onClick={() => {
                setSifreAcik(sifreAcik === h.kullanici ? null : h.kullanici);
                setYeniSifre("");
                setSifreNotu(null);
              }}
              className="btn-ghost text-sm"
              aria-expanded={sifreAcik === h.kullanici}
            >
              <Icon name="lock" size={14} /> Şifre
            </button>
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

            {sifreAcik === h.kullanici ? (
              <div className="w-full border-t border-line pt-3">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="password"
                    value={yeniSifre}
                    onChange={(e) => {
                      setYeniSifre(e.target.value);
                      setSifreNotu(null);
                    }}
                    placeholder="Yeni şifre (en az 6 karakter)"
                    className="input-base min-w-[220px] flex-1 text-sm"
                    autoComplete="new-password"
                  />
                  <button
                    onClick={() =>
                      gecis(async () => {
                        const h2 = await hesapSifreDegistirEylem(h.kullanici, yeniSifre);
                        if (h2) return setSifreNotu(h2);
                        setSifreNotu(null);
                        setYeniSifre("");
                        setSifreAcik(null);
                        show(`${h.ad} hesabının şifresi değiştirildi.`);
                        router.refresh();
                      })
                    }
                    disabled={bekle || yeniSifre.length < 6}
                    className="btn-primary text-sm disabled:opacity-40"
                  >
                    <Icon name="save" size={14} /> Değiştir
                  </button>
                </div>
                {/* ESKİ ŞİFRE SORULMUYOR: bu ekrana yalnız yönetici giriyor ve
                    amaç zaten BAŞKASININ şifresini vermek (devir, unutulan
                    şifre). Eski şifreyi sormak, unutulmuş şifreyi sıfırlamayı
                    imkânsız kılardı — kurtarma yolunun var olma sebebi bu. */}
                <p className="mt-2 text-xs text-muted">
                  Şifre geri okunamaz. Değiştirdiğinizde kişiye yeni şifreyi siz iletirsiniz; işlem denetim izine
                  yazılır.
                </p>
                {sifreNotu ? (
                  <p role="alert" className="mt-2 text-sm font-semibold text-brand-dark">
                    {sifreNotu}
                  </p>
                ) : null}
              </div>
            ) : null}
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
      {toast}
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
