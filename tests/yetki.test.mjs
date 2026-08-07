/**
 * Yetki kapısı sınavı — `npm test`
 *
 * NEDEN: bu iki fonksiyon ürünün en SESSİZ yüzeyi. Bozulduklarında ekranda
 * hiçbir şey değişmez, hiçbir hata çıkmaz — yalnız yanlış kişi yanlış yere
 * girer ya da kullanıcı fark etmeden dışarı yönlendirilir.
 */
import { yetkili, guvenliYol } from "../src/lib/yetki.ts";
import { kontrol, esit, bitir } from "./yardim.mjs";

const h = (rol, sicil) => ({ kullanici: "x", ad: "X", rol, sicil });

// ── rol matrisi ─────────────────────────────────────────────────────────────
kontrol(!yetkili(null, "hazirlayan"), "oturumsuz kimse hiçbir kapıdan geçmez");

// Yönetici her kapıdan geçer.
for (const kapi of ["yonetici", "onaylayan", "hazirlayan", "amir"]) {
  kontrol(yetkili(h("yonetici"), kapi), `yönetici ${kapi} kapısından geçer`);
}

// Onaylayan hazırlayanın yaptığını da yapar, ama yönetici değildir.
kontrol(yetkili(h("onaylayan"), "hazirlayan"), "onaylayan hazırlama yapar");
kontrol(yetkili(h("onaylayan"), "onaylayan"), "onaylayan yayınlar");
kontrol(!yetkili(h("onaylayan"), "yonetici"), "onaylayan yönetici kapısından geçemez");

// Hazırlayan YAYINLAYAMAZ — dört göz kuralı.
kontrol(yetkili(h("hazirlayan"), "hazirlayan"), "hazırlayan kendi kapısından geçer");
kontrol(!yetkili(h("hazirlayan"), "onaylayan"), "hazırlayan yayınlayamaz (dört göz kuralı)");
kontrol(!yetkili(h("hazirlayan"), "yonetici"), "hazırlayan yönetici kapısından geçemez");

// AMİR AYRI DAL: ne yukarı ne aşağı.
kontrol(yetkili(h("amir"), "amir"), "amir kendi yüzeyine girer");
kontrol(!yetkili(h("amir"), "hazirlayan"), "amir eğitim hazırlayamaz");
kontrol(!yetkili(h("amir"), "onaylayan"), "amir yayınlayamaz");
kontrol(!yetkili(h("amir"), "yonetici"), "amir yönetici değildir");

// Bu ikisi eskiden GEÇİYORDU: `enAz === "amir"` koşulsuz true dönüyordu, yani
// giriş yapan herkes /ekibim'i açıp başkası adına gözetimli oturum
// başlatabiliyordu.
kontrol(!yetkili(h("hazirlayan"), "amir"), "hazırlayan amir yüzeyine giremez");
kontrol(!yetkili(h("onaylayan"), "amir"), "onaylayan amir yüzeyine giremez");
// Sicil taşımak yetki VERMEZ.
kontrol(!yetkili(h("hazirlayan", "9001"), "amir"), "sicil tanımlı olması amir yapmaz");

// ── açık yönlendirme ────────────────────────────────────────────────────────
esit(guvenliYol("/pano"), "/pano", "iç yol korunur");
esit(guvenliYol("/egitimler/egt_1?a=b"), "/egitimler/egt_1?a=b", "sorgu dizesi korunur");
esit(guvenliYol(undefined), "/", "boş hedef varsayılana düşer");
esit(guvenliYol(""), "/", "boş dize varsayılana düşer");

// Şema-göreli adresler ELENMELİ — tarayıcı ikisini de dış siteye çözer.
esit(guvenliYol("//kotu.example"), "/", "// ile başlayan protokole-göreli adres elenir");
esit(guvenliYol("/\\kotu.example"), "/", "ters eğik çizgili şema-göreli adres elenir");
esit(guvenliYol("https://kotu.example"), "/", "mutlak adres elenir");
esit(guvenliYol("http://kotu.example"), "/", "http adresi elenir");
esit(guvenliYol("javascript:alert(1)"), "/", "javascript: elenir");
esit(guvenliYol("pano"), "/", "eğik çizgisiz göreli yol elenir");
esit(guvenliYol("/", "/hub"), "/hub", "tek eğik çizgi tek başına hedef sayılmaz");

bitir("yetki");
