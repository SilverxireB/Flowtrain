/**
 * Yapıştır-ve-böl sınavı — `npm test`
 *
 * NEDEN: bölme yanlış çalışırsa hazırlayan bunu FARK ETMEZ — kartlar oluşur,
 * doludur, makul görünür. Yanlış olan yalnızca nerede bölündüğü ve hangi tipin
 * seçildiğidir; bu da sahada "adımlar tek kartta ezilmiş" ya da "uyarı düz
 * metin gibi geçmiş" diye ortaya çıkar. Kalıp burada kilitleniyor.
 */
import { metniKartlaraBol } from "../src/lib/metinBol.ts";
import { kontrol, esit, bitir } from "./yardim.mjs";

/* ── boş girdi ───────────────────────────────────────────────────────────── */
esit(metniKartlaraBol("").length, 0, "boş metinden kart çıkmaz");
esit(metniKartlaraBol("   \n\n  ").length, 0, "yalnız boşluktan kart çıkmaz");

/* ── boş satır böler ─────────────────────────────────────────────────────── */
{
  const k = metniKartlaraBol("Baret zorunlu\nSahaya baretsiz girilmez.\n\nGözlük\nTaşlama yapan gözlük takar.");
  esit(k.length, 2, "boş satır iki bölüm ayırır");
  esit(k[0].baslik, "Baret zorunlu", "kısa ve noktasız ilk satır başlık olur");
  esit(k[0].metin, "Sahaya baretsiz girilmez.", "kalan satırlar gövdedir");
}

/* ── numaralı liste → adım ───────────────────────────────────────────────── */
{
  const k = metniKartlaraBol("Düşme olursa\n1. Hattı durdur\n2. Kişiyi kımıldatma\n3. Amiri ara");
  esit(k[0].tip, "adim", "numaralı liste ADIM kartı olur");
  esit(k[0].metin, "Hattı durdur\nKişiyi kımıldatma\nAmiri ara", "numaralar temizlenir (kiosk kendi koyar)");
  esit(k[0].baslik, "Düşme olursa", "başlık korunur");
}

/* Tek numaralı satır liste sayılmaz — cümle içinde geçen sayı olabilir. */
{
  const k = metniKartlaraBol("Kural\n1. maddeye göre baret zorunludur ve bu kural herkesi kapsar.");
  kontrol(k[0].tip !== "adim", "tek numaralı satır ADIM kartı yapmaz");
}

/* ── madde listesi → kontrol listesi ─────────────────────────────────────── */
{
  const k = metniKartlaraBol("Platform öncesi\n- Korkuluk sağlam mı\n- Ayak tahtası yerinde mi\n- Zemin kaygan mı");
  esit(k[0].tip, "kontrolListesi", "madde listesi KONTROL LİSTESİ olur");
  esit(k[0].metin.split("\n").length, 3, "üç madde korunur");
  kontrol(!k[0].metin.includes("-"), "madde imleri temizlenir");
}

/* ── tehlike sözcüğü → uyarı ─────────────────────────────────────────────── */
{
  const k = metniKartlaraBol("Kemer\nKemersiz çalışmak yasaktır ve ölümle sonuçlanır.");
  esit(k[0].tip, "uyari", "tehlike sözcüğü geçen bölüm UYARI olur");
  esit(k[0].gerekce, "tehlike sözcüğü", "gerekçe taşınır (hazırlayan neden bu tip olduğunu görür)");
}

/* ── düz metin → kural ───────────────────────────────────────────────────── */
{
  const k = metniKartlaraBol("Vardiya başlangıcı\nHer vardiya başında tezgâh temizlenir.");
  esit(k[0].tip, "kural", "düz metin KURAL kartı olur");
}

/* ── başlıksız bölüm ─────────────────────────────────────────────────────── */
{
  const k = metniKartlaraBol("Bu uzun bir cümledir ve sonunda nokta vardır, dolayısıyla başlık sayılmaz.");
  esit(k.length, 1, "tek paragraftan tek kart");
  kontrol(k[0].baslik.length > 0, "başlık ilk cümleden türetilir");
  kontrol(k[0].baslik.length <= 71, "türetilen başlık kısaltılır");
}

/* ── BÜYÜK HARFLİ başlık uzun olsa da başlıktır ──────────────────────────── */
{
  const k = metniKartlaraBol("YÜKSEKTE ÇALIŞMA KURALLARI\nKemer takılır.");
  esit(k[0].baslik, "YÜKSEKTE ÇALIŞMA KURALLARI", "tamamı büyük harfli satır başlıktır");
}

/* ── boş satırsız metin: başlık gibi duran satır böler ───────────────────── */
{
  const k = metniKartlaraBol(
    "Baret\nSahaya baretsiz girilmez.\nGözlük\nTaşlama yapan gözlük takar.\nEldiven\nKeskin parça tutulurken eldiven giyilir.",
  );
  kontrol(k.length >= 2, "boş satır yoksa başlık gibi duran satırlar böler");
  kontrol(k.length < 6, "her satır ayrı kart OLMAZ (elli satırlık talimat elli kart üretmemeli)");
}

/* ── Windows satır sonu ──────────────────────────────────────────────────── */
esit(
  metniKartlaraBol("Baslik\r\nGovde metni burada.")[0].metin,
  "Govde metni burada.",
  "Windows satır sonu okunur (Word'den yapıştırma)",
);

/* ── iki nokta ile biten başlık ──────────────────────────────────────────── */
esit(
  metniKartlaraBol("Adımlar:\n1. Bir\n2. İki")[0].baslik,
  "Adımlar",
  "başlık sonundaki iki nokta atılır",
);

bitir("metin bölme");
