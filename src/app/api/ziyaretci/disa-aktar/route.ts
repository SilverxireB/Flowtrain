import { NextResponse } from "next/server";
import { aktifHesap } from "@/lib/kimlik";
import { csvYaz } from "@/lib/csv";
import * as depo from "@/lib/depo";
import * as zdepo from "@/lib/ziyaretciDepo";
import { ilerleme } from "@/lib/ziyaretci";
import { ZIYARETCI_BASLIKLARI, ziyaretciSatirlari, type CiktiKaydi } from "@/lib/ziyaretciCikti";
import { bugun } from "@/lib/db";

/**
 * ZİYARETÇİ DEFTERİ ÇIKTISI.
 *
 * `?gun=N` aralığı verir (0 = defterin tamamı). `?bicim=json` aynı satırları
 * PDF'i ÇİZEN istemciye döndürür — PDF tarayıcıda üretiliyor (yazı tipi
 * gömme, `panoPdf.ts` ile aynı desen) ve veriyi bir kez daha sunucudan
 * istemek, kayıt listesini sayfa yüküne gömmekten ucuz.
 *
 * ROL ARANMAZ, GİRİŞ ARANIR: ziyaretçi masası her girişli hesaba açık
 * (`/ziyaretci` sayfasında `kapiGirisli`) — kapıyı burada daraltmak, kaydı
 * girenin kendi çıktısını alamaması demek olurdu.
 *
 * SÜZGEÇ ÇIKTIYI KISALTMAZ: aralık dışında hiçbir eleme yapılmaz. Denetimde
 * eksik belge, hiç belge olmamasından kötüdür.
 */
export async function GET(istek: Request) {
  const hesap = aktifHesap();
  if (!hesap) return new NextResponse("Giriş gerekli", { status: 403 });

  const url = new URL(istek.url);
  const gun = Math.max(0, Math.floor(Number(url.searchParams.get("gun") ?? "0")) || 0);
  const jsonMu = url.searchParams.get("bicim") === "json";

  const kayitlar: CiktiKaydi[] = zdepo.ziyaretcileriAralikta(gun).map((z) => {
    const d = ilerleme(z.egitimIdleri, zdepo.bitenEgitimIdleri(z.id));
    return {
      ziyaretci: z,
      durum: d.durum,
      biten: d.biten,
      toplam: d.toplam,
      egitimAdlari: z.egitimIdleri.map((id) => depo.egitimGetir(id)?.ad ?? "(silinmiş)"),
    };
  });

  const satirlar = ziyaretciSatirlari(kayitlar);

  if (jsonMu) {
    return NextResponse.json({ basliklar: ZIYARETCI_BASLIKLARI, satirlar, tarih: bugun() });
  }

  return new NextResponse(csvYaz(ZIYARETCI_BASLIKLARI, satirlar), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="flowtrain-ziyaretci-${bugun()}.csv"`,
    },
  });
}
