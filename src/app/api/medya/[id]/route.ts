import { createReadStream, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { VERI_KLASORU } from "@/lib/db";

/**
 * Medya sunumu — dosyalar veri klasörünün içinde durur (Cloudinary YOK,
 * kapalı ağda dış depolama anlamsız).
 *
 * ARALIK (Range) DESTEĞİ ŞART: videoyu `<video>` etiketiyle oynatmak için
 * tarayıcı kısmi istek atar. Tam dosya döndürürsek video oynar ama İLERİ
 * SARILAMAZ ve bazı tarayıcılarda hiç başlamaz.
 */
export async function GET(istek: Request, { params }: { params: { id: string } }) {
  // Yol kaçışı: `../` içeren bir kimlik veri klasörünün dışına çıkarabilirdi.
  const id = params.id.replace(/[^a-zA-Z0-9._-]/g, "");
  if (!id) return new NextResponse("Geçersiz", { status: 400 });

  const yol = join(VERI_KLASORU, "medya", id);
  if (!existsSync(yol)) return new NextResponse("Bulunamadı", { status: 404 });

  const boyut = statSync(yol).size;
  const tip = mimeTuru(id);
  const aralik = istek.headers.get("range");

  if (aralik) {
    const eslesme = /bytes=(\d*)-(\d*)/.exec(aralik);
    const bas = eslesme?.[1] ? Number(eslesme[1]) : 0;
    const son = eslesme?.[2] ? Number(eslesme[2]) : boyut - 1;
    if (bas >= boyut) return new NextResponse("Aralık dışı", { status: 416 });

    const akis = Readable.toWeb(createReadStream(yol, { start: bas, end: son })) as ReadableStream;
    return new NextResponse(akis, {
      status: 206,
      headers: {
        "Content-Type": tip,
        "Content-Length": String(son - bas + 1),
        "Content-Range": `bytes ${bas}-${son}/${boyut}`,
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=3600",
      },
    });
  }

  const akis = Readable.toWeb(createReadStream(yol)) as ReadableStream;
  return new NextResponse(akis, {
    headers: {
      "Content-Type": tip,
      "Content-Length": String(boyut),
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=3600",
    },
  });
}

function mimeTuru(ad: string): string {
  const u = ad.split(".").pop()?.toLowerCase();
  const tablo: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
    mp4: "video/mp4",
    webm: "video/webm",
    pdf: "application/pdf",
  };
  return (u && tablo[u]) || "application/octet-stream";
}
