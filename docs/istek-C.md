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

**Ekran sınavı (`tests/uctan-uca.mjs`):** üç yeni yüzey en az bir kez AÇILMALI —
`/kayitlar`, `/kayitlar/sinif`, `/kayitlar/aktarim`. KAPSAM'daki gerekçe aynen
geçerli: rehberi çökerten geçici-ölü-bölge hatasını ancak ekranı gerçekten açan
bir adım gördü.
