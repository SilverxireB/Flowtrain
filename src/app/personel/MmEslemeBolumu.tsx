"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { useConfirm } from "@/components/ConfirmDialog";
import type { MmEsleme } from "@/lib/depo";
import type { PersonelKaydi } from "@/lib/adaptor";
import { eslemeyiUygulaEylem, mmEslemeKaydetEylem, mmEslemeSilEylem } from "./eylemler";
import FlowSecici from "@/components/FlowSecici";

/**
 * MALİYET MERKEZİ → BÖLÜM + AMİR EŞLEMESİ.
 *
 * OPM kaydında yalnız maliyet merkezi kodu var; kimin hangi bölümde olduğunu
 * ve amirini bu tablo söylüyor. Eşleme VERİDİR: fabrika kendi kodlarını
 * kendisi bağlar, yeni kod için yazılımcı gerekmez.
 */
export default function MmEslemeBolumu({
  eslemeler,
  bolumler,
  adlar,
  amirler,
}: {
  eslemeler: MmEsleme[];
  bolumler: string[];
  adlar: Map<string, string>;
  amirler: PersonelKaydi[];
}) {
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const [kod, setKod] = useState("");
  const [bolum, setBolum] = useState("");
  const [amirSicil, setAmirSicil] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [bilgi, setBilgi] = useState<string | null>(null);

  async function ekle() {
    setHata(null);
    setBilgi(null);
    const h = await mmEslemeKaydetEylem(kod, bolum, amirSicil);
    if (h) return setHata(h);
    setKod("");
    setBolum("");
    setAmirSicil("");
    router.refresh();
  }

  async function uygula() {
    setHata(null);
    const s = await eslemeyiUygulaEylem();
    setBilgi(
      `${s.uygulanan} kayda uygulandı.` +
        (s.eslemesizKodlar.length ? ` Eşlemesi tanımsız kodlar: ${s.eslemesizKodlar.join(", ")}` : ""),
    );
    router.refresh();
  }

  return (
    <section className="card mt-8 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-flow bg-accent-soft text-accent">
          <Icon name="swap" size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Maliyet merkezi eşlemesi</p>
          <p className="text-sm text-muted">
            OPM kaydında yalnız kod var; hangi kodun hangi bölüm ve amir demek olduğunu burada tanımlarsınız.
          </p>
        </div>
        {eslemeler.length > 0 ? (
          <button onClick={uygula} className="btn-ghost shrink-0 text-sm">
            <Icon name="refresh" size={16} /> Tüm listeye uygula
          </button>
        ) : null}
      </div>

      {eslemeler.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {eslemeler.map((e) => (
            <li key={e.kod} className="flex flex-wrap items-center gap-3 rounded-flow border border-line px-3 py-2 text-sm">
              <span className="font-mono text-xs font-semibold">{e.kod}</span>
              <Icon name="chevronRight" size={14} className="text-muted" />
              <span className="min-w-0 flex-1">
                {e.bolum || <span className="text-muted">bölüm atanmadı</span>}
                {e.amirSicil ? (
                  <span className="text-muted">
                    {" "}
                    · amir {adlar.get(e.amirSicil) ?? ""} <span className="font-mono text-xs">{e.amirSicil}</span>
                  </span>
                ) : null}
              </span>
              <button
                onClick={() =>
                  confirm(
                    {
                      title: "Eşlemeyi sil",
                      message: `${e.kod} kodunun bölüm/amir eşlemesi silinecek. Mevcut personel kayıtları değişmez.`,
                      danger: true,
                      confirmLabel: "Sil",
                    },
                    async () => {
                      await mmEslemeSilEylem(e.kod);
                      router.refresh();
                    },
                  )
                }
                className="btn-ghost px-2 py-1 text-xs"
                aria-label={`${e.kod} eşlemesini sil`}
              >
                <Icon name="trash" size={14} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted">Henüz eşleme tanımlı değil.</p>
      )}

      <div className="mt-4 flex flex-wrap items-end gap-2">
        <label className="w-32">
          <span className="text-xs font-semibold text-muted">Kod</span>
          <input value={kod} onChange={(e) => setKod(e.target.value)} placeholder="264302" className="input-base mt-1 font-mono text-sm" />
        </label>
        <label className="min-w-0 flex-1">
          <span className="text-xs font-semibold text-muted">Bölüm</span>
          <input value={bolum} onChange={(e) => setBolum(e.target.value)} list="mm-bolum-listesi" className="input-base mt-1 text-sm" />
          <datalist id="mm-bolum-listesi">
            {bolumler.map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>
        </label>
        <label className="w-52">
          <span className="text-xs font-semibold text-muted">Amir</span>
          {/* Amir SEÇİLİR, yazılmaz — aday listesi rolü amir yapılmış kişilerdir. */}
          <FlowSecici value={amirSicil} onChange={setAmirSicil} sinif="mt-1" aria-label="Amir">
            <option value="">Amir yok</option>
            {amirler.map((a) => (
              <option key={a.sicil} value={a.sicil}>
                {a.ad} · {a.sicil}
              </option>
            ))}
          </FlowSecici>
        </label>
        <button onClick={ekle} className="btn-primary text-sm">
          <Icon name="plus" size={16} /> Kaydet
        </button>
      </div>
      <p className="mt-2 text-xs text-muted">
        Var olan bir kodu tekrar kaydetmek eşlemesini günceller. Listede aradığınız amir yoksa önce yukarıdan o kişinin
        rolünü Amir yapın.
      </p>

      {hata ? (
        <p role="alert" className="mt-3 rounded-flow border border-brand/30 bg-brand-soft px-3 py-2 text-sm font-semibold text-brand-dark">
          {hata}
        </p>
      ) : null}
      {bilgi ? (
        <p className="mt-3 rounded-flow border border-iyi/40 bg-iyi/10 px-3 py-2 text-sm font-semibold text-iyi-dark">{bilgi}</p>
      ) : null}

      {dialog}
    </section>
  );
}
