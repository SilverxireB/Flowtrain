import { notFound } from "next/navigation";
import Editor from "./Editor";
import { kapi } from "@/lib/kimlik";
import * as depo from "@/lib/depo";
import { zorSorular } from "@/lib/sinav";

export const dynamic = "force-dynamic";

export default function EgitimEditoru({ params }: { params: { id: string } }) {
  const hesap = kapi("hazirlayan", `/egitimler/${params.id}`);
  const egitim = depo.egitimGetir(params.id);
  if (!egitim) notFound();

  const sorular = depo.sorulariGetir(params.id);

  return (
    <Editor
      egitim={egitim}
      sayfalar={depo.sayfalariGetir(params.id)}
      sorular={sorular}
      rol={hesap.rol}
      /* İÇERİK KALİTE SİNYALİ: çoğunluğun yanlış yaptığı soru, kötü İNSAN
         değil kötü SAYFA demektir. Hazırlayan bunu yüzüne görmezse düzeltmez. */
      zorSoruIdleri={zorSorular(depo.soruIstatistikleri(params.id)).map((z) => z.soruId)}
    />
  );
}
