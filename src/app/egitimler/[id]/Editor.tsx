"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Baslik from "@/components/Baslik";
import Icon from "@/components/Icon";
import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import EgitimOyun from "@/components/oyun/EgitimOyun";
import CanliOnizleme from "@/components/editor/CanliOnizleme";
import SayfaSatiri from "@/components/editor/SayfaSatiri";
import SoruSatiri from "@/components/editor/SoruSatiri";
import TanimBolumu from "@/components/editor/TanimBolumu";
import YayinKontrol, { YayinRozeti, yayinKontrolu } from "@/components/editor/YayinKontrol";
import type { MedyaOzet } from "@/lib/editorMedya";
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
import { kartCogaltEylem, kartKopyalaEylem, medyaSilEylem } from "./eylemler";

// Ağır ve nadir kullanılan: PDF motoru ilk açılışta indirilmesin.
const PdfYukle = dynamic(() => import("@/components/editor/PdfYukle"), { ssr: false });

/**
 * EĞİTİM EDİTÖRÜ.
 *
 * SIRALAMA BİLİNÇLİ: tanım → içerik → sorular → yayına hazırlık → (gelişmiş)
 * sınav ayarları. Ayarlar en sonda ve KAPALI çünkü ürün "ayar sormayan ürün"
 * olmalı; hazırlayan hiçbir ayara dokunmadan yayınlayabilmeli.
 *
 * SAĞDA CANLI ÖNİZLEME: hazırlayanın en pahalı hatası, yazdığı şeyin kioskta
 * nasıl göründüğünü ancak yayınladıktan sonra görmesiydi. Önizleme kiosk
 * kartının KENDİSİNİ çiziyor (ithal, kopya değil) — yani burada görünen ile
 * sahada görünen aynı koddan çıkıyor.
 */
export default function Editor({
  egitim,
  sayfalar,
  sorular,
  rol,
  zorSoruIdleri,
  istatistik,
  medyalar,
  kategoriler,
  hedefEgitimler,
  kirikGorselIdler,
}: {
  egitim: Egitim;
  sayfalar: Sayfa[];
  sorular: Soru[];
  rol: Rol;
  zorSoruIdleri: string[];
  istatistik: { soruId: string; deneme: number; yanlis: number }[];
  medyalar: MedyaOzet[];
  kategoriler: string[];
  /** Kartın kopyalanabileceği diğer TASLAK eğitimler. */
  hedefEgitimler: { id: string; ad: string }[];
  /** Kayıtta duran ama diskte bulunmayan medya kimlikleri. */
  kirikGorselIdler: string[];
}) {
  const router = useRouter();
  const [bekle, gecis] = useTransition();
  const { confirm, dialog } = useConfirm();
  const { show, toast } = useToast();
  const [prova, setProva] = useState(false);
  const [ayarlarAcik, setAyarlarAcik] = useState(false);
  const soruSayisiRef = useRef<HTMLInputElement>(null);
  const [seciliId, setSeciliId] = useState<string | null>(null);
  const [darSekme, setDarSekme] = useState<"duzen" | "onizleme">("duzen");
  /* Kaydedilmemiş tuş vuruşları. Sunucuya yazmak alandan çıkınca olur; bu
     harita YALNIZ önizlemeyi besler, yoksa yazarken yan taraf donuk kalırdı. */
  const [anlik, setAnlik] = useState<Record<string, Record<string, unknown>>>({});
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

  /**
   * ALAN KAYDI — kilitsiz, bilerek.
   *
   * Çift tıklama kilidi ekle/sil/sırala gibi bir kez olması gereken işler için;
   * alandan çıkışta tetiklenen kayıtlar oradan geçmemeli. Bir alandan çıkıp
   * hemen diğerine yazan kişinin İKİNCİ düzenlemesi kilide takılıp sessizce
   * düşüyordu — ve canlı önizleme onu kaydedilmiş gibi göstermeye devam
   * ediyordu, yani veri kaybı ekranda görünmüyordu. Alan yamaları idempotent,
   * sırası bozulsa da aynı sonucu verir.
   */
  function kaydet(is: () => Promise<void>) {
    gecis(async () => {
      try {
        await is();
      } finally {
        router.refresh();
      }
    });
  }

  const yayinaHazir = sayfalar.length > 0;
  /** Yayındayken hiçbir içerik kontrolü çalışmaz (sunucu da reddeder). */
  const kilitli = yayinda;

  const gosterilen = useMemo(() => sayfalar.map((s) => birlestir(s, anlik[s.id])), [sayfalar, anlik]);
  const secili = gosterilen.find((s) => s.id === seciliId) ?? gosterilen[0] ?? null;
  const seciliSira = secili ? gosterilen.findIndex((s) => s.id === secili.id) + 1 : 0;

  const istatistikHarita = useMemo(() => new Map(istatistik.map((i) => [i.soruId, i])), [istatistik]);
  const kontrol = useMemo(
    () => yayinKontrolu(egitim, gosterilen, sorular, kirikGorselIdler),
    [egitim, gosterilen, sorular, kirikGorselIdler],
  );

  function anlikYaz(sayfaId: string, yama: Record<string, unknown>) {
    setAnlik((a) => ({ ...a, [sayfaId]: { ...a[sayfaId], ...yama } }));
  }

  function medyaSil(id: string) {
    calistir(() => medyaSilEylem(id, egitim.id));
  }

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
            {!yayinda ? <YayinRozeti liste={kontrol} /> : null}
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

      <div className="sayfa-govde">
        {/* DAR EKRANDA SEKME: önizleme editörün altına yığılsaydı hazırlayan
            yazdığı kartı görmek için her seferinde aşağı kaydırırdı; yan yana
            sığmadığı yerde ikisinden BİRİ görünür. */}
        <div className="mb-5 inline-flex gap-1 rounded-full border border-line bg-white p-1 xl:hidden">
          <SekmeDugmesi etkin={darSekme === "duzen"} onBas={() => setDarSekme("duzen")}>
            <Icon name="pencil" size={15} /> Düzenle
          </SekmeDugmesi>
          <SekmeDugmesi etkin={darSekme === "onizleme"} onBas={() => setDarSekme("onizleme")}>
            <Icon name="monitor" size={15} /> Önizleme
          </SekmeDugmesi>
        </div>

        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_26rem] xl:items-start">
          <div className={`space-y-8 ${darSekme === "onizleme" ? "hidden xl:block" : ""}`}>
            {yayinda ? (
              /* Yayındaki eğitim bir KAYITTIR: tamamlanmış oturumlar "sürüm N"e
                 atıf yapıyor. İçeriği yerinde değiştirmek, insanların kayıtta
                 yazandan başka bir şeyden sınav olmuş görünmesi demek. */
              <p className="rounded-xl border border-orta/40 bg-orta/5 px-4 py-3 text-sm">
                <strong>Yayında — düzenleme kapalı.</strong>{" "}
                {onaylayabilir
                  ? "Değişiklik için önce Taslağa alın; yeniden yayınlandığında sürüm numarası artar."
                  : "Değişiklik için onaylayan rolündeki bir kişi eğitimi taslağa almalı."}
              </p>
            ) : null}

            {!onaylayabilir && !yayinda ? (
              <p className="rounded-xl border border-line bg-white px-4 py-3 text-sm text-muted">
                Hazırladığınız eğitimi <strong className="text-ink">onaylayan</strong> rolündeki bir kişi yayına alır.
                İçerik kalitesinin tek güvencesi bu ikinci gözdür.
              </p>
            ) : null}

            {/* ── tanım ── */}
            <section>
              <h2 className="eyebrow mb-3">Tanım</h2>
              <TanimBolumu
                egitim={egitim}
                kategoriler={kategoriler}
                kilitli={kilitli}
                onGuncelle={(yama) => kaydet(() => egitimGuncelleEylem(egitim.id, yama))}
              />
            </section>

            {/* ── içerik ── */}
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="eyebrow">İçerik · {sayfalar.length} sayfa</h2>
              </div>

              {sayfalar.length === 0 && !kilitli ? (
                <PdfYukle
                  egitimId={egitim.id}
                  onBitti={async (kartlar) => {
                    await sayfalariTopluEkleEylem(egitim.id, kartlar);
                    router.refresh();
                  }}
                />
              ) : null}

              <div className="mt-4 space-y-3">
                {gosterilen.map((s, i) => (
                  <SayfaSatiri
                    key={s.id}
                    sayfa={s}
                    sira={i + 1}
                    toplam={gosterilen.length}
                    secili={secili?.id === s.id}
                    medyalar={medyalar}
                    hedefEgitimler={hedefEgitimler}
                    kilitli={kilitli}
                    onSec={() => setSeciliId(s.id)}
                    onAnlik={(yama) => anlikYaz(s.id, yama)}
                    onGuncelle={(yama) => kaydet(() => sayfaGuncelleEylem(egitim.id, s.id, yama))}
                    onMedyaSil={medyaSil}
                    onCogalt={() => calistir(() => kartCogaltEylem(egitim.id, s.id))}
                    onKopyala={(hedefId) =>
                      calistir(async () => {
                        await kartKopyalaEylem(egitim.id, s.id, hedefId);
                        show(`Kart "${hedefEgitimler.find((e) => e.id === hedefId)?.ad ?? "eğitime"}" kopyalandı`);
                      })
                    }
                    onSil={() =>
                      confirm(
                        { title: "Sayfa silinsin mi?", message: `"${s.baslik || KART_ETIKET[s.tip]}" kalıcı olarak silinir.`, danger: true },
                        () => calistir(() => sayfaSilEylem(egitim.id, s.id)),
                      )
                    }
                    onTasi={(yon) => {
                      const yeni = [...gosterilen];
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
                  <button key={t} disabled={kilitli} onClick={() => calistir(() => sayfaEkleEylem(egitim.id, t))} className="btn-ghost text-sm">
                    <Icon name="plus" size={16} /> {KART_ETIKET[t]}
                  </button>
                ))}
              </div>

              {sayfalar.length > 0 && !kilitli ? (
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

              {/* Uyarı ÇÖZÜMÜ AÇAR. Sınav ayarları katlanmış bir bölümde
                  duruyor; sorunu görüp düzeltmesini kapalı bir kutunun içinde
                  aratmak, uyarıyı "okundu geçildi" satırına çevirir. */}
              {sorular.length > 0 && sorular.length < egitim.soruSayisi ? (
                <p className="mb-3 rounded-xl border border-orta/30 bg-orta/5 px-4 py-3 text-sm font-semibold text-orta-dark">
                  Havuzda {sorular.length} soru var, sınavda {egitim.soruSayisi} soru sorulacak. Havuz sınavdan küçükse
                  herkese aynı sorular gelir — karıştırmanın anlamı kalmaz.{" "}
                  {kilitli ? null : (
                    <button
                      type="button"
                      onClick={() => {
                        setAyarlarAcik(true);
                        // Bölüm bu tıklamayla çiziliyor; odak bir sonraki
                        // çizim turunda aranır, yoksa alan henüz yoktur.
                        requestAnimationFrame(() => soruSayisiRef.current?.focus());
                      }}
                      className="underline underline-offset-2"
                    >
                      Sınav ayarlarını aç
                    </button>
                  )}
                </p>
              ) : null}

              <div className="space-y-3">
                {sorular.map((s, i) => (
                  <SoruSatiri
                    key={s.id}
                    soru={s}
                    sira={i + 1}
                    zor={zorSoruIdleri.includes(s.id)}
                    istatistik={istatistikHarita.get(s.id)}
                    medyalar={medyalar}
                    kilitli={kilitli}
                    onMedyaSil={medyaSil}
                    onGuncelle={(yama) => kaydet(() => soruGuncelleEylem(egitim.id, s.id, yama as Partial<Soru>))}
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
                  <button key={t} disabled={kilitli} onClick={() => calistir(() => soruEkleEylem(egitim.id, t))} className="btn-ghost text-sm">
                    <Icon name="plus" size={16} /> {SORU_ETIKET[t]}
                  </button>
                ))}
              </div>
            </section>

            {/* ── yayına hazırlık ──
                ENGELLEMEZ, SÖYLER: hazırlayan uyarılara rağmen yayınlayabilir.
                Zorunlu tutulan her kontrol ikinci haftada anlamsız bir başlık
                yazılarak aşılır; görünür bir liste ise gerçekten okunuyor. */}
            {!yayinda ? (
              <section>
                <h2 className="eyebrow mb-3">Yayına hazırlık</h2>
                <YayinKontrol liste={kontrol} />
              </section>
            ) : null}

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
                    kilitli={kilitli}
                    etiket="Geçme notu"
                    deger={egitim.gecmeNotu}
                    onDegis={(v) => kaydet(() => egitimGuncelleEylem(egitim.id, { gecmeNotu: v }))}
                  />
                  <Sayi
                    kilitli={kilitli}
                    etiket="Deneme hakkı"
                    deger={egitim.denemeHakki}
                    onDegis={(v) => kaydet(() => egitimGuncelleEylem(egitim.id, { denemeHakki: v }))}
                  />
                  <Sayi
                    kilitli={kilitli}
                    etiket="Sınavdaki soru sayısı"
                    girdiRef={soruSayisiRef}
                    deger={egitim.soruSayisi}
                    onDegis={(v) => kaydet(() => egitimGuncelleEylem(egitim.id, { soruSayisi: v }))}
                  />
                  <Sayi
                    kilitli={kilitli}
                    etiket="Tekrar (ay) — boş: tekrar yok"
                    deger={egitim.tekrarAy ?? 0}
                    onDegis={(v) => kaydet(() => egitimGuncelleEylem(egitim.id, { tekrarAy: v || undefined }))}
                  />
                  <label className="flex items-center gap-3 sm:col-span-2">
                    <input
                      type="checkbox"
                      disabled={kilitli}
                      defaultChecked={egitim.karisik}
                      onChange={(e) => kaydet(() => egitimGuncelleEylem(egitim.id, { karisik: e.target.checked }))}
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

          {/* `top-20`: başlık şeridi yapışkan (sticky) ve ~64px — önizleme
              onun altına yerleşmezse kaydırınca başlığın arkasına giriyor. */}
          <aside className={`xl:sticky xl:top-20 ${darSekme === "duzen" ? "hidden xl:block" : ""}`}>
            <CanliOnizleme sayfa={secili} sira={seciliSira} toplam={gosterilen.length} />
            {secili ? (
              <p className="mt-2 px-1 text-xs text-muted">
                Düzenlediğiniz kart burada gösterilir. Kiosk kartının kendisi çiziliyor — sahada göreceğiniz şey bu.
              </p>
            ) : null}
          </aside>
        </div>
      </div>

      {prova ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-paper">
          <EgitimOyun
            egitim={egitim}
            sayfalar={gosterilen}
            sorular={sorular}
            oturumId={`prova_${egitim.id}`}
            prova
            onCik={() => setProva(false)}
          />
        </div>
      ) : null}

      {dialog}
      {toast}
    </main>
  );
}

/**
 * Sunucudan gelen sayfa + kaydedilmemiş tuş vuruşları.
 *
 * MODÜL SEVİYESİNDE (kapanış DEĞİL): `csv.ts`teki küçültücü tuzağı — parametre
 * yakalayıp birden çok kez çağrılan yardımcı — burada da mümkündü.
 *
 * Boşaltılan alanlar depoya `null` gidiyor; tipte karşılığı `undefined`.
 */
const BOSALABILIR = ["gorselId", "videoId", "metin", "metinKarsi"];

function birlestir(sayfa: Sayfa, yama?: Record<string, unknown>): Sayfa {
  if (!yama) return sayfa;
  const b: Record<string, unknown> = { ...sayfa, ...yama };
  for (const alan of BOSALABILIR) if (b[alan] === null) b[alan] = undefined;
  return b as unknown as Sayfa;
}

function SekmeDugmesi({ etkin, onBas, children }: { etkin: boolean; onBas: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onBas}
      aria-pressed={etkin}
      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
        etkin ? "bg-accent text-white" : "text-muted hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function Sayi({
  etiket,
  deger,
  onDegis,
  kilitli,
  girdiRef,
}: {
  etiket: string;
  deger: number;
  onDegis: (v: number) => void;
  kilitli?: boolean;
  girdiRef?: React.RefObject<HTMLInputElement>;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold">{etiket}</span>
      <input
        ref={girdiRef}
        type="number"
        disabled={kilitli}
        defaultValue={deger}
        min={0}
        onBlur={(e) => Number(e.target.value) !== deger && onDegis(Number(e.target.value))}
        className="input-base"
      />
    </label>
  );
}
