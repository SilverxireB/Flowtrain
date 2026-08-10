"use client";

import type { Sayfa } from "@/lib/tipler";
import Icon from "@/components/Icon";
import {
  karsilastirmaTablosu,
  kontrolMaddeleri,
  onceSonra,
  satirlar,
  sayiVurgulari,
} from "@/lib/kartVeri";
import Bicimli, { BicimliSatir } from "./Bicimli";
import {
  gorselIzgaraSinifi,
  gorselYukseklikSinifi,
  kartGorselleri,
  sayiIzgaraSinifi,
  sayiPuntoSinifi,
} from "./gorseller";

/**
 * İÇERİK KARTI — kiosk'ta gösterilen tek sayfa.
 *
 * SERBEST TUVAL YOK: hazırlayan yalnız metin yazar ve görsel seçer; yerleşimi,
 * tipografiyi, rengi ürün belirler. Kalite sorunu insanlara boş tuval
 * verildiğinde başlar — burada kötü yapma imkânı yok.
 *
 * Punto ve boşluklar KİOSK için: ayakta, bir metre uzaktan, eldivenle.
 *
 * METİN HER YERDE `Bicimli`DEN GEÇER: hazırlayanın yazdığı `**kalın**`, `- `,
 * `!!` işaretleri tek bir yerde bile ham bırakılırsa sahada yıldız görünür.
 * Ayrıştırma `bicimMetin.ts`te, satır dilleri `kartVeri.ts`te — bu dosya
 * yalnız ÇİZER, hiçbir metni kendi ayrıştırmaz.
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
          <Bicimli metin={sayfa.metin} boyut="orta" className="mt-4 text-ink/90" />
        </div>
        <Gorseller idler={gorseller} baslik={sayfa.baslik} altMetinler={altMetinler} />
      </div>
    );
  }

  if (sayfa.tip === "adim") {
    // Satırlara bölme `kartVeri.satirlar` ile: aynı işi burada tekrar yazmak,
    // iki ayrıştırıcının zamanla ayrışması demek.
    const adimlar = satirlar(sayfa.metin);
    return (
      <div>
        <Baslik metin={sayfa.baslik} />
        <ol className="mt-6 space-y-3">
          {adimlar.map((a, i) => (
            <li key={i} className="flex items-start gap-4 rounded-2xl border border-line bg-white p-4">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-base font-bold text-white">
                {i + 1}
              </span>
              <span className="pt-1 text-lg leading-relaxed">
                <BicimliSatir metin={a} />
              </span>
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
        <Bicimli metin={sayfa.metin} boyut="orta" className="mt-4 text-ink/90" />
      </div>
    );
  }

  if (sayfa.tip === "kontrolListesi") {
    const maddeler = kontrolMaddeleri(sayfa.metin);
    return (
      <div>
        <Baslik metin={sayfa.baslik} />
        {/* İŞARETLENMEZ. Bu bir sınav değil, vardiya başı hatırlatması: kutular
            tıklanabilir olsaydı işçi "işaretlemezsem geçmez" sanıp her satıra
            dokunurdu — dokunuş sayısı madde başına bir artar, öğrenme sıfır
            artardı. Kutu görünümü yalnız GÖZ TARAMASI için: satırlar tek tek
            değil, liste olarak okunuyor. */}
        <p className="mt-3 text-base font-semibold text-muted">
          Sahada tek tek kontrol edilecek maddeler. Bu ekranda işaretlenmez.
        </p>
        <ul className="mt-6 space-y-3">
          {maddeler.map((m, i) => (
            <li key={i} className="flex items-start gap-4 rounded-2xl border border-line bg-white p-4">
              {/* Kutu BOŞ. İçine soluk bir tik koymak "işaretlenmiş" gibi
                  okunuyordu; boş kutu maddenin henüz yapılmadığını söyler. */}
              <span aria-hidden className="mt-0.5 h-9 w-9 shrink-0 rounded-lg border-2 border-line bg-paper" />
              <span className="pt-1 text-lg leading-relaxed">
                <BicimliSatir metin={m.metin} />
              </span>
            </li>
          ))}
        </ul>
        <Gorseller idler={gorseller} baslik={sayfa.baslik} altMetinler={altMetinler} />
      </div>
    );
  }

  if (sayfa.tip === "karsilastirma") {
    const tablo = karsilastirmaTablosu(sayfa.metin);
    return (
      <div>
        <Baslik metin={sayfa.baslik} />
        {/* GERÇEK <table> DEĞİL: dar ekranda tablo ya yatay kaydırılır (eldivenle
            imkânsız) ya da hücreler okunmaz hâle gelir. Izgara, `sm` altında
            hücreleri alt alta düşürür ve HER hücre kendi başlığını taşır —
            başlıksız bir "doğru/yanlış" tablosu, doğruyu yanlışla karıştırmak
            demek. */}
        <div className="mt-6 space-y-3">
          <div className="hidden gap-3 sm:grid sm:grid-cols-2">
            <BaslikHucre metin={tablo.basliklar[0]} />
            <BaslikHucre metin={tablo.basliklar[1]} />
          </div>
          {tablo.satirlar.map((satir, i) => (
            <div key={i} className="grid gap-3 sm:grid-cols-2">
              <Hucre baslik={tablo.basliklar[0]} metin={satir[0]} />
              <Hucre baslik={tablo.basliklar[1]} metin={satir[1]} />
            </div>
          ))}
        </div>
        <Gorseller idler={gorseller} baslik={sayfa.baslik} altMetinler={altMetinler} />
      </div>
    );
  }

  if (sayfa.tip === "vaka") {
    return (
      <div>
        <Baslik metin={sayfa.baslik} />
        <Bicimli metin={sayfa.metin} boyut="orta" className="mt-5 text-ink/90" />
        <Gorseller idler={gorseller} baslik={sayfa.baslik} altMetinler={altMetinler} />
        {/* DERS AYRI KUTUDA ve EN SONDA. Kartın bütün değeri burada: olayı
            okuyan kişi "bana olmaz" diye geçebilir, ders cümlesi kuralı olayın
            üstüne bağlar. Anlatının içinde bir paragraf olarak kalsaydı hızlı
            okumada kaybolurdu. */}
        {(sayfa.metinKarsi ?? "").trim() ? (
          <div className="mt-6 rounded-2xl border-2 border-accent/40 bg-accent-soft p-5 sm:p-6">
            <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-accent-dark">
              <Icon name="target" size={18} /> Çıkarılan ders
            </p>
            <Bicimli metin={sayfa.metinKarsi} boyut="buyuk" className="mt-3" />
          </div>
        ) : null}
      </div>
    );
  }

  if (sayfa.tip === "onceSonra") {
    const os = onceSonra(sayfa);
    return (
      <div>
        <Baslik metin={sayfa.baslik} />
        {/* İki görsel YAN YANA durmalı: "önce/sonra" farkı iki görseli aynı
            anda görmekten çıkar. Dar ekranda alt alta düşer ama etiketler her
            iki durumda da görselin ÜSTÜNDE kalır — kaydırınca hangisinin
            hangisi olduğu unutulmasın. */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <OnceSonraPanel
            etiket="Önce"
            renk="brand"
            gorselId={os.onceId}
            yazi={os.onceYazi}
            baslik={sayfa.baslik}
            altMetinler={altMetinler}
          />
          <OnceSonraPanel
            etiket="Sonra"
            renk="iyi"
            gorselId={os.sonraId}
            yazi={os.sonraYazi}
            baslik={sayfa.baslik}
            altMetinler={altMetinler}
          />
        </div>
      </div>
    );
  }

  if (sayfa.tip === "sayiVurgu") {
    const sayilar = sayiVurgulari(sayfa.metin);
    return (
      <div>
        <Baslik metin={sayfa.baslik} />
        {/* RAKAM ÖNCE, ETİKET SONRA ve küçük. Sıra tersine döndüğünde kart
            "bir bakışta okunan sayı" olmaktan çıkıp sıradan bir liste oluyor —
            bu kart tipinin tek varlık sebebi o bakış. */}
        <div className={sayiIzgaraSinifi(sayilar.length)}>
          {sayilar.map((s, i) => (
            <div key={i} className="rounded-2xl border border-line bg-white p-6 text-center">
              <p className={`font-extrabold leading-none text-accent ${sayiPuntoSinifi(sayilar.length)}`}>{s.sayi}</p>
              {s.etiket ? (
                <p className="mt-3 text-base font-semibold leading-snug text-muted">
                  <BicimliSatir metin={s.etiket} />
                </p>
              ) : null}
            </div>
          ))}
        </div>
        <Gorseller idler={gorseller} baslik={sayfa.baslik} altMetinler={altMetinler} />
      </div>
    );
  }

  // kural
  return (
    <div>
      <Baslik metin={sayfa.baslik} />
      <Bicimli metin={sayfa.metin} boyut="buyuk" className="mt-5 text-ink/90" />
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
      {/* Kolon boşsa "—" kalır: boş bir kutu "yazılmamış mı, yoksa yok mu"
          sorusunu okuyucuya bırakıyordu. */}
      {(metin ?? "").trim() ? (
        <Bicimli metin={metin} boyut="orta" className="mt-3" />
      ) : (
        <p className="mt-3 text-lg text-muted">—</p>
      )}
    </div>
  );
}

/** Karşılaştırma tablosunun sütun başlığı (yalnız geniş ekranda). */
function BaslikHucre({ metin }: { metin: string }) {
  return (
    <p className="rounded-xl bg-ink/5 px-4 py-2 text-base font-extrabold uppercase tracking-wide text-ink">
      {metin || "—"}
    </p>
  );
}

/**
 * Karşılaştırma hücresi.
 *
 * RENK YOK. İlk akla gelen "sol yeşil, sağ kırmızı" ama tablo her zaman
 * doğru/yanlış değil: "eski yöntem | yeni yöntem", "yaz | kış" da bu kartla
 * yazılıyor. Yanlış tarafı kırmızıya boyamak, kırmızının ürün genelindeki tek
 * anlamını (tehlike) sulandırırdı.
 */
function Hucre({ baslik, metin }: { baslik: string; metin: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      {/* Başlık dar ekranda hücrenin İÇİNE taşınır; geniş ekranda üstteki
          başlık satırı zaten görünüyor. */}
      <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted sm:hidden">{baslik || "—"}</p>
      <p className="text-lg leading-relaxed">{metin ? <BicimliSatir metin={metin} /> : "—"}</p>
    </div>
  );
}

/** Önce/sonra kartının tek yanı: etiket, görsel, alt yazı. */
function OnceSonraPanel({
  etiket,
  renk,
  gorselId,
  yazi,
  baslik,
  altMetinler,
}: {
  etiket: string;
  /** `brand` bozuk hâl, `iyi` düzeltilmiş hâl — burada renk BİLGİ taşıyor. */
  renk: "brand" | "iyi";
  gorselId?: string;
  yazi: string;
  baslik: string;
  altMetinler?: Record<string, string>;
}) {
  const iyi = renk === "iyi";
  return (
    <div className={`rounded-2xl border-2 p-4 ${iyi ? "border-iyi/40 bg-iyi/5" : "border-brand/40 bg-brand-soft"}`}>
      {/* Etiket renkten İBARET değil: yazısı da var. Renk körü bir işçi için
          "önce" ile "sonra" arasındaki fark yalnız tonda kalsaydı kart hiçbir
          şey anlatmazdı. */}
      <p className={`flex items-center gap-2 font-bold ${iyi ? "text-iyi-dark" : "text-brand-dark"}`}>
        <Icon name={iyi ? "check" : "close"} size={20} /> {etiket}
      </p>
      {gorselId ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/medya/${gorselId}`}
          alt={(altMetinler?.[gorselId] ?? "").trim() || `${baslik} — ${etiket.toLocaleLowerCase("tr")}`}
          className="mt-3 max-h-[32vh] w-full rounded-xl border border-line bg-white object-contain"
        />
      ) : (
        <p className="mt-3 rounded-xl border border-dashed border-line bg-white/60 p-6 text-center text-muted">
          Görsel eklenmemiş.
        </p>
      )}
      <Bicimli metin={yazi} boyut="orta" className="mt-3" />
    </div>
  );
}
