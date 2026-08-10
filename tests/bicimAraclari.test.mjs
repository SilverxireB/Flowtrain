/**
 * Biçim şeridi sınavı — `npm test`
 *
 * NEDEN: şerit düğmeleri metni ve İMLECİ birlikte değiştiriyor. İmleç yanlış
 * yere bırakılırsa hazırlayan yazmaya devam eder ve harfler yıldızların
 * dışına düşer — vurgu görünmez, kimse hata almaz. Sarmalama/çözme
 * simetriktir: "kalın yap" iki kez basıldığında metin BAŞLANGIÇTAKİ hâline
 * dönmeli, yoksa yıldızlar birikir.
 */
import { bicimUygula } from "../src/lib/bicimMetin.ts";
import { kontrol, esit, bitir } from "./yardim.mjs";

/* ── vurgu: sarmalama ────────────────────────────────────────────────────── */
const secimli = bicimUygula("kask zorunlu", 0, 4, "kalin");
esit(secimli.metin, "**kask** zorunlu", "seçili söz sarmalanır");
esit(secimli.basla, 8, "imleç sarmalanan metnin SONUNA gider");
esit(secimli.basla, secimli.bitir, "sarmalamadan sonra seçim kalmaz");

const secimsiz = bicimUygula("kask", 4, 4, "kalin");
esit(secimsiz.metin, "kask****", "seçim yokken boş vurgu açılır");
esit(secimsiz.basla, 6, "imleç yıldızların ARASINA gider (yazmaya devam edilebilsin)");

/* ── vurgu: çözme (aynı düğme iki kez) ───────────────────────────────────── */
const iciyle = bicimUygula("**kask** zorunlu", 0, 8, "kalin");
esit(iciyle.metin, "kask zorunlu", "yıldızlar seçimin İÇİNDEYSE kaldırılır");
esit([iciyle.basla, iciyle.bitir], [0, 4], "çözülen metin seçili kalır");

const disiyla = bicimUygula("**kask** zorunlu", 2, 6, "kalin");
esit(disiyla.metin, "kask zorunlu", "yıldızlar seçimin DIŞINDAYSA da kaldırılır (çift tıklama durumu)");
esit([disiyla.basla, disiyla.bitir], [0, 4], "seçim yeni konuma kayar");

/* SİMETRİ: iki kez basmak başlangıca döndürmeli, yoksa yıldız birikir. */
const bir = bicimUygula("kask", 0, 4, "kalin");
const iki = bicimUygula(bir.metin, 0, bir.metin.length, "kalin");
esit(iki.metin, "kask", "sarmala + çöz = başlangıç");

/* ── satır önekleri ──────────────────────────────────────────────────────── */
const madde = bicimUygula("kask", 0, 0, "madde");
kontrol(madde.metin.startsWith("- "), "madde öneki satır başına eklenir");

/* SEÇİMİN DEĞDİĞİ TÜM SATIRLAR. Yalnız seçili karakterlere uygulamak satırın
   ORTASINDA `- ` bırakırdı. */
const cokSatir = bicimUygula("kask\neldiven\ngözlük", 2, 10, "madde");
esit(
  cokSatir.metin.split("\n").filter((s) => s.startsWith("- ")).length,
  2,
  "seçimin değdiği iki satır önek alır, üçüncüsü almaz",
);

const sirali = bicimUygula("önce\nsonra", 0, 10, "sirali");
kontrol(/^1\. /.test(sirali.metin.split("\n")[0]), "ilk satır 1. olur");
kontrol(/^2\. /.test(sirali.metin.split("\n")[1]), "ikinci satır 2. olur");

const uyari = bicimUygula("enerjiyi kes", 0, 0, "uyari");
kontrol(uyari.metin.startsWith("!!"), "uyarı öneki eklenir");

/* Önek de simetrik olmalı: aynı düğmeye ikinci basış öneki kaldırsın. */
const onekBir = bicimUygula("kask", 0, 0, "madde");
const onekIki = bicimUygula(onekBir.metin, 0, 0, "madde");
esit(onekIki.metin, "kask", "madde öneki ikinci basışta kalkar");

/* ── sınır durumları ─────────────────────────────────────────────────────── */
esit(bicimUygula("", 0, 0, "kalin").metin, "****", "boş metinde çökmez");
kontrol(bicimUygula("tek satır", 0, 9, "madde").metin.startsWith("- "), "tek satırlık metin");

bitir("biçim araçları");
