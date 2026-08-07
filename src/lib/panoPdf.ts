import { jsPDF } from "jspdf";

/**
 * Pano PDF'i — denetim toplantısına götürülecek özet sayfa.
 *
 * CSV denetim BELGESİdir (tam liste, Excel'de süzülür); PDF ise okunacak
 * ÖZETtir. İkisi aynı şey değil, o yüzden ikisi de var.
 *
 * TÜRKÇE YAZI TİPİ GÖMÜLÜR: jsPDF'in yerleşik Helvetica'sı Latin-1'dir,
 * `ş ğ İ ı` karakterlerini basmaz — gömmezsek rapor "Yüksekte Çalıma" der ve
 * kimse hatayı bize değil kendi bilgisayarına yorar. Yazı tipi kendi
 * sunucumuzdan gelir (`public/fonts`), dış ağ istemez.
 */
const FONT = "Jakarta";

async function yaziTipiGom(doc: jsPDF): Promise<boolean> {
  try {
    const yukle = async (yol: string) => {
      const c = await fetch(yol);
      if (!c.ok) throw new Error(String(c.status));
      const b = new Uint8Array(await c.arrayBuffer());
      let s = "";
      for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
      return btoa(s);
    };
    const [duz, kalin] = await Promise.all([
      yukle("/fonts/PlusJakartaSans-Regular.ttf"),
      yukle("/fonts/PlusJakartaSans-Bold.ttf"),
    ]);
    doc.addFileToVFS("PlusJakartaSans-Regular.ttf", duz);
    doc.addFont("PlusJakartaSans-Regular.ttf", FONT, "normal");
    doc.addFileToVFS("PlusJakartaSans-Bold.ttf", kalin);
    doc.addFont("PlusJakartaSans-Bold.ttf", FONT, "bold");
    return true;
  } catch {
    return false;
  }
}

export interface PanoOzeti {
  toplam: number;
  tamam: number;
  oran: number;
  durumlar: { etiket: string; sayi: number }[];
  bolumler: { ad: string; toplam: number; acik: number }[];
  gecikenler: { ad: string; sicil: string; egitim: string; sonTarih: string }[];
}

export async function panoPdfIndir(ozet: PanoOzeti, tarih: string): Promise<void> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const gomuldu = await yaziTipiGom(doc);
  const ft = (kalin = false) => doc.setFont(gomuldu ? FONT : "helvetica", kalin ? "bold" : "normal");

  const KENAR = 48;
  const GENIS = doc.internal.pageSize.getWidth() - KENAR * 2;
  let y = KENAR;

  const sayfaKontrol = (gerekli = 18) => {
    if (y + gerekli < doc.internal.pageSize.getHeight() - KENAR) return;
    doc.addPage();
    y = KENAR;
  };

  ft(true);
  doc.setFontSize(20);
  doc.setTextColor(0, 30, 100);
  doc.text("Eğitim durumu", KENAR, y);
  y += 20;

  ft();
  doc.setFontSize(10);
  doc.setTextColor(120, 113, 108);
  doc.text(`FlowTrain · ${tarih}`, KENAR, y);
  y += 28;

  // ── özet ──
  ft(true);
  doc.setFontSize(34);
  doc.setTextColor(24, 24, 27);
  doc.text(`%${ozet.oran}`, KENAR, y + 8);
  ft();
  doc.setFontSize(11);
  doc.setTextColor(120, 113, 108);
  doc.text(`${ozet.tamam} / ${ozet.toplam} atama tamam`, KENAR + 90, y + 4);
  y += 30;

  doc.setFontSize(10);
  doc.text(ozet.durumlar.map((d) => `${d.etiket}: ${d.sayi}`).join("   ·   "), KENAR, y);
  y += 26;

  // ── bölümler ──
  const baslikYaz = (metin: string) => {
    sayfaKontrol(30);
    ft(true);
    doc.setFontSize(12);
    doc.setTextColor(24, 24, 27);
    doc.text(metin, KENAR, y);
    y += 6;
    doc.setDrawColor(236, 236, 235);
    doc.line(KENAR, y, KENAR + GENIS, y);
    y += 14;
    ft();
    doc.setFontSize(10);
  };

  baslikYaz("Bölümler");
  for (const b of ozet.bolumler) {
    sayfaKontrol();
    doc.setTextColor(24, 24, 27);
    doc.text(b.ad.slice(0, 44), KENAR, y);
    doc.setTextColor(120, 113, 108);
    doc.text(b.acik > 0 ? `${b.acik} eksik / ${b.toplam}` : `tamam (${b.toplam})`, KENAR + GENIS, y, {
      align: "right",
    });
    y += 15;
  }
  y += 12;

  // ── gecikenler ──
  baslikYaz(`Geciken ve eksikler (${ozet.gecikenler.length})`);
  if (ozet.gecikenler.length === 0) {
    doc.setTextColor(120, 113, 108);
    doc.text("Geciken kayıt yok.", KENAR, y);
    y += 15;
  }
  for (const g of ozet.gecikenler) {
    sayfaKontrol();
    doc.setTextColor(24, 24, 27);
    doc.text(`${g.ad} (${g.sicil})`, KENAR, y);
    doc.setTextColor(120, 113, 108);
    doc.text(g.egitim.slice(0, 34), KENAR + 190, y);
    doc.text(g.sonTarih || "—", KENAR + GENIS, y, { align: "right" });
    y += 15;
  }

  // Sayfa altı notu: bu belgenin ne OLMADIĞINI söylemek, yanlış kullanımı önler.
  const sayfaSayisi = doc.getNumberOfPages();
  for (let i = 1; i <= sayfaSayisi; i++) {
    doc.setPage(i);
    ft();
    doc.setFontSize(8);
    doc.setTextColor(160, 155, 150);
    doc.text(
      `Özet rapor — tam kayıt listesi için CSV çıktısını kullanın.   ${i}/${sayfaSayisi}`,
      KENAR,
      doc.internal.pageSize.getHeight() - 26,
    );
  }

  doc.save(`flowtrain-egitim-durumu-${tarih}.pdf`);
}
