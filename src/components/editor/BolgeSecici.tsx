"use client";

import { useState } from "react";
import Icon from "@/components/Icon";
import { bolgeCoz, type Bolge } from "@/lib/sinav";
import { medyaYolu } from "@/lib/yol";

/**
 * GÖRSELDE İŞARETLEME sorusunun bölgeleri — görselin ÜZERİNE ÇİZİLEREK.
 *
 * NEDEN ÇİZEREK: bölge `x,y,genişlik,yükseklik` olarak saklanıyor. Bu dört
 * sayıyı elle yazdırmak, hazırlayana fotoğraftaki merdivenin nerede olduğunu
 * kafadan hesaplatmak demekti — ilk denemede kimse tutturamaz, ikinci denemede
 * bu soru tipi hiç kullanılmaz. Kutu çizilir, sayılar kendiliğinden çıkar.
 *
 * ÖLÇÜ YÜZDEDİR, PİKSEL DEĞİL (`sinav.ts` → `bolgeCoz` notu): aynı görsel
 * kioskta 728 px, amir tabletinde daha dar çiziliyor. Editördeki görsel de
 * `max-h` ile küçültülmüş hâlde duruyor — yüzde olmasa burada çizilen kutu
 * sahada başka bir yeri gösterirdi.
 *
 * SAYI KUTULARI DA VAR: çizim faresiz kullanılamaz ve çizilmiş bir kutuyu
 * birkaç yüzde kaydırmak için yeniden çizmek gerekirdi. Dört küçük alan hem
 * klavye yolunu açık tutuyor hem ince ayarı mümkün kılıyor.
 */

/** Sürüklemenin bölge sayılması için gereken en küçük kenar (yüzde). */
const ASGARI_KENAR = 3;

/** Klavyeyle eklenen bölgenin başlangıç kutusu — görselin ortasında. */
const VARSAYILAN_KUTU = { x: 40, y: 40, g: 20, y2: 20 };

interface Cizim {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export default function BolgeSecici({
  gorselId,
  secenekler,
  dogru,
  kilitli,
  onDegis,
}: {
  gorselId?: string;
  /** Her şık bir bölge: `x,y,genişlik,yükseklik | etiket`. */
  secenekler: string[];
  /** Tehlikeli/doğru bölgelerin indeksleri. */
  dogru: number[];
  kilitli?: boolean;
  onDegis: (yama: { secenekler?: string[]; dogru?: number[] }) => void;
}) {
  const [cizim, setCizim] = useState<Cizim | null>(null);

  /* Şık listesinde ayrıştırılamayan satır olabilir: soru eklenirken çekirdek
     her tipe iki boş şık koyuyor. Onları GÖSTERMEYİZ ama indeksleri korunur —
     `dogru` saklanan indekse bakıyor. İlk bölge çizildiğinde temizlenirler. */
  const gecerli = secenekler
    .map((s, i) => ({ i, bolge: bolgeCoz(s) }))
    .filter((k): k is { i: number; bolge: Bolge } => k.bolge !== null);

  const isaretli = gecerli.filter((k) => dogru.includes(k.i)).length;
  const onizleme = cizim ? kutula(cizim) : null;

  function nokta(e: React.PointerEvent<HTMLDivElement>) {
    /* `offsetX` DEĞİL: olay üstteki bir kutucuktan gelirse offset o kutucuğa
       göre ölçülür ve bölge görselin dışına düşer. Kap dikdörtgeni her zaman
       aynı referanstır. */
    const r = e.currentTarget.getBoundingClientRect();
    return {
      x: sinirla(((e.clientX - r.left) / r.width) * 100),
      y: sinirla(((e.clientY - r.top) / r.height) * 100),
    };
  }

  function basla(e: React.PointerEvent<HTMLDivElement>) {
    if (kilitli) return;
    const p = nokta(e);
    // İşaretçiyi yakala: parmak/fare görselin dışına taşsa da sürükleme sürer,
    // yoksa kenara yakın bölge çizilemiyordu.
    e.currentTarget.setPointerCapture(e.pointerId);
    setCizim({ x1: p.x, y1: p.y, x2: p.x, y2: p.y });
  }

  function surukle(e: React.PointerEvent<HTMLDivElement>) {
    if (!cizim) return;
    const p = nokta(e);
    setCizim({ x1: cizim.x1, y1: cizim.y1, x2: p.x, y2: p.y });
  }

  function birak() {
    if (!cizim) return;
    const k = kutula(cizim);
    setCizim(null);
    /* ASGARİ KENAR: eldivenli parmak dokunurken kaçınılmaz olarak birkaç piksel
       kayar. Eşik olmasaydı her dokunuş görünmez bir bölge doğurur, liste de
       hazırlayanın silmesi gereken çöple dolardı. */
    if (k.g < ASGARI_KENAR || k.y2 < ASGARI_KENAR) return;
    onDegis(bolgeEkle(secenekler, dogru, k));
  }

  function etiketYaz(i: number, etiket: string) {
    const b = bolgeCoz(secenekler[i]);
    if (!b) return;
    const yeni = [...secenekler];
    yeni[i] = bolgeMetni({ ...b, etiket });
    onDegis({ secenekler: yeni });
  }

  function olcuYaz(i: number, alan: "x" | "y" | "g" | "y2", deger: number) {
    const b = bolgeCoz(secenekler[i]);
    if (!b || !Number.isFinite(deger)) return;
    b[alan] = sinirla(deger);
    const yeni = [...secenekler];
    yeni[i] = bolgeMetni(b);
    onDegis({ secenekler: yeni });
  }

  function tehlikeliDegistir(i: number) {
    onDegis({ dogru: dogru.includes(i) ? dogru.filter((d) => d !== i) : [...dogru, i].sort((a, b) => a - b) });
  }

  function bolgeSil(i: number) {
    onDegis({
      secenekler: secenekler.filter((_, x) => x !== i),
      // Silinenden sonraki bölgeler kaydığı için doğru indeksleri de kaydır —
      // yoksa tehlikeli işaret sessizce komşu bölgeye geçer.
      dogru: dogru.filter((d) => d !== i).map((d) => (d > i ? d - 1 : d)),
    });
  }

  if (!gorselId) {
    return (
      <p className="mt-3 flex items-start gap-2 rounded-xl border border-dashed border-orta/50 bg-orta/5 px-4 py-3 text-sm text-orta-dark">
        <Icon name="warning" size={16} />
        <span>
          <strong>Önce soru görseli seçin.</strong> Bu tipte bölgeler görselin üzerine çizilir; görsel olmadan sorulacak
          bir şey yok.
        </span>
      </p>
    );
  }

  return (
    <div className="mt-3">
      <p className="mb-2 text-xs text-muted">
        Görselin üzerinde <strong>sürükleyerek</strong> kutu çizin; her kutu bir bölgedir. Kişi tehlikeli olan bölgeye
        dokunur — hangilerinin tehlikeli olduğunu aşağıdaki listeden işaretleyin.
      </p>

      <div
        onPointerDown={basla}
        onPointerMove={surukle}
        onPointerUp={birak}
        onPointerCancel={() => setCizim(null)}
        className={`relative inline-block max-w-full touch-none select-none overflow-hidden rounded-xl border border-line ${
          kilitli ? "" : "cursor-crosshair"
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={medyaYolu(gorselId)}
          alt=""
          draggable={false}
          className="block max-h-80 w-auto max-w-full select-none bg-paper"
        />

        {gecerli.map((k, sira) => (
          <span
            key={k.i}
            // Kutular tıklamayı YUTMAZ: üst üste binen bölgelerin ortasına yeni
            // bir bölge çizilebilmeli.
            className={`pointer-events-none absolute border-2 ${
              dogru.includes(k.i) ? "border-brand bg-brand/25" : "border-accent bg-accent/15"
            }`}
            style={{ left: `${k.bolge.x}%`, top: `${k.bolge.y}%`, width: `${k.bolge.g}%`, height: `${k.bolge.y2}%` }}
          >
            <span
              className={`absolute left-0 top-0 px-1 text-[11px] font-bold text-white ${
                dogru.includes(k.i) ? "bg-brand" : "bg-accent"
              }`}
            >
              {sira + 1}
            </span>
          </span>
        ))}

        {onizleme ? (
          <span
            className="pointer-events-none absolute border-2 border-dashed border-accent bg-accent/10"
            style={{
              left: `${onizleme.x}%`,
              top: `${onizleme.y}%`,
              width: `${onizleme.g}%`,
              height: `${onizleme.y2}%`,
            }}
          />
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button
          onClick={() => onDegis(bolgeEkle(secenekler, dogru, VARSAYILAN_KUTU))}
          disabled={kilitli}
          className="btn-ghost text-sm"
        >
          <Icon name="plus" size={16} /> Bölge ekle
        </button>
        <span className="text-xs text-muted">
          Fare kullanmadan: buradan ekleyip aşağıdaki ölçü kutularıyla yerleştirin.
        </span>
      </div>

      {gecerli.length === 0 ? (
        <p className="mt-2 flex items-start gap-2 rounded-xl border border-dashed border-orta/50 bg-orta/5 px-4 py-3 text-sm text-orta-dark">
          <Icon name="warning" size={16} />
          <span>Henüz bölge yok — görselin üzerine bir kutu çizin, yoksa soruda işaretlenecek hiçbir yer olmaz.</span>
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {gecerli.map((k, sira) => (
            <li key={k.i} className="rounded-xl border border-line p-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-bold text-white ${
                    dogru.includes(k.i) ? "bg-brand" : "bg-accent"
                  }`}
                >
                  {sira + 1}
                </span>
                <input
                  key={`${k.i}:${k.bolge.etiket}`}
                  defaultValue={k.bolge.etiket}
                  onBlur={(e) => e.target.value !== k.bolge.etiket && etiketYaz(k.i, e.target.value)}
                  disabled={kilitli}
                  placeholder="Bu bölge ne? (ör. korkuluksuz kenar)"
                  aria-label={`${sira + 1}. bölgenin etiketi`}
                  className="input-base w-auto min-w-[12rem] flex-1 py-1.5 text-sm"
                />
                <button
                  onClick={() => tehlikeliDegistir(k.i)}
                  disabled={kilitli}
                  aria-pressed={dogru.includes(k.i)}
                  aria-label={`${sira + 1}. bölgeyi tehlikeli işaretle`}
                  className={`chip text-xs transition disabled:opacity-40 ${
                    dogru.includes(k.i)
                      ? "border-brand/40 bg-brand-soft font-semibold text-brand-dark"
                      : "text-muted hover:border-muted"
                  }`}
                >
                  <Icon name={dogru.includes(k.i) ? "check" : "close"} size={14} />
                  {dogru.includes(k.i) ? "Tehlikeli" : "Güvenli"}
                </button>
                <button
                  onClick={() => bolgeSil(k.i)}
                  disabled={kilitli}
                  className="btn-icon hover:text-brand"
                  aria-label={`${sira + 1}. bölgeyi sil`}
                >
                  <Icon name="trash" size={16} />
                </button>
              </div>

              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 pl-9 text-[11px] text-muted">
                {OLCULER.map((o) => (
                  <label key={o.alan} className="flex items-center gap-1">
                    {o.etiket}
                    <input
                      key={`${k.i}:${o.alan}:${k.bolge[o.alan]}`}
                      type="number"
                      min={0}
                      max={100}
                      defaultValue={k.bolge[o.alan]}
                      onBlur={(e) => Number(e.target.value) !== k.bolge[o.alan] && olcuYaz(k.i, o.alan, Number(e.target.value))}
                      disabled={kilitli}
                      aria-label={`${sira + 1}. bölgenin ${o.uzun} değeri (yüzde)`}
                      className="input-base w-16 px-1.5 py-1 text-[11px]"
                    />
                  </label>
                ))}
                <span>· ölçüler görselin yüzdesi</span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {gecerli.length > 0 && isaretli === 0 ? (
        <p className="mt-2 flex items-start gap-2 rounded-xl border border-brand/30 bg-brand-soft px-4 py-3 text-sm font-semibold text-brand-dark">
          <Icon name="warning" size={16} />
          <span>Hiçbir bölge tehlikeli işaretlenmedi — bu soruyu kimse doğru cevaplayamaz.</span>
        </p>
      ) : null}

      {gecerli.some((k) => k.bolge.etiket === "") ? (
        <p className="mt-2 text-xs text-muted">
          Etiketsiz bölge var. Etiket <strong>ekran okuyucuya</strong> okunur: görseli göremeyen kişinin bölgeyi
          seçebilmesinin tek yolu odur.
        </p>
      ) : null}
    </div>
  );
}

/* ── yardımcılar ────────────────────────────────────────────────────────────
   MODÜL SEVİYESİNDE: CLAUDE.md'deki küçültücü tuzağı (parametre yakalayıp
   birden çok kez çağrılan yardımcı) burada da mümkündü. */

const OLCULER: { alan: "x" | "y" | "g" | "y2"; etiket: string; uzun: string }[] = [
  { alan: "x", etiket: "sol", uzun: "sol kenar" },
  { alan: "y", etiket: "üst", uzun: "üst kenar" },
  { alan: "g", etiket: "en", uzun: "genişlik" },
  { alan: "y2", etiket: "boy", uzun: "yükseklik" },
];

function sinirla(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Sürükleme yönü serbest: sağdan sola çizilen kutu da geçerli bir kutudur. */
function kutula(c: Cizim): { x: number; y: number; g: number; y2: number } {
  const x = Math.min(c.x1, c.x2);
  const y = Math.min(c.y1, c.y2);
  return { x, y, g: Math.min(100 - x, Math.abs(c.x2 - c.x1)), y2: Math.min(100 - y, Math.abs(c.y2 - c.y1)) };
}

/** `sinav.ts` → `bolgeCoz`un beklediği biçim. Etiketteki `|` ayracı bozar. */
function bolgeMetni(b: { x: number; y: number; g: number; y2: number; etiket: string }): string {
  return `${b.x},${b.y},${b.g},${b.y2}|${b.etiket.replace(/\|/g, " ").trim()}`;
}

/**
 * Yeni bölge eklerken ayrıştırılamayan şıklar ATILIR.
 *
 * Soru eklenirken çekirdek her tipe iki boş şık ve `dogru: [0]` koyuyor. Onlar
 * kalsaydı yayın kontrolü "boş şık var" derdi ve `dogru` hiç var olmayan bir
 * bölgeyi gösterirdi. Temizlik ilk çizimde bir kez olur; doğru indeksleri
 * birlikte taşınır.
 */
function bolgeEkle(
  secenekler: string[],
  dogru: number[],
  kutu: { x: number; y: number; g: number; y2: number },
): { secenekler: string[]; dogru: number[] } {
  const tutulan: number[] = [];
  for (let i = 0; i < secenekler.length; i++) if (bolgeCoz(secenekler[i])) tutulan.push(i);
  return {
    secenekler: [...tutulan.map((i) => secenekler[i]), bolgeMetni({ ...kutu, etiket: "" })],
    dogru: dogru.map((d) => tutulan.indexOf(d)).filter((d) => d >= 0),
  };
}
