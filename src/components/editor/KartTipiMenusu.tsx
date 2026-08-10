"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";
import { KART_ACIKLAMA, KART_ETIKET, type KartTipi } from "@/lib/tipler";

/**
 * KART TİPİ SEÇİMİ — hem "kart ekle" hem "tipini değiştir" için TEK panel.
 *
 * On kart tipi on düğme demek değildir: yan yana dizilen on düğme, hazırlayanın
 * aradığını okumadan ilk düğmeye basmasıyla sonuçlanırdı ("Kural kartı" zaten
 * ilk sırada) — yani yeni tipler hiç kullanılmazdı. Bunun yerine tek bir "Kart
 * ekle" düğmesi ve NİYETE göre gruplanmış bir liste var: hazırlayan "ne
 * anlatacağım" diye düşünür, "hangi bileşen" diye değil.
 *
 * ETİKET VE AÇIKLAMA `tipler.ts`TEN GELİR, burada elle liste yoktur. Gruplar
 * yalnız SIRALAMA bilgisidir; gruba yazılmamış bir tip kaybolmaz, "Diğer"
 * başlığında kendiliğinden belirir (`gruplariCoz`). Çekirdeğe on birinci tip
 * eklendiğinde bu dosyaya dokunmadan editörde görünür.
 */

const GRUPLAR: { ad: string; not: string; tipler: KartTipi[] }[] = [
  { ad: "Anlatım", not: "Kuralı ve nedenini anlat", tipler: ["kural", "adim", "vaka"] },
  { ad: "Uyarı", not: "Dikkat çek", tipler: ["uyari", "sayiVurgu"] },
  { ad: "Karşılaştırma", not: "İkisini yan yana göster", tipler: ["yapYapma", "karsilastirma", "onceSonra"] },
  { ad: "Kontrol", not: "Sahada işaretlenecek", tipler: ["kontrolListesi"] },
  { ad: "Medya", not: "Hazır çekim", tipler: ["video"] },
];

/** Gruba yazılmamış tipler "Diğer"e düşer — yeni tip sessizce kaybolmasın. */
export function gruplariCoz(): { ad: string; not: string; tipler: KartTipi[] }[] {
  const bilinen = new Set<string>();
  for (const g of GRUPLAR) for (const t of g.tipler) bilinen.add(t);
  const kalan = (Object.keys(KART_ETIKET) as KartTipi[]).filter((t) => !bilinen.has(t));
  return kalan.length === 0 ? GRUPLAR : [...GRUPLAR, { ad: "Diğer", not: "Yeni eklenen tipler", tipler: kalan }];
}

/**
 * Panel dışına basınca / Esc'e basınca kapanır.
 *
 * `pointerdown` kullanılıyor, `click` değil: seçici panelin içinden bir metin
 * seçip dışarıda fare tuşunu bırakmak `click`i dışarıda sayıp paneli
 * kapatıyordu.
 */
function useAcilir() {
  const [acik, setAcik] = useState(false);
  const kap = useRef<HTMLDivElement>(null);

  /* Bağımlılık YALNIZ `acik` ve `setAcik` (ikincisi kararlı). Dışarıdan bir
     `kapat` kapanışı alsaydık her çizimde yenilenir, dinleyiciler her tuş
     vuruşunda sökülüp yeniden takılırdı. */
  useEffect(() => {
    if (!acik) return;
    const bas = (e: PointerEvent) => {
      if (!kap.current?.contains(e.target as Node)) setAcik(false);
    };
    const tus = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAcik(false);
    };
    document.addEventListener("pointerdown", bas);
    document.addEventListener("keydown", tus);
    return () => {
      document.removeEventListener("pointerdown", bas);
      document.removeEventListener("keydown", tus);
    };
  }, [acik]);

  return { acik, setAcik, kap };
}

function Panel({
  secili,
  uyari,
  onSec,
}: {
  /** Tip değiştirme kipinde mevcut tip işaretlenir; ekleme kipinde boştur. */
  secili?: KartTipi;
  uyari?: string;
  onSec: (tip: KartTipi) => void;
}) {
  return (
    <div className="max-h-[70vh] w-[22rem] overflow-y-auto rounded-2xl border border-line bg-white p-2 shadow-xl">
      {uyari ? (
        <p className="mb-1 rounded-xl border border-orta/30 bg-orta/5 px-3 py-2 text-[11px] leading-relaxed text-orta-dark">
          {uyari}
        </p>
      ) : null}

      {gruplariCoz().map((g) => (
        <div key={g.ad} className="mb-1 last:mb-0">
          <p className="px-2 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-muted">
            {g.ad} <span className="font-semibold normal-case tracking-normal opacity-70">· {g.not}</span>
          </p>
          {g.tipler.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onSec(t)}
              aria-current={secili === t}
              className={`block w-full rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
                secili === t ? "bg-accent-soft" : ""
              }`}
            >
              <span className="flex items-center gap-1.5 text-sm font-semibold">
                {KART_ETIKET[t]}
                {secili === t ? <Icon name="check" size={13} className="text-accent" /> : null}
              </span>
              <span className="mt-0.5 block text-[11px] leading-snug text-muted">{KART_ACIKLAMA[t]}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * "Kart ekle" — düz düğme sırasının yerine geçen tek düğme + gruplu panel.
 *
 * Editör kabuğu (`egitimler/[id]/Editor.tsx`) bunu kullanır; kart tipi sayısı
 * arttıkça düğme sayısı artmaz.
 */
export function KartEkleMenusu({ kilitli, onEkle }: { kilitli?: boolean; onEkle: (tip: KartTipi) => void }) {
  const { acik, setAcik, kap } = useAcilir();

  return (
    <div ref={kap} className="relative inline-block">
      <button
        type="button"
        disabled={kilitli}
        aria-expanded={acik}
        aria-haspopup="menu"
        onClick={() => setAcik((a) => !a)}
        className="btn-primary text-sm"
      >
        <Icon name="plus" size={16} /> Kart ekle
        <Icon name={acik ? "up" : "down"} size={14} />
      </button>

      {acik && !kilitli ? (
        <div className="absolute left-0 top-full z-40 mt-2">
          <Panel
            onSec={(t) => {
              setAcik(false);
              onEkle(t);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

/**
 * Satır başlığındaki tip rozeti — tıklanınca tipi DEĞİŞTİRİR.
 *
 * Tip eskiden sabit geliyordu: yanlış tiple açılan kartı düzeltmenin tek yolu
 * silip yeniden yazmaktı. Alanlar aynı sütunları kullandığı için (`kartVeri.ts`)
 * değiştirmek veri kaybettirmiyor — ama yeni tipin OKUMADIĞI alan kartta
 * görünmez, o yüzden hem seçmeden önce hem sonra uyarı var.
 */
export function KartTipiRozeti({
  tip,
  kilitli,
  onDegis,
}: {
  tip: KartTipi;
  kilitli?: boolean;
  onDegis: (yeni: KartTipi) => void;
}) {
  const { acik, setAcik, kap } = useAcilir();

  return (
    <div ref={kap} className="relative">
      <button
        type="button"
        disabled={kilitli}
        aria-expanded={acik}
        aria-haspopup="menu"
        onClick={() => setAcik((a) => !a)}
        title="Kart tipini değiştir"
        className="chip text-xs transition-colors hover:border-accent hover:text-ink disabled:cursor-not-allowed"
      >
        {KART_ETIKET[tip]}
        {kilitli ? null : <Icon name="down" size={12} />}
      </button>

      {acik && !kilitli ? (
        <div className="absolute left-0 top-full z-40 mt-2">
          <Panel
            secili={tip}
            uyari="Tip değişse de yazdıklarınız silinmez — alanlar aynı yerde durur. Ama yeni tipin kullanmadığı metin kartta görünmez."
            onSec={(t) => {
              setAcik(false);
              if (t !== tip) onDegis(t);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
