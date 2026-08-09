"use client";

import { memo, useState } from "react";
import Icon from "@/components/Icon";
import MedyaSecici from "@/components/editor/MedyaSecici";
import OtoMetin from "@/components/editor/OtoMetin";
import type { MedyaOzet } from "@/lib/editorMedya";
import { SORU_ETIKET, type Soru } from "@/lib/tipler";

/**
 * Editördeki tek soru.
 *
 * ÜÇ TİP, FAZLASI YOK: eşleştirme, sürükle-bırak, boşluk doldurma hazırlayanı
 * yorar ve öğrenmeye hiçbir şey katmaz — ama hazırlama süresini üçe katlar.
 *
 * `zor` işareti İÇERİK KALİTE SİNYALİdir: soruyu çoğunluk yanlış yapıyorsa
 * insanlar değil, o sayfa kötüdür. Hiçbir LMS bunu hazırlayanın yüzüne söylemez.
 *
 * GERİ ÇAĞRILAR SORU KİMLİĞİNİ ALIR — `SayfaSatiri`daki ile aynı sebep: kararlı
 * geri çağrı olmadan `memo` hiçbir işe yaramaz, kart metnine yazılan her harf
 * bütün soruları da yeniden çizerdi.
 */
function SoruSatiriIc({
  soru,
  sira,
  zor,
  istatistik,
  medyalar,
  onGuncelle,
  onSil,
  onMedyaSil,
  onAltMetin,
  kilitli,
}: {
  soru: Soru;
  sira: number;
  zor: boolean;
  /** Bu soru kaç kez soruldu, kaçında yanlış yapıldı. */
  istatistik?: { deneme: number; yanlis: number };
  medyalar: MedyaOzet[];
  /** Yayındaki eğitim salt okunur — sunucu da reddeder. */
  kilitli?: boolean;
  onGuncelle: (soruId: string, yama: Record<string, unknown>) => void;
  onSil: (soruId: string) => void;
  onMedyaSil: (medyaId: string) => void;
  onAltMetin: (medyaId: string, altMetin: string) => void;
}) {
  const [secici, setSecici] = useState(false);
  const cokluSecim = soru.tip === "cokluSecim";
  const sabitSecenek = soru.tip === "dogruYanlis";
  const soruGorseli = soru.gorselId ? medyalar.find((m) => m.id === soru.gorselId) : undefined;

  function dogruDegistir(i: number) {
    if (cokluSecim) {
      const yeni = soru.dogru.includes(i) ? soru.dogru.filter((x) => x !== i) : [...soru.dogru, i];
      // En az bir doğru şık kalmalı: doğrusu olmayan soru herkesi yanlışa düşürür
      // ve puanı sessizce aşağı çeker.
      if (yeni.length > 0) onGuncelle(soru.id, { dogru: yeni });
    } else onGuncelle(soru.id, { dogru: [i] });
  }

  function secenekDegistir(i: number, deger: string) {
    const yeni = [...soru.secenekler];
    yeni[i] = deger;
    onGuncelle(soru.id, { secenekler: yeni });
  }

  function secenekEkle() {
    onGuncelle(soru.id, { secenekler: [...soru.secenekler, ""] });
  }

  function secenekSil(i: number) {
    if (soru.secenekler.length <= 2) return;
    onGuncelle(soru.id, {
      secenekler: soru.secenekler.filter((_, x) => x !== i),
      // Silinen şıktan sonrakiler kaydığı için doğru indeksleri de kaydır —
      // yoksa doğru cevap sessizce başka bir şıkka geçer.
      dogru: soru.dogru.filter((d) => d !== i).map((d) => (d > i ? d - 1 : d)),
    });
  }

  const yanlisOrani = istatistik && istatistik.deneme > 0 ? Math.round((istatistik.yanlis / istatistik.deneme) * 100) : null;

  return (
    <div className={`card p-4 ${zor ? "border-orta/50" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-line text-xs font-bold text-muted">
          {sira}
        </span>
        <span className="chip text-xs">{SORU_ETIKET[soru.tip]}</span>
        {/* SAYIYI GÖSTER, YORUMU AYRI TUT: "%38 yanlış" ölçüdür, "anlatım
            yetersiz" yorumdur. İkisi tek rozette birleşince az denemeli bir
            soru da suçlanmış görünüyordu. */}
        {yanlisOrani !== null && istatistik ? (
          <span className="chip text-xs text-muted" title="Bu sorunun sınavlardaki geçmişi">
            <Icon name="chart" size={14} /> {istatistik.deneme} denemede %{yanlisOrani} yanlış
          </span>
        ) : null}
        {zor ? (
          <span className="chip border-orta/40 bg-orta/10 text-xs text-orta-dark" title="Bu soruyu çoğunluk yanlış yapıyor">
            <Icon name="warning" size={14} /> Anlatım yetersiz olabilir
          </span>
        ) : null}
        <div className="flex-1" />
        <button
          onClick={() => onSil(soru.id)}
          disabled={kilitli}
          className="btn-icon hover:text-brand"
          aria-label="Soruyu sil"
        >
          <Icon name="trash" size={16} />
        </button>
      </div>

      <OtoMetin
        disabled={kilitli}
        defaultValue={soru.metin}
        onBlur={(e) => e.target.value !== soru.metin && onGuncelle(soru.id, { metin: e.target.value })}
        rows={2}
        placeholder="Soru metni"
        className="input-base mt-3 font-semibold"
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

      {/* ── açıklama ────────────────────────────────────────────────────────
          SINAV ÖĞRETMENİN YERİNE GEÇER: yanlış cevaplayan kişi neyi kaçırdığını
          orada öğrenmezse ikinci denemede aynı şıkka basar. İki cümle yeter —
          uzun açıklama kioskta okunmuyor. */}
      <label className="mt-4 block">
        <span className="mb-1.5 block text-xs font-semibold text-muted">
          Yanlış cevaplayana gösterilecek açıklama (isteğe bağlı)
        </span>
        <OtoMetin
          disabled={kilitli}
          defaultValue={soru.aciklama ?? ""}
          onBlur={(e) => e.target.value !== (soru.aciklama ?? "") && onGuncelle(soru.id, { aciklama: e.target.value })}
          rows={2}
          placeholder="Doğrusu neden doğru? Tek cümle."
          className="input-base"
        />
      </label>

      {/* ── soru görseli ────────────────────────────────────────────────────
          "Bu fotoğraftaki hangi davranış yanlış?" sorusu metinle sorulamıyordu;
          soru görseli olmayınca hazırlayan soruyu kartın içine yazıyordu ve
          sınav diye bir şey kalmıyordu. */}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button onClick={() => setSecici(true)} disabled={kilitli} className="btn-ghost text-sm">
          <Icon name="image" size={16} /> {soru.gorselId ? "Görseli değiştir" : "Soru görseli ekle"}
        </button>
        {soru.gorselId ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/medya/${soru.gorselId}`} alt="" className="h-14 rounded-lg border border-line object-cover" />
            {/* ALT METİN SORUDA DAHA DA GEREKLİ: "bu fotoğraftaki hangi davranış
                yanlış?" sorusunu ekran okuyucuyla dinleyen kişi görseli
                göremiyorsa soruyu hiç cevaplayamaz. */}
            <input
              key={soru.gorselId}
              disabled={kilitli}
              defaultValue={soruGorseli?.altMetin ?? ""}
              onBlur={(e) =>
                soru.gorselId &&
                e.target.value !== (soruGorseli?.altMetin ?? "") &&
                onAltMetin(soru.gorselId, e.target.value)
              }
              placeholder="Bu görsel ne gösteriyor? (ekran okuyucu bunu okur)"
              aria-label="Soru görselinin alt metni"
              className="input-base w-auto min-w-[14rem] flex-1 py-1.5 text-xs"
            />
            <button
              onClick={() => onGuncelle(soru.id, { gorselId: null })}
              disabled={kilitli}
              className="btn-icon hover:text-brand"
              aria-label="Soru görselini kaldır"
            >
              <Icon name="close" size={16} />
            </button>
          </>
        ) : null}
      </div>

      {secici ? (
        <MedyaSecici
          tur="gorsel"
          medyalar={medyalar}
          onMedyaSil={onMedyaSil}
          onAltMetin={onAltMetin}
          onKapat={() => setSecici(false)}
          onSec={(id) => {
            setSecici(false);
            onGuncelle(soru.id, { gorselId: id });
          }}
        />
      ) : null}
    </div>
  );
}

/** `memo`: gerekçesi `SayfaSatiri`daki ile aynı — ölçüm oradaki notta. */
const SoruSatiri = memo(SoruSatiriIc);
export default SoruSatiri;
