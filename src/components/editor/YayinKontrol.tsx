"use client";

import Icon from "@/components/Icon";
import { type KontrolDurumu, type KontrolSatiri } from "@/lib/yayinKontrolu";

/* Saf mantık `src/lib/yayinKontrolu.ts`te ve sınavlı (`tests/yayin-kontrol.test.mjs`).
   Buradan yeniden dışa veriliyor ki çağıranlar tek yerden alsın. */
export { kartSorunlu, yayinKontrolu } from "@/lib/yayinKontrolu";
export type { KontrolDurumu, KontrolSatiri } from "@/lib/yayinKontrolu";

/** Başlıktaki özet rozeti — yayınla düğmesinin yanında durur. */
export function YayinRozeti({ liste }: { liste: KontrolSatiri[] }) {
  const engel = liste.some((k) => k.durum === "engel");
  const kilit = liste.filter((k) => k.durum === "kilit").length;
  const uyari = liste.filter((k) => k.durum === "uyari").length;

  /* Dar ekranda GİZLİ: başlık şeridi kırılmıyor, üçüncü bir rozet eklenince
     eğitim adı ile Yayınla düğmesi birbirini eziyordu. Ayrıntı zaten gövdedeki
     "Yayına hazırlık" bölümünde duruyor. */
  if (engel) {
    return (
      <span className="chip hidden border-brand/40 bg-brand-soft text-xs text-brand-dark sm:inline-flex" title="Yayın için en az bir sayfa gerekir">
        <Icon name="warning" size={14} /> Sayfa yok
      </span>
    );
  }
  /* KİLİT UYARIDAN ÖNCE GELİR ve rozeti ele geçirir: "3 uyarı" yazan bir rozet
     içinde sahada işçiyi durduran bir kusur varsa, o kusur görünmüyor
     demektir. Sayı ikisini toplamaz — kırmızı olan kaç tane, o söylenir. */
  if (kilit > 0) {
    return (
      <span
        className="chip hidden border-brand/40 bg-brand-soft text-xs text-brand-dark sm:inline-flex"
        title="Sahada işçiyi durduran kusur var — 'Yayına hazırlık' listesine bakın"
      >
        <Icon name="warning" size={14} /> {kilit} kusur sahada kilitler
      </span>
    );
  }
  if (uyari > 0) {
    return (
      <span className="chip hidden border-orta/40 bg-orta/10 text-xs text-orta-dark sm:inline-flex" title="Aşağıdaki 'Yayına hazırlık' listesine bakın">
        <Icon name="warning" size={14} /> {uyari} uyarı
      </span>
    );
  }
  return (
    <span className="chip hidden border-iyi/40 bg-iyi/10 text-xs text-iyi-dark sm:inline-flex">
      <Icon name="check" size={14} /> Yayına hazır
    </span>
  );
}

/** Satırın rengi — `kilit` ve `engel` kırmızı, `uyari` amber, `tamam` yeşil. */
const SATIR_RENGI: Record<KontrolDurumu, string> = {
  tamam: "text-iyi-dark",
  uyari: "text-orta-dark",
  kilit: "text-brand",
  engel: "text-brand",
};

export default function YayinKontrol({ liste }: { liste: KontrolSatiri[] }) {
  /* KİLİTLER ÜSTE ALINIR. Liste kontrol sırasına göre yazılıyordu ve sahada
     işçiyi durduran bir kusur, "başlık boş" gibi kozmetik satırların altında
     kalabiliyordu. Sıralama kararlı (`toSorted` yok, indeksle çözülüyor) ki
     aynı şiddetteki satırlar kendi doğal sırasını korusun. */
  const agirlik: Record<KontrolDurumu, number> = { engel: 0, kilit: 1, uyari: 2, tamam: 3 };
  const sirali = liste
    .map((k, i) => ({ k, i }))
    .sort((a, b) => agirlik[a.k.durum] - agirlik[b.k.durum] || a.i - b.i)
    .map((x) => x.k);

  return (
    <ul className="card divide-y divide-line">
      {sirali.map((k, i) => (
        <li key={i} className="flex items-start gap-3 px-5 py-3 text-sm">
          <span className={`mt-0.5 ${SATIR_RENGI[k.durum]}`}>
            <Icon name={k.durum === "tamam" ? "check" : "warning"} size={16} />
          </span>
          <span className={k.durum === "tamam" ? "text-muted" : "font-semibold"}>
            {k.metin}
            {/* Kilit satırı ne olduğunu AÇIKÇA söyler: kırmızı renk tek başına
                "önemli" der, "işçi ilerleyemez" demez. */}
            {k.durum === "kilit" ? (
              <span className="ml-2 chip border-brand/40 bg-brand-soft text-[11px] font-semibold text-brand-dark">
                sahada kilitler
              </span>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  );
}
