/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
