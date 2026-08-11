import { existsSync } from "node:fs";
import { join } from "node:path";
import { notFound } from "next/navigation";
import Editor from "./Editor";
import { bolumAnahtari, bolumleriCoz } from "@/lib/bolumler";
import { VERI_KLASORU } from "@/lib/db";
import { kartGorselleri, type MedyaOzet } from "@/lib/editorMedya";
import { kapi } from "@/lib/kimlik";
import * as depo from "@/lib/depo";
import { kolaySorular, zorSorular } from "@/lib/sinav";

export const dynamic = "force-dynamic";

export default function EgitimEditoru({ params }: { params: { id: string } }) {
  const hesap = kapi("hazirlayan", `/egitimler/${params.id}`);
  const egitim = depo.egitimGetir(params.id);
  if (!egitim) notFound();

  const sayfalar = depo.sayfalariGetir(params.id);
  const sorular = depo.sorulariGetir(params.id);
  const istatistik = depo.soruIstatistikleri(params.id);

  /* Kütüphane satırları kullanım sayısıyla gelir: "sil" düğmesine basmadan
     ÖNCE "bu görsel 3 kartta kullanılıyor" denebilsin diye. Silme anında
     sorulsaydı cevabı beklemek için ayrı bir gidiş dönüş gerekirdi.

     TEK SORGU, N+1 DEĞİL: burada eskiden her medya için ayrı
     `medyaKullanimi(id)` çağrılıyordu. Ölçüldü — 300 görselli bir kütüphanede
     editörün her açılışına 30 ms, 2000 görselde 199 ms ekliyordu; tek sorguluk
     karşılığı aynı işi 1 ms ve 5 ms'te bitiriyor. */
  const kullanimlar = depo.medyaKullanimlariGetir();
  const medyalar: MedyaOzet[] = depo.medyalariGetir().map((m) => ({ ...m, kullanim: kullanimlar[m.id] ?? 0 }));

  /* Öksüz medya = hiçbir kartta/soruda geçmeyen kayıt. Sayı aynı haritadan
     çıkıyor; `depo.oksuzMedyalar()` ikinci bir tarama demekti. Temizlik
     eyleminin kendisi listeyi YENİDEN hesaplar — ekrandaki sayı eskiyebilir. */
  const oksuzSayisi = medyalar.filter((m) => m.kullanim === 0).length;

  /* KIRIK MEDYA yalnız sunucuda görülebilir: tarayıcı bir görselin diskte
     olmadığını ancak istek atıp 404 alınca anlar, o da yayına hazırlık
     listesini ağa bağımlı yapardı. */
  const kirikGorselIdler: string[] = [];
  for (const id of medyaKimlikleri(sayfalar, sorular)) {
    if (!existsSync(join(VERI_KLASORU, "medya", id.replace(/[^a-zA-Z0-9._-]/g, "")))) kirikGorselIdler.push(id);
  }

  /* YAYIN DURUMU — editördeki rozetin ve "yayındaki hâline dön" düğmesinin
     tek kaynağı. Karşılaştırma SUNUCUDA yapılıyor (`depo.yayinlanmamisDegisiklik`
     → `surum.ts`): istemcide yeniden hesaplansaydı iki taraf zamanla ayrışır
     ve rozet ya hiç sönmez ya hiç yanmazdı. */
  const sonYayin = depo.sonYayinGetir(params.id);
  const yayinDurumu = sonYayin
    ? {
        surum: sonYayin.surum,
        zaman: sonYayin.yayinZamani,
        degisiklikVar: depo.yayinlanmamisDegisiklik(params.id),
      }
    : null;

  return (
    <Editor
      egitim={egitim}
      sayfalar={sayfalar}
      sorular={sorular}
      rol={hesap.rol}
      yayinDurumu={yayinDurumu}
      /* İÇERİK KALİTE SİNYALİ: çoğunluğun yanlış yaptığı soru, kötü İNSAN
         değil kötü SAYFA demektir. Hazırlayan bunu yüzüne görmezse düzeltmez. */
      zorSoruIdleri={zorSorular(istatistik).map((z) => z.soruId)}
      /* Simetrik sinyal: kimsenin yanlış yapmadığı soru da ölçmüyor. */
      kolaySoruIdleri={kolaySorular(istatistik)}
      istatistik={istatistik}
      medyalar={medyalar}
      kategoriler={depo.kategorileriGetir()}
      /* Hedef listesi artık YAYINDAKİLERİ de içeriyor: kart hedefin TASLAĞINA
         kopyalanır, sahadaki sürüm kımıldamaz (yayın kilidinin kalkmasıyla
         aynı gerekçe). Eskiden yayındaki eğitimler listeden düşüyordu ve
         kullanıcı kartını taşıyacak yeri bulamıyordu. */
      hedefEgitimler={depo
        .egitimleriListele()
        .filter((e) => e.id !== params.id)
        .map((e) => ({ id: e.id, ad: e.ad }))}
      kirikGorselIdler={kirikGorselIdler}
      oksuzSayisi={oksuzSayisi}
      /* BÖLÜM BAŞLIKLARI şema dışında, `ayar` tablosunda duruyor (gerekçe
         `bolumler.ts`). Silinmiş kartların öksüz kalan başlıkları burada
         eleniyor — kiosk bu satırı hiç okumaz, işçiye fazladan kart çıkmaz. */
      bolumler={bolumleriCoz(
        depo.ayarOku(bolumAnahtari(params.id)),
        sayfalar.map((s) => s.id),
      )}
    />
  );
}

/** Bu eğitimin kartlarında ve sorularında geçen tüm medya kimlikleri (tekil). */
function medyaKimlikleri(
  sayfalar: ReturnType<typeof depo.sayfalariGetir>,
  sorular: ReturnType<typeof depo.sorulariGetir>,
): string[] {
  const kume = new Set<string>();
  for (const s of sayfalar) {
    for (const g of kartGorselleri(s)) kume.add(g);
    if (s.videoId) kume.add(s.videoId);
  }
  for (const q of sorular) if (q.gorselId) kume.add(q.gorselId);
  return [...kume];
}
