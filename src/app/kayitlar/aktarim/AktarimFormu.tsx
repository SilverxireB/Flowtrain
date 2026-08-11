"use client";

import { useRef, useState } from "react";
import Icon from "@/components/Icon";
import { useConfirm } from "@/components/ConfirmDialog";
import RaporOzeti from "../RaporOzeti";
import { aktarimDenetleEylem, aktarimUygulaEylem } from "../eylemler";
import type { AktarimAlani, AktarimRaporu } from "@/lib/kayitAktarim";

const ALAN_ADI: Record<AktarimAlani, string> = {
  sicil: "Sicil (zorunlu)",
  egitim: "Eğitim adı (zorunlu)",
  tarih: "Tamamlama tarihi (zorunlu)",
  puan: "Puan",
  egitmen: "Eğitmen",
  notlar: "Not",
};

/**
 * AKTARIM FORMU — ÖNCE DENETLE, SONRA UYGULA.
 *
 * Tek adımlı bir aktarım, yanlış sütun eşlemesiyle beş yüz kaydı sessizce
 * yazardı ve geri alma yolu yoktu (kayıt silinmez). Denetim adımı, dosyanın
 * hangi sütunları nasıl okuduğunu ve hangi satırın neden atlanacağını
 * yazmadan ÖNCE gösterir.
 */
export default function AktarimFormu({ takmalar }: { takmalar: Record<AktarimAlani, string[]> }) {
  const { confirm, dialog } = useConfirm();
  const dosyaRef = useRef<HTMLInputElement>(null);
  const [metin, setMetin] = useState("");
  const [dosyaAdi, setDosyaAdi] = useState<string | null>(null);
  const [rapor, setRapor] = useState<AktarimRaporu | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [calisiyor, setCalisiyor] = useState(false);

  function sifirla() {
    setRapor(null);
    setHata(null);
  }

  function dosyaSecildi(f: File | undefined) {
    if (!f) return;
    setDosyaAdi(f.name);
    sifirla();
    const okuyucu = new FileReader();
    okuyucu.onload = () => setMetin(String(okuyucu.result ?? ""));
    okuyucu.readAsText(f, "utf-8");
  }

  async function denetle() {
    if (calisiyor || !metin.trim()) return;
    setCalisiyor(true);
    sifirla();
    const c = await aktarimDenetleEylem(metin);
    setCalisiyor(false);
    setRapor(c.rapor ?? null);
    if (c.hata) setHata(c.hata);
  }

  /**
   * BAŞARIDA BURAYA DÖNÜLMEZ — sınıf formuyla aynı gerekçe: eylem sonucu
   * adrese koyup yönlendiriyor, onayı sayfa sunucudan çiziyor
   * (`eylemler.ts` → `sonucaDon`). Geriye yalnız hata yolu kalıyor.
   */
  async function uygula() {
    if (calisiyor) return;
    setCalisiyor(true);
    setHata(null);
    const c = await aktarimUygulaEylem(metin);
    setCalisiyor(false);
    if (c?.rapor) setRapor(c.rapor);
    if (c?.hata) setHata(c.hata);
  }

  /* GENİŞLİK KABUKTAN GELİR. Bu iki sayfa kendi `max-w-3xl`ini taşıyordu:
     kokpitin geri kalanı `sayfa-kap` (max-w-7xl) ile çizilirken burası
     768px'te kalıyor, geniş ekranda sayfalar arasında gezerken içerik
     bir daralıp bir genişliyordu. globals.css'teki "kokpitin tek
     genişliği" kuralı tam olarak bunu yasaklıyor. */
  return (
    <div>
      <p className="card p-5 text-sm text-muted">
        Dış sistemden gelen eski tamamlamaları deftere alır. Kayıtlar{" "}
        <strong className="text-ink">Dış aktarım</strong> kaynağıyla işaretlenir. Aynı kişi, aynı eğitim ve aynı tarih
        için kayıt zaten varsa satır atlanır — dosyayı ikinci kez yüklemek kayıtları çoğaltmaz.
      </p>

      <section className="card mt-4 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-lacivert/10 text-lacivert">
            <Icon name="upload" size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">CSV dosyası</p>
            <p className="text-sm text-muted">
              Başlık satırı olan CSV. Ayırıcı `;` ya da `,` olabilir; sütun adları esnektir.
            </p>
          </div>
          <label className="btn-ghost shrink-0 cursor-pointer text-sm">
            <Icon name="folder" size={16} /> Dosya seç
            <input
              ref={dosyaRef}
              type="file"
              accept=".csv,text/csv,text/plain"
              className="hidden"
              onChange={(e) => dosyaSecildi(e.target.files?.[0])}
            />
          </label>
        </div>

        <textarea
          value={metin}
          onChange={(e) => {
            setMetin(e.target.value);
            setDosyaAdi(null);
            sifirla();
          }}
          rows={6}
          placeholder={
            "Ya da içeriği buraya yapıştırın:\nSicil;Eğitim;Tarih;Puan\n10109369;Yüksekte Çalışma;12.03.2024;85"
          }
          className="input-base mt-4 font-mono text-xs"
        />

        <div className="mt-3 flex flex-wrap items-center gap-3">
          {dosyaAdi ? (
            <span className="chip text-xs">
              <Icon name="check" size={14} /> {dosyaAdi} okundu
            </span>
          ) : null}
          <div className="ml-auto flex gap-2">
            <button
              onClick={denetle}
              disabled={calisiyor || !metin.trim()}
              className="btn-ghost text-sm disabled:opacity-60"
            >
              <Icon name="eye" size={16} /> {calisiyor ? "Bakılıyor…" : "Denetle"}
            </button>
            <button
              onClick={() =>
                confirm(
                  {
                    title: "Kayıtlar yazılsın mı?",
                    message: `${rapor?.gecerli ?? 0} tamamlama kaydı deftere eklenecek.\n\nKayıtlar sonradan düzenlenemez ve silinemez.`,
                    confirmLabel: "Aktar",
                  },
                  uygula,
                )
              }
              disabled={calisiyor || !rapor || rapor.gecerli === 0}
              className="btn-primary text-sm disabled:opacity-40"
            >
              <Icon name="upload" size={16} /> Aktar{rapor && rapor.gecerli > 0 ? ` (${rapor.gecerli})` : ""}
            </button>
          </div>
        </div>

        {hata ? (
          <p
            role="alert"
            className="mt-3 rounded-xl border border-brand/30 bg-brand-soft px-3 py-2 text-sm font-semibold text-brand-dark"
          >
            {hata}
          </p>
        ) : null}

        {rapor && Object.keys(rapor.sutunlar).length > 0 ? (
          <div className="mt-3 rounded-xl bg-wash px-3 py-2 text-xs">
            <p className="font-semibold text-muted">Okunan sütunlar</p>
            <p className="mt-1">
              {(Object.keys(rapor.sutunlar) as AktarimAlani[])
                .map((a) => `${ALAN_ADI[a]} → "${rapor.sutunlar[a]}"`)
                .join("  ·  ")}
            </p>
          </div>
        ) : null}
      </section>

      {rapor ? <RaporOzeti rapor={rapor} /> : null}

      {/* Takma adlar ekranda YAZAR: kullanıcı "sicil sütunu bulunamadı"
          hatasını görüp hangi adları kabul ettiğimizi tahmin etmek zorunda
          kalmasın. Liste koddaki tek kaynaktan gelir, elle yazılmadı. */}
      <details className="card mt-4 p-5 text-sm">
        <summary className="cursor-pointer font-semibold">Kabul edilen sütun adları</summary>
        <ul className="mt-3 space-y-2">
          {(Object.keys(ALAN_ADI) as AktarimAlani[]).map((a) => (
            <li key={a}>
              <span className="font-semibold">{ALAN_ADI[a]}</span>
              <span className="ml-2 text-muted">{takmalar[a].join(", ")}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted">
          Büyük/küçük harf ve Türkçe karakter farkı önemsizdir; başlık bu adlardan birini İÇERİYORSA eşleşir. Tarih
          <code className="mx-1">GG.AA.YYYY</code> ya da <code className="mx-1">YYYY-AA-GG</code> olmalı — ABD biçimi
          (AA/GG/YYYY) bilerek kabul edilmiyor, çünkü <code>05/03/2024</code> iki biçimde de geçerli görünür ve hangisi
          olduğu dosyadan anlaşılamaz.
        </p>
      </details>
      {dialog}
    </div>
  );
}
