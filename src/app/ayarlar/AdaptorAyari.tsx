"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { adaptorAyariKaydetEylem, opmSinaEylem, type SinamaSonucu } from "./adaptorEylemler";

/**
 * PERSONEL KAYNAĞI ve KAYIT HEDEFİ SEÇİMİ.
 *
 * v1'de burada tek seçenek vardı ve bilerek gösterilmiyordu: tek seçenekli bir
 * açılır kutu yalan söyler. OPM adaptörü geldi, seçim gerçek oldu.
 *
 * KİMLİK ANAHTARI EKRANA HİÇ GELMEZ. Sunucu yalnız "var mı yok mu" der; alan
 * boş bırakılırsa mevcut anahtar korunur. Bir yönetici ekranı, sırrı geri
 * göstermek için iyi bir sebep değildir.
 */

export interface AdaptorAyariProps {
  personelSecim: "csv" | "opm";
  kayitSecim: "dosya" | "opm";
  temelAdres: string;
  kimlikBasligi: string;
  anahtarVar: boolean;
  personelYolu: string;
  kayitYolu: string;
  zamanAsimiMs: string;
  onbellekDk: string;
  personelEksikleri: string[];
  kayitEksikleri: string[];
  sonBasariliOkuma: string | null;
  sonOkumaHatasi: string | null;
  sonGonderimHatasi: string | null;
}

function zamanKisa(iso: string | null): string {
  return iso ? iso.slice(0, 16).replace("T", " ") : "—";
}

export default function AdaptorAyari(p: AdaptorAyariProps) {
  const router = useRouter();
  const [personel, setPersonel] = useState(p.personelSecim);
  const [kayit, setKayit] = useState(p.kayitSecim);
  const [adres, setAdres] = useState(p.temelAdres);
  const [basligi, setBasligi] = useState(p.kimlikBasligi);
  const [anahtar, setAnahtar] = useState("");
  const [anahtariSil, setAnahtariSil] = useState(false);
  const [personelYolu, setPersonelYolu] = useState(p.personelYolu);
  const [kayitYolu, setKayitYolu] = useState(p.kayitYolu);
  const [zamanAsimi, setZamanAsimi] = useState(p.zamanAsimiMs);
  const [onbellek, setOnbellek] = useState(p.onbellekDk);

  const [hata, setHata] = useState<string | null>(null);
  const [kaydedildi, setKaydedildi] = useState(false);
  const [sinama, setSinama] = useState<SinamaSonucu | null>(null);
  const [calisiyor, setCalisiyor] = useState(false);

  const opmKullaniliyor = personel === "opm" || kayit === "opm";

  function degisti() {
    setKaydedildi(false);
    setSinama(null);
  }

  async function kaydet() {
    if (calisiyor) return;
    setCalisiyor(true);
    setHata(null);
    setKaydedildi(false);
    const h = await adaptorAyariKaydetEylem({
      personelKaynagi: personel,
      kayitHedefi: kayit,
      temelAdres: adres,
      kimlikBasligi: basligi,
      kimlikAnahtari: anahtar,
      anahtariSil,
      personelYolu,
      kayitYolu,
      zamanAsimiMs: zamanAsimi,
      onbellekDk: onbellek,
    });
    setCalisiyor(false);
    if (h) return setHata(h);
    setAnahtar("");
    setAnahtariSil(false);
    setKaydedildi(true);
    router.refresh();
  }

  async function sina() {
    if (calisiyor) return;
    setCalisiyor(true);
    setSinama(null);
    setSinama(await opmSinaEylem());
    setCalisiyor(false);
  }

  return (
    <div className="card mt-3 space-y-4 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold text-muted">Personel kaynağı</span>
          <select
            value={personel}
            onChange={(e) => {
              setPersonel(e.target.value as "csv" | "opm");
              degisti();
            }}
            className="input-base mt-1 text-sm"
          >
            <option value="csv">CSV dosyası (varsayılan)</option>
            <option value="opm">OPM webservice</option>
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-semibold text-muted">Kayıt hedefi</span>
          <select
            value={kayit}
            onChange={(e) => {
              setKayit(e.target.value as "dosya" | "opm");
              degisti();
            }}
            className="input-base mt-1 text-sm"
          >
            <option value="dosya">Dosya çıktısı — kayitlar.csv (varsayılan)</option>
            <option value="opm">OPM webservice</option>
          </select>
        </label>
      </div>

      <p className="text-xs text-muted">
        OPM seçilse bile kayıt <strong>her zaman</strong> yerel veritabanına yazılır; dış hedefe gitmeyen kayıt
        &quot;gönderilmedi&quot; işaretlenir ve yukarıdaki düğmeyle yeniden denenir. Kayıt sessizce düşmez.
      </p>

      {/* OPM alanları seçim ne olursa olsun görünür: yönetici kurulumu önce
          doldurup sonra devreye almak isteyebilir. */}
      <div className="space-y-3 border-t border-line pt-4">
        <p className="eyebrow">OPM bağlantısı</p>

        <label className="block">
          <span className="text-xs font-semibold text-muted">OPM adresi</span>
          <input
            value={adres}
            onChange={(e) => {
              setAdres(e.target.value);
              degisti();
            }}
            placeholder="http://10.20.0.9:8080"
            className="input-base mt-1 font-mono text-sm"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-semibold text-muted">Personel uç noktası</span>
            <input
              value={personelYolu}
              onChange={(e) => {
                setPersonelYolu(e.target.value);
                degisti();
              }}
              placeholder="/api/personel"
              className="input-base mt-1 font-mono text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-muted">Kayıt uç noktası</span>
            <input
              value={kayitYolu}
              onChange={(e) => {
                setKayitYolu(e.target.value);
                degisti();
              }}
              placeholder="/api/egitim-kaydi"
              className="input-base mt-1 font-mono text-sm"
            />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-semibold text-muted">Kimlik başlığı</span>
            <input
              value={basligi}
              onChange={(e) => {
                setBasligi(e.target.value);
                degisti();
              }}
              placeholder="X-API-Key"
              className="input-base mt-1 font-mono text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-muted">Kimlik anahtarı</span>
            <input
              type="password"
              value={anahtar}
              disabled={anahtariSil}
              onChange={(e) => {
                setAnahtar(e.target.value);
                degisti();
              }}
              placeholder={p.anahtarVar ? "Kayıtlı — boş bırakırsanız değişmez" : "Gerekmiyorsa boş bırakın"}
              className="input-base mt-1 font-mono text-sm disabled:opacity-50"
            />
          </label>
        </div>

        {p.anahtarVar ? (
          <label className="flex items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={anahtariSil}
              onChange={(e) => {
                setAnahtariSil(e.target.checked);
                degisti();
              }}
            />
            Kayıtlı kimlik anahtarını sil
          </label>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-semibold text-muted">Zaman aşımı (ms)</span>
            <input
              value={zamanAsimi}
              onChange={(e) => {
                setZamanAsimi(e.target.value);
                degisti();
              }}
              placeholder="8000"
              inputMode="numeric"
              className="input-base mt-1 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-muted">Önbellek süresi (dakika)</span>
            <input
              value={onbellek}
              onChange={(e) => {
                setOnbellek(e.target.value);
                degisti();
              }}
              placeholder="10"
              inputMode="numeric"
              className="input-base mt-1 text-sm"
            />
          </label>
        </div>

        <p className="text-xs text-muted">
          Personel listesi bu süre boyunca önbellekte taze sayılır — her ekran açılışında OPM&apos;e gidilmez. OPM
          yanıt vermezse <strong>son bilinen liste</strong> kullanılır; boş liste dönmek fabrikadaki herkesi bir anda
          &quot;listede yok&quot; yapardı.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-line pt-4">
        <button onClick={kaydet} disabled={calisiyor} className="btn-primary text-sm">
          <Icon name="save" size={16} /> Kaydet
        </button>
        <button onClick={sina} disabled={calisiyor} className="btn-ghost text-sm">
          <Icon name="link" size={16} /> Bağlantıyı sına
        </button>
      </div>

      {hata ? (
        <p
          role="alert"
          className="rounded-xl border border-brand/30 bg-brand-soft px-3 py-2 text-sm font-semibold text-brand-dark"
        >
          {hata}
        </p>
      ) : null}

      {kaydedildi && !hata ? (
        <p className="text-sm font-semibold text-iyi-dark">
          <Icon name="check" size={14} /> Kaydedildi.
        </p>
      ) : null}

      {sinama ? (
        <div className="space-y-2 text-sm">
          <SinamaSatiri etiket="Personel" sonuc={sinama.personel} />
          <SinamaSatiri etiket="Kayıt" sonuc={sinama.kayit} />
        </div>
      ) : null}

      {/* Eksikler sınamayı beklemeden görünür: yarım kurulum sessiz kalmamalı. */}
      {opmKullaniliyor && (p.personelEksikleri.length > 0 || p.kayitEksikleri.length > 0) ? (
        <div className="rounded-xl border border-brand/30 bg-brand-soft px-3 py-2 text-sm text-brand-dark">
          <p className="font-semibold">OPM seçili ama yapılandırma eksik:</p>
          <ul className="mt-1 list-inside list-disc">
            {[...new Set([...p.personelEksikleri, ...p.kayitEksikleri])].map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {p.personelSecim === "opm" ? (
        <p className="text-xs text-muted">
          Son başarılı okuma: <span className="font-mono">{zamanKisa(p.sonBasariliOkuma)}</span>
          {p.sonOkumaHatasi ? (
            <>
              {" · "}
              <span className="font-semibold text-orta-dark">son hata: {p.sonOkumaHatasi}</span>
            </>
          ) : null}
        </p>
      ) : null}

      {p.sonGonderimHatasi ? (
        <p className="text-xs font-semibold text-orta-dark">Son gönderim hatası: {p.sonGonderimHatasi}</p>
      ) : null}
    </div>
  );
}

function SinamaSatiri({ etiket, sonuc }: { etiket: string; sonuc: { iyi: boolean; mesaj: string } }) {
  return (
    <p className={sonuc.iyi ? "font-semibold text-iyi-dark" : "font-semibold text-brand-dark"}>
      <Icon name={sonuc.iyi ? "check" : "warning"} size={14} /> {etiket}: {sonuc.mesaj}
    </p>
  );
}
