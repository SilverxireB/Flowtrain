"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import EgitimOyun, { type OyunSonucu } from "@/components/oyun/EgitimOyun";
import { oturumBaslat, oturumTamamla, siciliAra, type OyunVerisi } from "@/app/kiosk/eylemler";
import { DURUM_ETIKET, acikMi, type AtamaDurumu } from "@/lib/kurallar";
import { eslesir } from "@/lib/arama";

export interface Satir {
  sicil: string;
  ad: string;
  egitimId: string;
  egitimAdi: string;
  durum: AtamaDurumu;
  sonTarih: string | null;
  gecerlilikBitis: string | null;
}

/**
 * AMİR TABLETİ.
 *
 * Kiosk'un AYNI oynatıcısını çalıştırır; tek fark oturuma `gozeten` yazılması
 * (sunucu tarafında, kokpit oturumundan). Ayrı bir "amir oynatıcısı" yazsaydık
 * iki akış zamanla ayrışır ve sahtecilik önlemlerinin biri birinde kalırdı.
 */
export default function Ekip({ satirlar }: { satirlar: Satir[] }) {
  const router = useRouter();
  const [sorgu, setSorgu] = useState("");
  const [yalnizAcik, setYalnizAcik] = useState(true);
  const [veri, setVeri] = useState<(OyunVerisi & { kisiAdi: string; pinKurulacak: boolean }) | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const kilit = useRef(false);

  const suzulmus = useMemo(
    () => satirlar.filter((s) => (!yalnizAcik || acikMi(s.durum)) && (eslesir(s.ad, sorgu) || eslesir(s.sicil, sorgu))),
    [satirlar, sorgu, yalnizAcik],
  );

  /** Kişi başına grupla — amir kişiyi arar, eğitimi değil. */
  const kisiler = useMemo(() => {
    const g = new Map<string, { ad: string; sicil: string; satirlar: Satir[] }>();
    for (const s of suzulmus) {
      const k = g.get(s.sicil) ?? { ad: s.ad, sicil: s.sicil, satirlar: [] };
      k.satirlar.push(s);
      g.set(s.sicil, k);
    }
    return [...g.values()].sort((a, b) => a.ad.localeCompare(b.ad, "tr"));
  }, [suzulmus]);

  async function basla(sicil: string, egitimId: string, ad: string) {
    if (kilit.current) return;
    kilit.current = true;
    setHata(null);

    const durum = await siciliAra(sicil);
    const c = await oturumBaslat(sicil, egitimId);
    kilit.current = false;

    if (c.hata) return setHata(c.hata);
    setVeri({ ...c.veri!, kisiAdi: ad, pinKurulacak: durum.durum?.pinKurulacak ?? false });
  }

  if (veri) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-paper">
        <EgitimOyun
          egitim={veri.egitim}
          sayfalar={veri.sayfalar}
          sorular={veri.sorular}
          oturumId={veri.oturumId}
          kisiAdi={veri.kisiAdi}
          pinKurulacak={veri.pinKurulacak}
          onBitir={async (s: OyunSonucu) => {
            const c = await oturumTamamla(veri.oturumId, s);
            if (c.hata) return { hata: c.hata };
          }}
          onCik={() => {
            setVeri(null);
            router.refresh();
          }}
        />
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-3">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Ekipte ara</span>
          <input
            value={sorgu}
            onChange={(e) => setSorgu(e.target.value)}
            placeholder="Ada veya sicile göre ara"
            className="input-base"
          />
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={yalnizAcik}
            onChange={(e) => setYalnizAcik(e.target.checked)}
            className="h-5 w-5 accent-[#4f46e5]"
          />
          Yalnız eksikler
        </label>
      </div>

      {hata ? (
        <p role="alert" className="mt-4 rounded-xl border border-brand/30 bg-brand-soft px-4 py-3 text-sm font-semibold text-brand-dark">
          {hata}
        </p>
      ) : null}

      {kisiler.length === 0 ? (
        <p className="card mt-4 p-8 text-center text-muted">
          {yalnizAcik ? "Ekibinizde eksik eğitim yok." : "Eşleşen kayıt yok."}
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {kisiler.map((k) => (
            <li key={k.sicil} className="card p-4">
              <p className="font-semibold">
                {k.ad} <span className="font-normal text-muted">· {k.sicil}</span>
              </p>
              <ul className="mt-3 space-y-2">
                {k.satirlar.map((s) => (
                  <li key={s.egitimId} className="flex flex-wrap items-center gap-3 rounded-xl border border-line p-3">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{s.egitimAdi}</span>
                      <span className={`mt-0.5 block text-sm ${RENK[s.durum]}`}>
                        {DURUM_ETIKET[s.durum]}
                        {s.sonTarih ? ` · son tarih ${s.sonTarih}` : ""}
                        {s.gecerlilikBitis ? ` · geçerlilik ${s.gecerlilikBitis}` : ""}
                      </span>
                    </span>
                    {acikMi(s.durum) ? (
                      <button onClick={() => basla(s.sicil, s.egitimId, s.ad)} className="btn-primary shrink-0 text-sm">
                        <Icon name="play" size={16} /> Başlat
                      </button>
                    ) : (
                      <span className="chip shrink-0 text-xs text-iyi">
                        <Icon name="check" size={14} /> Tamam
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const RENK: Record<AtamaDurumu, string> = {
  tamam: "text-iyi",
  suresiDoluyor: "text-orta",
  suresiDoldu: "text-brand",
  eksik: "text-muted",
  gecikti: "text-brand",
  kaldi: "text-brand",
};
