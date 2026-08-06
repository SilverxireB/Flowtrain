import Link from 'next/link'

const YUZEYLER = [
  { yol: '/egitimler', ad: 'Eğitimler', not: 'Hazırla, sınavını kur, yayınla' },
  { yol: '/atama', ad: 'Atama kuralları', not: 'Kim, ne zamana kadar' },
  { yol: '/ekibim', ad: 'Ekibim', not: 'Amir tableti — eksikleri tamamlat' },
  { yol: '/kiosk', ad: 'Kiosk', not: 'Kart okut, eğitimini tamamla' },
  { yol: '/pano', ad: 'Pano', not: 'Tamamlama, gecikenler, süresi dolanlar' },
  { yol: '/ayarlar', ad: 'Ayarlar', not: 'Personel kaynağı, kayıt hedefi, yedek' },
]

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <p className="text-sm font-semibold uppercase tracking-wider text-accent">Flow Studio</p>
      <h1 className="mt-2 text-4xl font-extrabold tracking-tight">FlowTrain</h1>
      <p className="mt-3 max-w-xl text-muted">
        Kapalı ağda çalışan eğitim dağıtım ve sınav aracı. İşçinin hesabı, şifresi veya
        e-postası olmasına gerek yoktur.
      </p>

      <div className="mt-10 grid gap-3 sm:grid-cols-2">
        {YUZEYLER.map((y) => (
          <Link key={y.yol} href={y.yol} className="card transition hover:border-accent">
            <div className="font-semibold">{y.ad}</div>
            <div className="mt-1 text-sm text-muted">{y.not}</div>
          </Link>
        ))}
      </div>

      <p className="mt-10 text-sm text-muted">
        İskelet aşaması — yüzeyler sırayla açılıyor. Kapsam:{' '}
        <span className="font-mono text-xs">docs/KAPSAM.md</span>
      </p>
    </main>
  )
}
