"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { personeliTazeleEylem, senkronTekrarEylem } from "@/app/eylemler";

export default function Dugmeler({ bekleyen }: { bekleyen: number }) {
  const router = useRouter();
  const [calisiyor, gecis] = useTransition();

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <button
        onClick={() => gecis(async () => (await personeliTazeleEylem(), router.refresh()))}
        disabled={calisiyor}
        className="btn-ghost text-sm"
      >
        {/* Kaynağa göre değişmeyen bir ifade: OPM seçiliyken okunacak şey dosya
            değil webservice'tir, ama düğmenin işi ikisinde de aynı — önbelleği
            düşürüp yeniden okumak (`PersonelKaynagi.tazele`). */}
        <Icon name="refresh" size={16} /> Personel listesini yeniden oku
      </button>
      {bekleyen > 0 ? (
        <button
          onClick={() => gecis(async () => (await senkronTekrarEylem(), router.refresh()))}
          disabled={calisiyor}
          className="btn-primary text-sm"
        >
          <Icon name="upload" size={16} /> {bekleyen} kaydı yeniden gönder
        </button>
      ) : null}
    </div>
  );
}
