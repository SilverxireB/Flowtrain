# FlowTrain — CLAUDE.md

Flow Studio ailesinin beşinci ürünü, ama **ayrı repo, ayrı kutu**: kapalı ağda
çalışan eğitim dağıtım ve sınav aracı. Next.js 14 App Router + TS + Tailwind.
Türkçe UI, İngilizce kod. Kapsam: `docs/KAPSAM.md`.

## Altın Kurallar

1. Push öncesi MUTLAKA `npm run build` (`tsc --noEmit` YETMEZ — "use client"
   yanlış satırdayken tsc susar, yalnız Next derlemesi patlar).
2. **DIŞ SERVİS YOK.** Kapalı ağda çalışır: internet, CDN, bulut depolama,
   üçüncü parti API yoktur. Video/görsel yerel diskte durur.
3. **İşçi hesap açmaz.** Okta/VPN/e-posta/şifre yok — sicil (veya kart) + 4 hane
   PIN. Kimliği doğrulanan cihazdır, kişi ATFEDİLİR. Bunu "yetersiz kimlik" diye
   düzeltmeye kalkma; ürünün var olma sebebi bu.
4. **Adaptör sınırı sızmaz** (`src/lib/adaptor.ts`). Çekirdek personelin nereden
   geldiğini, kaydın nereye gittiğini BİLMEZ. OPM'e özel hiçbir alan çekirdek
   tiplere girmez.
5. **Sahtecilik önlemleri v1 kapsamındadır**, ertelenmez (PIN sonda ve işçide,
   karışık soru havuzu, asgari süre, panoda anomali). Satılan şey kayıttır.
6. FlowMeter/Sign/Pulse kodu buraya **kopyalanır, bağlanmaz.** Bu repo başka
   hiçbir ürüne bağımlı değildir.
7. **KAYIT DÜZENLENMEZ, SİLİNMEZ.** Tamamlama kaydında Edit/Delete YOKTUR —
   düzenlenebilir bir kayıt denetimde değersizdir. Yanlış kayıt yeni bir kayıt
   ve `Oturum.notlar` ile düzeltilir, iz denetim defterinde kalır.
8. **YENİ NPM PAKETİ EKLENMEZ.** Kapalı ağ ürününde her bağımlılık taşınacak
   yüktür; CSV, QR, PDF gibi işler kendi kodumuzla yazılır (`src/lib/csv.ts`
   bunun örneğidir).

## Tasarım Sistemi — FLOW AİLESİ (bkz. `docs/FLOWUI-DILI.md`)

**Renk sayfaya YAZILMAZ.** Tek sözlük `src/styles/flow-tokens.css`
(`--flow-*`), FlowUI'ın token katmanından birebir devralındı — kontrast
oranları orada gerçek ekranda ölçüldü. Tailwind renkleri bu token'lara
bakıyor (`tailwind.config.ts`), bileşene tema bloğu yazılmaz.

**İki tema, `:root[data-tema]`:** koyu (lacivert `#0a0a40` rampası, Beko
mavisi `#556ee6`) ve açık (Arçelik kırmızısı `#c0161e`). Açık tema koyunun
soluk kopyası DEĞİL, ayrı bir kimlik. Tema boyadan önce `<html>`e yazılıyor
(`components/Tema.tsx`), seçim cihazda kalıyor. **Koyu tema önceliklidir.**

**Font: Encode Sans** (SIL Open Font License), derlemede gömülü.

**ODAK DİLİ İKİYE AYRILIR ve karıştırılmaz:**
- yazı girişi / textarea → **imza halkası** (`--flow-ring`) — 1px, DURAN,
  yatay degrade. Dönen konik DEĞİL: konik yay kutu uzadıkça kayıyordu.
  Kural ETİKET seviyesinde, sınıfsız `<input>`lar dahil.
- düğme / hap / seçici / onay kutusu → **tema vurgusu**
  (`--flow-pill-accent`)

⚠ TUZAK: giriş alanına `background:` KISAYOLU yazma (`background-color`
yaz) — kısayol halkanın `background-image` katmanını siler.

**Global sınıflar `src/styles/flow-global.css`:** hap dili, boş durumlar,
yerinde yenileme (350 ms gecikmeli perde), uyarı göstergesi, tablo dili,
kaydırma çubuğu, cam panel, `.flow-tiklanir` (hover'da kutu YER
DEĞİŞTİRMEZ — kalkan kart `click` üretmiyor).

**Spinner:** `FlowSpinner` — dört karakter (hop/spark/bars/dots), rastgele.
Jenerik spinner YASAK. **Köşe yarıçapı:** `rounded-flow` (12px) /
`rounded-flow-sm` (8px); hap biçimliler kural dışı.

Kiosk ayrı bir yüzeydir (aşağıda). **Kurallar `tests/tasarim-dili.test.mjs`
ile korunuyor** — kapsam dışı kalan kural sessizce çürür.

**Kiosk ayrı bir yüzeydir:** eldivenle basılır → `.btn-kiosk` (min 72px),
büyük punto, az seçenek. Onaylar `ConfirmDialog` ile (native `confirm` yok).

## Mimari Notlar

- **Depo SQLite** — JSON dosya deposu bu hacimde (kişi × eğitim × deneme)
  yetmez. Veri klasörü = yedek yeri. `data/` GEÇİCİ olarak repoda izleniyor
  (dummy veriyle çalışılıyor, makineler arası taşınsın diye); **canlıya
  alınırken `.gitignore`daki iki satır geri açılacak.**
- **WAL TUZAĞI — veriyi taşımadan önce `npm run veri`.** SQLite yazdıklarını
  bir süre `.db`ye değil `flowtrain.db-wal`e koyuyor. `git status` tertemiz
  görünürken günün çalışması hâlâ WAL'de olabilir; başka makineye geçen kişi
  saatler öncesini bulur. Bir kez oldu: `.db` sabahtan kalmışken WAL 210 KB'a
  çıkmıştı. Betik WAL'i `.db`ye katlar ve boşaltamazsa **hata verir** —
  yarım hazırlık, hiç hazırlamamaktan beterdir.
- **Adaptörün yönetilebilir yüzü:** `PersonelKaynagi.yonetim` (opsiyonel).
  Bugün CSV dosyasını yönetiyor (`adaptorlar/csvPersonelYonetim.ts`), `/personel`
  ekranı yalnız bu YETENEĞİ tanır. OPM webservice'i tek yönlü okursa alan boş
  kalır ve ekran kendini salt okunur gösterir — ekran adaptörü SORMAZ.
- **Maliyet merkezi = bölüm + amir.** OPM kaydı üç şeydir: sicil, ad, maliyet
  merkezi. Bölüm ve amir `mmEsleme` tablosundan TÜRETİLİR, elle yazılmaz —
  iki gerçek yarışırsa her dış aktarım el emeğini ezer. Eşleme VERİDİR:
  fabrika kendi kodlarını bağlar, yazılımcı gerekmez.
- **Eğitim paketi (`grup`)** — atama kuralı tek eğitime YA DA pakete yazılır.
  `depo.kurallariCozulmus()` paket kurallarını üyelerine açar; `kurallar.ts`
  saf mantık olarak kalır ve paketten haberi olmaz. Pakete sonradan eklenen
  eğitim, kural yeniden yazılmadan kapsanır.
- **Yazma onayı sunucudan gelir** (`kayitlar/YazmaSonucu.tsx`). Sınıf ve
  aktarım kaydında sonuç eylemin dönüş değerinde değil ADRESTE taşınıyor
  (`?yazildi=&atlanan=`), çünkü yazma eylemi `revalidatePath` çağırdığı anda
  formu yeniden kurduruyor ve durumda tutulan onay ölüyordu — kullanıcı otuz
  kişilik listeyi kaydedip hiçbir şey görmüyordu. Aynı desen gereken başka bir
  yerde de bu yolla çözülmeli: **eylem sonrası mesajı bileşen durumuna emanet
  etme.**
- **Taslak ≠ yayın.** `egitim/sayfa/soru` TASLAKTIR, editör oraya yazar;
  `yayinSurum/yayinSayfa/yayinSoru` "Yayınla" anının anlık görüntüsüdür ve
  KAYITTIR — yayınlanan sürüm bir daha değişmez, değişiklik yeni sürümdür.
  Anlık görüntü satırları taslağın KİMLİĞİNİ korur (anahtar `(yayinId, sayfaId)`):
  bölüm başlıkları, `oturum.sayfaSureleri` ve `soruIstatistik` hep o kimliğe
  bağlı; yenilenseydi üçü de sürüm sürüm parçalanırdı.
- **`Oturum.kaynak`** kaydın nereden doğduğunu söyler: `kiosk · amir · sinif ·
  aktarim`. Sınıf eğitimi ve dış aktarım kayıtları ekranda kart döndürmeden
  `depo.oturumKaydet()` ile yazılır — her eğitim kioskta verilmez, ama kayıt
  aynı deftere düşer.
- **`next build` TUZAĞI — dev sunucusu AYAKTAYKEN build çalıştırma.**
  `next build` ile `next dev` aynı `.next` klasörünü paylaşıyor; üretim
  derlemesi dev sunucusunun parçalarını eziyor ve **çalışan sunucu
  çöküyor**: `Cannot find module './7787.js'`, her sayfa 500. Kod
  kusursuzken olur, aramak zaman kaybettirir. 25.08.2026'da bir kez oldu.
  Doğrusu: sunucuyu durdur → `npm run build` → `rm -rf .next` → sunucuyu
  başlat. Çözüm de aynı: `.next`i silip yeniden başlatmak.
- **Realtime SSE** (Firebase yok — kapalı ağ).
- Kiosk dayanıklılığı Sign'dan gelir: Wake Lock, donma bekçisi, gece reload.
- `Oturum.senkron` alanı kaydın dış hedefe gidip gitmediğini tutar; başarısız
  gönderim `hata` olarak bekler ve yeniden denenir — **kayıt sessizce düşmez.**

## Yüzeyler

| Yol | Ne | Kim girer |
|---|---|---|
| `/` | Hub — role göre açılan kartlar | girişli |
| `/kurulum` `/giris` | ilk yönetici · kokpit girişi | — |
| `/egitimler(/[id])` | liste · editör (PDF kapısı, kartlar, sorular, ▶ Dene) | hazırlayan |
| `/gruplar` | eğitim paketleri — üyeler, sıra | hazırlayan |
| `/atama` | kural motoru (bölüm/hat/görev/işe giriş/tekrar); hedef eğitim ya da paket | hazırlayan |
| `/ekibim` | amir tableti — eksikler, gözetimli oturum | amir |
| `/kayitlar` | kayıt defteri — süzgeç, CSV/PDF, sınıf kaydı, sertifika. **Edit/Delete YOK** | hazırlayan |
| `/pano` | tamamlanma, bölüm kırılımı, anomali, CSV | hazırlayan |
| `/personel` | sicil · ad · maliyet merkezi · rol; MM eşlemesi, dış aktarım | yönetici |
| `/ayarlar` | kurulumun gerçeği, hesaplar, denetim izi | yönetici |
| `/ziyaretci` | ziyaretçi kayıt masası + günün listesi | girişli (rol aranmaz) |
| `/ziyaretci/sorular` | kayıt soruları, şık → bilgilendirme eşlemesi, varsayılanlar | girişli |
| `/ziyaretci/oyna/[id]` | **hesapsız** — ziyaretçi tableti, bilgilendirmeler sırayla | ziyaretçi |
| `/kiosk` | **hesapsız** — sicil/kart + PIN | herkes |

**Genişlik tek yerde:** `.sayfa-kap` / `.sayfa-govde` (`globals.css`). Kokpit
sayfası kendi `max-w`ini SEÇMEZ — başlık şeridi de aynı kaptan geçer, yoksa
sayfalar arasında içerik sağa sola kayar. Kiosk, giriş ve oynatıcı bilerek
dışarıda.

## Ziyaretçi

Ziyaretçi **personel değildir**: sicili, amiri, PIN'i, atama kuralı yoktur ve
panoya düşmez. Kendi defterinde yaşar (`ziyaretci*` tabloları, `ziyaretciDepo.ts`).
Personel listesine karıştırmak, fabrikanın tamamlanma oranını her ay yüzlerce
misafirle sulandırırdı.

- **Sınav yok.** Soru havuzu boş bırakılır; `oturumTamamla` bunu zaten "okudum,
  onaylıyorum" kaydı sayar. Havuza tek soru eklemek akışı bozar.
- **Deneme hakkı yok.** Tamamlanana kadar listede kalır, tablet tekrar açılır;
  yarım oturum yeniden kullanılır (yenilenen sayfa yeni satır açmaz).
- **İmza PIN değil ONAY.** `EgitimOyun` üçüncü kip olarak `imzaKipi="onay"`
  taşır — ayrı bir oynatıcı YAZILMAZ, ikisi zamanla ayrışır.
- **Soru → bilgilendirme eşlemesi VERİDİR**, kodda değil. Fabrika kendi
  sorusunu yazar; kurulum için yazılımcı gerekmez. Varsayılanlar kayıt
  masasında kaldırılamaz.

## Sınavlar

- `npm test` — saf mantık ve şema (kurallar · sinav · anomali · csv · pin ·
  sinir · yetki · ziyaretci · qr · aktarım · paket · erişilebilirlik ·
  oynatıcı · sürüm · pptx · yayın kontrolü · pdf metin · pdf başlık ·
  kart görseli · oturum kapanışı · **tasarım dili** · **tarih preset** ·
  yükseltme · güvenlik), 33 dosya / ~1400 doğrulama.
- `npm run e2e` — GERÇEK tarayıcı + GERÇEK sunucu, tüm zincir. Geçici veri
  klasörü kurar, kurulumun verisine dokunmaz. **Playwright gerekir:**
  `npm install --no-save playwright && npx playwright install chromium`.
  **Bugün 193/193.**
- `node scripts/yuk.mjs` — fabrika ölçeğinde başarım (1000 kişi · 60 eğitim ·
  20 000 kayıt). Kabul ölçütü: kiosk 1 sn, kokpit 3 sn. Ölçüt aşılırsa çıkış
  kodu 1. **Demo veride görünmeyen kareli maliyetler yalnız burada çıkar.**

**İkisi de gerekli, biri diğerinin yerini tutmaz.** Birim sınavlar
küçültülmemiş kod koşar: SWC'nin `ayiriciBul`ı bozduğu hatayı (parametre
yakalayan yardımcı satır içine alınırken serbest değişken kalması) yalnız
uçtan uca sınav yakaladı. Bu yüzden **parametre yakalayıp birden çok kez
çağrılan yardımcı yazmayın** — modül seviyesine alın.

## Kalanlar

OPM adaptörü (v1.5) · self-host kurulum paketi/Docker · SMS dürtme modülü (v2).
MVP dışı bırakılanlar `docs/KAPSAM.md`te listeli.

**SÜRÜMLÜ YAYIN — BİTTİ (3/3). Tasarım ve yapılanlar: `docs/SURUMLU-YAYIN.md`.**
Taslak ile yayın ayrı iki nesne: `yayinSurum/yayinSayfa/yayinSoru` tabloları
"Yayınla" anının anlık görüntüsünü tutuyor. Editör her zaman TASLAĞA yazar
(kilit yok), saha her zaman son yayınlanan sürümü oynatır, puanlama oturumun
kendi sürümünden yapılır. Yayındaki eğitimi düzenlemek için artık kiosktan
düşürmek gerekmiyor; "Sahadan indir" gerçekten sahadan indirir.
Kapsam dışı bırakılan: sürüm karşılaştırma (diff) ekranı.
