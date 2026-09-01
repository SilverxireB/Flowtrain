import type { Metadata, Viewport } from "next";
import { Encode_Sans } from "next/font/google";
import "@/styles/globals.css";
import { TemaBetigi } from "@/components/Tema";

/**
 * ENCODE SANS — Flow ailesinin kurumsal yazı tipi (SIL Open Font License).
 *
 * Derleme sırasında indirilip pakete GÖMÜLÜR: çalışırken Google Fonts'a
 * istek gitmez, kapalı ağda yazı tipi eksik kalmaz. (FlowUI'da aynı dosyalar
 * `src/assets/fonts/EncodeSans/` altında elle taşınıyor; Next'in kendi font
 * ardışığı bu işi derlemede yapıyor, sonuç aynı: dış ağ yok.)
 *
 * `latin-ext` ŞART: Türkçe ğ/ş/İ o alt kümede, ı ise latin'de. Yalnız
 * `latin` alınsaydı "Yükseklik" ve "İş güvenliği" gibi başlıklar yedek
 * fontla karışık çizilirdi.
 */
const encodeSans = Encode_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FlowTrain",
  description: "Kapalı ağda çalışan eğitim dağıtım ve sınav aracı.",
  applicationName: "FlowTrain",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  appleWebApp: {
    capable: true,
    title: "FlowTrain",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  /* Tarayıcı çubuğunun rengi TEMAYLA döner. Tek renk verildiğinde koyu
     temada sayfa lacivert, çubuk hâlâ marka laciverti oluyordu — yakın
     ama aynı değil, ve telefonda o ince fark ekranın "bitmediği" hissini
     veriyordu. Değerler `flow-tokens.css` ile aynı: acik #f4f6fb, koyu #0a0a40. */
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f6fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a40" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    /* `suppressHydrationWarning`: `TemaBetigi` boyadan ÖNCE `<html>` üzerine
       `data-tema` yazıyor, yani sunucunun ürettiği işaretleme ile tarayıcının
       ilk hâli bilerek farklı. React bunu uyumsuzluk sanıp uyarır; uyarı
       doğru değil, kasıtlı olan tek fark bu öznitelik. */
    <html lang="tr" className={encodeSans.variable} suppressHydrationWarning>
      <head>
        <TemaBetigi />
      </head>
      <body>{children}</body>
    </html>
  );
}
