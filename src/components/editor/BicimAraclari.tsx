"use client";

import { useRef } from "react";
import Icon from "@/components/Icon";
import OtoMetin, { boyutla } from "@/components/editor/OtoMetin";
/* Saf biçim hesabı lib tarafında: .tsx dosyaları sınav koşucusuna doğrudan
   girmiyor ve imleç mantığı sessizce bozulabilecek türden. */
import { bicimUygula, type BicimIsi } from "@/lib/bicimMetin";

/**
 * BİÇİM ŞERİDİ — `bicimMetin.ts` dilini yazmayı kolaylaştırır, GİZLEMEZ.
 *
 * Hazırlayan `**` yazmayı öğrenmek zorunda değil, ama elle yazan biri de
 * engellenmemeli: düğmeler metnin içine dilin KENDİSİNİ yazar, gizli bir HTML
 * üretmez. Alanda görünen şey dosyada duran şeydir.
 *
 * `document.execCommand` YOK — kullanımdan kalktı, `textarea` üzerinde zaten
 * çalışmıyor ve geri alma yığınını tarayıcıya göre farklı bozuyor. Seçim
 * `selectionStart/End` ile okunur, yeni metin ve yeni imleç yeri saf bir
 * fonksiyonda (`bicimUygula`) hesaplanır.
 *
 * ŞERİT DÜĞMESİ ODAĞI ÇALMAZ (`onMouseDown` → `preventDefault`): odak alandan
 * çıksaydı seçim kaybolur, üstelik satırın `onBlur` kaydı düğmeye basılmadan
 * ÖNCEKİ değeri sunucuya yazardı.
 */

/**
 * DİLİN TAMAMI TEK SATIRDA. Uzun bir yardım paneli açılmıyor: dört işaretin
 * hepsi buraya sığıyor, sığmayan bir dil zaten kart metni için fazla olurdu.
 */
export function BicimIpucu() {
  return (
    <p className="text-[11px] leading-relaxed text-muted">
      <Kod>**kalın**</Kod> <Kod>- madde</Kod> <Kod>1. adım</Kod> <Kod>!! uyarı</Kod> · boş satır = yeni paragraf
    </p>
  );
}

function Kod({ children }: { children: string }) {
  return <code className="mr-1.5 rounded bg-line/70 px-1 py-px font-mono text-[10px] text-ink">{children}</code>;
}

/**
 * Biçim şeridi + içeriğe göre büyüyen alan, tek parça.
 *
 * `onUygula` HEM iyimser çizimi HEM sunucuya yazmayı tetikler. Tuş vuruşundan
 * farklı olarak şerit tıklaması ayrık ve bilinçli bir eylem — her tıklamada
 * kaydetmek trafik yaratmaz, buna karşılık odak kutuda kalmaya devam ettiği
 * için `onBlur` kaydını beklemek değişikliği havada bırakırdı.
 */
export default function MetinAlani({
  bicim = true,
  onUygula,
  etiket,
  ...ozellikler
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  /** Satır dili taşıyan alanlarda (kontrol listesi, karşılaştırma…) kapatılır. */
  bicim?: boolean;
  /** Şerit metni değiştirdi — iyimser çizim + sunucuya yazma birlikte. */
  onUygula: (metin: string) => void;
  /** Görünür etiket. Yer tutucu yetmediği yerde (vaka, önce/sonra) kullanılır. */
  etiket?: string;
}) {
  const alan = useRef<HTMLTextAreaElement | null>(null);

  function isle(is: BicimIsi) {
    const a = alan.current;
    if (!a || a.disabled) return;
    const sonuc = bicimUygula(a.value, a.selectionStart, a.selectionEnd, is);
    /* Alan denetimsiz (`defaultValue`) — değeri doğrudan yazmak React'le
       çakışmaz, ama `onInput` de tetiklenmediği için kutuyu kendimiz ölçeriz. */
    a.value = sonuc.metin;
    boyutla(a);
    a.focus();
    a.setSelectionRange(sonuc.basla, sonuc.bitir);
    onUygula(sonuc.metin);
  }

  return (
    <div>
      {etiket ? <span className="mb-1 block text-xs font-semibold text-muted">{etiket}</span> : null}

      {bicim ? (
        <div className="mb-1 flex flex-wrap items-center gap-1">
          <Dugme is="kalin" ikon="text" etiket="Kalın" ipucu="Seçili metni kalın yapar (**…**)" onBas={isle} kilitli={ozellikler.disabled} />
          <Dugme is="madde" ikon="list" etiket="Madde" ipucu="Satır başına madde işareti (- )" onBas={isle} kilitli={ozellikler.disabled} />
          <Dugme is="sirali" ikon="listOrdered" etiket="Sıra" ipucu="Satırları numaralandırır (1. )" onBas={isle} kilitli={ozellikler.disabled} />
          <Dugme is="uyari" ikon="warning" etiket="Uyarı" ipucu="Satırı kırmızı uyarı şeridi yapar (!! )" onBas={isle} kilitli={ozellikler.disabled} />
        </div>
      ) : null}

      <OtoMetin {...ozellikler} ref={alan} />
    </div>
  );
}

function Dugme({
  is,
  ikon,
  etiket,
  ipucu,
  onBas,
  kilitli,
}: {
  is: BicimIsi;
  ikon: "text" | "list" | "listOrdered" | "warning";
  etiket: string;
  ipucu: string;
  onBas: (is: BicimIsi) => void;
  kilitli?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={kilitli}
      title={ipucu}
      aria-label={ipucu}
      // Odağı ÇALMA: seçim korunsun, satırın `onBlur` kaydı erken tetiklenmesin.
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onBas(is)}
      className="dokunma-44 inline-flex items-center gap-1 rounded-lg border border-line bg-white px-2 py-1 text-[11px] font-semibold text-muted transition-colors hover:border-accent hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Icon name={ikon} size={13} />
      {/* DAR EKRANDA YALNIZ SİMGE. Dört düğme × iki alan (Yap/Yapma) etiketle
          birlikte iki tam satır yiyordu; tek kart bir ekrandan uzun oluyor ve
          altındaki önizlemeye yer kalmıyordu. Etiket `title`/`aria-label`de
          duruyor, yani erişilebilirlik kaybı yok. */}
      <span className="hidden sm:inline">{etiket}</span>
    </button>
  );
}
