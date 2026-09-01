# FlowUI tasarım dili → FlowTrain

FlowTrain'in arayüzü FlowUI'da olgunlaşan dile taşınıyor. Kaynak tek yer değil,
üçü birden:

| Kaynak | Ne taşır |
|---|---|
| `FlowUI/src/pages/DesignSystem/` (`/design-system` rotası) | **Tasarım el kitabı** — dokuz grup, her bileşenin özeti ve kuralları |
| `FlowUI/CLAUDE.md` (3234 satır) | Kararların GEREKÇESİ ve ölçümleri; "denendi, geri alındı" notları |
| `FlowUI/src/assets/scss/_flow-tokens.scss` · `_flow-effects.scss` | Token katmanı (28 KB) ve imza efektleri (258 KB) |

**Kopyalanır, bağlanmaz** (CLAUDE.md 6) — ve teknik olarak da zorunlu: FlowUI
React/Vite/SCSS/reactstrap, FlowTrain Next.js/Tailwind. Bileşenler yeniden
yazılır, kararlar aynen taşınır.

**`_flow-effects.scss`'in tamamı GELMEZ.** 7471 satırın büyük kısmı FlowUI'a
özel bileşenlere bağlı (reactstrap, react-select, KGC, MDM, videowall, station
popover) ve FlowTrain'de karşılıkları yok. Gelen şey **dil**: token'lar, imza
efektleri, ölçü kuralları, davranış kararları.

---

## Karar: DARK ÖNCELİKLİ

Kullanıcı kararı. Koyu tema birincil yüzey; açık tema token katmanı sayesinde
kendiliğinden geliyor ama **doğrulama koyuda yapılır**. Bu, `CLAUDE.md`deki
eski "Kokpit yüzeyleri AYDINLIK" maddesini geçersiz kılar.

Renk ekseni FlowUI'ınkiyle **aynı**: koyu = Beko mavisi `#556ee6` üstünde
lacivert `#0a0a40` rampası, açık = Arçelik kırmızısı `#c0161e`. Açık tema
koyunun soluk kopyası değil, ayrı bir kimlik.

**Font: Encode Sans** (SIL Open Font License). FlowUI'ın CLAUDE.md'sinde
19.08.2026 tarihli "EncodeSans → Roboto" notu var; kullanıcı bunun **eskide
kaldığını**, SIL lisanslı Encode Sans'ın kullanılabildiğini söyledi.

---

## Durum tablosu

`✅` bitti · `🔸` kısmen · `○` yapılmadı · `—` FlowTrain'de karşılığı yok

### 1. Tema ve zemin

| Kriter | Durum | Not |
|---|---|---|
| Sayfada hex yazılmaz, renk `--flow-*`ten gelir | ✅ | `src/styles/flow-tokens.css`; Tailwind renkleri token'a bağlandı |
| `color-scheme` bildirilir (tarayıcı çizimi parçalar) | ✅ | iki temada da |
| Renk ekseni temanın kimliğidir | ✅ | açık kırmızı / koyu mavi |
| Tema seçimi KALICI | ✅ | `localStorage`, boyadan önce yazılıyor |
| Okunurluk: DOLGU ile METİN ayrı token | ✅ | `iyi/orta/brand` → `-text` karşılıkları; sınavla korunuyor |
| Köşe yarıçapı sayfada sabit yazılmaz | ✅ | 140 yerde `rounded-flow`/`-sm`'ye çevrildi (12/8px); hap biçimliler kural dışı, sınavla korunuyor |
| Cam yüzey her temada kendi zemininden | 🔸 | token + `.flow-cam-*` sınıfları hazır, kullanan yüzey yok |
| Tipografi: sayfa kendi fontunu getirmez | ✅ | tek yerde, `layout.tsx` |
| **Siyah tema** | ✅ | FlowUI'ın `black`i birebir: gri rampa, marka grisi, vurgu logo turuncusu (#f17e2b). Sözleşme eksiksiz — 34/34 jeton, sınavla korunuyor |
| Mevsimlik temalar | — | FlowTrain'de karşılığı yok; gerekirse üç token yeter |

### 2. İmza efektleri

| Kriter | Durum | Not |
|---|---|---|
| `--flow-ring` — 1px, DURAN, yatay degrade | ✅ | dönen konik DEĞİL; `.input-base` odak/hover |
| Halka YALNIZ giriş alanı ve textarea'da | ✅ | ETİKET seviyesinde kural; `hidden/checkbox/radio/submit/button/file` kapsam dışı, sınavla korunuyor |
| Buton/hap vurgusu `--flow-pill-accent` | ✅ | üç düğme sınıfı tek yerden hap ışığı alıyor; seçici ve onay kutusu da |
| TUZAK: `background:` kısayolu halkayı siler | ✅ | yorumla işaretlendi |

### 3. Geri bildirim

| Kriter | Durum | Not |
|---|---|---|
| FlowSpinner — 4 karakter, rastgele | ✅ | `src/components/FlowSpinner.tsx` |
| Jenerik spinner YASAK | ✅ | `Yukleniyor` artık FlowSpinner çiziyor |
| Bildirim tek kapıdan, ömür token'dan | ✅ | `--flow-toast-duration` çalışma anında okunuyor |
| Boş durumlar — gri kutu YASAK | ✅ | kayıt defteri, personel ve katalog `.flow-bos-satir` giyiyor |
| Uyarı göstergesi — ünlem SVG, yayılan halka | 🔸 | `.flow-alarm` dilde ve sınavlı; FlowTrain uyarıları bugün metin/rozet olarak veriyor |
| Bilgi balonu — stil sayfada yazılmaz | — | FlowTrain'de popover yok |

### 4. Form ve seçim

| Kriter | Durum | Not |
|---|---|---|
| Seçicinin açılır listesi temaya uyar | 🔸 | **kural uyarlandı** (FlowUI react-select kullanıyor, burada yeni paket YASAK). `color-scheme: dark` + zeminin `box-shadow`a taşınması ile native koyu liste hedefleniyor; Chrome/Windows'ta seçiciye zemin vermek listeyi açık renge zorluyor. **Kesin çözüm kendi menümüzü yazmak** — FlowUI'ın yaptığı da bu |
| Aranabilir dropdown tek kaynak | — | FlowTrain'de 10'dan uzun seçim listesi yok |
| Onay kutusu tamamen çizilir | ✅ | `appearance:none` + kendi tikimiz; `accent-accent` 7 yerden kaldırıldı. FlowUI'ın ölçümü doğruydu — boş kutu tarayıcının çizimi kalıyordu |
| Sayı alanı — oklar gelip gitmez | ○ | `Sayi` bileşeni var, dile çekilmedi |
| Zorunlu alan işareti | 🔸 | `.flow-zorunlu` tanımlı; FlowTrain formlarında zorunluluk metinle anlatılıyor |
| Buton rengi ANLAM taşır (sil kırmızı) | ✅ | FlowTrain'de zaten kural: gül YALNIZ uyarı |
| Sayfada inline `style` yazılmaz | ✅ | |

### 5. Tablo, filtre ve rapor

| Kriter | Durum | Not |
|---|---|---|
| Filtre kokpiti TEK SATIR, preset hapları | ✅ | kayıt defterinde Bugün/Dün/Son 7 gün/Bu ay; saf mantık `lib/tarihPreset.ts`, 24 doğrulama |
| Yer daralınca preset'ler sırayla gizlenir, "Bugün" kalır | ✅ | dar ekranda yalnız "Bugün" |
| Panel kapalı başlar, uygulanınca toplanır | ✅ | "Filtreler" çipiyle açılıyor, "Uygula" ile toplanıyor; uçtan uca ölçüyor |
| Boş durumda arama/dışa aktarım gizlenmez, soluklaşır | 🔸 | araçlar `disabled` ile soluklaşıyor, gizlenmiyor |
| Sayfalama şeridi tablonun DEVAMI | ✅ | `.flow-tablo-kap` içinde, aynı zemin, tek çizgiyle ayrılıyor |
| Yerinde yenileme (blur perde + spinner) | 🔸 | `.flow-yenileme-kap` / `-perde` tanımlı, 350 ms gecikmeli giriş dahil |
| Tablo dili: yapışkan başlık, satır vurgusu, ortalı hücre | ✅ | üç kokpit tablosu `.flow-tablo`. **Hiza ORTALI** — önce sola yaslamıştım, FlowUI ölçülünce ortalı çıktı. Kırpma da kaldırıldı (FlowUI'da yok, ben eklemiştim) |

### 6. Kart, akordeon ve sayfa iskeleti

| Kriter | Durum | Not |
|---|---|---|
| Sayfada kart stili yazılmaz | ✅ | `.card` tek yerde, token'a bağlı |
| Kart gölgesi temayla döner | ✅ | sabit rgba yerine `color-mix` |
| Hover'da kutu YER DEĞİŞTİRMEZ | ✅ | tarandı: FlowTrain'de kalkan kutu **hiç yok**, o sessiz hata burada hiç oluşmamış. `.flow-tiklanir` yine de dilde duruyor |
| Cam panel dili | 🔸 | `.flow-cam-zemin` / `.flow-cam-panel` tanımlı |
| Halka/gösterge: punto HANE SAYISINDAN, grup kabından | ○ | `Halka.tsx` kendi ölçüsünü kuruyor |
| Ana sayfa vitrin: cam yüzey + `--flow-logo-*` lekeleri | ○ | |
| `prefers-reduced-motion` açıksa hareket durur | ✅ | spinner ve halka için |

### 7. Yerleşim ve etkileşim kuralları

| Kriter | Durum | Not |
|---|---|---|
| Veri yoksa tıklanabilir bırakma | 🔸 | `.flow-veri-yok` tanımlı; ayrım solgunluk DEĞİL, kesik kenar + sebep |
| Fark ANLAM RENGİ TAŞIMAZ | ○ | kırmızı bu ailede "dur/hata"; fark bir haberdir |
| Kontrast rengi yalnız dolgu üstünde | ✅ | `--flow-primary-contrast` |
| Durum göstergeleri yer tutar, feda sırası bellidir | 🔸 | başlık şeridinde var |
| Seçim görünenleri kapsar | — | |

### 8. Grafikler ve göstergeler

| Kriter | Durum | Not |
|---|---|---|
| `--flow-chart-1..20` havuzu | ✅ | token katmanında |
| Renk sırayla dağıtılmaz, PALET SEÇİLİR | ○ | FlowTrain'de grafik az; pano CSV/PDF ağırlıklı |
| SVG içinde `var()` çözülmez, renk çalışma anında okunur | ✅ | ölçüldü, aşağıya bak — FlowTrain'i bağlamıyor |

### 9. Görsel görüntüleyici / marka

| Kriter | Durum | Not |
|---|---|---|
| `--flow-logo-*` dokunulmaz, temayla dönmez | ✅ | `Halka.tsx` token'a bakıyor |
| Logo koyu zeminde okunur | ✅ | iki PNG birden çizilir, CSS seçer; yazı `--flow-logo-yazi` (açık lacivert / koyu beyaz) |
| Lightbox | — | FlowTrain'de yok |

---

## ⭐ FLOWUI ARTIK ÇALIŞTIRILABİLİYOR — ÖLÇÜM YÖNTEMİ

**Bu, işin en önemli maddesi.** Uzun süre FlowUI'ı görmeden, yalnız SCSS
okuyup FlowTrain'e değer yazarak ilerledim. Kullanıcı defalarca "yaklaşıyor
ama asla aynı değil" dedi ve haklıydı: ben iki KOD dosyasını, o iki RESMİ
karşılaştırıyordu.

FlowUI'ın `node_modules`ü mevcut. `.claude/launch.json`a **`flowui`** girdisi
eklendi (port 5174, `npm run dev`). Ayağa kalkması ~6 saniye.

**YÖNTEM — kodu okuma, ölçüm yap:** FlowUI'ın CSS'i GLOBAL, yani giriş
ekranındayken bile bütün sınıflar yüklü. Sayfaya gizli bir sonda DOM'u
enjekte edip `getComputedStyle` ile gerçek değerleri okumak mümkün:

```js
kap.innerHTML = `<div class="card">…</div><table class="flow-inline-table">…`;
document.body.appendChild(kap);
getComputedStyle(document.getElementById("p-th")).backgroundColor;  // rgb(26,33,112)
```

Aynı sondayı FlowTrain'de koşup iki çıktıyı karşılaştırmak, "benziyor mu"
tartışmasını bitiriyor.

⚠ **SONDA TUZAĞI:** çerçeveye bağlı sınıflar (`.nav-link`, `.form-control`)
gerçek kapsayıcısı olmadan yanlış ölçülür — `.flow-pill-nav .nav-link`
sondada `padding: 5px` verdi, oysa CSS'te `4px 14px` yazıyor (Bootstrap'ın
`--bs-nav-link-padding-*` değişkenleri yalnız `.nav` içinde tanımlı).
Sınıfın özelliği KENDİ tanımından geliyorsa ölçüm güvenilir, kalıtımdan
geliyorsa değil.

### Ölçümle bulunan ve düzeltilen MAKRO farklar

Bunlar detay değil, ana biçimlerdi — "asla aynı değil" hissinin sebebi:

| | FlowUI (ölçüldü) | FlowTrain (öncesi) |
|---|---|---|
| Düğme | 8px köşe · `7.5px 12px` · 13px · kalınlık **400** | hap · `20px 12px` · 14px · **600** |
| Gövde metni | koyu `#a6b0cf` · açık `#495057` | `#f2f5ff` (parlak beyaz) |
| Giriş alanı | `surface-2` · 8px · `7px 10px` · 14px | `surface` · 12px · `12px 16px` |
| Tablo hücresi | kırpma **yok**, **ortalı** | kırpma var, sola yaslı |
| Arama kutusu | 13px punto | 16px (devralınan) |

**Ders:** "gerekçesi burada geçerli değil" diyerek bir kuralı uyarlamadan
önce ÖLÇ. Tablo hizasını "FlowTrain metin ağırlıklı" diye sola yaslamıştım;
ölçüm FlowUI'ın ortalı olduğunu gösterdi ve amaç aynı aileden görünmek.

---

## ⚠ ÖLÇÜM DÜZELTMESİ — YANLIŞ TABLO ÖLÇÜLMÜŞ (29.08.2026)

Kullanıcı: *"sanki tam benzeyemedi orası tablosu falan."* Haklıydı ve sebebi
yukarıdaki ölçümün kendisiydi: sonda **`.flow-inline-table`** sınıfını
okumuş. O sınıf FlowUI'ın **form içi küçük liste** dili. `.flow-tablo`nun
taklit ettiği şey ise **kokpit tablosu** — `SimpleDataTable/TableStyle.module.css`.
CSS modülü olduğu için sondaya hiç görünmüyor; kaynaktan okunması gerekiyordu.

İki tablo dilinin kuralları farklı, o yüzden "FlowUI'da kırpma yok" sonucu
yanlış çıktı. Kokpit tablosu açıkça yazıyor:

```css
.table    { color: var(--flow-text);   font-size: 0.9375rem }
.table td { color: var(--flow-text-2); max-width: 220px;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis }
.table th { color: var(--flow-text);   padding: 12px; overflow: hidden;
            text-overflow: ellipsis }
```

**Aynı yanlış ölçümden `--flow-tablo-metin` jetonu da doğmuştu**
(koyuda `#f2f5ff`): inline tablonun `td`si renk vermediği için gövdeden
miras aldığı beyaz "tablo metni" sanılmış. Sonuç: başlıkla hücre aynı
parlaklıkta, tabloda hiyerarşi yok. Jeton **kaldırıldı**; tek kaynak
`--flow-text` / `--flow-text-2`.

### Aynı turda düzeltilen metin rampası

FlowTrain'in tonları beyaza doğru sıkışmıştı — bütün metinler neredeyse
aynı parlaklıkta. Değerler FlowUI ile eşitlendi (ölçüm, koyu tema, `--flow-bg`):

| jeton | önce | sonra (FlowUI) | oran |
|---|---|---|---|
| `--flow-text` | #f2f5ff | #f2f5ff | 17.1 |
| `--flow-text-2` | #ccd6f5 | **#b8c4f2** | 10.8 |
| `--flow-govde` | #dde4fa | **#a6b0cf** | 8.6 |
| `--flow-text-muted` | #c3cbe4 | **#7d89c4** | 5.5 |

⚠ **Tek istisna açıkça kaydedildi:** `--flow-text-muted × --flow-surface-2`
= 4.2, yani AA eşiğinin (4.5) altında — **FlowUI'da da öyle**. Karar: ton
aynı kalsın, sınavda `ISTISNA` listesinde gerekçesiyle dursun. Muted
ikincil etiket rengidir; okunması gereken metin `--flow-text-2`.

### Rem tuzağı — ölçülen değer ölçüldüğü birimde yazılır

Kök punto 13px olduğu için Tailwind'in `rem` tabanlı yardımcıları ölçülen
değeri tutturamıyor. Üç yerde yakalandı:

| yer | yazılan | çıkan | olması gereken |
|---|---|---|---|
| `.btn-primary` / `.btn-ghost` | `px-3` | 9.75px | **12px** |
| `.input-base` | `px-2.5` | 8.125px | **10px** |
| (daha önce) punto | `text-sm` | 11.4px | 14px |

Yorumda doğru değer yazılı olduğu hâlde kod yanlış çıkıyordu.

### Sınavla korunuyor

`tests/tasarim-dili.test.mjs`: tablo iki tonu ayrı kullanıyor mu, hücre
kırpılıyor mu (220px + ellipsis), rampa sırası bozulmuş mu. Hiyerarşi
sınavına artık **yalnız FlowUI'ın kendi üç tonu** giriyor — `--flow-govde`
FlowUI'da bir `--flow-*` jetonu değil, Bootstrap'ın gövde rengi ve rampada
sabit yeri yok (koyuda text-2'den sakin, açıkta parlak).

### Kalan tek tablo farkı

`.scrollShell::after` — kaydırma kabının altındaki "devamı var" ışık
solması. FlowUI'da bir JS dinleyicisi `.scrollShellMore` sınıfını açıp
kapatıyor. FlowTrain tabloları bugün yalnız YATAY kayıyor (`flow-kaydir-x`),
dikey kaydırma kabı yok — maskeyi eklemek yerleşim kararı gerektiriyor,
o yüzden bilinçli olarak yapılmadı.

---

## Açık riskler

**~~`Halka.tsx` ve SVG `var()`~~ — ÖLÇÜLDÜ, sorun yok.** FlowUI notu *"SVG
içinde `var()` çözülmediği için renk çalışma anında okunur"* diyor ve
`Halka.tsx`in renklerini `var(--flow-logo-*)` yapmıştım. Gerçek tarayıcıda üç
yol da ölçüldü:

| Yazım | Sonuç |
|---|---|
| `stroke="var(--flow-logo-blue)"` (öznitelik — React'in ürettiği) | `rgb(27,141,236)` ✅ |
| `element.style.stroke = "var(...)"` (CSS özelliği) | `rgb(27,141,236)` ✅ |
| `stroke="#1b8dec"` (kontrol) | `rgb(27,141,236)` |

FlowUI'ın notu **satır içi SVG için değil**, grafik kütüphaneleri için
geçerli: Chart.js ve ApexCharts rengi canvas'a çizmeden önce JS değeri olarak
okuyor ve oraya `var(...)` dizesi gidince renk düşüyor. FlowTrain satır içi
SVG çiziyor, tarayıcı sunum özniteliğini CSS değeri olarak çözüyor. Kural
FlowTrain'de **grafik kütüphanesi kullanılırsa** geçerli olacak.

**Kiosk yüzeyi.** Kiosk bilerek ayrı bir dil (72px hedef, eldivenli el). Koyu
tema kioska da uygulanıyor; sahada bir metreden okunurluğun ölçülmesi gerekir —
FlowUI'ın kontrast ölçümleri masaüstü mesafesi için yapıldı.

**Basılı çıktılar dilin dışında.** Sertifika, kayıt defteri PDF'i, QR etiketi
kâğıda gidiyor: tema takip etmezler ve etmemeliler.

---

## Sıra

**PİLOT YOK — kullanıcı kararı.** Global katmanın tamamı bir kerede alınıyor,
sonra yüzeyler o dile bağlanıyor. Gerekçe: "tamamen aynı aileden olmasını
istiyorum" — yüzey yüzey ilerlemek, dilin yarısını taşıyıp yarısını
bırakmak demek olurdu.

1. ~~Token katmanı + iki tema~~ ✅
2. ~~Encode Sans~~ ✅
3. ~~İmza halkası (etiket seviyesinde)~~ ✅
4. ~~FlowSpinner (dört karakter)~~ ✅
5. ~~Logo koyu temada beyaz~~ ✅
6. ~~Global sınıf katmanı (`flow-global.css`)~~ ✅ — hap dili, boş durumlar,
   bölüm etiketi, yerinde yenileme, uyarı göstergesi, tablo dili, kaydırma
   çubuğu, zorunlu alan, cam panel, hover kuralı, veri-yok ayrımı
7. **Yüzeyleri bu sınıflara bağlamak** — sınıflar tanımlı, kullanan yer henüz az
8. Form ailesi — FlowSelect, FlowCheckbox (`accent-color` yetmiyor), sayı alanı


---

## SİYAH TEMA EKLENDİ (29.08.2026)

FlowUI'ın `black` teması FlowTrain'e alındı: `:root[data-tema="siyah"]`,
tema seçicide üçüncü seçenek. **Koyunun daha koyusu değil, ayrı bir tema** —
yüzeyler tek renkli gri rampa, marka grisi, kimlik VURGUDAN geliyor.

(FlowUI'da 10 Kasım anma teması AYRI bir anahtardır — `anma` — ve orada renk
tümüyle kalkar. `black` ile karıştırılmamalı; FlowTrain'e gelen `black`.)

**⚠ SÖZLEŞME EKSİKSİZ DOLDURULDU — FlowUI'ın kendi dersi.** `koyu` bloğunun
override ettiği **34 jetonun hepsi** yeniden verildi. Atlanan jeton koyudan
değil **açık temadan** sızardı: `:root, :root[data-tema="acik"]` kuralının
`:root` yarısı siyahta da eşleşiyor. Sınav bunu artık kendi kontrol ediyor
(`siyah tema sözleşmeyi eksiksiz dolduruyor`).

Ölçülen metin rampası (`--flow-surface` üstünde) koyuyla aynı şekilde düşüyor:

| | koyu | siyah |
|---|---|---|
| `--flow-text` | 17.1 | 16.9 |
| `--flow-text-2` | 10.8 | 11.8 |
| `--flow-govde` | 8.6 | 8.5 |
| `--flow-text-muted` | 5.5 | 5.7 |

`--flow-govde` FlowUI'da bir jeton değil (Bootstrap gövde rengi), karşılığı
üretildi: **#b0b0b0** — text-2 ile muted'ın arasına, koyudaki oranın aynısına.
Koyudaki tek kontrast istisnası (muted × surface-2 = 4.2) **siyahta yok**:
orada 5.2, eşiğin üstünde.

### İki kaçak yakalandı

1. **Logo işareti.** `.logo-isaret-*` seçicisi yalnız `data-tema="koyu"`
   yazıyordu; siyahta lacivert işaret siyah zeminde kaybolmaya geri
   dönüyordu. Seçici tema adına değil **zeminin koyuluğuna** bakmalı.
2. **Bağlantı rengi.** Önce mavi (#8093ee) bırakıldı — kontrastı yeterliydi
   ve "bağlantı mavidir" bir alışkanlık. Ama Tailwind'de `text-accent`
   `--flow-link`e bağlı (marka rengi metin olarak okunmuyor diye) ve hub
   kutucuklarının **dokuz simgesi** ondan besleniyor: gri sayfanın ortasında
   dokuz mavi leke, temanın parçası değil kazası gibi duruyordu. Siyahta
   kimlik turuncudan geldiği için bağlantı da o sesi konuşuyor
   (#f17e2b · surface 6.8:1 · surface-2 6.2:1; uyarı sarısıyla karışmıyor).

**Yeni koyu tema eklenirse:** `koyu` bloğunun jeton listesini kopyala,
değerleri ver, `.logo-isaret-*` seçicisine tema adını YAZ. Sınav geri kalanını
söyler.
