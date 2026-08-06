/**
 * CSV sınavı — `npm test`
 *
 * NEDEN: personel listesi bize BAŞKA bir sistemden gelir; ayırıcısını,
 * kodlamasını, başlık yazımını biz seçmiyoruz. Okuyamadığımız her varyant
 * "kurulum çalışmıyor" demek. Yazma tarafında da Türkçe Excel iki şeyi
 * sessizce bozar: virgül ayırıcı ve BOM'suz UTF-8.
 */
import { csvOku, csvYaz, satiriBol, ayiriciBul, BOM } from "../src/lib/csv.ts";
import { kontrol, esit, bitir } from "./yardim.mjs";

// ── ayırıcı ─────────────────────────────────────────────────────────────────
esit(ayiriciBul("a;b;c"), ";", "noktalı virgül tanınır");
esit(ayiriciBul("a,b,c"), ",", "virgül tanınır");
esit(ayiriciBul("ad"), ";", "tek sütunda varsayılan noktalı virgül");

// ── satır bölme ─────────────────────────────────────────────────────────────
esit(satiriBol("a;b;c", ";"), ["a", "b", "c"], "düz satır");
esit(satiriBol('a;"Kaynak; Montaj";c', ";"), ["a", "Kaynak; Montaj", "c"], "tırnak içindeki ayırıcı bölmez");
esit(satiriBol('a;"12"" boru";c', ";"), ["a", '12" boru', "c"], "çift tırnak kaçışı");
esit(satiriBol("a;;c", ";"), ["a", "", "c"], "boş hücre korunur");

// ── okuma ───────────────────────────────────────────────────────────────────
const dosya = `Sicil;Ad;Bölüm;Amir\r\n100;Ali Yılmaz;Kaynak;900\r\n200;Ayşe Demir;Montaj;900\r\n`;
const kayitlar = csvOku(dosya);
esit(kayitlar.length, 2, "iki satır okundu");
esit(kayitlar[0].sicil, "100", "başlıklar küçültülür (Sicil → sicil)");
esit(kayitlar[0]["bölüm"], "Kaynak", "Türkçe başlık korunur");
esit(kayitlar[1].ad, "Ayşe Demir", "Türkçe karakter bozulmaz");

// BOM'lu dosya: Excel'in kaydettiği hâli. BOM temizlenmezse ilk başlık
// "﻿sicil" olur ve sicil sütunu HİÇ bulunamaz — sessiz, ölümcül.
esit(csvOku(BOM + dosya)[0].sicil, "100", "BOM'lu dosyada ilk sütun bulunur");
// Virgül ayırıcılı dosya da okunmalı: kaynağın ayarını biz seçmiyoruz.
esit(csvOku("sicil,ad\n100,Ali")[0].ad, "Ali", "virgüllü dosya okunur");
// Satır sonu CRLF/LF/CR karışabilir (Windows'tan gelen dosya).
esit(csvOku("sicil\r100\r200").length, 2, "eski Mac satır sonu (CR) okunur");
esit(csvOku("").length, 0, "boş dosya boş liste");
esit(csvOku("sicil;ad").length, 0, "yalnız başlık varsa kayıt yok");
// Eksik hücre: kısa satır çökmemeli, eksik alan boş string olmalı.
esit(csvOku("sicil;ad;bolum\n100;Ali")[0].bolum, "", "eksik hücre boş döner");

// ── yazma ───────────────────────────────────────────────────────────────────
const cikti = csvYaz(
  [
    { anahtar: "sicil", etiket: "Sicil" },
    { anahtar: "ad", etiket: "Ad" },
  ],
  [{ sicil: "100", ad: "Ali; Veli" }],
);
kontrol(cikti.startsWith(BOM), "çıktı BOM ile başlar (Excel UTF-8'i tanısın)");
kontrol(cikti.includes("Sicil;Ad"), "ayırıcı noktalı virgül");
kontrol(cikti.includes('"Ali; Veli"'), "ayırıcı içeren hücre tırnaklanır");
kontrol(cikti.includes("\r\n"), "satır sonu CRLF");

bitir("csv");
