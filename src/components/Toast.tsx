"use client";

/**
 * İşlem bildirimi (ekranın altında sabit şerit) + `useToast` kancası.
 *
 * Neden: silme gibi işlemler sunucuda saniyeler sürüyor (duvar/ekran silmede
 * Cloudinary temizliği de var) ama ekranda hiçbir şey olmuyordu — kullanıcı
 * "sildi mi silmedi mi" bilemiyordu. Artık işlem BAŞLARKEN dönen halkalı
 * "siliniyor…" görünür, BİTİNCE "✓ silindi"ye döner ve kendiliğinden kaybolur.
 *
 * Sayfanın neresine bakıyor olursan ol görünür (fixed, alt orta) — eski
 * sayfa-içi şeritler ekranın dışında kalabiliyordu.
 */
import { useCallback, useRef, useState } from "react";
import { Icon } from "@/components/Icon";

type Kind = "busy" | "done" | "error";

/**
 * Bildirimin İÇİNDEKİ eylem — bugün tek kullanıcısı "Geri al".
 *
 * Neden burada: geri alma penceresi bildirimin ömrü kadardır. Ayrı bir kutu
 * çizilseydi iki farklı süre (kutunun ömrü, bildirimin ömrü) yönetmek
 * gerekirdi ve ikisi kaçınılmaz olarak ayrışırdı — kullanıcı görünen bir
 * düğmeye basıp "artık geç" cevabı alırdı.
 */
export interface ToastEylemi {
  etiket: string;
  onTikla: () => void;
}

function ToastView({ text, kind, eylem }: { text: string; kind: Kind; eylem?: ToastEylemi }) {
  return (
    // DİKKAT — konumlandırma ve animasyon AYRI katmanlarda olmalı: ikisi de
    // `transform` kullanıyor. Aynı elemana verilince giriş animasyonu ortalama
    // dönüşümünü eziyordu; şerit sağa kayıp ekrandan taşıyor, taşan sabit eleman
    // da SAYFAYI YATAY KAYDIRIYORDU (asıl "mobilde kayma" şikâyeti buydu).
    // Dış katman: konum. İç katman: animasyon. Genişlik sınırı da iç katmanda,
    // yoksa metin kabına sığmayıp balonu dışarı taşırıyor.
    <div role="status" aria-live="polite" className="fixed bottom-5 inset-x-0 z-[80] flex justify-center px-4 pointer-events-none">
      <div
        /* ZEMİN TOKENDEN, "ink" DEĞİL.
           Eskiden `bg-ink text-white` yazıyordu ve koyu temada `ink` zaten
           beyaza yakın (#f2f5ff) — bildirim BEYAZ ÜSTÜNE BEYAZ çiziliyordu,
           yani okunmuyordu. Hata yalnız koyu temada görünüyordu çünkü açıkta
           aynı sınıf siyah zemin/beyaz yazı veriyor.

           Yeni hâli FlowUI'ın bildirim dili: ince cam kart — yüzeyden bir ton
           açık zemin, token kenar, tema metni. Hata bildirimi ANLAM RENGİNİ
           koruyor (dolgu üstünde kontrast rengi meşru). */
        className={`animate-pop pointer-events-auto max-w-full inline-flex items-center gap-2.5 rounded-full px-4 py-2.5 text-sm font-semibold shadow-flow border ${
          kind === "error"
            ? "bg-brand text-white border-brand-dark"
            : "bg-yuzey2 text-ink border-line"
        }`}
      >
        {kind === "busy" && (
          <span className="w-4 h-4 rounded-full border-2 border-ink/25 border-t-ink animate-spin shrink-0" aria-hidden />
        )}
        {kind === "done" && <Icon name="check" size={16} />}
        {kind === "error" && <Icon name="warning" size={16} />}
        {/* min-w-0: esnek kutuda metin kutusu varsayılan olarak KÜÇÜLMEZ;
            bu olmadan "truncate" hiç çalışmıyor ve balon taşıyordu. */}
        <span className="truncate min-w-0">{text}</span>
        {eylem ? (
          // `shrink-0`: metin uzadığında kısalması gereken metindir, düğme
          // değil — basılamayan bir "Geri al" hiç olmamasından beterdir.
          <button
            type="button"
            onClick={eylem.onTikla}
            className="shrink-0 rounded-full bg-ink/10 px-3 py-1 text-sm font-bold underline-offset-2 hover:bg-ink/20 hover:underline"
          >
            {eylem.etiket}
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** Eylemli bildirim daha uzun durur: okumak + karar vermek + basmak. */
const EYLEMLI_SURE = 10000;

/**
 * Bildirim ömrü TOKEN KATMANINDAN okunur (`--flow-toast-duration`).
 *
 * FlowUI kuralı: ömür tek kaynaktan gelir, yoksa bildirimin süresi ile
 * kenar geri sayımı ayrışıyor ve şerit dolmadan kapanıyordu. Burada geri
 * sayım çizilmiyor ama kural aynı sebeple geçerli: süre bir tasarım
 * kararıdır ve bileşene gömülmez.
 *
 * Sunucu çiziminde `document` yok; okunamazsa 7 sn'ye düşer — token
 * dosyasındaki değerin aynısı.
 */
function tokenSuresi(): number {
  if (typeof document === "undefined") return 7000;
  const ham = getComputedStyle(document.documentElement).getPropertyValue("--flow-toast-duration").trim();
  const sayi = parseFloat(ham);
  if (!Number.isFinite(sayi) || sayi <= 0) return 7000;
  /* Token saniye yazıyor ("7s"); milisaniyeye çevir. `ms` ile yazılmışsa
     olduğu gibi al — ikisi de geçerli CSS. */
  return ham.endsWith("ms") ? sayi : sayi * 1000;
}

export function useToast() {
  const [state, setState] = useState<{ text: string; kind: Kind; eylem?: ToastEylemi } | null>(null);
  const timer = useRef<number | undefined>(undefined);

  /** kind="busy" kendiliğinden kaybolmaz — işlem bitince tekrar çağır. */
  const show = useCallback((text: string, kind: Kind = "done", eylem?: ToastEylemi) => {
    window.clearTimeout(timer.current);
    /* Eylem sarmalanıyor: basıldığı anda bildirim KAPANIR. Açık kalsaydı
       ikinci basış aynı geri almayı tekrar çalıştırır, silinen kart iki kez
       geri gelirdi. */
    const sarmal = eylem
      ? {
          etiket: eylem.etiket,
          onTikla: () => {
            window.clearTimeout(timer.current);
            setState(null);
            eylem.onTikla();
          },
        }
      : undefined;
    setState({ text, kind, eylem: sarmal });
    if (kind !== "busy") {
      /* HATA daha uzun durur (token ömrü), başarı kısa: "kaydedildi" okunup
         geçilecek bir şey, "yapılamadı" ise karar gerektiriyor. Geri alınabilir
         bildirim ikisinden de uzun. */
      const sure = sarmal ? EYLEMLI_SURE : kind === "error" ? tokenSuresi() : 2200;
      timer.current = window.setTimeout(() => setState(null), sure);
    }
  }, []);

  const hide = useCallback(() => {
    window.clearTimeout(timer.current);
    setState(null);
  }, []);

  return { show, hide, toast: state ? <ToastView {...state} /> : null };
}
