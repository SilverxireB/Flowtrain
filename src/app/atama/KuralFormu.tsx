"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import Icon from "@/components/Icon";
import { kuralEkleEylem } from "@/app/eylemler";

/**
 * Kural formu.
 *
 * Süzgeç değerleri elle YAZILMAZ, personel listesinden gelen değerlerden
 * seçilir: elle yazılan "Kaynak " (sondaki boşluk) kuralı sessizce kimseyi
 * kapsamayan bir şeye çevirir ve kimse fark etmez.
 */
export default function KuralFormu({
  egitimler,
  bolumler,
  hatlar,
  gorevler,
}: {
  egitimler: { id: string; ad: string; yayinda: boolean }[];
  bolumler: string[];
  hatlar: string[];
  gorevler: string[];
}) {
  const [secili, setSecili] = useState<Record<string, string[]>>({ bolum: [], hat: [], gorev: [] });

  function degistir(alan: string, deger: string) {
    setSecili((s) => ({
      ...s,
      [alan]: s[alan].includes(deger) ? s[alan].filter((x) => x !== deger) : [...s[alan], deger],
    }));
  }

  return (
    <form action={kuralEkleEylem} className="mt-4 space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold">Eğitim</span>
        <select name="egitimId" required className="input-base" defaultValue="">
          <option value="" disabled>
            Seçin…
          </option>
          {egitimler.map((e) => (
            <option key={e.id} value={e.id}>
              {e.ad}
              {e.yayinda ? "" : " (taslak)"}
            </option>
          ))}
        </select>
      </label>

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
