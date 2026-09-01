/**
 * AKTİF SÜZGEÇ ÇİPLERİ — panel kapalıyken neyin süzüldüğünü söyleyen satır.
 *
 * NEDEN VAR: Flow süzgeç dilinde panel kapalı başlar ve uygulanınca kendini
 * toplar. O tasarımın bedeli şu: kapalı panel neyin seçildiğini gizler.
 * Kullanıcı kısalmış listeye bakıp "kayıtlar nerede" diye takılıyor ve
 * süzgecin açık olduğunu ancak paneli tekrar açınca anlıyor. Çipler o
 * bedeli ödüyor — durum HER ZAMAN ekranda.
 *
 * ÇİP EYLEM DE TAŞIR: her birinin `temizle` yaması var, yani tek süzgeci
 * gevşetmek için panele dönmek gerekmiyor.
 *
 * SAF: hangi çiplerin çıkacağı bir GÖRÜNÜM kararı değil, süzgecin
 * okunmasıdır. Burada durunca ay sonu, boş değer ve yarım tarih aralığı
 * gibi durumlar sınavla ölçülebiliyor.
 *
 * Sınav: `node tests/suzgec-cipleri.test.mjs`
 */
import type { KayitSuzgeci } from "./rapor";

export interface SuzgecCipi {
  /** Tekil anahtar — liste çizimi için. */
  anahtar: string;
  /** Alan adı, sakin tonda ("Bölüm"). */
  alan: string;
  /** Değerin okunur hâli ("Montaj"). */
  deger: string;
  /** Bu çipi kaldıran yama. */
  temizle: Partial<KayitSuzgeci>;
}

/** Tarih aralığını insan diline çevirir. */
function aralikMetni(bas: string, bit: string): string {
  if (bas && bit) return bas === bit ? bas : `${bas} – ${bit}`;
  /* YARIM ARALIK GEÇERLİ BİR SÜZGEÇTİR: yalnız başlangıç verilmişse
     "şu tarihten beri" demektir ve çip bunu söylemeli. Boş bırakmak
     kullanıcıya "tarih süzgeci yok" dedirtirdi. */
  if (bas) return `${bas} sonrası`;
  return `${bit} öncesi`;
}

/**
 * Süzgeçten çip listesi çıkarır.
 *
 * `etiketler` dışarıdan geliyor çünkü eğitim adı ve kaynak etiketi VERİDİR;
 * bu modülün onları bilmesi, saf mantığa ekran sözlüğü sızdırmak olurdu.
 * Bulunamayan kimlik için kimliğin kendisi yazılır — sessizce boş çip
 * çizmektense ham değeri göstermek dürüst.
 */
export function suzgecCipleri(
  s: KayitSuzgeci,
  etiketler: { egitimAdi?: (id: string) => string | undefined; kaynakAdi?: (k: string) => string | undefined } = {},
): SuzgecCipi[] {
  const cipler: SuzgecCipi[] = [];

  if (s.sorgu.trim()) {
    cipler.push({ anahtar: "sorgu", alan: "Ara", deger: s.sorgu.trim(), temizle: { sorgu: "" } });
  }
  if (s.egitimId) {
    cipler.push({
      anahtar: "egitim",
      alan: "Eğitim",
      deger: etiketler.egitimAdi?.(s.egitimId) ?? s.egitimId,
      temizle: { egitimId: "" },
    });
  }
  if (s.bolum) {
    cipler.push({ anahtar: "bolum", alan: "Bölüm", deger: s.bolum, temizle: { bolum: "" } });
  }
  if (s.kaynak) {
    cipler.push({
      anahtar: "kaynak",
      alan: "Kaynak",
      deger: etiketler.kaynakAdi?.(s.kaynak) ?? s.kaynak,
      temizle: { kaynak: "" },
    });
  }
  if (s.sonuc) {
    cipler.push({ anahtar: "sonuc", alan: "Sonuç", deger: s.sonuc, temizle: { sonuc: "" } });
  }
  /* Tarih TEK ÇİP: başlangıç ve bitiş ayrı çiplere bölünseydi ikisini de
     tek tek kaldırmak gerekirdi, oysa kullanıcının kafasındaki şey tek bir
     "aralık". Kaldırma da ikisini birden siler. */
  if (s.baslangicGun || s.bitisGun) {
    cipler.push({
      anahtar: "tarih",
      alan: "Tarih",
      deger: aralikMetni(s.baslangicGun, s.bitisGun),
      temizle: { baslangicGun: "", bitisGun: "" },
    });
  }

  return cipler;
}
