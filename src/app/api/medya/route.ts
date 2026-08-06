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

export async function POST(istek: Request) {
  const hesap = aktifHesap();
  if (!yetkili(hesap, "hazirlayan")) return NextResponse.json({ hata: "Yetki yok" }, { status: 403 });

  const form = await istek.formData();
  const dosya = form.get("dosya");
  if (!(dosya instanceof File)) return NextResponse.json({ hata: "Dosya yok" }, { status: 400 });

  const uzanti = IZINLI[dosya.type];
  if (!uzanti) return NextResponse.json({ hata: `Desteklenmeyen tür: ${dosya.type}` }, { status: 415 });
  if (dosya.size > EN_BUYUK) return NextResponse.json({ hata: "Dosya çok büyük (en fazla 200 MB)" }, { status: 413 });

  // Kimliği BİZ üretiriz — kullanıcının verdiği ad diske hiç yazılmaz
  // (boşluk, Türkçe karakter ve `../` sorunlarının tamamı burada biter).
  const id = `${kimlik("mdy")}.${uzanti}`;
  await writeFile(join(VERI_KLASORU, "medya", id), Buffer.from(await dosya.arrayBuffer()));

  return NextResponse.json({ id, tur: dosya.type.startsWith("video") ? "video" : "gorsel" });
}
