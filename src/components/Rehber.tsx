"use client";

/**
 * Flow Studio ÇEKİRDEK rehber çekmecesi — "?" ile açılan yardım.
 *
 * NEDEN SAYFA DEĞİL ÇEKMECE (kullanıcı kararı): yardım aranan an, iş yapılan
 * andır. Ayrı sayfaya gitmek editörden çıkmak demek; dönünce nerede kaldığını
 * yeniden bulman gerekir. Çekmece açılır, adımı yanındaki gerçek ekranda
 * uygularsın, kapatırsın.
 *
 * NEDEN EKRAN GÖRÜNTÜSÜ YOK: rehber içeriği CANLI bileşenlerle ve ürünün kendi
 * sınıflarıyla yazılır (`btn-primary`, `card`, `Icon`…). Tasarım değişince
 * rehberdeki görüntü de kendiliğinden değişir — eskimiş ekran görüntüsü diye
 * bir şey olmaz. Yalnız BİZİM OLMAYAN yüzeyler (Windows güç ayarı, ekran kartı
 * paneli) gerçek ekran görüntüsü ister; onlar zaten biz tasarım değiştirince
 * değişmiyor.
 *
 * Derin link: `bolum` verilirse çekmece o başlıkta açılır. Hata şeritleri bunu
 * kullanır — "bu alan bölünemez" uyarısı doğrudan "Yerleşim" başlığını açar.
 */
import { ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/Icon";

export interface RehberBolum {
  id: string;
  /** Üstteki küçük etiket ("KURULUM") — bölümün ne tür bilgi olduğunu söyler. */
  kicker: string;
  baslik: string;
  icerik: ReactNode;
}

export default function Rehber({
  baslik,
  altBaslik,
  bolumler,
  bolum,
  onClose,
}: {
  baslik: string;
  altBaslik?: string;
  bolumler: RehberBolum[];
  /** Açılışta kaydırılacak bölüm kimliği (derin link); yoksa baştan başlar. */
  bolum?: string | null;
  onClose: () => void;
}) {
  const govde = useRef<HTMLDivElement>(null);
  const [aktif, setAktif] = useState(bolum ?? bolumler[0]?.id ?? "");
  /* Portal `document`e yazıyor; sunucu çiziminde o yok. İlk istemci çiziminden
     sonra açılır — çekmece zaten bir tıklamayla geliyor, gecikmesi görünmez. */
  const [monte, setMonte] = useState(false);
  useEffect(() => setMonte(true), []);

  // ESC ile kapat + arka planı kilitle (çekmece kayarken sayfa kaymasın).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const eski = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = eski;
    };
  }, [onClose]);

  // Derin link: istenen bölüme kaydır (çekmece açılış animasyonu bitince).
  useEffect(() => {
    if (!bolum) return;
    const t = window.setTimeout(() => {
      govde.current?.querySelector(`#rehber-${bolum}`)?.scrollIntoView({ block: "start" });
      setAktif(bolum);
    }, 60);
    return () => window.clearTimeout(t);
  }, [bolum]);

  // Okunan bölüm çip şeridinde işaretli kalsın (uzun metinde nerede olduğunu bil).
  useEffect(() => {
    const kok = govde.current;
    if (!kok) return;
    const göz = new IntersectionObserver(
      (girisler) => {
        const gorunen = girisler.filter((g) => g.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (gorunen) setAktif(gorunen.target.id.replace("rehber-", ""));
      },
      { root: kok, rootMargin: "0px 0px -70% 0px" }
    );
    kok.querySelectorAll("section[id^='rehber-']").forEach((s) => göz.observe(s));
    return () => göz.disconnect();
  }, [bolumler]);

  const git = (id: string) => {
    govde.current?.querySelector(`#rehber-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setAktif(id);
  };

  /**
   * ÇEKMECE GÖVDEYE TAŞINIR (portal) — `fixed` başka türlü GÜVENİLİR DEĞİL.
   *
   * Rehber düğmesi başlık şeridinin içinde duruyor ve o şeritte `backdrop-blur`
   * var. `backdrop-filter`, tıpkı `transform` gibi, altındaki `position: fixed`
   * öğeler için YENİ BİR KAPSAYICI BLOK yaratıyor: çekmece ekranı değil başlık
   * kutusunu kaplıyordu — 375×112 piksellik bir şerit. Telefonda görünen buydu:
   * rehberin başlığı ve sekmeleri üstte, hemen altında da editörün formu, ikisi
   * iç içe. Karartma da yalnız o şeridi karartıyordu.
   *
   * Portal bunu kaynağında bitiriyor: çekmece `document.body`nin çocuğu olarak
   * çiziliyor, ağaçtaki hiçbir ata onu bir daha kıramaz. Düzeltmeyi başlıktaki
   * `backdrop-blur`ı kaldırarak yapmak, aynı tuzağı bir sonraki bulanık yüzeyde
   * yeniden kurardı.
   *
   * `mounted` kapısı sunucu çiziminde `document`in olmaması içindir.
   */
  if (!monte) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex justify-end" role="dialog" aria-modal="true" aria-label={baslik}>
      <button className="absolute inset-0 bg-black/45" onClick={onClose} aria-label="Rehberi kapat" tabIndex={-1} />

      <div className="relative w-full sm:max-w-xl bg-yuzey h-full flex flex-col shadow-2xl animate-slide-in">
        {/* Başlık */}
        <div className="shrink-0 flex items-start gap-3 px-5 pt-5 pb-3 border-b border-line">
          <div className="min-w-0 flex-1">
            <p className="font-display font-semibold text-lg leading-tight">{baslik}</p>
            {altBaslik && <p className="text-muted text-sm mt-0.5">{altBaslik}</p>}
          </div>
          <button onClick={onClose} className="btn-icon" aria-label="Rehberi kapat">
            <Icon name="close" size={16} />
          </button>
        </div>

        {/* Bölüm şeridi */}
        <div className="shrink-0 flex gap-1.5 overflow-x-auto px-5 py-2.5 border-b border-line">
          {bolumler.map((b) => (
            /* SEKME = HAP. Bunlar zaten hap: bir kümeden birini seçiyorsun.
               `.flow-hap` hem dili getiriyor hem GERÇEK BİR HATAYI kapatıyor.

               ÖNCEKİ HÂL KOYU TEMADA OKUNMUYORDU: seçili sekme
               `bg-ink text-white` yazıyordu ve koyu temada `ink` zaten
               beyaza yakın (#f2f5ff) — yani BEYAZ ÜSTÜNE BEYAZ. Aynı
               sınıf açık temada siyah zemin/beyaz yazı olduğu için hata
               yalnız koyuda görünüyordu ve kullanıcı ekran görüntüsüyle
               bildirdi. FlowUI'ın "kontrast rengi nerede kullanılır"
               kuralı tam olarak bunu anlatıyor: kontrast rengi YALNIZ
               dolgu üstünde kullanılır, yüzey üstündeki metin tema
               metnini kullanır. */
            <button
              key={b.id}
              type="button"
              onClick={() => git(b.id)}
              aria-pressed={aktif === b.id}
              className="flow-hap shrink-0 whitespace-nowrap text-xs font-semibold"
            >
              {b.baslik}
            </button>
          ))}
        </div>

        {/* İçerik */}
        <div ref={govde} className="flex-1 overflow-y-auto overscroll-contain px-5 py-6 flex flex-col gap-12">
          {bolumler.map((b) => (
            <section key={b.id} id={`rehber-${b.id}`} className="scroll-mt-2">
              <p className="eyebrow text-accent-dark mb-1.5">{b.kicker}</p>
              <h2 className="font-display text-xl font-semibold tracking-tight mb-3 text-balance">{b.baslik}</h2>
              <div className="flex flex-col gap-3 text-[15px] leading-relaxed">{b.icerik}</div>
            </section>
          ))}
          <p className="text-muted text-xs pb-4">Bir şey eksikse söyle — rehber ürünle birlikte güncelleniyor.</p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
