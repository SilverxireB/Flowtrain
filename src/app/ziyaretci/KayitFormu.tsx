"use client";

import { useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import Icon from "@/components/Icon";
import { ziyaretciKaydetEylem } from "./eylemler";
import { egitimleriCoz, type ZiyaretciSoru } from "@/lib/ziyaretci";

/**
 * ZİYARETÇİ KAYIT FORMU.
 *
 * Sorular cevaplandıkça verilecek bilgilendirme listesi CANLI güncellenir —
 * kayıt yapan kişi "Kaydet"e basmadan önce ne vereceğini görür. Aynı çözüm
 * sunucuda da koşar (`egitimleriCoz`); buradaki gösterim, oradaki karar.
 *
 * VARSAYILANLAR KİLİTLİ: kaldırılamaz, yalnız üstüne eklenebilir. Yoğun bir
 * sabahta atlanan zorunlu bilgilendirme, atlandığı gün fark edilmez.
 */
export default function KayitFormu({
  sorular,
  egitimler,
  varsayilanlar,
  kapali,
}: {
  sorular: ZiyaretciSoru[];
  egitimler: { id: string; ad: string }[];
  varsayilanlar: string[];
  kapali?: boolean;
}) {
  const [hata, eylem] = useFormState(ziyaretciKaydetEylem, null);
  const [cevaplar, setCevaplar] = useState<Record<string, number[]>>({});
  const [ek, setEk] = useState<string[]>([]);

  const adlar = useMemo(() => new Map(egitimler.map((e) => [e.id, e.ad])), [egitimler]);
  const cozulen = useMemo(
    () => egitimleriCoz(varsayilanlar, sorular, cevaplar),
    [varsayilanlar, sorular, cevaplar],
  );
  const verilecek = useMemo(() => [...new Set([...cozulen, ...ek])], [cozulen, ek]);
  const aktifSorular = sorular.filter((s) => s.aktif);

  function isaretle(soru: ZiyaretciSoru, i: number) {
    setCevaplar((c) => {
      const mevcut = c[soru.id] ?? [];
      if (soru.tip !== "cokluSecim") return { ...c, [soru.id]: [i] };
      return { ...c, [soru.id]: mevcut.includes(i) ? mevcut.filter((x) => x !== i) : [...mevcut, i] };
    });
  }

  return (
    <form action={eylem} className="mt-4 space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block sm:col-span-1">
          <span className="mb-1.5 block text-sm font-semibold">Ad soyad</span>
          <input name="ad" required maxLength={80} placeholder="Zorunlu" className="input-base" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">Firma</span>
          <input name="firma" maxLength={80} placeholder="İsteğe bağlı" className="input-base" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">Kimi ziyaret ediyor</span>
          <input name="ziyaretEttigi" maxLength={80} placeholder="İsteğe bağlı" className="input-base" />
        </label>
      </div>

      {aktifSorular.length > 0 ? (
        <div className="space-y-4">
          {aktifSorular.map((s) => (
            <fieldset key={s.id}>
              <legend className="mb-2 text-sm font-semibold">
                {s.metin || <span className="text-muted">(soru metni boş)</span>}
                {s.tip === "cokluSecim" ? <span className="ml-2 font-normal text-muted">birden fazla seçilebilir</span> : null}
              </legend>
              <div className="flex flex-wrap gap-2">
                {s.secenekler.map((secenek, i) => {
                  const secili = (cevaplar[s.id] ?? []).includes(i);
                  return (
                    <button
                      type="button"
                      key={i}
                      onClick={() => isaretle(s, i)}
                      aria-pressed={secili}
                      className={`chip cursor-pointer text-sm transition-colors ${
                        secili ? "border-accent bg-accent text-white" : "hover:border-muted/50"
                      }`}
                    >
                      {secili ? <Icon name="check" size={14} /> : null}
                      {secenek}
                    </button>
                  );
                })}
              </div>
              {/* Sunucu cevapları formdan okur; görsel düğmeler gizli alanlara yazar. */}
              {(cevaplar[s.id] ?? []).map((i) => (
                <input key={i} type="hidden" name={`cevap_${s.id}`} value={i} />
              ))}
            </fieldset>
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-line bg-paper px-4 py-3 text-sm text-muted">
          Kayıt sorusu tanımlanmamış. Herkese yalnız varsayılan bilgilendirme verilir.
        </p>
      )}

      <div className="rounded-xl border border-accent/30 bg-accent-soft/40 p-4">
        <p className="text-sm font-semibold">Verilecek bilgilendirmeler · {verilecek.length}</p>
        {verilecek.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Henüz yok — varsayılan seçilmemiş ve hiçbir soru bilgilendirme bağlamadı.</p>
        ) : (
          <ol className="mt-2 space-y-1.5">
            {verilecek.map((id, i) => {
              const kilitli = varsayilanlar.includes(id);
              return (
                <li key={id} className="flex items-center gap-2 text-sm">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent text-xs font-bold text-white">
                    {i + 1}
                  </span>
                  <span className="flex-1">{adlar.get(id) ?? "(yayında değil)"}</span>
                  {kilitli ? (
                    <span className="flex items-center gap-1 text-xs font-semibold text-muted">
                      <Icon name="lock" size={13} /> zorunlu
                    </span>
                  ) : ek.includes(id) && !cozulen.includes(id) ? (
                    <button
                      type="button"
                      onClick={() => setEk((e) => e.filter((x) => x !== id))}
                      className="btn-icon hover:text-brand"
                      aria-label="Listeden çıkar"
                    >
                      <Icon name="close" size={14} />
                    </button>
                  ) : null}
                  {ek.includes(id) ? <input type="hidden" name="ekEgitim" value={id} /> : null}
                </li>
              );
            })}
          </ol>
        )}

        {/* Kayıt yapanın insiyatifi: soruların bağlamadığı bir bilgilendirmeyi
            elle ekleyebilir. Çıkarma yalnız elle eklenende var. */}
        <label className="mt-4 block">
          <span className="mb-1.5 block text-xs font-semibold text-muted">Elle bilgilendirme ekle</span>
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) setEk((k) => [...new Set([...k, e.target.value])]);
            }}
            className="input-base py-2 text-sm"
          >
            <option value="">Seçin…</option>
            {egitimler
              .filter((e) => !verilecek.includes(e.id))
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.ad}
                </option>
              ))}
          </select>
        </label>
      </div>

      {hata ? (
        <p role="alert" className="rounded-xl border border-brand/30 bg-brand-soft px-4 py-2.5 text-sm font-semibold text-brand-dark">
          {hata}
        </p>
      ) : null}

      <Gonder kapali={kapali || verilecek.length === 0} />
    </form>
  );
}

/** `useFormStatus` YALNIZ formun içindeki bir bileşende çalışır. */
function Gonder({ kapali }: { kapali?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || kapali} className="btn-primary">
      {pending ? "Kaydediliyor…" : "Kaydet ve tableti aç"} <Icon name="chevronRight" size={16} />
    </button>
  );
}
