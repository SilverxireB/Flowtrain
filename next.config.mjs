/* ALT YOL — kurum uygulamayı kökte değil, var olan bir sitenin altında yayına
   alabilir (`https://intranet/flowtrain`). Değer TEK YERDEN gelir ve iki yere
   birden verilir:

     · `basePath`  → Next'in kendi işi (Link, router.push, _next statikleri)
     · `NEXT_PUBLIC_TEMEL_YOL` → kodda elle yazılan yollar (`src/lib/yol.ts`)

   İkisi ayrı ayrı yazılırsa er geç biri güncellenip öteki unutulur. Boş
   bırakılırsa uygulama kökte çalışır ve hiçbir şey değişmez.

   Kullanım: FLOWTRAIN_TEMEL_YOL=/flowtrain npm run build */
const TEMEL_YOL = (process.env.FLOWTRAIN_TEMEL_YOL ?? "").replace(/\/+$/, "")

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  ...(TEMEL_YOL ? { basePath: TEMEL_YOL } : {}),
  env: { NEXT_PUBLIC_TEMEL_YOL: TEMEL_YOL },
  // Kapalı ağda tek kutu olarak dağıtılır; harici görsel/CDN yoktur.
  images: { unoptimized: true },
  experimental: {
    /* better-sqlite3 YERLİ bir modüldür (.node ikilisi). Paketleyiciye
       girerse ikili dosya izlenemez ve sunucu "bindings bulunamadı" der;
       dışarıda bırakılınca olduğu gibi require edilir. */
    serverComponentsExternalPackages: ["better-sqlite3"],
    /* İZLEMELİ derleme (sunucuyu kaynak ağacından değil, izlenen dosyalardan
       paketleyen dağıtımlar) `data/` klasörünü kendiliğinden taşımaz: hiçbir
       import ona işaret etmiyor, yol çalışma anında kuruluyor. Klasör şu an
       repoda izlendiği (dummy veriyle çalışılıyor) ve vitrin dağıtımının
       tohumu o olduğu için derlemeye açıkça dahil edilir.
       `npm start` ile kaynaktan çalışan self-host'u etkilemez. */
    outputFileTracingIncludes: { "/**": ["./data/**"] },
  },
}

export default nextConfig
