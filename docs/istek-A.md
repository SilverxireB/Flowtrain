# Hat A — çekirdekten / diğer hatlardan istekler

S2–S4 kapsamı editör tarafında bitti. Aşağıdakiler **benim dosyalarımın dışında**
kaldığı için yapılmadı. Sıra önem sırasına göre.

---

## 1. Kiosk kartı çoklu görseli çizmiyor — **Hat D**

**Dosya:** `src/components/oyun/Kart.tsx`

Editör artık kart başına birden çok görsel tutuyor (`Sayfa.gorselIdler`,
sıralanabilir, tek tek silinebilir). `Kart.tsx` ise hâlâ yalnız tekil
`sayfa.gorselId`'yi çiziyor.

Kaçağı önlemek için editör **her yazımda ikisini birden** güncelliyor:
`gorselId` daima listenin ilkidir (`src/lib/editorMedya.ts` → `gorselYamasi`).
Yani bugün kioskta **kapak görseli** doğru görünüyor, diğerleri görünmüyor.

Canlı önizleme `Kart.tsx`i **ithal ediyor** (kopyalamıyor), dolayısıyla
önizleme de yalnız kapağı gösteriyor — yani yalan söylemiyor, ama hazırlayan
eklediği ikinci görseli hiçbir yerde göremiyor.

**İstenen:** `Kart.tsx` görselleri `kartGorselleri(sayfa)` ile okusun
(`@/lib/editorMedya`, saf fonksiyon, sunucu bağımlılığı yok) ve hepsini
çizsin. Tek görselde bugünkü görünüm birebir korunmalı; ikiden fazlasında
ızgara/yığın kararı Hat D'nin.

```ts
import { kartGorselleri } from "@/lib/editorMedya";
const gorseller = kartGorselleri(sayfa); // tekil alan geriye dönük korunur
```

## 2. Soru görseli sınavda çizilmiyor — **Hat D**

**Dosya:** `src/components/oyun/EgitimOyun.tsx` (sınav aşaması)

`Soru.gorselId` alanı çekirdekte var, editörde artık **doldurulabiliyor**
("Soru görseli ekle"), ama oynatıcının sınav ekranı yalnız `soru.metin` ve
şıkları çiziyor. "Bu fotoğraftaki hangi davranış yanlış?" sorusu bugün
kioskta görselsiz çıkıyor.

Aynı ekranda `Soru.aciklama` da var (yanlış cevaplayana gösterilecek
açıklama, S2'de Hat D'ye yazılmıştı) — editör onu da dolduruyor.

## 3. Kart silinince medya dosyası diskte kalıyor — **çekirdek**

**Dosya:** `src/lib/depo.ts`

`sayfaSil` / `soruSil` / `egitimSil` yalnız satırı siliyor; `data/medya/`
altındaki dosya kalıyor ve kütüphanede kullanımı `0` görünen bir kayda
dönüşüyor. Editörden tek tek silinebiliyor ama kimse temizlemez.

**İstenen (biri yeterli):**
- `depo.oksuzMedyalar(): string[]` — hiçbir kartta/soruda geçmeyen medya
  kimlikleri; ayarlar ekranından toplu temizlik yapılabilir, ya da
- silme işlemlerinin içinde referans düşünce dosyayı da kaldıran bir kanca.

Dosya silmeyi kendi eylem dosyamda yapıyorum (`medyaSilEylem`), o yüzden
çekirdekten yalnız **listeye** ihtiyacım var, silme koduna değil.

## 4. `medyaKullanimi` N+1 sorgu üretiyor — **çekirdek** (düşük öncelik)

Editör sayfası kütüphanedeki her medya için ayrı bir `medyaKullanimi(id)`
çağırıyor. Bugünkü hacimde (yerel SQLite, birkaç yüz görsel) sorun değil;
kütüphane binlere çıkarsa `medyaKullanimlariGetir(): Record<string, number>`
gibi tek sorguluk bir karşılık iyi olur.

## 5. Kategori normalizasyonu — **çekirdek / Hat B** (düşük öncelik)

`kategori` serbest metin ve editörde mevcutlar `datalist` ile öneriliyor, ama
"İSG" / "isg" / "İş Güvenliği" hâlâ üç ayrı kategori olabiliyor. Katalog
süzgeci Hat B'de; büyük/küçük harf duyarsız gruplama orada mı yoksa
`kategorileriGetir()` içinde mi olmalı, koordinatör karar versin.

---

## Notlar

- `npm test` bende **7/8**. Düşen tek doğrulama benim değil:
  `sinir.test.mjs` → `✗ dış alan adı geçen dosya: src/lib/qr.ts` (Hat B).
  "Kapalı ağ" kuralı gereği o dosyadaki dış alan adı kaldırılmalı.
- `npx tsc --noEmit` temiz.
- **Yeni npm paketi eklenmedi.** Ölçekli önizleme, medya seçici ve kontrol
  listesi dış bağımlılık olmadan yazıldı.
