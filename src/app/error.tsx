"use client";

import Link from "next/link";
import { useEffect } from "react";
import Logo from "@/components/Logo";
import Icon from "@/components/Icon";

/**
 * KOKPİT HATA SINIRI — tek dosya, dört sayfayı birden kurtarır.
 *
 * NEDEN VAR: personel kaynağı hata FIRLATIR (boş liste dönmek "fabrikada
 * kimse yok" demek olurdu) ve bu kaynağı `/atama`, `/kayitlar`, `/personel` ve
 * `/pano` yakalamadan çağırıyor. Bugün zararsız çünkü CSV adaptörü fırlatmıyor;
 * OPM adaptörü takıldığı gün yanlış yazılmış tek bir adres ya da düşmüş bir
 * webservice bu dört sayfayı birden Next'in stok hata ekranına çevirir:
 * İngilizce, markasız, "Application error… digest: 3891…".
 *
 * Kapalı ağda, yazılımcının olmadığı bir fabrikada o ekran hiçbir şey söylemez
 * ve ürünün GERİ KALANININ hâlâ çalıştığını da göstermez — kullanıcı sistemin
 * tamamen öldüğünü sanır.
 *
 * ÇÖZÜMÜN YERİNİ SÖYLER: bu hataların ezici çoğunluğu personel kaynağı
 * yapılandırmasından gelir ve düzeltmenin yapılacağı yer Ayarlar'dır
 * (`ayarlar/page.tsx` kendi içinde bu kaynağı zaten yakalıyor, yani oraya
 * gitmek güvenli — hata sayfası kullanıcıyı ikinci bir hataya yollamaz).
 *
 * KİOSK VE ZİYARETÇİ TABLETİ AYRI: onlar kendi hatalarını kendi yüzeylerinde
 * gösteriyor (`Kiosk.tsx`, `Tablet.tsx`) ve buraya düşmemeleri gerek — bu
 * sayfa kokpit dilinde yazılmış, eldivenli kullanıcıya göre değil.
 */
export default function KokpitHatasi({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    /* Sunucu günlüğüne düşmüş olabilir ama tarayıcı konsolunda da dursun:
       kapalı ağda destek çoğu zaman "ekrana bakan kişi" demek. */
    console.error("Kokpit hatası:", error);
  }, [error]);

  return (
    <main className="bg-wash grid min-h-screen place-items-center px-5 py-10">
      <div className="w-full max-w-xl text-center">
        <Logo size="lg" />

        <div className="card mt-8 p-8">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-orta/10 text-orta-dark">
            <Icon name="warning" size={32} />
          </span>

          <h1 className="mt-5 text-2xl font-extrabold">Bu sayfa açılamadı</h1>
          <p className="mt-2 text-muted">
            Kayıtlarınız yerinde — sorun bu ekranın verisini toplarken çıktı. En sık sebebi personel
            kaynağının okunamamasıdır (dosya taşınmış ya da bağlantı ayarı yanlış olabilir).
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <button onClick={reset} className="btn-primary">
              <Icon name="refresh" size={16} /> Yeniden dene
            </button>
            <Link href="/ayarlar" className="btn-ghost">
              <Icon name="settings" size={16} /> Ayarlar
            </Link>
            <Link href="/" className="btn-ghost">
              Ana sayfa
            </Link>
          </div>

          {/* Teknik ayrıntı GİZLENMİYOR ama öne de çıkmıyor: kullanıcıya bir
              şey ifade etmiyor, destek isteyen kişiye ise tek tutamak bu. */}
          {error.digest ? (
            <p className="mt-6 border-t border-line pt-4 font-mono text-xs text-muted">
              Hata kodu: {error.digest}
            </p>
          ) : null}
        </div>
      </div>
    </main>
  );
}
