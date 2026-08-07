"use client";

import { useEffect, useRef, useState } from "react";
import Logo from "@/components/Logo";
import Icon from "@/components/Icon";
import EgitimOyun, { type OyunSonucu } from "@/components/oyun/EgitimOyun";
import { siciliAra, oturumBaslat, oturumTamamla, type KioskDurum, type OyunVerisi } from "./eylemler";
import { DURUM_ETIKET, type AtamaDurumu } from "@/lib/kurallar";

/**
 * KİOSK — hattaki tablette sürekli açık kalan yüzey.
 *
 * Tasarım kısıtları kokpitten farklı: ayakta, eldivenle, bir metre uzaktan,
 * acele ile kullanılır. Bu yüzden 72px dokunma hedefi, büyük punto, ekranda
 * en fazla birkaç seçenek ve HER ekranda tek bir sonraki adım.
 *
 * Kart okuyucular klavye gibi davranır (keyboard wedge): kartı okutunca
 * rakamları yazıp Enter'a basar. Bu yüzden sicil alanı HEP odakta durur —
 * kimse önce alana dokunmak zorunda kalmasın.
 */
type Ekran = "giris" | "liste" | "oyun" | "bitti";

export default function Kiosk() {
  const [ekran, setEkran] = useState<Ekran>("giris");
  const [sicil, setSicil] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [durum, setDurum] = useState<KioskDurum | null>(null);
  const [veri, setVeri] = useState<OyunVerisi | null>(null);
  const [mesgul, setMesgul] = useState(false);
  const girdi = useRef<HTMLInputElement>(null);
  const kilit = useRef(false);

  useEffect(() => {
    if (ekran === "giris") girdi.current?.focus();
  }, [ekran]);

  /* Kimse kiosk'u yarım bırakılmış hâlde bulmasın: kişi ekranda unutulursa
     90 saniye sonra başa döner. Oyun sırasında ÇALIŞMAZ — eğitim izleyen
     kişinin ekranı sıfırlanamaz. */
  useEffect(() => {
    if (ekran !== "liste" && ekran !== "bitti") return;
    const t = setTimeout(() => basaDon(), 90_000);
    return () => clearTimeout(t);
  }, [ekran]);

  function basaDon() {
    setEkran("giris");
    setSicil("");
    setDurum(null);
    setVeri(null);
    setHata(null);
  }

  async function ara(e?: React.FormEvent) {
    e?.preventDefault();
    if (kilit.current) return;
    kilit.current = true;
    setMesgul(true);
    setHata(null);

    const c = await siciliAra(sicil);
    kilit.current = false;
    setMesgul(false);

    if (c.hata) {
      setHata(c.hata);
      setSicil("");
      girdi.current?.focus();
      return;
    }
    setDurum(c.durum!);
    setEkran("liste");
  }

  async function basla(egitimId: string) {
    if (kilit.current || !durum) return;
    kilit.current = true;
    setMesgul(true);
    setHata(null);

    const c = await oturumBaslat(durum.kisi.sicil, egitimId);
    kilit.current = false;
    setMesgul(false);

    if (c.hata) return setHata(c.hata);
    setVeri(c.veri!);
    setEkran("oyun");
  }

  async function bitir(sonuc: OyunSonucu) {
    if (!veri) return { hata: "Oturum kayboldu." };
    return oturumTamamla(veri.oturumId, sonuc);
  }

  if (ekran === "oyun" && veri && durum) {
    return (
      <EgitimOyun
        egitim={veri.egitim}
        sayfalar={veri.sayfalar}
        sorular={veri.sorular}
        oturumId={veri.oturumId}
        kisiAdi={durum.kisi.ad}
        pinKurulacak={veri.pinKurulacak}
        iseGirisSorulacak={veri.iseGirisSorulacak}
        sinavHazir
        onBitir={bitir}
        onCik={basaDon}
      />
    );
  }

  return (
    <main className="bg-wash grid min-h-screen place-items-center px-5 py-10">
      <div className="w-full max-w-xl">
        {ekran === "giris" ? (
          <>
            <div className="mb-10 text-center">
              <Logo size="lg" />
              <p className="mt-4 text-xl text-muted">Kartınızı okutun veya sicil numaranızı yazın</p>
            </div>

            <form onSubmit={ara} className="card p-6 sm:p-8">
              <input
                ref={girdi}
                value={sicil}
                onChange={(e) => setSicil(e.target.value)}
                inputMode="numeric"
                autoComplete="off"
                aria-label="Sicil numarası"
                placeholder="Sicil no"
                className="input-base text-center text-4xl font-bold tracking-widest"
                /* Odağı geri çek — AMA yalnız odak sayfanın dışına kaçtığında.
                   Kart okuyucu tuş vuruşlarını odaklı alana gönderir, odak
                   kaçarsa okutma "çalışmıyor" görünür. Koşulsuz geri çekmek
                   ise klavyeyle "Devam" düğmesine ulaşmayı İMKÂNSIZ kılıyordu
                   (Tab'a basan kişi tek düğmeye hiç varamıyordu). */
                onBlur={(e) => {
                  const hedef = e.relatedTarget as HTMLElement | null;
                  if (hedef) return;
                  setTimeout(() => girdi.current?.focus(), 50);
                }}
              />
              <button type="submit" disabled={mesgul || !sicil.trim()} className="kiosk-btn-primary mt-6">
                {mesgul ? "Bakılıyor…" : "Devam"} <Icon name="chevronRight" size={24} />
              </button>
            </form>

            {hata ? (
              <p role="alert" className="mt-6 rounded-2xl border-2 border-brand/30 bg-brand-soft px-6 py-5 text-center text-lg font-semibold text-brand-dark">
                {hata}
              </p>
            ) : null}
          </>
        ) : null}

        {ekran === "liste" && durum ? (
          <>
            <div className="mb-8">
              <p className="text-lg text-muted">Merhaba</p>
              <h1 className="text-4xl font-extrabold">{durum.kisi.ad}</h1>
              <p className="mt-2 text-muted">
                Sicil {durum.kisi.sicil}
                {durum.kisi.bolum ? ` · ${durum.kisi.bolum}` : ""}
              </p>
            </div>

            {durum.bekleyenler.length === 0 ? (
              <div className="card p-8 text-center">
                <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-iyi/10 text-iyi-dark">
                  <Icon name="check" size={40} />
                </span>
                <h2 className="mt-5 text-2xl font-extrabold">Bekleyen eğitiminiz yok</h2>
                <p className="mt-2 text-muted">
                  {durum.tamamlanan > 0 ? `Şimdiye kadar ${durum.tamamlanan} eğitim tamamladınız.` : "Her şey güncel."}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {durum.bekleyenler.map((b) => (
                  <button
                    key={b.egitim.id}
                    onClick={() => basla(b.egitim.id)}
                    disabled={mesgul}
                    className="kiosk-secenek flex-col items-start gap-2 sm:flex-row sm:items-center"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-xl font-bold">{b.egitim.ad}</span>
                      <span className="mt-1 block text-base font-normal text-muted">
                        {DURUM_ETIKET[b.durum as AtamaDurumu]}
                        {b.sonTarih ? ` · son tarih ${b.sonTarih}` : ""}
                      </span>
                    </span>
                    {/* Kokpit sınıfı DEĞİL: satırın tamamı zaten 72px'lik
                        dokunma hedefi; buradaki öğe yalnız görsel ipucudur ve
                        düğme gibi görünüp küçük kalmamalı. */}
                    <span className="flex shrink-0 items-center gap-2 text-lg font-bold text-accent">
                      Başla <Icon name="play" size={22} />
                    </span>
                  </button>
                ))}
              </div>
            )}

            {hata ? (
              <p role="alert" className="mt-6 rounded-2xl border-2 border-brand/30 bg-brand-soft px-6 py-5 text-center text-lg font-semibold text-brand-dark">
                {hata}
              </p>
            ) : null}

            <button onClick={basaDon} className="kiosk-btn-ghost mt-8">
              <Icon name="close" size={22} /> Bitir
            </button>
          </>
        ) : null}
      </div>
    </main>
  );
}
