import { NextResponse } from "next/server";
import { aktifHesap, yetkili } from "@/lib/kimlik";
import { csvYaz } from "@/lib/csv";
import * as depo from "@/lib/depo";
import { tumAtamalar } from "@/lib/atamaServis";
import { DURUM_ETIKET } from "@/lib/kurallar";
import { damgaMetni, kunyeliCsv, kurumAdiMetni } from "@/lib/rapor";
import { bugun } from "@/lib/db";

/**
 * DENETİM BELGESİ — tam liste.
 *
 * TERS KURAL (bilinçli): ekranlardaki süzgeç neyi gizlerse gizlesin, dışa
 * aktarma HER ZAMAN tam listeyi verir. Denetimde eksik belge, hiç belge
 * olmamasından kötüdür — "bunlar da vardı ama süzgeç kapatmıştı" savunması yok.
 *
 * Tam liste olması künyeyi GEREKSİZ KILMAZ, tersine: dosyanın üstünde
 * "süzgeç yok" yazması, listenin kırpılmadığının belgedeki tek kanıtıdır.
 */
export async function GET() {
  const hesap = aktifHesap();
  if (!yetkili(hesap, "hazirlayan")) return new NextResponse("Yetki yok", { status: 403 });

  const satirlar = await tumAtamalar();
  const govde = csvYaz(
    [
      { anahtar: "sicil", etiket: "Sicil" },
      { anahtar: "ad", etiket: "Ad" },
      { anahtar: "bolum", etiket: "Bölüm" },
      { anahtar: "hat", etiket: "Hat" },
      { anahtar: "gorev", etiket: "Görev" },
      { anahtar: "egitim", etiket: "Eğitim" },
      { anahtar: "durum", etiket: "Durum" },
      { anahtar: "sonTarih", etiket: "Son tarih" },
      { anahtar: "gecerlilik", etiket: "Geçerlilik bitişi" },
      { anahtar: "puan", etiket: "Son puan" },
      { anahtar: "tamamlama", etiket: "Tamamlama" },
      { anahtar: "gozeten", etiket: "Gözeten" },
    ],
    satirlar.map((s) => ({
      sicil: s.sicil,
      ad: s.kisi?.ad ?? "",
      bolum: s.kisi?.bolum ?? "",
      hat: s.kisi?.hat ?? "",
      gorev: s.kisi?.gorev ?? "",
      egitim: s.egitim.ad,
      durum: DURUM_ETIKET[s.durum],
      sonTarih: s.sonTarih ?? "",
      gecerlilik: s.gecerlilikBitis ?? "",
      puan: s.sonOturum?.puan ?? "",
      tamamlama: s.sonOturum?.bitis?.slice(0, 16).replace("T", " ") ?? "",
      gozeten: s.sonOturum?.gozeten ?? "",
    })),
  );

  const csv = kunyeliCsv(
    {
      kurum: kurumAdiMetni(depo.ayarOku("kurumAdi")),
      belge: "Eğitim durumu — tüm atamalar",
      uretim: damgaMetni(new Date()),
      kayitSayisi: satirlar.length,
      suzgec: "Süzgeç yok — tüm atamalar.",
    },
    govde,
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="flowtrain-egitim-durumu-${bugun()}.csv"`,
    },
  });
}
