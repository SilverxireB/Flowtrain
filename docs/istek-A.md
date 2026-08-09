# Hat A — çekirdekten / diğer hatlardan istekler

İkinci dalga (PPTX içe aktarma, alt metin, başarım, öksüz medya) bitti.
Aşağıdakiler **benim dosyalarımın dışında** kaldığı için yapılmadı.

---

## 1. İÇE AKTARILAN GÖRSELLER MEDYA TABLOSUNDA YOK — **çekirdek** (en önemli)

**Dosya:** `src/lib/depo.ts`

PDF ve PPTX kapıları görselleri `kutuphane=hayir` ile yüklüyor (bilinçli:
kırk slaytlık bir sunum kütüphaneyi kırk tane `image7.png` ile doldurur ve
yeniden kullanılacak fotoğraf aralarında kaybolur). Sonuç: o dosyaların
`medya` tablosunda **satırı yok.** Bunun iki sessiz bedeli var:

**a) `oksuzMedyalar()` onları HİÇ göremiyor.** Liste `medyalariGetir()`
üzerinden kuruluyor; satırı olmayan dosya öksüz sayılmıyor. Yani kartı
silinen bir PDF sayfası `data/medya/` altında **sonsuza kadar** kalıyor —
tam da bu isteğin (birinci dalga, madde 3) çözmek istediği şey. Öksüz
temizliği bugün yalnız kütüphaneye elle yüklenmiş görselleri topluyor.

**b) `medyaAltMetinYaz()` hiçbir satırı güncellemiyor.** `UPDATE` olduğu için
satır yoksa sessizce kayboluyor; kullanıcı alt metni yazıyor, hiçbir şey
olmuyor. Bugün eylem dosyamda (`egitimler/[id]/eylemler.ts` →
`medyaAltMetinEylem`) dosyayı `stat`layıp boyut/tür türeterek `medyaKaydet`
ile satırı **ben açıyorum** — çalışıyor ama o görseli kütüphaneye de sokuyor.

**İstenen (biri yeterli):**

- `Medya.kutuphaneDisi: boolean` — içe aktarılan görsel KAYITLI olur ama
  `medyalariGetir()` (kütüphane listesi) onu göstermez. Öksüz taraması ve
  alt metin doğal olarak çalışır. Tercihim bu.
- ya da: diskteki dosyaları tarayıp hiçbir kayıtta/kartta geçmeyenleri
  döndüren `oksuzDosyalar(): string[]` + `medyaAltMetinYaz`ın upsert olması.

## 2. Kategori normalizasyonu — **çekirdek / Hat B** (düşük öncelik)

Birinci dalgadan devrediyor. `kategori` serbest metin ve editörde mevcutlar
`datalist` ile öneriliyor, ama "İSG" / "isg" / "İş Güvenliği" hâlâ üç ayrı
kategori olabiliyor. Büyük/küçük harf duyarsız gruplama katalog süzgecinde mi
(Hat B) yoksa `kategorileriGetir()` içinde mi olmalı, koordinatör karar versin.

## 3. `sayfalariTopluEkleEylem` yalnız görsel kart üretiyor — **çekirdek** (bilgi)

**Dosya:** `src/app/eylemler.ts`

Kök eylem `{gorselId, baslik}` alıyor; PDF kapısının ürettiği şey bu. PPTX'ten
gövde METNİ ve birden çok görsel geliyor, o yüzden kendi eylemimi yazdım
(`egitimler/[id]/eylemler.ts` → `pptxKartlariEkleEylem`). Bir şey kırılmıyor;
yalnız iki toplu ekleme eylemi var. Kök eylem `Partial<Sayfa>` alacak şekilde
genişletilirse benimkini silerim.

---

## Birinci dalgadan KARŞILANANLAR (kapandı)

- **Kiosk kartı çoklu görseli çizmiyor** → Hat D `Kart.tsx`i `kartGorselleri`
  ile yeniden yazdı, `gorseller.ts` saf yerleşim mantığını taşıyor. ✔
- **Soru görseli sınavda çizilmiyor** → `EgitimOyun` sınav aşaması artık
  `soru.gorselId`i ve `soru.aciklama`yı çiziyor. ✔
- **Kart silinince medya diskte kalıyor** → `depo.oksuzMedyalar()` geldi;
  editöre "kullanılmayan N medya var — temizle" yolu kuruldu. Kısmen: yukarıdaki
  madde 1'e bakın, içe aktarılan görseller hâlâ kapsam dışı. ◐
- **`medyaKullanimi` N+1** → `depo.medyaKullanimlariGetir()` geldi ve editör
  sayfası onu kullanıyor. Ölçüldü: 300 medyada 30,6 ms → 1,0 ms;
  2000 medyada 199 ms → 5,3 ms. ✔
- **`Medya.altMetin`** → çekirdekte açıldı, editör dolduruyor, kiosk/ziyaretçi
  okuyor. ✔

---

## Notlar

- `npx tsc --noEmit` temiz. `npm test` **16/16 dosya** geçiyor.
- **Yeni npm paketi eklenmedi.** PPTX ayrıştırıcısı (ZIP merkezi dizini + küçük
  XML ayrıştırıcı) `src/lib/pptx.ts` içinde kendi kodumuz; sıkıştırmayı
  tarayıcının yerleşik `DecompressionStream("deflate-raw")`i açıyor.
- `src/app/api/medya/route.ts`e **GIF** eklendi (sunumlarda ok/işaret
  grafikleri sık sık GIF). SVG bilerek eklenmedi: kendi kökenimizden sunulan
  SVG script çalıştırabilir.
- **Hat D'ye sınav önerisi** — `src/lib/pptx.ts` saf ve sınavlanabilir yazıldı,
  hiçbir fonksiyonu DOM'a/ağa/depoya dokunmuyor. Sınavlanması gerekenler:
  `zipGirdileri`, `girdiAc`, `xmlAyristir`, `varlikCoz`, `dugumleriBul`,
  `metniTopla`, `slaytCoz`, `iliskileriCoz`, `yolCoz`, `slaytSirasi`, `pptxCoz`.
  Elde .pptx dosyası yoksa `CompressionStream("deflate-raw")` ile sınav içinde
  gerçek bir ZIP üretilebiliyor (ben böyle doğruladım).
