/**
 * PIN sınavı — `npm test`
 *
 * NEDEN: PIN işçinin İMZASI ve ürünün sattığı şey kayıt. Sınavı olmayan tek
 * şey imza olmamalı. Bu sınav yazılana kadar `pinDogrula`nın dönüş tipi
 * değişince çağıranın `if (!pinDogrula(...))` kalması mümkündü — `!"yanlis"`
 * false olduğu için HER yanlış PIN kabul edilirdi ve ne derleyici ne de
 * tarayıcı sınavı bunu görürdü.
 */
import { bellekDb } from "../src/lib/db.ts";
import { pinKur, pinVarMi, pinDogrula, pinSifirla, pinDurumlari, PIN_DENEME_SINIRI, PIN_KILIT_DK } from "../src/lib/pin.ts";
import { kontrol, esit, bitir } from "./yardim.mjs";

const db = bellekDb();
const T = "2026-08-06T10:00:00.000Z";
const sonra = (dk) => new Date(new Date(T).getTime() + dk * 60_000).toISOString();

// ── temel ───────────────────────────────────────────────────────────────────
esit(pinDogrula(db, "100", "1234", T), "yok", "PIN'i olmayan kişi 'yok' döner");
kontrol(!pinVarMi(db, "100"), "PIN kurulmadan var görünmez");

pinKur(db, "100", "1234", T);
kontrol(pinVarMi(db, "100"), "PIN kuruldu");
esit(pinDogrula(db, "100", "1234", T), "dogru", "doğru PIN kabul edilir");
esit(pinDogrula(db, "100", "9999", T), "yanlis", "yanlış PIN reddedilir");

// Dönüş DİZGE: `!sonuc` ile kontrol eden çağıran her yanlış PIN'i kabul eder.
// Bu satır o hatayı bir daha sessizce geçirmemek için duruyor.
kontrol(pinDogrula(db, "100", "9999", T) !== true, "sonuç boolean DEĞİL — truthy kontrolüne güvenilemez");

// Düz metin saklanmamalı.
const satir = db.prepare("SELECT ozet, tuz FROM pin WHERE sicil='100'").get();
kontrol(!satir.ozet.includes("1234"), "PIN düz metin saklanmıyor");
kontrol(satir.tuz.length >= 16, "kişiye özel tuz var");

// Aynı PIN'i kullanan iki kişinin özeti EŞLEŞMEMELİ (tuz kişiye özel).
pinKur(db, "200", "1234", T);
const ikinci = db.prepare("SELECT ozet FROM pin WHERE sicil='200'").get();
kontrol(satir.ozet !== ikinci.ozet, "aynı PIN farklı kişilerde farklı özet üretir");

// ── kilit ───────────────────────────────────────────────────────────────────
const kurban = "300";
pinKur(db, kurban, "1111", T);
for (let i = 1; i < PIN_DENEME_SINIRI; i++) {
  esit(pinDogrula(db, kurban, "0000", T), "yanlis", `${i}. hatalı deneme henüz kilitlemez`);
}
esit(pinDogrula(db, kurban, "0000", T), "kilitli", `${PIN_DENEME_SINIRI}. hatalı denemede kilitlenir`);
// KİLİTLİYKEN DOĞRU PIN DE GEÇMEZ: yoksa kaba kuvvet kilidi hiç görmezdi.
esit(pinDogrula(db, kurban, "1111", T), "kilitli", "kilitliyken doğru PIN de kabul edilmez");
esit(pinDogrula(db, kurban, "1111", sonra(PIN_KILIT_DK - 1)), "kilitli", "süre dolmadan açılmaz");
esit(pinDogrula(db, kurban, "1111", sonra(PIN_KILIT_DK + 1)), "dogru", "süre dolunca doğru PIN kabul edilir");

// Başarılı giriş sayacı sıfırlar — yoksa aylar içinde biriken hatalar
// dürüst kullanıcıyı kilitlerdi.
pinKur(db, "400", "2222", T);
pinDogrula(db, "400", "0000", T);
pinDogrula(db, "400", "0000", T);
esit(pinDogrula(db, "400", "2222", T), "dogru", "doğru PIN kabul edilir");
for (let i = 1; i < PIN_DENEME_SINIRI; i++) {
  esit(pinDogrula(db, "400", "0000", T), "yanlis", `sayaç sıfırlandı, ${i}. deneme kilitlemez`);
}

// ── sıfırlama ───────────────────────────────────────────────────────────────
pinSifirla(db, "100");
kontrol(!pinVarMi(db, "100"), "sıfırlanan PIN silinir");
esit(pinDogrula(db, "100", "1234", T), "yok", "sıfırlamadan sonra eski PIN geçmez");

// Kilitli kişi sıfırlanınca kilit de kalkar (yönetici kurtarma yolu).
pinKur(db, "500", "3333", T);
for (let i = 0; i < PIN_DENEME_SINIRI; i++) pinDogrula(db, "500", "0000", T);
pinSifirla(db, "500");
pinKur(db, "500", "4444", T);
esit(pinDogrula(db, "500", "4444", T), "dogru", "sıfırlama kilidi de kaldırır");

// ── durum listesi ───────────────────────────────────────────────────────────
pinKur(db, "600", "5555", T);
for (let i = 0; i < PIN_DENEME_SINIRI; i++) pinDogrula(db, "600", "0000", T);
const durumlar = pinDurumlari(db, T);
kontrol(durumlar.find((d) => d.sicil === "600")?.kilitli === true, "kilitli kişi listede işaretli");
kontrol(durumlar.find((d) => d.sicil === "200")?.kilitli === false, "kilitsiz kişi işaretlenmez");

bitir("pin");
