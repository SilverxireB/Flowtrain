"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";
import { eslesir } from "@/lib/arama";

/**
 * EĞİTİM KATALOĞU — liste değil TABLO.
 *
 * Neden tablo: 60 eğitimli bir kurulumda "hangisi yayında, hangisi kimseye
 * atanmamış, hangisinin tamamlanma oranı düşük" soruları kartlı listede
 * kaydırarak cevaplanmıyor. Sütunlar yan yana durunca göz tek bakışta
 * karşılaştırıyor.
 *
 * SÜZGEÇ VE SIRALAMA İSTEMCİDE: katalog fabrikanın tamamı için birkaç yüz
 * satır; her tuş vuruşunda sunucuya gitmek kapalı ağda bile gereksiz gecikme.
 * Arama `eslesir` ile — `toLowerCase().includes()` Türkçede sessizce yanlış
 * çalışır (bkz. `arama.ts`).
 */

export interface KatalogSatiri {
  id: string;
  ad: string;
  kategori: string;
  yayinda: boolean;
  surum: number;
  zorunlu: boolean;
  sureDk?: number;
  sayfa: number;
  soru: number;
  /** Bu eğitimin düştüğü kişi sayısı (paket kuralları çözülmüş hâliyle). */
  kisi: number;
  tamam: number;
  oran: number;
  /** Aktif bir kural var mı — taslak eğitimde kural olsa bile kimseye düşmez. */
  kuralVar: boolean;
  /** Üyesi olduğu paketlerin adları. */
  paketler: string[];
}

type Sutun = "ad" | "durum" | "kisi" | "oran" | "sure";

export default function Katalog({ satirlar, kategoriler }: { satirlar: KatalogSatiri[]; kategoriler: string[] }) {
  const [sorgu, setSorgu] = useState("");
  const [kategori, setKategori] = useState("");
  const [durum, setDurum] = useState<"" | "yayin" | "taslak">("");
  const [yalnizZorunlu, setYalnizZorunlu] = useState(false);
  const [sirala, setSirala] = useState<Sutun>("ad");
  const [ters, setTers] = useState(false);
  const [sayfaBoyu, setSayfaBoyu] = useState(20);
  const [sayfa, setSayfa] = useState(1);

  const suzulmus = useMemo(() => {
    const liste = satirlar.filter(
      (s) =>
        (!kategori || s.kategori === kategori) &&
        (!durum || (durum === "yayin") === s.yayinda) &&
        (!yalnizZorunlu || s.zorunlu) &&
        (eslesir(s.ad, sorgu) || eslesir(s.kategori, sorgu) || s.paketler.some((p) => eslesir(p, sorgu))),
    );
    return liste.sort((a, b) => (ters ? -1 : 1) * karsilastir(a, b, sirala));
  }, [satirlar, sorgu, kategori, durum, yalnizZorunlu, sirala, ters]);

  const sonSayfa = Math.max(1, Math.ceil(suzulmus.length / sayfaBoyu));
  const gecerliSayfa = Math.min(sayfa, sonSayfa);
  const gorunen = suzulmus.slice((gecerliSayfa - 1) * sayfaBoyu, gecerliSayfa * sayfaBoyu);

  function sutunaBas(s: Sutun) {
    if (s === sirala) return setTers((t) => !t);
    setSirala(s);
    setTers(s !== "ad");
    setSayfa(1);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="min-w-[14rem] flex-1">
          <span className="sr-only">Katalogda ara</span>
          <input
            value={sorgu}
            onChange={(e) => {
              setSorgu(e.target.value);
              setSayfa(1);
            }}
            placeholder="Eğitim adı, kategori ya da paket adına göre ara"
            className="input-base"
          />
        </label>

        <label className="shrink-0">
          <span className="sr-only">Kategori süzgeci</span>
          <select
            value={kategori}
            onChange={(e) => {
              setKategori(e.target.value);
              setSayfa(1);
            }}
            className="input-base w-auto"
          >
            <option value="">Tüm kategoriler</option>
            {kategoriler.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>

        <label className="shrink-0">
          <span className="sr-only">Durum süzgeci</span>
          <select
            value={durum}
            onChange={(e) => {
              setDurum(e.target.value as "" | "yayin" | "taslak");
              setSayfa(1);
            }}
            className="input-base w-auto"
          >
            <option value="">Taslak + yayında</option>
            <option value="yayin">Yalnız yayındakiler</option>
            <option value="taslak">Yalnız taslaklar</option>
          </select>
        </label>

        <button
          type="button"
          onClick={() => {
            setYalnizZorunlu((z) => !z);
            setSayfa(1);
          }}
          aria-pressed={yalnizZorunlu}
          className={`chip shrink-0 text-sm transition ${
            yalnizZorunlu ? "border-accent bg-accent-soft text-accent-dark" : "hover:border-muted/50"
          }`}
        >
          {yalnizZorunlu ? <Icon name="check" size={14} /> : <Icon name="shield" size={14} />} Yasal zorunlu
        </button>
      </div>

      {gorunen.length === 0 ? (
        <p className="card mt-4 p-8 text-center text-muted">Eşleşen eğitim yok.</p>
      ) : (
        <div className="card mt-4 overflow-x-auto p-0">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <Baslik sutun="ad" etiket="Eğitim" aktif={sirala} ters={ters} bas={sutunaBas} />
                <Baslik sutun="durum" etiket="Durum" aktif={sirala} ters={ters} bas={sutunaBas} />
                <th className="px-3 py-3 font-semibold">İçerik</th>
                <Baslik sutun="sure" etiket="Süre" aktif={sirala} ters={ters} bas={sutunaBas} sagda />
                <Baslik sutun="kisi" etiket="Atanan" aktif={sirala} ters={ters} bas={sutunaBas} sagda />
                <Baslik sutun="oran" etiket="Tamamlanma" aktif={sirala} ters={ters} bas={sutunaBas} />
                <th className="px-2 py-3" />
              </tr>
            </thead>
            <tbody>
              {gorunen.map((s) => (
                <tr key={s.id} className="border-b border-line last:border-0 hover:bg-wash">
                  <td className="px-4 py-2.5">
                    <Link href={`/egitimler/${s.id}`} className="font-semibold hover:text-accent">
                      {s.ad}
                    </Link>
                    <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      {s.kategori ? <span className="text-xs text-muted">{s.kategori}</span> : null}
                      {s.zorunlu ? (
                        <span className="chip border-brand/30 bg-brand-soft px-2 py-0 text-[11px] text-brand-dark">
                          <Icon name="shield" size={11} /> Zorunlu
                        </span>
                      ) : null}
                      {s.paketler.map((p) => (
                        <span key={p} className="chip px-2 py-0 text-[11px] text-muted">
                          <Icon name="folder" size={11} /> {p}
                        </span>
                      ))}
                    </span>
                  </td>

                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {s.yayinda ? (
                      <span className="chip border-iyi/30 bg-iyi/10 text-xs text-iyi-dark">
                        <Icon name="check" size={12} /> Yayında
                      </span>
                    ) : (
                      <span className="chip text-xs text-muted">
                        <Icon name="pencil" size={12} /> Taslak
                      </span>
                    )}
                    <span className="mt-0.5 block text-xs text-muted">sürüm {s.surum}</span>
                  </td>

                  <td className="px-3 py-2.5 whitespace-nowrap text-muted">
                    {s.sayfa} sayfa · {s.soru} soru
                  </td>

                  <td className="px-3 py-2.5 text-right whitespace-nowrap text-muted">
                    {s.sureDk ? `${s.sureDk} dk` : "—"}
                  </td>

                  <td className="px-3 py-2.5 text-right whitespace-nowrap">
                    {s.kisi > 0 ? (
                      <strong>{s.kisi}</strong>
                    ) : (
                      /* Ayrım ÖNEMLİ: kuralı olmayan eğitim unutulmuştur;
                         kuralı olup taslakta kalan eğitim yayın bekliyordur. */
                      <span className="text-xs text-muted">{s.kuralVar && !s.yayinda ? "yayın bekliyor" : "atanmamış"}</span>
                    )}
                  </td>

                  <td className="px-3 py-2.5">
                    {s.kisi > 0 ? (
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-20 shrink-0 overflow-hidden rounded-full bg-line">
                          <span
                            className={`block h-full rounded-full ${
                              s.oran >= 70 ? "bg-iyi" : s.oran >= 40 ? "bg-orta" : "bg-brand"
                            }`}
                            style={{ width: `${s.oran}%` }}
                          />
                        </span>
                        <span className="whitespace-nowrap text-xs text-muted">
                          %{s.oran} <span className="text-muted/70">({s.tamam}/{s.kisi})</span>
                        </span>
                      </span>
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </td>

                  <td className="px-2 py-2.5 text-right">
                    <Link href={`/egitimler/${s.id}`} className="btn-icon" aria-label={`${s.ad} eğitimini aç`}>
                      <Icon name="chevronRight" size={16} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted">
        <span>
          <strong className="text-ink">{suzulmus.length}</strong> eğitim
          {suzulmus.length !== satirlar.length ? ` (toplam ${satirlar.length})` : ""}
        </span>
        <span className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setSayfa(gecerliSayfa - 1)}
            disabled={gecerliSayfa <= 1}
            className="btn-ghost px-2 py-1 disabled:opacity-40"
            aria-label="Önceki sayfa"
          >
            <Icon name="chevronLeft" size={16} />
          </button>
          <span className="font-semibold text-ink">
            {gecerliSayfa} / {sonSayfa}
          </span>
          <button
            onClick={() => setSayfa(gecerliSayfa + 1)}
            disabled={gecerliSayfa >= sonSayfa}
            className="btn-ghost px-2 py-1 disabled:opacity-40"
            aria-label="Sonraki sayfa"
          >
            <Icon name="chevronRight" size={16} />
          </button>
          <select
            value={sayfaBoyu}
            onChange={(e) => {
              setSayfaBoyu(Number(e.target.value));
              setSayfa(1);
            }}
            className="input-base w-auto py-1 text-sm"
            aria-label="Sayfa başına eğitim"
          >
            {[20, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </span>
      </div>
    </div>
  );
}

/**
 * Sıralama karşılaştırması — modül seviyesinde, kapanış DEĞİL.
 * (`csv.ts`teki küçültücü tuzağı: parametre yakalayan ve birden çok kez
 * çağrılan yardımcı satır içine alınırken bozulabiliyor.)
 */
function karsilastir(a: KatalogSatiri, b: KatalogSatiri, sutun: Sutun): number {
  switch (sutun) {
    case "durum":
      return Number(a.yayinda) - Number(b.yayinda);
    case "kisi":
      return a.kisi - b.kisi;
    case "oran":
      // Atanmamış eğitimin oranı YOK; sıralamada en dibe iner, %0 ile karışmaz.
      return (a.kisi === 0 ? -1 : a.oran) - (b.kisi === 0 ? -1 : b.oran);
    case "sure":
      return (a.sureDk ?? -1) - (b.sureDk ?? -1);
    default:
      return a.ad.localeCompare(b.ad, "tr");
  }
}

function Baslik({
  sutun,
  etiket,
  aktif,
  ters,
  bas,
  sagda,
}: {
  sutun: Sutun;
  etiket: string;
  aktif: Sutun;
  ters: boolean;
  bas: (s: Sutun) => void;
  sagda?: boolean;
}) {
  const secili = aktif === sutun;
  return (
    <th className={`px-3 py-3 font-semibold ${sagda ? "text-right" : ""}`} aria-sort={secili ? (ters ? "descending" : "ascending") : "none"}>
      <button
        type="button"
        onClick={() => bas(sutun)}
        className={`dokunma-44 inline-flex items-center gap-1 hover:text-ink ${secili ? "text-ink" : ""}`}
      >
        {etiket}
        {secili ? <Icon name={ters ? "down" : "up"} size={12} /> : null}
      </button>
    </th>
  );
}
