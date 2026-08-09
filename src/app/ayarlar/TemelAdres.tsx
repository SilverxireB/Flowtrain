"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { kurumAdiKaydetEylem, temelAdresKaydetEylem } from "./eylemler";

/**
 * QR etiketleri bu adresten üretilir. Boşsa etiketler göreli yol taşır ve
 * yalnız aynı kurulumdan açılan tarayıcıda çalışır — hattaki tablette değil.
 */
export default function TemelAdres({ mevcut, kurumAdi }: { mevcut: string; kurumAdi: string }) {
  const router = useRouter();
  const [adres, setAdres] = useState(mevcut);
  const [kurum, setKurum] = useState(kurumAdi);
  const [kurumKaydedildi, setKurumKaydedildi] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [kaydedildi, setKaydedildi] = useState(false);
  const [calisiyor, setCalisiyor] = useState(false);

  async function kaydet() {
    if (calisiyor) return;
    setCalisiyor(true);
    setHata(null);
    setKaydedildi(false);
    const h = await temelAdresKaydetEylem(adres);
    setCalisiyor(false);
    if (h) return setHata(h);
    setKaydedildi(true);
    router.refresh();
  }

  async function kurumKaydet() {
    setKurumKaydedildi(false);
    await kurumAdiKaydetEylem(kurum);
    setKurumKaydedildi(true);
    router.refresh();
  }

  return (
    <div className="mt-3 space-y-4">
      <label className="block">
        <span className="text-xs font-semibold text-muted">Kurum adı</span>
        <div className="mt-1 flex flex-wrap gap-2">
          <input
            value={kurum}
            onChange={(e) => {
              setKurum(e.target.value);
              setKurumKaydedildi(false);
            }}
            placeholder="Örnek Fabrika A.Ş."
            className="input-base min-w-0 flex-1 text-sm"
          />
          <button onClick={kurumKaydet} className="btn-ghost text-sm">
            <Icon name="save" size={16} /> Kaydet
          </button>
        </div>
        <p className="mt-1 text-xs text-muted">
          Denetim belgelerinin (kayıt defteri CSV/PDF, pano çıktısı, sertifika) künyesine basılır.
          {kurumKaydedildi ? <span className="ml-1 font-semibold text-iyi-dark">Kaydedildi.</span> : null}
        </p>
      </label>

      <label className="block">
        <span className="text-xs font-semibold text-muted">Kurulumun ağ adresi</span>
        <div className="mt-1 flex flex-wrap gap-2">
          <input
            value={adres}
            onChange={(e) => {
              setAdres(e.target.value);
              setKaydedildi(false);
            }}
            placeholder="http://10.20.0.5:3000"
            className="input-base min-w-0 flex-1 font-mono text-sm"
          />
          <button onClick={kaydet} disabled={calisiyor} className="btn-ghost text-sm disabled:opacity-60">
            <Icon name="save" size={16} /> Kaydet
          </button>
        </div>
      </label>

      <p className="mt-1 text-xs text-muted">
        Eğitim QR etiketleri bu adresle basılır. Tabletin tarayıcısından kurulumun göründüğü adresi yazın — ofis
        makinesindeki <span className="font-mono">localhost</span> hatta çalışmaz.
      </p>

      {hata ? (
        <p role="alert" className="mt-2 rounded-xl border border-brand/30 bg-brand-soft px-3 py-2 text-sm font-semibold text-brand-dark">
          {hata}
        </p>
      ) : null}
      {kaydedildi && !hata ? (
        <p className="mt-2 text-sm font-semibold text-iyi-dark">
          <Icon name="check" size={14} /> Kaydedildi.
        </p>
      ) : null}
    </div>
  );
}
