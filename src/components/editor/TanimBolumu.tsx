"use client";

import OtoMetin from "@/components/editor/OtoMetin";
import type { Egitim } from "@/lib/tipler";

/**
 * TANIM BÖLÜMÜ — eğitimin kendisi hakkındaki alanlar.
 *
 * Buradaki dört yeni alan (kategori, zorunluluk, süre, eğitmen) katalog ve
 * denetim içindir; hazırlayanın HİÇBİRİNİ doldurmadan yayınlayabilmesi gerekir.
 * Bu yüzden hepsi isteğe bağlı ve tek kartta, iki kolonda duruyor: ayrı bir
 * "üstveri" bölümü açsaydık ekran ikiye bölünür, boş bırakılan alanlar
 * doldurulması gereken bir form gibi görünürdü.
 *
 * KATEGORİ SERBEST METİN + ÖNERİ: sabit liste her fabrikada yanlış olurdu,
 * tamamen serbest bırakmak ise "İSG", "isg", "İş Güvenliği" diye üçe bölerdi.
 * Mevcutlar öneri olarak düşer, yenisi yazılabilir.
 */
export default function TanimBolumu({
  egitim,
  kategoriler,
  kilitli,
  onGuncelle,
}: {
  egitim: Egitim;
  kategoriler: string[];
  kilitli?: boolean;
  onGuncelle: (yama: Record<string, unknown>) => void;
}) {
  return (
    <div className="card space-y-4 p-5">
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold">Eğitim adı</span>
        <input
          disabled={kilitli}
          defaultValue={egitim.ad}
          onBlur={(e) => e.target.value !== egitim.ad && onGuncelle({ ad: e.target.value })}
          className="input-base"
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold">Açıklama</span>
        <OtoMetin
          disabled={kilitli}
          defaultValue={egitim.aciklama ?? ""}
          onBlur={(e) => e.target.value !== (egitim.aciklama ?? "") && onGuncelle({ aciklama: e.target.value })}
          rows={2}
          className="input-base"
          placeholder="Kimin, neyi öğrenmesi bekleniyor?"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">Kategori</span>
          <input
            disabled={kilitli}
            defaultValue={egitim.kategori}
            list="ft-kategoriler"
            onBlur={(e) => e.target.value.trim() !== egitim.kategori && onGuncelle({ kategori: e.target.value.trim() })}
            placeholder="İSG, Kalite, Oryantasyon…"
            className="input-base"
          />
          <datalist id="ft-kategoriler">
            {kategoriler.map((k) => (
              <option key={k} value={k} />
            ))}
          </datalist>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">Varsayılan eğitmen</span>
          <input
            disabled={kilitli}
            defaultValue={egitim.egitmen ?? ""}
            onBlur={(e) => e.target.value.trim() !== (egitim.egitmen ?? "") && onGuncelle({ egitmen: e.target.value.trim() })}
            placeholder="Sınıf kaydında öne gelir"
            className="input-base"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">Planlanan süre (dakika)</span>
          <input
            type="number"
            min={0}
            disabled={kilitli}
            defaultValue={egitim.sureDk ?? ""}
            onBlur={(e) => {
              const v = Number(e.target.value) || 0;
              if (v !== (egitim.sureDk ?? 0)) onGuncelle({ sureDk: v || undefined });
            }}
            placeholder="Boş: belirtilmemiş"
            className="input-base"
          />
        </label>

        <label className="flex items-start gap-3 sm:pt-7">
          <input
            type="checkbox"
            disabled={kilitli}
            defaultChecked={egitim.zorunlu}
            onChange={(e) => onGuncelle({ zorunlu: e.target.checked })}
            className="mt-0.5 h-5 w-5 accent-accent"
          />
          <span className="text-sm">
            <strong>Yasal zorunluluk.</strong>{" "}
            <span className="text-muted">
              Denetim raporu zorunlu eğitimleri ayrı sayar; işaretlemek atamayı değiştirmez.
            </span>
          </span>
        </label>
      </div>
    </div>
  );
}
