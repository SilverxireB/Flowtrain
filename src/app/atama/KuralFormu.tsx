"use client";

import { useMemo, useState } from "react";
import { kosulKapsar } from "@/lib/kurallar";
import { useFormState, useFormStatus } from "react-dom";
import Icon from "@/components/Icon";
import { kuralEkleEylem } from "./eylemler";

/**
 * Kural formu.
 *
 * Süzgeç değerleri elle YAZILMAZ, personel listesinden gelen değerlerden
 * seçilir: elle yazılan "Kaynak " (sondaki boşluk) kuralı sessizce kimseyi
 * kapsamayan bir şeye çevirir ve kimse fark etmez.
 *
 * HEDEF: tek eğitim ya da PAKET. İkisi tek bir açılır kutuya karıştırılmaz —
 * "Oryantasyon" adında hem bir eğitim hem bir paket olabilir ve kullanıcı
 * hangisini seçtiğini bilemez. Önce tip seçilir, sonra o tipin listesi gelir.
 */
export default function KuralFormu({
  egitimler,
  paketler,
  bolumler,
  hatlar,
  gorevler,
  kombinasyonlar,
}: {
  egitimler: { id: string; ad: string; yayinda: boolean }[];
  paketler: { id: string; ad: string; egitimSayisi: number }[];
  bolumler: string[];
  hatlar: string[];
  gorevler: string[];
  /** Ayrık (bölüm, hat, görev) üçlüleri ve her birinin kişi sayısı. */
  kombinasyonlar: { bolum?: string; hat?: string; gorev?: string; adet: number }[];
}) {
  const [hata, gonder] = useFormState(kuralEkleEylem, null);
  const [hedefTipi, setHedefTipi] = useState<"egitim" | "paket">("egitim");
  const [secili, setSecili] = useState<Record<string, string[]>>({ bolum: [], hat: [], gorev: [] });
  /**
   * SON TARİH TEK SEÇİM.
   *
   * Eskiden iki alan yan yana duruyordu ("işe girişten sonra gün" + "sabit
   * tarih") ve altında "ikisi de doluysa erken olan geçerlidir" yazıyordu.
   * İkisinin birbiriyle ne yaptığı okunmadan anlaşılmıyordu; kural yazan kişi
   * ikisini de doldurup neyin geçerli olduğunu kestiremiyordu. Artık üç
   * seçenekten biri: yok · işe girişe göre · sabit tarih. Motor değişmedi —
   * yalnız aynı anda tek alan gönderiliyor.
   */
  const [sonTarihKipi, setSonTarihKipi] = useState<"yok" | "iseGiris" | "sabit">("yok");
  /**
   * KİME: gruba mı, tek tek kişilere mi?
   *
   * "Kural yaz, kişi kişi atama" doğru varsayılan — listeye sonradan düşen
   * personeli kural kendiliğinden kapsıyor. Ama bir İSTİSNA sınıfı var ve o
   * politika değil, OLAY: ramak kala yaşayan kişiye tekrar eğitimi, yeni
   * göreve geçene ek eğitim. Bunlar bölüm/hat/görevle ifade edilemez.
   *
   * İki kip aynı kuralı yazıyor (koşula sicil boyutu eklendi), ayrı bir atama
   * yolu AÇILMADI: son tarih, kiosk, pano, kayıt ve denetim izi olduğu gibi
   * çalışıyor ve atama kurallar listesinde GÖRÜNÜR kalıyor.
   */
  const [kime, setKime] = useState<"grup" | "kisi">("grup");
  const [sicilMetni, setSicilMetni] = useState("");

  const secilenSiciller = useMemo(
    () => [...new Set(sicilMetni.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean))],
    [sicilMetni],
  );

  /**
   * KAÇ KİŞİYE GİDECEK — anlık.
   *
   * Üç boyut VE ile bağlı: kişi hem seçili bir bölümde, hem seçili bir hatta,
   * hem de seçili bir görevde olmalı. Üçünden de seçim yapılınca kesişim
   * kolayca boşalıyor ve kural "hiç kimseye" yazılıyordu — üstelik bu ancak
   * kaydettikten sonra fark ediliyordu. Sayı, kaydedildikten sonraki gerçekle
   * BİREBİR aynı olsun diye kapsam kuralının kendisinden (`kosulKapsar`)
   * geçiyor; forma özel ikinci bir eşleşme yazılsaydı ayrışırdı.
   */
  const kapsanan = useMemo(() => {
    if (kime === "kisi") return secilenSiciller.length;
    return kombinasyonlar.reduce(
      (t, k) => (kosulKapsar({ bolum: secili.bolum, hat: secili.hat, gorev: secili.gorev }, k) ? t + k.adet : t),
      0,
    );
  }, [kime, secilenSiciller, kombinasyonlar, secili]);
  const toplam = useMemo(() => kombinasyonlar.reduce((t, k) => t + k.adet, 0), [kombinasyonlar]);

  function degistir(alan: string, deger: string) {
    setSecili((s) => ({
      ...s,
      [alan]: s[alan].includes(deger) ? s[alan].filter((x) => x !== deger) : [...s[alan], deger],
    }));
  }

  return (
    <form action={gonder} className="mt-4 space-y-4">
      <fieldset>
        <legend className="mb-1.5 text-sm font-semibold">Kural neye yazılsın?</legend>
        <input type="hidden" name="hedefTipi" value={hedefTipi} />
        <div className="flex gap-2">
          {(
            [
              { deger: "egitim", etiket: "Tek eğitim", ikon: "book" },
              { deger: "paket", etiket: "Eğitim paketi", ikon: "folder" },
            ] as const
          ).map((s) => (
            <button
              key={s.deger}
              type="button"
              onClick={() => setHedefTipi(s.deger)}
              aria-pressed={hedefTipi === s.deger}
              className={`chip text-sm transition ${
                hedefTipi === s.deger ? "border-accent bg-accent-soft text-accent-dark" : "hover:border-muted/50"
              }`}
            >
              <Icon name={s.ikon} size={14} /> {s.etiket}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold">{hedefTipi === "paket" ? "Paket" : "Eğitim"}</span>
        {/* Anahtar `hedefTipi` içerir: tip değişince seçim SIFIRLANIR. Aksi
            hâlde eğitim seçip pakete geçen kişi eski seçimi göndermiş olurdu. */}
        <select key={hedefTipi} name="hedefId" required className="input-base" defaultValue="">
          <option value="" disabled>
            Seçin…
          </option>
          {hedefTipi === "paket"
            ? paketler.map((p) => (
                <option key={p.id} value={p.id} disabled={p.egitimSayisi === 0}>
                  {p.ad} ({p.egitimSayisi} eğitim{p.egitimSayisi === 0 ? " — boş" : ""})
                </option>
              ))
            : egitimler.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.ad}
                  {e.yayinda ? "" : " (taslak)"}
                </option>
              ))}
        </select>
        {hedefTipi === "paket" ? (
          <span className="mt-1 block text-xs text-muted">
            Pakete sonradan eklenen eğitim, bu kural yeniden yazılmadan aynı kişilere gider.
          </span>
        ) : null}
      </label>

      {hedefTipi === "paket" && paketler.length === 0 ? (
        <p className="rounded-xl border border-orta/40 bg-orta/5 px-3 py-2 text-sm">
          Henüz paket yok. <strong>Eğitim paketleri</strong> sayfasından bir tane açın.
        </p>
      ) : null}

      <fieldset>
        <legend className="mb-1.5 text-sm font-semibold">Kime?</legend>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["grup", "Bölüm / hat / göreve"],
              ["kisi", "Belirli kişilere"],
            ] as const
          ).map(([deger, etiket]) => (
            <button
              key={deger}
              type="button"
              onClick={() => setKime(deger)}
              aria-pressed={kime === deger}
              className={`chip dokunma-44 text-sm ${kime === deger ? "border-accent bg-accent-soft text-accent-dark" : ""}`}
            >
              {etiket}
            </button>
          ))}
        </div>
        {kime === "kisi" ? (
          <p className="mt-2 text-xs text-muted">
            İstisna içindir: ramak kala sonrası tekrar eğitimi, göreve yeni geçen kişi, bir kişinin eksiği.{" "}
            <strong className="text-ink">Politika için kural yazın</strong> — kişi listesi, listeye sonradan düşen
            personeli kapsamaz.
          </p>
        ) : null}
      </fieldset>

      {kime === "grup" ? (
        <>
          <Coklu ad="bolum" etiket="Bölüm" secenekler={bolumler} secili={secili.bolum} degistir={degistir} />
          <Coklu ad="hat" etiket="Hat" secenekler={hatlar} secili={secili.hat} degistir={degistir} />
          <Coklu ad="gorev" etiket="Görev" secenekler={gorevler} secili={secili.gorev} degistir={degistir} />
        </>
      ) : (
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">Siciller</span>
          <textarea
            name="sicil"
            value={sicilMetni}
            onChange={(e) => setSicilMetni(e.target.value)}
            rows={3}
            placeholder={"1001\n1002 1003\n9001"}
            className="input-base font-mono text-sm"
          />
          <span className="mt-1 block text-xs text-muted">
            Boşluk, virgül ya da satır sonu ayırır — kâğıttan okuyup olduğu gibi yapıştırabilirsiniz.
          </span>
        </label>
      )}

      <fieldset>
        <legend className="mb-1.5 text-sm font-semibold">Son tarih</legend>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["yok", "Son tarih yok"],
              ["iseGiris", "İşe girişe göre"],
              ["sabit", "Sabit tarih"],
            ] as const
          ).map(([deger, etiket]) => (
            <button
              key={deger}
              type="button"
              onClick={() => setSonTarihKipi(deger)}
              aria-pressed={sonTarihKipi === deger}
              className={`chip dokunma-44 text-sm ${sonTarihKipi === deger ? "border-accent bg-accent-soft text-accent-dark" : ""}`}
            >
              {etiket}
            </button>
          ))}
        </div>

        {sonTarihKipi === "yok" ? (
          <p className="mt-2 text-xs text-muted">Eğitim atanır ama gecikme sayılmaz — süresiz açık kalır.</p>
        ) : null}

        {sonTarihKipi === "iseGiris" ? (
          <label className="mt-2 block max-w-xs">
            <span className="sr-only">İşe girişten sonra kaç gün</span>
            <input name="iseGirisIcindeGun" type="number" min={1} placeholder="Örn. 30" className="input-base" />
            <span className="mt-1 block text-xs text-muted">
              Herkesin son tarihi KENDİ işe giriş tarihine göre hesaplanır. Yeni girenler için doğru olan budur; eski
              personelin tarihi çoktan geçmiş sayılır ve eğitim onlarda <strong className="text-ink">gecikmiş</strong>{" "}
              görünür.
            </span>
          </label>
        ) : null}

        {sonTarihKipi === "sabit" ? (
          <label className="mt-2 block max-w-xs">
            <span className="sr-only">Sabit son tarih</span>
            <input name="sonTarih" type="date" className="input-base" />
            <span className="mt-1 block text-xs text-muted">Herkes için aynı tarih.</span>
          </label>
        ) : null}
      </fieldset>

      {hata ? (
        <p role="alert" className="rounded-xl border border-brand/30 bg-brand-soft px-3 py-2 text-sm font-semibold text-brand-dark">
          {hata}
        </p>
      ) : null}

      {/* SAYI DÜĞMENİN YANINDA: kural yazan kişi "kaydet"e basmadan ÖNCE kaç
          kişiye gideceğini görmeli. Sıfır çıkması bir hata değil, bir cevaptır
          — ve en sık sebebi üç boyutun VE ile bağlanması, yani kesişimin
          boşalması. Onu da burada söylüyoruz, kaydettikten sonra değil. */}
      <div className="flex flex-wrap items-center gap-3">
        <Gonder />
        <span
          aria-live="polite"
          className={`text-sm font-semibold ${kapsanan === 0 ? "text-brand-dark" : "text-muted"}`}
        >
          {kapsanan === 0 ? (
            <>{kime === "kisi" ? "Henüz sicil yazılmadı" : "Bu seçimle hiç kimse kapsanmıyor"}</>
          ) : (
            <>
              <strong className="text-ink">{kapsanan}</strong> kişiye gidecek
              {kime === "kisi" ? "" : kapsanan === toplam ? " (listedeki herkes)" : ` · listede ${toplam} kişi`}
            </>
          )}
        </span>
      </div>
      {kime === "grup" && kapsanan === 0 && (secili.bolum.length > 0 || secili.hat.length > 0 || secili.gorev.length > 0) ? (
        <p className="text-xs text-muted">
          Bölüm, hat ve görev <strong className="text-ink">birlikte</strong> aranır: kişi üçünü de karşılamalı.
          Örneğin bakımdaki herkese yazmak için yalnız <strong className="text-ink">Bakım</strong> seçin, hat ve görev
          boş kalsın.
        </p>
      ) : null}
    </form>
  );
}

function Coklu({
  ad,
  etiket,
  secenekler,
  secili,
  degistir,
}: {
  ad: string;
  etiket: string;
  secenekler: string[];
  secili: string[];
  degistir: (alan: string, deger: string) => void;
}) {
  if (secenekler.length === 0) return null;
  return (
    <div>
      {/* JSON: virgülle birleştirmek, "Kaynak, Montaj" gibi virgül İÇEREN bir
          bölüm adı seçildiğinde kuralı iki uydurma değere bölüyor ve kural
          kimseyi kapsamıyordu — hiçbir hata da vermeden. */}
      <input type="hidden" name={ad} value={JSON.stringify(secili)} />
      <span className="mb-1.5 block text-sm font-semibold">
        {etiket} <span className="font-normal text-muted">— boş bırakılırsa süzmez</span>
      </span>
      <div className="flex flex-wrap gap-2">
        {secenekler.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => degistir(ad, s)}
            aria-pressed={secili.includes(s)}
            className={`chip text-sm transition ${
              secili.includes(s) ? "border-accent bg-accent-soft text-accent-dark" : "hover:border-muted/50"
            }`}
          >
            {secili.includes(s) ? <Icon name="check" size={14} /> : null}
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function Gonder() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary">
      <Icon name="plus" size={18} /> {pending ? "Ekleniyor…" : "Kuralı ekle"}
    </button>
  );
}
