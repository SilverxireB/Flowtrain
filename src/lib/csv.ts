/**
 * CSV okuma/yazma — dış bağımlılık YOK (kapalı ağ kuralı).
 *
 * TÜRKÇE EXCEL İKİ ŞEY İSTER, ikisi de sessizce bozar:
 *  1. AYIRICI `;` — Türkçe yerelde ondalık ayırıcı virgüldür, virgüllü CSV
 *     tek sütuna yapışır ve kullanıcı "dosya bozuk" der.
 *  2. BOM — BOM'suz UTF-8'i Excel Latin-1 sanar, "Çalışan" → "Ã‡alÄ±ÅŸan".
 *
 * OKURKEN hem `;` hem `,` kabul edilir: personel dosyası bize başka bir
 * sistemden gelir, ayırıcısını seçme lüksümüz yok.
 *
 * Sınav: `node tests/csv.test.mjs`
 */

export const BOM = "﻿";

/**
 * Satırdaki ayırıcıyı tahmin et (başlık satırında hangisi daha çok geçiyorsa).
 *
 * DÜZ DÖNGÜ, KAPANIŞ YOK — ve bu bilinçli. Burada eskiden
 * `const say = (c) => satir.match(...)` gibi, parametreyi yakalayıp iki kez
 * çağrılan bir yardımcı vardı. SWC küçültücüsü onu satır içine alırken
 * `satir`in İKİNCİ geçişini serbest bıraktı: derlenmiş dosyada
 * `satir is not defined` çalışma hatası oluştu. Kaynak doğruydu, çıktı bozuktu
 * — birim sınavlar küçültülmemiş kodu koştuğu için hiçbir şey görmedi;
 * hatayı yalnız uçtan uca sınav yakaladı. Bu deseni geri getirmeyin.
 */
export function ayiriciBul(satir: string): string {
  let noktaliVirgul = 0;
  let virgul = 0;
  for (const c of satir) {
    if (c === ";") noktaliVirgul++;
    else if (c === ",") virgul++;
  }
  return noktaliVirgul >= virgul ? ";" : ",";
}

/**
 * Tırnak farkındalıklı CSV çözümleyici.
 * `"Kaynak, Montaj"` gibi hücreler bölünmemeli; `""` kaçışı tırnak demektir.
 */
export function satiriBol(satir: string, ayirici: string): string[] {
  const hucreler: string[] = [];
  let h = "";
  let tirnakta = false;
  for (let i = 0; i < satir.length; i++) {
    const c = satir[i];
    if (tirnakta) {
      if (c === '"') {
        if (satir[i + 1] === '"') {
          h += '"';
          i++;
        } else tirnakta = false;
      } else h += c;
    } else if (c === '"') tirnakta = true;
    else if (c === ayirici) {
      hucreler.push(h);
      h = "";
    } else h += c;
  }
  hucreler.push(h);
  return hucreler.map((x) => x.trim());
}

/** Başlıklı CSV → nesne dizisi. Başlıklar küçültülür (Sicil/SİCİL/sicil aynı). */
export function csvOku(metin: string): Record<string, string>[] {
  const temiz = metin.replace(/^﻿/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const satirlar = temiz.split("\n").filter((s) => s.trim() !== "");
  if (satirlar.length === 0) return [];

  const ayirici = ayiriciBul(satirlar[0]);
  const basliklar = satiriBol(satirlar[0], ayirici).map((b) => b.toLocaleLowerCase("tr"));

  return satirlar.slice(1).map((satir) => {
    const hucreler = satiriBol(satir, ayirici);
    const kayit: Record<string, string> = {};
    basliklar.forEach((b, i) => (kayit[b] = hucreler[i] ?? ""));
    return kayit;
  });
}

function hucreKacir(deger: unknown): string {
  const s = String(deger ?? "");
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Nesne dizisi → Türkçe Excel'in doğru açtığı CSV (BOM + `;`). */
export function csvYaz(basliklar: { anahtar: string; etiket: string }[], satirlar: Record<string, unknown>[]): string {
  const bas = basliklar.map((b) => hucreKacir(b.etiket)).join(";");
  const govde = satirlar.map((s) => basliklar.map((b) => hucreKacir(s[b.anahtar])).join(";"));
  return BOM + [bas, ...govde].join("\r\n");
}
