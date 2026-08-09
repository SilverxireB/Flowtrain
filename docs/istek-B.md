# Hat B → Çekirdek istekleri

Katalog · eğitim paketleri · atama · QR hattının paylaşılan dosyalardan
ihtiyaç duyduğu değişiklikler. Hiçbiri hattı bloklamadı; her maddede
"bugün ne yapıldı" yazılı.

> **2. dalga (OPM adaptör iskeleti)** maddeleri 6–8'de. Eskiler olduğu gibi
> duruyor.

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

---

## 6. Salt okunur kaynakta `/personel` ekranı BOŞ görünüyor — **öncelikli**

**Dosya:** `src/app/personel/page.tsx` (Hat B'nin değil).

```ts
const kisiler = kaynak.yonetim?.kayitlar() ?? [];
```

Ekran listeyi **yönetim yeteneğinden** okuyor. OPM adaptöründe `yonetim`
bilerek `undefined` (tek yönlü okuma, bkz. `docs/OPM-ENTEGRASYON.md` §6) —
yani ekran "salt okunur" olmuyor, **bomboş** oluyor. Yönetici personelini hiç
göremiyor, MM eşlemesini de kime uyguladığını göremiyor.

**İstenen.** Liste düzenlenemez kaynakta da `PersonelKaynagi.listele()`ten
gelsin; `duzenlenebilir` bayrağı zaten var:

```ts
const kaynak = personelKaynagi();
const kayitlar = kaynak.yonetim?.kayitlar();
const kisiler = kayitlar ?? (await kaynak.listele()).map(/* Kisi → PersonelKaydi */);
```

`Kisi` → `PersonelKaydi` çevirisi kayıpsız değil (`maliyetMerkezi` `Kisi`de
yok). İki seçenek: (a) `Personel` bileşeni `Kisi` de kabul etsin, (b)
`PersonelKaynagi`ye opsiyonel `kayitlar?(): PersonelKaydi[]` eklensin.
**(b) tercih edilir** ve `adaptor.ts`i bozmadan genişletir.

**Bugün ne yapıldı.** Hiçbir şey — ekran Hat B'nin değil. Varsayılan CSV
olduğu için bugün kimse etkilenmiyor; OPM devreye alınmadan önce kapatılmalı.

---

## 7. `senkronTekrarEylem` hatanın SEBEBİNİ göstermiyor

**Dosya:** `src/app/eylemler.ts` (paylaşılan, dokunulmadı).

`kaydiGonder(o)` yalnız `true/false` döndürüyor; yönetici "3 kayıt
gönderilemedi" görüyor ama **neden** gönderilemediğini göremiyor (adres yanlış
mı, anahtar mı süresi mi doldu, servis mi kapalı).

**Bugün ne yapıldı.** `adaptorlar/index.ts` son hatayı saklıyor:
`sonKayitGonderimHatasi(): { zaman, mesaj } | null`. `/ayarlar` bunu yazıyor.
İstenen: `senkronTekrarEylem` bittiğinde denetim izine de sebebi düşsün —

```ts
const h = sonKayitGonderimHatasi();
depo.izBirak(ben.kullanici, `senkron tekrar: ${basarili} gönderildi${h ? ` · son hata: ${h.mesaj}` : ""}`);
```

Tek satır; imza değişmiyor.

---

## 8. (Bilgi) OPM adaptörünün çekirdekten beklentisi: YOK

İskelet, paylaşılan hiçbir dosyayı değiştirmeden tamamlandı.

- `adaptor.ts` arayüzleri **bozulmadı, genişletilmedi** — OPM ikisini de olduğu
  gibi uyguluyor (`yonetim` bilerek boş).
- Yeni tablo gerekmedi: yapılandırma `ayar` tablosunda (`opm*` anahtarları,
  `docs/OPM-ENTEGRASYON.md` §5).
- Yeni npm paketi yok: Node'un yerleşik `fetch`i + `AbortSignal.timeout`.
- Çekirdek tiplere OPM'e özel tek alan girmedi.

Değişen tek paylaşılan davranış: `kaydiGonder` artık son hatanın metnini
saklıyor (§7). İmzası aynı (`Promise<boolean>`).
