"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { useConfirm } from "@/components/ConfirmDialog";
import { eslesir } from "@/lib/arama";
import type { PaketOzeti } from "@/lib/katalog";
import { grupKaydetEylem, grupSilEylem } from "./eylemler";

export interface PaketSatiri {
  id: string;
  ad: string;
  aciklama: string;
  egitimIdleri: string[];
  ozet: PaketOzeti;
  /** Bu pakete yazılmış atama kuralı sayısı. */
  kuralSayisi: number;
}

export interface EgitimSecenegi {
  id: string;
  ad: string;
  kategori: string;
  yayinda: boolean;
}

export default function Gruplar({ paketler, egitimler }: { paketler: PaketSatiri[]; egitimler: EgitimSecenegi[] }) {
  const [duzenlenen, setDuzenlenen] = useState<string | null>(null);
  const adlar = new Map(egitimler.map((e) => [e.id, e]));

  return (
    <div className="space-y-3">
      {paketler.length === 0 ? (
        <p className="card p-8 text-center text-muted">
          Henüz paket yok. Yukarıdan bir tane açın — örneğin <strong className="text-ink">Oryantasyon</strong>.
        </p>
      ) : (
        paketler.map((p) =>
          duzenlenen === p.id ? (
            <Duzenle
              key={p.id}
              paket={p}
              egitimler={egitimler}
              onKapat={() => setDuzenlenen(null)}
            />
          ) : (
            <Satir key={p.id} paket={p} adlar={adlar} onDuzenle={() => setDuzenlenen(p.id)} />
          ),
        )
      )}
    </div>
  );
}

/* ── okuma görünümü ───────────────────────────────────────────────────────── */

function Satir({
  paket,
  adlar,
  onDuzenle,
}: {
  paket: PaketSatiri;
  adlar: Map<string, EgitimSecenegi>;
  onDuzenle: () => void;
}) {
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const o = paket.ozet;

  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">{paket.ad}</h3>
          {paket.aciklama ? <p className="mt-0.5 text-sm text-muted">{paket.aciklama}</p> : null}
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="chip text-xs">
              <Icon name="book" size={14} /> {paket.egitimIdleri.length} eğitim
            </span>
            {paket.kuralSayisi > 0 ? (
              <Link href="/atama" className="chip border-accent/30 bg-accent-soft text-xs text-accent-dark">
                <Icon name="target" size={14} /> {paket.kuralSayisi} atama kuralı
              </Link>
            ) : (
              <span className="chip text-xs text-muted">Kural yazılmamış — kimseye düşmüyor</span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button onClick={onDuzenle} className="btn-ghost text-sm">
            <Icon name="pencil" size={14} /> Düzenle
          </button>
          <button
            onClick={() =>
              confirm(
                {
                  title: "Paket silinsin mi?",
                  message:
                    paket.kuralSayisi > 0
                      ? `Bu pakete yazılmış ${paket.kuralSayisi} atama kuralı da silinir; içindeki eğitimler kalır. Tamamlanmış kayıtlar SİLİNMEZ.`
                      : "İçindeki eğitimler silinmez, yalnız paket kalkar.",
                  danger: true,
                },
                () => void grupSilEylem(paket.id).then(() => router.refresh()),
              )
            }
            className="btn-icon hover:text-brand"
            aria-label={`${paket.ad} paketini sil`}
          >
            <Icon name="trash" size={16} />
          </button>
        </div>
      </div>

      {paket.egitimIdleri.length > 0 ? (
        <ol className="mt-3 flex flex-wrap gap-1.5">
          {paket.egitimIdleri.map((id, i) => {
            const e = adlar.get(id);
            return (
              <li key={id} className="chip px-2.5 py-0.5 text-xs">
                <span className="text-muted">{i + 1}.</span> {e?.ad ?? "(silinmiş eğitim)"}
                {e && !e.yayinda ? <span className="text-orta-dark"> · taslak</span> : null}
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="mt-3 text-sm text-muted">Paket boş — üye eğitim ekleyene kadar hiçbir şey atamaz.</p>
      )}

      <Ilerleme ozet={o} />
      {dialog}
    </section>
  );
}

/**
 * PAKET BAZLI İLERLEME.
 *
 * İki sayı birlikte gösterilir çünkü tek başına ikisi de yanıltıyor:
 * "atamaların %80'i tamam" paketi bitmiş gibi gösterir, oysa beş eğitimin
 * dördünü bitiren kişi hâlâ hatta çıkamaz. "Kaç kişi paketi BİTİRDİ" bu yüzden
 * asıl sayıdır ve önce o yazılır.
 */
function Ilerleme({ ozet }: { ozet: PaketOzeti }) {
  if (ozet.kisi === 0) {
    return (
      <p className="mt-4 rounded-xl bg-wash px-3 py-2 text-sm text-muted">
        Bu paket henüz kimseye düşmüyor. Atama kuralı yazılınca ilerleme burada görünür.
      </p>
    );
  }
  const bitirenOran = Math.round((ozet.bitiren / ozet.kisi) * 100);
  return (
    <div className="mt-4 rounded-xl bg-wash p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm">
          <strong className="text-lg">{ozet.bitiren}</strong>
          <span className="text-muted"> / {ozet.kisi} kişi paketi bitirdi</span>
        </p>
        <p className="text-xs text-muted">
          kişi başına ortalama {ozet.ortalamaTamam} / {ozet.ortalamaToplam} eğitim · atamaların %{ozet.oran}&apos;i tamam
        </p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-line">
        <div
          className={`h-full rounded-full ${bitirenOran >= 70 ? "bg-iyi" : bitirenOran >= 40 ? "bg-orta" : "bg-brand"}`}
          style={{ width: `${bitirenOran}%` }}
        />
      </div>
    </div>
  );
}

/* ── düzenleme görünümü ───────────────────────────────────────────────────── */

function Duzenle({
  paket,
  egitimler,
  onKapat,
}: {
  paket: PaketSatiri;
  egitimler: EgitimSecenegi[];
  onKapat: () => void;
}) {
  const router = useRouter();
  const [ad, setAd] = useState(paket.ad);
  const [aciklama, setAciklama] = useState(paket.aciklama);
  const [uyeler, setUyeler] = useState<string[]>(paket.egitimIdleri);
  const [sorgu, setSorgu] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  const adlar = new Map(egitimler.map((e) => [e.id, e]));
  const adaylar = egitimler.filter((e) => !uyeler.includes(e.id) && (eslesir(e.ad, sorgu) || eslesir(e.kategori, sorgu)));

  function tasi(i: number, yon: -1 | 1) {
    const hedef = i + yon;
    if (hedef < 0 || hedef >= uyeler.length) return;
    const y = uyeler.slice();
    [y[i], y[hedef]] = [y[hedef], y[i]];
    setUyeler(y);
  }

  async function kaydet() {
    if (kaydediliyor) return;
    setKaydediliyor(true);
    setHata(null);
    const h = await grupKaydetEylem(paket.id, { ad, aciklama, egitimIdleri: uyeler });
    setKaydediliyor(false);
    if (h) return setHata(h);
    onKapat();
    router.refresh();
  }

  return (
    <section className="card border-accent p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">Paket adı</span>
          <input value={ad} onChange={(e) => setAd(e.target.value)} className="input-base" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">Açıklama</span>
          <input
            value={aciklama}
            onChange={(e) => setAciklama(e.target.value)}
            placeholder="Ne zaman verilir, kime verilir"
            className="input-base"
          />
        </label>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div>
          <p className="eyebrow mb-2">
            Paketteki eğitimler · {uyeler.length}
            <span className="ml-2 font-normal normal-case tracking-normal text-muted">sıra kioskta bu şekilde görünür</span>
          </p>
          {uyeler.length === 0 ? (
            <p className="card p-6 text-center text-sm text-muted">Sağdaki listeden eğitim ekleyin.</p>
          ) : (
            <ol className="space-y-1.5">
              {uyeler.map((id, i) => {
                const e = adlar.get(id);
                return (
                  <li key={id} className="card flex items-center gap-2 p-2.5">
                    <span className="w-5 shrink-0 text-center text-xs font-bold text-muted">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{e?.ad ?? "(silinmiş eğitim)"}</span>
                      {e && !e.yayinda ? <span className="text-xs text-orta-dark">Taslak — kioskta görünmez</span> : null}
                    </span>
                    <button
                      onClick={() => tasi(i, -1)}
                      disabled={i === 0}
                      className="btn-icon"
                      aria-label="Yukarı taşı"
                    >
                      <Icon name="up" size={14} />
                    </button>
                    <button
                      onClick={() => tasi(i, 1)}
                      disabled={i === uyeler.length - 1}
                      className="btn-icon"
                      aria-label="Aşağı taşı"
                    >
                      <Icon name="down" size={14} />
                    </button>
                    <button
                      onClick={() => setUyeler(uyeler.filter((x) => x !== id))}
                      className="btn-icon hover:text-brand"
                      aria-label="Paketten çıkar"
                    >
                      <Icon name="close" size={14} />
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        <div>
          <p className="eyebrow mb-2">Eklenebilecek eğitimler</p>
          <input
            value={sorgu}
            onChange={(e) => setSorgu(e.target.value)}
            placeholder="Ada ya da kategoriye göre ara"
            className="input-base"
          />
          <ul className="card mt-2 max-h-72 divide-y divide-line overflow-y-auto p-0">
            {adaylar.length === 0 ? (
              <li className="p-5 text-center text-sm text-muted">Eklenecek eğitim kalmadı.</li>
            ) : (
              adaylar.map((e) => (
                <li key={e.id}>
                  <button
                    onClick={() => setUyeler([...uyeler, e.id])}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-wash"
                  >
                    <Icon name="plus" size={14} className="text-accent" />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{e.ad}</span>
                    {e.kategori ? <span className="shrink-0 text-xs text-muted">{e.kategori}</span> : null}
                    {e.yayinda ? null : <span className="shrink-0 text-xs text-orta-dark">taslak</span>}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>

      {hata ? (
        <p role="alert" className="mt-4 rounded-xl border border-brand/30 bg-brand-soft px-3 py-2 text-sm font-semibold text-brand-dark">
          {hata}
        </p>
      ) : null}

      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onKapat} className="btn-ghost text-sm">
          Vazgeç
        </button>
        <button onClick={kaydet} disabled={kaydediliyor} className="btn-primary text-sm">
          <Icon name="save" size={16} /> {kaydediliyor ? "Kaydediliyor…" : "Kaydet"}
        </button>
      </div>
    </section>
  );
}
