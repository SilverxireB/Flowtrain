"use client";

import { memo, useRef, useState } from "react";
import Icon from "@/components/Icon";
import KartAlanlari from "@/components/editor/KartAlanlari";
import { KartTipiRozeti } from "@/components/editor/KartTipiMenusu";
import MedyaSecici from "@/components/editor/MedyaSecici";
import CanliOnizleme from "@/components/editor/CanliOnizleme";
import { gorselYamasi, kartGorselleri, type MedyaOzet } from "@/lib/editorMedya";
import { ASGARI_SURE_VARSAYILAN, KART_ACIKLAMA, KART_ETIKET, type KartTipi, type Sayfa } from "@/lib/tipler";

/**
 * Editördeki tek sayfa satırı.
 *
 * Hazırlayan yalnız METİN yazar ve GÖRSEL seçer; yerleşim, tipografi ve renk
 * ürüne aittir. Serbest tuval vermemenin sebebi kalite: boş tuval verilen her
 * araçta içerik ikinci haftada dağılır.
 *
 * TİPE ÖZEL ALANLAR AYRI DOSYADA (`KartAlanlari`): on kart tipinin alanları
 * buraya sığdırılsaydı satır bileşeni bir tip anahtarına dönüşür, ortak kısım
 * (başlık, kopyalama, süre, medya seçici) onun içinde kaybolurdu. Bu dosya
 * "her kartta olan" şeyleri tutar.
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
 *
 * GERİ ÇAĞRILAR SAYFA KİMLİĞİNİ ALIR (`onGuncelle(sayfa.id, yama)`), satıra
 * özel kapanışlar DEĞİL. Sebebi başarım: kapanış her çizimde yeniden üretilir,
 * `memo` de her satırı "değişti" sayardı. Ölçüldü — 40 kart + 20 soruluk bir
 * eğitimde tek tuş vuruşu bütün satırları yeniden çiziyor ve 20–30 ms sürüyordu
 * (tuş başına 16 ms bütçenin üstü, yani yazarken görünür takılma); tek satırın
 * çizimi 0,3–0,4 ms. Kimlik geçmek satır API'sini biraz gürültülü yapıyor,
 * karşılığında editör kırk kartta da akıcı kalıyor.
 */
function SayfaSatiriIc({
  sayfa,
  sira,
  toplam,
  secili,
  medyalar,
  altMetinler,
  hedefEgitimler,
  onGuncelle,
  onAnlik,
  onSil,
  onTasi,
  onSec,
  onCogalt,
  onKopyala,
  onMedyaSil,
  onAltMetin,
  kilitli,
}: {
  sayfa: Sayfa;
  sira: number;
  toplam: number;
  /** Yandaki önizlemede gösterilen kart bu mu? */
  secili: boolean;
  medyalar: MedyaOzet[];
  /** Medya kimliği → yazılmış alt metin. Boşsa kart başlığından türetilen kullanılır. */
  altMetinler: Record<string, string>;
  /** Kartın kopyalanabileceği diğer TASLAK eğitimler. */
  hedefEgitimler: { id: string; ad: string }[];
  /** Yayındaki eğitim salt okunur — sunucu da reddeder. */
  kilitli?: boolean;
  onGuncelle: (sayfaId: string, yama: Record<string, unknown>) => void;
  onAnlik: (sayfaId: string, yama: Record<string, unknown>) => void;
  onSil: (sayfaId: string) => void;
  onTasi: (sayfaId: string, yon: -1 | 1) => void;
  onSec: (sayfaId: string) => void;
  onCogalt: (sayfaId: string) => void;
  onKopyala: (sayfaId: string, hedefId: string) => void;
  onMedyaSil: (medyaId: string) => void;
  onAltMetin: (medyaId: string, altMetin: string) => void;
}) {
  /* `once`/`sonra`: aynı seçici, ama gelen görsel listenin BELİRLİ bir yuvasına
     yazılır (önce/sonra kartı). Ayrı bir seçici bileşeni açmak, kütüphaneyi ve
     yükleme akışını ikiye bölerdi. */
  const [secici, setSecici] = useState<"gorsel" | "video" | "once" | "sonra" | null>(null);
  const [kopyaAcik, setKopyaAcik] = useState(false);
  /** Bu kartın KENDİ önizlemesi açık mı (kart içinde, yerinde). */
  const [onizleme, setOnizleme] = useState(false);
  const [hedef, setHedef] = useState("");
  /** Tip değiştirildiğinde önceki değerler — uyarı satırındaki "Geri al" bunu kullanır. */
  const [oncekiTip, setOncekiTip] = useState<{ tip: KartTipi; asgariSure: number } | null>(null);
  /** Alana girildiği andaki değer — kaydetme kararı buna bakar (üstteki nota bkz). */
  const odakDegeri = useRef("");

  const video = sayfa.tip === "video";
  const gorseller = kartGorselleri(sayfa);

  function yaz(yama: Record<string, unknown>) {
    onAnlik(sayfa.id, yama);
    onGuncelle(sayfa.id, yama);
  }

  function gorselleriYaz(idler: string[]) {
    yaz(gorselYamasi(idler));
  }

  /**
   * TİP DEĞİŞTİRİLEBİLİR. Yanlış tiple açılmış bir kartı düzeltmenin tek yolu
   * silip yeniden yazmaktı; alanlar aynı sütunlarda durduğu için (`kartVeri.ts`)
   * veri taşımaya gerek yok.
   *
   * ASGARİ SÜRE YALNIZ DOKUNULMAMIŞSA TAŞINIR: elle 30 sn yazmış birinin ayarını
   * ezmek sahtecilik önlemini sessizce zayıflatırdı; ama videodan (0 sn) başka
   * bir tipe geçen kart 0 sn'de kalsaydı okumadan geçilebilirdi.
   */
  function tipDegistir(yeni: KartTipi) {
    const yama: Record<string, unknown> = { tip: yeni };
    if (sayfa.asgariSure === ASGARI_SURE_VARSAYILAN[sayfa.tip]) yama.asgariSure = ASGARI_SURE_VARSAYILAN[yeni];
    setOncekiTip({ tip: sayfa.tip, asgariSure: sayfa.asgariSure });
    yaz(yama);
  }

  return (
    <div
      onFocusCapture={() => onSec(sayfa.id)}
      onClick={() => onSec(sayfa.id)}
      className={`card p-4 transition-shadow ${secili ? "border-accent/50 ring-4 ring-accent-soft" : ""}`}
    >
      {/* DAR EKRANDA SARAR: beş simge düğmesi + sıra + tip rozeti 390px'e
          sığmıyor ve satır kartı, kart da sayfayı taşırıyordu. */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-line text-xs font-bold text-muted">
          {sira}
        </span>
        <KartTipiRozeti tip={sayfa.tip} kilitli={kilitli} onDegis={tipDegistir} />
        <div className="flex-1" />

        {/* Eylemler TEK kapta: dar ekranda beş simge sıra+tip rozetiyle aynı
            satıra sığmıyor ve rasgele kırılıyordu. Kırılacaksa BİLİNÇLİ
            kırılsın — kendi satırına geçip sağa yaslansın. */}
        <div className="flex items-center gap-2 max-sm:w-full max-sm:justify-end">
        {/* TEKİL ÖNİZLEME: kartın kendi önizlemesi, kartın İÇİNDE.
            Alttaki şerit "şu an hangi karttayım"ı sürekli gösteriyor; bu düğme
            "şu kart sahada nasıl duruyor" sorusuna yerinde cevap veriyor —
            kaydırmadan, başka bir yüzeye gitmeden. */}
        <button
          onClick={() => setOnizleme((a) => !a)}
          aria-expanded={onizleme}
          className={`btn-icon ${onizleme ? "bg-accent-soft text-accent" : ""}`}
          aria-label={onizleme ? "Önizlemeyi kapat" : "Bu kartı önizle"}
          title="Bu kartın kioskta nasıl görüneceği"
        >
          <Icon name="monitor" size={16} />
        </button>
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
        <button
          onClick={() => onTasi(sayfa.id, -1)}
          disabled={kilitli || sira === 1}
          className="btn-icon"
          aria-label="Yukarı taşı"
        >
          <Icon name="up" size={16} />
        </button>
        <button
          onClick={() => onTasi(sayfa.id, 1)}
          disabled={kilitli || sira === toplam}
          className="btn-icon"
          aria-label="Aşağı taşı"
        >
          <Icon name="down" size={16} />
        </button>
        <button
          onClick={() => onSil(sayfa.id)}
          disabled={kilitli}
          className="btn-icon hover:text-brand"
          aria-label="Sayfayı sil"
        >
          <Icon name="trash" size={16} />
        </button>
        </div>
      </div>

      <p className="mt-1 hidden pl-9 text-xs text-muted sm:block">{KART_ACIKLAMA[sayfa.tip]}</p>

      {/* TİP DEĞİŞİMİ SESSİZ OLMAZ: veri kaybolmuyor ama yeni tipin okumadığı
          alan kartta görünmez oluyor — bu, "yazdığım ders nereye gitti?"
          sorusunun tek uyarısı. Geri alma da burada: yanlış tiki fark eden kişi
          menüyü yeniden açıp doğru tipi hatırlamak zorunda kalmasın. */}
      {oncekiTip && !kilitli ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-orta/30 bg-orta/5 px-3 py-2 text-xs text-orta-dark">
          <Icon name="warning" size={14} />
          <span className="min-w-0 flex-1">
            <strong>{KART_ETIKET[oncekiTip.tip]}</strong> → <strong>{KART_ETIKET[sayfa.tip]}</strong>. Yazdıklarınız
            duruyor; yeni tipin kullanmadığı metin kartta görünmez.
          </span>
          <button
            onClick={() => {
              yaz({ tip: oncekiTip.tip, asgariSure: oncekiTip.asgariSure });
              setOncekiTip(null);
            }}
            className="font-semibold underline underline-offset-2"
          >
            Geri al
          </button>
          <button onClick={() => setOncekiTip(null)} className="btn-icon h-6 w-6" aria-label="Uyarıyı kapat">
            <Icon name="close" size={12} />
          </button>
        </div>
      ) : null}

      {kopyaAcik && !kilitli ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-paper p-3">
          <button
            onClick={() => {
              setKopyaAcik(false);
              onCogalt(sayfa.id);
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
                  onKopyala(sayfa.id, hedef);
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
          onChange={(e) => onAnlik(sayfa.id, { baslik: e.target.value })}
          onBlur={(e) => e.target.value !== odakDegeri.current && onGuncelle(sayfa.id, { baslik: e.target.value })}
          placeholder="Başlık"
          className="input-base font-semibold"
        />

        <KartAlanlari
          sayfa={sayfa}
          kilitli={kilitli}
          gorseller={gorseller}
          altMetinler={altMetinler}
          odakDegeri={odakDegeri}
          onAnlik={(yama) => onAnlik(sayfa.id, yama)}
          onGuncelle={(yama) => onGuncelle(sayfa.id, yama)}
          onGorselleriYaz={gorselleriYaz}
          onYuvaSec={(yuva) => setSecici(yuva === 0 ? "once" : "sonra")}
          onAltMetin={onAltMetin}
        />

        <div className="flex flex-wrap items-center gap-3">
          {/* Önce/sonra kartında görseller kendi yuvalarından seçilir; buradaki
              genel düğme "hangi yuvaya gitti?" sorusunu doğurdu. */}
          {sayfa.tip === "onceSonra" ? null : (
            <button
              onClick={() => setSecici(video ? "video" : "gorsel")}
              disabled={kilitli}
              className="btn-ghost text-sm"
            >
              <Icon name={video ? "video" : "image"} size={16} />
              {video
                ? sayfa.videoId
                  ? "Videoyu değiştir"
                  : "Video ekle"
                : gorseller.length > 0
                  ? "Görsel ekle"
                  : "Görsel seç"}
            </button>
          )}

          {video && sayfa.videoId ? (
            <>
              <span className="chip text-xs">
                <Icon name="check" size={14} /> Video eklendi
              </span>
              <button
                onClick={() => yaz({ videoId: null })}
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
                bilinçli: hazırlayan videonun uzunluğuna göre ayarlayabilmeli.

                `key` TİPE BAĞLI: alan denetimsiz, tip değişince varsayılan süre
                yenilenince kutuda eski sayı kalırdı (kayıtta yeni değer, ekranda
                eski değer — hangisinin doğru olduğu görünmezdi). */}
            En az
            <input
              key={sayfa.tip}
              type="number"
              min={0}
              disabled={kilitli}
              defaultValue={sayfa.asgariSure}
              onFocus={(e) => (odakDegeri.current = e.target.value)}
              onChange={(e) => onAnlik(sayfa.id, { asgariSure: Number(e.target.value) })}
              onBlur={(e) =>
                e.target.value !== odakDegeri.current && onGuncelle(sayfa.id, { asgariSure: Number(e.target.value) })
              }
              className="input-base w-20 px-2 py-1 text-center"
            />
            sn ekranda kalsın
          </label>
        </div>
      </div>

      {onizleme ? (
        <div className="mt-4 border-t border-line pt-4">
          <CanliOnizleme sayfa={sayfa} sira={sira} toplam={toplam} altMetinler={altMetinler} />
        </div>
      ) : null}

      {secici ? (
        <MedyaSecici
          tur={secici === "video" ? "video" : "gorsel"}
          medyalar={medyalar}
          onMedyaSil={onMedyaSil}
          onAltMetin={onAltMetin}
          onKapat={() => setSecici(null)}
          onSec={(id) => {
            const hangi = secici;
            setSecici(null);
            if (hangi === "video") {
              yaz({ videoId: id });
              return;
            }
            if (hangi === "once" || hangi === "sonra") {
              const yeni = [...gorseller];
              yeni[hangi === "once" ? 0 : 1] = id;
              gorselleriYaz(yeni.filter(Boolean));
              return;
            }
            // Aynı görseli iki kez eklemek kartta iki kez çizerdi.
            gorselleriYaz(gorseller.includes(id) ? gorseller : [...gorseller, id]);
          }}
        />
      ) : null}
    </div>
  );
}

/**
 * `memo`: kırk kartlık eğitimde her tuş vuruşu bütün satırları yeniden
 * çiziyordu (ölçüm için üstteki nota bkz.). Editör geri çağrıları kararlı
 * olduğu için sığ karşılaştırma yeterli — düzenlenen satır dışındakilerin
 * props'u hiç değişmiyor.
 */
const SayfaSatiri = memo(SayfaSatiriIc);
export default SayfaSatiri;
