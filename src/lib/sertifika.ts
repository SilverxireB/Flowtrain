import { jsPDF } from "jspdf";
import { PDF_FONT, yaziTipiGom } from "./pdfYaziTipi";
import type { BelgeKunyesi } from "./rapor";

/**
 * KİŞİ SERTİFİKASI — "bu kişi, bu eğitimi, şu tarihte, şu sürümle tamamladı."
 *
 * NE DEĞİL: süslü bir duvar belgesi değil. Denetimde ya da bir iş kazası
 * soruşturmasında masaya konan tek sayfadır; o yüzden üstünde SÜRÜM ve BELGE NO
 * vardır. Sürüm olmadan belge "hangi içerikten sınav oldu" sorusunu
 * cevaplayamaz — eğitim yıllar içinde değişir, kayıt sabittir.
 *
 * DOĞRULAMA KODU YOK, BİLEREK: kapalı ağda QR/URL doğrulaması yapacak bir
 * servis yok. Belge no defterdeki oturum kimliğidir; doğrulama yolu ürünün
 * kendi kayıt defteridir, kâğıdın üstündeki bir kod değil.
 */
export interface SertifikaVerisi {
  ad: string;
  sicil: string;
  bolum?: string;
  egitimAdi: string;
  egitimSurum: number;
  kategori?: string;
  zorunlu?: boolean;
  /** ISO damga. */
  tamamlama: string;
  /** Tekrar gerekiyorsa geçerlilik bitişi (`YYYY-AA-GG`). */
  gecerlilikBitis?: string;
  puan?: number;
  kaynakEtiket: string;
  egitmen?: string;
  /** Defterdeki oturum kimliği. */
  belgeNo: string;
}

const KENAR = 56;

function gunMetni(iso: string): string {
  return (iso ?? "").slice(0, 10) || "—";
}

function alanYaz(doc: jsPDF, etiket: string, deger: string, x: number, y: number, genislik: number): void {
  doc.setFontSize(8);
  doc.setTextColor(140, 135, 130);
  doc.text(etiket.toLocaleUpperCase("tr"), x, y);
  doc.setFontSize(11);
  doc.setTextColor(24, 24, 27);
  doc.text(doc.splitTextToSize(deger || "—", genislik)[0] ?? "—", x, y + 15);
}

function sayfaCiz(doc: jsPDF, v: SertifikaVerisi, kunye: BelgeKunyesi, kalin: () => void, duz: () => void): void {
  const genislik = doc.internal.pageSize.getWidth();
  const yukseklik = doc.internal.pageSize.getHeight();
  const govde = genislik - KENAR * 2;

  // Çerçeve: belgenin tek sayfa olduğunu ve kesilmediğini gözle gösterir.
  doc.setDrawColor(0, 30, 100);
  doc.setLineWidth(1.2);
  doc.rect(KENAR - 16, KENAR - 16, govde + 32, yukseklik - (KENAR - 16) * 2);
  doc.setLineWidth(1);

  let y = KENAR + 14;

  /* KURUM ADI EN ÜSTTE: sertifika kişinin elinde fabrikadan çıkar, başka bir
     işverene ya da denetçiye gösterilir. Üstünde yalnız ürünün adı yazan bir
     belge "hangi kurumda alınmış" sorusunu cevaplamıyordu. */
  duz();
  doc.setFontSize(9);
  doc.setTextColor(120, 113, 108);
  doc.text(`${kunye.kurum.toLocaleUpperCase("tr")} · EĞİTİM KAYIT BELGESİ`.slice(0, 90), KENAR, y);
  y += 34;

  kalin();
  doc.setFontSize(26);
  doc.setTextColor(0, 30, 100);
  for (const satir of doc.splitTextToSize(v.egitimAdi, govde).slice(0, 2)) {
    doc.text(satir, KENAR, y);
    y += 30;
  }

  duz();
  doc.setFontSize(11);
  doc.setTextColor(120, 113, 108);
  doc.text(
    `Sürüm ${v.egitimSurum}${v.kategori ? ` · ${v.kategori}` : ""}${v.zorunlu ? " · Yasal zorunlu eğitim" : ""}`,
    KENAR,
    y,
  );
  y += 40;

  doc.setDrawColor(236, 236, 235);
  doc.line(KENAR, y, KENAR + govde, y);
  y += 30;

  kalin();
  doc.setFontSize(20);
  doc.setTextColor(24, 24, 27);
  doc.text(doc.splitTextToSize(v.ad || v.sicil, govde)[0] ?? v.sicil, KENAR, y);
  y += 20;

  duz();
  doc.setFontSize(11);
  doc.setTextColor(120, 113, 108);
  doc.text(`Sicil ${v.sicil}${v.bolum ? ` · ${v.bolum}` : ""}`, KENAR, y);
  y += 34;

  doc.setFontSize(11);
  doc.setTextColor(24, 24, 27);
  doc.text(
    doc.splitTextToSize(
      `yukarıdaki eğitimi ${gunMetni(v.tamamlama)} tarihinde tamamlamış ve kaydı FlowTrain kayıt defterine işlenmiştir.`,
      govde,
    ),
    KENAR,
    y,
  );
  y += 46;

  // İki kolonlu künye: denetçinin aradığı dört alan tek bakışta görünsün.
  const kolon = govde / 2;
  alanYaz(doc, "Tamamlama", gunMetni(v.tamamlama), KENAR, y, kolon - 12);
  alanYaz(doc, "Geçerlilik", v.gecerlilikBitis || "Süresiz", KENAR + kolon, y, kolon - 12);
  y += 44;
  alanYaz(doc, "Puan", v.puan === undefined ? "Sınavsız" : `${v.puan} / 100`, KENAR, y, kolon - 12);
  alanYaz(doc, "Kayıt kaynağı", v.kaynakEtiket, KENAR + kolon, y, kolon - 12);
  y += 44;
  if (v.egitmen) {
    alanYaz(doc, "Eğitmen", v.egitmen, KENAR, y, kolon - 12);
    y += 44;
  }

  duz();
  doc.setFontSize(8);
  doc.setTextColor(160, 155, 150);
  // Belge no defterdeki oturum kimliğidir; üretim anı ise belgenin ne zaman
  // BASILDIĞINI söyler. İkisi farklı şeydir: kayıt 2024'te doğmuş olabilir,
  // çıktısı bugün alınmıştır ve denetçi hangi kopyaya baktığını bilmelidir.
  doc.text(`Belge no: ${v.belgeNo} · Üretim: ${kunye.uretim}`, KENAR, yukseklik - KENAR - 4);
  doc.text(
    "Bu belge kayıt defterindeki tek bir kaydın çıktısıdır; kayıt düzenlenmez ve silinmez.",
    KENAR + govde,
    yukseklik - KENAR - 4,
    { align: "right" },
  );
}

/**
 * Bir ya da çok kişi için sertifika basar — HER KAYIT AYRI SAYFA. Kaydetmez.
 *
 * TOPLU BASIM AYRI BİR DOSYA ÜRETMEZ: otuz kişilik sınıf için otuz indirme,
 * otuz kez "kaydet" penceresi demekti. Tek PDF yazıcıya bir kez gider.
 */
export async function sertifikaKur(kayitlar: SertifikaVerisi[], kunye: BelgeKunyesi): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const gomuldu = await yaziTipiGom(doc);
  const kalin = () => doc.setFont(gomuldu ? PDF_FONT : "helvetica", "bold");
  const duz = () => doc.setFont(gomuldu ? PDF_FONT : "helvetica", "normal");

  for (let i = 0; i < kayitlar.length; i++) {
    if (i > 0) doc.addPage();
    sayfaCiz(doc, kayitlar[i], kunye, kalin, duz);
  }

  /* TOPLU BASIMDA SAYFA NUMARASI VAR, TEKTE YOK.
     Tek sayfalık bir sertifikanın üstündeki "1/1" gereksiz gürültü; 200
     sayfalık bir tomarda ise eksik yaprağın fark edilmesinin tek yolu.
     Numara belgenin İÇERİĞİNİN parçası değil, tomarın sayacıdır — o yüzden
     kenarda, künyenin karşısında durur. */
  const sayfaSayisi = doc.getNumberOfPages();
  if (sayfaSayisi > 1) {
    const genislik = doc.internal.pageSize.getWidth();
    const yukseklik = doc.internal.pageSize.getHeight();
    for (let i = 1; i <= sayfaSayisi; i++) {
      doc.setPage(i);
      duz();
      doc.setFontSize(8);
      doc.setTextColor(160, 155, 150);
      doc.text(`${i}/${sayfaSayisi}`, genislik - KENAR, KENAR - 2, { align: "right" });
      doc.text(`Toplu basım · ${kunye.uretim}`, genislik - KENAR, yukseklik - KENAR + 8, { align: "right" });
    }
  }

  return doc;
}

export async function sertifikaIndir(kayitlar: SertifikaVerisi[], kunye: BelgeKunyesi, tarih: string): Promise<void> {
  if (kayitlar.length === 0) return;
  const doc = await sertifikaKur(kayitlar, kunye);
  const dosya =
    kayitlar.length === 1
      ? `flowtrain-sertifika-${kayitlar[0].sicil}-${gunMetni(kayitlar[0].tamamlama)}.pdf`
      : `flowtrain-sertifikalar-${tarih}-${kayitlar.length}.pdf`;
  doc.save(dosya);
}
