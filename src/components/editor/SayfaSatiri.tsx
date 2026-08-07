"use client";

import { useRef, useState } from "react";
import Icon from "@/components/Icon";
import { KART_ACIKLAMA, KART_ETIKET, type Sayfa } from "@/lib/tipler";

/**
 * Editördeki tek sayfa satırı.
 *
 * Hazırlayan yalnız METİN yazar ve GÖRSEL seçer; yerleşim, tipografi ve renk
 * ürüne aittir. Serbest tuval vermemenin sebebi kalite: boş tuval verilen her
 * araçta içerik ikinci haftada dağılır.
 */
export default function SayfaSatiri({
  sayfa,
  sira,
  toplam,
  onGuncelle,
  onSil,
  onTasi,
}: {
  sayfa: Sayfa;
  sira: number;
  toplam: number;
  onGuncelle: (yama: Record<string, unknown>) => void;
  onSil: () => void;
  onTasi: (yon: -1 | 1) => void;
}) {
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const dosyaGirdi = useRef<HTMLInputElement>(null);
  const video = sayfa.tip === "video";

  async function medyaSec(e: React.ChangeEvent<HTMLInputElement>) {
    const dosya = e.target.files?.[0];
    e.target.value = "";
    if (!dosya) return;

    setYukleniyor(true);
    setHata(null);
    const form = new FormData();
    form.append("dosya", dosya);
    const cevap = await fetch("/api/medya", { method: "POST", body: form });
    const sonuc = await cevap.json();
    setYukleniyor(false);

    if (!cevap.ok) return setHata(sonuc.hata ?? "Yüklenemedi.");
    onGuncelle(sonuc.tur === "video" ? { videoId: sonuc.id } : { gorselId: sonuc.id });
  }

  const medyaId = video ? sayfa.videoId : sayfa.gorselId;

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-line text-xs font-bold text-muted">
          {sira}
        </span>
        <span className="chip text-xs">{KART_ETIKET[sayfa.tip]}</span>
        <div className="flex-1" />
        <button onClick={() => onTasi(-1)} disabled={sira === 1} className="btn-icon" aria-label="Yukarı taşı">
          <Icon name="up" size={16} />
        </button>
        <button onClick={() => onTasi(1)} disabled={sira === toplam} className="btn-icon" aria-label="Aşağı taşı">
          <Icon name="down" size={16} />
        </button>
        <button onClick={onSil} className="btn-icon hover:text-brand" aria-label="Sayfayı sil">
          <Icon name="trash" size={16} />
        </button>
      </div>

      <p className="mt-1 pl-9 text-xs text-muted">{KART_ACIKLAMA[sayfa.tip]}</p>

      <div className="mt-3 space-y-3">
        <input
          defaultValue={sayfa.baslik}
          onBlur={(e) => e.target.value !== sayfa.baslik && onGuncelle({ baslik: e.target.value })}
          placeholder="Başlık"
          className="input-base font-semibold"
        />

        <textarea
          defaultValue={sayfa.metin ?? ""}
          onBlur={(e) => e.target.value !== (sayfa.metin ?? "") && onGuncelle({ metin: e.target.value })}
          rows={sayfa.tip === "adim" ? 4 : 2}
          placeholder={
            sayfa.tip === "adim"
              ? "Her satır bir adım"
              : sayfa.tip === "yapYapma"
                ? "YAP kolonuna yazılacak"
                : "Metin"
          }
          className="input-base resize-y"
        />

        {sayfa.tip === "yapYapma" ? (
          <textarea
            defaultValue={sayfa.metinKarsi ?? ""}
            onBlur={(e) => e.target.value !== (sayfa.metinKarsi ?? "") && onGuncelle({ metinKarsi: e.target.value })}
            rows={2}
            placeholder="YAPMA kolonuna yazılacak"
            className="input-base resize-y border-brand/30"
          />
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => dosyaGirdi.current?.click()} disabled={yukleniyor} className="btn-ghost text-sm">
            <Icon name={video ? "video" : "image"} size={16} />
            {yukleniyor ? "Yükleniyor…" : medyaId ? "Değiştir" : video ? "Video yükle" : "Görsel yükle"}
          </button>
          <input
            ref={dosyaGirdi}
            type="file"
            accept={video ? "video/mp4,video/webm" : "image/png,image/jpeg,image/webp"}
            onChange={medyaSec}
            className="hidden"
          />

          {medyaId ? (
            <>
              {video ? (
                <span className="chip text-xs">
                  <Icon name="check" size={14} /> Video eklendi
                </span>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/medya/${medyaId}`} alt="" className="h-14 rounded-lg border border-line object-cover" />
              )}
              <button
                onClick={() => onGuncelle(video ? { videoId: null } : { gorselId: null })}
                className="btn-icon hover:text-brand"
                aria-label="Medyayı kaldır"
              >
                <Icon name="close" size={16} />
              </button>
            </>
          ) : null}

          <div className="flex-1" />

          <label className="flex items-center gap-2 text-xs text-muted">
            {/* Asgari süre = sahtecilik önlemi. Görünür ve düzenlenebilir olması
                bilinçli: hazırlayan videonun uzunluğuna göre ayarlayabilmeli. */}
            En az
            <input
              type="number"
              min={0}
              defaultValue={sayfa.asgariSure}
              onBlur={(e) => Number(e.target.value) !== sayfa.asgariSure && onGuncelle({ asgariSure: Number(e.target.value) })}
              className="input-base w-20 px-2 py-1 text-center"
            />
            sn ekranda kalsın
          </label>
        </div>

        {hata ? (
          <p role="alert" className="rounded-xl border border-brand/30 bg-brand-soft px-4 py-2.5 text-sm font-semibold text-brand-dark">
            {hata}
          </p>
        ) : null}
      </div>
    </div>
  );
}
