/**
 * YAYINA HAZIRLIK KONTROLÜ — SAF MANTIK.
 *
 * NEDEN `src/lib` (eskiden `components/editor/YayinKontrol.tsx` içindeydi):
 * hangi kusurun sahayı durdurduğu kararı ürünün en kritik yargılarından biri
 * ve `.tsx` dosyasındaki kod SINAVLANAMIYOR — Node'un tip ayıklayıcısı JSX'i
 * okumuyor. CLAUDE.md zaten "saf mantık `src/lib/` altında ve sınavlı olmalı"
 * diyor; kural burada uygulanmamıştı.
 *
 * Çizim tarafı (`YayinKontrol`, `YayinRozeti`) bileşen dosyasında kaldı ve
 * buradan besleniyor.
 */
import { kartGorselleri } from "@/lib/editorMedya";
import type { Egitim, Sayfa, Soru } from "@/lib/tipler";
import { bolgeCoz, eslestirmeCifti } from "@/lib/sinav";
import { okumaUyarilari } from "@/lib/okunabilirlik";

/**
 * YAYINA HAZIRLIK KONTROL LİSTESİ.
 *
 * ENGELLEMEZ, SÖYLER. Tek gerçek engel "hiç sayfa yok" — onu sunucu da
 * reddediyor. Geri kalanı uyarıdır: başlıksız kart ya da havuzdan küçük soru
 * sayısı kötü bir eğitim yapar ama GEÇERSİZ bir eğitim yapmaz, ve ürünün
 * hazırlayana "sen bilirsin" diyebilmesi gerekir. Zorunlu tutulan her kontrol,
 * ikinci haftada anlamsız bir başlık yazılarak aşılır.
 *
 * Kontroller bilerek AZ ve SOMUT: "içerik yeterince açıklayıcı mı" gibi ölçüsü
 * olmayan bir madde listeyi gürültüye çevirir, gürültü de listeyi okunmaz yapar.
 *
 * ÜÇ ŞİDDET, İKİ DEĞİL — ve fark sahada ölçüldü.
 * "Engellemez, söyler" ilkesi doğru ama her uyarıyı aynı sarı satırda
 * göstermek, "kioskta üstte boşluk görünür" (kozmetik) ile "metni olmayan
 * soru" (işçi ilerleyemez) arasındaki farkı siliyordu. "3 uyarı" rozetiyle
 * yayınlanan bir eğitimde işçinin karşısına başlıksız, iki boş kutulu,
 * cevaplanamayan bir soru ekranı çıktı — vardiya durur.
 *
 * `kilit` YİNE ENGELLEMEZ; yalnız kırmızı görünür ve yayın onayında ayrıca
 * söylenir. Zorunlu tutulan her kontrol ikinci haftada anlamsız bir metin
 * yazılarak aşılır; görünür kılmak, yasaklamaktan daha uzun ömürlü.
 */

/** `kilit`: yayına engel değil ama SAHADA İŞÇİYİ DURDURUR. */
export type KontrolDurumu = "engel" | "kilit" | "uyari" | "tamam";

export interface KontrolSatiri {
  durum: KontrolDurumu;
  metin: string;
}

/** Kart hiçbir şey anlatmıyor mu — ne metin ne görsel ne video. */
function bosKart(s: Sayfa): boolean {
  return !s.metin?.trim() && !s.metinKarsi?.trim() && kartGorselleri(s).length === 0 && !s.videoId;
}

/**
 * Bu kartta yayına engel olmayan ama SÖYLENMESİ gereken bir kusur var mı?
 *
 * TEK KAYNAK: hem buradaki uyarı satırları hem editördeki kart haritasının
 * uyarı noktaları bunu kullanır. İki yerde ayrı ayrı yazılmıştı; ölçütler
 * ayrışsaydı harita "sorun yok" derken kontrol listesi uyarır, hazırlayan da
 * hangisine inanacağını bilemezdi.
 */
export function kartSorunlu(sayfa: Sayfa, kirik: Set<string>): boolean {
  if (!sayfa.baslik.trim()) return true;
  if (bosKart(sayfa)) return true;
  if (sayfa.tip === "video" && !sayfa.videoId) return true;
  if (kartGorselleri(sayfa).some((g) => kirik.has(g))) return true;
  return !!sayfa.videoId && kirik.has(sayfa.videoId);
}

export function yayinKontrolu(
  egitim: Egitim,
  sayfalar: Sayfa[],
  sorular: Soru[],
  kirikGorselIdler: string[],
): KontrolSatiri[] {
  const liste: KontrolSatiri[] = [];
  const kirik = new Set(kirikGorselIdler);

  liste.push(
    sayfalar.length === 0
      ? { durum: "engel", metin: "Hiç sayfa yok — en az bir kart olmadan yayınlanamaz." }
      : { durum: "tamam", metin: `${sayfalar.length} sayfa hazır.` },
  );

  // Harita noktaları ve buradaki uyarılar AYNI ölçütten beslenir (kartSorunlu).
  const basliksiz = sayfalar.filter((s) => !s.baslik.trim()).length;
  if (basliksiz > 0) {
    liste.push({ durum: "uyari", metin: `${basliksiz} kartın başlığı boş — kioskta üstte boşluk görünür.` });
  }

  const bos = sayfalar.filter(bosKart).length;
  if (bos > 0) liste.push({ durum: "uyari", metin: `${bos} kartta hiç içerik yok (metin de görsel de yok).` });

  const videosuz = sayfalar.filter((s) => s.tip === "video" && !s.videoId).length;
  if (videosuz > 0) liste.push({ durum: "uyari", metin: `${videosuz} video kartına video eklenmemiş.` });

  const kirikKart =
    sayfalar.filter((s) => kartGorselleri(s).some((g) => kirik.has(g)) || (s.videoId && kirik.has(s.videoId))).length +
    sorular.filter((q) => q.gorselId && kirik.has(q.gorselId)).length;
  if (kirikKart > 0) {
    liste.push({ durum: "uyari", metin: `${kirikKart} yerde görsel/video dosyası diskte bulunamadı.` });
  }

  if (sorular.length === 0) {
    // Sınavsız eğitim GEÇERLİ bir kullanım (bilgilendirme, "okudum onaylıyorum")
    // — uyarı değil, bilgi.
    liste.push({ durum: "tamam", metin: "Soru yok: eğitim imzalı okuma kaydı olarak tamamlanır." });
  } else {
    if (sorular.length < egitim.soruSayisi) {
      liste.push({
        durum: "uyari",
        metin: `Havuzda ${sorular.length} soru var, sınavda ${egitim.soruSayisi} soruluyor — herkese aynı sorular gelir.`,
      });
    } else {
      liste.push({ durum: "tamam", metin: `${sorular.length} soruluk havuzdan ${egitim.soruSayisi} soru sorulacak.` });
    }

    const bosSoru = sorular.filter((q) => !q.metin.trim()).length;
    /* SAHADA KİLİTLER: metni olmayan soru ekranda boş bir başlıkla çıkar,
       kişi neyi cevaplayacağını bilemez. */
    if (bosSoru > 0) liste.push({ durum: "kilit", metin: `${bosSoru} sorunun metni boş — kioskta cevaplanamaz.` });

    const bosSik = sorular.filter((q) => q.secenekler.some((s) => !s.trim())).length;
    // SAHADA KİLİTLER: boş şık, dokunulacak ama üzerinde hiçbir şey yazmayan
    // bir kutu demek.
    if (bosSik > 0) liste.push({ durum: "kilit", metin: `${bosSik} soruda boş şık var — kioskta boş kutu görünür.` });

    /* ── YENİ SORU TİPLERİNİN KENDİNE ÖZGÜ KUSURLARI ──────────────────────
       Bu satırların hepsi SESSİZ hatalar: soru ekranda düzgün görünür, kişi
       cevaplar, ama puanlama beklenenden başka çalışır. Yayından önce
       söylenmezse sahada fark edilmez. */

    // Doğru cevabı hiç işaretlenmemiş soru KİMSEYE puan vermez (bkz. sinav.ts).
    const dogrusuz = sorular.filter(
      (q) => q.tip !== "siralama" && q.tip !== "eslestirme" && q.dogru.length === 0,
    ).length;
    if (dogrusuz > 0) {
      liste.push({
        durum: "kilit",
        metin: `${dogrusuz} soruda doğru cevap işaretlenmemiş — o soruyu kimse doğru yapamaz.`,
      });
    }

    // `___` yoksa boşluk doldurma sorusu sıradan bir çoktan seçmeliye döner.
    const bosluksuz = sorular.filter((q) => q.tip === "bosluk" && !q.metin.includes("___")).length;
    if (bosluksuz > 0) {
      liste.push({ durum: "uyari", metin: `${bosluksuz} boşluk sorusunda metinde \`___\` yok.` });
    }

    // Tek şıklı sıralama sorusu her cevabı doğru sayar.
    const kisaSira = sorular.filter((q) => q.tip === "siralama" && q.secenekler.length < 2).length;
    if (kisaSira > 0) {
      liste.push({ durum: "kilit", metin: `${kisaSira} sıralama sorusunda en az iki adım olmalı.` });
    }

    // Yarım çift: sol ya da sağ tarafı boş kalan eşleştirme satırı.
    const yarimCift = sorular.filter(
      (q) => q.tip === "eslestirme" && q.secenekler.some((s) => { const c = eslestirmeCifti(s); return !c.sol || !c.sag; }),
    ).length;
    if (yarimCift > 0) {
      liste.push({ durum: "uyari", metin: `${yarimCift} eşleştirme sorusunda yarım çift var.` });
    }

    const isaretliler = sorular.filter((q) => q.tip === "gorselIsaret");
    const gorselsiz = isaretliler.filter((q) => !q.gorselId).length;
    if (gorselsiz > 0) {
      liste.push({ durum: "kilit", metin: `${gorselsiz} işaretleme sorusunda görsel seçilmemiş — soru boş açılır.` });
    }
    const bolgesiz = isaretliler.filter((q) => q.secenekler.filter((s) => bolgeCoz(s)).length === 0).length;
    if (bolgesiz > 0) {
      liste.push({ durum: "kilit", metin: `${bolgesiz} işaretleme sorusunda hiç bölge yok — işaretlenecek yer bulunmaz.` });
    }
  }

  /* OKUNABİLİRLİK EN SONDA ve TEK SATIR. Kart kart yazılsaydı kırk kartlık
     eğitimde liste okuma uyarılarıyla dolar, asıl kusurlar (boş şık, kırık
     görsel) aralarında kaybolurdu. Kaç kartta sorun olduğu söylenir; hangisi
     olduğunu kart haritası zaten gösteriyor. */
  const okuma = okumaUyarilari(sayfalar);
  if (okuma.length > 0) {
    liste.push({
      durum: "uyari",
      metin:
        okuma.length === 1
          ? `Bir kartta okuma sorunu: ${okuma[0].metin}`
          : `${okuma.length} kartta okuma sorunu var (uzun cümle, uzun kart ya da büyük harf).`,
    });
  }

  return liste;
}

