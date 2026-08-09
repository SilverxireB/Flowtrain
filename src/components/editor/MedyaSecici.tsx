"use client";

import { useRef, useState } from "react";
import Icon from "@/components/Icon";
import { useConfirm } from "@/components/ConfirmDialog";
import { boyutMetni, gorselMi, type MedyaOzet } from "@/lib/editorMedya";

/**
 * MEDYA SEÇİCİ — "yükle" ile "kütüphaneden seç" TEK pencerede.
 *
 * Ayrı iki düğme olsaydı hazırlayan kütüphanenin varlığını hiç öğrenmezdi:
 * eldeki alışkanlık "yükle"ye basmak, dolayısıyla aynı KKD fotoğrafı yirmi kez
 * diske yazılırdı. Pencere açıldığında ÖNCE var olanlar görünür, yükleme
 * yukarıda tek satır olarak durur.
 *
 * Silme burada, listede: kütüphaneyi ayrı bir yönetim ekranına taşımak
 * "sonra temizlerim" demekti — kimse temizlemezdi. Aynı sebeple ALT METİN de
 * burada: görselin ne gösterdiğini yazacak an, onu seçtiğiniz andır.
 */
export default function MedyaSecici({
  tur,
  medyalar,
  onSec,
  onKapat,
  onMedyaSil,
  onAltMetin,
}: {
  /** Görsel mi video mu aranıyor — kütüphane buna göre süzülür. */
  tur: "gorsel" | "video";
  medyalar: MedyaOzet[];
  /** Seçilen (ya da yeni yüklenen) medyanın kimliği. */
  onSec: (id: string) => void;
  onKapat: () => void;
  onMedyaSil: (id: string) => void;
  onAltMetin: (medyaId: string, altMetin: string) => void;
}) {
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [arama, setArama] = useState("");
  const dosyaGirdi = useRef<HTMLInputElement>(null);
  const { confirm, dialog } = useConfirm();

  const video = tur === "video";

  async function dosyaSec(e: React.ChangeEvent<HTMLInputElement>) {
    const dosya = e.target.files?.[0];
    e.target.value = "";
    if (!dosya) return;

    setYukleniyor(true);
    setHata(null);
    const form = new FormData();
    form.append("dosya", dosya);
    const cevap = await fetch("/api/medya", { method: "POST", body: form });
    const sonuc = await cevap.json();
    setYukleniyor(false);

    if (!cevap.ok) return setHata(sonuc.hata ?? "Yüklenemedi.");
    onSec(sonuc.id);
  }

  const suzulmus = medyalar.filter(
    (m) => gorselMi(m.id) !== video && aramayaUyar(m, arama),
  );

  return (
    /* Perde YALNIZ kendisine basılınca kapanır (`target === currentTarget`).
       Kabarmayı durdurmak yerine hedefe bakmanın sebebi: içeride açılan onay
       penceresi de bu ağacın altında duruyor ve ona basınca seçici de
       kapanıyordu. */
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-black/50 p-4"
      onClick={(e) => e.target === e.currentTarget && onKapat()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={video ? "Video seç" : "Görsel seç"}
        className="animate-pop flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl border border-line bg-white shadow-xl"
      >
        <div className="flex items-center gap-3 border-b border-line px-5 py-4">
          <p className="font-semibold">{video ? "Video seç" : "Görsel seç"}</p>
          <div className="flex-1" />
          <button onClick={onKapat} className="btn-icon" aria-label="Kapat">
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
          <button onClick={() => dosyaGirdi.current?.click()} disabled={yukleniyor} className="btn-primary text-sm">
            <Icon name="upload" size={16} /> {yukleniyor ? "Yükleniyor…" : "Bilgisayardan yükle"}
          </button>
          <input
            ref={dosyaGirdi}
            type="file"
            accept={video ? "video/mp4,video/webm" : "image/png,image/jpeg,image/webp,image/gif"}
            onChange={dosyaSec}
            className="hidden"
          />
          <input
            value={arama}
            onChange={(e) => setArama(e.target.value)}
            placeholder="Kütüphanede ara"
            className="input-base w-auto min-w-[12rem] flex-1 py-2"
          />
        </div>

        {hata ? (
          <p role="alert" className="mx-5 mt-4 rounded-xl border border-brand/30 bg-brand-soft px-4 py-2.5 text-sm font-semibold text-brand-dark">
            {hata}
          </p>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {!video && suzulmus.length > 0 ? (
            <p className="mb-3 text-xs text-muted">
              Alt metin <strong>ekran okuyucuya</strong> okunur: görselin ne gösterdiğini yazın, dosya adını değil.
              Bir kez yazılır, görselin kullanıldığı her kartta geçerlidir.
            </p>
          ) : null}

          {suzulmus.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
              {medyalar.length === 0
                ? "Kütüphane henüz boş. Yüklediğiniz her görsel buraya düşer ve bir daha yüklemeniz gerekmez."
                : "Aramaya uyan medya yok."}
            </p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {suzulmus.map((m) => (
                <li key={m.id} className="group relative">
                  <button
                    onClick={() => onSec(m.id)}
                    className="w-full overflow-hidden rounded-xl border border-line text-left transition hover:border-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent-soft"
                  >
                    {video ? (
                      <span className="grid h-24 w-full place-items-center bg-paper text-muted">
                        <Icon name="video" size={28} />
                      </span>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/api/medya/${m.id}`} alt="" className="h-24 w-full bg-paper object-cover" />
                    )}
                    <span className="block px-2.5 py-2">
                      <span className="block truncate text-xs font-semibold">{m.ad || m.id}</span>
                      <span className="block text-[11px] text-muted">
                        {boyutMetni(m.boyut)}
                        {m.kullanim > 0 ? ` · ${m.kullanim} yerde` : " · kullanılmıyor"}
                      </span>
                    </span>
                  </button>

                  {!video ? (
                    <input
                      defaultValue={m.altMetin ?? ""}
                      onBlur={(e) => e.target.value !== (m.altMetin ?? "") && onAltMetin(m.id, e.target.value)}
                      placeholder="Bu görsel ne gösteriyor?"
                      aria-label={`${m.ad || m.id} için alt metin`}
                      className="input-base mt-1 px-2 py-1 text-[11px]"
                    />
                  ) : null}

                  <button
                    onClick={() =>
                      confirm(
                        {
                          title: "Medya silinsin mi?",
                          message:
                            m.kullanim > 0
                              ? `Bu görsel ${m.kullanim} kartta/soruda kullanılıyor. Silerseniz oralarda boş kalır.`
                              : "Dosya kütüphaneden ve diskten kalkar.",
                          danger: true,
                          confirmLabel: "Sil",
                        },
                        () => onMedyaSil(m.id),
                      )
                    }
                    className="btn-icon absolute right-1 top-1 bg-white/90 opacity-0 transition-opacity hover:text-brand focus-visible:opacity-100 group-hover:opacity-100"
                    aria-label={`${m.ad || m.id} medyasını sil`}
                  >
                    <Icon name="trash" size={15} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {dialog}
    </div>
  );
}

/**
 * Arama hem dosya adında hem ALT METİNDE arar.
 *
 * MODÜL SEVİYESİNDE: `csv.ts`teki küçültücü tuzağı — parametre yakalayıp
 * birden çok kez çağrılan yardımcı — burada da mümkündü.
 *
 * Alt metinde aramanın sebebi: dosya adı `mdy_lz3k9a.jpg`, açıklama ise
 * "baret takmış kaynakçı". Aranan şey ikincisidir.
 */
function aramayaUyar(m: MedyaOzet, arama: string): boolean {
  if (arama.trim() === "") return true;
  const a = arama.toLocaleLowerCase("tr");
  return (
    m.ad.toLocaleLowerCase("tr").includes(a) || (m.altMetin ?? "").toLocaleLowerCase("tr").includes(a)
  );
}
