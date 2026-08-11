import Yukleniyor from "@/components/Yukleniyor";

/**
 * KÖK YÜKLEME EKRANI.
 *
 * Next, kendi `loading.tsx`i olmayan her rota için EN YAKIN üstteki dosyayı
 * kullanır — dolayısıyla bu tek dosya hub'ı, girişi, kurulumu, kiosk'u ve
 * ziyaretçi yüzeylerini birden kapsıyor. Hepsi bugüne kadar geçiş sırasında
 * BOŞ ekran gösteriyordu; en çok görüleni de hub'dı ("ana sayfaya dön" her
 * seferinde bir an boşluk).
 *
 * İçerik listesi olan sayfalar kendi iskeletlerini KORUYOR: orada içeriğin
 * şeklini taklit eden gri satırlar, dönen bir halkadan daha çok bilgi verir.
 * Halka, şekli önceden bilinmeyen yüzeyler için.
 */
export default function Yukleme() {
  return (
    <main className="bg-wash min-h-screen">
      <Yukleniyor />
    </main>
  );
}
