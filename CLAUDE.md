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

## Tasarım Sistemi

Flow Studio dili: Plus Jakarta Sans; accent indigo `#4f46e5` (birincil aksiyon),
brand gül `#e11d48` (YALNIZ uyarı/danger), lacivert `#001e64`, nötrler
ink/paper/line/muted/wash. Kokpit yüzeyleri AYDINLIK.

**Kiosk ayrı bir yüzeydir:** eldivenle basılır → `.btn-kiosk` (min 72px),
büyük punto, az seçenek. Onaylar `ConfirmDialog` ile (native `confirm` yok).

## Mimari Notlar

- **Depo SQLite** — JSON dosya deposu bu hacimde (kişi × eğitim × deneme)
  yetmez. Veri klasörü = yedek yeri; `.gitignore`'da `data/`.
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
| `/atama` | kural motoru (bölüm/hat/görev/işe giriş/tekrar) | hazırlayan |
| `/ekibim` | amir tableti — eksikler, gözetimli oturum | amir |
| `/pano` | tamamlanma, bölüm kırılımı, anomali, CSV | hazırlayan |
| `/ayarlar` | kurulumun gerçeği, hesaplar, denetim izi | yönetici |
| `/kiosk` | **hesapsız** — sicil/kart + PIN | herkes |

## Sınavlar

- `npm test` — saf mantık (kurallar · sinav · anomali · csv), 86 doğrulama.
- `npm run e2e` — GERÇEK tarayıcı + GERÇEK sunucu, tüm zincir, 37 doğrulama.
  Geçici veri klasörü kurar, kurulumun verisine dokunmaz.

**İkisi de gerekli, biri diğerinin yerini tutmaz.** Birim sınavlar
küçültülmemiş kod koşar: SWC'nin `ayiriciBul`ı bozduğu hatayı (parametre
yakalayan yardımcı satır içine alınırken serbest değişken kalması) yalnız
uçtan uca sınav yakaladı. Bu yüzden **parametre yakalayıp birden çok kez
çağrılan yardımcı yazmayın** — modül seviyesine alın.

## Kalanlar

OPM adaptörü (v1.5) · self-host kurulum paketi/Docker · SMS dürtme modülü (v2).
MVP dışı bırakılanlar `docs/KAPSAM.md`te listeli.
