"use client";

import { useRef, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Baslik from "@/components/Baslik";
import Icon from "@/components/Icon";
import { useConfirm } from "@/components/ConfirmDialog";
import EgitimOyun from "@/components/oyun/EgitimOyun";
import SayfaSatiri from "@/components/editor/SayfaSatiri";
import SoruSatiri from "@/components/editor/SoruSatiri";
import { KART_ETIKET, SORU_ETIKET, type Egitim, type KartTipi, type Sayfa, type Soru, type SoruTipi } from "@/lib/tipler";
import type { Rol } from "@/lib/depo";
import {
  egitimGuncelleEylem,
  egitimKopyalaEylem,
  egitimSilEylem,
  sayfaEkleEylem,
  sayfaGuncelleEylem,
  sayfaSilEylem,
  sayfalariSiralaEylem,
  sayfalariTopluEkleEylem,
  soruEkleEylem,
  soruGuncelleEylem,
  soruSilEylem,
  taslagaAlEylem,
  yayinlaEylem,
} from "@/app/eylemler";

// Ağır ve nadir kullanılan: PDF motoru ilk açılışta indirilmesin.
const PdfYukle = dynamic(() => import("@/components/editor/PdfYukle"), { ssr: false });

/**
 * EĞİTİM EDİTÖRÜ.
 *
 * SIRALAMA BİLİNÇLİ: tanım → içerik → sorular → (gelişmiş) sınav ayarları.
 * Ayarlar en sonda ve KAPALI çünkü ürün "ayar sormayan ürün" olmalı;
 * hazırlayan hiçbir ayara dokunmadan yayınlayabilmeli.
 */
export default function Editor({
  egitim,
  sayfalar,
  sorular,
  rol,
  zorSoruIdleri,
}: {
  egitim: Egitim;
  sayfalar: Sayfa[];
  sorular: Soru[];
  rol: Rol;
  zorSoruIdleri: string[];
}) {
  const router = useRouter();
  const [bekle, gecis] = useTransition();
  const { confirm, dialog } = useConfirm();
  const [prova, setProva] = useState(false);
  const [ayarlarAcik, setAyarlarAcik] = useState(false);
  const kilit = useRef(false);

  const yayinda = egitim.durum === "yayin";
  const onaylayabilir = rol === "onaylayan" || rol === "yonetici";

  /** Çift tıklama kilidi `useRef` ile — state kilidi yarışı kaybediyor. */
  function calistir(is: () => Promise<void>) {
    if (kilit.current) return;
    kilit.current = true;
    gecis(async () => {
      try {
        await is();
      } finally {
        kilit.current = false;
        router.refresh();
      }
    });
  }

  const yayinaHazir = sayfalar.length > 0;

  return (
    <main className="bg-wash min-h-screen pb-24">
      <Baslik
        ust="/egitimler"
        ustAd="Eğitimler"
        baslik={egitim.ad}
        not={yayinda ? `Yayında · sürüm ${egitim.surum}` : "Taslak"}
        rehberBolum="hazirlama"
        sag={
          <>
            <button
              onClick={() => setProva(true)}
              disabled={sayfalar.length === 0}
              className="btn-ghost text-sm"
              title="Kiosk'ta nasıl görüneceğini gösterir; hiçbir kayıt düşmez"
            >
              <Icon name="play" size={16} /> Dene
            </button>
            {onaylayabilir ? (
              yayinda ? (
                <button onClick={() => calistir(() => taslagaAlEylem(egitim.id))} className="btn-ghost text-sm">
                  Taslağa al
                </button>
              ) : (
                <button
                  onClick={() => calistir(() => yayinlaEylem(egitim.id))}
                  disabled={!yayinaHazir}
                  className="btn-primary text-sm"
                  title={yayinaHazir ? "" : "En az bir sayfa gerekir"}
                >
                  <Icon name="check" size={16} /> Yayınla
                </button>
              )
            ) : (
              <span className="chip text-xs text-muted" title="Yayına almayı onaylayan rolü yapar">
                <Icon name="lock" size={14} /> Onay bekler
              </span>
            )}
          </>
        }
      />

      <div className="mx-auto max-w-3xl space-y-8 px-5 py-8">
        {!onaylayabilir && !yayinda ? (
          <p className="rounded-xl border border-line bg-white px-4 py-3 text-sm text-muted">
            Hazırladığınız eğitimi <strong className="text-ink">onaylayan</strong> rolündeki bir kişi yayına alır.
            İçerik kalitesinin tek güvencesi bu ikinci gözdür.
          </p>
        ) : null}

        {/* ── tanım ── */}
        <section>
          <h2 className="eyebrow mb-3">Tanım</h2>
          <div className="card space-y-4 p-5">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold">Eğitim adı</span>
              <input
                defaultValue={egitim.ad}
                onBlur={(e) =>
                  e.target.value !== egitim.ad && calistir(() => egitimGuncelleEylem(egitim.id, { ad: e.target.value }))
                }
                className="input-base"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold">Açıklama</span>
              <textarea
                defaultValue={egitim.aciklama ?? ""}
                onBlur={(e) =>
                  e.target.value !== (egitim.aciklama ?? "") &&
                  calistir(() => egitimGuncelleEylem(egitim.id, { aciklama: e.target.value }))
                }
                rows={2}
                className="input-base resize-y"
                placeholder="Kimin, neyi öğrenmesi bekleniyor?"
              />
            </label>
          </div>
        </section>

        {/* ── içerik ── */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="eyebrow">İçerik · {sayfalar.length} sayfa</h2>
          </div>

          {sayfalar.length === 0 ? (
            <PdfYukle
              egitimId={egitim.id}
              onBitti={async (kartlar) => {
                await sayfalariTopluEkleEylem(egitim.id, kartlar);
                router.refresh();
              }}
            />
          ) : null}

          <div className="mt-4 space-y-3">
            {sayfalar.map((s, i) => (
              <SayfaSatiri
                key={s.id}
                sayfa={s}
                sira={i + 1}
                toplam={sayfalar.length}
                onGuncelle={(yama) => calistir(() => sayfaGuncelleEylem(egitim.id, s.id, yama))}
                onSil={() =>
                  confirm(
                    { title: "Sayfa silinsin mi?", message: `"${s.baslik || KART_ETIKET[s.tip]}" kalıcı olarak silinir.`, danger: true },
                    () => calistir(() => sayfaSilEylem(egitim.id, s.id)),
                  )
                }
                onTasi={(yon) => {
                  const yeni = [...sayfalar];
                  const hedef = i + yon;
                  if (hedef < 0 || hedef >= yeni.length) return;
                  [yeni[i], yeni[hedef]] = [yeni[hedef], yeni[i]];
                  calistir(() => sayfalariSiralaEylem(egitim.id, yeni.map((x) => x.id)));
                }}
              />
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {(Object.keys(KART_ETIKET) as KartTipi[]).map((t) => (
              <button key={t} onClick={() => calistir(() => sayfaEkleEylem(egitim.id, t))} className="btn-ghost text-sm">
                <Icon name="plus" size={16} /> {KART_ETIKET[t]}
              </button>
            ))}
          </div>

          {sayfalar.length > 0 ? (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-semibold text-muted hover:text-ink">
                Başka bir PDF ekle
              </summary>
              <div className="mt-3">
                <PdfYukle
                  egitimId={egitim.id}
                  onBitti={async (kartlar) => {
                    await sayfalariTopluEkleEylem(egitim.id, kartlar);
                    router.refresh();
                  }}
                />
              </div>
            </details>
          ) : null}
        </section>

        {/* ── sorular ── */}
        <section>
          <h2 className="eyebrow mb-3">Sorular · {sorular.length} soru havuzda</h2>

          {sorular.length > 0 && sorular.length < egitim.soruSayisi ? (
            <p className="mb-3 rounded-xl border border-orta/30 bg-orta/5 px-4 py-3 text-sm font-semibold text-orta-dark">
              Havuzda {sorular.length} soru var, sınavda {egitim.soruSayisi} soru sorulacak. Havuz sınavdan küçükse
              herkese aynı sorular gelir — karıştırmanın anlamı kalmaz.
            </p>
          ) : null}

          <div className="space-y-3">
            {sorular.map((s, i) => (
              <SoruSatiri
                key={s.id}
                soru={s}
                sira={i + 1}
                zor={zorSoruIdleri.includes(s.id)}
                onGuncelle={(yama) => calistir(() => soruGuncelleEylem(egitim.id, s.id, yama))}
                onSil={() =>
                  confirm({ title: "Soru silinsin mi?", message: "Soru havuzdan kalıcı olarak çıkar.", danger: true }, () =>
                    calistir(() => soruSilEylem(egitim.id, s.id)),
                  )
                }
              />
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {(Object.keys(SORU_ETIKET) as SoruTipi[]).map((t) => (
              <button key={t} onClick={() => calistir(() => soruEkleEylem(egitim.id, t))} className="btn-ghost text-sm">
                <Icon name="plus" size={16} /> {SORU_ETIKET[t]}
              </button>
            ))}
          </div>
        </section>

        {/* ── gelişmiş ── */}
        <section>
          <button
            onClick={() => setAyarlarAcik((a) => !a)}
            className="flex w-full items-center justify-between rounded-xl px-1 py-2 text-left"
            aria-expanded={ayarlarAcik}
          >
            <span className="eyebrow">Sınav ayarları (gelişmiş)</span>
            <Icon name={ayarlarAcik ? "up" : "down"} size={16} className="text-muted" />
          </button>

          {ayarlarAcik ? (
            <div className="card grid gap-4 p-5 sm:grid-cols-2">
              <Sayi
                etiket="Geçme notu"
                deger={egitim.gecmeNotu}
                onDegis={(v) => calistir(() => egitimGuncelleEylem(egitim.id, { gecmeNotu: v }))}
              />
              <Sayi
                etiket="Deneme hakkı"
                deger={egitim.denemeHakki}
                onDegis={(v) => calistir(() => egitimGuncelleEylem(egitim.id, { denemeHakki: v }))}
              />
              <Sayi
                etiket="Sınavdaki soru sayısı"
                deger={egitim.soruSayisi}
                onDegis={(v) => calistir(() => egitimGuncelleEylem(egitim.id, { soruSayisi: v }))}
              />
              <Sayi
                etiket="Tekrar (ay) — boş: tekrar yok"
                deger={egitim.tekrarAy ?? 0}
                onDegis={(v) => calistir(() => egitimGuncelleEylem(egitim.id, { tekrarAy: v || undefined }))}
              />
              <label className="flex items-center gap-3 sm:col-span-2">
                <input
                  type="checkbox"
                  defaultChecked={egitim.karisik}
                  onChange={(e) => calistir(() => egitimGuncelleEylem(egitim.id, { karisik: e.target.checked }))}
                  className="h-5 w-5 accent-accent"
                />
                <span className="text-sm">
                  <strong>Soruları karıştır.</strong>{" "}
                  <span className="text-muted">
                    Kapatılırsa herkese aynı sorular aynı sırayla gelir — arka arkaya 12 kişi aynı deseni tıklayabilir.
                  </span>
                </span>
              </label>
            </div>
          ) : null}
        </section>

        {/* ── tehlikeli bölge ── */}
        <section className="flex flex-wrap gap-2 border-t border-line pt-6">
          <button onClick={() => calistir(() => egitimKopyalaEylem(egitim.id))} className="btn-ghost text-sm">
            <Icon name="copy" size={16} /> Kopyala
          </button>
          <button
            onClick={() =>
              confirm(
                {
                  title: "Eğitim silinsin mi?",
                  message: `"${egitim.ad}" ve tüm sayfaları/soruları silinir. Tamamlanmış oturum KAYITLARI silinmez.`,
                  danger: true,
                  confirmLabel: "Sil",
                },
                () => calistir(() => egitimSilEylem(egitim.id)),
              )
            }
            className="btn-ghost text-sm text-brand"
          >
            <Icon name="trash" size={16} /> Sil
          </button>
          {bekle ? <span className="self-center text-sm text-muted">Kaydediliyor…</span> : null}
        </section>
      </div>

      {prova ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-paper">
          <EgitimOyun
            egitim={egitim}
            sayfalar={sayfalar}
            sorular={sorular}
            oturumId={`prova_${egitim.id}`}
            prova
            onCik={() => setProva(false)}
          />
        </div>
      ) : null}

      {dialog}
    </main>
  );
}

function Sayi({ etiket, deger, onDegis }: { etiket: string; deger: number; onDegis: (v: number) => void }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold">{etiket}</span>
      <input
        type="number"
        defaultValue={deger}
        min={0}
        onBlur={(e) => Number(e.target.value) !== deger && onDegis(Number(e.target.value))}
        className="input-base"
      />
    </label>
  );
}
