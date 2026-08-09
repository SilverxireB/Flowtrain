"use client";

import { useState, useTransition } from "react";
import Icon from "@/components/Icon";
import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { saklamaAyarlaEylem, saklamaTemizleEylem } from "../eylemler";
import { SAKLAMA_KAPALI, SAKLAMA_SECENEKLERI } from "@/lib/ziyaretciCikti";

/**
 * KVKK SAKLAMA SÜRESİ.
 *
 * Ziyaretçinin adı kişisel veridir; İSG bilgilendirme kaydının amacı bitince
 * tutulmaz. Süre dolduğunda kayıt SİLİNİR ve silme denetim izine düşer.
 *
 * VARSAYILAN "SINIRSIZ", bilerek: kurulumdan sonra kimsenin haberi olmadan
 * kayıt silen bir ürün, "geçen yılki ziyaretçi listesini ver" dendiği gün
 * savunulamaz. Süreyi fabrika BİLEREK açar.
 *
 * ONAY EKRANI ZORUNLU (native `confirm` yok — `ConfirmDialog`): geri alınamaz
 * bir silme, tek dokunuşla olmamalı ve kaç kaydın gideceği önceden yazılmalı.
 */
export default function Saklama({ gun, eskiSayisi }: { gun: number; eskiSayisi: number }) {
  const [secili, setSecili] = useState(gun);
  const [bekle, basla] = useTransition();
  const { confirm, dialog } = useConfirm();
  const { show, toast } = useToast();

  const degisti = secili !== gun;

  function kaydet() {
    if (secili === SAKLAMA_KAPALI) {
      basla(async () => {
        await saklamaAyarlaEylem(SAKLAMA_KAPALI);
        show("Saklama süresi kapatıldı. Hiçbir kayıt silinmeyecek.");
      });
      return;
    }
    confirm(
      {
        title: "Saklama süresi uygulanacak",
        message:
          `Bu ayardan sonra ${secili} günden eski ziyaretçi kayıtları — adı, firması ve izlediği ` +
          "bilgilendirmelerin kaydı — kalıcı olarak silinir. Silme geri alınamaz ve denetim izine düşer.",
        confirmLabel: "Uygula ve temizle",
        danger: true,
      },
      () =>
        basla(async () => {
          const c = await saklamaAyarlaEylem(secili);
          show(c.silinen > 0 ? `${c.silinen} eski kayıt silindi.` : "Ayar kaydedildi, silinecek kayıt yoktu.");
        }),
    );
  }

  function simdiTemizle() {
    confirm(
      {
        title: "Şimdi temizlensin mi?",
        message: `${gun} günden eski ${eskiSayisi} ziyaretçi kaydı kalıcı olarak silinecek.`,
        confirmLabel: "Sil",
        danger: true,
      },
      () =>
        basla(async () => {
          const c = await saklamaTemizleEylem();
          show(c.silinen > 0 ? `${c.silinen} kayıt silindi.` : "Silinecek kayıt yoktu.");
        }),
    );
  }

  return (
    <section className="card p-5">
      <h2 className="flex items-center gap-2 font-semibold">
        <Icon name="shield" size={18} className="text-accent" /> Kayıt saklama süresi (KVKK)
      </h2>
      <p className="mt-1 text-sm text-muted">
        Ziyaretçi defteri kişisel veri tutar. Belirlediğiniz günden eski kayıtlar — ad, firma ve izlenen
        bilgilendirmeler — kalıcı olarak silinir; her temizlik <strong className="text-ink">denetim izine</strong>{" "}
        düşer. Silmeden önce{" "}
        <a href="/ziyaretci" className="font-semibold text-accent underline">
          defteri dışa aktarmayı
        </a>{" "}
        unutmayın.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block font-semibold">Saklama süresi</span>
          <select
            value={secili}
            onChange={(e) => setSecili(Number(e.target.value))}
            className="input-base py-2 text-sm"
          >
            {SAKLAMA_SECENEKLERI.map((s) => (
              <option key={s.gun} value={s.gun}>
                {s.etiket}
              </option>
            ))}
          </select>
        </label>

        <button onClick={kaydet} disabled={!degisti || bekle} className="btn-primary text-sm">
          {bekle ? "Uygulanıyor…" : "Kaydet"}
        </button>

        {/* Süre zaten açık ve bekleyen eski kayıt varsa elle tetikleme:
            temizlik ziyaretçi listesi her açıldığında da koşar, ama kimse
            listeyi açmadan önce "şimdi temizle" demek isteyebilir. */}
        {gun !== SAKLAMA_KAPALI && eskiSayisi > 0 ? (
          <button onClick={simdiTemizle} disabled={bekle} className="btn-ghost text-sm text-brand">
            <Icon name="trash" size={16} /> {eskiSayisi} eski kaydı şimdi sil
          </button>
        ) : null}
      </div>

      {gun === SAKLAMA_KAPALI ? (
        <p className="mt-3 text-sm text-muted">
          Şu anda <strong className="text-ink">hiçbir kayıt silinmiyor</strong>.
        </p>
      ) : null}

      {dialog}
      {toast}
    </section>
  );
}
