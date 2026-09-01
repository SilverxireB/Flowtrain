"use client";

import { useMemo, useState } from "react";
import { kosulKapsar } from "@/lib/kurallar";
import { eslesir } from "@/lib/arama";
import { useFormState, useFormStatus } from "react-dom";
import Icon from "@/components/Icon";
import { kuralEkleEylem } from "./eylemler";
import FlowSecici from "@/components/FlowSecici";

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
  kisiler,
}: {
  egitimler: { id: string; ad: string; yayinda: boolean }[];
  paketler: { id: string; ad: string; egitimSayisi: number }[];
  bolumler: string[];
  hatlar: string[];
  gorevler: string[];
  /** Ayrık (bölüm, hat, görev) üçlüleri ve her birinin kişi sayısı. */
  kombinasyonlar: { bolum?: string; hat?: string; gorev?: string; adet: number }[];
  /** Kişi seçici ve "kimler" önizlemesi için kırpılmış personel listesi. */
  kisiler: { sicil: string; ad: string; bolum?: string; hat?: string; gorev?: string }[];
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
  /**
   * SİCİL ELLE YAZILMIYOR ARTIK. Önce serbest metin kutusuydu: kural yazan
   * kişinin sicilleri ezbere ya da kâğıttan bilmesi gerekiyordu ve yanlış
   * yazılan bir sicil sessizce KİMSEYİ kapsamıyordu (hata da vermiyordu,
   * çünkü "o sicilli kimse yok" diye bir kural yok). Artık listeden seçiliyor;
   * seçilen kişi adıyla görünüyor, yani yanlış kişi gözle yakalanıyor.
   */
  const [secilenSiciller, setSecilenSiciller] = useState<string[]>([]);
  const [sorgu, setSorgu] = useState("");

  const sicilKarti = useMemo(() => new Map(kisiler.map((k) => [k.sicil, k])), [kisiler]);

  /* Aramada Türkçe duyarlı eşleşme (`lib/arama`): düz `includes` "İSTANBUL"u
     küçültünce görünmez bir birleşen bırakıp SESSİZCE bulamıyor. */
  const sonuclar = useMemo(() => {
    const q = sorgu.trim();
    if (!q) return [];
    return kisiler
      .filter((k) => !secilenSiciller.includes(k.sicil))
      .filter((k) => eslesir(k.ad, q) || eslesir(k.sicil, q) || eslesir(k.bolum, q))
      .slice(0, 8);
  }, [sorgu, kisiler, secilenSiciller]);

  /** Kuralın kapsadığı kişiler — "kaç kişi" sayısının ARKASINDAKİLER. */
  const kapsananlar = useMemo(() => {
    if (kime === "kisi") return secilenSiciller.map((s) => sicilKarti.get(s)).filter(Boolean) as typeof kisiler;
    return kisiler.filter((k) => kosulKapsar({ bolum: secili.bolum, hat: secili.hat, gorev: secili.gorev }, k));
  }, [kime, secilenSiciller, sicilKarti, kisiler, secili]);

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
  const kapsanan = kapsananlar.length;
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
        <legend className="mb-1.5 text-sm font-semibold">Ne atanacak?</legend>
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
        <FlowSecici key={hedefTipi} name="hedefId" required defaultValue="" aria-label="Hedef">
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
        </FlowSecici>
        {hedefTipi === "paket" ? (
          <span className="mt-1 block text-xs text-muted">
            Pakete sonradan eklenen eğitim, bu kural yeniden yazılmadan aynı kişilere gider.
          </span>
        ) : null}
      </label>

      {hedefTipi === "paket" && paketler.length === 0 ? (
        <p className="rounded-flow border border-orta/40 bg-orta/5 px-3 py-2 text-sm">
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
        <div>
          {/* Sunucuya giden değer: seçilenlerin sicilleri. */}
          <input type="hidden" name="sicil" value={secilenSiciller.join(" ")} />

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">Kişi ara</span>
            <input
              value={sorgu}
              onChange={(e) => setSorgu(e.target.value)}
              placeholder="Ada, sicile ya da bölüme göre"
              className="input-base"
            />
          </label>

          {sonuclar.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {sonuclar.map((k) => (
                <li key={k.sicil}>
                  <button
                    type="button"
                    onClick={() => {
                      setSecilenSiciller((x) => [...x, k.sicil]);
                      setSorgu("");
                    }}
                    className="dokunulur flex w-full items-center gap-2 rounded-flow border border-line bg-yuzey px-3 py-2 text-left text-sm hover:border-accent"
                  >
                    <Icon name="plus" size={14} className="shrink-0 text-accent" />
                    <span className="min-w-0 flex-1 truncate">
                      <strong className="font-semibold">{k.ad}</strong>
                      <span className="text-muted">
                        {" "}
                        · {k.sicil}
                        {k.bolum ? ` · ${k.bolum}` : ""}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : sorgu.trim() ? (
            <p className="mt-2 text-sm text-muted">Eşleşen kişi yok.</p>
          ) : null}

          {secilenSiciller.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {secilenSiciller.map((sc) => {
                const k = sicilKarti.get(sc);
                return (
                  <li key={sc}>
                    <button
                      type="button"
                      onClick={() => setSecilenSiciller((x) => x.filter((y) => y !== sc))}
                      className="chip dokunma-44 border-accent/40 bg-accent-soft text-sm text-accent-dark"
                      aria-label={`${k?.ad ?? sc} kişisini çıkar`}
                    >
                      {k?.ad ?? sc} <span className="font-normal opacity-70">{sc}</span>
                      <Icon name="close" size={14} />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
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
        <p role="alert" className="rounded-flow border border-brand/30 bg-brand-soft px-3 py-2 text-sm font-semibold text-brand-dark">
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
            <>{kime === "kisi" ? "Henüz kişi seçilmedi" : "Bu seçimle hiç kimse kapsanmıyor"}</>
          ) : (
            <>
              <strong className="text-ink">{kapsanan}</strong> kişiye gidecek
              {kime === "kisi" ? "" : kapsanan === toplam ? " (listedeki herkes)" : ` · listede ${toplam} kişi`}
            </>
          )}
        </span>
      </div>
      {/* SAYININ ARKASINDAKİLER. "142 kişiye gidecek" doğru ama denetlenemez:
          kural yazan kişi listeyi görmeden doğru kişileri seçtiğinden emin
          olamıyordu. Açılır duruyor — kapalıyken sayı yeter, şüphelenince
          açılır. İlk 50 kişi çiziliyor: bin kişilik listeyi DOM'a basmak
          formu kilitler ve zaten kimse bin satır okumaz. */}
      {kapsanan > 0 ? (
        <details className="rounded-flow border border-line bg-yuzey px-3 py-2">
          <summary className="dokunma-44 cursor-pointer text-sm font-semibold">
            Kimler? <span className="font-normal text-muted">{kapsanan} kişi</span>
          </summary>
          <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto text-sm">
            {kapsananlar.slice(0, 50).map((k) => (
              <li key={k.sicil} className="flex flex-wrap gap-x-2 border-b border-line/60 py-1 last:border-0">
                <span className="font-semibold">{k.ad}</span>
                <span className="text-muted">
                  {k.sicil}
                  {k.bolum ? ` · ${k.bolum}` : ""}
                  {k.gorev ? ` · ${k.gorev}` : ""}
                </span>
              </li>
            ))}
          </ul>
          {kapsanan > 50 ? <p className="mt-2 text-xs text-muted">…ve {kapsanan - 50} kişi daha.</p> : null}
        </details>
      ) : null}

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
      <Icon name="plus" size={18} /> {pending ? "Ekleniyor…" : "Atamayı ekle"}
    </button>
  );
}
