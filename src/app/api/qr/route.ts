import { NextResponse } from "next/server";
import { aktifHesap, yetkili } from "@/lib/kimlik";
import * as depo from "@/lib/depo";
import { kioskBaglantisi, qrSvg } from "@/lib/qr";

export const dynamic = "force-dynamic";

/** Metin sınırı: sürüm 10 / seviye M zaten 213 baytta biter, öncesinde keseriz. */
const EN_UZUN = 512;

/**
 * QR SVG UÇ NOKTASI — `/api/qr?egitim=<id>` ya da `/api/qr?metin=<serbest>`.
 *
 * Etiket sayfası QR'ı zaten sunucuda gömülü üretiyor; bu uç nokta ONUN İÇİN
 * değil: tek bir eğitimin karesini bir belgeye, sunuma ya da amir tabletine
 * koymak isteyen için var. Ayrı bir yüzey açmadan `<img src="/api/qr?...">`
 * yazmak yetsin diye.
 *
 * KAPI HAZIRLAYAN: kare basit bir görsel ama içeriği kurulumun iç ağ adresini
 * taşır. Kimliksiz açık bir uç nokta, dışarıdan bakan birine sunucunun nerede
 * durduğunu söylerdi.
 *
 * ÖNBELLEK YOK (`no-store`): eğitim silinip kimliği başkasına verilmez ama
 * `temelAdres` ayarı değişebilir; eski adresi taşıyan bir kare tarayıcıda
 * aylarca yaşarsa hattaki telefon boşluğa bakar.
 */
export function GET(istek: Request): NextResponse {
  const hesap = aktifHesap();
  if (!yetkili(hesap, "hazirlayan")) return NextResponse.json({ hata: "Yetki yok" }, { status: 403 });

  const p = new URL(istek.url).searchParams;
  const egitimId = (p.get("egitim") ?? "").trim();

  let metin: string;
  if (egitimId) {
    const egitim = depo.egitimGetir(egitimId);
    if (!egitim) return NextResponse.json({ hata: "Eğitim bulunamadı" }, { status: 404 });
    metin = kioskBaglantisi(egitim.id, depo.ayarOku("temelAdres"));
  } else {
    metin = (p.get("metin") ?? "").trim();
  }

  if (!metin) return NextResponse.json({ hata: "metin ya da egitim parametresi gerekli" }, { status: 400 });
  if (metin.length > EN_UZUN) return NextResponse.json({ hata: "Metin çok uzun" }, { status: 413 });

  const modul = sayi(p.get("modul"), 4, 1, 20);

  let svg: string;
  try {
    svg = qrSvg(metin, { modul });
  } catch (e) {
    // Kapasite aşımı: kullanıcı hatası, sunucu hatası değil.
    return NextResponse.json({ hata: e instanceof Error ? e.message : "QR üretilemedi" }, { status: 413 });
  }

  return new NextResponse(svg, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      /* SVG kendi kökenimizden servis edilen bir BELGEDİR — doğrudan açılınca
         komut dosyası çalıştırabilir. Çıktımızda kullanıcı metni hiç yer almasa
         da (metin yalnız matrise dönüşür, SVG'ye yazılmaz) kapıyı kapalı
         tutuyoruz. */
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'",
    },
  });
}

/** Modül seviyesinde, kapanış değil (bkz. `csv.ts` küçültücü notu). */
function sayi(ham: string | null, varsayilan: number, enAz: number, enCok: number): number {
  const n = Number(ham);
  if (!Number.isFinite(n)) return varsayilan;
  return Math.min(enCok, Math.max(enAz, Math.round(n)));
}
