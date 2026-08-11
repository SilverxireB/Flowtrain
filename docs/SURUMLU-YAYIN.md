# Sürümlü yayın — tasarım notu

Bu belge yazılmamış bir işi tarif eder. Amacı, işe başlayacak kişinin (ya da
oturumun) kararları baştan tartışmak zorunda kalmaması.

**Durum:** 1. adım YAZILDI (11 Ağustos 2026), 2. ve 3. adım duruyor.
Tasarım konuşuldu: 11 Ağustos 2026.

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

**1. Depo ve saf mantık.** ✅ **BİTTİ.** Yayınlanmış anlık görüntü için şema +
göç; `yayinla()` ve `yayindanGeriDon()` depo işlevleri; hangi sürümün
oynatılacağını seçen saf mantık ve birim sınavı. Bu adımdan sonra kiosk hâlâ
eski yerden okuyor — davranış değişmiyor, altyapı hazır oluyor.

Yazılanlar ve 2. adımın devralacağı yüzey:

- Şema: `yayinSurum` (künye + sınav ayarları + bölüm başlıkları), `yayinSayfa`,
  `yayinSoru`. Anahtar `(yayinId, sayfaId/soruId)` — anlık görüntü TASLAĞIN
  KİMLİĞİNİ korur, gerekçesi `db.ts`te.
- Göç: yükseltme anında **sahadaki** (`durum='yayin'`) eğitimlerin görüntüsü
  bir kez alınır, sürüm numarası kaydırılmadan. Taslaktakiler bilerek dışarıda.
- `src/lib/surum.ts` (saf, sınavlı): `oynanacakYayin`, `sonYayin`,
  `sonrakiSurum`, `icerikImzasi`, `yayinlanmamisDegisiklikVar`.
- `src/lib/depo.ts`: `yayinla`, `yayindanGeriDon`, `sonYayinIcerigi`,
  `yayinlariGetir`, `yayinGetir`, `yayinIcerigi`, `yayinlanmamisDegisiklik`.
  `yayinIcerigi` doğrudan `Sayfa[]`/`Soru[]` döner — oynatıcının tiplerinin
  değişmesi gerekmiyor, 2. adım yalnız kaynağı değiştirir.
- `yayinlaEylem` artık anlık görüntü alıyor; içerik değişmemişse yeni sürüm
  ÜRETMİYOR (eğitimi yalnız sahaya geri alıyor).
- `bolumler.ts` `src/lib/`e taşındı (depo anlık görüntü alırken okuyor).

**2. Okuma yerini çevir.** ✅ **BİTTİ.** Kiosk, ziyaretçi tableti ve amir
tableti taslak yerine yayınlanmış sürümü okusun. Davranış BURADA değişir;
uçtan uca sınav şart.

Yazılanlar:

- `depo.sahadakiEgitim` / `sahadakiIcerik` / `sahadakiEgitimler` — sahanın TEK
  kapısı. Dönen `Egitim` künyesi yayınlanan sürümden uygulanır
  (`surum.ts` → `sahayaUygula`): geçme notu, deneme hakkı ve TEKRAR SÜRESİ de
  ancak yayınlanınca sahaya çıkar, yoksa yayınlanmamış bir kural sahada
  uygulanmaya başlardı.
- Çevrilen okuma yerleri: `kiosk/eylemler.ts` (amir tableti de buradan),
  `kiosk/page.tsx` (QR), `ziyaretci/eylemler.ts`, `ziyaretci/oyna/[id]`,
  `ziyaretci/page.tsx` (kayıt masası listesi), `atamaServis.ts` (atama
  motorunun malzemesi), `pano/page.tsx` (anomali beklenen süresi).
- **Puanlama oturumun SÜRÜMÜNDEN**: `depo.yayinSorulariKimlikle(egitimId,
  surum, idler)` ve geçme notu `yayinGetir(...)`. Oturum açıkken yapılan bir
  düzeltme kişiyi görmediği cevap anahtarıyla puanlayamaz. Yayın bulunamazsa
  taslağa düşülür — yükseltme anında açık kalmış oturum kapanabilsin diye.
- `guvenlik.test.mjs` oynatma yüzeylerinin taslak tablolarına dokunmadığını
  KAYNAKTA sabitliyor (4i): bu kuralın bozulması ekranda görünmez, yalnız
  kayıt anlamsızlaşır.
- `scripts/yuk.mjs` artık `durum: "yayin"` yaması yerine `depo.yayinla` ile
  yayınlıyor — eskisi ölçümü boş kümeye düşürürdü.

**3. Editör yüzeyi.** ✅ **BİTTİ.** "Yayınlanmamış değişiklik var" rozeti,
"Yayındaki hâline dön" düğmesi, yayındayken editörün kilidini kaldırmak (artık
gerekmiyor — düzenleme sahaya çıkmıyor).

Yazılanlar:

- **Yayın kilidi kalktı**: `taslakMi` kapısı iki eylem dosyasından da kaldırıldı.
  Dört göz kuralı yerinde — yayınlamak ve sahadan indirmek hâlâ `onaylayan`
  yetkisi ister, `HAZIRLAYAN_ALANLARI` beyaz listesi `durum/surum/onaylayan`
  alanlarını dışarıda tutar. `sinir.test.mjs` 5b artık kilidi değil onun yerine
  geçen güvenceyi ölçüyor: düzenleme kapıları + dört göz + **yayın tablolarına
  UPDATE/DELETE olmaması**.
- **"Taslağa al" → "Sahadan indir"**: düğmenin anlamı değişti. Düzenlemek için
  gerekmiyor; artık gerçekten kioskTAN DÜŞÜRÜYOR. Eski adıyla kalsaydı
  alışkanlıkla basan hazırlayan eğitimi vardiya ortasında sahadan kaldırırdı.
- Rozet, durum şeridi ve "Yayındaki hâline dön" (onaylı) — `yayindanGeriDonEylem`,
  `hazirlayan` yetkisiyle: sahaya bir şey çıkarmıyor.
- Değişiklik yokken "Yayınla" kapalı ("Yayınlanmamış değişiklik yok") — ikizi
  olan sürüm numarası üretilmiyor.
- Kart kopyalama hedefleri artık yayındaki eğitimleri de içeriyor (hedefin
  TASLAĞINA yazılır).
- **Kontrolsüz alan tuzağı**: editör alanları `defaultValue` ile kurulu ve geri
  dönüşte kartlar aynı kimlikle geldiği için React onları yeniden kurmuyordu —
  sunucu doğru, ekranda eski yazı. Gövde artık "taslak = yayın" durumuna
  GEÇİŞTE yeniden kuruluyor (`tazeleme`). Ölçüldü: anahtar kaldırılınca uçtan
  uca sınav düşüyor.

## Başlangıç noktaları

Kod bu belgeden hızlı değişiyor; aşağıdakiler **doğrulanacak işaretler**,
kopyalanacak gerçekler değil.

- `src/lib/db.ts` — `SEMA` ve `gocleriUygula()`. Göç oraya yazılır.
  **Dikkat:** `SEMA` bir şablon dize; yorumlarda ters tırnak dosyayı bozar.
- `src/lib/depo.ts` — `egitimGuncelle` içindeki `GUNCELLENEBILIR` listesi,
  `sayfalariGetir`, `sorulariGetir`, `egitimKopyala` (anlık görüntü için
  hazır bir kopyalama deseni).
- Bölüm başlıkları `sayfa` tablosunda değil, `ayar` tablosunda duruyor
  (`bolumler:<egitimId>`, bkz. `src/lib/bolumler.ts`). Anlık görüntü onu da
  almalı, yoksa yayınlanan eğitimde bölümler kaybolur. (1. adımda alınıyor.)
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
