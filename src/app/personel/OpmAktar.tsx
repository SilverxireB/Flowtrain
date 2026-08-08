"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import type { AktarimSonucu } from "@/lib/adaptor";
import { opmIceAktarEylem } from "./eylemler";

/**
 * OPM DIŞA AKTARIM DOSYASI — sicil · ad soyad · maliyet merkezi.
 *
 * Kapalı ağ kuralı: OPM'e BAĞLANMIYORUZ; kullanıcı OPM'den indirdiği CSV'yi
 * buraya bırakıyor. Var olan sicil güncellenir, yeni sicil eklenir, dosyada
 * olup OPM'de olmayan kayıt silinmez.
 */
export default function OpmAktar() {
  const router = useRouter();
  const dosyaRef = useRef<HTMLInputElement>(null);
  const [metin, setMetin] = useState("");
  const [dosyaAdi, setDosyaAdi] = useState<string | null>(null);
  const [sonuc, setSonuc] = useState<AktarimSonucu | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [calisiyor, setCalisiyor] = useState(false);

  function dosyaSecildi(f: File | undefined) {
    if (!f) return;
    setDosyaAdi(f.name);
    setSonuc(null);
    setHata(null);
    const okuyucu = new FileReader();
    okuyucu.onload = () => setMetin(String(okuyucu.result ?? ""));
    okuyucu.readAsText(f, "utf-8");
  }

  async function aktar() {
    if (calisiyor || !metin.trim()) return;
    setCalisiyor(true);
    setHata(null);
    setSonuc(null);
    const c = await opmIceAktarEylem(metin);
    setCalisiyor(false);
    if (c.hata) return setHata(c.hata);
    setSonuc(c.sonuc!);
    setMetin("");
    setDosyaAdi(null);
    if (dosyaRef.current) dosyaRef.current.value = "";
    router.refresh();
  }

  return (
    <section className="card mt-4 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-lacivert/10 text-lacivert">
          <Icon name="upload" size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">OPM dosyası içe aktar</p>
          <p className="text-sm text-muted">
            Sicil, ad soyad ve maliyet merkezi sütunlu CSV. Var olan kayıtlar güncellenir, yenileri eklenir — kimse
            silinmez.
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
        }}
        placeholder={"Ya da içeriği buraya yapıştırın:\nSicil;Ad Soyad;Maliyet Merkezi\n10109369;Bülent Sandıkçı;264302"}
        rows={4}
        className="input-base mt-4 font-mono text-xs"
      />

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {dosyaAdi ? (
          <span className="chip text-xs">
            <Icon name="check" size={14} /> {dosyaAdi} okundu
          </span>
        ) : null}
        <button onClick={aktar} disabled={calisiyor || !metin.trim()} className="btn-primary ml-auto text-sm disabled:opacity-60">
          <Icon name="upload" size={16} /> {calisiyor ? "Aktarılıyor…" : "İçe aktar"}
        </button>
      </div>

      {hata ? (
        <p role="alert" className="mt-3 rounded-xl border border-brand/30 bg-brand-soft px-3 py-2 text-sm font-semibold text-brand-dark">
          {hata}
        </p>
      ) : null}

      {sonuc ? (
        <div className="mt-3 rounded-xl border border-iyi/40 bg-iyi/10 px-3 py-2 text-sm">
          <p className="font-semibold text-iyi-dark">
            Aktarım tamam: {sonuc.yeni} yeni kayıt, {sonuc.guncellenen} güncelleme.
          </p>
          {sonuc.eslemesizKodlar.length > 0 ? (
            <p className="mt-1 text-muted">
              Eşlemesi tanımsız {sonuc.eslemesizKodlar.length} kod var (bölüm/amir boş kaldı):{" "}
              <span className="font-mono text-xs">{sonuc.eslemesizKodlar.join(", ")}</span>. Yukarıdan eşlemeyi
              tanımlayıp &quot;Tüm listeye uygula&quot; deyin.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
