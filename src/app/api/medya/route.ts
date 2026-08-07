import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { kimlik, VERI_KLASORU } from "@/lib/db";
import { aktifHesap, yetkili } from "@/lib/kimlik";

/** Kabul edilen türler — kapalı ağda çalıştığımız için liste dar tutulur. */
const IZINLI: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/webm": "webm",
};

const EN_BUYUK = 200 * 1024 * 1024; // 200 MB — hat videosu için bolca yeter

/**
 * Dosyanın gerçekten iddia ettiği tür olup olmadığı — İLK BAYTLAR.
 * `dosya.type` istemcinin BEYANIDIR; tek başına güvenilirse istenen her bayt
 * `image/png` diye yüklenip uygulamanın kendi kökeninden sunulabilir.
 */
function turTutuyorMu(bas: Buffer, tur: string): boolean {
  const png = bas[0] === 0x89 && bas[1] === 0x50 && bas[2] === 0x4e && bas[3] === 0x47;
  const jpg = bas[0] === 0xff && bas[1] === 0xd8 && bas[2] === 0xff;
  const webp = bas.subarray(0, 4).toString("ascii") === "RIFF" && bas.subarray(8, 12).toString("ascii") === "WEBP";
  const mp4 = bas.subarray(4, 8).toString("ascii") === "ftyp";
  const webm = bas[0] === 0x1a && bas[1] === 0x45 && bas[2] === 0xdf && bas[3] === 0xa3;
  switch (tur) {
    case "image/png":
      return png;
    case "image/jpeg":
      return jpg;
    case "image/webp":
      return webp;
    case "video/mp4":
      return mp4;
    case "video/webm":
      return webm;
    default:
      return false;
  }
}

export async function POST(istek: Request) {
  const hesap = aktifHesap();
  if (!yetkili(hesap, "hazirlayan")) return NextResponse.json({ hata: "Yetki yok" }, { status: 403 });

  /* Boyut kontrolü GÖVDE OKUNMADAN ÖNCE: `formData()`den sonra bakmak, 2 GB'lık
     bir gövdenin önce tamamen belleğe alınması demekti — tek kutulu kurulumda
     sınır devreye girmeden makine şişiyordu. */
  const bildirilen = Number(istek.headers.get("content-length") ?? 0);
  if (bildirilen > EN_BUYUK) return NextResponse.json({ hata: "Dosya çok büyük (en fazla 200 MB)" }, { status: 413 });

  const form = await istek.formData();
  const dosya = form.get("dosya");
  if (!(dosya instanceof File)) return NextResponse.json({ hata: "Dosya yok" }, { status: 400 });

  const uzanti = IZINLI[dosya.type];
  if (!uzanti) return NextResponse.json({ hata: `Desteklenmeyen tür: ${dosya.type}` }, { status: 415 });
  if (dosya.size > EN_BUYUK) return NextResponse.json({ hata: "Dosya çok büyük (en fazla 200 MB)" }, { status: 413 });

  const icerik = Buffer.from(await dosya.arrayBuffer());
  if (!turTutuyorMu(icerik.subarray(0, 16), dosya.type)) {
    return NextResponse.json({ hata: "Dosya içeriği belirtilen türle uyuşmuyor." }, { status: 415 });
  }

  // Kimliği BİZ üretiriz — kullanıcının verdiği ad diske hiç yazılmaz
  // (boşluk, Türkçe karakter ve `../` sorunlarının tamamı burada biter).
  const id = `${kimlik("mdy")}.${uzanti}`;
  await writeFile(join(VERI_KLASORU, "medya", id), icerik);

  return NextResponse.json({ id, tur: dosya.type.startsWith("video") ? "video" : "gorsel" });
}
