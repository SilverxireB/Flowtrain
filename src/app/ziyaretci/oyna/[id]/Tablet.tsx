"use client";

import { useMemo, useState } from "react";
import Logo from "@/components/Logo";
import Icon from "@/components/Icon";
import EgitimOyun, { type OyunSonucu } from "@/components/oyun/EgitimOyun";
import KioskBekci from "@/components/oyun/KioskBekci";
import { bilgilendirmeBaslatEylem, bilgilendirmeTamamlaEylem } from "../../eylemler";
import type { Egitim, Sayfa } from "@/lib/tipler";

/**
 * ZİYARETÇİ TABLETİ AKIŞI.
 *
 * Bilgilendirmeler SIRAYLA akar; ziyaretçi hangisini izleyeceğini seçmez.
 * Seçtirmek, "genel bilgilendirmeyi atlayıp yükseklik olanı izleyeyim" demeye
 * açık kapı bırakırdı — ve sıra, kayıt ekranında zaten kurulmuş bir karardır.
 *
 * TAMAMLANANLAR ATLANIR: tablet kilitlenip yeniden açılırsa kaldığı yerden
 * devam eder. Ziyaretçinin deneme hakkı yok, ama izlediğini tekrar izletmek de
 * cezalandırmak olur.
 */
type Adim = { egitim: Egitim; sayfalar: Sayfa[]; bitti: boolean };

export default function Tablet({
  ziyaretciId,
  ziyaretciAdi,
  adimlar,
  altMetinler,
  bastanTamam,
}: {
  ziyaretciId: string;
  ziyaretciAdi: string;
  adimlar: Adim[];
  /** Görsel kimliği → hazırlayanın yazdığı alt metni; sunucuda süzülür. */
  altMetinler?: Record<string, string>;
  bastanTamam: boolean;
}) {
  const [bitenler, setBitenler] = useState<string[]>(() => adimlar.filter((a) => a.bitti).map((a) => a.egitim.id));
  const [oynanan, setOynanan] = useState<{ oturumId: string; adim: Adim } | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [mesgul, setMesgul] = useState(false);
  const [hepsiBitti, setHepsiBitti] = useState(bastanTamam);

  const kalanlar = useMemo(() => adimlar.filter((a) => !bitenler.includes(a.egitim.id)), [adimlar, bitenler]);
  const siradaki = kalanlar[0] ?? null;
  const biten = adimlar.length - kalanlar.length;

  async function basla() {
    if (!siradaki || mesgul) return;
    setMesgul(true);
    setHata(null);

    /* Ağ koparsa "Başla" ölmemeli: eskiden sunucu eylemi reddedilince
       `setMesgul(false)` satırına hiç gelinmiyor, düğme sonsuza kadar
       "Açılıyor…" kalıyordu. */
    let c: Awaited<ReturnType<typeof bilgilendirmeBaslatEylem>>;
    try {
      c = await bilgilendirmeBaslatEylem(ziyaretciId, siradaki.egitim.id);
    } catch {
      setMesgul(false);
      return setHata("Bağlantı kurulamadı. Birkaç saniye sonra tekrar deneyin.");
    }
    setMesgul(false);
    if (c.hata) return setHata(c.hata);
    setOynanan({ oturumId: c.oturumId!, adim: siradaki });
  }

  async function bitir(sonuc: OyunSonucu) {
    if (!oynanan) return { hata: "Oturum kayboldu." };
    const c = await bilgilendirmeTamamlaEylem(oynanan.oturumId, sonuc.sayfaSureleri);
    if (c.hata) return { hata: c.hata };
    // Sonuç ekranı oynatıcıda çizilir; listeyi burada ilerletiriz.
    setBitenler((b) => [...new Set([...b, oynanan.adim.egitim.id])]);
    if (c.tamamlandi) setHepsiBitti(true);
    return { gecti: true, puan: 100 };
  }

  if (oynanan) {
    const kalanSonra = kalanlar.filter((a) => a.egitim.id !== oynanan.adim.egitim.id).length;
    return (
      <>
        {/* Ziyaretçi tableti de gün boyu açık kalır: ekran uyumasın, ağ
            koptuğunda sebep yazsın. Bilgilendirme sırasında YENİLEME YOK. */}
        <KioskBekci mesgul />
        <EgitimOyun
          key={oynanan.oturumId}
          egitim={oynanan.adim.egitim}
          sayfalar={oynanan.adim.sayfalar}
          sorular={[]}
          altMetinler={altMetinler}
          sinavHazir
          oturumId={oynanan.oturumId}
          kisiAdi={ziyaretciAdi}
          imzaKipi="onay"
          bitirEtiketi="Tamamla"
          cikEtiketi={kalanSonra > 0 ? "Sıradaki bilgilendirme" : "Bitir"}
          onBitir={bitir}
          onCik={() => setOynanan(null)}
        />
      </>
    );
  }

  return (
    <main className="kiosk-olcek bg-wash grid min-h-screen place-items-center px-5 py-10">
      <KioskBekci />
      <div className="w-full max-w-xl">
        <div className="mb-8 text-center">
          <Logo size="lg" />
        </div>

        {hepsiBitti ? (
          <div className="card p-8 text-center">
            <span className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-iyi/10 text-iyi-dark">
              <Icon name="check" size={48} />
            </span>
            <h1 className="mt-6 text-3xl font-extrabold">Bilgilendirme tamamlandı</h1>
            <p className="mt-3 text-xl text-muted">
              Teşekkürler <strong className="text-ink">{ziyaretciAdi}</strong>. Sahaya girebilirsiniz.
            </p>
            <p className="mt-6 rounded-flow border border-line bg-paper px-5 py-4 text-lg">
              Tableti kayıt masasına geri verin.
            </p>
            <ul className="mt-6 space-y-2 text-left">
              {adimlar.map((a) => (
                <li key={a.egitim.id} className="flex items-center gap-2 text-muted">
                  <Icon name="check" size={18} className="shrink-0 text-iyi-dark" />
                  <span className="text-base">{a.egitim.ad}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <>
            <div className="mb-8 text-center">
              <p className="text-lg text-muted">Hoş geldiniz</p>
              <h1 className="mt-1 text-4xl font-extrabold">{ziyaretciAdi}</h1>
              <p className="mt-3 text-lg text-muted">
                Sahaya girmeden önce {adimlar.length} bilgilendirme izlemeniz gerekiyor.
              </p>
            </div>

            <ol className="space-y-3">
              {adimlar.map((a, i) => {
                const tamam = bitenler.includes(a.egitim.id);
                const simdiki = siradaki?.egitim.id === a.egitim.id;
                return (
                  <li
                    key={a.egitim.id}
                    className={`card flex items-center gap-4 p-5 ${simdiki ? "border-accent" : ""} ${
                      tamam ? "opacity-60" : ""
                    }`}
                  >
                    <span
                      className={`grid h-12 w-12 shrink-0 place-items-center rounded-full text-lg font-bold ${
                        tamam ? "bg-iyi/10 text-iyi-dark" : simdiki ? "bg-accent text-white" : "bg-line text-muted"
                      }`}
                    >
                      {tamam ? <Icon name="check" size={24} /> : i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xl font-bold">{a.egitim.ad}</span>
                      <span className="mt-0.5 block text-base text-muted">
                        {tamam ? "Tamamlandı" : simdiki ? "Sıradaki" : "Bekliyor"} · {a.sayfalar.length} sayfa
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>

            {hata ? (
              <p role="alert" className="mt-6 rounded-flow border-2 border-brand/30 bg-brand-soft px-6 py-5 text-center text-lg font-semibold text-brand-dark">
                {hata}
              </p>
            ) : null}

            <button onClick={basla} disabled={mesgul || !siradaki} className="kiosk-btn-primary mt-8">
              <Icon name="play" size={24} />
              {mesgul ? "Açılıyor…" : biten > 0 ? "Kaldığım yerden devam et" : "Başla"}
            </button>

            <p className="mt-6 text-center text-base text-muted">
              {biten}/{adimlar.length} tamamlandı
            </p>
          </>
        )}
      </div>
    </main>
  );
}
