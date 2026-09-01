import type { Config } from "tailwindcss";

/**
 * FLOW TASARIM DİLİ — renkler TOKEN KATMANINDAN gelir.
 *
 * Buradaki hiçbir renk artık hex değil: hepsi `src/styles/flow-tokens.css`
 * içindeki `--flow-*` değişkenlerine bakıyor ve tema (`:root[data-tema]`)
 * değiştiğinde kendiliğinden döner. Kazanç şu: on dokuz yüzeyde tek bir
 * sınıfa dokunmadan koyu tema geldi — `text-muted` yazan yer açık temada
 * #5c6689, koyu temada #7d89c4 çiziyor.
 *
 * SEMANTİK ADLAR KORUNDU (`ink`, `paper`, `line`, `muted`, `accent`,
 * `brand`, `iyi`, `orta`). Adları FlowUI'ınkilerle değiştirmek 700'den
 * fazla sınıf kullanımını dokunmaya zorlardı ve hiçbir şey kazandırmazdı;
 * anlam aynı, arkasındaki değer artık tema farkında.
 *
 * `color-mix` + `<alpha-value>` NEDEN: kaynakta 177 yerde opaklık
 * değiştiricisi var (`border-brand/30`, `bg-orta/5`, `text-ink/90`…).
 * Renk düz `var(--x)` olarak verilseydi Tailwind bu eğik çizgiyi
 * uygulayamaz, o 177 yerin hepsi sessizce tam opak çizerdi. `<alpha-value>`
 * değiştirici verilmediğinde 1'e çözülür, yani normal kullanım da doğru.
 */
const jeton = (ad: string) => `color-mix(in srgb, var(${ad}) calc(<alpha-value> * 100%), transparent)`;

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "system-ui", "sans-serif"],
      },
      colors: {
        /* Zemin ve metin */
        ink: jeton("--flow-text"),
        "ink-2": jeton("--flow-text-2"),
        /* Gövde metni — başlıktan bir kademe sakin. FlowUI'da ölçüldü. */
        govde: jeton("--flow-govde"),
        paper: jeton("--flow-bg"),
        line: jeton("--flow-border"),
        muted: jeton("--flow-text-muted"),
        /* Kart/panel yüzeyi. `bg-white` yerine BU kullanılır: beyaz koyu
           temada beyaz kalır ve kartlar ekranda parlayan levhalar olur. */
        yuzey: jeton("--flow-surface"),
        yuzey2: jeton("--flow-surface-2"),
        vurgu: jeton("--flow-hover"),

        /* Marka — açık temada Arçelik kırmızısı, koyu temada Beko mavisi.
           Birincil aksiyonun rengi budur (`.btn-primary`). */
        accent: {
          DEFAULT: jeton("--flow-primary"),
          dark: jeton("--flow-primary-strong"),
          soft: jeton("--flow-primary-soft"),
          contrast: jeton("--flow-primary-contrast"),
        },

        /* Uyarı/tehlike. FlowTrain kuralı: gül YALNIZ uyarı için (CLAUDE.md).
           Token karşılığı `danger`; dolgu ile metin AYRI değerler, açık
           temada tek değer eşiği geçmiyordu. */
        brand: {
          DEFAULT: jeton("--flow-danger"),
          dark: jeton("--flow-danger-text"),
          soft: jeton("--flow-danger-soft"),
        },

        /* Skor/durum semantiği (Pulse ile aynı eşikler: iyi ≥70, orta ≥40).
           `DEFAULT` dolgular ve çubuklar için, `dark` METİN için — açık
           temada dolgu değeri metin olarak 4.5 eşiğini geçmiyor. */
        iyi: { DEFAULT: jeton("--flow-success"), dark: jeton("--flow-success-text") },
        orta: { DEFAULT: jeton("--flow-warning"), dark: jeton("--flow-warning-text") },
        bilgi: { DEFAULT: jeton("--flow-info"), dark: jeton("--flow-info-text") },

        /* Marka laciverti — TEMA ÜSTÜ, dönmez. Logo ve tarayıcı tema rengi
           bunu kullanıyor; markanın kimliği temaya göre değişmez. */
        lacivert: "#001e64",
      },

      /* METİN OLARAK MARKA RENGİ, DOLGU OLARAK MARKA RENGİNDEN AYRIDIR.
         `bg-accent` üstüne beyaz yazılır ve orada iş görür; aynı değeri
         lacivert zemine METİN yazınca 3.7:1'e düşüyor — AA eşiğinin altı.
         Bu ayrımın örneği zaten yukarıda var (`iyi/orta/bilgi`: dolgu için
         `DEFAULT`, metin için `dark`); burada aynı kural markaya uygulanıyor.

         `textColor` ayrı bildirilince ÇAĞRI YERİ DEĞİŞMİYOR: `text-accent`
         yazan otuz küsur yer olduğu gibi kalıyor, yalnız çözdüğü token
         `--flow-link` oluyor. `bg-accent` / `border-accent` etkilenmez. */
      textColor: {
        accent: {
          DEFAULT: jeton("--flow-link"),
          dark: jeton("--flow-primary-strong"),
          soft: jeton("--flow-primary-soft"),
          contrast: jeton("--flow-primary-contrast"),
        },
      },

      borderRadius: {
        blob: "1.25rem",
        /* FlowUI biçim token'ları — kart 12px, küçük eleman 8px. */
        flow: "var(--flow-radius)",
        "flow-sm": "var(--flow-radius-sm)",
      },
      boxShadow: {
        flow: "var(--flow-shadow)",
      },
    },
  },
  plugins: [],
};
export default config;
