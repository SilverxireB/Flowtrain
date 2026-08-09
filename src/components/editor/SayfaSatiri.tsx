"use client";

import { useRef, useState } from "react";
import Icon from "@/components/Icon";
import MedyaSecici from "@/components/editor/MedyaSecici";
import OtoMetin from "@/components/editor/OtoMetin";
import { gorselYamasi, kartGorselleri, siraDegistir, type MedyaOzet } from "@/lib/editorMedya";
import { KART_ACIKLAMA, KART_ETIKET, type Sayfa } from "@/lib/tipler";

/**
 * Editördeki tek sayfa satırı.
 *
 * Hazırlayan yalnız METİN yazar ve GÖRSEL seçer; yerleşim, tipografi ve renk
 * ürüne aittir. Serbest tuval vermemenin sebebi kalite: boş tuval verilen her
 * araçta içerik ikinci haftada dağılır.
 *
 * İKİ AYRI GERİ ÇAĞRI var ve ayrımı önemli:
 *  - `onAnlik` her tuşta çalışır ve YALNIZ yandaki canlı önizlemeyi besler,
 *  - `onGuncelle` alandan çıkıldığında çalışır ve sunucuya yazar.
 * Her tuşta sunucuya yazsaydık otuz kartlık bir eğitimde editör yazma hızının
 * gerisine düşer, her tuşta yeniden çizim yapardı.
 *
 * "DEĞİŞTİ Mİ" KONTROLÜ ODAK ANINDAKİ DEĞERLE YAPILIR, `sayfa` ile DEĞİL.
 * Sebebi sessiz ve yıkıcıydı: `onAnlik` iyimser durumu güncelliyor, editör de
 * `sayfa`yı o durumla BİRLEŞTİRİP geri veriyor. Karşılaştırma `sayfa` ile
 * yapıldığında alandan çıkılırken iki değer zaten eşit oluyor ve sunucuya
 * HİÇ YAZILMIYORDU — ekran, önizleme ve editör doğru görünüyor, sayfa
 * yenilenince yazılan her şey kayboluyordu. Kart içeriği ürünün kendisidir;
 * bu karşılaştırmayı `sayfa`ya geri çevirmeyin.
 */
export default function SayfaSatiri({
  sayfa,
  sira,
  toplam,
  secili,
  medyalar,
  hedefEgitimler,
  onGuncelle,
  onAnlik,
  onSil,
  onTasi,
  onSec,
  onCogalt,
  onKopyala,
  onMedyaSil,
  kilitli,
}: {
  sayfa: Sayfa;
  sira: number;
  toplam: number;
  /** Yandaki önizlemede gösterilen kart bu mu? */
  secili: boolean;
  medyalar: MedyaOzet[];
  /** Kartın kopyalanabileceği diğer TASLAK eğitimler. */
  hedefEgitimler: { id: string; ad: string }[];
  /** Yayındaki eğitim salt okunur — sunucu da reddeder. */
  kilitli?: boolean;
  onGuncelle: (yama: Record<string, unknown>) => void;
  onAnlik: (yama: Record<string, unknown>) => void;
  onSil: () => void;
  onTasi: (yon: -1 | 1) => void;
  onSec: () => void;
  onCogalt: () => void;
  onKopyala: (hedefId: string) => void;
  onMedyaSil: (id: string) => void;
}) {
  const [secici, setSecici] = useState<"gorsel" | "video" | null>(null);
  const [kopyaAcik, setKopyaAcik] = useState(false);
  const [hedef, setHedef] = useState("");
  /** Alana girildiği andaki değer — kaydetme kararı buna bakar (üstteki nota bkz). */
  const odakDegeri = useRef("");

  const video = sayfa.tip === "video";
  const gorseller = kartGorselleri(sayfa);

  function gorselleriYaz(idler: string[]) {
    const yama = gorselYamasi(idler);
    onAnlik(yama);
    onGuncelle(yama);
  }

  return (
    <div
      onFocusCapture={onSec}
      onClick={onSec}
      className={`card p-4 transition-shadow ${secili ? "border-accent/50 ring-4 ring-accent-soft" : ""}`}
    >
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-line text-xs font-bold text-muted">
          {sira}
        </span>
        <span className="chip text-xs">{KART_ETIKET[sayfa.tip]}</span>
        <div className="flex-1" />
        <button
          onClick={() => setKopyaAcik((a) => !a)}
          disabled={kilitli}
          aria-expanded={kopyaAcik}
          className="btn-icon"
          aria-label="Kartı kopyala"
          title="Bu kartı çoğalt ya da başka eğitime kopyala"
        >
          <Icon name="copy" size={16} />
        </button>
        <button onClick={() => onTasi(-1)} disabled={kilitli || sira === 1} className="btn-icon" aria-label="Yukarı taşı">
          <Icon name="up" size={16} />
        </button>
        <button onClick={() => onTasi(1)} disabled={kilitli || sira === toplam} className="btn-icon" aria-label="Aşağı taşı">
          <Icon name="down" size={16} />
        </button>
        <button onClick={onSil} disabled={kilitli} className="btn-icon hover:text-brand" aria-label="Sayfayı sil">
          <Icon name="trash" size={16} />
        </button>
      </div>

      <p className="mt-1 pl-9 text-xs text-muted">{KART_ACIKLAMA[sayfa.tip]}</p>

      {kopyaAcik && !kilitli ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-paper p-3">
          <button
            onClick={() => {
              setKopyaAcik(false);
              onCogalt();
            }}
            className="btn-ghost text-sm"
          >
            <Icon name="copy" size={16} /> Bu eğitimde çoğalt
          </button>
          {hedefEgitimler.length > 0 ? (
            <>
              <span className="text-xs text-muted">veya</span>
              <select
                value={hedef}
                onChange={(e) => setHedef(e.target.value)}
                className="input-base w-auto min-w-[10rem] py-2 text-sm"
                aria-label="Hedef eğitim"
              >
                <option value="">Taslak eğitim seçin…</option>
                {hedefEgitimler.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.ad}
                  </option>
                ))}
              </select>
              <button
                onClick={() => {
                  if (!hedef) return;
                  setKopyaAcik(false);
                  onKopyala(hedef);
                }}
                disabled={!hedef}
                className="btn-ghost text-sm"
              >
                Kopyala
              </button>
            </>
          ) : (
            /* Yayındaki eğitime kart eklemek kayıtların atıf yaptığı sürümü
               sessizce değiştirirdi; hedef listesinde yalnız taslaklar var. */
            <span className="text-xs text-muted">Kopyalanacak başka taslak eğitim yok.</span>
          )}
        </div>
      ) : null}

      <div className="mt-3 space-y-3">
        <input
          disabled={kilitli}
          defaultValue={sayfa.baslik}
          onFocus={(e) => (odakDegeri.current = e.target.value)}
          onChange={(e) => onAnlik({ baslik: e.target.value })}
          onBlur={(e) => e.target.value !== odakDegeri.current && onGuncelle({ baslik: e.target.value })}
          placeholder="Başlık"
          className="input-base font-semibold"
        />

        <OtoMetin
          disabled={kilitli}
          defaultValue={sayfa.metin ?? ""}
          onFocus={(e) => (odakDegeri.current = e.target.value)}
          onChange={(e) => onAnlik({ metin: e.target.value })}
          onBlur={(e) => e.target.value !== odakDegeri.current && onGuncelle({ metin: e.target.value })}
          rows={sayfa.tip === "adim" ? 4 : 2}
          placeholder={
            sayfa.tip === "adim"
              ? "Her satır bir adım"
              : sayfa.tip === "yapYapma"
                ? "YAP kolonuna yazılacak"
                : "Metin"
          }
          className="input-base"
        />

        {sayfa.tip === "yapYapma" ? (
          <OtoMetin
            disabled={kilitli}
            defaultValue={sayfa.metinKarsi ?? ""}
            onFocus={(e) => (odakDegeri.current = e.target.value)}
            onChange={(e) => onAnlik({ metinKarsi: e.target.value })}
            onBlur={(e) => e.target.value !== odakDegeri.current && onGuncelle({ metinKarsi: e.target.value })}
            rows={2}
            placeholder="YAPMA kolonuna yazılacak"
            className="input-base border-brand/30"
          />
        ) : null}

        {/* ── görseller ──────────────────────────────────────────────────────
            ÇOKLU GÖRSEL: bir kural kartında "doğru bağlantı" ve "yanlış
            bağlantı" fotoğrafını yan yana koymak için ikinci bir kart açmak
            gerekiyordu; iki kart aynı kuralı ikiye bölüyordu. Sıra önemli —
            ilki kartın kapağı. */}
        {gorseller.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {gorseller.map((g, i) => (
              <li key={g} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/medya/${g}`} alt="" className="h-20 w-28 rounded-lg border border-line object-cover" />
                {i === 0 ? (
                  <span className="absolute left-1 top-1 rounded-md bg-ink/70 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    Kapak
                  </span>
                ) : null}
                <div className="mt-1 flex justify-center gap-0.5">
                  <button
                    onClick={() => gorselleriYaz(siraDegistir(gorseller, i, -1))}
                    disabled={kilitli || i === 0}
                    className="btn-icon h-7 w-7"
                    aria-label="Görseli öne al"
                  >
                    <Icon name="chevronLeft" size={14} />
                  </button>
                  <button
                    onClick={() => gorselleriYaz(siraDegistir(gorseller, i, 1))}
                    disabled={kilitli || i === gorseller.length - 1}
                    className="btn-icon h-7 w-7"
                    aria-label="Görseli geri al"
                  >
                    <Icon name="chevronRight" size={14} />
                  </button>
                  <button
                    onClick={() => gorselleriYaz(gorseller.filter((_, x) => x !== i))}
                    disabled={kilitli}
                    className="btn-icon h-7 w-7 hover:text-brand"
                    aria-label="Görseli kaldır"
                  >
                    <Icon name="close" size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => setSecici(video ? "video" : "gorsel")} disabled={kilitli} className="btn-ghost text-sm">
            <Icon name={video ? "video" : "image"} size={16} />
            {video ? (sayfa.videoId ? "Videoyu değiştir" : "Video ekle") : gorseller.length > 0 ? "Görsel ekle" : "Görsel seç"}
          </button>

          {video && sayfa.videoId ? (
            <>
              <span className="chip text-xs">
                <Icon name="check" size={14} /> Video eklendi
              </span>
              <button
                onClick={() => {
                  onAnlik({ videoId: null });
                  onGuncelle({ videoId: null });
                }}
                disabled={kilitli}
                className="btn-icon hover:text-brand"
                aria-label="Videoyu kaldır"
              >
                <Icon name="close" size={16} />
              </button>
            </>
          ) : null}

          <div className="flex-1" />

          <label className="flex items-center gap-2 text-xs text-muted">
            {/* Asgari süre = sahtecilik önlemi. Görünür ve düzenlenebilir olması
                bilinçli: hazırlayan videonun uzunluğuna göre ayarlayabilmeli. */}
            En az
            <input
              type="number"
              min={0}
              disabled={kilitli}
              defaultValue={sayfa.asgariSure}
              onFocus={(e) => (odakDegeri.current = e.target.value)}
              onChange={(e) => onAnlik({ asgariSure: Number(e.target.value) })}
              onBlur={(e) => e.target.value !== odakDegeri.current && onGuncelle({ asgariSure: Number(e.target.value) })}
              className="input-base w-20 px-2 py-1 text-center"
            />
            sn ekranda kalsın
          </label>
        </div>
      </div>

      {secici ? (
        <MedyaSecici
          tur={secici}
          medyalar={medyalar}
          onMedyaSil={onMedyaSil}
          onKapat={() => setSecici(null)}
          onSec={(id) => {
            setSecici(null);
            if (secici === "video") {
              onAnlik({ videoId: id });
              onGuncelle({ videoId: id });
            } else {
              // Aynı görseli iki kez eklemek kartta iki kez çizerdi.
              gorselleriYaz(gorseller.includes(id) ? gorseller : [...gorseller, id]);
            }
          }}
        />
      ) : null}
    </div>
  );
}
