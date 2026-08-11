"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";
import Kart from "@/components/oyun/Kart";
import type { Sayfa } from "@/lib/tipler";

/**
 * CANLI ÖNİZLEME — yazarken kioskun gördüğü şey yanda durur.
 *
 * KİOSK KARTI İTHAL EDİLİR, KOPYALANMAZ (`components/oyun/Kart`). Buraya ikinci
 * bir çizim yazsaydık ikisi ilk üç ayda ayrışır ve hazırlayan gördüğünden
 * BAŞKASINI yayınlardı — ürünün en pahalı hatası bu olurdu. Dolayısıyla burada
 * görünmeyen bir şey kioskta da görünmüyordur; önizleme yalan söylemez.
 *
 * ÖLÇEK: kart kiosk genişliğinde (720 px, `max-w-3xl` eksi kenar boşluğu)
 * çizilir ve sütuna SIĞACAK KADAR küçültülür. Dar sütuna göre yeniden
 * yerleşmesi kolay olurdu ama o zaman satır sonları, punto oranları ve
 * görselin kapladığı yer kioskla tutmazdı: "üç satır sanmıştım, yedi çıktı".
 */

/** Kiosk içerik genişliği: `max-w-3xl` (768) eksi iki yandan `px-5` (2×20). */
const KIOSK_GENISLIK = 728;

/**
 * Önizlemenin ekranda kaplayabileceği en fazla yükseklik.
 *
 * Yeni tipler (kontrol listesi, karşılaştırma, vaka) uzun kart üretebiliyor:
 * ölçülen yükseklik olduğu gibi verilince yapışkan (`sticky`) yan sütun
 * pencereden taşıyor ve önizlemenin ALTI hiç görünmüyordu — üstelik sayfa
 * kaydırıldıkça da gelmiyor, çünkü sütun yapışkan. Sınırı aşan kart kendi
 * içinde kaydırılır: kartın tamamı erişilebilir kalır, editör yerinde durur.
 */
const EN_FAZLA_YUKSEKLIK = "min(70vh, 40rem)";

/**
 * KİOSK KART ALANININ EN AZ YÜKSEKLİĞİ (kiosk pikseli).
 *
 * Önizleme içeriğe göre büzülüyordu: iki satırlık bir kart ince bir şerit gibi
 * çıkıyor, hazırlayan da "kiosk görünümü kısa kalıyor" diyordu — haklı olarak,
 * çünkü SAHADA o kart ekranı kaplıyor. Önizlemenin işi kartın metnini
 * göstermek değil, kartın EKRANDA NASIL DURACAĞINI göstermek; kısa bir kartın
 * altında kalan boşluk da o bilginin parçası ("bu kart çok boş görünecek").
 *
 * Değer kiosk ölçüsünde yazılır ve sütuna sığacak orana birlikte küçülür, yani
 * önizleme hep aynı ekran oranını taşır. Bunu aşan kart yine kendi içinde
 * kaydırılır (`EN_FAZLA_YUKSEKLIK`).
 */
const KIOSK_EN_AZ_YUKSEKLIK = 520;

export default function CanliOnizleme({
  sayfa,
  sira,
  toplam,
  altMetinler,
}: {
  sayfa: Sayfa | null;
  sira: number;
  toplam: number;
  /**
   * Görsel kimliği → yazılmış alt metin. Kart bileşenine olduğu gibi geçilir:
   * önizleme kioskun gördüğünü göstermeli, alt metin de kioskta okunan şey.
   */
  altMetinler?: Record<string, string>;
}) {
  const dis = useRef<HTMLDivElement>(null);
  const ic = useRef<HTMLDivElement>(null);
  const [olcek, setOlcek] = useState(1);
  const [yukseklik, setYukseklik] = useState(0);

  /* Ölçek ve yükseklik ÖLÇÜLEREK bulunur: sütun genişliği kırılma noktasına,
     kartın boyu ise yazılan metne göre değişiyor. Sabit bir ölçek katsayısı
     uzun kartta boşluk, kısa kartta taşma bırakıyordu. */
  useEffect(() => {
    const d = dis.current;
    const i = ic.current;
    if (!d || !i) return;

    const gozlemci = new ResizeObserver(() => {
      const o = Math.min(1, d.clientWidth / KIOSK_GENISLIK);
      setOlcek(o);
      setYukseklik(Math.max(i.scrollHeight, KIOSK_EN_AZ_YUKSEKLIK) * o);
    });
    gozlemci.observe(d);
    gozlemci.observe(i);
    return () => gozlemci.disconnect();
  }, []);

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-line bg-paper px-4 py-2.5">
        <Icon name="monitor" size={15} className="text-muted" />
        <span className="eyebrow">Kiosk görünümü</span>
        <div className="flex-1" />
        {sayfa ? (
          <span className="text-xs font-semibold text-muted">
            Sayfa {sira}/{toplam}
          </span>
        ) : null}
      </div>

      {sayfa ? (
        <div className="p-4">
          {/* Üç kap, üçü de gerekli:
              `dis`   — sütun GENİŞLİĞİNİ ölçer, kendisi kaydırılmaz. Ölçümü
                        kaydırılan kaba bağlasaydık, beliren dikey kaydırma
                        çubuğu genişliği daraltır, daralan genişlik ölçeği
                        küçültür, küçülen kart çubuğu kaldırırdı — sonsuz
                        ResizeObserver döngüsü.
              ortadaki — yüksekliği sınırlar ve gerekirse kaydırır.
              `ic`    — kiosk genişliğinde çizilir ve sütuna sığacak kadar
                        küçültülür. */}
          <div ref={dis} className="overflow-hidden">
            <div
              className="overflow-y-auto overflow-x-hidden"
              style={{ height: yukseklik || undefined, maxHeight: EN_FAZLA_YUKSEKLIK }}
            >
              <div
                ref={ic}
                style={{ width: KIOSK_GENISLIK, transform: `scale(${olcek})`, transformOrigin: "top left" }}
              >
                {/* `key` TİPİ DE İÇERİR: tip artık değiştirilebilir ve kimlik
                    aynı kaldığı için kart yeniden bağlanmıyordu — videodan
                    başka bir tipe geçince `<video>` öğesi ağaçta kalıp arka
                    planda çalmaya devam ediyordu. */}
                <Kart sayfa={sayfa} altMetinler={altMetinler} key={`${sayfa.id}:${sayfa.tip}`} />
              </div>
            </div>
          </div>

          {/* Kioskun alt şeridi: "İleri" düğmesi asgari süre dolmadan açılmaz.
              Önizlemede pasif çizilir — hazırlayan işçinin kaç saniye bekleyeceğini
              yazarken görsün diye. */}
          <div className="mt-4 border-t border-line pt-3">
            <p className="flex items-center justify-center gap-2 rounded-xl bg-line/50 py-2.5 text-sm font-bold text-muted">
              {sayfa.asgariSure > 0 ? (
                <>
                  <Icon name="hourglass" size={15} /> {sayfa.asgariSure} sn bekletir, sonra İleri
                </>
              ) : sayfa.tip === "video" ? (
                <>
                  <Icon name="play" size={15} /> Video bitmeden İleri açılmaz
                </>
              ) : (
                <>
                  İleri <Icon name="chevronRight" size={15} />
                </>
              )}
            </p>
          </div>
        </div>
      ) : (
        <p className="px-4 py-10 text-center text-sm text-muted">
          Kart eklediğinizde kioskta nasıl görüneceği burada belirir.
        </p>
      )}
    </div>
  );
}
