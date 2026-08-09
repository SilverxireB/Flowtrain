"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import Icon from "@/components/Icon";
import { kuralEkleEylem } from "./eylemler";

/**
 * Kural formu.
 *
 * Süzgeç değerleri elle YAZILMAZ, personel listesinden gelen değerlerden
 * seçilir: elle yazılan "Kaynak " (sondaki boşluk) kuralı sessizce kimseyi
 * kapsamayan bir şeye çevirir ve kimse fark etmez.
 *
 * HEDEF: tek eğitim ya da PAKET. İkisi tek bir açılır kutuya karıştırılmaz —
 * "Oryantasyon" adında hem bir eğitim hem bir paket olabilir ve kullanıcı
 * hangisini seçtiğini bilemez. Önce tip seçilir, sonra o tipin listesi gelir.
 */
export default function KuralFormu({
  egitimler,
  paketler,
  bolumler,
  hatlar,
  gorevler,
}: {
  egitimler: { id: string; ad: string; yayinda: boolean }[];
  paketler: { id: string; ad: string; egitimSayisi: number }[];
  bolumler: string[];
  hatlar: string[];
  gorevler: string[];
}) {
  const [hata, gonder] = useFormState(kuralEkleEylem, null);
  const [hedefTipi, setHedefTipi] = useState<"egitim" | "paket">("egitim");
  const [secili, setSecili] = useState<Record<string, string[]>>({ bolum: [], hat: [], gorev: [] });

  function degistir(alan: string, deger: string) {
    setSecili((s) => ({
      ...s,
      [alan]: s[alan].includes(deger) ? s[alan].filter((x) => x !== deger) : [...s[alan], deger],
    }));
  }

  return (
    <form action={gonder} className="mt-4 space-y-4">
      <fieldset>
        <legend className="mb-1.5 text-sm font-semibold">Kural neye yazılsın?</legend>
        <input type="hidden" name="hedefTipi" value={hedefTipi} />
        <div className="flex gap-2">
          {(
            [
              { deger: "egitim", etiket: "Tek eğitim", ikon: "book" },
              { deger: "paket", etiket: "Eğitim paketi", ikon: "folder" },
            ] as const
          ).map((s) => (
            <button
              key={s.deger}
              type="button"
              onClick={() => setHedefTipi(s.deger)}
              aria-pressed={hedefTipi === s.deger}
              className={`chip text-sm transition ${
                hedefTipi === s.deger ? "border-accent bg-accent-soft text-accent-dark" : "hover:border-muted/50"
              }`}
            >
              <Icon name={s.ikon} size={14} /> {s.etiket}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold">{hedefTipi === "paket" ? "Paket" : "Eğitim"}</span>
        {/* Anahtar `hedefTipi` içerir: tip değişince seçim SIFIRLANIR. Aksi
            hâlde eğitim seçip pakete geçen kişi eski seçimi göndermiş olurdu. */}
        <select key={hedefTipi} name="hedefId" required className="input-base" defaultValue="">
          <option value="" disabled>
            Seçin…
          </option>
          {hedefTipi === "paket"
            ? paketler.map((p) => (
                <option key={p.id} value={p.id} disabled={p.egitimSayisi === 0}>
                  {p.ad} ({p.egitimSayisi} eğitim{p.egitimSayisi === 0 ? " — boş" : ""})
                </option>
              ))
            : egitimler.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.ad}
                  {e.yayinda ? "" : " (taslak)"}
                </option>
              ))}
        </select>
        {hedefTipi === "paket" ? (
          <span className="mt-1 block text-xs text-muted">
            Pakete sonradan eklenen eğitim, bu kural yeniden yazılmadan aynı kişilere gider.
          </span>
        ) : null}
      </label>

      {hedefTipi === "paket" && paketler.length === 0 ? (
        <p className="rounded-xl border border-orta/40 bg-orta/5 px-3 py-2 text-sm">
          Henüz paket yok. <strong>Eğitim paketleri</strong> sayfasından bir tane açın.
        </p>
      ) : null}

      <Coklu ad="bolum" etiket="Bölüm" secenekler={bolumler} secili={secili.bolum} degistir={degistir} />
      <Coklu ad="hat" etiket="Hat" secenekler={hatlar} secili={secili.hat} degistir={degistir} />
      <Coklu ad="gorev" etiket="Görev" secenekler={gorevler} secili={secili.gorev} degistir={degistir} />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">İşe girişten sonra (gün)</span>
          <input name="iseGirisIcindeGun" type="number" min={1} placeholder="Örn. 3" className="input-base" />
          <span className="mt-1 block text-xs text-muted">Yeni girenler için kişiye özel son tarih üretir.</span>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">Sabit son tarih</span>
          <input name="sonTarih" type="date" className="input-base" />
          <span className="mt-1 block text-xs text-muted">İkisi de doluysa erken olan geçerlidir.</span>
        </label>
      </div>

      {hata ? (
        <p role="alert" className="rounded-xl border border-brand/30 bg-brand-soft px-3 py-2 text-sm font-semibold text-brand-dark">
          {hata}
        </p>
      ) : null}

      <Gonder />
    </form>
  );
}

function Coklu({
  ad,
  etiket,
  secenekler,
  secili,
  degistir,
}: {
  ad: string;
  etiket: string;
  secenekler: string[];
  secili: string[];
  degistir: (alan: string, deger: string) => void;
}) {
  if (secenekler.length === 0) return null;
  return (
    <div>
      {/* JSON: virgülle birleştirmek, "Kaynak, Montaj" gibi virgül İÇEREN bir
          bölüm adı seçildiğinde kuralı iki uydurma değere bölüyor ve kural
          kimseyi kapsamıyordu — hiçbir hata da vermeden. */}
      <input type="hidden" name={ad} value={JSON.stringify(secili)} />
      <span className="mb-1.5 block text-sm font-semibold">
        {etiket} <span className="font-normal text-muted">— boş bırakılırsa süzmez</span>
      </span>
      <div className="flex flex-wrap gap-2">
        {secenekler.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => degistir(ad, s)}
            aria-pressed={secili.includes(s)}
            className={`chip text-sm transition ${
              secili.includes(s) ? "border-accent bg-accent-soft text-accent-dark" : "hover:border-muted/50"
            }`}
          >
            {secili.includes(s) ? <Icon name="check" size={14} /> : null}
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function Gonder() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary">
      <Icon name="plus" size={18} /> {pending ? "Ekleniyor…" : "Kuralı ekle"}
    </button>
  );
}
