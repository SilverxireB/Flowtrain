import { redirect } from "next/navigation";
import Logo from "@/components/Logo";
import GirisFormu from "@/components/GirisFormu";
import { girisEylem } from "@/app/eylemler";
import { aktifHesap, guvenliYol, kurulumGerekli } from "@/lib/kimlik";

export const dynamic = "force-dynamic";

export default function Giris({ searchParams }: { searchParams: { next?: string } }) {
  if (kurulumGerekli()) redirect("/kurulum");
  const hedef = guvenliYol(searchParams.next, "/");
  if (aktifHesap()) redirect(hedef);

  return (
    <main className="bg-wash grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Logo size="lg" />
          <p className="mt-3 text-sm text-muted">Kokpit girişi</p>
        </div>

        <div className="card p-6">
          <GirisFormu
            eylem={girisEylem}
            etiket="Giriş yap"
            gizli={{ next: hedef }}
            alanlar={[
              { ad: "kullanici", etiket: "Kullanıcı adı" },
              { ad: "sifre", etiket: "Şifre", tip: "password" },
            ]}
          />
        </div>

        {/* Kiosk ve işçi akışı buradan GEÇMEZ — o yüzden yolu burada da
            hatırlatılır: kiosk cihazı açan kişi giriş ekranı arayıp kaybolmasın. */}
        <p className="mt-6 text-center text-sm text-muted">
          Eğitim tamamlamak için giriş gerekmez —{" "}
          <a href="/kiosk" className="font-semibold text-accent hover:underline">
            kiosk ekranı
          </a>
        </p>
      </div>
    </main>
  );
}
