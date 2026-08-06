import type { Config } from "tailwindcss";

/**
 * Flow Studio tasarım dili — FlowMeter ile BİREBİR aynı ölçek ve renkler.
 * Ürünler ayrı repolarda yaşasa da tek marka gibi görünmek zorunda; burada
 * "biraz farklı" bir gri seçmek suite'i ikiye böler.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "system-ui", "sans-serif"],
      },
      colors: {
        ink: "#18181b",
        paper: "#fafafa",
        line: "#ececeb",
        muted: "#78716c",
        brand: {
          DEFAULT: "#e11d48",
          dark: "#be123c",
          soft: "#ffe4e6",
        },
        accent: {
          DEFAULT: "#4f46e5",
          dark: "#4338ca",
          soft: "#e0e7ff",
        },
        // Skor/durum semantiği (Pulse ile aynı eşikler): iyi ≥70, orta ≥40.
        iyi: "#16a34a",
        orta: "#d97706",
        lacivert: "#001e64",
      },
      borderRadius: {
        blob: "1.25rem",
      },
    },
  },
  plugins: [],
};
export default config;
