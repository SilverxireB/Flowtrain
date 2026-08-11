"use client";

import Icon from "@/components/Icon";
import MetinAlani, { BicimIpucu } from "@/components/editor/BicimAraclari";
import { siraDegistir } from "@/lib/editorMedya";
import { karsilastirmaTablosu } from "@/lib/kartVeri";
import type { KartTipi, Sayfa } from "@/lib/tipler";
import { medyaYolu } from "@/lib/yol";

/**
 * KART TİPİNE GÖRE ALANLAR.
 *
 * Beş yeni kart tipi geldi ve veritabanına tek sütun eklenmedi: hepsi
 * `metin` / `metinKarsi` / `gorselIdler` üzerinde küçük bir SATIR DİLİ okuyor
 * (`lib/kartVeri.ts`). Bu dosya o dilin editördeki yüzü — dili burada yeniden
 * ayrıştırmıyoruz, `kartVeri.ts` ne diyorsa yer tutucular ve önizleme onu
 * anlatıyor. İkinci bir ayrıştırıcı yazsaydık editörde doğru görünen kart
 * kioskta başka türlü çizilirdi.
 *
 * BİÇİM ŞERİDİ HER ALANDA YOK. Serbest düzyazı alanlarında (`kural`, `uyarı`,
 * `vaka`, `yap/yapma`) şerit `bicimMetin.ts` dilini yazar. Satır dili taşıyan
 * alanlarda (kontrol listesi, karşılaştırma, sayı vurgusu, adımlar) satır başına
 * `- ` eklemek verinin KENDİSİNİ bozardı — oralarda şerit yerine tek satırlık
 * bir kural açıklaması var.
 */

interface AlanTanimi {
  etiket?: string;
  yerTutucu: string;
  /** Biçim şeridi: serbest düzyazı alanlarında açık, satır dilinde kapalı. */
  bicim: boolean;
  satir: number;
}

interface TipTanimi {
  metin: AlanTanimi;
  metinKarsi?: AlanTanimi;
  /** Satır dilini bir cümlede anlatan not — şeridin olmadığı yerde onun işini görür. */
  kural?: string;
}

const TIPLER: Partial<Record<KartTipi, TipTanimi>> = {
  kural: { metin: { yerTutucu: "Kuralı tek cümlede yazın.", bicim: true, satir: 2 } },

  uyari: { metin: { yerTutucu: "Tehlike ne? Ne yapılmalı?", bicim: true, satir: 2 } },

  video: { metin: { yerTutucu: "Videoyu tamamlayan not (isteğe bağlı)", bicim: true, satir: 2 } },

  adim: {
    metin: { yerTutucu: "Vanayı kapatın\nBasıncı boşaltın\nKilitleyip etiketleyin", bicim: false, satir: 4 },
    kural: "Her satır bir adım. Numaraları kiosk kendi koyar — siz yazmayın.",
  },

  yapYapma: {
    metin: { etiket: "Yap", yerTutucu: "Doğru davranış", bicim: true, satir: 2 },
    metinKarsi: { etiket: "Yapma", yerTutucu: "Yanlış davranış", bicim: true, satir: 2 },
  },

  vaka: {
    metin: { etiket: "Ne oldu?", yerTutucu: "Olayı anlatın: ne zaman, nerede, nasıl oldu.", bicim: true, satir: 4 },
    metinKarsi: {
      etiket: "Bundan çıkan ders",
      yerTutucu: "Kuralın neden var olduğunu söyleyin.",
      bicim: true,
      satir: 3,
    },
    kural: "Vaka kuralı ANLATMAZ, kuralın nedenini gösterir. İsim ve sicil yazmayın.",
  },

  kontrolListesi: {
    metin: { yerTutucu: "Baret takıldı\nGözlük takıldı\nAcil durdurma butonu erişilebilir", bicim: false, satir: 4 },
    kural: "Her satır bir madde. İşaret kutularını kiosk çizer.",
  },

  karsilastirma: {
    metin: {
      yerTutucu: "Doğru | Yanlış\nKablo makaraya sarılı | Kablo yerde\nPano kapağı kapalı | Pano açık",
      bicim: false,
      satir: 4,
    },
    kural: "Her satır `sol | sağ`. İLK SATIR sütun başlıklarıdır.",
  },

  sayiVurgu: {
    metin: { yerTutucu: "3 sn | düşme süresi\n4 m | korkuluk zorunluluğu", bicim: false, satir: 3 },
    kural: "Her satır `sayı | etiket`.",
  },

  onceSonra: {
    metin: { etiket: "Önce — alt yazı", yerTutucu: "Bozuk hâlinde ne yanlış?", bicim: false, satir: 2 },
    metinKarsi: { etiket: "Sonra — alt yazı", yerTutucu: "Düzeltilmiş hâlinde ne değişti?", bicim: false, satir: 2 },
    kural: "İki fotoğraf yan yana: solda bozuk hâli, sağda düzeltilmiş hâli.",
  },
};

const VARSAYILAN: TipTanimi = { metin: { yerTutucu: "Metin", bicim: true, satir: 2 } };

export default function KartAlanlari({
  sayfa,
  kilitli,
  gorseller,
  altMetinler,
  odakDegeri,
  onAnlik,
  onGuncelle,
  onGorselleriYaz,
  onYuvaSec,
  onAltMetin,
}: {
  sayfa: Sayfa;
  kilitli?: boolean;
  /** Kartın görselleri, sırasıyla (`kartGorselleri`). */
  gorseller: string[];
  altMetinler: Record<string, string>;
  /** Alana girildiği andaki değer — kaydetme kararı buna bakar (`SayfaSatiri`). */
  odakDegeri: React.MutableRefObject<string>;
  onAnlik: (yama: Record<string, unknown>) => void;
  onGuncelle: (yama: Record<string, unknown>) => void;
  onGorselleriYaz: (idler: string[]) => void;
  /** Önce/sonra yuvası için medya seçicisini açar. */
  onYuvaSec: (yuva: 0 | 1) => void;
  onAltMetin: (medyaId: string, altMetin: string) => void;
}) {
  const tanim = TIPLER[sayfa.tip] ?? VARSAYILAN;
  const bicimVar = tanim.metin.bicim || (tanim.metinKarsi?.bicim ?? false);

  return (
    <div className="space-y-3">
      <Alan
        alan="metin"
        tanim={tanim.metin}
        deger={sayfa.metin ?? ""}
        kilitli={kilitli}
        odakDegeri={odakDegeri}
        onAnlik={onAnlik}
        onGuncelle={onGuncelle}
      />

      {/* Karşılaştırma dilini TARİF ETMEK yerine GÖSTERİYORUZ: yazılan satırlar
          anında tabloya dönüşünce "ilk satır başlıktır" kuralını okumaya gerek
          kalmıyor. */}
      {sayfa.tip === "karsilastirma" ? <KarsilastirmaOnizleme metin={sayfa.metin} /> : null}

      {tanim.metinKarsi ? (
        <Alan
          alan="metinKarsi"
          tanim={tanim.metinKarsi}
          deger={sayfa.metinKarsi ?? ""}
          kilitli={kilitli}
          odakDegeri={odakDegeri}
          onAnlik={onAnlik}
          onGuncelle={onGuncelle}
          vurgu={sayfa.tip === "yapYapma"}
        />
      ) : null}

      {tanim.kural ? <p className="text-[11px] leading-relaxed text-muted">{tanim.kural}</p> : null}
      {bicimVar ? <div className="hidden sm:block"><BicimIpucu /></div> : null}

      {sayfa.tip === "onceSonra" ? (
        <OnceSonraYuvalari
          gorseller={gorseller}
          altMetinler={altMetinler}
          kilitli={kilitli}
          onYuvaSec={onYuvaSec}
          onGorselleriYaz={onGorselleriYaz}
          onAltMetin={onAltMetin}
        />
      ) : sayfa.tip === "video" ? null : (
        <Galeri
          gorseller={gorseller}
          altMetinler={altMetinler}
          kilitli={kilitli}
          onGorselleriYaz={onGorselleriYaz}
          onAltMetin={onAltMetin}
        />
      )}
    </div>
  );
}

/* ── metin alanı ──────────────────────────────────────────────────────────── */

function Alan({
  alan,
  tanim,
  deger,
  kilitli,
  odakDegeri,
  onAnlik,
  onGuncelle,
  vurgu,
}: {
  alan: "metin" | "metinKarsi";
  tanim: AlanTanimi;
  deger: string;
  kilitli?: boolean;
  odakDegeri: React.MutableRefObject<string>;
  onAnlik: (yama: Record<string, unknown>) => void;
  onGuncelle: (yama: Record<string, unknown>) => void;
  /** "Yapma" kolonu kırmızı çerçeveli — hangi kolona yazdığı bir bakışta görülsün. */
  vurgu?: boolean;
}) {
  return (
    <MetinAlani
      etiket={tanim.etiket}
      bicim={tanim.bicim}
      disabled={kilitli}
      defaultValue={deger}
      rows={tanim.satir}
      placeholder={tanim.yerTutucu}
      /* Yer tutucu çok satırlı bir ÖRNEK; ekran okuyucuya etiket diye okutmak
         alanın ne olduğunu değil örneğin tamamını dinletirdi. */
      aria-label={tanim.etiket ?? (alan === "metin" ? "Kart metni" : "Kartın ikinci metni")}
      className={`input-base ${vurgu ? "border-brand/30" : ""}`}
      onFocus={(e) => (odakDegeri.current = e.target.value)}
      onChange={(e) => onAnlik({ [alan]: e.target.value })}
      onBlur={(e) => e.target.value !== odakDegeri.current && onGuncelle({ [alan]: e.target.value })}
      /* Şerit metni React'in dışında yazar: iyimser çizim ve kayıt birlikte
         tetiklenmezse düğmeye basıp sekmeyi kapatan kişi değişikliği kaybederdi. */
      onUygula={(m) => {
        odakDegeri.current = m;
        onAnlik({ [alan]: m });
        onGuncelle({ [alan]: m });
      }}
    />
  );
}

/* ── karşılaştırma mini tablosu ───────────────────────────────────────────── */

function KarsilastirmaOnizleme({ metin }: { metin?: string }) {
  const tablo = karsilastirmaTablosu(metin);
  if (tablo.basliklar[0] === "" && tablo.basliklar[1] === "" && tablo.satirlar.length === 0) return null;

  return (
    <div>
      <table className="w-full table-fixed border-collapse text-xs">
        <thead>
          <tr className="bg-paper">
            <th className="rounded-tl-lg border border-line px-2 py-1.5 text-left font-bold">
              {tablo.basliklar[0] || "—"}
            </th>
            <th className="rounded-tr-lg border border-l-0 border-line px-2 py-1.5 text-left font-bold">
              {tablo.basliklar[1] || "—"}
            </th>
          </tr>
        </thead>
        <tbody>
          {tablo.satirlar.map((s, i) => (
            <tr key={i}>
              <td className="border border-t-0 border-line px-2 py-1 align-top">{s[0]}</td>
              <td className="border border-l-0 border-t-0 border-line px-2 py-1 align-top text-muted">{s[1] || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {tablo.satirlar.length === 0 ? (
        <p className="mt-1 text-[11px] text-muted">
          İlk satır <strong>sütun başlığı</strong> oldu. Alt satırlara karşılaştırmaları yazın.
        </p>
      ) : null}
    </div>
  );
}

/* ── önce / sonra ─────────────────────────────────────────────────────────── */

/**
 * İki yuva, ama veri hâlâ SIRALI BİR LİSTE (`gorselIdler[0]` önce, `[1]` sonra).
 *
 * "Sonra" yuvası "Önce" boşken kapalı: boş bir birinci eleman tutmanın yolu yok
 * (listede yer tutucu kimlik saklamak, silinmiş medya gibi görünürdü). Sıra
 * yanlış geldiyse silip yeniden seçmek yerine YER DEĞİŞTİR düğmesi var.
 */
function OnceSonraYuvalari({
  gorseller,
  altMetinler,
  kilitli,
  onYuvaSec,
  onGorselleriYaz,
  onAltMetin,
}: {
  gorseller: string[];
  altMetinler: Record<string, string>;
  kilitli?: boolean;
  onYuvaSec: (yuva: 0 | 1) => void;
  onGorselleriYaz: (idler: string[]) => void;
  onAltMetin: (medyaId: string, altMetin: string) => void;
}) {
  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        <Yuva
          etiket="Önce"
          id={gorseller[0]}
          altMetin={altMetinler[gorseller[0] ?? ""] ?? ""}
          kilitli={kilitli}
          onSec={() => onYuvaSec(0)}
          onKaldir={() => onGorselleriYaz(gorseller.slice(1))}
          onAltMetin={onAltMetin}
        />
        <Yuva
          etiket="Sonra"
          id={gorseller[1]}
          altMetin={altMetinler[gorseller[1] ?? ""] ?? ""}
          kilitli={kilitli}
          kapali={gorseller.length === 0}
          onSec={() => onYuvaSec(1)}
          onKaldir={() => onGorselleriYaz(gorseller.slice(0, 1))}
          onAltMetin={onAltMetin}
        />
      </div>

      {gorseller.length > 1 ? (
        <button
          type="button"
          disabled={kilitli}
          onClick={() => onGorselleriYaz(siraDegistir(gorseller, 0, 1))}
          className="btn-ghost mt-2 text-xs"
        >
          <Icon name="swap" size={14} /> Yer değiştir
        </button>
      ) : null}

      {gorseller.length > 2 ? (
        <p className="mt-2 text-[11px] text-brand-dark">
          Kartta {gorseller.length} görsel var; önce/sonra yalnız ilk ikisini çizer. Fazlasını kaldırın.
        </p>
      ) : null}
    </div>
  );
}

function Yuva({
  etiket,
  id,
  altMetin,
  kilitli,
  kapali,
  onSec,
  onKaldir,
  onAltMetin,
}: {
  etiket: string;
  id?: string;
  altMetin: string;
  /** Yayındaki eğitim — hiçbir şey düzenlenemez. */
  kilitli?: boolean;
  /** Sırası gelmemiş yuva ("Sonra", "Önce" boşken) — kilitten AYRI, çünkü sebebi başka. */
  kapali?: boolean;
  onSec: () => void;
  onKaldir: () => void;
  onAltMetin: (medyaId: string, altMetin: string) => void;
}) {
  return (
    <div>
      <span className="mb-1 block text-xs font-semibold text-muted">{etiket}</span>
      {id ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={medyaYolu(id)} alt="" className="h-24 w-full rounded-lg border border-line object-cover" />
          <div className="mt-1 flex gap-1">
            <button type="button" disabled={kilitli} onClick={onSec} className="btn-ghost flex-1 py-1 text-[11px]">
              Değiştir
            </button>
            <button
              type="button"
              disabled={kilitli}
              onClick={onKaldir}
              className="btn-icon h-7 w-7 hover:text-brand"
              aria-label={`${etiket} görselini kaldır`}
            >
              <Icon name="close" size={14} />
            </button>
          </div>
          {/* `key` GÖRSEL KİMLİĞİ: alan denetimsiz, yuvadaki görsel değişince
              (değiştir / yer değiştir / önceki kaldırıldı) kutuda ÖNCEKİ
              görselin açıklaması kalıyordu — yanlış fotoğrafın altında yanlış
              alt metin, ekran okuyucuya okunan da o olurdu. */}
          <input
            key={id}
            disabled={kilitli}
            defaultValue={altMetin}
            onBlur={(e) => e.target.value !== altMetin && onAltMetin(id, e.target.value)}
            placeholder="Bu görsel ne gösteriyor?"
            aria-label={`${etiket} görselinin alt metni`}
            className="input-base mt-1 px-2 py-1 text-[11px]"
          />
        </>
      ) : (
        <button
          type="button"
          disabled={kilitli || kapali}
          onClick={onSec}
          className="grid h-24 w-full place-items-center rounded-lg border border-dashed border-line text-center text-[11px] font-semibold text-muted transition-colors hover:border-accent hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="flex flex-col items-center gap-1 px-2">
            <Icon name="image" size={18} />
            {kapali ? "Önce görselini seçin" : "Görsel seç"}
          </span>
        </button>
      )}
    </div>
  );
}

/* ── çoklu görsel ─────────────────────────────────────────────────────────── */

/**
 * ÇOKLU GÖRSEL: bir kural kartında "doğru bağlantı" ve "yanlış bağlantı"
 * fotoğrafını yan yana koymak için ikinci bir kart açmak gerekiyordu; iki kart
 * aynı kuralı ikiye bölüyordu. Sıra önemli — ilki kartın kapağı.
 */
function Galeri({
  gorseller,
  altMetinler,
  kilitli,
  onGorselleriYaz,
  onAltMetin,
}: {
  gorseller: string[];
  altMetinler: Record<string, string>;
  kilitli?: boolean;
  onGorselleriYaz: (idler: string[]) => void;
  onAltMetin: (medyaId: string, altMetin: string) => void;
}) {
  if (gorseller.length === 0) return null;

  return (
    <>
      <ul className="flex flex-wrap gap-2">
        {gorseller.map((g, i) => (
          <li key={g} className="relative w-40">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={medyaYolu(g)} alt="" className="h-20 w-40 rounded-lg border border-line object-cover" />
            {i === 0 ? (
              <span className="absolute left-1 top-1 rounded-md bg-ink/70 px-1.5 py-0.5 text-[10px] font-bold text-white">
                Kapak
              </span>
            ) : null}
            <div className="mt-1 flex justify-center gap-0.5">
              <button
                onClick={() => onGorselleriYaz(siraDegistir(gorseller, i, -1))}
                disabled={kilitli || i === 0}
                className="btn-icon h-7 w-7"
                aria-label="Görseli öne al"
              >
                <Icon name="chevronLeft" size={14} />
              </button>
              <button
                onClick={() => onGorselleriYaz(siraDegistir(gorseller, i, 1))}
                disabled={kilitli || i === gorseller.length - 1}
                className="btn-icon h-7 w-7"
                aria-label="Görseli geri al"
              >
                <Icon name="chevronRight" size={14} />
              </button>
              <button
                onClick={() => onGorselleriYaz(gorseller.filter((_, x) => x !== i))}
                disabled={kilitli}
                className="btn-icon h-7 w-7 hover:text-brand"
                aria-label="Görseli kaldır"
              >
                <Icon name="close" size={14} />
              </button>
            </div>
            {/* ALT METİN GÖRSELİN YANINDA duruyor, ayrı bir ekranda değil:
                açıklamayı yazacak an, görseli seçtiğiniz andır. */}
            <input
              disabled={kilitli}
              defaultValue={altMetinler[g] ?? ""}
              onBlur={(e) => e.target.value !== (altMetinler[g] ?? "") && onAltMetin(g, e.target.value)}
              placeholder="Bu görsel ne gösteriyor?"
              aria-label={`${i + 1}. görselin alt metni`}
              title="Ekran okuyucu bunu okur. Görselin NE GÖSTERDİĞİNİ yazın, dosya adını değil."
              className="input-base mt-1 px-2 py-1 text-[11px]"
            />
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted">
        Alt metin <strong>ekran okuyucuya</strong> okunur — görselin ne gösterdiğini yazın, dosya adını değil. Boş
        bırakırsanız kart başlığından türetilen metin kullanılır.
      </p>
    </>
  );
}
