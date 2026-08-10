"use client";

import { Fragment } from "react";
import Icon from "@/components/Icon";
import { bloklariCoz, parcalariCoz, type Blok, type Parca } from "@/lib/bicimMetin";

/**
 * BİÇİMLİ KART METNİ — `bicimMetin.ts`in çıktısını kiosk yüzeyinde çizer.
 *
 * NEDEN AYRI BİLEŞEN: kart metni Kart.tsx içinde SEKİZ ayrı yerde çiziliyor
 * (kural, uyarı, video, yap/yapma iki kolon, vaka iki bölüm, önce/sonra iki alt
 * yazı). Biçimi her birinde ayrı ayrı yorumlasaydık biri er geç unutulur ve
 * hazırlayanın yazdığı `**` sahada olduğu gibi görünürdü — kartın yarısı
 * yıldızlarla dolu olurdu ve bunu ancak fabrikadaki işçi fark ederdi.
 *
 * ÇİZİM DİLİ HAZIRLAYANIN DEĞİL ÜRÜNÜN: dosyada `**kalın**` yazar, ekranda ne
 * kadar kalın olacağına burası karar verir. Serbest tuval yok kuralının metin
 * tarafı bu.
 *
 * PUNTO KİOSK İÇİN: ayakta, bir metre uzaktan, eldivenle. En küçük boy bile
 * 16px'in altına inmez.
 */

export type BicimBoyut = "buyuk" | "orta" | "kucuk";

/**
 * Boy sınıfları TEK YERDE. Satır aralığı hepsinde `relaxed`: kioskta metin
 * göz gezdirilerek okunuyor, sıkışık satır bir metreden birbirine giriyor.
 */
const PUNTO: Record<BicimBoyut, string> = {
  buyuk: "text-xl leading-relaxed sm:text-2xl",
  orta: "text-lg leading-relaxed",
  kucuk: "text-base leading-relaxed",
};

export default function Bicimli({
  metin,
  boyut = "orta",
  className = "",
}: {
  metin?: string;
  boyut?: BicimBoyut;
  className?: string;
}) {
  const bloklar = bloklariCoz(metin);
  // Boş metin HİÇBİR ŞEY çizmez — boş bir <div> kartın boşluk ritmini bozuyor.
  if (bloklar.length === 0) return null;

  return (
    <div className={`space-y-4 ${PUNTO[boyut]} ${className}`}>
      {bloklar.map((b, i) => (
        <BlokCiz key={i} blok={b} />
      ))}
    </div>
  );
}

/**
 * TEK SATIRLIK biçimli metin — liste maddesi, tablo hücresi, sayı etiketi gibi
 * bloğu olmayan yerler için.
 *
 * Bu yerlerde `Bicimli` kullanılamaz: kendi kutusunu ve blok boşluklarını
 * getirirdi. Vurgu (`**`) yine de çalışmalı, yoksa tablo hücresinde yıldız
 * görünür.
 */
export function BicimliSatir({ metin }: { metin: string }) {
  // `parcalariCoz` doğrudan çağrılır: satır zaten tek satır, blok ayrıştırması
  // burada yapılacak bir iş bulamaz.
  return <Satir parcalar={parcalariCoz(metin)} />;
}

function BlokCiz({ blok }: { blok: Blok }) {
  if (blok.tip === "uyari") {
    /* KIRMIZI ŞERİT YALNIZ BURADA. Hazırlayan `!!` yazdığında kırmızı çıkar;
       her paragrafı kırmızıya boyayan bir kart, kırmızının anlamını sıfırlar
       (uyarı kartındaki notun aynısı).

       KUTU <div>, METİN <p>. Kırmızı zemin bir OLAY BİLDİRİMİ değil İÇERİK:
       `role="alert"` verilseydi ekran okuyucu her sayfa geçişinde uyarıyı
       araya girip okurdu. Uyarı kartındaki (`Kart.tsx`) ayrım da bu. */
    return (
      <div className="flex items-start gap-3 rounded-r-2xl border-l-4 border-brand bg-brand-soft px-4 py-3">
        <Icon name="warning" size={22} className="mt-1 text-brand-dark" />
        <p className="font-semibold text-brand-dark">
          <Satir parcalar={blok.satirlar[0] ?? []} />
        </p>
      </div>
    );
  }

  if (blok.tip === "madde") {
    return (
      <ul className="space-y-2">
        {blok.satirlar.map((s, i) => (
          <li key={i} className="flex items-start gap-3">
            {/* İşaret `list-disc` ile değil kutu ile: tarayıcının nokta ölçüsü
                punto büyüdükçe büyümüyor ve bir metreden kayboluyor. */}
            <span aria-hidden className="mt-[0.55em] h-2.5 w-2.5 shrink-0 rounded-full bg-accent" />
            <span>
              <Satir parcalar={s} />
            </span>
          </li>
        ))}
      </ul>
    );
  }

  if (blok.tip === "sirali") {
    return (
      <ol className="space-y-2">
        {blok.satirlar.map((s, i) => (
          <li key={i} className="flex items-start gap-3">
            <span
              aria-hidden
              className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent-soft text-base font-bold text-accent-dark"
            >
              {i + 1}
            </span>
            <span>
              <Satir parcalar={s} />
            </span>
          </li>
        ))}
      </ol>
    );
  }

  /* Paragraf: tek satır sonu SATIR KAYDIRIR, paragrafı bölmez (dilin kuralı
     `bicimMetin.ts`te). `whitespace-pre-line` kullanılmıyor — satırlar zaten
     kırpılmış geldiği için boşluklar korunacak bir şey taşımıyor. */
  return (
    <p>
      {blok.satirlar.map((s, i) => (
        <Fragment key={i}>
          {i > 0 ? <br /> : null}
          <Satir parcalar={s} />
        </Fragment>
      ))}
    </p>
  );
}

function Satir({ parcalar }: { parcalar: Parca[] }) {
  return (
    <>
      {parcalar.map((p, i) =>
        p.tip === "kalin" ? (
          <strong key={i} className="font-extrabold text-ink">
            {p.metin}
          </strong>
        ) : (
          <Fragment key={i}>{p.metin}</Fragment>
        ),
      )}
    </>
  );
}
