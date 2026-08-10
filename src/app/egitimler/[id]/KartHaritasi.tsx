"use client";

import { memo } from "react";
import Icon, { type IconName } from "@/components/Icon";
import { KART_ETIKET, type KartTipi } from "@/lib/tipler";

/**
 * KART HARİTASI — kırk kartlık eğitimde nerede olduğunu gösteren dar sütun.
 *
 * Tek uzun dikey listede hazırlayan "acil durum kartı neredeydi" sorusunu
 * yalnız kaydırarak cevaplayabiliyordu. Harita üç şeyi bir bakışta veriyor:
 * SIRA (kaçıncı kart), TİP (simge) ve BAŞLIĞIN İLK SATIRI. Başlık boşsa
 * "(başlıksız)" yazıyor — sorunlu kartı listede bulmanın en hızlı yolu bu,
 * çünkü boş başlık kioskta üstte bir boşluk olarak görünen sessiz hatadır.
 *
 * UYARI NOKTASI yayın kontrol listesiyle AYNI ölçütlerden geliyor (Editor'daki
 * `kartSorunlu`): liste "3 kartın başlığı boş" diyor ama HANGİ üç kart olduğunu
 * söylemiyordu; nokta bu boşluğu kapatıyor.
 *
 * Sürükleme burada da çalışır. Kırk kartlık listede kartı otuz sıra yukarı
 * taşımak, editör satırında ekranı sürekli kaydırmak demek; haritada kaynak da
 * hedef de aynı ekranda duruyor.
 */

export interface HaritaSatiri {
  id: string;
  sira: number;
  tip: KartTipi;
  /** Başlığın ilk satırı; boşsa boş dize (ekranda "(başlıksız)" olur). */
  baslik: string;
  /** Yayın kontrolünde uyarı üreten kart mı? */
  sorunlu: boolean;
  /** Bu kartın ÜSTÜNDE başlayan bölümün adı. */
  bolum?: string;
}

/**
 * Tip → simge. Haritada tip adını yazacak yer yok (sütun 12rem); simge
 * `title` ile birlikte duruyor, yani fareyle tam adı da okunabiliyor.
 */
const KART_SIMGE: Record<KartTipi, IconName> = {
  kural: "check",
  yapYapma: "split",
  adim: "listOrdered",
  uyari: "warning",
  video: "video",
  kontrolListesi: "list",
  karsilastirma: "grid",
  vaka: "chat",
  onceSonra: "swap",
  sayiVurgu: "hash",
};

function KartHaritasiIc({
  satirlar,
  seciliId,
  kilitli,
  surukleId,
  birakIndeks,
  onSec,
  onSurukleBasla,
  onSurukleBitir,
  onBirakYeri,
  onBirak,
}: {
  satirlar: HaritaSatiri[];
  seciliId: string | null;
  /** Yayındaki eğitim salt okunur — sürüklemek de sıralamaktır. */
  kilitli: boolean;
  surukleId: string | null;
  /** Kartın BIRAKILACAĞI aralık (0..n). Araya çizgi buraya çizilir. */
  birakIndeks: number | null;
  onSec: (sayfaId: string) => void;
  onSurukleBasla: (sayfaId: string) => void;
  onSurukleBitir: () => void;
  onBirakYeri: (indeks: number) => void;
  onBirak: () => void;
}) {
  if (satirlar.length === 0) {
    return <p className="px-1 text-xs text-muted">Henüz kart yok.</p>;
  }

  return (
    <nav aria-label="Kart haritası">
      <ol className="space-y-0.5">
        {satirlar.map((s, i) => (
          <li key={s.id} className="relative">
            {/* Bölüm başlığı listeyi görsel olarak kesiyor; kendi başına
                tıklanabilir değil — düzenlemesi kart listesinde yapılır. */}
            {s.bolum ? (
              <p
                className={`eyebrow truncate px-1 ${i === 0 ? "pb-1" : "mt-3 border-t border-line pt-2"}`}
                title={s.bolum}
              >
                {s.bolum}
              </p>
            ) : null}

            {/* Bırakma çizgisi MUTLAK konumlu: akışa girseydi imlecin altındaki
                satır her kıpırdanışta aşağı kayar, hedef titrerdi. */}
            {birakIndeks === i ? <span aria-hidden className="absolute -top-0.5 left-0 right-0 h-0.5 rounded bg-accent" /> : null}

            <button
              type="button"
              draggable={!kilitli}
              onDragStart={(e) => {
                // Firefox sürüklemeyi veri konmadan başlatmıyor.
                e.dataTransfer.setData("text/plain", s.id);
                e.dataTransfer.effectAllowed = "move";
                onSurukleBasla(s.id);
              }}
              onDragEnd={onSurukleBitir}
              onDragOver={(e) => {
                if (!surukleId) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                const k = e.currentTarget.getBoundingClientRect();
                onBirakYeri(e.clientY < k.top + k.height / 2 ? i : i + 1);
              }}
              onDrop={(e) => {
                e.preventDefault();
                onBirak();
              }}
              onClick={() => onSec(s.id)}
              aria-current={seciliId === s.id}
              className={`flex w-full items-center gap-1.5 rounded-lg px-1.5 py-1.5 text-left transition-colors ${
                surukleId === s.id ? "opacity-40" : ""
              } ${
                seciliId === s.id
                  ? "bg-accent-soft text-accent-dark"
                  : "text-muted hover:bg-line/60 hover:text-ink"
              }`}
            >
              <span className="w-5 shrink-0 text-right text-[11px] font-bold tabular-nums">{s.sira}</span>
              <span className="shrink-0" title={KART_ETIKET[s.tip]}>
                <Icon name={KART_SIMGE[s.tip]} size={13} />
              </span>
              <span className={`min-w-0 flex-1 truncate text-xs ${s.baslik ? "font-semibold" : "italic"}`}>
                {s.baslik || "(başlıksız)"}
              </span>
              {s.sorunlu ? (
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full bg-orta"
                  title="Bu kart yayın kontrol listesinde uyarı üretiyor"
                  aria-label="uyarı var"
                  role="img"
                />
              ) : null}
            </button>

            {/* Son aralık (listenin sonuna bırakma) yalnız son satırda. */}
            {i === satirlar.length - 1 && birakIndeks === satirlar.length ? (
              <span aria-hidden className="absolute -bottom-0.5 left-0 right-0 h-0.5 rounded bg-accent" />
            ) : null}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/**
 * `memo`: harita her tuş vuruşunda yeniden çiziliyor (başlık canlı güncelleniyor,
 * bu İSTENEN davranış) ama kart metnine yazarken satırlar hiç değişmiyorsa
 * çizim de yapılmasın. Editör geri çağrıları kararlı, sığ karşılaştırma yeterli.
 */
const KartHaritasi = memo(KartHaritasiIc);
export default KartHaritasi;
