import { jsPDF } from "jspdf";
import { PDF_FONT as FONT, yaziTipiGom } from "./pdfYaziTipi";

/**
 * Ziyaretçi defteri PDF'i — denetime götürülecek okunur liste.
 *
 * CSV ile İKİSİ DE VAR, aynı sebeple (`panoPdf.ts`): CSV denetim BELGESİdir
 * (Excel'de süzülür, tam liste), PDF okunacak çıktıdır — ziyaretçi defteri
 * çoğu fabrikada hâlâ kapıdaki klasöre kaldırılıyor.
 *
 * YAZI TİPİ ORTAK KAPIDAN GELİR (`pdfYaziTipi.ts`). Bu dosya eskiden gömme
 * kodunun kendi kopyasını taşıyordu; ortak kapının yorumu "üç belgede ayrı
 * ayrı gömülseydi biri güncellenip diğerleri unutulurdu" diye tam bu tuzağı
 * anlatıyordu ve tuzak zaten kurulmuştu. Kopyanın somut bedeli: gömülü yazı
 * tipinde olmayan karakterleri temizleyen süzgeç ortak kapıda kurulduğu için
 * bu belgede ÇALIŞMIYORDU — ziyaretçi defterindeki tireler kayboluyordu.
 */

export interface ZiyaretciPdfSatiri {
  ad: string;
  firma: string;
  kayit: string;
  durum: string;
  ilerleme: string;
  bilgilendirmeler: string;
}

/**
 * `satirlar` dışa aktarım uç noktasından gelir (aynı satırlar CSV'ye de gider);
 * iki çıktı ayrı ayrı kurulsaydı biri güncellenir öteki unutulurdu.
 */
export async function ziyaretciPdfIndir(satirlar: ZiyaretciPdfSatiri[], tarih: string, aralikEtiketi: string): Promise<void> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const gomuldu = await yaziTipiGom(doc);
  const ft = (kalin = false) => doc.setFont(gomuldu ? FONT : "helvetica", kalin ? "bold" : "normal");

  const KENAR = 40;
  const GENIS = doc.internal.pageSize.getWidth() - KENAR * 2;
  let y = KENAR;

  ft(true);
  doc.setFontSize(20);
  doc.setTextColor(0, 30, 100);
  doc.text("Ziyaretçi bilgilendirme defteri", KENAR, y);
  y += 20;

  ft();
  doc.setFontSize(10);
  doc.setTextColor(120, 113, 108);
  doc.text(`FlowTrain · ${tarih} · ${aralikEtiketi}`, KENAR, y);
  y += 14;

  let tamam = 0;
  for (const s of satirlar) if (s.durum === "Tamamlandı") tamam++;
  doc.text(`${satirlar.length} ziyaretçi · ${tamam} tamamlandı · ${satirlar.length - tamam} yarım`, KENAR, y);
  y += 24;

  // ── başlık şeridi ──
  const SUTUN = [KENAR, KENAR + 150, KENAR + 250, KENAR + 355, KENAR + 420];
  ft(true);
  doc.setFontSize(9);
  doc.setTextColor(24, 24, 27);
  doc.text("Ad soyad", SUTUN[0], y);
  doc.text("Firma", SUTUN[1], y);
  doc.text("Kayıt", SUTUN[2], y);
  doc.text("Durum", SUTUN[3], y);
  doc.text("İlerleme", SUTUN[4], y);
  y += 5;
  doc.setDrawColor(236, 236, 235);
  doc.line(KENAR, y, KENAR + GENIS, y);
  y += 13;

  ft();
  doc.setFontSize(9);
  for (const s of satirlar) {
    if (y + 26 > doc.internal.pageSize.getHeight() - KENAR) {
      doc.addPage();
      y = KENAR;
    }
    doc.setTextColor(24, 24, 27);
    doc.text(s.ad.slice(0, 30), SUTUN[0], y);
    doc.setTextColor(120, 113, 108);
    doc.text(s.firma.slice(0, 20), SUTUN[1], y);
    doc.text(s.kayit, SUTUN[2], y);
    doc.text(s.durum, SUTUN[3], y);
    doc.text(s.ilerleme, SUTUN[4], y);
    y += 12;

    // İzlenen bilgilendirmeler ikinci satırda: denetimde asıl sorulan bu.
    if (s.bilgilendirmeler) {
      doc.setFontSize(8);
      doc.setTextColor(160, 155, 150);
      doc.text(s.bilgilendirmeler.slice(0, 120), SUTUN[0] + 8, y);
      doc.setFontSize(9);
      y += 12;
    }
  }

  const sayfaSayisi = doc.getNumberOfPages();
  for (let i = 1; i <= sayfaSayisi; i++) {
    doc.setPage(i);
    ft();
    doc.setFontSize(8);
    doc.setTextColor(160, 155, 150);
    doc.text(
      `Ziyaretçi kaydı personel eğitim kaydı değildir; panodaki tamamlanma oranına girmez.   ${i}/${sayfaSayisi}`,
      KENAR,
      doc.internal.pageSize.getHeight() - 24,
    );
  }

  doc.save(`flowtrain-ziyaretci-${tarih}.pdf`);
}
