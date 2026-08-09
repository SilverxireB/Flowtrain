import Link from "next/link";
import { redirect } from "next/navigation";
import Logo from "@/components/Logo";
import Icon, { type IconName } from "@/components/Icon";
import RehberAc from "@/components/rehber/RehberAc";
import { cikisEylem } from "@/app/eylemler";
import { aktifHesap, kurulumGerekli, yetkili } from "@/lib/kimlik";
import type { Rol } from "@/lib/depo";

export const dynamic = "force-dynamic";

/** `enAz: null` = giriş yeter (ziyaretçi masası her rolde açılır). */
const YUZEYLER: { yol: string; ad: string; not: string; ikon: IconName; enAz: Rol | null }[] = [
  { yol: "/egitimler", ad: "Eğitimler", not: "Hazırla, sınavını kur, yayınla", ikon: "book", enAz: "hazirlayan" },
  { yol: "/gruplar", ad: "Eğitim paketleri", not: "Birlikte verilen eğitimleri tek ada bağla", ikon: "folder", enAz: "hazirlayan" },
  { yol: "/atama", ad: "Atama kuralları", not: "Kim, ne zamana kadar", ikon: "target", enAz: "hazirlayan" },
  { yol: "/ekibim", ad: "Ekibim", not: "Eksikleri gör, yanında tamamlat", ikon: "users", enAz: "amir" },
  { yol: "/ziyaretci", ad: "Ziyaretçiler", not: "Kaydet, bilgilendir, içeri al", ikon: "userPlus", enAz: null },
  { yol: "/kayitlar", ad: "Kayıt defteri", not: "Tüm tamamlamalar, CSV/PDF, sertifika", ikon: "receipt", enAz: "hazirlayan" },
  { yol: "/pano", ad: "Pano", not: "Tamamlama, gecikenler, anomali", ikon: "chart", enAz: "hazirlayan" },
  { yol: "/personel", ad: "Personel", not: "Kayıtlar, maliyet merkezi eşlemesi, OPM aktarımı", ikon: "list", enAz: "yonetici" },
  { yol: "/ayarlar", ad: "Ayarlar", not: "Hesaplar, adaptörler, denetim izi", ikon: "settings", enAz: "yonetici" },
];

export default function Hub({ searchParams }: { searchParams: { yetki?: string } }) {
  if (kurulumGerekli()) redirect("/kurulum");
  const hesap = aktifHesap();
  if (!hesap) redirect("/giris");

  const acik = YUZEYLER.filter((y) => y.enAz === null || yetkili(hesap, y.enAz));

  return (
    <main className="bg-wash min-h-screen">
      <div className="sayfa-kap py-10 sm:py-14">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Logo size="lg" />
            <p className="mt-3 text-muted">
              Merhaba <strong className="text-ink">{hesap.ad}</strong> · {ROL_ADI[hesap.rol]}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <RehberAc />
            <form action={cikisEylem}>
              <button className="btn-ghost text-sm" type="submit">
                <Icon name="close" size={16} /> Çıkış
              </button>
            </form>
          </div>
        </div>

        {searchParams.yetki === "yok" ? (
          <p
            role="alert"
            className="mt-6 rounded-xl border border-brand/30 bg-brand-soft px-4 py-3 text-sm font-semibold text-brand-dark"
          >
            O sayfa için yetkiniz yok.
          </p>
        ) : null}

        {/* Geniş ekranda üç kolon: iki kolonda kartlar gereksiz uzuyor ve
            sağda kocaman boşluk kalıyordu. */}
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {acik.map((y) => (
            <Link key={y.yol} href={y.yol} className="card flex items-start gap-3 p-5 transition hover:border-accent">
              <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                <Icon name={y.ikon} size={20} />
              </span>
              <span className="min-w-0">
                <span className="block font-semibold">{y.ad}</span>
                <span className="mt-0.5 block text-sm text-muted">{y.not}</span>
              </span>
            </Link>
          ))}
        </div>

        {/* Kiosk hub'ın bir "sayfası" değil, AYRI bir yüzey: hesapsız açılır,
            tam ekran çalışır. Bu yüzden kartların arasında değil, altta ve
            farklı bir dille duruyor. */}
        <div className="card mt-8 flex flex-wrap items-center gap-4 p-5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-lacivert/10 text-lacivert">
            <Icon name="monitor" size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Kiosk ekranı</p>
            <p className="text-sm text-muted">
              Hattaki tablette açık kalır. İşçi sicilini okutur, eğitimini tamamlar — hesap gerekmez.
            </p>
          </div>
          <Link href="/kiosk" className="btn-ghost text-sm">
            Aç <Icon name="chevronRight" size={16} />
          </Link>
        </div>
      </div>
    </main>
  );
}

const ROL_ADI: Record<Rol, string> = {
  yonetici: "Yönetici",
  hazirlayan: "Hazırlayan",
  onaylayan: "Onaylayan",
  amir: "Amir",
};
