/**
 * Atama kural motoru sınavı — `npm test`
 *
 * NEDEN SINAVLI: bu motor "kim hangi eğitimi almalı, ne zamana kadar" sorusunu
 * yanıtlıyor. Yanlış cevap iki yönde de sessizdir: fazla atarsa kimse şikâyet
 * etmez (herkes fazladan eğitim alır), EKSİK atarsa hiç kimse "bana atanmamış"
 * demez — çünkü atanmadığını bilmez. Denetimde ortaya çıkar, o da geç olur.
 */
import { kapsamda, sonTarih, atamalariCikar, atamaDurumu, gunEkle, ayEkle, gunFarki } from "../src/lib/kurallar.ts";
import { kontrol, esit, bitir } from "./yardim.mjs";

const kisi = (o) => ({ sicil: "1", ad: "Test", ...o });
const kural = (o) => ({ id: "k1", egitimId: "e1", kosul: {}, aktif: true, ...o });

// ── kapsam ──────────────────────────────────────────────────────────────────
kontrol(kapsamda(kisi({ bolum: "Kaynak" }), kural({})), "boş koşul herkesi kapsar");
kontrol(!kapsamda(kisi({}), kural({ aktif: false })), "pasif kural kimseyi kapsamaz");
kontrol(
  kapsamda(kisi({ bolum: "Kaynak" }), kural({ kosul: { bolum: ["Kaynak", "Montaj"] } })),
  "boyut içinde VEYA: listedeki bölüm eşleşir",
);
kontrol(
  !kapsamda(kisi({ bolum: "Boya" }), kural({ kosul: { bolum: ["Kaynak"] } })),
  "listede olmayan bölüm kapsam dışı",
);
kontrol(
  !kapsamda(kisi({ bolum: "Kaynak", gorev: "Operatör" }), kural({ kosul: { bolum: ["Kaynak"], gorev: ["Forklift"] } })),
  "boyutlar arası VE: bölüm tutsa da görev tutmazsa kapsam dışı",
);
// Sessiz tuzak: kişide boş alan varken kural o alanı süzüyorsa KAPSAM DIŞI
// olmalı. "Bilinmiyor = herkes" desek, görevi girilmemiş 200 kişi forklift
// eğitimine atanırdı.
kontrol(
  !kapsamda(kisi({ bolum: "Kaynak" }), kural({ kosul: { gorev: ["Forklift"] } })),
  "kişide görev boşsa görev süzen kural kapsamaz",
);

// ── son tarih ───────────────────────────────────────────────────────────────
esit(sonTarih(kisi({}), kural({})), null, "koşulsuz kuralın son tarihi yok");
esit(sonTarih(kisi({}), kural({ sonTarih: "2026-09-01" })), "2026-09-01", "sabit son tarih aynen döner");
esit(
  sonTarih(kisi({ iseGiris: "2026-08-01" }), kural({ kosul: { iseGirisIcindeGun: 3 } })),
  "2026-08-04",
  "işe girişten 3 gün sonrası kişiye özel hesaplanır",
);
// İki tarih varsa ERKEN olan geçerli: yeni giren kişi, altı ay sonraki genel
// kampanya tarihine kadar beklememeli.
esit(
  sonTarih(kisi({ iseGiris: "2026-08-01" }), kural({ sonTarih: "2027-01-01", kosul: { iseGirisIcindeGun: 3 } })),
  "2026-08-04",
  "iki tarih varsa erken olan kazanır",
);

// ── atama çıkarımı ──────────────────────────────────────────────────────────
const kisiler = [
  kisi({ sicil: "100", bolum: "Kaynak" }),
  kisi({ sicil: "200", bolum: "Boya" }),
  kisi({ sicil: "300", bolum: "Kaynak", iseGiris: "2026-08-01" }),
];
const kurallar = [
  kural({ id: "k1", egitimId: "isg", kosul: {}, sonTarih: "2026-12-31" }),
  kural({ id: "k2", egitimId: "isg", kosul: { bolum: ["Kaynak"], iseGirisIcindeGun: 3 } }),
  kural({ id: "k3", egitimId: "kaynak", kosul: { bolum: ["Kaynak"] } }),
];
const atamalar = atamalariCikar(kisiler, kurallar);
esit(atamalar.length, 5, "3 kişi × kurallar → 5 atama (tekilleştirilmiş)");
esit(
  atamalar.filter((a) => a.sicil === "300" && a.egitimId === "isg")[0].sonTarih,
  "2026-08-04",
  "aynı eğitim iki kuraldan düşerse erken tarih kazanır",
);
kontrol(
  !atamalar.some((a) => a.sicil === "200" && a.egitimId === "kaynak"),
  "Boya bölümü kaynak eğitimine atanmaz",
);

// ── durum ───────────────────────────────────────────────────────────────────
const BUGUN = "2026-08-06";
const oturum = (o) => ({
  id: "o1",
  egitimId: "isg",
  egitimSurum: 1,
  sicil: "100",
  cihaz: "kiosk",
  baslangic: "2026-01-01T08:00:00Z",
  sayfaSureleri: {},
  senkron: "gonderildi",
  ...o,
});
const atama = { sicil: "100", egitimId: "isg", sonTarih: "2026-12-31" };

esit(atamaDurumu(atama, [], {}, BUGUN).durum, "eksik", "hiç oturum yoksa eksik");
esit(
  atamaDurumu({ ...atama, sonTarih: "2026-08-01" }, [], {}, BUGUN).durum,
  "gecikti",
  "son tarihi geçmiş ve hiç girmemiş → gecikti",
);
esit(
  atamaDurumu(atama, [oturum({ bitis: "2026-08-05T09:00:00Z", sonuc: "kaldi" })], {}, BUGUN).durum,
  "kaldi",
  "kalmış kişi 'eksik' değil 'kaldı' — amir 'hiç girmemiş' sanmasın",
);
esit(
  atamaDurumu(atama, [oturum({ bitis: "2026-08-05T09:00:00Z", sonuc: "gecti" })], {}, BUGUN).durum,
  "tamam",
  "geçmiş ve tekrar gerekmiyorsa tamam",
);
// Geçti kaydı, kalma kaydından SONRA gelmese bile geçerli olmalı: ikinci
// denemede geçen kişi hâlâ "kaldı" görünürse amir boşuna kovalar.
esit(
  atamaDurumu(
    atama,
    [oturum({ id: "a", bitis: "2026-08-05T09:00:00Z", sonuc: "kaldi" }), oturum({ id: "b", bitis: "2026-08-05T10:00:00Z", sonuc: "gecti" })],
    {},
    BUGUN,
  ).durum,
  "tamam",
  "kalıp sonra geçen kişi tamam",
);

// Tekrar süresi
const gecti2025 = [oturum({ bitis: "2025-08-05T09:00:00Z", sonuc: "gecti" })];
esit(atamaDurumu(atama, gecti2025, { tekrarAy: 24 }, BUGUN).durum, "tamam", "24 ay tekrar: hâlâ geçerli");
esit(atamaDurumu(atama, gecti2025, { tekrarAy: 12 }, BUGUN).durum, "suresiDoldu", "12 ay tekrar: süresi dolmuş");
esit(
  atamaDurumu(atama, [oturum({ bitis: "2025-09-01T09:00:00Z", sonuc: "gecti" })], { tekrarAy: 12 }, BUGUN).durum,
  "suresiDoluyor",
  "bitişe 30 günden az kaldıysa 'süresi doluyor'",
);

// ── tarih aritmetiği (ay sonu tuzağı) ───────────────────────────────────────
esit(gunEkle("2026-02-27", 3), "2026-03-02", "gün ekleme ay sınırını aşar");
esit(ayEkle("2026-01-31", 1), "2026-03-03", "31 Ocak + 1 ay taşar (JS davranışı, bilinçli)");
esit(gunFarki("2026-08-10", "2026-08-06"), 4, "gün farkı");
esit(gunFarki("2026-08-01", "2026-08-06"), -5, "geçmiş tarih negatif");

bitir("kurallar");
