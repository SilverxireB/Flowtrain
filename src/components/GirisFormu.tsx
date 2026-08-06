"use client";

import { useFormState, useFormStatus } from "react-dom";

function Gonder({ etiket }: { etiket: string }) {
  const { pending } = useFormStatus();
  // Çift tıklama kilidi: kayıt açan her aksiyonda gerekli. Burada form
  // durumundan geliyor — iki hızlı dokunuş iki istek göndermez.
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? "Bekleyin…" : etiket}
    </button>
  );
}

export default function GirisFormu({
  eylem,
  etiket,
  alanlar,
  gizli,
}: {
  eylem: (onceki: string | null, form: FormData) => Promise<string | null>;
  etiket: string;
  alanlar: { ad: string; etiket: string; tip?: string; not?: string; zorunlu?: boolean }[];
  gizli?: Record<string, string>;
}) {
  const [hata, gonder] = useFormState(eylem, null);

  return (
    <form action={gonder} className="space-y-4">
      {gizli
        ? Object.entries(gizli).map(([ad, deger]) => <input key={ad} type="hidden" name={ad} value={deger} />)
        : null}

      {alanlar.map((a) => (
        <label key={a.ad} className="block">
          <span className="mb-1.5 block text-sm font-semibold">{a.etiket}</span>
          <input
            name={a.ad}
            type={a.tip ?? "text"}
            required={a.zorunlu ?? true}
            autoComplete={a.tip === "password" ? "current-password" : "username"}
            className="input-base"
          />
          {a.not ? <span className="mt-1 block text-xs text-muted">{a.not}</span> : null}
        </label>
      ))}

      {hata ? (
        <p role="alert" className="rounded-xl border border-brand/30 bg-brand-soft px-4 py-3 text-sm font-semibold text-brand-dark">
          {hata}
        </p>
      ) : null}

      <Gonder etiket={etiket} />
    </form>
  );
}
