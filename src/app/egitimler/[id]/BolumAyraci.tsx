"use client";

import { memo, useState } from "react";
import Icon from "@/components/Icon";
import { BOLUM_EN_UZUN } from "@/lib/bolumler";

/**
 * BÖLÜM AYRACI — kart listesinde iki kartın arasına giren başlık satırı.
 *
 * "Giriş / Tehlikeler / Acil durum" kırk kartlık bir eğitimi okunabilir yapar.
 * Ayraç bir KART DEĞİL: veritabanında `ayar` tablosunda duruyor (bkz.
 * `bolumler.ts`), kioskta işçiye hiçbir şey görünmüyor ve `Sayfa` şemasına
 * dokunulmuyor.
 *
 * BAŞLIĞI OLMAYAN KARTIN ÜSTÜNDE AYRAÇ GÖRÜNMEZ, yalnız fare gelince beliren
 * ince bir "+ Bölüm" bağlantısı çıkar: kırk kartın kırkında sürekli duran bir
 * düğme listeyi gürültüye çevirirdi ve asıl işi — kart içeriğini — bastırırdı.
 */
function BolumAyraciIc({
  sayfaId,
  baslik,
  kilitli,
  kapak = false,
  onYaz,
}: {
  sayfaId: string;
  /** Yazılmış bölüm adı; yoksa `undefined`. */
  baslik?: string;
  kilitli?: boolean;
  /**
   * BÖLÜM KAPAĞININ İÇİNDE Mİ?
   *
   * Bölüm adı iki kez çiziliyordu: bir kez katlanan kapakta, bir kez de o
   * bölümü BAŞLATAN kartın ayracında. Ekranda aynı kelime alt alta iki kere
   * görünüyor, hangisinin düzenlenebilir olduğu belli olmuyordu. Ad artık tek
   * yerde — kapakta — duruyor; ayraç oraya `kapak` kipiyle giriyor ve kendi
   * çizgisini/boşluğunu bırakıyor (kapak zaten çerçeveli).
   */
  kapak?: boolean;
  onYaz: (sayfaId: string, baslik: string) => void;
}) {
  const [yeni, setYeni] = useState(false);

  if (kilitli && !baslik) return null;

  // Yayındaki eğitimde alan salt okunur: bölümler içeriğin parçası değil ama
  // yayındayken hiçbir şeyin değişmemesi kuralı burada da geçerli.
  if (baslik || yeni) {
    return (
      <div className={kapak ? "flex min-w-0 flex-1 items-center gap-2" : "mb-2 mt-6 flex items-center gap-2 border-t border-line pt-4"}>
        {kapak ? null : <Icon name="folder" size={15} className="shrink-0 text-muted" />}
        <input
          autoFocus={yeni}
          disabled={kilitli}
          defaultValue={baslik ?? ""}
          maxLength={BOLUM_EN_UZUN}
          onBlur={(e) => {
            setYeni(false);
            if (e.target.value.trim() !== (baslik ?? "")) onYaz(sayfaId, e.target.value);
          }}
          placeholder="Bölüm adı — ör. Acil durum"
          aria-label="Bölüm başlığı"
          className="min-w-0 flex-1 border-0 bg-transparent px-0 py-2.5 text-sm font-bold uppercase tracking-[0.1em] text-ink placeholder:font-semibold placeholder:normal-case placeholder:tracking-normal placeholder:text-muted focus:outline-none focus:ring-0"
        />
        {kilitli ? null : (
          <button
            type="button"
            onClick={() => {
              setYeni(false);
              onYaz(sayfaId, "");
            }}
            className="btn-icon hover:text-brand"
            aria-label="Bölüm başlığını kaldır"
            title="Bölüm başlığını kaldır — kart silinmez"
          >
            <Icon name="close" size={15} />
          </button>
        )}
      </div>
    );
  }

  /* MUTLAK KONUMLU ve YER KAPLAMAZ: kartların arasındaki 12px'lik boşluğa
     oturuyor. Akışta dursaydı kırk kartta kırk kez ~24px, yani bir ekran
     boyundan fazla boş alan eklerdi. */
  return (
    <button
      type="button"
      onClick={() => setYeni(true)}
      /* DOKUNMATİKTE HEP GÖRÜNÜR. `opacity-0` + `group-hover` fareli ekranda
         araya girmeyen zarif bir çözüm, ama telefonda hover diye bir şey yok:
         düğme hiç görünmüyordu, yani kartların arasına bölüm başlığı eklemek
         telefonda ULAŞILAMAZ bir özellikti. Fareli ekranda eski davranış
         (üstüne gelince belirir) olduğu gibi duruyor. */
      className="dokunma-44 absolute -top-3 left-8 z-10 inline-flex items-center gap-1 rounded-full border border-line bg-white px-2 py-1 text-[11px] font-semibold text-muted transition-opacity hover:text-accent-dark focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
    >
      <Icon name="plus" size={12} /> Bölüm başlığı
    </button>
  );
}

const BolumAyraci = memo(BolumAyraciIc);
export default BolumAyraci;
