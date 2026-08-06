/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Kapalı ağda tek kutu olarak dağıtılır; harici görsel/CDN yoktur.
  images: { unoptimized: true },
}

export default nextConfig
