# Sürümlü yayın — tasarım notu

Bu belge yazılmamış bir işi tarif eder. Amacı, işe başlayacak kişinin (ya da
oturumun) kararları baştan tartışmak zorunda kalmaması.

**Durum:** tasarlandı, yazılmadı. Konuşuldu: 11 Ağustos 2026.

---

## Sorun

Bugün editördeki her alan `onBlur`da doğrudan kaydediliyor ve kaydedilen şey
**sahadaki eğitimin kendisi.** Yayındaki bir eğitimde editör kilitleniyor
(`kilitli = yayinda`), yani düzenlemek için önce "Taslağa al" demek gerekiyor —
ve o an eğitim **kiosk'tan düşüyor.**

İki ucu da kötü:

- **Taslağa alırsan** eğitim sahada görünmez olur. Vardiya ortasında kioskta
  eğitimini almaya gelen işçi "size atanmış eğitim yok" görür.
- **Yayındayken düzenlemeye izin verseydin** (eski davranış), 7. kartı okuyan
  kişi ile 7. kartı değiştiren hazırlayan aynı anda çalışır; kişinin kaydı
  hangi içeriğe ait olduğu belirsiz kalır.

Üstelik `oturum.egitimSurum` kaydediliyor ama **o sürümün içeriği saklanmıyor.**
Üç yıl sonra denetimde "bu kişi tam olarak neyi izledi" sorusunun bugün cevabı
yok. `CLAUDE.md` "satılan şey kayıttır" diyor; bu açık o cümleyle çelişiyor.

## Karar

**Taslak ile yayın ayrı iki nesne olsun.**

- Düzenleme her zaman **taslak** üzerinde yürür ve otomatik kaydolmaya devam
  eder. Bu kısım iyi çalışıyor, kimse yazdığını kaybetmemeli — dokunma.
- Taslak, **"Yayınla" denene kadar sahaya hiç çıkmaz.** Kiosk, ziyaretçi tableti
  ve amir tableti **her zaman son yayınlanan sürümü** oynatır.
- "Yayınla" o anın **atomik anlık görüntüsünü** alır (kartlar + sorular +
  bölüm başlıkları) ve sürüm numarasını artırır.

Bundan üç şey kendiliğinden geliyor:

| İstenen | Nasıl gelir |
|---|---|
| "Yayındaki hâline geri dön" | Taslağı yayından kopyala. Tek düğme, veri kaybı yok. |
| Geri tuşunda uyarı | **Gerekmez.** Hiçbir şey kaybolmuyor. Uyarı yerine "yayınlanmamış değişiklik var" rozeti — korkutmaz, bilgilendirir. |
| Eski sürümü yükle | Anlık görüntüler zaten saklanıyor; "3. sürüme dön" mümkün olur. |

Ve asıl kazanç: `oturum.egitimSurum` gerçek bir içeriğe bağlanır. Denetimde
kaydın yanına o gün izlenen kartlar konabilir.

## Kapsam dışı

- Taslakta otomatik kaydı kaldırmak. **Kaldırma.** "Taslağı kaydet" düğmesi
  eklemek, yazarken kaybetme riskini geri getirir.
- Sürüm karşılaştırma ekranı (diff). İleride olabilir, bu işin parçası değil.

## Sıra — her adım kendi başına çalışır halde bırakır

**1. Depo ve saf mantık.** Yayınlanmış anlık görüntü için şema + göç;
`yayinla()` ve `yayindanGeriDon()` depo işlevleri; hangi sürümün oynatılacağını
seçen saf mantık ve birim sınavı. Bu adımdan sonra kiosk hâlâ eski yerden
okuyor — davranış değişmiyor, altyapı hazır oluyor.

**2. Okuma yerini çevir.** Kiosk, ziyaretçi tableti ve amir tableti taslak
yerine yayınlanmış sürümü okusun. Davranış BURADA değişir; uçtan uca sınav
şart.

**3. Editör yüzeyi.** "Yayınlanmamış değişiklik var" rozeti, "Yayındaki hâline
dön" düğmesi, yayındayken editörün kilidini kaldırmak (artık gerekmiyor —
düzenleme sahaya çıkmıyor).

## Başlangıç noktaları

Kod bu belgeden hızlı değişiyor; aşağıdakiler **doğrulanacak işaretler**,
kopyalanacak gerçekler değil.

- `src/lib/db.ts` — `SEMA` ve `gocleriUygula()`. Göç oraya yazılır.
  **Dikkat:** `SEMA` bir şablon dize; yorumlarda ters tırnak dosyayı bozar.
- `src/lib/depo.ts` — `egitimGuncelle` içindeki `GUNCELLENEBILIR` listesi,
  `sayfalariGetir`, `sorulariGetir`, `egitimKopyala` (anlık görüntü için
  hazır bir kopyalama deseni).
- Bölüm başlıkları `sayfa` tablosunda değil, `ayar` tablosunda duruyor
  (`bolumler:<egitimId>`, bkz. `src/app/egitimler/[id]/bolumler.ts`). Anlık
  görüntü onu da almalı, yoksa yayınlanan eğitimde bölümler kaybolur.
- Oynatma tarafının okuduğu yerler: `src/app/kiosk/eylemler.ts` (`oturumBaslat`),
  `src/app/ziyaretci/oyna/[id]/page.tsx`, amir tableti akışı.
- `src/lib/atamaServis.ts` — `durum === "yayin"` süzgeci burada.

## Uyulacak kurallar

`CLAUDE.md` bağlayıcı. Bu iş için en çok ısıranlar:

1. Push öncesi **`npm run build`** — `tsc --noEmit` yetmez.
2. **Yeni npm paketi eklenmez.**
3. **Kayıt düzenlenmez, silinmez.** Yayınlanmış anlık görüntüler de kayıt
   sayılır: bir sürüm yayınlandıktan sonra içeriği değiştirilemez. Değişiklik
   yeni bir sürümdür.
4. Saf mantık `src/lib/` altında ve **sınavlı** olmalı; veritabanına yapışık
   yazılırsa sınav yazmak için veritabanı kurmak gerekir.
5. Parametre yakalayıp birden çok kez çağrılan yardımcı yazma — modül
   seviyesine al (`src/lib/csv.ts`teki küçültücü tuzağı).

## Doğrulama beklentisi

- `npm test` — yeni saf mantığın birim sınavı, mevcutların hepsi geçer.
- `npm run build` — temiz.
- Uçtan uca: bir eğitimi yayınla, taslağını değiştir, **kioskta hâlâ eski
  sürümün oynadığını** gör; yayınla, yeni sürümün oynadığını gör; "yayındaki
  hâline dön" ile taslağın geri geldiğini gör.
- Göç sınavı: elinizdeki `data/flowtrain.db` ile açılış patlamamalı
  (`tests/yukseltme.test.mjs` deseni).
