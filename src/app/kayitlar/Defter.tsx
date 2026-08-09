"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import Icon from "@/components/Icon";
import { csvYaz } from "@/lib/csv";
import {
  BOS_SUZGEC,
  damgaMetni,
  duzeltmeHaritasi,
  kayitlariSuz,
  kunyeliCsv,
  sayfala,
  sureMetni,
  suzgecAcikMi,
  suzgecOzeti,
  zamanMetni,
  type BelgeKunyesi,
  type DuzeltmeHaritasi,
  type KayitSatiri,
  type KayitSuzgeci,
  type SonucSuzgeci,
} from "@/lib/rapor";
import { KAYNAK_ETIKET, type OturumKaynagi } from "@/lib/tipler";

/**
 * DEFTER — süz, sayfala, dışa aktar. DÜZENLE/SİL YOK.
 *
 * OPM'nin kayıt ekranında her satırın yanında bir kalem ve bir çöp kutusu var;
 * biz onu KOPYALAMIYORUZ. Değiştirilebilen bir tamamlama kaydı denetimde
 * hiçbir şey ispat etmez. Ekranda da bunu açıkça yazıyoruz — kullanıcı düğmeyi
 * arayıp bulamamak yerine niçin olmadığını okusun.
 */

const SONUC_ETIKET: Record<string, string> = {
  gecti: "Geçti",
  kaldi: "Kaldı",
  iptal: "İptal",
  acik: "Açık (bitmedi)",
};

const SONUC_SECENEKLERI: SonucSuzgeci[] = ["gecti", "kaldi", "iptal", "acik"];

/** Toplu sertifikada üst sınır: 500 sayfalık bir PDF tarayıcıyı kilitler. */
const SERTIFIKA_SINIRI = 200;

/**
 * PDF'in okunur kalabildiği üst sınır — AŞAN ENGELLENMEZ, UYARILIR.
 *
 * Yük denemesi (`scripts/yuk.mjs`) 20 bin kayıtlık defterin PDF'ini 1,9
 * saniyede basıyor; sorun süre değil, çıkan şey: 477 sayfalık bir PDF kimsenin
 * okuyacağı bir belge değil ve yazıcıya gönderildiğinde bir kutu kâğıt eder.
 * O hacimde doğru araç CSV. Yine de basmak isteyen basar — belgenin ne
 * olacağını önceden bilerek. Sınır ~42 satır/sayfa üzerinden hesaplandı.
 */
const PDF_UYARI_SATIRI = 2000;

const CSV_BASLIKLARI = [
  { anahtar: "tamamlama", etiket: "Tamamlama" },
  { anahtar: "baslangic", etiket: "Başlangıç" },
  { anahtar: "sicil", etiket: "Sicil" },
  { anahtar: "ad", etiket: "Ad" },
  { anahtar: "bolum", etiket: "Bölüm" },
  { anahtar: "egitim", etiket: "Eğitim" },
  { anahtar: "surum", etiket: "Sürüm" },
  { anahtar: "kategori", etiket: "Kategori" },
  { anahtar: "zorunlu", etiket: "Yasal zorunlu" },
  { anahtar: "sureSn", etiket: "Süre (sn)" },
  { anahtar: "puan", etiket: "Puan" },
  { anahtar: "sonuc", etiket: "Sonuç" },
  { anahtar: "kaynak", etiket: "Kaynak" },
  { anahtar: "egitmen", etiket: "Eğitmen" },
  { anahtar: "gozeten", etiket: "Gözeten" },
  { anahtar: "gecerlilik", etiket: "Geçerlilik bitişi" },
  { anahtar: "notlar", etiket: "Not" },
  { anahtar: "kayitNo", etiket: "Kayıt no" },
];

function csvSatiri(k: KayitSatiri): Record<string, unknown> {
  return {
    tamamlama: zamanMetni(k.bitis),
    baslangic: zamanMetni(k.baslangic),
    sicil: k.sicil,
    ad: k.ad,
    bolum: k.bolum,
    egitim: k.egitimAdi,
    surum: k.egitimSurum,
    kategori: k.kategori,
    zorunlu: k.zorunlu ? "Evet" : "Hayır",
    sureSn: k.sureSn ?? "",
    puan: k.puan ?? "",
    sonuc: k.sonuc ? SONUC_ETIKET[k.sonuc] : "Açık",
    kaynak: KAYNAK_ETIKET[k.kaynak] ?? k.kaynak,
    egitmen: k.egitmen ?? "",
    gozeten: k.gozeten ?? "",
    gecerlilik: k.gecerlilikBitis ?? "",
    notlar: k.notlar ?? "",
    kayitNo: k.id,
  };
}

/** Tarayıcıya dosya indirtir. Dış servis yok — içerik bellekte üretilir. */
function dosyaIndir(icerik: string, dosyaAdi: string, tip: string): void {
  const url = URL.createObjectURL(new Blob([icerik], { type: tip }));
  const a = document.createElement("a");
  a.href = url;
  a.download = dosyaAdi;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Defter({
  satirlar,
  egitimler,
  bolumler,
  bugunGun,
  kurum,
}: {
  satirlar: KayitSatiri[];
  egitimler: { id: string; ad: string }[];
  bolumler: string[];
  bugunGun: string;
  /** Ayarlardan gelen kurum adı — her çıktının künyesine yazılır. */
  kurum: string;
}) {
  const [suzgec, setSuzgec] = useState<KayitSuzgeci>(BOS_SUZGEC);
  const [sayfaBoyu, setSayfaBoyu] = useState(20);
  const [sayfa, setSayfa] = useState(1);
  const [secili, setSecili] = useState<KayitSatiri | null>(null);
  const [calisiyor, setCalisiyor] = useState("");

  const suzulmus = useMemo(() => kayitlariSuz(satirlar, suzgec), [satirlar, suzgec]);
  const { gorunen, gecerliSayfa, sonSayfa } = sayfala(suzulmus, sayfa, sayfaBoyu);
  const gecenler = useMemo(() => suzulmus.filter((k) => k.sonuc === "gecti"), [suzulmus]);

  /* DÜZELTME BAĞLARI TEK GEÇİŞTE çıkarılır ve tüm defter için hesaplanır
     (süzülmüş liste için değil): düzeltme kaydı süzgecin dışında kalmış
     olabilir ve o zaman eski satır "düzeltildi" işaretini kaybederdi —
     denetimde en yanıltıcı hâl. */
  const duzeltmeler = useMemo(() => duzeltmeHaritasi(satirlar), [satirlar]);

  function degistir(yama: Partial<KayitSuzgeci>) {
    setSuzgec((s) => ({ ...s, ...yama }));
    setSayfa(1);
  }

  const ozet = suzgecOzeti(
    suzgec,
    egitimler.find((e) => e.id === suzgec.egitimId)?.ad ?? "",
    suzgec.kaynak ? KAYNAK_ETIKET[suzgec.kaynak] : "",
    suzgec.sonuc ? SONUC_ETIKET[suzgec.sonuc] : "",
  );

  /**
   * Belgenin künyesi ÜRETİM ANINDA kurulur, sayfa açılışında değil.
   *
   * Sunucudan gelen tarih, sekme sabahtan beri açıksa dünün tarihi olabilir;
   * "bu belge ne zaman üretildi" sorusunun cevabı, düğmeye basıldığı andır.
   * Saat de yazılır: aynı gün içinde iki farklı süzgeçle alınmış iki belge
   * yalnız günle ayırt edilemiyordu.
   */
  function kunyeKur(belge: string, kayitSayisi: number): BelgeKunyesi {
    return { kurum, belge, uretim: damgaMetni(new Date()), kayitSayisi, suzgec: ozet };
  }

  function csvIndir() {
    dosyaIndir(
      kunyeliCsv(kunyeKur("Eğitim kayıt defteri", suzulmus.length), csvYaz(CSV_BASLIKLARI, suzulmus.map(csvSatiri))),
      `flowtrain-kayit-defteri-${bugunGun}.csv`,
      "text/csv;charset=utf-8",
    );
  }

  async function pdfIndir() {
    if (calisiyor) return;
    setCalisiyor("pdf");
    // jsPDF + gömülü yazı tipi ağır: sayfa açılışında değil, basıldığında iner.
    const { kayitDefteriPdfIndir } = await import("@/lib/kayitPdf");
    await kayitDefteriPdfIndir(suzulmus, kunyeKur("Eğitim kayıt defteri", suzulmus.length), bugunGun);
    setCalisiyor("");
  }

  async function sertifikaBas(kayitlar: KayitSatiri[]) {
    if (calisiyor || kayitlar.length === 0) return;
    setCalisiyor("sertifika");
    const { sertifikaIndir } = await import("@/lib/sertifika");
    const basilacak = kayitlar.slice(0, SERTIFIKA_SINIRI);
    await sertifikaIndir(
      basilacak.map((k) => ({
        ad: k.ad,
        sicil: k.sicil,
        bolum: k.bolum,
        egitimAdi: k.egitimAdi,
        egitimSurum: k.egitimSurum,
        kategori: k.kategori,
        zorunlu: k.zorunlu,
        tamamlama: k.bitis ?? k.baslangic,
        gecerlilikBitis: k.gecerlilikBitis,
        puan: k.puan,
        kaynakEtiket: KAYNAK_ETIKET[k.kaynak] ?? k.kaynak,
        egitmen: k.egitmen,
        belgeNo: k.id,
      })),
      kunyeKur("Eğitim kayıt belgesi", basilacak.length),
      bugunGun,
    );
    setCalisiyor("");
  }

  return (
    <div>
      {/* ── süzgeçler ─────────────────────────────────────────────────────── */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="min-w-[220px] flex-1">
            <span className="sr-only">Kişi ya da sicil ara</span>
            <input
              value={suzgec.sorgu}
              onChange={(e) => degistir({ sorgu: e.target.value })}
              placeholder="Ada ya da sicile göre ara"
              className="input-base"
            />
          </label>

          <label className="shrink-0">
            <span className="sr-only">Eğitim süzgeci</span>
            <select
              value={suzgec.egitimId}
              onChange={(e) => degistir({ egitimId: e.target.value })}
              className="input-base w-auto"
            >
              <option value="">Tüm eğitimler</option>
              {egitimler.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.ad}
                </option>
              ))}
            </select>
          </label>

          <label className="shrink-0">
            <span className="sr-only">Bölüm süzgeci</span>
            <select
              value={suzgec.bolum}
              onChange={(e) => degistir({ bolum: e.target.value })}
              className="input-base w-auto"
            >
              <option value="">Tüm bölümler</option>
              {bolumler.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </label>

          <label className="shrink-0">
            <span className="sr-only">Kaynak süzgeci</span>
            <select
              value={suzgec.kaynak}
              onChange={(e) => degistir({ kaynak: e.target.value as OturumKaynagi | "" })}
              className="input-base w-auto"
            >
              <option value="">Tüm kaynaklar</option>
              {(Object.keys(KAYNAK_ETIKET) as OturumKaynagi[]).map((k) => (
                <option key={k} value={k}>
                  {KAYNAK_ETIKET[k]}
                </option>
              ))}
            </select>
          </label>

          <label className="shrink-0">
            <span className="sr-only">Sonuç süzgeci</span>
            <select
              value={suzgec.sonuc}
              onChange={(e) => degistir({ sonuc: e.target.value as SonucSuzgeci })}
              className="input-base w-auto"
            >
              <option value="">Tüm sonuçlar</option>
              {SONUC_SECENEKLERI.map((s) => (
                <option key={s} value={s}>
                  {SONUC_ETIKET[s]}
                </option>
              ))}
            </select>
          </label>

          <span className="flex shrink-0 items-center gap-2 text-sm text-muted">
            <Icon name="calendar" size={16} />
            <input
              type="date"
              value={suzgec.baslangicGun}
              onChange={(e) => degistir({ baslangicGun: e.target.value })}
              className="input-base w-auto py-1.5"
              aria-label="Tarih aralığı başlangıcı"
            />
            –
            <input
              type="date"
              value={suzgec.bitisGun}
              onChange={(e) => degistir({ bitisGun: e.target.value })}
              className="input-base w-auto py-1.5"
              aria-label="Tarih aralığı bitişi"
            />
          </span>

          {suzgecAcikMi(suzgec) ? (
            <button
              onClick={() => {
                setSuzgec(BOS_SUZGEC);
                setSayfa(1);
              }}
              className="btn-ghost shrink-0 text-sm"
            >
              <Icon name="close" size={16} /> Süzgeci temizle
            </button>
          ) : null}
        </div>
      </div>

      {/* ── dışa aktarım ──────────────────────────────────────────────────── */}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <p className="text-sm text-muted">
          <strong className="text-ink">{suzulmus.length}</strong> kayıt
          {suzulmus.length !== satirlar.length ? ` (toplam ${satirlar.length} içinden)` : ""}
        </p>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button onClick={csvIndir} className="btn-ghost text-sm">
            <Icon name="download" size={16} /> CSV
          </button>
          <button onClick={pdfIndir} disabled={!!calisiyor} className="btn-ghost text-sm disabled:opacity-60">
            <Icon name="download" size={16} /> {calisiyor === "pdf" ? "Hazırlanıyor…" : "PDF"}
          </button>
          <button
            onClick={() => sertifikaBas(gecenler)}
            disabled={!!calisiyor || gecenler.length === 0}
            className="btn-ghost text-sm disabled:opacity-40"
            title={`Süzülmüş listedeki ${gecenler.length} geçti kaydı için tek PDF`}
          >
            <Icon name="print" size={16} />{" "}
            {calisiyor === "sertifika" ? "Hazırlanıyor…" : `Sertifika (${gecenler.length})`}
          </button>
        </div>
      </div>
      <p className="mt-1 text-xs text-muted">
        Çıktılar EKRANDAKİ SÜZGECİ izler. Her belgenin üstünde kurum adı, üretim anı, kayıt sayısı ve süzgeç özeti
        yazar; PDF&apos;te bunlar her sayfanın altında tekrarlanır ve sayfa numarası bulunur — denetçi tek bir yaprağa
        bakıp &quot;bu ne zaman, neyin listesi, kaç kayıt&quot; sorusunu cevaplayabilsin. Tüm atamaların durumu için
        Pano&apos;daki CSV kullanılır.
      </p>
      {/* SINIR DEĞİL UYARI: yük denemesinde 20 bin kayıtlık defter 477 sayfalık
          bir PDF üretti — hızlı basılıyor ama okunacak bir belge değil. */}
      {suzulmus.length > PDF_UYARI_SATIRI ? (
        <p className="mt-1 text-xs text-orta-dark">
          Bu süzgeçte <strong>{suzulmus.length}</strong> kayıt var; PDF yaklaşık{" "}
          <strong>{Math.ceil(suzulmus.length / 42)} sayfa</strong> olur. Bu hacimde CSV daha kullanışlı — PDF&apos;i
          daraltılmış bir süzgeçle almayı düşünün.
        </p>
      ) : null}

      {/* ── liste ─────────────────────────────────────────────────────────── */}
      {gorunen.length === 0 ? (
        <p className="card mt-4 p-8 text-center text-muted">
          {satirlar.length === 0
            ? "Henüz tamamlama kaydı yok. Kioskta yapılan eğitimler, sınıf kayıtları ve içe aktarılan geçmiş kayıtlar burada toplanır."
            : "Bu süzgeçle eşleşen kayıt yok."}
        </p>
      ) : (
        <div className="card mt-4 overflow-x-auto p-0">
          <table className="w-full min-w-[1080px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="px-4 py-3 font-semibold">Tamamlama</th>
                <th className="px-4 py-3 font-semibold">Sicil</th>
                <th className="px-4 py-3 font-semibold">Ad</th>
                <th className="px-4 py-3 font-semibold">Bölüm</th>
                <th className="px-4 py-3 font-semibold">Eğitim</th>
                <th className="px-2 py-3 text-right font-semibold">Sür.</th>
                <th className="px-2 py-3 text-right font-semibold">Süre</th>
                <th className="px-2 py-3 text-right font-semibold">Puan</th>
                <th className="px-4 py-3 font-semibold">Sonuç</th>
                <th className="px-4 py-3 font-semibold">Kaynak</th>
                <th className="px-4 py-3 font-semibold">Eğitmen</th>
                <th className="px-2 py-3" />
              </tr>
            </thead>
            <tbody>
              {gorunen.map((k) => (
                <tr key={k.id} className="border-b border-line last:border-0 hover:bg-wash">
                  <td className="whitespace-nowrap px-4 py-2.5">
                    {zamanMetni(k.bitis)}
                    {!k.bitis ? <span className="block text-xs text-muted">başladı {zamanMetni(k.baslangic)}</span> : null}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs">{k.sicil}</td>
                  <td className="px-4 py-2.5 font-semibold">{k.ad || "—"}</td>
                  <td className="px-4 py-2.5">{k.bolum || "—"}</td>
                  <td className="px-4 py-2.5">
                    {k.egitimAdi}
                    {k.zorunlu ? <span className="ml-1.5 text-xs font-semibold text-brand-dark">zorunlu</span> : null}
                    {/* DÜZELTME ZİNCİRİ LİSTEDE GÖRÜNÜR. Eskiden bağ yalnız
                        notun içindeki cümleydi ve kimse notu açmıyordu; bir
                        satırın düzeltilmiş olduğunu görmeden okuyan denetçi
                        yanlış kaydı geçerli sanıyordu. */}
                    <DuzeltmeRozeti
                      duzeltildi={duzeltmeler.duzeltilenler.has(k.id)}
                      duzeltiyor={duzeltmeler.duzeltenler.has(k.id)}
                    />
                  </td>
                  <td className="px-2 py-2.5 text-right font-mono text-xs text-muted">{k.egitimSurum}</td>
                  <td className="px-2 py-2.5 text-right text-xs text-muted">{sureMetni(k.sureSn)}</td>
                  <td className="px-2 py-2.5 text-right">{k.puan ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <SonucRozeti sonuc={k.sonuc} />
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted">{KAYNAK_ETIKET[k.kaynak] ?? k.kaynak}</td>
                  <td className="px-4 py-2.5 text-xs text-muted">{k.egitmen ?? k.gozeten ?? "—"}</td>
                  <td className="px-2 py-2.5 text-right">
                    <button
                      onClick={() => setSecili(k)}
                      className="btn-ghost px-2 py-1 text-xs"
                      aria-label={`${k.sicil} · ${k.egitimAdi} kaydını aç`}
                    >
                      <Icon name="eye" size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted">
        <span>
          Sayfa <strong className="text-ink">{gecerliSayfa}</strong> / {sonSayfa}
        </span>
        <span className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setSayfa(gecerliSayfa - 1)}
            disabled={gecerliSayfa <= 1}
            className="btn-ghost px-2 py-1 disabled:opacity-40"
            aria-label="Önceki sayfa"
          >
            <Icon name="chevronLeft" size={16} />
          </button>
          <button
            onClick={() => setSayfa(gecerliSayfa + 1)}
            disabled={gecerliSayfa >= sonSayfa}
            className="btn-ghost px-2 py-1 disabled:opacity-40"
            aria-label="Sonraki sayfa"
          >
            <Icon name="chevronRight" size={16} />
          </button>
          <select
            value={sayfaBoyu}
            onChange={(e) => {
              setSayfaBoyu(Number(e.target.value));
              setSayfa(1);
            }}
            className="input-base w-auto py-1 text-sm"
            aria-label="Sayfa başına kayıt"
          >
            {[20, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </span>
      </div>

      {/* KAYDIN DEĞİŞMEZLİĞİ EKRANDA YAZAR: kullanıcı "düzenle" düğmesini
          arayıp bulamamak yerine niçin olmadığını VE ne yapacağını okusun.
          Eskiden burada yalnız kuralı yazıyorduk ve kullanıcıyı boş bir sınıf
          formuna yolluyorduk; düzeltmenin nasıl yapılacağı belirsizdi. */}
      <div className="card mt-6 p-5 text-sm text-muted">
        <p>
          <strong className="text-ink">Kayıtlar düzenlenmez ve silinmez.</strong> Değiştirilebilen bir tamamlama kaydı
          denetimde hiçbir şey ispat etmez.
        </p>
        <p className="mt-2">
          Yanlış bir kayıt gördüyseniz satırın sonundaki <Icon name="eye" size={13} className="inline" /> düğmesiyle
          kaydı açın ve <strong className="text-ink">Düzeltme kaydı</strong> deyin. Doğrusu YENİ bir kayıt olarak
          girilir, gerekçesi sorulur ve yeni satır &quot;hangi kaydın yerine geçtiğini&quot; notunda taşır. Eski satır
          silinmez; defter ikisini de <span className="chip text-[11px]">düzeltildi</span> /{" "}
          <span className="chip text-[11px]">düzeltme kaydı</span> olarak işaretler ve denetçi zincirin tamamını görür.
        </p>
      </div>

      {secili ? (
        <Ayrinti
          kayit={secili}
          duzeltmeler={duzeltmeler}
          onKapat={() => setSecili(null)}
          onSertifika={() => sertifikaBas([secili])}
        />
      ) : null}
    </div>
  );
}

/**
 * Düzeltme zincirinin satırdaki izi.
 *
 * İki ayrı rozet, çünkü iki ayrı anlam: "bu satır artık geçerli değil, yerine
 * bir kayıt girildi" ile "bu satır bir başkasının yerine geçti". Tek rozetle
 * gösterilseydi denetçi zincirin hangi ucunda olduğunu ayırt edemezdi.
 */
function DuzeltmeRozeti({ duzeltildi, duzeltiyor }: { duzeltildi: boolean; duzeltiyor: boolean }) {
  if (!duzeltildi && !duzeltiyor) return null;
  return (
    <span className="ml-1.5 whitespace-nowrap text-xs font-semibold text-accent">
      {duzeltildi ? "düzeltildi" : "düzeltme kaydı"}
    </span>
  );
}

function SonucRozeti({ sonuc }: { sonuc?: KayitSatiri["sonuc"] }) {
  if (!sonuc) return <span className="chip text-xs text-muted">Açık</span>;
  if (sonuc === "gecti") return <span className="chip text-xs text-iyi-dark">Geçti</span>;
  if (sonuc === "kaldi") return <span className="chip text-xs text-brand-dark">Kaldı</span>;
  return <span className="chip text-xs text-muted">İptal</span>;
}

/* ── kayıt ayrıntısı ──────────────────────────────────────────────────────── */

function Alan({ etiket, deger }: { etiket: string; deger: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-muted">{etiket}</p>
      <p className="mt-0.5 break-words">{deger || "—"}</p>
    </div>
  );
}

function Ayrinti({
  kayit,
  duzeltmeler,
  onKapat,
  onSertifika,
}: {
  kayit: KayitSatiri;
  duzeltmeler: DuzeltmeHaritasi;
  onKapat: () => void;
  onSertifika: () => void;
}) {
  const bunuDuzeltenler = duzeltmeler.duzeltilenler.get(kayit.id) ?? [];
  const bununDuzelttigi = duzeltmeler.duzeltenler.get(kayit.id);
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/60 p-4" onClick={onKapat}>
      <div className="card max-h-[90vh] w-full max-w-lg overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <p className="font-semibold">{kayit.egitimAdi}</p>
        <p className="mt-0.5 text-xs text-muted">
          Sürüm {kayit.egitimSurum}
          {kayit.kategori ? ` · ${kayit.kategori}` : ""}
          {kayit.zorunlu ? " · yasal zorunlu" : ""}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <Alan etiket="Kişi" deger={kayit.ad} />
          <Alan etiket="Sicil" deger={kayit.sicil} />
          <Alan etiket="Bölüm" deger={kayit.bolum} />
          <Alan etiket="Kaynak" deger={KAYNAK_ETIKET[kayit.kaynak] ?? kayit.kaynak} />
          <Alan etiket="Başlangıç" deger={zamanMetni(kayit.baslangic)} />
          <Alan etiket="Bitiş" deger={zamanMetni(kayit.bitis)} />
          <Alan etiket="Süre" deger={sureMetni(kayit.sureSn)} />
          <Alan etiket="Puan" deger={kayit.puan === undefined ? "Sınavsız" : String(kayit.puan)} />
          <Alan etiket="Sonuç" deger={kayit.sonuc ? SONUC_ETIKET[kayit.sonuc] : "Açık"} />
          <Alan etiket="Geçerlilik bitişi" deger={kayit.gecerlilikBitis ?? "Süresiz"} />
          <Alan etiket="Eğitmen" deger={kayit.egitmen ?? ""} />
          <Alan etiket="Gözeten" deger={kayit.gozeten ?? ""} />
        </div>

        {kayit.notlar ? (
          <div className="mt-4 rounded-xl bg-wash px-3 py-2 text-sm">
            <p className="text-xs font-semibold text-muted">Not</p>
            <p className="mt-0.5 whitespace-pre-line">{kayit.notlar}</p>
          </div>
        ) : null}

        {/* ZİNCİRİN İKİ UCU DA GÖSTERİLİR. Denetçinin sorusu "bu kayıt geçerli
            mi" değil, "bu kaydın hikâyesi ne" — cevabı ancak iki yön birden
            görününce tamamlanır. */}
        {bunuDuzeltenler.length > 0 ? (
          <p className="mt-3 rounded-xl border border-accent/40 bg-accent/5 px-3 py-2 text-sm">
            <strong>Bu kayıt düzeltildi.</strong> Yerine geçen kayıt
            {bunuDuzeltenler.length > 1 ? "lar" : ""}:{" "}
            <span className="font-mono text-xs">{bunuDuzeltenler.join(", ")}</span>. Bu satır silinmedi, defterde
            kalıyor.
          </p>
        ) : null}
        {bununDuzelttigi ? (
          <p className="mt-3 rounded-xl border border-accent/40 bg-accent/5 px-3 py-2 text-sm">
            <strong>Bu bir düzeltme kaydı.</strong> <span className="font-mono text-xs">{bununDuzelttigi}</span>{" "}
            numaralı kaydın yerine geçer.
          </p>
        ) : null}

        <p className="mt-4 font-mono text-xs text-muted">Kayıt no: {kayit.id}</p>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button onClick={onKapat} className="btn-ghost text-sm">
            Kapat
          </button>
          {/* DÜZELTMENİN KAPISI BURADA. Kayıt defterinde silme/düzenleme yok,
              ama düzeltmenin bir yolu VAR ve bulunabilir olmalı; kullanıcı
              önce kalem ikonunu arıyor, bulamayınca ürünü eksik sanıyordu.
              Zaten düzeltilmiş bir kayda ikinci düzeltme teklif edilmez. */}
          {bunuDuzeltenler.length === 0 ? (
            <Link
              href={`/kayitlar/sinif?duzelt=${encodeURIComponent(kayit.id)}`}
              className="btn-ghost text-sm"
              title="Bu kaydın yerine geçecek yeni bir kayıt girin — eski satır silinmez"
            >
              <Icon name="pencil" size={16} /> Düzeltme kaydı
            </Link>
          ) : null}
          {kayit.sonuc === "gecti" ? (
            <button onClick={onSertifika} className="btn-primary text-sm">
              <Icon name="print" size={16} /> Sertifika
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
