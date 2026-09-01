"use client";

import { memo, useRef, useState } from "react";
import Icon from "@/components/Icon";
import BolgeSecici from "@/components/editor/BolgeSecici";
import MedyaSecici from "@/components/editor/MedyaSecici";
import OtoMetin from "@/components/editor/OtoMetin";
import type { MedyaOzet } from "@/lib/editorMedya";
import { eslestirmeCifti } from "@/lib/sinav";
import { SORU_ACIKLAMA, SORU_ETIKET, type Soru } from "@/lib/tipler";
import { medyaYolu } from "@/lib/yol";

/**
 * Editördeki tek soru.
 *
 * YEDİ TİP, HER BİRİNİN KENDİ KURULUM YÜZEYİ VAR. Ortak bir "şıklar + doğruyu
 * işaretle" formu dördünde yalan söylüyordu: sıralamada ve eşleştirmede doğru
 * cevap şıkların KENDİ SIRASIDIR, işaretlenecek bir şey yoktur; görselde
 * işaretlemede şık diye bir şey yok, bölge var. Anlamsız arayüzü göstermek
 * "işaretlemeyi unuttum" sanılan sorular üretiyordu — o yüzden GİZLENİR.
 *
 * Her tipin altında `SORU_ACIKLAMA`dan gelen tek satır durur: hazırlayan
 * "Sıralama" düğmesine basmadan önce ne olduğunu okuyabilmeli, deneyerek
 * öğrenmek zorunda kalmamalı. Metinler `tipler.ts`te — burada elle liste yok.
 *
 * `zor` işareti İÇERİK KALİTE SİNYALİdir: soruyu çoğunluk yanlış yapıyorsa
 * insanlar değil, o sayfa kötüdür. Hiçbir LMS bunu hazırlayanın yüzüne söylemez.
 *
 * GERİ ÇAĞRILAR SORU KİMLİĞİNİ ALIR — `SayfaSatiri`daki ile aynı sebep: kararlı
 * geri çağrı olmadan `memo` hiçbir işe yaramaz, kart metnine yazılan her harf
 * bütün soruları da yeniden çizerdi.
 */
function SoruSatiriIc({
  soru,
  sira,
  zor,
  kolay,
  istatistik,
  medyalar,
  onGuncelle,
  onSil,
  onMedyaSil,
  onAltMetin,
  kilitli,
}: {
  soru: Soru;
  sira: number;
  zor: boolean;
  /** Yeterince denenmiş ve hiç yanlış yapılmamış — ölçmüyor. */
  kolay: boolean;
  /** Bu soru kaç kez soruldu, kaçında yanlış yapıldı. */
  istatistik?: { deneme: number; yanlis: number };
  medyalar: MedyaOzet[];
  /** Yayındaki eğitim salt okunur — sunucu da reddeder. */
  kilitli?: boolean;
  onGuncelle: (soruId: string, yama: Record<string, unknown>) => void;
  onSil: (soruId: string) => void;
  onMedyaSil: (medyaId: string) => void;
  onAltMetin: (medyaId: string, altMetin: string) => void;
}) {
  const [secici, setSecici] = useState(false);
  const metinKabi = useRef<HTMLDivElement>(null);

  const cokluSecim = soru.tip === "cokluSecim";
  const sabitSecenek = soru.tip === "dogruYanlis";
  const bosluk = soru.tip === "bosluk";
  const siralama = soru.tip === "siralama";
  const eslestirme = soru.tip === "eslestirme";
  const bolgeli = soru.tip === "gorselIsaret";
  /* Doğru şık işaretlemenin ANLAMI OLAN tipler. Sıralama ve eşleştirmede
     doğru cevap kimliktir (`sinav.ts` → siralamaDogruMu / eslestirmeDogruMu),
     görselde işaretlemede ise doğruluk bölge listesinden işaretlenir. */
  const dogruIsareti = !siralama && !eslestirme && !bolgeli;

  const soruGorseli = soru.gorselId ? medyalar.find((m) => m.id === soru.gorselId) : undefined;

  function dogruDegistir(i: number) {
    if (cokluSecim) {
      const yeni = soru.dogru.includes(i) ? soru.dogru.filter((x) => x !== i) : [...soru.dogru, i];
      // En az bir doğru şık kalmalı: doğrusu olmayan soru herkesi yanlışa düşürür
      // ve puanı sessizce aşağı çeker.
      if (yeni.length > 0) onGuncelle(soru.id, { dogru: yeni });
    } else onGuncelle(soru.id, { dogru: [i] });
  }

  function secenekDegistir(i: number, deger: string) {
    const yeni = [...soru.secenekler];
    yeni[i] = deger;
    onGuncelle(soru.id, { secenekler: yeni });
  }

  /** Eşleştirmede şık tek satırda iki değer taşır; yazılan yarı diğerini ezmez. */
  function ciftDegistir(i: number, yama: { sol?: string; sag?: string }) {
    const mevcut = eslestirmeCifti(soru.secenekler[i]);
    // `|` ayracın kendisi: kullanıcı yazarsa çift ikiye değil üçe bölünürdü.
    const sol = (yama.sol ?? mevcut.sol).replace(/\|/g, " ").trim();
    const sag = (yama.sag ?? mevcut.sag).replace(/\|/g, " ").trim();
    secenekDegistir(i, `${sol} | ${sag}`);
  }

  function secenekEkle() {
    onGuncelle(soru.id, { secenekler: [...soru.secenekler, eslestirme ? " | " : ""] });
  }

  function secenekSil(i: number) {
    if (soru.secenekler.length <= 2) return;
    onGuncelle(soru.id, {
      secenekler: soru.secenekler.filter((_, x) => x !== i),
      // Silinen şıktan sonrakiler kaydığı için doğru indeksleri de kaydır —
      // yoksa doğru cevap sessizce başka bir şıkka geçer.
      dogru: soru.dogru.filter((d) => d !== i).map((d) => (d > i ? d - 1 : d)),
    });
  }

  /** Sıralamada şıkların SIRASI doğru cevaptır; taşımak cevabı değiştirmektir. */
  function tasi(i: number, yon: -1 | 1) {
    const j = i + yon;
    if (j < 0 || j >= soru.secenekler.length) return;
    const yeni = [...soru.secenekler];
    [yeni[i], yeni[j]] = [yeni[j], yeni[i]];
    onGuncelle(soru.id, { secenekler: yeni });
  }

  function boslukKoy() {
    /* Metin alanına DOM üzerinden ulaşıyoruz: `OtoMetin` kart hattının dosyası
       ve `ref` almıyor. Boşluk imlecin durduğu yere girmeli — "Baret ___
       takılır" cümlesini sona eklenen bir işaretle kurmak mümkün değil. */
    const alan = metinKabi.current?.querySelector("textarea");
    if (!alan) return;
    onGuncelle(soru.id, { metin: bosluguYerlestir(alan) });
  }

  const yanlisOrani = istatistik && istatistik.deneme > 0 ? Math.round((istatistik.yanlis / istatistik.deneme) * 100) : null;

  /* Soru görseli TEK YERDE tanımlanır ama iki farklı yerde çizilir: görselde
     işaretleme tipinde bölgeler görselin üzerine çizildiği için görsel seçimi
     bölge seçicinin ÜSTÜNDE olmak zorunda, diğer tiplerde ise soruyu kalabalık
     etmesin diye altta kalır. */
  const gorselBlogu = (
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <button onClick={() => setSecici(true)} disabled={kilitli} className="btn-ghost text-sm">
        <Icon name="image" size={16} /> {soru.gorselId ? "Görseli değiştir" : "Soru görseli ekle"}
      </button>
      {soru.gorselId ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={medyaYolu(soru.gorselId)} alt="" className="h-14 rounded-flow-sm border border-line object-cover" />
          {/* ALT METİN SORUDA DAHA DA GEREKLİ: "bu fotoğraftaki hangi davranış
              yanlış?" sorusunu ekran okuyucuyla dinleyen kişi görseli
              göremiyorsa soruyu hiç cevaplayamaz. */}
          <input
            key={soru.gorselId}
            disabled={kilitli}
            defaultValue={soruGorseli?.altMetin ?? ""}
            onBlur={(e) =>
              soru.gorselId &&
              e.target.value !== (soruGorseli?.altMetin ?? "") &&
              onAltMetin(soru.gorselId, e.target.value)
            }
            placeholder="Bu görsel ne gösteriyor? (ekran okuyucu bunu okur)"
            aria-label="Soru görselinin alt metni"
            className="input-base w-auto min-w-[14rem] flex-1 py-1.5 text-xs"
          />
          <button
            onClick={() => onGuncelle(soru.id, { gorselId: null })}
            disabled={kilitli}
            className="btn-icon hover:text-brand"
            aria-label="Soru görselini kaldır"
          >
            <Icon name="close" size={16} />
          </button>
        </>
      ) : null}
    </div>
  );

  return (
    <div className={`card p-4 ${zor ? "border-orta/50" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-flow-sm bg-line text-xs font-bold text-muted">
          {sira}
        </span>
        <span className="chip text-xs">{SORU_ETIKET[soru.tip]}</span>
        {/* SAYIYI GÖSTER, YORUMU AYRI TUT: "%38 yanlış" ölçüdür, "anlatım
            yetersiz" yorumdur. İkisi tek rozette birleşince az denemeli bir
            soru da suçlanmış görünüyordu. */}
        {yanlisOrani !== null && istatistik ? (
          <span className="chip text-xs text-muted" title="Bu sorunun sınavlardaki geçmişi">
            <Icon name="chart" size={14} /> {istatistik.deneme} denemede %{yanlisOrani} yanlış
          </span>
        ) : null}
        {zor ? (
          <span className="chip border-orta/40 bg-orta/10 text-xs text-orta-dark" title="Bu soruyu çoğunluk yanlış yapıyor">
            <Icon name="warning" size={14} /> Anlatım yetersiz olabilir
          </span>
        ) : null}
        {/* ZOR SORUNUN SİMETRİĞİ. Sinyal iki yönlüdür ve ürün yalnız bir
            yönünü söylüyordu: kimsenin yanlış yapmadığı soru kimseyi elemez,
            kimseye bir şey öğretmez, havuzda yer kaplar. Kusur değil — bilgi. */}
        {kolay && !zor ? (
          <span className="chip text-xs text-muted" title="Yeterince denendi, hiç yanlış yapılmadı">
            <Icon name="check" size={14} /> Kimse yanlış yapmıyor
          </span>
        ) : null}
        <div className="flex-1" />
        <button
          onClick={() => onSil(soru.id)}
          disabled={kilitli}
          className="btn-icon hover:text-brand"
          aria-label="Soruyu sil"
        >
          <Icon name="trash" size={16} />
        </button>
      </div>

      {/* TİPİN NE OLDUĞU HER SORUNUN ÜSTÜNDE YAZAR — rehberi açmak, denemek ya
          da hatırlamak gerekmesin. Metin `tipler.ts`te tek kaynakta. */}
      <p className="mt-1.5 text-xs text-muted">{SORU_ACIKLAMA[soru.tip]}</p>

      <div ref={metinKabi} className="mt-3">
        <OtoMetin
          disabled={kilitli}
          defaultValue={soru.metin}
          onBlur={(e) => e.target.value !== soru.metin && onGuncelle(soru.id, { metin: e.target.value })}
          rows={2}
          placeholder={bosluk ? "Cümleyi yazın, boşluk bırakacağınız yere ___ koyun" : "Soru metni"}
          className="input-base font-semibold"
        />

        {bosluk ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button onClick={boslukKoy} disabled={kilitli} className="btn-ghost text-sm">
              <Icon name="minus" size={16} /> Boşluk ekle (___)
            </button>
            {/* BU TİPİN BÜTÜN ANLAMI O İŞARET: `___` yoksa soru sıradan bir
                çoktan seçmeliye dönüşür ve kimse sebebini anlamaz. */}
            {soru.metin.includes("___") ? (
              <span className="text-xs text-muted">Kişi boşluğu dolduran şıkkı seçecek.</span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-orta-dark">
                <Icon name="warning" size={14} /> Cümlede ___ yok — boşluk doldurma sorusu boşluksuz çalışmaz.
              </span>
            )}
          </div>
        ) : null}
      </div>

      {cokluSecim ? (
        <p className="mt-2 text-xs text-muted">
          Birden fazla doğru şık işaretleyin. Sınavda <strong>hep ya da hiç</strong> puanlanır: eksik işaretleme yarım
          puan almaz.
        </p>
      ) : null}

      {siralama ? (
        <p className="mt-2 text-xs text-muted">
          <strong>Doğru sırada yazın; kişiye karışık gösterilecek.</strong> Ayrı bir doğru cevap işareti yok — doğru
          cevap buradaki sıranın kendisidir.
        </p>
      ) : null}

      {eslestirme ? (
        <p className="mt-2 text-xs text-muted">
          Her satır bir çift. <strong>Kişiye sağ sütun karışık gösterilir</strong>, aynı satırdakiler doğru eşleşmedir —
          ayrı bir işaretleme yok.
        </p>
      ) : null}

      {/* ── bölgeler (görselde işaretleme) ──────────────────────────────────── */}
      {bolgeli ? (
        <>
          {gorselBlogu}
          <BolgeSecici
            gorselId={soru.gorselId}
            secenekler={soru.secenekler}
            dogru={soru.dogru}
            kilitli={kilitli}
            onDegis={(yama) => onGuncelle(soru.id, yama)}
          />
        </>
      ) : null}

      {/* ── eşleştirme çiftleri ─────────────────────────────────────────────── */}
      {eslestirme ? (
        <ul className="mt-3 space-y-2">
          {soru.secenekler.map((s, i) => {
            const cift = eslestirmeCifti(s);
            return (
              /* Anahtar İÇERİĞİ de taşır: kutular denetimsiz (`defaultValue`),
                 satır silinip aşağıdakiler kayınca yalnız indekse bakan bir
                 anahtar eski metni ekranda bırakırdı. */
              <li key={`${i}:${s}`} className="flex flex-wrap items-center gap-2">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-flow-sm bg-line text-xs font-bold text-muted">
                  {i + 1}
                </span>
                <input
                  defaultValue={cift.sol}
                  onBlur={(e) => e.target.value !== cift.sol && ciftDegistir(i, { sol: e.target.value })}
                  disabled={kilitli}
                  placeholder="Sol (ör. levha)"
                  aria-label={`${i + 1}. çiftin sol tarafı`}
                  className="input-base w-auto min-w-[8rem] flex-1 py-2"
                />
                <Icon name="chevronRight" size={16} className="text-muted" />
                <input
                  defaultValue={cift.sag}
                  onBlur={(e) => e.target.value !== cift.sag && ciftDegistir(i, { sag: e.target.value })}
                  disabled={kilitli}
                  placeholder="Sağ (karşılığı)"
                  aria-label={`${i + 1}. çiftin sağ tarafı`}
                  className="input-base w-auto min-w-[8rem] flex-1 py-2"
                />
                {soru.secenekler.length > 2 ? (
                  <button onClick={() => secenekSil(i)} disabled={kilitli} className="btn-icon" aria-label="Çifti sil">
                    <Icon name="close" size={16} />
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      {/* ── sıralama maddeleri ──────────────────────────────────────────────── */}
      {siralama ? (
        <ol className="mt-3 space-y-2">
          {soru.secenekler.map((s, i) => (
            /* DAR EKRANDA SARAR. Satır tek sıraydı: numara + girdi + yukarı +
               aşağı + sil, 390px'te girdiye avuç içi kadar yer kalıyor ve
               taşıma düğmeleri birbirine giriyordu — "mobilde sıralamayı
               taşımak çok zor" tam olarak buydu. Sarınca metin tam genişlik
               alır, taşıma düğmeleri kendi satırına geçip sağa yaslanır. */
            <li key={`${i}:${s}`} className="flex flex-wrap items-center gap-2">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-flow-sm bg-accent-soft text-xs font-bold text-accent-dark">
                {i + 1}
              </span>
              <input
                defaultValue={s}
                onBlur={(e) => e.target.value !== s && secenekDegistir(i, e.target.value)}
                disabled={kilitli}
                placeholder={`${i + 1}. adım`}
                aria-label={`${i + 1}. adımın metni`}
                className="input-base w-auto min-w-0 flex-1 py-2 max-sm:w-[calc(100%-2.5rem)] max-sm:flex-none"
              />
              <div className="flex items-center gap-2 max-sm:ml-10 max-sm:w-full max-sm:justify-end">
              <button
                onClick={() => tasi(i, -1)}
                disabled={kilitli || i === 0}
                className="btn-icon"
                aria-label={`${i + 1}. adımı yukarı taşı`}
              >
                <Icon name="up" size={16} />
              </button>
              <button
                onClick={() => tasi(i, 1)}
                disabled={kilitli || i === soru.secenekler.length - 1}
                className="btn-icon"
                aria-label={`${i + 1}. adımı aşağı taşı`}
              >
                <Icon name="down" size={16} />
              </button>
              {soru.secenekler.length > 2 ? (
                <button onClick={() => secenekSil(i)} disabled={kilitli} className="btn-icon" aria-label="Adımı sil">
                  <Icon name="close" size={16} />
                </button>
              ) : null}
              </div>
            </li>
          ))}
        </ol>
      ) : null}

      {/* ── klasik şıklar (çoktan seçmeli · doğru-yanlış · çoklu · boşluk) ──── */}
      {dogruIsareti ? (
        <ul className="mt-3 space-y-2">
          {soru.secenekler.map((s, i) => (
            <li key={`${i}:${s}`} className="flex items-center gap-2">
              <button
                onClick={() => dogruDegistir(i)}
                disabled={kilitli}
                aria-label={`${i + 1}. şıkkı doğru işaretle`}
                aria-pressed={soru.dogru.includes(i)}
                className={`grid h-8 w-8 shrink-0 place-items-center border-2 transition ${
                  cokluSecim ? "rounded-flow-sm" : "rounded-full"
                } ${soru.dogru.includes(i) ? "border-iyi bg-iyi text-white" : "border-line text-transparent hover:border-muted"}`}
              >
                <Icon name="check" size={16} />
              </button>
              <input
                defaultValue={s}
                onBlur={(e) => e.target.value !== s && secenekDegistir(i, e.target.value)}
                readOnly={sabitSecenek}
                disabled={kilitli}
                placeholder={bosluk ? `${i + 1}. şık (boşluğa gelecek söz)` : `${i + 1}. şık`}
                className={`input-base py-2 ${sabitSecenek ? "bg-paper text-muted" : ""}`}
              />
              {!sabitSecenek && soru.secenekler.length > 2 ? (
                <button onClick={() => secenekSil(i)} disabled={kilitli} className="btn-icon" aria-label="Şıkkı sil">
                  <Icon name="close" size={16} />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {/* Bölgeler çizilerek eklenir; sabit şıklı tipte eklenecek bir şey yok. */}
      {!sabitSecenek && !bolgeli ? (
        <button onClick={secenekEkle} disabled={kilitli} className="btn-ghost mt-3 text-sm">
          <Icon name="plus" size={16} /> {eslestirme ? "Çift ekle" : siralama ? "Adım ekle" : "Şık ekle"}
        </button>
      ) : null}

      {/* ── açıklama ────────────────────────────────────────────────────────
          SINAV ÖĞRETMENİN YERİNE GEÇER: yanlış cevaplayan kişi neyi kaçırdığını
          orada öğrenmezse ikinci denemede aynı şıkka basar. İki cümle yeter —
          uzun açıklama kioskta okunmuyor. */}
      <label className="mt-4 block">
        <span className="mb-1.5 block text-xs font-semibold text-muted">
          Yanlış cevaplayana gösterilecek açıklama (isteğe bağlı)
        </span>
        <OtoMetin
          disabled={kilitli}
          defaultValue={soru.aciklama ?? ""}
          onBlur={(e) => e.target.value !== (soru.aciklama ?? "") && onGuncelle(soru.id, { aciklama: e.target.value })}
          rows={2}
          placeholder="Doğrusu neden doğru? Tek cümle."
          className="input-base"
        />
      </label>

      {/* ── soru görseli ────────────────────────────────────────────────────
          "Bu fotoğraftaki hangi davranış yanlış?" sorusu metinle sorulamıyordu;
          soru görseli olmayınca hazırlayan soruyu kartın içine yazıyordu ve
          sınav diye bir şey kalmıyordu. */}
      {!bolgeli ? gorselBlogu : null}

      {secici ? (
        <MedyaSecici
          tur="gorsel"
          medyalar={medyalar}
          onMedyaSil={onMedyaSil}
          onAltMetin={onAltMetin}
          onKapat={() => setSecici(false)}
          onSec={(id) => {
            setSecici(false);
            onGuncelle(soru.id, { gorselId: id });
          }}
        />
      ) : null}
    </div>
  );
}

/**
 * İmlecin durduğu yere `___` yazar ve YENİ metni döndürür.
 *
 * MODÜL SEVİYESİNDE: CLAUDE.md'deki küçültücü tuzağı (parametre yakalayıp
 * birden çok kez çağrılan yardımcı) burada da mümkündü.
 *
 * `OtoMetin` denetimsiz olduğu için DOM değerini elle yazıyoruz; yükseklik
 * ölçümü `onInput`ta yapıldığından olayı da elle doğurmak gerekiyor, yoksa
 * kutu uzayan metinle birlikte büyümüyor.
 */
function bosluguYerlestir(alan: HTMLTextAreaElement): string {
  const bas = alan.selectionStart ?? alan.value.length;
  const son = alan.selectionEnd ?? bas;
  const yeni = `${alan.value.slice(0, bas)}___${alan.value.slice(son)}`;
  alan.value = yeni;
  alan.focus();
  alan.setSelectionRange(bas + 3, bas + 3);
  alan.dispatchEvent(new Event("input", { bubbles: true }));
  return yeni;
}

/** `memo`: gerekçesi `SayfaSatiri`daki ile aynı — ölçüm oradaki notta. */
const SoruSatiri = memo(SoruSatiriIc);
export default SoruSatiri;
