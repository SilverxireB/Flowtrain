"use client";

import { useTransition } from "react";
import Icon from "@/components/Icon";
import OtoMetin from "@/components/editor/OtoMetin";
import { useConfirm } from "@/components/ConfirmDialog";
import {
  soruEkleEylem,
  soruGuncelleEylem,
  soruSilEylem,
  sorulariSiralaEylem,
  varsayilanEgitimleriYazEylem,
} from "../eylemler";
import { ZIYARETCI_SORU_ETIKET, type ZiyaretciSoru, type ZiyaretciSoruTipi } from "@/lib/ziyaretci";

type Egitim = { id: string; ad: string; yayinda: boolean };

export default function SoruYonetimi({
  sorular,
  egitimler,
  varsayilanlar,
}: {
  sorular: ZiyaretciSoru[];
  egitimler: Egitim[];
  varsayilanlar: string[];
}) {
  const [bekliyor, calistir] = useTransition();

  function varsayilanDegistir(id: string) {
    const yeni = varsayilanlar.includes(id) ? varsayilanlar.filter((x) => x !== id) : [...varsayilanlar, id];
    calistir(() => void varsayilanEgitimleriYazEylem(yeni));
  }

  return (
    <>
      <section className="card p-5">
        <h2 className="font-semibold">Herkese verilecek bilgilendirmeler</h2>
        <p className="mt-1 text-sm text-muted">
          Buradakiler <strong className="text-ink">her ziyaretçiye otomatik</strong> eklenir ve kayıt masasında
          kaldırılamaz. Soru sormaya gerek olmayan, istisnasız herkesi ilgilendiren bilgilendirme için.
        </p>

        {egitimler.length === 0 ? (
          <p className="mt-4 rounded-xl border border-orta/40 bg-orta/5 px-4 py-3 text-sm">
            Hiç eğitim yok. Önce Eğitimler sayfasından bir bilgilendirme hazırlayın.
          </p>
        ) : (
          <div className="mt-4 flex flex-wrap gap-2">
            {egitimler.map((e) => {
              const secili = varsayilanlar.includes(e.id);
              return (
                <button
                  key={e.id}
                  onClick={() => varsayilanDegistir(e.id)}
                  disabled={bekliyor}
                  aria-pressed={secili}
                  className={`chip cursor-pointer text-sm transition-colors ${
                    secili ? "border-accent bg-accent text-white" : "hover:border-muted/50"
                  }`}
                >
                  {secili ? <Icon name="check" size={14} /> : null}
                  {e.ad}
                  {e.yayinda ? "" : " (taslak)"}
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="eyebrow">Sorular · {sorular.length}</h2>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(ZIYARETCI_SORU_ETIKET) as ZiyaretciSoruTipi[]).map((t) => (
              <button
                key={t}
                onClick={() => calistir(() => void soruEkleEylem(t))}
                disabled={bekliyor}
                className="btn-ghost text-sm"
              >
                <Icon name="plus" size={16} /> {ZIYARETCI_SORU_ETIKET[t]}
              </button>
            ))}
          </div>
        </div>

        {sorular.length === 0 ? (
          <p className="card p-8 text-center text-muted">
            Soru yok — her ziyaretçiye yalnız yukarıdaki varsayılan bilgilendirmeler verilir. Farklı kişilere farklı şey
            vermek için soru ekleyin.
          </p>
        ) : (
          <ul className="space-y-3">
            {sorular.map((s, i) => (
              <SoruSatiri
                key={s.id}
                soru={s}
                sira={i + 1}
                toplam={sorular.length}
                egitimler={egitimler}
                bekliyor={bekliyor}
                calistir={calistir}
                tumSiralar={sorular.map((x) => x.id)}
              />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function SoruSatiri({
  soru,
  sira,
  toplam,
  egitimler,
  bekliyor,
  calistir,
  tumSiralar,
}: {
  soru: ZiyaretciSoru;
  sira: number;
  toplam: number;
  egitimler: Egitim[];
  bekliyor: boolean;
  calistir: (f: () => void) => void;
  tumSiralar: string[];
}) {
  const { confirm, dialog } = useConfirm();

  function guncelle(yama: Record<string, unknown>) {
    calistir(() => void soruGuncelleEylem(soru.id, yama));
  }

  function tasi(yon: -1 | 1) {
    const yeni = [...tumSiralar];
    const i = yeni.indexOf(soru.id);
    const j = i + yon;
    if (j < 0 || j >= yeni.length) return;
    [yeni[i], yeni[j]] = [yeni[j], yeni[i]];
    calistir(() => void sorulariSiralaEylem(yeni));
  }

  function sil() {
    confirm(
      {
        title: "Soru silinsin mi?",
        message: "Bu soru ve bağladığı bilgilendirme eşlemesi silinir. Kayıtlı ziyaretçiler etkilenmez.",
        confirmLabel: "Sil",
        danger: true,
      },
      () => calistir(() => void soruSilEylem(soru.id)),
    );
  }

  /** Bir şıkka bağlı eğitimi ekler/çıkarır. */
  function eslesmeDegistir(secenekIndeks: number, egitimId: string) {
    const anahtar = String(secenekIndeks);
    const mevcut = soru.eslesme[anahtar] ?? [];
    const yeni = mevcut.includes(egitimId) ? mevcut.filter((x) => x !== egitimId) : [...mevcut, egitimId];
    guncelle({ eslesme: { ...soru.eslesme, [anahtar]: yeni } });
  }

  function secenekYaz(indeks: number, deger: string) {
    const yeni = [...soru.secenekler];
    yeni[indeks] = deger;
    guncelle({ secenekler: yeni });
  }

  function secenekEkle() {
    guncelle({ secenekler: [...soru.secenekler, `Seçenek ${soru.secenekler.length + 1}`] });
  }

  function secenekSil(indeks: number) {
    /* Şık silinince ONDAN SONRAKİ şıkların indeksi kayar; eşleme indeksle
       tutulduğu için birlikte kaydırılmazsa bilgilendirmeler yanlış şıkka
       bağlanır ve kimse fark etmez. */
    const secenekler = soru.secenekler.filter((_, i) => i !== indeks);
    const eslesme: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(soru.eslesme)) {
      const i = Number(k);
      if (i === indeks) continue;
      eslesme[String(i > indeks ? i - 1 : i)] = v;
    }
    guncelle({ secenekler, eslesme });
  }

  return (
    <li className="card p-4">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-line text-xs font-bold text-muted">
          {sira}
        </span>
        <span className="chip text-xs">{ZIYARETCI_SORU_ETIKET[soru.tip]}</span>
        {!soru.aktif ? <span className="chip border-orta/40 bg-orta/5 text-xs text-orta-dark">Pasif</span> : null}
        <div className="flex-1" />
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted">
          <input
            type="checkbox"
            checked={soru.aktif}
            onChange={(e) => guncelle({ aktif: e.target.checked })}
            className="h-4 w-4 accent-accent"
          />
          Sorulsun
        </label>
        <button onClick={() => tasi(-1)} disabled={bekliyor || sira === 1} className="btn-icon" aria-label="Yukarı taşı">
          <Icon name="up" size={16} />
        </button>
        <button onClick={() => tasi(1)} disabled={bekliyor || sira === toplam} className="btn-icon" aria-label="Aşağı taşı">
          <Icon name="down" size={16} />
        </button>
        <button onClick={sil} disabled={bekliyor} className="btn-icon hover:text-brand" aria-label="Soruyu sil">
          <Icon name="trash" size={16} />
        </button>
      </div>

      <OtoMetin
        defaultValue={soru.metin}
        onBlur={(e) => e.target.value !== soru.metin && guncelle({ metin: e.target.value })}
        rows={1}
        placeholder="Soru metni — ör. Yüksekte çalışma yapacak mısınız?"
        className="input-base mt-3 font-semibold"
      />

      <div className="mt-4 space-y-3">
        {soru.secenekler.map((secenek, i) => {
          const bagli = soru.eslesme[String(i)] ?? [];
          return (
            <div key={i} className="rounded-xl border border-line bg-paper p-3">
              <div className="flex items-center gap-2">
                <input
                  defaultValue={secenek}
                  onBlur={(e) => e.target.value !== secenek && secenekYaz(i, e.target.value)}
                  placeholder={`Şık ${i + 1}`}
                  className="input-base bg-white py-2 text-sm font-semibold"
                />
                <button
                  onClick={() => secenekSil(i)}
                  disabled={bekliyor || soru.secenekler.length <= 2}
                  className="btn-icon shrink-0 hover:text-brand"
                  aria-label="Şıkkı sil"
                >
                  <Icon name="close" size={16} />
                </button>
              </div>

              <p className="mt-2.5 text-xs font-semibold text-muted">
                Bu şık seçilirse verilecek bilgilendirmeler{bagli.length > 0 ? ` · ${bagli.length}` : ""}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {egitimler.length === 0 ? (
                  <span className="text-xs text-muted">Önce bir eğitim hazırlayın.</span>
                ) : (
                  egitimler.map((e) => {
                    const secili = bagli.includes(e.id);
                    return (
                      <button
                        key={e.id}
                        onClick={() => eslesmeDegistir(i, e.id)}
                        disabled={bekliyor}
                        aria-pressed={secili}
                        className={`chip cursor-pointer text-xs transition-colors ${
                          secili ? "border-accent bg-accent text-white" : "bg-white hover:border-muted/50"
                        }`}
                      >
                        {secili ? <Icon name="check" size={12} /> : null}
                        {e.ad}
                        {e.yayinda ? "" : " (taslak)"}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}

        {soru.tip !== "evetHayir" ? (
          <button onClick={secenekEkle} disabled={bekliyor} className="btn-ghost text-sm">
            <Icon name="plus" size={16} /> Şık ekle
          </button>
        ) : null}
      </div>
      {dialog}
    </li>
  );
}
