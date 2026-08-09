# Hat B → Çekirdek istekleri

Katalog · eğitim paketleri · atama · QR hattının paylaşılan dosyalardan
ihtiyaç duyduğu değişiklikler. Hiçbiri hattı bloklamadı; her maddede
"bugün ne yapıldı" yazılı.

---

## 1. `kural.egitimId` paket kuralında NULL olabilmeli — **öncelikli**

**Dosya:** `src/lib/db.ts` (şema + göç), `src/lib/tipler.ts` (`Kural.egitimId`),
`src/lib/depo.ts` (`kuralEkle`).

**Sorun.** Şemada sütun `NOT NULL REFERENCES egitim(id) ON DELETE CASCADE`.
Pakete yazılan kuralda mantıken tek bir eğitim yok — `depo.kurallariCozulmus()`
zaten saklanan değeri **yok sayıp** kuralı paketin üyelerine açıyor. Ama:

- `egitimId = ''` → `FOREIGN KEY constraint failed` (doğrulandı, `PRAGMA
  foreign_keys = ON` etkin),
- `egitimId = NULL` → `NOT NULL constraint failed`.

Yani **paket kuralı olduğu gibi saklanamıyor.**

**Bugün ne yapıldı.** Paket kuralı, paketin üyelerinden birine "çapalanıyor":
`egitimId` bir üye eğitimin kimliğini taşıyor, hiçbir yerde okunmuyor, yalnız
kısıtı memnun ediyor. Mantık tek dosyada toplandı: `src/lib/paketKural.ts`.
Üyeler değişince çapa mevcut bir üyeye taşınıyor, paket silinince kuralları da
siliniyor.

**Kalan açık (kabul edildi, kapatılamadı).** `ON DELETE CASCADE` yüzünden
**çapa olarak seçilen eğitim silinirse paket kuralı da sessizce silinir.**
Uygulama tarafında onarılamaz — silinen satır zaten yok.

**İstenen.**

```sql
-- kural tablosu yeniden kurulurken:
egitimId TEXT REFERENCES egitim(id) ON DELETE CASCADE   -- NOT NULL kalkar
CHECK (egitimId IS NOT NULL OR grupId IS NOT NULL)      -- ikisinden biri dolu
```

ve `tipler.ts` içinde `Kural.egitimId?: string`, `depo.kuralEkle`'nin
`egitimId ?? null` yazması. Bu geldiğinde `src/lib/paketKural.ts` **silinir**;
`src/app/atama/eylemler.ts` içindeki tek `paketCapasi()` çağrısı kalkar. Başka
hiçbir yer etkilenmez.

---

## 2. Hub'da `/gruplar` kartı yok

**Dosya:** `src/app/page.tsx` (paylaşılan, dokunulmadı).

`YUZEYLER` listesine eklenmesi istenen satır:

```ts
{ yol: "/gruplar", ad: "Eğitim paketleri", not: "Birlikte verilen eğitimler tek adla", ikon: "folder", enAz: "hazirlayan" },
```

**Bugün ne yapıldı.** Yüzeye `/egitimler` ve `/atama` başlıklarından bağlantı
kondu; `/gruplar` başlığından da `/atama`ya dönülüyor. Hub'dan doğrudan
erişilemiyor.

---

## 3. `temelAdres` ayarı için Ayarlar'da bir alan yok

**Dosya:** `src/app/ayarlar/**` (Hat B'nin değil).

QR etiketleri `depo.ayarOku("temelAdres")` okuyor — kurulumun dışarıdan
görünen adresi (ör. `http://10.20.0.5:3000`). Ayar boşsa etiket **göreli yol**
taşır ve telefon kamerası onu açamaz.

`depo.ayarYaz("temelAdres", …)` zaten var; eksik olan yalnız Ayarlar
sayfasındaki giriş alanı.

**Bugün ne yapıldı.** `/egitimler/qr` sayfası ayar boşken kırmızı uyarı
gösteriyor ve anahtarın adını yazıyor. Değer elle veritabanına yazılabiliyor
ama arayüzden girilemiyor.

---

## 4. `Rehber` içeriğinde paket ve QR bölümü yok

**Dosya:** `src/components/rehber/trainIcerik.tsx` (Hat B'nin değil).

`/gruplar` `rehberBolum="atama"`, `/egitimler/qr` ise `"hazirlama"` bölümünü
açıyor; ikisinin de metni henüz paketlerden ve QR etiketlerinden söz etmiyor.
Yeni bölüm anahtarı gerekmez, mevcut iki bölüme birer paragraf yeter.

---

## 5. (Bilgi) Hat D ile QR sözleşmesi

`src/lib/qr.ts` → `kioskBaglantisi(egitimId, temelAdres)` **`/kiosk?egitim=<id>`**
üretir. Şema değiştirilmeyecek. Kiosk tarafının bu parametreyi okuyup doğrudan
o eğitimi açması Hat D'de.

`qrMatris(metin) → boolean[][]` saf ve yan etkisiz; sınavı Hat D yazacak.
Doğrulama yöntemi `src/lib/qr.ts` başındaki yorumda maddeler hâlinde yazılı
(RS sendrom denetimi · matristen geri okuma · bilinen sabitler · yapısal
denetim).
