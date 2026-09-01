"use client";

import { useEffect, useRef, useState } from "react";
import Logo from "@/components/Logo";
import Icon from "@/components/Icon";
import EgitimOyun, { type OyunSonucu } from "@/components/oyun/EgitimOyun";
import KioskBekci from "@/components/oyun/KioskBekci";
import { siciliAra, oturumBaslat, oturumTamamla, type KioskDurum, type OyunVerisi } from "./eylemler";
import { kioskAcilisi, KIOSK_SONUC_OTO_SN } from "@/lib/kioskAkis";
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
 *
 * DOKUNUŞ BÜTÇESİ (teslim ölçütü: hiçbir akış 3 dokunuştan uzun değil):
 *   Devam → Başla → Onayla ve bitir  = 3   (sonuç ekranı kendi kapanır)
 *   QR ile gelindiğinde "Başla" düşer = 2
 * İçerik sayfalarını ilerletmek bu bütçeye girmez: o akış değil, okumanın
 * kendisi.
 *
 * QR SÖZLEŞMESİ (Hat B): asılı etiketin içeriği `/kiosk?egitim=<egitimId>`.
 * İşçi istasyonun başında okutur, sicilini girer ve eğitim DOĞRUDAN açılır.
 * İş başı eğitiminin dijitalleşmesinin anahtarı bu adım — arada bir liste
 * ekranı olsaydı işçi yine "hangisiydi" diye bakmak zorunda kalırdı.
 */
type Ekran = "giris" | "liste" | "oyun";

export default function Kiosk({
  hedef,
  hedefGecersiz = false,
}: {
  /** QR'dan gelen eğitim (yayında ve gerçekten var olan). */
  hedef?: { id: string; ad: string } | null;
  /** QR bir eğitim işaret etti ama o eğitim silinmiş / yayında değil. */
  hedefGecersiz?: boolean;
}) {
  const [ekran, setEkran] = useState<Ekran>("giris");
  const [sicil, setSicil] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [bilgi, setBilgi] = useState<string | null>(null);
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
    if (ekran !== "liste") return;
    const t = setTimeout(() => basaDon(), 90_000);
    return () => clearTimeout(t);
  }, [ekran]);

  function basaDon() {
    setEkran("giris");
    setSicil("");
    setDurum(null);
    setVeri(null);
    setHata(null);
    setBilgi(null);
  }

  async function ara(e?: React.FormEvent) {
    e?.preventDefault();
    if (kilit.current) return;
    kilit.current = true;
    setMesgul(true);
    setHata(null);
    setBilgi(null);

    /* AĞ KOPARSA KİLİT AÇILMALI: sunucu eylemi reddedilince eskiden
       `kilit.current = false` satırına hiç gelinmiyordu ve kiosk sessizce
       ölüyordu — "Devam"a basan işçi hiçbir şey olmadığını görüyor, tek çare
       tableti yeniden başlatmak oluyordu. */
    let c: Awaited<ReturnType<typeof siciliAra>>;
    try {
      c = await siciliAra(sicil);
    } catch {
      kilit.current = false;
      setMesgul(false);
      setHata("Bağlantı kurulamadı. Birkaç saniye sonra tekrar deneyin.");
      return;
    }
    kilit.current = false;
    setMesgul(false);

    if (c.hata) {
      setHata(c.hata);
      setSicil("");
      girdi.current?.focus();
      return;
    }

    const yeni = c.durum!;
    setDurum(yeni);

    /* QR ile gelindiyse liste ekranı ATLANIR. Atanmamışsa kapıyı sessizce
       kapatmayız: kişinin gerçek bekleyenlerini yine gösterip neden
       açılmadığını yazarız — istasyona kadar gelmiş olmasın. */
    const acilis = kioskAcilisi(
      hedef?.id ?? null,
      yeni.bekleyenler.map((b) => b.egitim.id),
    );
    if (acilis.tip === "basla") {
      setEkran("liste");
      void basla(acilis.egitimId, yeni);
      return;
    }
    if (acilis.tip === "atanmamis") {
      setBilgi(
        `“${hedef?.ad ?? "Bu eğitim"}” size atanmış görünmüyor. Aşağıda bekleyen eğitimleriniz var; ` +
          "bu istasyonun eğitimi gerekiyorsa amirinize başvurun.",
      );
    }
    setEkran("liste");
  }

  async function basla(egitimId: string, durumu?: KioskDurum) {
    const d = durumu ?? durum;
    if (kilit.current || !d) return;
    kilit.current = true;
    setMesgul(true);
    setHata(null);

    let c: Awaited<ReturnType<typeof oturumBaslat>>;
    try {
      c = await oturumBaslat(d.kisi.sicil, egitimId);
    } catch {
      kilit.current = false;
      setMesgul(false);
      setHata("Bağlantı kurulamadı. Birkaç saniye sonra tekrar deneyin.");
      return;
    }
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
      <>
        {/* Oyun sırasında bekçi YENİLEME YAPMAZ: yarım oturum ve kaybolmuş
            imza üretirdi. Wake Lock ve ağ şeridi çalışmaya devam eder. */}
        <KioskBekci mesgul />
        <EgitimOyun
          egitim={veri.egitim}
          sayfalar={veri.sayfalar}
          sorular={veri.sorular}
          altMetinler={veri.altMetinler}
          oturumId={veri.oturumId}
          kisiAdi={durum.kisi.ad}
          pinKurulacak={veri.pinKurulacak}
          iseGirisSorulacak={veri.iseGirisSorulacak}
          sinavHazir
          otoCikSn={KIOSK_SONUC_OTO_SN}
          onBitir={bitir}
          onCik={basaDon}
        />
      </>
    );
  }

  return (
    <main className="kiosk-olcek bg-wash grid min-h-screen place-items-center px-5 py-10">
      <KioskBekci />
      <div className="w-full max-w-xl">
        {ekran === "giris" ? (
          <>
            <div className="mb-10 text-center">
              <Logo size="lg" />
              {/* QR ile gelindiğinde hangi eğitimin açılacağı ÖNCEDEN yazılır:
                  kişi sicilini girmeden ne olacağını bilmeli. */}
              {hedef ? (
                <p className="mt-5 rounded-flow border-2 border-accent/30 bg-accent-soft px-5 py-4 text-xl font-bold text-accent-dark">
                  <Icon name="qr" size={22} className="mr-2 inline align-[-3px]" />
                  {hedef.ad}
                </p>
              ) : null}
              <p className="mt-4 text-xl text-muted">Kartınızı okutun veya sicil numaranızı yazın</p>
            </div>

            <form onSubmit={ara} className="card p-6 sm:p-8">
              <label htmlFor="kiosk-sicil" className="sr-only">
                Sicil numarası
              </label>
              <input
                id="kiosk-sicil"
                ref={girdi}
                value={sicil}
                onChange={(e) => setSicil(e.target.value)}
                inputMode="numeric"
                autoComplete="off"
                placeholder="Sicil no"
                className="input-base text-center text-4xl font-bold tracking-widest"
                /* Odağı geri çek — AMA yalnız odak sayfanın dışına kaçtığında.
                   Kart okuyucu tuş vuruşlarını odaklı alana gönderir, odak
                   kaçarsa okutma "çalışmıyor" görünür. Koşulsuz geri çekmek
                   ise klavyeyle "Devam" düğmesine ulaşmayı İMKÂNSIZ kılıyordu
                   (Tab'a basan kişi tek düğmeye hiç varamıyordu). */
                onBlur={(e) => {
                  const hedefOge = e.relatedTarget as HTMLElement | null;
                  if (hedefOge) return;
                  setTimeout(() => girdi.current?.focus(), 50);
                }}
              />
              <button type="submit" disabled={mesgul || !sicil.trim()} className="kiosk-btn-primary mt-6">
                {mesgul ? "Bakılıyor…" : hedef ? "Eğitimi aç" : "Devam"} <Icon name="chevronRight" size={24} />
              </button>
            </form>

            {hedefGecersiz ? (
              <p role="status" className="mt-6 rounded-flow border-2 border-orta/40 bg-orta/5 px-6 py-5 text-center text-lg font-semibold">
                Okuttuğunuz etiketin eğitimi şu anda yayında değil. Sicilinizi girin, bekleyen eğitimlerinizi
                gösterelim.
              </p>
            ) : null}

            {hata ? (
              <p role="alert" className="mt-6 rounded-flow border-2 border-brand/30 bg-brand-soft px-6 py-5 text-center text-lg font-semibold text-brand-dark">
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

            {/* QR'daki eğitim bu kişiye atanmamış — nazik açıklama, kapalı kapı
                değil. */}
            {bilgi ? (
              <p role="status" className="mb-6 rounded-flow border-2 border-orta/40 bg-orta/5 px-6 py-5 text-lg font-semibold">
                {bilgi}
              </p>
            ) : null}

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
              <p role="alert" className="mt-6 rounded-flow border-2 border-brand/30 bg-brand-soft px-6 py-5 text-center text-lg font-semibold text-brand-dark">
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
