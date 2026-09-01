"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import Icon from "@/components/Icon";
import { PRESETLER, presetAraligi, eslesenPreset } from "@/lib/tarihPreset";
import { suzgecCipleri } from "@/lib/suzgecCipleri";
import { tabloSirala, sonrakiSira, type SiraYonu } from "@/lib/tabloSirala";
import TabloBaslik from "@/components/TabloBaslik";
import FlowSecici from "@/components/FlowSecici";
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

/**
 * SÜTUN → SIRALANACAK DEĞER.
 *
 * Modül seviyesinde: her çizimde yeniden kurulsaydı `useMemo` bağımlılığı
 * her turda değişir ve sıralama boşuna tekrarlanırdı (CLAUDE.md'nin
 * "parametre yakalayan yardımcı" uyarısıyla aynı aile).
 *
 * "Tamamlama" TÜRETİLMİŞ: kayıt bitmemişse başlangıç damgasıyla sıralanır,
 * yoksa açık oturumların hepsi boş sayılıp sona yığılırdı — oysa onlar
 * defterin en taze satırları.
 */
const SIRA_ALANI: Record<string, (k: KayitSatiri) => unknown> = {
  tamamlama: (k) => k.bitis || k.baslangic,
  sicil: (k) => k.sicil,
  ad: (k) => k.ad,
  bolum: (k) => k.bolum,
  egitim: (k) => k.egitimAdi,
  puan: (k) => k.puan,
  sonuc: (k) => k.sonuc,
  kaynak: (k) => k.kaynak,
  egitmen: (k) => k.egitmen,
};

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
  /* SÜZGEÇ PANELİ KAPALI BAŞLAR (FlowUI dili). Kokpit tek satırdır; asıl
     iş listeye bakmak, süzmek ikincil. Panel hep açık dursaydı ekranın
     üçte biri her açılışta doldurulmamış alanlara giderdi. Durumu ALTTAKİ
     ÇİPLER anlatıyor, yani kapalıyken de neyin süzüldüğü görünüyor.
     Zorunlu alanı olan sayfalarda açık başlar — burada zorunlu alan yok. */
  const [panelAcik, setPanelAcik] = useState(false);

  /* SIRALAMA — üç kokpit tablosunun ortak dili. Defterde hiç yoktu:
     "en son kim tamamladı" ya da "kim kaldı" sorusuna cevap vermek için
     gözle taramak gerekiyordu. Varsayılan tamamlama tarihine göre AZALAN:
     defteri açan kişinin ilk sorusu neredeyse her zaman "bugün ne oldu". */
  const [sira, setSira] = useState<{ sutun: string; yon: SiraYonu }>({ sutun: "tamamlama", yon: "azalan" });

  /* Çip listesi süzgeçten TÜRETİLİR, ayrı bir durumda tutulmaz: iki gerçek
     yarışırsa çipler süzgeçle ayrışır ve ekran yalan söyler. */
  const aktifCipler = suzgecCipleri(suzgec, {
    egitimAdi: (id) => egitimler.find((e) => e.id === id)?.ad,
    kaynakAdi: (k) => KAYNAK_ETIKET[k as OturumKaynagi],
  });
  const [sayfaBoyu, setSayfaBoyu] = useState(20);
  const [sayfa, setSayfa] = useState(1);
  const [secili, setSecili] = useState<KayitSatiri | null>(null);
  const [calisiyor, setCalisiyor] = useState("");

  const suzulmus = useMemo(() => kayitlariSuz(satirlar, suzgec), [satirlar, suzgec]);

  /* SIRALAMA SÜZGEÇTEN SONRA, SAYFALAMADAN ÖNCE. Sayfalanmış dilimi
     sıralamak yalnız o sayfayı sıralardı — kullanıcı "en yüksek puan"
     dediğinde ikinci sayfadaki 100'ü hiç görmezdi. */
  const sirali = useMemo(
    () => tabloSirala(suzulmus, (k) => SIRA_ALANI[sira.sutun]?.(k), sira.yon),
    [suzulmus, sira],
  );
  const { gorunen, gecerliSayfa, sonSayfa } = sayfala(sirali, sayfa, sayfaBoyu);
  const gecenler = useMemo(() => suzulmus.filter((k) => k.sonuc === "gecti"), [suzulmus]);

  /* DÜZELTME BAĞLARI TEK GEÇİŞTE çıkarılır ve tüm defter için hesaplanır
     (süzülmüş liste için değil): düzeltme kaydı süzgecin dışında kalmış
     olabilir ve o zaman eski satır "düzeltildi" işaretini kaybederdi —
     denetimde en yanıltıcı hâl. */
  const duzeltmeler = useMemo(() => duzeltmeHaritasi(satirlar), [satirlar]);

  function sutunaBas(sutun: string) {
    setSira((s) => sonrakiSira(s, sutun));
    setSayfa(1);
  }

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
      {/* ── SÜZGEÇ KOKPİTİ (FlowUI dili) ──────────────────────────────────
          TEK SATIR: kayıt rozeti · tarih hapları · "Filtreler" çipi ·
          tabloda-ara · dışa aktarım. Panel bunun ALTINDA ve kapalı başlıyor. */}
      {/* KAP YOK: FlowUI'da kokpiti cam kutuya almak denendi ve kaldırıldı.
          Denetimler tablonun üstünde serbest durur. */}
      <div className="flow-kokpit">
        <span className="flow-kokpit-rozet">
          <strong>{suzulmus.length}</strong> kayıt
          {suzulmus.length !== satirlar.length ? <span className="text-muted">/ {satirlar.length}</span> : null}
        </span>

          {/* TARİH PRESET HAPLARI — Defter'e bakan kişinin sorusu neredeyse
              her zaman "bugün ne oldu"; iki takvim kutusu doldurmak o soruya
              en pahalı cevap. Kutular panelde duruyor, sık aralık tek tıkla.

              HAP, DÜĞME DEĞİL: vurgu temanın kimliğinden gelir, imza halkası
              burada KULLANILMAZ. Aralık takvimden elle seçilse bile eşleşen
              hap yanar. Sıra önem sırası: dar ekranda yalnız "Bugün" kalır. */}
          <span className="flow-hap-serit">
            {PRESETLER.map((p, i) => (
              <button
                key={p.anahtar}
                type="button"
                aria-pressed={eslesenPreset(suzgec, new Date()) === p.anahtar}
                onClick={() => degistir(presetAraligi(p.anahtar, new Date()))}
                className={`flow-hap${i > 0 ? " hidden sm:inline-flex" : ""}`}
              >
                {p.etiket}
              </button>
            ))}
          </span>

          <button
            type="button"
            onClick={() => setPanelAcik((a) => !a)}
            aria-expanded={panelAcik}
            aria-pressed={suzgecAcikMi(suzgec)}
            className="flow-hap"
          >
            <Icon name="list" size={14} /> Filtreler
          </button>

        <label className="flow-arama-yuva">
          <span className="sr-only">Kişi ya da sicil ara</span>
          <span className="flow-arama-simge" aria-hidden>
            <Icon name="search" size={15} />
          </span>
          <input
            value={suzgec.sorgu}
            onChange={(e) => degistir({ sorgu: e.target.value })}
            placeholder="Tabloda ara"
            className="flow-arama"
          />
        </label>

        {/* Dışa aktarım SAĞDA ve ARAÇ ÖLÇÜSÜNDE. Sayfa düğmesi ölçüsünde
            (`btn-ghost`) bırakıldığında şerit şişiyor ve asıl iş olan
            listeden dikkat çalıyordu — kokpit bir araç çubuğu. */}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button onClick={csvIndir} className="flow-arac" title="Süzülmüş listeyi CSV olarak indir">
            <Icon name="download" size={15} /> CSV
          </button>
          <button onClick={pdfIndir} disabled={!!calisiyor} className="flow-arac" title="Süzülmüş listeyi PDF olarak indir">
            <Icon name="download" size={15} /> {calisiyor === "pdf" ? "Hazırlanıyor…" : "PDF"}
          </button>
          <button
            onClick={() => sertifikaBas(gecenler)}
            disabled={!!calisiyor || gecenler.length === 0}
            className="flow-arac"
            title={`Süzülmüş listedeki ${gecenler.length} geçti kaydı için tek PDF`}
          >
            <Icon name="print" size={15} />{" "}
            {calisiyor === "sertifika" ? "Hazırlanıyor…" : `Sertifika (${gecenler.length})`}
          </button>
        </div>
      </div>

      {/* AKTİF SÜZGEÇ ÇİPLERİ — panel kapalıyken neyin süzüldüğünü bunlar
          söylüyor. Olmadıkları sürece kullanıcı "liste neden kısa" diye
          takılıyor ve süzgecin açık olduğunu ancak paneli açınca görüyordu.
          Her çip kendi kaldırma düğmesini taşıyor: gevşetmek için panele
          dönmek gerekmiyor. */}
      {aktifCipler.length > 0 ? (
        <div className="flow-cip-serit">
          <span className="flow-cip-etiket">Süzgeç:</span>
          {aktifCipler.map((c) => (
            <span key={c.anahtar} className="flow-cip">
              <span className="flow-cip-anahtar">{c.alan}:</span> {c.deger}
              <button
                type="button"
                onClick={() => degistir(c.temizle)}
                className="flow-cip-sil"
                /* Etiket "… süzgeci" ile BAŞLAMIYOR: alanın kendi etiketiyle
                    ("Sonuç süzgeci") çakışıyor ve hem ekran okuyucuda hem
                    sınavda iki öğe aynı ada geliyordu. */
                aria-label={`Kaldır: ${c.alan} — ${c.deger}`}
              >
                <Icon name="close" size={12} />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={() => {
              setSuzgec(BOS_SUZGEC);
              setSayfa(1);
            }}
            className="flow-cip-etiket underline underline-offset-2 hover:text-ink"
          >
            hepsini temizle
          </button>
        </div>
      ) : null}

      {panelAcik ? (
        <div className="flow-suzgec-panel">
          <label className="min-w-0 max-w-full">
            <span className="sr-only">Eğitim süzgeci</span>
            <FlowSecici
              value={suzgec.egitimId}
              onChange={(v) => degistir({ egitimId: v })}
              aria-label="Eğitim süzgeci"
              sinif="max-w-full"
            >
              <option value="">Tüm eğitimler</option>
              {egitimler.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.ad}
                </option>
              ))}
            </FlowSecici>
          </label>

          <label className="min-w-0 max-w-full">
            <span className="sr-only">Bölüm süzgeci</span>
            <FlowSecici
              value={suzgec.bolum}
              onChange={(v) => degistir({ bolum: v })}
              aria-label="Bölüm süzgeci"
              sinif="max-w-full"
            >
              <option value="">Tüm bölümler</option>
              {bolumler.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </FlowSecici>
          </label>

          <label className="min-w-0 max-w-full">
            <span className="sr-only">Kaynak süzgeci</span>
            <FlowSecici
              value={suzgec.kaynak}
              onChange={(v) => degistir({ kaynak: v as OturumKaynagi | "" })}
              aria-label="Kaynak süzgeci"
              sinif="max-w-full"
            >
              <option value="">Tüm kaynaklar</option>
              {(Object.keys(KAYNAK_ETIKET) as OturumKaynagi[]).map((k) => (
                <option key={k} value={k}>
                  {KAYNAK_ETIKET[k]}
                </option>
              ))}
            </FlowSecici>
          </label>

          <label className="min-w-0 max-w-full">
            <span className="sr-only">Sonuç süzgeci</span>
            <FlowSecici
              value={suzgec.sonuc}
              onChange={(v) => degistir({ sonuc: v as SonucSuzgeci })}
              aria-label="Sonuç süzgeci"
              sinif="max-w-full"
            >
              <option value="">Tüm sonuçlar</option>
              {SONUC_SECENEKLERI.map((s) => (
                <option key={s} value={s}>
                  {SONUC_ETIKET[s]}
                </option>
              ))}
            </FlowSecici>
          </label>

          {/* PRESET HAPLARI BURADA DEĞİL, KOKPİTTE. Panele ikinci bir kopya
              koymuştum: aynı dört hap ekranda iki kez çıkıyordu ve hangisinin
              hangisi olduğu belirsizdi. Preset kokpitin işi — panel elle
              yazılan aralık içindir. */}
          <span className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-muted">
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

          {/* UYGULANINCA PANEL KENDİNİ TOPLAR (FlowUI dili): süzgeç seçmek
              bir amaç değil, listeye bakmanın yolu. Temizlemek de paneli
              kapatır — geriye bakacak bir durum kalmıyor. */}
          <button
            type="button"
            onClick={() => setPanelAcik(false)}
            className="btn-primary shrink-0 py-2 text-sm"
          >
            <Icon name="check" size={16} /> Uygula
          </button>

          {suzgecAcikMi(suzgec) ? (
            <button
              onClick={() => {
                setSuzgec(BOS_SUZGEC);
                setSayfa(1);
                setPanelAcik(false);
              }}
              className="btn-ghost shrink-0 py-2 text-sm"
            >
              <Icon name="close" size={16} /> Süzgeci temizle
            </button>
          ) : null}
        </div>
      ) : null}
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
        <p className="flow-bos-satir mt-4">
          {satirlar.length === 0
            ? "Henüz tamamlama kaydı yok. Kioskta yapılan eğitimler, sınıf kayıtları ve içe aktarılan geçmiş kayıtlar burada toplanır."
            : "Bu süzgeçle eşleşen kayıt yok."}
        </p>
      ) : (
        <div className="flow-tablo-kap flow-kaydir-x mt-4">
          <table className="flow-tablo min-w-[1080px]">
            <thead>
              {/* Başlık şeridi ve kenarlık `.flow-tablo`dan; burada yalnız punto. */}
              {/* SÜTUNLAR SIRALANABİLİR. Defterde hiç yoktu: "en son kim
                  tamamladı", "kim kaldı", "hangi bölüm geride" sorularının
                  hepsi gözle tarama gerektiriyordu. Ortak başlık bileşeni
                  (`TabloBaslik`) üç tabloda da aynı davranışı veriyor.
                  Sıralanamayan sütunlar (süre/deneme) türetilmiş değerler
                  ve ayrı bir okuma gerektiriyor — bilerek dışarıda. */}
              <tr className="text-xs">
                <TabloBaslik sutun="tamamlama" etiket="Tamamlama" sira={sira} bas={sutunaBas} sinif="px-4 py-3 font-semibold" />
                <TabloBaslik sutun="sicil" etiket="Sicil" sira={sira} bas={sutunaBas} sinif="px-4 py-3 font-semibold" />
                <TabloBaslik sutun="ad" etiket="Ad" sira={sira} bas={sutunaBas} sinif="px-4 py-3 font-semibold" />
                <TabloBaslik sutun="bolum" etiket="Bölüm" sira={sira} bas={sutunaBas} sinif="px-4 py-3 font-semibold" />
                <TabloBaslik sutun="egitim" etiket="Eğitim" sira={sira} bas={sutunaBas} sinif="px-4 py-3 font-semibold" />
                <th className="px-2 py-3 text-right font-semibold">Sür.</th>
                <th className="px-2 py-3 text-right font-semibold">Süre</th>
                <TabloBaslik sutun="puan" etiket="Puan" sira={sira} bas={sutunaBas} sagda sinif="px-2 py-3 font-semibold" />
                <TabloBaslik sutun="sonuc" etiket="Sonuç" sira={sira} bas={sutunaBas} sinif="px-4 py-3 font-semibold" />
                <TabloBaslik sutun="kaynak" etiket="Kaynak" sira={sira} bas={sutunaBas} sinif="px-4 py-3 font-semibold" />
                <TabloBaslik sutun="egitmen" etiket="Eğitmen" sira={sira} bas={sutunaBas} sinif="px-4 py-3 font-semibold" />
                <th className="px-2 py-3" />
              </tr>
            </thead>
            <tbody>
              {gorunen.map((k) => (
                <tr key={k.id}>
                  {/* İKİ SATIRLI HÜCRE: `.sarar` kırpma kuralının dışında
                      bırakır — tamamlanmamış kayıtta altına "başladı …"
                      satırı düşüyor ve tek satıra sıkıştırılırsa o bilgi
                      kayboluyor. */}
                  <td className="sarar whitespace-nowrap px-4 py-2.5">
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
                      className="btn-ghost dokunma-44 px-2 py-1 text-xs"
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
          <FlowSecici
            value={String(sayfaBoyu)}
            onChange={(v) => {
              setSayfaBoyu(Number(v));
              setSayfa(1);
            }}
            aria-label="Sayfa başına kayıt"
          >
            {[20, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </FlowSecici>
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
          <div className="mt-4 rounded-flow bg-wash px-3 py-2 text-sm">
            <p className="text-xs font-semibold text-muted">Not</p>
            <p className="mt-0.5 whitespace-pre-line">{kayit.notlar}</p>
          </div>
        ) : null}

        {/* ZİNCİRİN İKİ UCU DA GÖSTERİLİR. Denetçinin sorusu "bu kayıt geçerli
            mi" değil, "bu kaydın hikâyesi ne" — cevabı ancak iki yön birden
            görününce tamamlanır. */}
        {bunuDuzeltenler.length > 0 ? (
          <p className="mt-3 rounded-flow border border-accent/40 bg-accent/5 px-3 py-2 text-sm">
            <strong>Bu kayıt düzeltildi.</strong> Yerine geçen kayıt
            {bunuDuzeltenler.length > 1 ? "lar" : ""}:{" "}
            <span className="font-mono text-xs">{bunuDuzeltenler.join(", ")}</span>. Bu satır silinmedi, defterde
            kalıyor.
          </p>
        ) : null}
        {bununDuzelttigi ? (
          <p className="mt-3 rounded-flow border border-accent/40 bg-accent/5 px-3 py-2 text-sm">
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
