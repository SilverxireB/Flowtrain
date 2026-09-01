import Halka from "./Halka";
import { SkelBox } from "./Skeleton";

/**
 * KOKPİT SAYFASI YÜKLENİRKEN gösterilen iskelet.
 *
 * NEDEN VAR: kokpit sayfaları sunucuda çiziliyor ve `force-dynamic`. Yükleme
 * durumu tanımlı değilken tarayıcı, sunucu yanıtı gelene kadar ESKİ SAYFAYI
 * gösteriyordu — kullanıcı bağlantıya basıyor, ekranda hiçbir şey değişmiyor,
 * "tıklamam gitmedi" sanıp tekrar basıyor, sonra sayfa bir anda beliriyordu.
 * Bekleme süresini kısaltmak her zaman mümkün değil; ama beklendiğini
 * SÖYLEMEMEK bir kusurdur.
 *
 * Başlık şeridi de iskelette var: yalnız gövdeyi çizmek, üstteki şerit yerinde
 * dururken altının boşalmasına ve düzenin zıplamasına yol açıyordu.
 *
 * İSKELET + HALKA BİRLİKTE. Gri kutular sayfanın ŞEKLİNİ söylüyor ama nabzı
 * yok: hepsi aynı hızda soluyan bir yığın, ekranda takılı kalmışla çalışan
 * arasındaki farkı göstermiyor ve kullanıcı "yükleme göstergesi hiç çıkmıyor"
 * diye bildirdi. Halka şeridin sağ ucunda döner — şekil bilgisini bozmadan
 * "çalışıyor" der. Çizim `globals.css`teki tek kuraldan gelir, burada yalnız
 * ölçeklenir.
 */
export default function SayfaIskeleti({ satir = 6 }: { satir?: number }) {
  return (
    <main className="bg-wash min-h-screen">
      <div className="border-b border-line bg-yuzey/70">
        <div className="sayfa-kap flex items-center gap-3 py-3">
          <SkelBox className="h-9 w-9" />
          <SkelBox className="h-5 w-40" />
          <div className="flex-1" />
          <Halka boyut={20} />
        </div>
      </div>

      <div className="sayfa-govde" aria-busy="true" aria-live="polite">
        <span className="sr-only">Sayfa yükleniyor…</span>
        <div className="flex flex-wrap gap-3">
          <SkelBox className="h-11 min-w-0 flex-1" />
          <SkelBox className="h-11 w-40" />
        </div>
        <div className="card mt-4 divide-y divide-line p-0">
          {Array.from({ length: satir }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3.5">
              <SkelBox className="h-4 w-16 shrink-0" />
              <SkelBox className="h-4 min-w-0 flex-1" />
              <SkelBox className="h-4 w-24 shrink-0" />
              <SkelBox className="h-4 w-20 shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
