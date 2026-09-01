"use client";

import { useMemo, useRef, useState } from "react";
import Icon from "@/components/Icon";
import { sorulariOner, type Oneri } from "@/lib/soruOner";
import { SORU_ETIKET, type Sayfa, type Soru } from "@/lib/tipler";

/**
 * KARTLARDAN SORU ÖNER — hazırlayanın en çok takıldığı yer.
 *
 * Kartları yazan kişi sınav bölümüne gelince duruyor: soru yazmak içerik
 * yazmaktan başka bir kas. Oysa kartların çoğu sorunun cevabını zaten taşıyor
 * (`lib/soruOner.ts` bunu kalıpla çıkarıyor — yapay zekâ yok, ürün kapalı ağda
 * çalışıyor).
 *
 * ÖNERİ ONAYSIZ EKLENMEZ. Liste seçmeli geliyor ve varsayılan olarak yalnız
 * "kart bunu doğrudan söylüyor" (güven 1) önerileri işaretli. Hazırlayan
 * okumadan "hepsini ekle" diyebilsin diye tasarlamadım: yanlış cevap anahtarlı
 * bir soru, sınavı olan işçinin bildiği doğrudan kalması demek.
 */
const GUVEN_NOTU: Record<1 | 2 | 3, string> = {
  1: "Kart bunu doğrudan söylüyor",
  2: "İfadeyi gözden geçirin",
  3: "Şıkları siz doldurun",
};

export default function SoruOnerici({
  sayfalar,
  mevcutSorular,
  kilitli,
  onEkle,
}: {
  sayfalar: Sayfa[];
  mevcutSorular: Soru[];
  kilitli?: boolean;
  onEkle: (sorular: { tip: Oneri["tip"]; metin: string; secenekler: string[]; dogru: number[] }[]) => void;
}) {
  const [acik, setAcik] = useState(false);
  const [secili, setSecili] = useState<Set<number>>(new Set());
  const kilit = useRef(false);

  /* Panel açılana kadar hesaplanmıyor: kırk kartlık eğitimde her tuş vuruşunda
     öneri üretmek editörü yavaşlatırdı. */
  const oneriler = useMemo(
    () => (acik ? sorulariOner(sayfalar, mevcutSorular) : []),
    [acik, sayfalar, mevcutSorular],
  );

  function ac() {
    const yeni = sorulariOner(sayfalar, mevcutSorular);
    /* Varsayılan seçim YALNIZ güven 1: gözden geçirilmesi gerekeni önceden
       işaretlemek, "hepsi hazır" yanılgısı yaratırdı. */
    setSecili(new Set(yeni.map((o, i) => (o.guven === 1 ? i : -1)).filter((i) => i >= 0)));
    setAcik(true);
  }

  function degistir(i: number) {
    setSecili((s) => {
      const y = new Set(s);
      if (y.has(i)) y.delete(i);
      else y.add(i);
      return y;
    });
  }

  function ekle() {
    if (kilit.current) return;
    kilit.current = true;
    const secilenler = oneriler.filter((_, i) => secili.has(i));
    onEkle(secilenler.map(({ tip, metin, secenekler, dogru }) => ({ tip, metin, secenekler, dogru })));
    setAcik(false);
    kilit.current = false;
  }

  const kartNo = useMemo(() => new Map(sayfalar.map((s, i) => [s.id, i + 1])), [sayfalar]);

  if (!acik) {
    return (
      <button onClick={ac} disabled={kilitli} className="btn-ghost text-sm">
        <Icon name="sparkles" size={16} /> Kartlardan soru öner
      </button>
    );
  }

  return (
    <div className="card w-full p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Icon name="sparkles" size={16} className="text-accent" />
        <p className="font-semibold">Kartlardan çıkan sorular</p>
        <div className="flex-1" />
        <button onClick={() => setAcik(false)} className="btn-icon" aria-label="Kapat">
          <Icon name="close" size={16} />
        </button>
      </div>

      {oneriler.length === 0 ? (
        <p className="mt-3 text-sm text-muted">
          Kartlardan yeni bir soru çıkmadı. Adım adım, yap/yapma, sayı vurgusu, kontrol listesi ve karşılaştırma
          kartları soru üretir — içerik yazdıkça buraya öneri düşer.
        </p>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted">
            Bunlar <strong className="text-ink">öneri</strong> — okumadan eklemeyin. Cevap anahtarı yanlışsa, doğruyu
            bilen işçi sorudan kalır.
          </p>

          <ul className="mt-3 space-y-2">
            {oneriler.map((o, i) => (
              <li key={i}>
                <label className="flex cursor-pointer gap-3 rounded-flow border border-line p-3 hover:border-accent">
                  <input
                    type="checkbox"
                    checked={secili.has(i)}
                    onChange={() => degistir(i)}
                    className="mt-1 h-4 w-4 shrink-0"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{o.metin}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                      <span className="chip px-2 py-0.5 text-[11px]">{SORU_ETIKET[o.tip]}</span>
                      <span>{kartNo.get(o.kaynakSayfaId)}. karttan</span>
                      <span aria-hidden>·</span>
                      <span className={o.guven === 1 ? "text-iyi-dark" : o.guven === 3 ? "text-orta-dark" : ""}>
                        {GUVEN_NOTU[o.guven]}
                      </span>
                    </span>
                    {/* Şıklar GÖRÜNÜR: kapalı bir kutuyu onaylamak, okumadan
                        onaylamaktır. Doğru olan yeşil işaretle ayrılır. */}
                    <span className="mt-2 flex flex-wrap gap-1">
                      {o.secenekler.map((sik, j) => (
                        <span
                          key={j}
                          className={`rounded-flow-sm border px-2 py-0.5 text-xs ${
                            o.tip !== "siralama" && o.dogru.includes(j)
                              ? "border-iyi/40 bg-iyi/10 font-semibold text-iyi-dark"
                              : "border-line text-muted"
                          }`}
                        >
                          {sik.trim() || "(boş — siz doldurun)"}
                        </span>
                      ))}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button onClick={ekle} disabled={secili.size === 0} className="btn-primary text-sm">
              <Icon name="plus" size={16} /> {secili.size} soruyu ekle
            </button>
            <button
              onClick={() => setSecili(new Set(oneriler.map((_, i) => i)))}
              className="btn-ghost text-sm"
            >
              Hepsini seç
            </button>
            <button onClick={() => setSecili(new Set())} className="btn-ghost text-sm">
              Seçimi temizle
            </button>
          </div>
        </>
      )}
    </div>
  );
}
