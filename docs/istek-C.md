# Hat C — çekirdekten istekler

Hat C (kayıt defteri · raporlama · sertifika) paylaşılan dosyalara dokunmadı.
Aşağıdakiler paylaşılan dosyalarda yapılması gereken küçük eklemeler; hiçbiri
Hat C'nin bugünkü işini bloklamadı, hepsinin karşılığı geçici bir yolla çözüldü.

## 1. Hub kartı — `src/app/page.tsx`

`/kayitlar` yüzeyi açıldı ama hub'da kartı yok; bugün yalnız Pano'nun başlık
şeridinden erişiliyor. `YUZEYLER` dizisine şu satır girmeli (Pano'nun hemen
altına):

```ts
{ yol: "/kayitlar", ad: "Kayıt defteri", not: "Tüm tamamlamalar, CSV/PDF, sertifika", ikon: "receipt", enAz: "hazirlayan" },
```

**Neden önemli:** kayıt defteri denetimde en çok açılan ekran olacak. Panonun
içine gömülü bir bağlantı, "ürünün asıl çıktısı" olan yüzeyi ikinci sınıf
gösteriyor.

*Geçici çözüm:* Pano başlığında "Kayıt defteri" düğmesi var.

## 2. Rehber bölümü — `src/components/rehber/trainIcerik.tsx`

Rehberin "takip" bölümü bugün yalnız panodan ve `kayitlar.csv`ten bahsediyor.
Üç yeni davranışın rehberde karşılığı yok:

- kayıt defterinin **düzenlenmez/silinmez** kuralı ve düzeltme yolu (yeni kayıt + not),
- sınıf eğitimi toplu kaydı (`/kayitlar/sinif`),
- geçmiş kayıt aktarımı (`/kayitlar/aktarim`) ve **canlıya geçişte ilk yapılacak iş** olduğu.

*Geçici çözüm:* üç ekranın kendi içinde açıklama metni var; yeni sayfalar
`rehberBolum="takip"` ile mevcut bölümü açıyor.

## 3. Depoda mükerrer kontrolü — `src/lib/depo.ts` (isteğe bağlı, ölçek işi)

`oturumKaydet` aynı kişi + eğitim + gün için ikinci bir kaydı yazmayı
engellemiyor. Bugün mükerrer denetimi **uygulama katmanında** yapılıyor
(`src/lib/kayitAktarim.ts` → `mevcutAnahtarlar`), yani iki hazırlayan aynı anda
aynı listeyi kaydederse ikisi de geçer.

İstenen: `oturum` tablosuna `sonuc <> 'iptal'` koşullu tekil dizin ya da
`oturumKaydet`e isteğe bağlı `mukerrerEngelle: true` bayrağı.

**Neden ertelenebilir:** kapalı ağda aynı anda iki hazırlayanın aynı sınıf
listesini girmesi gerçekçi değil; mükerrer kayıt veri kaybı değil, gürültü.

## 4. `Oturum.duzeltir?: string` — `src/lib/tipler.ts` + `depo.ts` (v1.5)

Yanlış kaydın düzeltmesi bugün yeni bir kayıt + serbest metin not olarak
giriliyor. İki satırın **bağı** yok: denetçi "hangi kaydı düzeltiyor" sorusunu
nottaki cümleden okuyor.

İstenen: `Oturum.duzeltir` (düzeltilen oturumun kimliği). Defter o satırı
"düzeltildi" olarak işaretler, ama **hiçbir satır silinmez** — ikisi de durur.

**Neden şimdi değil:** alan çekirdek tipe girer, dört hattı da ilgilendirir; not
alanı bugünkü ihtiyacı karşılıyor.

## 5. `senkron` yeniden gönderim düğmesi — `src/app/ayarlar/**` (Hat yok)

Pano "N kayıt gönderilemedi" diyor ve "Ayarlar'dan yeniden gönderebilirsiniz"
yazıyor; Ayarlar'da böyle bir düğme **yok**. Sınıf ve aktarım kayıtları da dış
hedefe gönderildiği için bu boşluk artık daha görünür.

Ayarlar hangi hattın olduğu yol haritasında yazmıyor — sahipsiz.

---

# İkinci dalga (S9 — yük denemesi ve sertleştirme)

Yukarıdaki beş madde birinci dalgadan kalanlar; aşağıdakiler yük denemesinin
ortaya çıkardıkları. **6 ve 7 numaralı maddeler çekirdekte ve kabul ölçütünü
AŞAN tek yolun sebebi** — Hat C ikisine de dokunmadı, ölçüp belgeledi.

Ölçüm: `node scripts/yuk.mjs` (geçici veri klasörü kurar, `data/`ye dokunmaz).
Hacim: **1000 kişi · 60 eğitim · 40 kural · 20 000 oturum · 8586 atama.**
Kabul ölçütü: kiosk 1 sn (işçi ayakta bekliyor), kokpit 3 sn.

Aşağıdaki süreler **yüklü bir makinede** ölçüldü (dört hat aynı anda
çalışıyordu); boştaki makinede aynı yollar 2-3 kat hızlıydı. Yani sayılar
iyimser değil, ÜST SINIR. Oranlar ve ölçek eğrisi her iki koşuda da aynı.

## 6. `atamalariCikar()` kareli büyüyor — `src/lib/kurallar.ts` (ACİL)

`kurallar.ts:90` — `atamalariCikar` her yeni atama için **çıktının tamamını
baştan tarıyor**:

```ts
const mevcut = cikti.find((c) => `${c.sicil}|${c.egitimId}` === anahtar);
```

Dizide arama + her elemanda şablon dize kurma. Atama sayısı büyüdükçe maliyet
kareli artıyor ve bu donanımla kapatılamaz:

| Kişi | Atama | Süre | Bir öncekine oranı |
|---|---|---|---|
| 125 | 1 078 | 128 ms | — |
| 250 | 2 149 | 424 ms | 3,3× |
| 500 | 4 297 | 1,78 sn | 4,2× |
| 1000 | 8 586 | **6,78 – 15,0 sn** | 3,8× |

Kişi ikiye katlanınca süre **dörde** katlanıyor — tanım gereği O(n²).

**İstenen:** `cikti.find(...)` yerine `Map<anahtar, atama>`. Mantık aynen
korunur (aynı eğitim iki kuraldan düşerse erken tarih geçerli).

**Karşılığı ölçüldü** (`scripts/yuk.mjs` içindeki prototip, `src/`ye
yazılmadı): **7,88 sn → 8 ms.** Yaklaşık 1000 kat.

## 7. `atamaDurumu()` atama başına tüm defteri tarıyor — `kurallar.ts` + `atamaServis.ts`

`kurallar.ts:124` her atama için oturum listesinin TAMAMINI süzüyor:

```ts
const kendi = oturumlar.filter((o) => o.sicil === atama.sicil && o.egitimId === atama.egitimId && o.bitis)
```

`atamaServis.ts:61,76` ise defterin tamamını (`depo.oturumlariGetir()`) bu
fonksiyona veriyor. 8586 atama × 20 000 oturum = **171 milyon karşılaştırma**,
ölçülen **5,07 sn**.

**İstenen:** oturumlar bir kez `sicil|egitimId` kovalarına ayrılsın ve
`atamaDurumu`ya yalnız ilgili kova verilsin. İki yerden biri yeter:
`atamaServis.ts` kovaları kursun (çağıran taraf, tek satırlık değişiklik) ya da
`atamaDurumu` bir `Map` kabul etsin.

**Karşılığı ölçüldü:** **5,07 sn → 18 ms** (kovalama dahil). Yaklaşık 280 kat.

**6 ve 7 birlikte:** `tumAtamalar()` bugün **10,76 sn** (ölçüt 3 sn — AŞILDI).
İkisi düzeltilince ölçülen parçaların toplamı **~100 ms**e iniyor. Bu tek
fonksiyon `/pano`nun, `/api/disa-aktar`ın ve katalog sayısılarının temeli;
düzeltilmeden 1000 kişilik bir kurulumda pano açılmaz.

`/ekibim` (181 ms) ve kiosk (15 ms) ölçütleri KARŞILIYOR — ekip ve kişi
küçük olduğu için kareli maliyet oralarda görünmüyor. Yani hata yalnız
fabrika ölçeğinde ortaya çıkıyor; demo veride hiç görünmez.

## 8. Kurum adı ayarı — `src/app/ayarlar/**` (sahipsiz, madde 5 ile aynı yer)

Denetim uyumu için her dışa aktarımın künyesine kurum adı yazılıyor (CSV
başlığı, PDF başlığı ve her sayfanın altı, sertifikanın üstü). Değer
`depo.ayarOku("kurumAdi")` ile okunuyor ama **onu yazacak bir alan yok**;
bugün her belge `(kurum adı girilmemiş)` diyor.

İstenen: `/ayarlar`da tek satırlık bir metin kutusu → `ayarYaz("kurumAdi", …)`.
Kurulum sihirbazında sorulması daha da iyi olur — ilk belge basılmadan dolsun.

*Geçici çözüm:* boş kalınca belgede `(kurum adı girilmemiş)` yazıyor. Boş
bırakmak yerine bunu yazmak bilinçli: denetçi eksiği görsün, belgeyi bizim
kırptığımızı sanmasın.

## 9. Madde 3 ve 4 hakkında — durum değişti

**Madde 3 (mükerrer kontrolü)** hâlâ çekirdekte, ama artık bir nüansı var:
düzeltme kaydı akışı mükerrer denetimini BİLEREK aşıyor
(`kayitAktarim.ts` · `SinifSecenegi.mukerrerIzni`). Depoya tekil dizin
eklenirse **`sonuc <> 'iptal'` koşullu bile olsa aynı gün için ikinci kaydı
engelleyecek** ve düzeltme akışını kırar. Dizin yerine `oturumKaydet`e
isteğe bağlı `mukerrerEngelle: true` bayrağı tercih edilmeli — karar çağırana
kalsın.

**Madde 4 (`Oturum.duzeltir`)** için Hat C geçici bir köprü kurdu: düzeltme
kaydının notu `Düzeltme: <belgeNo> numaralı kaydın yerine geçer.` önekiyle
başlıyor ve `rapor.ts` · `duzeltmeHaritasi()` bu öneki ayrıştırarak defterde
iki satırı da işaretliyor (`düzeltildi` / `düzeltme kaydı`). Alan çekirdeğe
eklenince **ayrıştırma tek yerden silinir** — `rapor.ts`teki `DUZELTME_ONEKI`,
`duzeltilenBelgeNo` ve `duzeltmeHaritasi` yerine alan okunur. Ekranların
geri kalanı değişmez.

## 10. Ölçütü karşılayan ama sınırı bilinen yollar (bilgi, istek değil)

Bunlar için bir şey istenmiyor; sınırın nerede olduğu kayda geçsin diye.

- **Kayıt defterinin istemciye inen yükü:** 20 000 kayıt = 6,5 MB ham, ancak
  **gzip sonrası 0,37 MB** — süzgeç istemcide kaldığı için her tuşta anında
  çalışıyor (19 ms) ve mimariyi değiştirmeye gerek yok. 100 bin kayıtta
  (≈on yıllık defter) 32,5 MB ham / 1,9 MB tel üstünde; asıl sınır orada,
  bugünkü hacmin beş katında.
- **Tüm defterin PDF dökümü:** 477 sayfa / 2,63 sn. Ekran 2000 satırın
  üstünde uyarıp CSV'ye yönlendiriyor; uyarı sınırının altında 48 sayfa /
  291 ms.
- **Toplu sertifika (200 kişi):** 116 ms / 200 sayfa. Ekrandaki 200 sınırı
  başarım için değil, okunurluk için — sorun çıkarmıyor.

---

## Hat D'ye: sınavlanması gereken saf fonksiyonlar

Hat C saf mantığı ekranlardan ayırdı; hiçbiri veritabanına ya da `server-only`e
dokunmuyor, `--experimental-strip-types` ile doğrudan içe aktarılabilir.

**`src/lib/rapor.ts`** — önerilen dosya: `tests/rapor.test.mjs`
- `kayitlariSuz` — her süzgeç alanı tek tek + birleşik; boş alan "sınırlama yok"
  demek; tarih aralığı **kapalı** aralık (uç günler dahil); Türkçe arama
  (`"ısparta"` → `"İSPARTA"`).
- `kayitGunu` — bitiş yoksa başlangıca düşer (yarım oturum tarih süzgecinden
  kaybolmamalı).
- `sayfala` — sınır dışı sayfa numarası geri çekilir, boş listede `sonSayfa === 1`.
- `kirilimCikar` — oran yuvarlaması, sıralama (çok açık olan üstte).
- `ayKaydir` — yıl sınırı (`2026-01` → `-1` → `2025-12`, `+13` ileri).
- `aylikTrend` — **boş aylar da dönmeli** (grafiğin boşluğu bilgidir), yalnız
  kapanmış ve geçti/kaldı olan oturumlar sayılır (iptal ve açık sayılmaz).

**`src/lib/kayitAktarim.ts`** — önerilen dosya: `tests/aktarim.test.mjs`
- `tarihiCoz` — `12.03.2024`, `2024-03-12`, `12/03/2024` aynı güne; `03.15.2024`
  ve `abc` null; **gün/ay sırası korunur** (`03.05` ≠ `05.03`).
- `sutunBul` / `sutunlariEsle` — `"Registry Number"`, `"SİCİL NO"`, `"sicil_no"`
  hepsi sicil sütununu bulur; `"not"` sütunu puana değil nota gider.
- `aktarimiCoz` — zorunlu sütun eksikse hiç satır okunmaz; tanınmayan sicil,
  eşleşmeyen eğitim adı, aynı adda iki eğitim, okunamayan tarih, **dosya içi**
  mükerrer ve **defterde zaten var olan** mükerrer ayrı sebeplerle atlanır;
  taslak eğitim atlanmaz, uyarı alır; okunamayan puan satırı düşürmez.
  **Hiçbir satır sessizce düşmemeli** — `satirlar.length` girdi satır sayısına eşit.
- `sinifListesiniCoz` — `"10109369 Ahmet Yılmaz"` satırından sicil ayrışır; boş
  satırlar atlanır; aynı sicil listede iki kez varsa ikincisi mükerrer sayılır.

**İkinci dalgada eklenen saf fonksiyonlar** (aynı dosyalara yazılabilir):

`src/lib/rapor.ts` — denetim künyesi ve düzeltme bağı
- `kurumAdiMetni` — boş/boşluklu ad `(kurum adı girilmemiş)` olur, dolu ad
  aynen geçer.
- `damgaMetni` — yerel saatle `YYYY-AA-GG SS:DD`, tek haneler sıfırla dolar.
- `kunyeliCsv` — **BOM dosyanın EN BAŞINDA kalmalı** (ortada kalırsa Türkçe
  Excel kodlamayı yine yanlış okur); künye satırları tablodan ÖNCE gelir;
  içinde `;` ya da tırnak geçen süzgeç özeti kaçırılır.
- `duzeltmeNotu` / `duzeltilenBelgeNo` — gidiş-dönüş: üretilen nottan belge
  numarası geri okunabilmeli; düzeltme olmayan not `undefined` vermeli.
- `duzeltmeHaritasi` — iki yön de dolmalı; kendi kendini düzelten kayıt
  (`id === duzeltilen`) elenmeli; bir kaydı düzelten birden çok satır olabilir.

`src/lib/kayitAktarim.ts` — `sinifListesiniCoz` yeni seçeneği
- `mukerrerIzni: true` **defterdeki** mükerreri geçer ama **aynı listede** iki
  kez yazılan sicili yine atlar (ikisi farklı şey).
- Seçenek verilmezse davranış birebir eskisi gibi kalmalı.

**Ekran sınavı (`tests/uctan-uca.mjs`):** üç yeni yüzey en az bir kez AÇILMALI —
`/kayitlar`, `/kayitlar/sinif`, `/kayitlar/aktarim`. KAPSAM'daki gerekçe aynen
geçerli: rehberi çökerten geçici-ölü-bölge hatasını ancak ekranı gerçekten açan
bir adım gördü.
