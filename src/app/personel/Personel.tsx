"use client";

import { useMemo, useState } from "react";
import { tabloSirala, sonrakiSira, type SiraYonu } from "@/lib/tabloSirala";
import TabloBaslik from "@/components/TabloBaslik";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { eslesir } from "@/lib/arama";
import type { PersonelKaydi } from "@/lib/adaptor";
import type { MmEsleme } from "@/lib/depo";
import { personelGuncelleEylem } from "./eylemler";
import MmEslemeBolumu from "./MmEslemeBolumu";
import OpmAktar from "./OpmAktar";
import FlowSecici from "@/components/FlowSecici";

/**
 * PERSONEL LİSTESİ — kayıt ÜÇ ŞEYDİR: sicil, isim, maliyet merkezi. Artı rol.
 *
 * Bölüm ve amir ELLE YAZILMAZ: maliyet merkezi eşlemesinden türer ve ekranda
 * yalnız gösterilir. Elle girilseydi OPM'den gelen her liste el emeğini ezer,
 * iki gerçek yarışırdı. Rol de yalın: herkes operatördür, bazıları amir yapılır
 * — amir tabletine girecek kişiyi bu belirler.
 */
/**
 * SÜTUN → SIRALANACAK DEĞER. Modül seviyesinde: her çizimde yeniden
 * kurulsaydı `useMemo` bağımlılığı her turda değişir ve sıralama boşuna
 * tekrarlanırdı.
 *
 * "Amir" sütunu SİCİLE değil ADA göre sıralanır: ekranda görünen ad,
 * sicile göre sıralanmış bir liste kullanıcıya rastgele görünürdü.
 */
const SIRA_ALANI: Record<string, (k: PersonelKaydi) => unknown> = {
  sicil: (k) => k.sicil,
  ad: (k) => k.ad,
  mm: (k) => k.maliyetMerkezi,
  bolum: (k) => k.bolum,
  rol: (k) => rolNedir(k.gorev),
  /* Amir sütunu SİCİLE göre sıralanıyor: ada göre sıralamak için burada
     sicil→ad sözlüğü gerekirdi ve o sözlük bileşenin durumunda duruyor.
     Modül seviyesindeki bu sözlüğe taşımak, saf olmayan bir bağ kurardı. */
  amir: (k) => k.amirSicil,
};

export default function Personel({
  kisiler,
  eslemeler,
  kaynakAdi,
  duzenlenebilir,
}: {
  kisiler: PersonelKaydi[];
  eslemeler: MmEsleme[];
  kaynakAdi: string;
  duzenlenebilir: boolean;
}) {
  const [sorgu, setSorgu] = useState("");
  const [bolumSuzgec, setBolumSuzgec] = useState("");
  const [sayfaBoyu, setSayfaBoyu] = useState(20);
  const [sayfa, setSayfa] = useState(1);
  const [duzenlenen, setDuzenlenen] = useState<PersonelKaydi | null>(null);

  const adlar = useMemo(() => new Map(kisiler.map((k) => [k.sicil, k.ad])), [kisiler]);
  const amirler = useMemo(() => kisiler.filter((k) => rolNedir(k.gorev) === "Amir"), [kisiler]);
  const bolumler = useMemo(
    () => [...new Set(kisiler.map((k) => k.bolum).filter(Boolean))].sort((a, b) => a.localeCompare(b, "tr")),
    [kisiler],
  );

  const [sira, setSira] = useState<{ sutun: string; yon: SiraYonu }>({ sutun: "ad", yon: "artan" });

  const suzulmus = useMemo(
    () =>
      kisiler.filter(
        (k) =>
          (!bolumSuzgec || k.bolum === bolumSuzgec) &&
          (eslesir(k.ad, sorgu) || eslesir(k.sicil, sorgu) || eslesir(k.maliyetMerkezi, sorgu)),
      ),
    [kisiler, sorgu, bolumSuzgec],
  );

  /* SIRALAMA — kokpit tablolarının ortak dili. Personel listesinde Türkçe
     harmanlama özellikle önemli: ham dize karşılaştırması Ç/Ğ/İ/Ö/Ş/Ü ile
     başlayan her adı listenin sonuna sürüyordu. Varsayılan ada göre artan. */
  const sirali = useMemo(
    () => tabloSirala(suzulmus, (k) => SIRA_ALANI[sira.sutun]?.(k), sira.yon),
    [suzulmus, sira],
  );

  const sonSayfa = Math.max(1, Math.ceil(sirali.length / sayfaBoyu));
  const gecerliSayfa = Math.min(sayfa, sonSayfa);
  const gorunen = sirali.slice((gecerliSayfa - 1) * sayfaBoyu, gecerliSayfa * sayfaBoyu);

  function sutunaBas(sutun: string) {
    setSira((s) => sonrakiSira(s, sutun));
    setSayfa(1);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Personelde ara</span>
          <input
            value={sorgu}
            onChange={(e) => {
              setSorgu(e.target.value);
              setSayfa(1);
            }}
            placeholder="Ada, sicile veya maliyet merkezine göre ara"
            className="input-base"
          />
        </label>
        <label className="shrink-0">
          <span className="sr-only">Bölüm süzgeci</span>
          <FlowSecici
            value={bolumSuzgec}
            onChange={(v) => {
              setBolumSuzgec(v);
              setSayfa(1);
            }}
          >
            <option value="">Tüm bölümler</option>
            {bolumler.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </FlowSecici>
        </label>
      </div>

      {gorunen.length === 0 ? (
        <p className="flow-bos-satir mt-4">
          {kisiler.length === 0 ? "Personel dosyası boş. Aşağıdan OPM dosyası aktarabilirsiniz." : "Eşleşen kayıt yok."}
        </p>
      ) : (
        <div className="flow-tablo-kap flow-kaydir-x mt-4">
          <table className="flow-tablo min-w-[640px]">
            <thead>
              {/* Başlık şeridi ve kenarlık `.flow-tablo`dan; burada yalnız punto. */}
              <tr className="text-xs">
                <TabloBaslik sutun="sicil" etiket="Sicil" sira={sira} bas={sutunaBas} sinif="px-4 py-3 font-semibold" />
                <TabloBaslik sutun="ad" etiket="Ad" sira={sira} bas={sutunaBas} sinif="px-4 py-3 font-semibold" />
                <TabloBaslik sutun="mm" etiket="Maliyet M." sira={sira} bas={sutunaBas} sinif="px-4 py-3 font-semibold" />
                <TabloBaslik sutun="bolum" etiket="Bölüm" sira={sira} bas={sutunaBas} sinif="px-4 py-3 font-semibold" />
                <TabloBaslik sutun="rol" etiket="Rol" sira={sira} bas={sutunaBas} sinif="px-4 py-3 font-semibold" />
                <TabloBaslik sutun="amir" etiket="Amir" sira={sira} bas={sutunaBas} sinif="px-4 py-3 font-semibold" />
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {gorunen.map((k) => (
                <tr key={k.sicil}>
                  <td className="px-4 py-2.5 font-mono text-xs">{k.sicil}</td>
                  <td className="px-4 py-2.5 font-semibold">{k.ad || "—"}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{k.maliyetMerkezi || "—"}</td>
                  <td className="px-4 py-2.5">{k.bolum || "—"}</td>
                  <td className="px-4 py-2.5">
                    {rolNedir(k.gorev) === "Amir" ? (
                      <span className="chip text-xs text-accent">
                        <Icon name="shield" size={12} /> Amir
                      </span>
                    ) : (
                      <span className="text-muted">{k.gorev || "Operatör"}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {k.amirSicil ? (
                      <span>
                        {adlar.get(k.amirSicil) ?? ""}
                        <span className="font-mono text-xs text-muted"> {k.amirSicil}</span>
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-2 py-2.5 text-right">
                    {duzenlenebilir ? (
                      <button
                        onClick={() => setDuzenlenen(k)}
                        className="btn-ghost dokunma-44 px-2 py-1 text-xs"
                        aria-label={`${k.ad || k.sicil} kaydını düzenle`}
                      >
                        <Icon name="pencil" size={14} />
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted">
        <span className="font-semibold text-ink">{suzulmus.length}</span> kayıt
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
          <FlowSecici
            value={String(sayfaBoyu)}
            onChange={(v) => {
              setSayfaBoyu(Number(v));
              setSayfa(1);
            }}
            aria-label="Sayfa başına kayıt"
          >
            {[20, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </FlowSecici>
        </span>
      </div>

      {duzenlenebilir ? (
        <>
          <MmEslemeBolumu eslemeler={eslemeler} bolumler={bolumler} adlar={adlar} amirler={amirler} />
          <OpmAktar />
        </>
      ) : (
        <p className="card mt-8 p-5 text-sm text-muted">
          Personel kaynağı <strong className="text-ink">{kaynakAdi}</strong> buradan düzenlenemez — kayıtlar kaynağın
          kendisinde değiştirilir ve buraya yansır.
        </p>
      )}

      {duzenlenen ? (
        <Duzenle kisi={duzenlenen} eslemeler={eslemeler} onKapat={() => setDuzenlenen(null)} />
      ) : null}
    </div>
  );
}

/** Görev alanı rolü taşır; boş ya da tanınmayan her değer operatör sayılır. */
function rolNedir(gorev: string): "Amir" | "Operatör" {
  return gorev.trim().toLocaleLowerCase("tr") === "amir" ? "Amir" : "Operatör";
}

/* ── düzenleme penceresi ──────────────────────────────────────────────────── */

function Duzenle({
  kisi,
  eslemeler,
  onKapat,
}: {
  kisi: PersonelKaydi;
  eslemeler: MmEsleme[];
  onKapat: () => void;
}) {
  const router = useRouter();
  const [ad, setAd] = useState(kisi.ad);
  const [mm, setMm] = useState(kisi.maliyetMerkezi);
  const [rol, setRol] = useState(rolNedir(kisi.gorev));
  const [hata, setHata] = useState<string | null>(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  const secilenEsleme = eslemeler.find((e) => e.kod === mm.trim());

  async function kaydet() {
    if (kaydediliyor) return;
    setKaydediliyor(true);
    setHata(null);
    const h = await personelGuncelleEylem(kisi.sicil, { ad, maliyetMerkezi: mm, gorev: rol });
    setKaydediliyor(false);
    if (h) return setHata(h);
    onKapat();
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/60 p-4" onClick={onKapat}>
      <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <p className="font-semibold">
          Kaydı düzenle <span className="font-mono text-xs text-muted">· {kisi.sicil}</span>
        </p>
        <p className="mt-1 text-xs text-muted">Sicil kimliktir, değiştirilmez.</p>

        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="text-xs font-semibold text-muted">Ad</span>
            <input value={ad} onChange={(e) => setAd(e.target.value)} className="input-base mt-1" />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-muted">Maliyet merkezi</span>
            <input
              value={mm}
              onChange={(e) => setMm(e.target.value)}
              list="mm-listesi"
              className="input-base mt-1 font-mono text-sm"
            />
            <datalist id="mm-listesi">
              {eslemeler.map((e) => (
                <option key={e.kod} value={e.kod}>
                  {e.bolum}
                </option>
              ))}
            </datalist>
          </label>

          {/* Bölüm/amir burada GÖSTERİLİR ama yazılmaz — kaynağı eşleme. */}
          <p className="rounded-flow bg-wash px-3 py-2 text-xs text-muted">
            {secilenEsleme ? (
              <>
                Bu koddan gelen: bölüm <strong className="text-ink">{secilenEsleme.bolum || "—"}</strong>
                {secilenEsleme.amirSicil ? (
                  <>
                    {" "}
                    · amir <span className="font-mono">{secilenEsleme.amirSicil}</span>
                  </>
                ) : null}
              </>
            ) : mm.trim() ? (
              <>Bu kodun eşlemesi tanımlı değil — bölüm ve amir değişmeyecek. Eşlemeyi listenin altından tanımlayın.</>
            ) : (
              <>Bölüm ve amir maliyet merkezinden gelir, elle yazılmaz.</>
            )}
          </p>

          <fieldset>
            <legend className="text-xs font-semibold text-muted">Rol</legend>
            <div className="mt-1 flex gap-2">
              {(["Operatör", "Amir"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRol(r)}
                  className={
                    rol === r
                      ? "btn-primary flex-1 text-sm"
                      : "btn-ghost flex-1 border border-line text-sm"
                  }
                >
                  {r === "Amir" ? <Icon name="shield" size={14} /> : null} {r}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-muted">
              Amir yapılan kişi maliyet merkezi eşlemesinde amir olarak seçilebilir ve amir tabletine girer.
            </p>
          </fieldset>
        </div>

        {hata ? (
          <p role="alert" className="mt-3 rounded-flow border border-brand/30 bg-brand-soft px-3 py-2 text-sm font-semibold text-brand-dark">
            {hata}
          </p>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onKapat} className="btn-ghost text-sm">
            Vazgeç
          </button>
          <button onClick={kaydet} disabled={kaydediliyor} className="btn-primary text-sm disabled:opacity-60">
            <Icon name="save" size={16} /> Kaydet
          </button>
        </div>
      </div>
    </div>
  );
}
