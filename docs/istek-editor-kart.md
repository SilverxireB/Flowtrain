# Hat "editör — kart tarafı" — diğer hatlardan istekler

Beş yeni kart tipi ve `bicimMetin.ts` biçim dili editörde yazılabilir hâle
getirildi. Aşağıdakiler **benim dosyalarımın dışında** kaldığı için yapılmadı.

Benim dosyalarım: `src/components/editor/SayfaSatiri.tsx`, `OtoMetin.tsx`,
`MedyaSecici.tsx`, `CanliOnizleme.tsx`, `BicimAraclari.tsx` (yeni),
`KartAlanlari.tsx` (yeni), `KartTipiMenusu.tsx` (yeni).

---

## 1. GRUPLU KART EKLEME MENÜSÜ BAĞLANMALI — **kabuk hattı** (en önemli)

**Dosya:** `src/app/egitimler/[id]/Editor.tsx` (bugün ~407-413. satırlar)

Kart tipi 5'ten 10'a çıktı. Editör bugün **her tip için bir düğme** çiziyor:

```tsx
<div className="mt-4 flex flex-wrap gap-2">
  {(Object.keys(KART_ETIKET) as KartTipi[]).map((t) => (
    <button key={t} disabled={kilitli} onClick={() => calistir(() => sayfaEkleEylem(egitim.id, t))} className="btn-ghost text-sm">
      <Icon name="plus" size={16} /> {KART_ETIKET[t]}
    </button>
  ))}
</div>
```

On düğmelik bir şerit, hazırlayanın okumadan ilk düğmeye basmasıyla sonuçlanır
("Kural kartı" zaten ilk sırada) — yani beş yeni tip hiç kullanılmaz.

**Hazır bileşen:** `src/components/editor/KartTipiMenusu.tsx` → `KartEkleMenusu`.
Tek düğme + niyete göre gruplanmış panel (Anlatım · Uyarı · Karşılaştırma ·
Kontrol · Medya). Etiket ve açıklamalar `KART_ETIKET` / `KART_ACIKLAMA`dan
geliyor; gruba yazılmamış bir tip "Diğer" başlığında kendiliğinden beliriyor,
yani on birinci tip eklendiğinde kimse bu listeyi güncellemek zorunda değil.

**İstenen değişiklik (yukarıdaki bloğun tamamı yerine):**

```tsx
import { KartEkleMenusu } from "@/components/editor/KartTipiMenusu";

<div className="mt-4">
  <KartEkleMenusu kilitli={kilitli} onEkle={(t) => calistir(() => sayfaEkleEylem(egitim.id, t))} />
</div>
```

`KART_ETIKET` / `KartTipi` ithalleri Editor.tsx'te başka yerde de kullanılıyor
(`sayfaSil` onay metni), kaldırmayın.

Aynı panel bugün **satır başlığındaki tip rozetinde** koşuyor (kart tipini
değiştirme), yani gruplama zaten üründe canlı — eksik olan yalnız ekleme yolu.

---

## 2. `Kart.tsx` beş yeni tipi henüz çizmiyor — **oynatıcı hattı** (bilgi)

**Dosya:** `src/components/oyun/Kart.tsx`

Bugün `kontrolListesi · karsilastirma · vaka · onceSonra · sayiVurgu`
tiplerinin hiçbiri ele alınmıyor; hepsi son `return` (kural kartı) düzenine
düşüyor. Canlı önizleme kiosk kartının **kendisini** ithal ettiği için editörde
de o düzen görünüyor.

Bu bir engel değil, haber: siz yeni tipleri çizdiğinizde önizleme kendiliğinden
doğrulanır. Editör tarafında veri hazır — `lib/kartVeri.ts` yardımcılarını
(`kontrolMaddeleri`, `karsilastirmaTablosu`, `sayiVurgulari`, `onceSonra`)
olduğu gibi kullanabilirsiniz; editördeki yer tutucular ve karşılaştırma mini
tablosu tam o dile göre yazıldı.

Önizleme tarafında iki şey değişti, sizi ilgilendirebilir:

- Kart `key`i artık `${sayfa.id}:${sayfa.tip}`. Tip değiştirilebilir oldu;
  kimlik aynı kaldığı için videodan başka tipe geçince `<video>` öğesi ağaçta
  kalıp arka planda çalmaya devam ediyordu.
- Önizlemenin yüksekliği `min(70vh, 40rem)` ile sınırlı ve aşınca kendi içinde
  kaydırılıyor (uzun kontrol listesi yapışkan yan sütunu pencereden taşırıyordu).

---

## 3. `bicimMetin.ts` / `kartVeri.ts` sınav dosyaları yok — **çekirdek** (küçük)

İki dosyanın başlığı `node tests/bicim.test.mjs` ve `node tests/kartVeri.test.mjs`
diyor; `tests/` altında ikisi de yok ve `npm test` 18 dosya koşuyor.

`tests/**` benim dosyalarım değil, dokunmadım. Biçim şeridinin ürettiği metni
(`bicimUygula`) elde doğruladım — 17 durum: kalın sarma/çıkarma, seçim içinde
ve dışında yıldız, madde ↔ sıra dönüşümü, ikinci basışta önek kaldırma,
numaralandırmanın boş satırı atlaması, imleç yeri. Bu doğrulama **kalıcı
değil**; şerit `bicimMetin.ts`in kabul ettiği dilin dışına çıkarsa hiçbir sınav
yakalamaz.

---

## 4. `Sayfa.metinKarsi` yorumu güncellenmeli — **çekirdek** (kozmetik)

**Dosya:** `src/lib/tipler.ts`

```ts
/** yapYapma kartında sağ kolon; diğerlerinde kullanılmaz. */
metinKarsi?: string
```

Artık `vaka` (çıkan ders) ve `onceSonra` (sonra alt yazısı) da bu alanı
kullanıyor — `kartVeri.ts` böyle tanımlıyor. Yorum yanıltıyor.
