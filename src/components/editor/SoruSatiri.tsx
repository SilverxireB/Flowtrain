"use client";

import Icon from "@/components/Icon";
import { SORU_ETIKET, type Soru } from "@/lib/tipler";

/**
 * Editördeki tek soru.
 *
 * ÜÇ TİP, FAZLASI YOK: eşleştirme, sürükle-bırak, boşluk doldurma hazırlayanı
 * yorar ve öğrenmeye hiçbir şey katmaz — ama hazırlama süresini üçe katlar.
 *
 * `zor` işareti İÇERİK KALİTE SİNYALİdir: soruyu çoğunluk yanlış yapıyorsa
 * insanlar değil, o sayfa kötüdür. Hiçbir LMS bunu hazırlayanın yüzüne söylemez.
 */
export default function SoruSatiri({
  soru,
  sira,
  zor,
  onGuncelle,
  onSil,
  kilitli,
}: {
  soru: Soru;
  sira: number;
  zor: boolean;
  /** Yayındaki eğitim salt okunur — sunucu da reddeder. */
  kilitli?: boolean;
  onGuncelle: (yama: Partial<Soru>) => void;
  onSil: () => void;
}) {
  const cokluSecim = soru.tip === "cokluSecim";
  const sabitSecenek = soru.tip === "dogruYanlis";

  function dogruDegistir(i: number) {
    if (cokluSecim) {
      const yeni = soru.dogru.includes(i) ? soru.dogru.filter((x) => x !== i) : [...soru.dogru, i];
      // En az bir doğru şık kalmalı: doğrusu olmayan soru herkesi yanlışa düşürür
      // ve puanı sessizce aşağı çeker.
      if (yeni.length > 0) onGuncelle({ dogru: yeni });
    } else onGuncelle({ dogru: [i] });
  }

  function secenekDegistir(i: number, deger: string) {
    const yeni = [...soru.secenekler];
    yeni[i] = deger;
    onGuncelle({ secenekler: yeni });
  }

  function secenekEkle() {
    onGuncelle({ secenekler: [...soru.secenekler, ""] });
  }

  function secenekSil(i: number) {
    if (soru.secenekler.length <= 2) return;
    onGuncelle({
      secenekler: soru.secenekler.filter((_, x) => x !== i),
      // Silinen şıktan sonrakiler kaydığı için doğru indeksleri de kaydır —
      // yoksa doğru cevap sessizce başka bir şıkka geçer.
      dogru: soru.dogru.filter((d) => d !== i).map((d) => (d > i ? d - 1 : d)),
    });
  }

  return (
    <div className={`card p-4 ${zor ? "border-orta/50" : ""}`}>
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-line text-xs font-bold text-muted">
          {sira}
        </span>
        <span className="chip text-xs">{SORU_ETIKET[soru.tip]}</span>
        {zor ? (
          <span className="chip border-orta/40 bg-orta/10 text-xs text-orta-dark" title="Bu soruyu çoğunluk yanlış yapıyor">
            <Icon name="warning" size={14} /> Anlatım yetersiz olabilir
          </span>
        ) : null}
        <div className="flex-1" />
        <button onClick={onSil} disabled={kilitli} className="btn-icon hover:text-brand" aria-label="Soruyu sil">
          <Icon name="trash" size={16} />
        </button>
      </div>

      <textarea
        disabled={kilitli}
        defaultValue={soru.metin}
        onBlur={(e) => e.target.value !== soru.metin && onGuncelle({ metin: e.target.value })}
        rows={2}
        placeholder="Soru metni"
        className="input-base mt-3 resize-y font-semibold"
      />

      {cokluSecim ? (
        <p className="mt-2 text-xs text-muted">
          Birden fazla doğru şık işaretleyin. Sınavda <strong>hep ya da hiç</strong> puanlanır: eksik işaretleme yarım
          puan almaz.
        </p>
      ) : null}

      <ul className="mt-3 space-y-2">
        {soru.secenekler.map((s, i) => (
          <li key={i} className="flex items-center gap-2">
            <button
              onClick={() => dogruDegistir(i)}
              disabled={kilitli}
              aria-label={`${i + 1}. şıkkı doğru işaretle`}
              aria-pressed={soru.dogru.includes(i)}
              className={`grid h-8 w-8 shrink-0 place-items-center border-2 transition ${
                cokluSecim ? "rounded-lg" : "rounded-full"
              } ${soru.dogru.includes(i) ? "border-iyi bg-iyi text-white" : "border-line text-transparent hover:border-muted"}`}
            >
              <Icon name="check" size={16} />
            </button>
            <input
              defaultValue={s}
              onBlur={(e) => e.target.value !== s && secenekDegistir(i, e.target.value)}
              readOnly={sabitSecenek}
              disabled={kilitli}
              placeholder={`${i + 1}. şık`}
              className={`input-base py-2 ${sabitSecenek ? "bg-paper text-muted" : ""}`}
            />
            {!sabitSecenek && soru.secenekler.length > 2 ? (
              <button onClick={() => secenekSil(i)} disabled={kilitli} className="btn-icon" aria-label="Şıkkı sil">
                <Icon name="close" size={16} />
              </button>
            ) : null}
          </li>
        ))}
      </ul>

      {!sabitSecenek ? (
        <button onClick={secenekEkle} disabled={kilitli} className="btn-ghost mt-3 text-sm">
          <Icon name="plus" size={16} /> Şık ekle
        </button>
      ) : null}
    </div>
  );
}
