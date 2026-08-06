import { redirect } from "next/navigation";
import Logo from "@/components/Logo";
import GirisFormu from "@/components/GirisFormu";
import { kurulumEylem } from "@/app/eylemler";
import { kurulumGerekli } from "@/lib/kimlik";
import { VERI_KLASORU } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * İLK KURULUM — yalnız hiç hesap yokken açılır.
 * Kurulum belgesinde "şu adrese git, ilk yöneticiyi aç" tek adımdır; ürünle
 * birlikte gönderilen varsayılan şifre YOKTUR (kimse değiştirmez, herkes bilir).
 */
export default function Kurulum() {
  if (!kurulumGerekli()) redirect("/giris");

  return (
    <main className="bg-wash grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Logo size="lg" />
          <p className="mt-3 text-sm text-muted">Kurulum — ilk yönetici hesabı</p>
        </div>

        <div className="card p-6">
          <GirisFormu
            eylem={kurulumEylem}
            etiket="Hesabı oluştur ve başla"
            alanlar={[
              { ad: "ad", etiket: "Adınız", zorunlu: false },
              { ad: "kullanici", etiket: "Kullanıcı adı" },
              { ad: "sifre", etiket: "Şifre", tip: "password", not: "En az 6 karakter." },
            ]}
          />
        </div>

        <div className="card mt-4 p-4 text-sm">
          <p className="font-semibold">Veri klasörü</p>
          <p className="mt-1 break-all font-mono text-xs text-muted">{VERI_KLASORU}</p>
          <p className="mt-2 text-muted">
            Tüm veritabanı, yüklenen medya ve kayıt dosyaları burada durur.{" "}
            <strong className="text-ink">Yedek almak = bu klasörü kopyalamak.</strong>
          </p>
        </div>
      </div>
    </main>
  );
}
