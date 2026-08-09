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

## Tasarım Sistemi

Flow Studio dili: Plus Jakarta Sans; accent indigo `#4f46e5` (birincil aksiyon),
brand gül `#e11d48` (YALNIZ uyarı/danger), lacivert `#001e64`, nötrler
ink/paper/line/muted/wash. Kokpit yüzeyleri AYDINLIK.

**Kiosk ayrı bir yüzeydir:** eldivenle basılır → `.btn-kiosk` (min 72px),
büyük punto, az seçenek. Onaylar `ConfirmDialog` ile (native `confirm` yok).

## Mimari Notlar

- **Depo SQLite** — JSON dosya deposu bu hacimde (kişi × eğitim × deneme)
  yetmez. Veri klasörü = yedek yeri. `data/` GEÇİCİ olarak repoda izleniyor
  (dummy veriyle çalışılıyor, makineler arası taşınsın diye); **canlıya
  alınırken `.gitignore`daki iki satır geri açılacak.**
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
- **`Oturum.kaynak`** kaydın nereden doğduğunu söyler: `kiosk · amir · sinif ·
  aktarim`. Sınıf eğitimi ve dış aktarım kayıtları ekranda kart döndürmeden
  `depo.oturumKaydet()` ile yazılır — her eğitim kioskta verilmez, ama kayıt
  aynı deftere düşer.
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
  oynatıcı · **yükseltme** · **güvenlik**), 16 dosya / ~760 doğrulama.
- `npm run e2e` — GERÇEK tarayıcı + GERÇEK sunucu, tüm zincir. Geçici veri
  klasörü kurar, kurulumun verisine dokunmaz. **Playwright gerekir:**
  `npm install --no-save playwright && npx playwright install chromium`.
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

Ziyaretçi tarafında kalanlar: ziyaretçi kayıtlarının CSV/PDF çıktısı ve saklama
süresi (KVKK) ayarı. Bugün kayıtlar veritabanında duruyor ama dışa aktarılmıyor.
