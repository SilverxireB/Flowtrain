"use client";

import { useRef, useState } from "react";
import Icon from "@/components/Icon";
import { metniKartlaraBol, type KartTaslagi } from "@/lib/metinBol";
import { KART_ETIKET } from "@/lib/tipler";

/**
 * METİN YAPIŞTIR — elindeki talimatı kartlara çevirir.
 *
 * NEDEN: hazırlayanın başlangıç noktası boş sayfa değil, Word'den kalma bir
 * talimat. Onu kart kart elle bölmek işin en sıkıcı ve en çok vazgeçilen
 * kısmıydı. Yapıştır, ne çıkacağını gör, onayla.
 *
 * ÖNİZLEME ONAY DEĞİL: kaç kart çıktığı ve her birinin hangi TİPTE olacağı
 * eklemeden önce görünür — üstelik NEDEN o tip seçildiği de yazar ("numaralı
 * liste", "tehlike sözcüğü"). Kalıp yanıldığında hazırlayan bunu ekledikten
 * sonra değil, eklemeden önce fark eder.
 */
export default function MetinYapistir({
  kilitli,
  onEkle,
}: {
  kilitli?: boolean;
  onEkle: (kartlar: { tip: KartTaslagi["tip"]; baslik: string; metin: string }[]) => void;
}) {
  const [acik, setAcik] = useState(false);
  const [ham, setHam] = useState("");
  const kilit = useRef(false);

  const taslaklar = metniKartlaraBol(ham);

  function ekle() {
    if (kilit.current || taslaklar.length === 0) return;
    kilit.current = true;
    onEkle(taslaklar.map(({ tip, baslik, metin }) => ({ tip, baslik, metin })));
    setHam("");
    setAcik(false);
    kilit.current = false;
  }

  if (!acik) {
    return (
      <button onClick={() => setAcik(true)} disabled={kilitli} className="btn-ghost text-sm">
        <Icon name="text" size={16} /> Metin yapıştır
      </button>
    );
  }

  return (
    <div className="card w-full p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Icon name="text" size={16} className="text-accent" />
        <p className="font-semibold">Metinden kart üret</p>
        <div className="flex-1" />
        <button onClick={() => setAcik(false)} className="btn-icon" aria-label="Kapat">
          <Icon name="close" size={16} />
        </button>
      </div>

      <p className="mt-1 text-sm text-muted">
        Talimatı, prosedürü ya da sunum notunu olduğu gibi yapıştırın.{" "}
        <strong className="text-ink">Boş satır kartları ayırır.</strong> Numaralı liste adım kartı, madde listesi
        kontrol listesi olur.
      </p>

      <textarea
        value={ham}
        onChange={(e) => setHam(e.target.value)}
        rows={8}
        autoFocus
        placeholder={"Baret zorunlu\nSahaya baretsiz girilmez.\n\nDüşme olursa\n1. Hattı durdur\n2. Amiri ara"}
        className="input-base mt-3 font-mono text-sm"
      />

      {ham.trim() ? (
        <div className="mt-3">
          <p className="eyebrow">{taslaklar.length} kart çıkıyor</p>
          <ul className="mt-2 space-y-2">
            {taslaklar.map((t, i) => (
              <li key={i} className="rounded-flow border border-line p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="chip px-2 py-0.5 text-[11px]">{KART_ETIKET[t.tip]}</span>
                  <span className="text-xs text-muted">{t.gerekce}</span>
                </div>
                <p className="mt-1 text-sm font-semibold">{t.baslik || "(başlıksız)"}</p>
                {t.metin.trim() ? (
                  <p className="mt-0.5 whitespace-pre-line text-xs text-muted">{t.metin}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button onClick={ekle} disabled={taslaklar.length === 0} className="btn-primary text-sm">
          <Icon name="plus" size={16} /> {taslaklar.length} kartı ekle
        </button>
        <button onClick={() => setHam("")} disabled={!ham} className="btn-ghost text-sm">
          Temizle
        </button>
      </div>
    </div>
  );
}
