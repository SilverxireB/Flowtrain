"use client";

import type { Sayfa } from "@/lib/tipler";
import Icon from "@/components/Icon";
import { gorselIzgaraSinifi, gorselYukseklikSinifi, kartGorselleri } from "./gorseller";

/**
 * İÇERİK KARTI — kiosk'ta gösterilen tek sayfa.
 *
 * SERBEST TUVAL YOK: hazırlayan yalnız metin yazar ve görsel seçer; yerleşimi,
 * tipografiyi, rengi ürün belirler. Kalite sorunu insanlara boş tuval
 * verildiğinde başlar — burada kötü yapma imkânı yok.
 *
 * Punto ve boşluklar KİOSK için: ayakta, bir metre uzaktan, eldivenle.
 *
 * ÇOKLU GÖRSEL: yerleşim kararı `gorseller.ts`te (saf, sınavlı). Burada
 * yalnız çizilir — kaç görselin nasıl dizileceğini bileşenin içine gömmek,
 * kiosk düzeninin bozulup bozulmadığını sınavla korunamaz hâle getirirdi.
 */
export default function Kart({
  sayfa,
  altMetinler,
}: {
  sayfa: Sayfa;
  /**
   * Görsel kimliği → hazırlayanın yazdığı açıklama (`Medya.altMetin`).
   *
   * İSTEĞE BAĞLI: editörün canlı önizlemesi kütüphaneyi taşımıyor, oradan
   * gelmediğinde türetilmiş metne düşülür. Zorunlu olsaydı önizlemeyi çizen
   * her yerin medya tablosunu okuması gerekirdi.
   */
  altMetinler?: Record<string, string>;
}) {
  const gorseller = kartGorselleri(sayfa);

  if (sayfa.tip === "yapYapma") {
    return (
      <div>
        <Baslik metin={sayfa.baslik} />
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Sutun renk="iyi" ikon="check" baslik="Yap" metin={sayfa.metin} />
          <Sutun renk="brand" ikon="close" baslik="Yapma" metin={sayfa.metinKarsi} />
        </div>
        <Gorseller idler={gorseller} baslik={sayfa.baslik} altMetinler={altMetinler} />
      </div>
    );
  }

  if (sayfa.tip === "uyari") {
    return (
      <div>
        {/* Uyarı kutusu YALNIZ gerçek tuzak için — her sayfayı kırmızıya
            boyarsak kırmızı hiçbir şey ifade etmez. */}
        <div className="rounded-2xl border-2 border-brand/40 bg-brand-soft p-6 sm:p-8">
          <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-brand-dark">
            <Icon name="warning" size={18} /> Dikkat
          </p>
          <h2 className="mt-3 text-2xl font-extrabold leading-tight text-ink sm:text-3xl">{sayfa.baslik}</h2>
          {sayfa.metin ? (
            <p className="mt-4 whitespace-pre-line text-lg leading-relaxed text-ink/90">{sayfa.metin}</p>
          ) : null}
        </div>
        <Gorseller idler={gorseller} baslik={sayfa.baslik} altMetinler={altMetinler} />
      </div>
    );
  }

  if (sayfa.tip === "adim") {
    const adimlar = (sayfa.metin ?? "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    return (
      <div>
        <Baslik metin={sayfa.baslik} />
        <ol className="mt-6 space-y-3">
          {adimlar.map((a, i) => (
            <li key={i} className="flex items-start gap-4 rounded-2xl border border-line bg-white p-4">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-base font-bold text-white">
                {i + 1}
              </span>
              <span className="pt-1 text-lg leading-relaxed">{a}</span>
            </li>
          ))}
        </ol>
        <Gorseller idler={gorseller} baslik={sayfa.baslik} altMetinler={altMetinler} />
      </div>
    );
  }

  if (sayfa.tip === "video") {
    return (
      <div>
        <Baslik metin={sayfa.baslik} />
        {sayfa.videoId ? (
          <video
            key={sayfa.videoId}
            data-icerik-videosu
            className="mt-6 w-full rounded-2xl bg-black"
            src={`/api/medya/${sayfa.videoId}`}
            controls
            controlsList="nodownload noplaybackrate"
            disablePictureInPicture
            playsInline
          />
        ) : (
          <p className="mt-6 rounded-2xl border border-dashed border-line p-8 text-center text-muted">
            Video eklenmemiş.
          </p>
        )}
        {sayfa.metin ? (
          <p className="mt-4 whitespace-pre-line text-lg leading-relaxed text-ink/90">{sayfa.metin}</p>
        ) : null}
      </div>
    );
  }

  // kural
  return (
    <div>
      <Baslik metin={sayfa.baslik} />
      {sayfa.metin ? (
        <p className="mt-5 whitespace-pre-line text-xl leading-relaxed text-ink/90">{sayfa.metin}</p>
      ) : null}
      <Gorseller idler={gorseller} baslik={sayfa.baslik} altMetinler={altMetinler} />
    </div>
  );
}

function Baslik({ metin }: { metin: string }) {
  return <h2 className="text-3xl font-extrabold leading-tight sm:text-4xl">{metin}</h2>;
}

/**
 * Kartın görselleri.
 *
 * ALT METNİ BOŞ BIRAKILMIYOR: görsel burada süs değil, çoğu zaman kuralın
 * kendisi (doğru kaldırma duruşu, doğru KKD). Ekran okuyucu kullanan kişiye
 * "resim" bile denmemesi, sayfanın yarısının yok sayılması demekti.
 *
 * ÖNCE HAZIRLAYANIN YAZDIĞI (`Medya.altMetin`), sonra türetilmiş metin.
 * Türetilmiş metin ("Yüksekte çalışma — görsel 2/3") görselin VARLIĞINI ve
 * bağlamını söyler ama ne gösterdiğini söylemez; yazılmış bir açıklama varken
 * onu kullanmamak, açıklamayı yazan kişinin emeğini çöpe atardı.
 */
function Gorseller({
  idler,
  baslik,
  altMetinler,
}: {
  idler: string[];
  baslik: string;
  altMetinler?: Record<string, string>;
}) {
  if (idler.length === 0) return null;
  const yukseklik = gorselYukseklikSinifi(idler.length);

  return (
    <div className={gorselIzgaraSinifi(idler.length)}>
      {idler.map((id, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={id}
          src={`/api/medya/${id}`}
          alt={
            (altMetinler?.[id] ?? "").trim() ||
            (idler.length > 1 ? `${baslik} — görsel ${i + 1}/${idler.length}` : `${baslik} — görsel`)
          }
          className={`w-full rounded-2xl border border-line object-contain ${yukseklik}`}
        />
      ))}
    </div>
  );
}

function Sutun({
  renk,
  ikon,
  baslik,
  metin,
}: {
  renk: "iyi" | "brand";
  ikon: "check" | "close";
  baslik: string;
  metin?: string;
}) {
  const iyi = renk === "iyi";
  return (
    <div className={`rounded-2xl border-2 p-5 ${iyi ? "border-iyi/40 bg-iyi/5" : "border-brand/40 bg-brand-soft"}`}>
      <p className={`flex items-center gap-2 font-bold ${iyi ? "text-iyi-dark" : "text-brand-dark"}`}>
        <Icon name={ikon} size={20} /> {baslik}
      </p>
      <p className="mt-3 whitespace-pre-line text-lg leading-relaxed">{metin ?? "—"}</p>
    </div>
  );
}
