import { jsPDF } from "jspdf";
import { PDF_FONT, yaziTipiGom } from "./pdfYaziTipi";
import { sureMetni, zamanMetni, type KayitSatiri } from "./rapor";
import { KAYNAK_ETIKET } from "./tipler";

/**
 * KAYIT DEFTERİ PDF'İ — denetçinin eline verilebilen belge.
 *
 * PANO PDF'İNDEN FARKI: pano PDF'i bir ÖZETtir ("fabrikanın %72'si tamam"),
 * bu ise LİSTEdir ("şu kişi şu eğitimi şu gün tamamladı"). Denetçi özet
 * istemiyor, satır istiyor.
 *
 * SÜZGEÇ BELGENİN ÜSTÜNE YAZILIR. Ekrandaki süzgeç neyi gizlerse gizlesin,
 * çıktı o süzgecin sonucudur — hangi süzgeçle alındığı belgede yazmazsa,
 * denetimde "bu liste eksik mi, yoksa hepsi bu mu" sorusunun cevabı yoktur.
 */
const KENAR = 36;

/** Sonuç sütununun okunur karşılığı. Boş = oturum hâlâ açık. */
const SONUC_ETIKET: Record<string, string> = { gecti: "Geçti", kaldi: "Kaldı", iptal: "İptal" };

interface Sutun {
  baslik: string;
  genislik: number;
  /** Sağa yaslanacak sayısal sütunlar. */
  sag?: boolean;
}

const SUTUNLAR: Sutun[] = [
  { baslik: "Tarih", genislik: 78 },
  { baslik: "Sicil", genislik: 58 },
  { baslik: "Ad", genislik: 108 },
  { baslik: "Bölüm", genislik: 78 },
  { baslik: "Eğitim", genislik: 132 },
  { baslik: "Sür.", genislik: 26, sag: true },
  { baslik: "Süre", genislik: 42, sag: true },
  { baslik: "Puan", genislik: 32, sag: true },
  { baslik: "Sonuç", genislik: 38 },
  { baslik: "Kaynak", genislik: 62 },
];

function hucreler(k: KayitSatiri): string[] {
  return [
    zamanMetni(k.bitis ?? k.baslangic),
    k.sicil,
    k.ad || "—",
    k.bolum || "—",
    k.egitimAdi,
    String(k.egitimSurum),
    sureMetni(k.sureSn),
    k.puan === undefined ? "—" : String(k.puan),
    k.sonuc ? (SONUC_ETIKET[k.sonuc] ?? k.sonuc) : "açık",
    KAYNAK_ETIKET[k.kaynak] ?? k.kaynak,
  ];
}

export async function kayitDefteriPdfIndir(satirlar: KayitSatiri[], suzgecOzeti: string, tarih: string): Promise<void> {
  // YATAY A4: on sütun dikey sayfaya sığmıyor, sığdırmak için yazıyı 5 punto'ya
  // indirmek gerekirdi — okunmayan belge belge değildir.
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
  const gomuldu = await yaziTipiGom(doc);
  const ft = (kalin = false) => doc.setFont(gomuldu ? PDF_FONT : "helvetica", kalin ? "bold" : "normal");

  const sayfaGenislik = doc.internal.pageSize.getWidth();
  const sayfaYukseklik = doc.internal.pageSize.getHeight();
  const govdeGenislik = sayfaGenislik - KENAR * 2;

  let y = KENAR;

  ft(true);
  doc.setFontSize(18);
  doc.setTextColor(0, 30, 100);
  doc.text("Eğitim kayıt defteri", KENAR, y);
  y += 17;

  ft();
  doc.setFontSize(9);
  doc.setTextColor(120, 113, 108);
  doc.text(`FlowTrain · ${tarih} · ${satirlar.length} kayıt`, KENAR, y);
  y += 12;
  doc.text(suzgecOzeti.slice(0, 190), KENAR, y);
  y += 18;

  const basliklariYaz = () => {
    ft(true);
    doc.setFontSize(8);
    doc.setTextColor(120, 113, 108);
    let x = KENAR;
    for (const s of SUTUNLAR) {
      doc.text(s.baslik, s.sag ? x + s.genislik - 4 : x, y, s.sag ? { align: "right" } : undefined);
      x += s.genislik;
    }
    y += 5;
    doc.setDrawColor(200, 197, 194);
    doc.line(KENAR, y, KENAR + govdeGenislik, y);
    y += 11;
    ft();
    doc.setFontSize(8);
  };

  basliklariYaz();

  for (const k of satirlar) {
    if (y > sayfaYukseklik - KENAR - 14) {
      doc.addPage();
      y = KENAR;
      basliklariYaz();
    }
    const degerler = hucreler(k);
    let x = KENAR;
    for (let i = 0; i < SUTUNLAR.length; i++) {
      const s = SUTUNLAR[i];
      doc.setTextColor(i <= 4 ? 24 : 100, i <= 4 ? 24 : 96, i <= 4 ? 27 : 92);
      // Taşan metin KESİLİR, sarılmaz: sarma satır yüksekliğini değiştirir ve
      // sütunlar sayfa boyunca kayar. Tam metin CSV çıktısında zaten var.
      const metin = doc.splitTextToSize(degerler[i] ?? "", s.genislik - 6)[0] ?? "";
      doc.text(metin, s.sag ? x + s.genislik - 4 : x, y, s.sag ? { align: "right" } : undefined);
      x += s.genislik;
    }
    y += 12;
  }

  if (satirlar.length === 0) {
    doc.setTextColor(120, 113, 108);
    doc.text("Bu süzgeçle eşleşen kayıt yok.", KENAR, y);
  }

  /* Sayfa altı notu ürünün en önemli kararını belgeye taşır: kayıt
     düzenlenmez, silinmez. Düzenlenebilir bir tamamlama kaydı denetimde
     değersizdir; belgeyi okuyanın bunu bilmesi gerekir. */
  const sayfaSayisi = doc.getNumberOfPages();
  for (let i = 1; i <= sayfaSayisi; i++) {
    doc.setPage(i);
    ft();
    doc.setFontSize(7.5);
    doc.setTextColor(160, 155, 150);
    doc.text(
      "Kayıtlar düzenlenmez ve silinmez; düzeltme yeni bir kayıt ve denetim izi notuyla yapılır.",
      KENAR,
      sayfaYukseklik - 22,
    );
    doc.text(`${i}/${sayfaSayisi}`, sayfaGenislik - KENAR, sayfaYukseklik - 22, { align: "right" });
  }

  doc.save(`flowtrain-kayit-defteri-${tarih}.pdf`);
}
