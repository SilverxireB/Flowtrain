# Hat D → Çekirdek istekleri

Kiosk · oynatıcı · ziyaretçi · kalite hattının paylaşılan dosyalardan ihtiyaç
duyduğu değişiklikler. Hiçbiri hattı bloklamadı; her maddede "bugün ne
yapıldı" yazılı.

---

## 1. Görsel için alt metni alanı yok — **erişilebilirlik**

**Dosya:** `src/lib/tipler.ts` (`Medya`), `src/lib/depo.ts` (`medyaKaydet`).

**Sorun.** Kiosk kartındaki görsel çoğu zaman süs değil, KURALIN KENDİSİ:
doğru kaldırma duruşu, doğru KKD, doğru istifleme. Ekran okuyucu kullanan
kişiye o görselden hiçbir şey ulaşmıyor. `Medya.ad` var ama o dosya adı
("IMG_2841.jpg"), açıklama değil.

**İstenen.** `Medya`ya `altMetin?: string` ve editörde tek satırlık bir alan.
Ya da sayfa/soru düzeyinde `gorselAciklama?: string[]`.

**Bugün ne yapıldı.** Alt metni kartın BAŞLIĞINDAN ve sıradan türetiliyor
(`"Yüksekte çalışma — görsel 2/3"`). Görselin ne gösterdiğini söylemiyor ama
en azından varlığını ve bağlamını söylüyor. Sınav `tests/erisim.test.mjs`
altsız hiçbir `<img>` kalmadığını bekliyor.

---

## 2. Kiosk'ta odak halkası ve dokunma hedefi için sınıf eksikleri

**Dosya:** `src/styles/globals.css` (paylaşılan, dokunulmadı).

Kioskta simge-yalnız bir dokunma hedefi (çıkış ×) 72px olmalı ama görünüşte
sade kalmalı. Kokpitin `.btn-icon`ı 36px ve eldivenle ıskalanıyor.

**İstenen.**

```css
.kiosk-btn-ikon {
  @apply inline-grid h-[72px] w-[72px] shrink-0 place-items-center rounded-2xl
    text-muted transition-colors hover:bg-line/60 hover:text-ink
    focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent-soft;
}
```

**Bugün ne yapıldı.** Aynı ölçüler `EgitimOyun.tsx` içinde satır içi Tailwind
sınıflarıyla yazıldı. Çalışıyor ama kural tek yerde durmuyor; ikinci bir
simge düğmesi eklenirse kopyalanacak.

---

## 3. Zamanlanmış görev (cron) yok — KVKK temizliği sayfa açılışına bağlı

**Dosya:** kurulum/işletim tarafı, `scripts/kur.mjs`.

**Sorun.** Ziyaretçi saklama süresi (KVKK) dolan kayıtları silmek için bir
tetikleyici gerekiyor. Kapalı ağda kutu tek başına duruyor; arka planda
koşan hiçbir şey yok.

**Bugün ne yapıldı.** Temizlik `/ziyaretci` sayfası her açıldığında koşuyor
(`zdepo.eskileriTemizle()`), artı `/ziyaretci/sorular` sayfasında elle
tetikleme düğmesi var. Ziyaretçi listesi günde onlarca kez açıldığı için
pratikte işliyor. **Açık:** kayıt masası bir hafta hiç açılmazsa temizlik de
o kadar gecikir. Sürenin kendisi "en az N gün" olarak yorumlandığından bu
KVKK açısından yanlış yönde bir gecikme değil, ama kesin de değil.

**İstenen.** Sunucu açılışında bir kez koşan ve sonra günde bir tekrarlayan
küçük bir zamanlayıcı (`instrumentation.ts` ya da `kur.mjs` içinde işletim
sistemi görevi).

---

## 4. `Oturum`da "yarım kaldı" sebebi tutulmuyor

**Dosya:** `src/lib/tipler.ts` (`Oturum`), `src/lib/depo.ts`
(`eskiOturumlariKapat`).

**Sorun.** Ağ koptuğunda ya da tablet kapandığında oturum `bitis` damgası
olmadan kalıyor; iki saat sonra `eskiOturumlariKapat` onu `iptal` yapıyor.
Doğru davranış — deneme hakkı yanmıyor. Ama `notlar` alanı boş kaldığı için
kayıt defterinde "PIN kilidi yüzünden mi, ağ koptuğu için mi, işçi bıraktığı
için mi" ayırt edilemiyor.

**İstenen.** `eskiOturumlariKapat` kapattığı satıra `notlar = "süre aşımı"`
yazsın (`oturumIptal` zaten denetim izine sebep yazıyor, oraya da `notlar`
eklenebilir).

**Bugün ne yapıldı.** Ayrım yok. Kiosk tarafında ağ kopması artık kullanıcıya
GÖRÜNÜYOR (şerit) ve düğmeler ölmüyor, ama defterdeki iz aynı.

---

## 5. (Bilgi) Yarım oturumun sözleşmesi — çevrimdışı davranış

Diğer hatların bilmesi için, karar burada verildi:

| Durum | Ne olur |
|---|---|
| Oturum açıldı, ağ koptu, kişi içerikte | Ekranda turuncu şerit; içerik yerelde, akış sürer. |
| Kişi "Onayla ve bitir"e bastı, ağ yok | Hata mesajı, **kilit açılır**, tekrar denenebilir. Oturum sunucuda AÇIK kalır. |
| Kişi vazgeçti / tablet kapandı | Oturum açık kalır; 2 saat sonra `eskiOturumlariKapat` → `iptal`. Deneme hakkı **yanmaz**. |
| Kayıt yazıldı, dış hedefe gönderim başarısız | `senkron = "hata"`, kayıt yerelde durur ve yeniden denenir. **Kayıt sessizce düşmez.** |

Kiosk hiçbir zaman "kayıt alındı" demeden kaydı almış saymaz: sonuç ekranı
yalnız sunucu cevabından sonra çizilir.

---

## 6. (Bilgi) Sınav koşucusuna iki bayrak eklendi

**Dosya:** `tests/kos.mjs`, `tests/cozucu.mjs` (ikisi de Hat D'nin).

`npm test` artık şu iki bayrakla koşuyor:

- `--conditions=react-server` — `server-only` paketi bu koşulda boş modüle
  çözülüyor. Onsuz depoya dokunan hiçbir dosya sınavda içeri alınamıyordu.
- `--import tests/cozucu.mjs` — uzantısız (`./arama`) ve takma yollu
  (`@/lib/...`) içe aktarımları çözüyor. İkisi de kaynakta var ve düz Node
  ESM bulamıyor.

Küçültme ya da dönüştürme YOK: birim sınavlar küçültülmemiş kaynağı koşmaya
devam ediyor (`CLAUDE.md` — SWC tuzağı). Değişen tek şey dosyanın nerede
arandığı. Bunun getirisi: `depo.ts`, `rapor.ts`, `kayitAktarim.ts` gibi o
güne kadar sınavlanamayan dosyalar artık sınavlanıyor.
