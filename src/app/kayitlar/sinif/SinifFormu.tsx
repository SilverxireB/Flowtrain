"use client";

import { useState } from "react";
import Icon from "@/components/Icon";
import { useConfirm } from "@/components/ConfirmDialog";
import RaporOzeti from "../RaporOzeti";
import { sinifDenetleEylem, sinifKaydetEylem, type SinifGirdisi } from "../eylemler";
import type { AktarimRaporu } from "@/lib/kayitAktarim";
import FlowSecici from "@/components/FlowSecici";

interface EgitimSecenegi {
  id: string;
  ad: string;
  durum: "taslak" | "yayin";
  egitmen: string;
  sureDk?: number;
}

/** Defterden "düzelt" ile gelindiğinde alanları dolduran başlangıç değerleri. */
export interface DuzeltmeBaslangici {
  duzeltilen: string;
  egitimId: string;
  gun: string;
  liste: string;
  egitmen: string;
  egitimAdi: string;
}

/**
 * SINIF KAYIT FORMU — iki adım: DENETLE, sonra KAYDET.
 *
 * Tek adım olsaydı otuz kişilik bir listede tek harf hatası olan sicil sessizce
 * atlanır, eğitmen de "girdim" sanırdı. Denetim adımı listeyi kaydetmeden önce
 * kimin gireceğini, kimin neden atlanacağını gösterir.
 *
 * DÜZELTME KİPİ aynı formdur, yalnız bir kaydı işaret eder ve bunu ekranda
 * açıkça söyler. Kullanıcı "silme düğmesi nerede" diye aramasın, düzeltmenin
 * ürünün içinde bir yolu olduğunu görsün diye kip gizlenmiyor: üstte hangi
 * kaydın yerine geçtiği, altta iki satırın da defterde kalacağı yazıyor.
 */
export default function SinifFormu({
  egitimler,
  bugunGun,
  baslangic,
}: {
  egitimler: EgitimSecenegi[];
  bugunGun: string;
  baslangic?: DuzeltmeBaslangici;
}) {
  const { confirm, dialog } = useConfirm();
  const [egitimId, setEgitimId] = useState(baslangic?.egitimId ?? "");
  const [gun, setGun] = useState(baslangic?.gun ?? bugunGun);
  const [egitmen, setEgitmen] = useState(baslangic?.egitmen ?? "");
  const [notlar, setNotlar] = useState("");
  const [liste, setListe] = useState(baslangic?.liste ?? "");
  const [rapor, setRapor] = useState<AktarimRaporu | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [calisiyor, setCalisiyor] = useState(false);

  const secilen = egitimler.find((e) => e.id === egitimId);

  function girdi(): SinifGirdisi {
    return { egitimId, gun, egitmen, notlar, liste, duzeltilen: baslangic?.duzeltilen };
  }

  /** Eğitim seçilince eğitmen alanı katalogdaki varsayılanla dolar (elle silinebilir). */
  function egitimSec(id: string) {
    setEgitimId(id);
    setRapor(null);
    const e = egitimler.find((x) => x.id === id);
    if (e?.egitmen && !egitmen.trim()) setEgitmen(e.egitmen);
  }

  async function denetle() {
    if (calisiyor) return;
    setCalisiyor(true);
    setHata(null);
    const c = await sinifDenetleEylem(girdi());
    setCalisiyor(false);
    if (c.hata) {
      setRapor(null);
      return setHata(c.hata);
    }
    setRapor(c.rapor ?? null);
  }

  /**
   * BAŞARIDA BURAYA DÖNÜLMEZ: eylem yazmayı bitirince sonucu adrese koyup
   * yönlendiriyor (`eylemler.ts` → `sonucaDon`) ve onayı sayfa sunucudan
   * çiziyor. Sonucu burada durumda tutmak, `revalidatePath` bileşeni yeniden
   * kurduğu için kullanıcının hiçbir onay görmemesi demekti.
   *
   * Geriye yalnız HATA yolu kalıyor: o zaman eylem olağan şekilde dönüyor ve
   * mesaj formun üstünde gösteriliyor.
   */
  async function kaydet() {
    if (calisiyor) return;
    setCalisiyor(true);
    setHata(null);
    const c = await sinifKaydetEylem(girdi());
    setCalisiyor(false);
    if (c?.hata) setHata(c.hata);
  }

  /* GENİŞLİK KABUKTAN GELİR. Bu iki sayfa kendi `max-w-3xl`ini taşıyordu:
     kokpitin geri kalanı `sayfa-kap` (max-w-7xl) ile çizilirken burası
     768px'te kalıyor, geniş ekranda sayfalar arasında gezerken içerik
     bir daralıp bir genişliyordu. globals.css'teki "kokpitin tek
     genişliği" kuralı tam olarak bunu yasaklıyor. */
  return (
    <div>
      {baslangic ? (
        /* DÜZELTMENİN NE OLDUĞU VE NE OLMADIĞI, kaydetmeden önce.
           "Düzeltme" kelimesi kullanıcıya eski satırın gideceğini düşündürür;
           gitmiyor. Bunu kaydettikten SONRA öğrenmek, ürüne olan güveni
           kaydın kendisinden önce sarsar. */
        <div className="card border-accent/40 bg-accent/5 p-5 text-sm">
          <p className="font-semibold text-ink">
            Bu bir düzeltme kaydı — <span className="font-mono text-xs">{baslangic.duzeltilen}</span> numaralı kaydın
            yerine geçer.
          </p>
          <p className="mt-1.5 text-muted">
            Düzeltilen kayıt: <strong className="text-ink">{baslangic.egitimAdi}</strong> · sicil{" "}
            <span className="font-mono text-xs">{baslangic.liste}</span> · {baslangic.gun}
          </p>
          <p className="mt-2 text-muted">
            <strong className="text-ink">Eski satır silinmez, defterde kalır.</strong> Yeni satır onun yerine geçtiğini
            notunda taşır; defter iki satırı da &quot;düzeltildi / düzeltme kaydı&quot; olarak işaretler ve denetçi
            zincirin tamamını görür. Doğru olanı gizlemek değil, yanlışın ne zaman ve kim tarafından düzeltildiğini
            göstermek denetimde işe yarar.
          </p>
          <p className="mt-2 text-muted">
            Aynı kişi ve aynı gün için ikinci kayıt normalde &quot;zaten var&quot; diye atlanır; düzeltme kaydında bu
            denetim bilerek aşılır.
          </p>
        </div>
      ) : (
        <p className="card p-5 text-sm text-muted">
          Eğitmen sınıfta anlattı, katılım listesi burada deftere geçer. Kayıtlar{" "}
          <strong className="text-ink">Sınıf eğitimi</strong> kaynağıyla işaretlenir — kioskta yapılmış gibi
          görünmezler. Bir kez yazılan kayıt <strong className="text-ink">düzenlenmez ve silinmez</strong>; yanlış bir
          kaydı düzeltmek için defterde o kaydı açın ve <strong className="text-ink">Düzeltme kaydı</strong> düğmesini
          kullanın — iki satır da defterde kalır, bağı görünür.
        </p>
      )}

      <div className="card mt-4 space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-semibold text-muted">Eğitim</span>
            <FlowSecici value={egitimId} onChange={egitimSec} sinif="mt-1" aria-label="Eğitim">
              <option value="">Seçin…</option>
              {egitimler.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.ad}
                  {e.durum !== "yayin" ? " (taslak)" : ""}
                </option>
              ))}
            </FlowSecici>
            {secilen && secilen.durum !== "yayin" ? (
              <span className="mt-1 block text-xs text-orta-dark">
                Bu eğitim yayında değil. Kayıt yine de yazılır ama kayıtlar &quot;sürüm N&quot;e atıf yapar — taslak
                içerik daha sonra değişebilir.
              </span>
            ) : null}
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-muted">Tarih</span>
            <input type="date" value={gun} onChange={(e) => setGun(e.target.value)} className="input-base mt-1" />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-muted">Eğitmen</span>
            <input
              value={egitmen}
              onChange={(e) => setEgitmen(e.target.value)}
              placeholder="Dersi veren kişi"
              className="input-base mt-1"
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-muted">
              {baslangic ? "Düzeltme gerekçesi" : "Not (isteğe bağlı)"}
            </span>
            <input
              value={notlar}
              onChange={(e) => setNotlar(e.target.value)}
              placeholder={
                baslangic ? "Ör. Sicil yanlış girilmiş, doğrusu bu kayıttır" : "Ör. Yerinde tatbikatla birlikte"
              }
              className="input-base mt-1"
            />
            {baslangic ? (
              <span className="mt-1 block text-xs text-muted">
                Gerekçe zorunlu ve kaydın notuna &quot;{baslangic.duzeltilen} numaralı kaydın yerine geçer&quot;
                ibaresiyle birlikte yazılır.
              </span>
            ) : null}
          </label>
        </div>

        <label className="block">
          <span className="text-xs font-semibold text-muted">Katılımcılar</span>
          <textarea
            value={liste}
            onChange={(e) => {
              setListe(e.target.value);
              setRapor(null);
                      }}
            rows={10}
            placeholder={"Her satıra bir sicil (yanında ad soyad olabilir):\n10109369 Bülent Sandıkçı\n10112044\n10098771 Ayşe Demir"}
            className="input-base mt-1 font-mono text-xs"
          />
          {/* Listeyi TEMİZLEMEYE ZORLAMIYORUZ: eğitmen kâğıttan ya da bir
              e-postadan yapıştırır; satırın ilk parçası sicil sayılır. */}
          <span className="mt-1 block text-xs text-muted">
            Satırın ilk parçası sicil sayılır; gerisi yok sayılır. Kâğıt listeyi olduğu gibi yapıştırabilirsiniz.
          </span>
        </label>

        {hata ? (
          <p
            role="alert"
            className="rounded-flow border border-brand/30 bg-brand-soft px-3 py-2 text-sm font-semibold text-brand-dark"
          >
            {hata}
          </p>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2">
          <button onClick={denetle} disabled={calisiyor} className="btn-ghost text-sm disabled:opacity-60">
            <Icon name="eye" size={16} /> {calisiyor ? "Bakılıyor…" : "Listeyi denetle"}
          </button>
          <button
            onClick={() =>
              confirm(
                {
                  title: baslangic ? "Düzeltme kaydı yazılsın mı?" : "Kayıtlar yazılsın mı?",
                  message: baslangic
                    ? `${baslangic.duzeltilen} numaralı kaydın yerine geçen yeni bir kayıt oluşturulacak.\n\nESKİ KAYIT SİLİNMEZ, defterde kalır. İki satır da denetim izinde görünür.`
                    : `${rapor?.gecerli ?? 0} kişi için tamamlama kaydı oluşturulacak.\n\nKayıtlar sonradan düzenlenemez ve silinemez.`,
                  confirmLabel: "Kaydet",
                },
                kaydet,
              )
            }
            disabled={calisiyor || !rapor || rapor.gecerli === 0}
            className="btn-primary text-sm disabled:opacity-40"
          >
            <Icon name="save" size={16} /> Kaydet{rapor && rapor.gecerli > 0 ? ` (${rapor.gecerli})` : ""}
          </button>
        </div>
      </div>

      {rapor ? <RaporOzeti rapor={rapor} /> : null}
      {dialog}
    </div>
  );
}
