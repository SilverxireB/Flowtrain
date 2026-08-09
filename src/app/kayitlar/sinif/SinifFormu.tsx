"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Icon from "@/components/Icon";
import { useConfirm } from "@/components/ConfirmDialog";
import RaporOzeti from "../RaporOzeti";
import { sinifDenetleEylem, sinifKaydetEylem, type SinifGirdisi } from "../eylemler";
import type { AktarimRaporu } from "@/lib/kayitAktarim";

interface EgitimSecenegi {
  id: string;
  ad: string;
  durum: "taslak" | "yayin";
  egitmen: string;
  sureDk?: number;
}

/**
 * SINIF KAYIT FORMU — iki adım: DENETLE, sonra KAYDET.
 *
 * Tek adım olsaydı otuz kişilik bir listede tek harf hatası olan sicil sessizce
 * atlanır, eğitmen de "girdim" sanırdı. Denetim adımı listeyi kaydetmeden önce
 * kimin gireceğini, kimin neden atlanacağını gösterir.
 */
export default function SinifFormu({ egitimler, bugunGun }: { egitimler: EgitimSecenegi[]; bugunGun: string }) {
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const [egitimId, setEgitimId] = useState("");
  const [gun, setGun] = useState(bugunGun);
  const [egitmen, setEgitmen] = useState("");
  const [notlar, setNotlar] = useState("");
  const [liste, setListe] = useState("");
  const [rapor, setRapor] = useState<AktarimRaporu | null>(null);
  const [yazilan, setYazilan] = useState<number | undefined>(undefined);
  const [hata, setHata] = useState<string | null>(null);
  const [calisiyor, setCalisiyor] = useState(false);

  const secilen = egitimler.find((e) => e.id === egitimId);

  function girdi(): SinifGirdisi {
    return { egitimId, gun, egitmen, notlar, liste };
  }

  /** Eğitim seçilince eğitmen alanı katalogdaki varsayılanla dolar (elle silinebilir). */
  function egitimSec(id: string) {
    setEgitimId(id);
    setRapor(null);
    setYazilan(undefined);
    const e = egitimler.find((x) => x.id === id);
    if (e?.egitmen && !egitmen.trim()) setEgitmen(e.egitmen);
  }

  async function denetle() {
    if (calisiyor) return;
    setCalisiyor(true);
    setHata(null);
    setYazilan(undefined);
    const c = await sinifDenetleEylem(girdi());
    setCalisiyor(false);
    if (c.hata) {
      setRapor(null);
      return setHata(c.hata);
    }
    setRapor(c.rapor ?? null);
  }

  async function kaydet() {
    if (calisiyor) return;
    setCalisiyor(true);
    setHata(null);
    const c = await sinifKaydetEylem(girdi());
    setCalisiyor(false);
    if (c.hata) return setHata(c.hata);
    setRapor(c.rapor ?? null);
    setYazilan(c.yazilan);
    setListe("");
    router.refresh();
  }

  return (
    <div className="max-w-3xl">
      <p className="card p-5 text-sm text-muted">
        Eğitmen sınıfta anlattı, katılım listesi burada deftere geçer. Kayıtlar{" "}
        <strong className="text-ink">Sınıf eğitimi</strong> kaynağıyla işaretlenir — kioskta yapılmış gibi görünmezler.
        Bir kez yazılan kayıt <strong className="text-ink">düzenlenmez ve silinmez</strong>; düzeltme yeni bir kayıt ve
        notuyla yapılır.
      </p>

      <div className="card mt-4 space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-semibold text-muted">Eğitim</span>
            <select value={egitimId} onChange={(e) => egitimSec(e.target.value)} className="input-base mt-1">
              <option value="">Seçin…</option>
              {egitimler.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.ad}
                  {e.durum !== "yayin" ? " (taslak)" : ""}
                </option>
              ))}
            </select>
            {secilen && secilen.durum !== "yayin" ? (
              <span className="mt-1 block text-xs text-orta-dark">
                Bu eğitim yayında değil. Kayıt yine de yazılır ama kayıtlar &quot;sürüm N&quot;e atıf yapar — taslak
                içerik daha sonra değişebilir.
              </span>
            ) : null}
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-muted">Tarih</span>
            <input type="date" value={gun} onChange={(e) => setGun(e.target.value)} className="input-base mt-1" />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-muted">Eğitmen</span>
            <input
              value={egitmen}
              onChange={(e) => setEgitmen(e.target.value)}
              placeholder="Dersi veren kişi"
              className="input-base mt-1"
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-muted">Not (isteğe bağlı)</span>
            <input
              value={notlar}
              onChange={(e) => setNotlar(e.target.value)}
              placeholder="Ör. Yerinde tatbikatla birlikte"
              className="input-base mt-1"
            />
          </label>
        </div>

        <label className="block">
          <span className="text-xs font-semibold text-muted">Katılımcılar</span>
          <textarea
            value={liste}
            onChange={(e) => {
              setListe(e.target.value);
              setRapor(null);
              setYazilan(undefined);
            }}
            rows={10}
            placeholder={"Her satıra bir sicil (yanında ad soyad olabilir):\n10109369 Bülent Sandıkçı\n10112044\n10098771 Ayşe Demir"}
            className="input-base mt-1 font-mono text-xs"
          />
          {/* Listeyi TEMİZLEMEYE ZORLAMIYORUZ: eğitmen kâğıttan ya da bir
              e-postadan yapıştırır; satırın ilk parçası sicil sayılır. */}
          <span className="mt-1 block text-xs text-muted">
            Satırın ilk parçası sicil sayılır; gerisi yok sayılır. Kâğıt listeyi olduğu gibi yapıştırabilirsiniz.
          </span>
        </label>

        {hata ? (
          <p
            role="alert"
            className="rounded-xl border border-brand/30 bg-brand-soft px-3 py-2 text-sm font-semibold text-brand-dark"
          >
            {hata}
          </p>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2">
          <button onClick={denetle} disabled={calisiyor} className="btn-ghost text-sm disabled:opacity-60">
            <Icon name="eye" size={16} /> {calisiyor ? "Bakılıyor…" : "Listeyi denetle"}
          </button>
          <button
            onClick={() =>
              confirm(
                {
                  title: "Kayıtlar yazılsın mı?",
                  message: `${rapor?.gecerli ?? 0} kişi için tamamlama kaydı oluşturulacak.\n\nKayıtlar sonradan düzenlenemez ve silinemez.`,
                  confirmLabel: "Kaydet",
                },
                kaydet,
              )
            }
            disabled={calisiyor || !rapor || rapor.gecerli === 0}
            className="btn-primary text-sm disabled:opacity-40"
          >
            <Icon name="save" size={16} /> Kaydet{rapor && rapor.gecerli > 0 ? ` (${rapor.gecerli})` : ""}
          </button>
        </div>
      </div>

      {rapor ? <RaporOzeti rapor={rapor} yazilan={yazilan} /> : null}
      {dialog}
    </div>
  );
}
