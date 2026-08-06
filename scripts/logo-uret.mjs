/**
 * FlowTrain O-halkası logosunu üretir.
 *
 * Yöntem (Flow Studio'nun logo üretim deseni): kaynak O-halkası PNG'sindeki
 * ürün glifi TEK renktir (aydınlık sürümde lacivert #001e64, koyu sürümde
 * beyaz). O rengi saydama çevirince geriye YALNIZ dört renkli yay kalır —
 * halka birebir korunur, marka kayması olmaz. Sonra kendi glifimizi
 * (mezuniyet kepi) aynı kutuya bindiririz.
 *
 * Çalıştırma:  node scripts/logo-uret.mjs
 * (sharp geliştirme aracıdır, pakete girmez: npm install --no-save sharp)
 */
import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'

const KAYNAK = process.env.FLOWMETER_PUBLIC ?? '/home/user/FlowMeter/public'
const HEDEF = new URL('../public/', import.meta.url).pathname

/** Glifin rengi — bu renge YAKIN her piksel silinir. */
const LACIVERT = [0x00, 0x1e, 0x64]
const BEYAZ = [0xff, 0xff, 0xff]

/**
 * Verilen renge yakın pikselleri saydamlaştırır.
 * Yaklaşıklık payı şart: PNG kenar yumuşatması (antialias) sayesinde glifin
 * sınırında ara tonlar var; tam eşitlik arasak kenarda hayalet halka kalırdı.
 */
function glifiSil(data, info, renk, pay = 90) {
  const { width, height, channels } = info
  for (let i = 0; i < width * height; i++) {
    const p = i * channels
    const a = channels === 4 ? data[p + 3] : 255
    if (a < 8) continue
    const d =
      Math.abs(data[p] - renk[0]) + Math.abs(data[p + 1] - renk[1]) + Math.abs(data[p + 2] - renk[2])
    if (d < pay) data[p + 3] = 0
  }
  return data
}

/**
 * Mezuniyet kepi — FlowTrain'in glifi.
 * Meter bar-chart, Wall kamera, Sign totem, Pulse EKG; Train KEP.
 * Halkanın içine sığması için 24'lük ızgarada değil, doğrudan hedef kutuya
 * göre çizilir. Çizim disiplini ikon setiyle aynı: en çok 3 parça, kalın hat.
 */
function kepSvg(boyut, renk) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${boyut}" height="${boyut}" viewBox="0 0 100 100">
    <g fill="${renk}" stroke="${renk}" stroke-linecap="round" stroke-linejoin="round">
      <path d="M50 19 L95 40 L50 61 L5 40 Z" stroke-width="3"/>
      <path d="M27 47.5 L50 58.5 L73 47.5 L73 67 C73 74.5 62.5 79 50 79 C37.5 79 27 74.5 27 67 Z" stroke-width="3"/>
      <path d="M89 43.5 L89 68" stroke-width="6" fill="none"/>
      <circle cx="89" cy="74.5" r="6"/>
    </g>
  </svg>`)
}

async function uret(kaynakAd, hedefAd, silinecekRenk, glifRengi) {
  const kaynak = sharp(`${KAYNAK}/${kaynakAd}`).ensureAlpha()
  const { width, height } = await kaynak.metadata()

  const { data, info } = await kaynak.raw().toBuffer({ resolveWithObject: true })
  const halka = glifiSil(data, info, silinecekRenk)

  // Glif halkanın iç boşluğuna oturur: kutunun ~%46'sı, ortalanmış.
  const glifBoyut = Math.round(Math.min(width, height) * 0.47)
  const kep = await sharp(kepSvg(glifBoyut, glifRengi)).png().toBuffer()

  await sharp(halka, { raw: { width: info.width, height: info.height, channels: info.channels } })
    .composite([{ input: kep, gravity: 'centre' }])
    .png()
    .toFile(`${HEDEF}${hedefAd}`)

  console.log(`✓ ${hedefAd}  (${width}×${height})`)
}

/** PWA/favicon ikonları: kare tuval, halka ortalanmış. */
async function ikon(kaynakAd, hedefAd, boyut) {
  const kare = await sharp(`${HEDEF}${kaynakAd}`)
    .resize(Math.round(boyut * 0.84), Math.round(boyut * 0.84), {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .toBuffer()

  await sharp({
    create: { width: boyut, height: boyut, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
  })
    .composite([{ input: kare, gravity: 'centre' }])
    .png()
    .toFile(`${HEDEF}${hedefAd}`)

  console.log(`✓ ${hedefAd}  (${boyut}×${boyut})`)
}

await mkdir(HEDEF, { recursive: true })
await uret('logo-o-meter.png', 'logo-o-train.png', LACIVERT, '#001e64')
await uret('logo-o-meter-white.png', 'logo-o-train-white.png', BEYAZ, '#ffffff')
await ikon('logo-o-train.png', 'icon-192.png', 192)
await ikon('logo-o-train.png', 'icon-512.png', 512)
await ikon('logo-o-train.png', 'apple-touch-icon.png', 180)
