"use client";

import Icon from "@/components/Icon";
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
 */

export type KontrolDurumu = "engel" | "uyari" | "tamam";

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
    if (bosSoru > 0) liste.push({ durum: "uyari", metin: `${bosSoru} sorunun metni boş.` });

    const bosSik = sorular.filter((q) => q.secenekler.some((s) => !s.trim())).length;
    if (bosSik > 0) liste.push({ durum: "uyari", metin: `${bosSik} soruda boş şık var.` });

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
        durum: "uyari",
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
      liste.push({ durum: "uyari", metin: `${kisaSira} sıralama sorusunda en az iki adım olmalı.` });
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
      liste.push({ durum: "uyari", metin: `${gorselsiz} işaretleme sorusunda görsel seçilmemiş.` });
    }
    const bolgesiz = isaretliler.filter((q) => q.secenekler.filter((s) => bolgeCoz(s)).length === 0).length;
    if (bolgesiz > 0) {
      liste.push({ durum: "uyari", metin: `${bolgesiz} işaretleme sorusunda hiç bölge tanımlanmamış.` });
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

/** Başlıktaki özet rozeti — yayınla düğmesinin yanında durur. */
export function YayinRozeti({ liste }: { liste: KontrolSatiri[] }) {
  const engel = liste.some((k) => k.durum === "engel");
  const uyari = liste.filter((k) => k.durum === "uyari").length;

  /* Dar ekranda GİZLİ: başlık şeridi kırılmıyor, üçüncü bir rozet eklenince
     eğitim adı ile Yayınla düğmesi birbirini eziyordu. Ayrıntı zaten gövdedeki
     "Yayına hazırlık" bölümünde duruyor. */
  if (engel) {
    return (
      <span className="chip hidden border-brand/40 bg-brand-soft text-xs text-brand-dark sm:inline-flex" title="Yayın için en az bir sayfa gerekir">
        <Icon name="warning" size={14} /> Sayfa yok
      </span>
    );
  }
  if (uyari > 0) {
    return (
      <span className="chip hidden border-orta/40 bg-orta/10 text-xs text-orta-dark sm:inline-flex" title="Aşağıdaki 'Yayına hazırlık' listesine bakın">
        <Icon name="warning" size={14} /> {uyari} uyarı
      </span>
    );
  }
  return (
    <span className="chip hidden border-iyi/40 bg-iyi/10 text-xs text-iyi-dark sm:inline-flex">
      <Icon name="check" size={14} /> Yayına hazır
    </span>
  );
}

export default function YayinKontrol({ liste }: { liste: KontrolSatiri[] }) {
  return (
    <ul className="card divide-y divide-line">
      {liste.map((k, i) => (
        <li key={i} className="flex items-start gap-3 px-5 py-3 text-sm">
          <span
            className={`mt-0.5 ${
              k.durum === "tamam" ? "text-iyi-dark" : k.durum === "uyari" ? "text-orta-dark" : "text-brand"
            }`}
          >
            <Icon name={k.durum === "tamam" ? "check" : "warning"} size={16} />
          </span>
          <span className={k.durum === "tamam" ? "text-muted" : "font-semibold"}>{k.metin}</span>
        </li>
      ))}
    </ul>
  );
}
