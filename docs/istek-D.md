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

**✔ KARŞILANDI (2. dalga).** `Medya.altMetin` ve `depo.medyaAltMetinYaz`
çekirdeğe girdi; oynatıcı tarafı bağlandı:

- `Kart` ve `EgitimOyun` isteğe bağlı `altMetinler?: Record<string,string>`
  alıyor; yazılmış alt metni VARSA o kullanılıyor, yoksa türetilmiş metne
  düşülüyor. Soru görselinin `alt="Soru görseli"` etiketi de aynı sözlükten
  besleniyor.
- Sözlük SUNUCUDA süzülüyor (`kiosk/eylemler.ts` → `altMetinleriTopla`,
  `ziyaretci/oyna/[id]/page.tsx`): yalnız o eğitimde GEÇEN görseller iniyor.
  Kütüphanenin tamamı gitseydi, hesapsız bir uç noktadan fabrikanın eğitim
  içeriğinin dökümü çıkarılabilirdi.
- **Açık kalan:** `/ekibim` (amir tableti) `EgitimOyun`u `altMetinler`
  vermeden çağırıyor — alan isteğe bağlı olduğu için çökmüyor, ama amirin
  tabletinde alt metni yine türetilmişe düşüyor. Sahibi tek satır eklerse
  kapanır: `<EgitimOyun ... altMetinler={...} />`.

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

**✔ KARŞILANDI (2. dalga).** Sınıf `globals.css`e eklendi ve `EgitimOyun.tsx`
satır içi ölçüleri bırakıp `.kiosk-btn-ikon`a geçti. `tests/erisim.test.mjs`in
"her düğme ya kiosk sınıfı taşır ya 72px'i açıkça yazar" kuralı sınıfı zaten
tanıyor (`kiosk-btn` önekiyle eşleşiyor).

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

**✔ KARŞILANDI (2. dalga).** `eskiOturumlariKapat` artık `notlar`a sebep
yazıyor; kayıt defterinin ayrıntı penceresi `notlar` alanını zaten çiziyor,
ek iş gerekmedi.

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

---

## 7. Eğik çizgili tarih SESSİZCE gün-önce okunuyor — **veri bütünlüğü**

**Dosya:** `src/lib/kayitAktarim.ts` (`tarihiCoz`). Sahibi Hat C; Hat D
dokunmadı.

**Sorun.** Hem ekran (`kayitlar/aktarim/AktarimFormu.tsx`) hem kaynak yorumu
şunu söylüyor:

> ABD biçimi (AA/GG/YYYY) **bilerek kabul edilmiyor**, çünkü `05/03/2024` iki
> biçimde de geçerli görünür ve hangisi olduğu dosyadan anlaşılamaz.

Ayrıştırıcı ise ayırıcıya HİÇ bakmıyor: `(ham).match(/\d+/g)` ile rakamları
alıp "dört haneli parça sondaysa GG.AA.YYYY" diyor. Sonuç:

```
tarihiCoz("05/03/2024")  →  "2024-03-05"   // sessizce GÜN-ÖNCE okundu
```

Yani vaat edilen kapı yok. ABD ya da İngiliz bir sistemden gelen bir dosyada
5 Mart, deftere **3 Mayıs** olarak düşer. Kayıt silinemediği için düzeltme
yolu yeni bir kayıt açmaktır; ama kimse hatayı fark etmez, çünkü satır
"geçerli" görünür ve raporda hiçbir uyarı çıkmaz. Sertifika geçerlilik bitişi
(`tekrarAy`) de bu tarihten türediği için iki ay kayar.

**İstenen.** İkisinden biri:

1. `/` ayırıcılı tarihi REDDET (`sebep: "Eğik çizgili tarih belirsiz —
   GG.AA.YYYY ya da YYYY-AA-GG kullanın."`). Ekrandaki söz bu; en tutarlısı.
2. Ya da kabul et ama **uyarı** üret (`AktarimSatiri.uyari`) ve ekrandaki
   metni değiştir. Rapor zaten "yazılır ama kontrol edilmeli" satırlarını
   ayrı gösteriyor, altyapı hazır.

**Bugün ne yapıldı.** Hat D davranışı değiştirmedi (dosya onun değil), ama
DAVRANIŞI PİNLEDİ: `tests/guvenlik.test.mjs` içinde
`tarihiCoz("05/03/2024") === "2024-03-05"` doğrulaması var ve yanına bu notun
adresi yazılı. Düzeltme geldiğinde sınav düşer ve niçin düştüğü okunur —
sessizce değişmez.

---

## 8. (Bilgi) Asgari süre kapısı İSTEMCİDE; sunucuda karşılığı yok

**Dosya:** `src/components/oyun/EgitimOyun.tsx` (kapı),
`src/app/kiosk/eylemler.ts` (sunucu). İkisi de Hat D'nin — bu bir istek
değil, verilmiş bir KARARIN yazıya geçmesi.

**Durum.** "Süre dolmadan İleri açılmaz" kuralı yalnız istemcide duruyor.
`oturumTamamla` çağrısı el yapımı gönderilirse oturum ilk saniyede
kapatılabilir; sunucu sayfa sürelerine bakmıyor.

**Neden sunucuya kapı KONMADI.** Kapı, imza adımında reddederdi — yani işçi
eğitimi izledikten sonra "kaydınız alınmadı" duyardı ve deneme hakkı yanardı.
Saat kayması, duraklatılmış sekme ve devam eden oturum bu reddi masum
insanlara da yaşatırdı. Ürünün yazılı duruşu bu: *"Ürün kimseyi suçlamaz,
ENGELLEMEZ de — yalnız görünür kılar"* (`anomali.ts`).

**Telafi eden kontrol AYAKTA ve ölçülü.** Süre SUNUCU DAMGALARINDAN hesaplanıyor
(`anomali.gecenSure`), istemcinin gönderdiği `sayfaSureleri` toplamından değil;
kiosk oturumları da (gözeteni olmayanlar) panoda "gözetimsiz · kiosk"
başlığıyla anomaliye giriyor. `tests/guvenlik.test.mjs` uydurma bir
`sayfaSureleri` gönderip ölçünün kanmadığını doğruluyor.

**Karar gerekirse.** Sunucu tarafı bir kapı istenirse doğru yer imza adımı
DEĞİL, kaydın kendisidir: oturum yine yazılsın ama `notlar`a "süre şüpheli"
düşülsün. O zaman kayıt kaybolmaz, denetim izi de sessiz kalmaz.

---

## 9. (Bilgi) Yetki matrisi taranıyor — yeni yüzey sessizce eklenemez

`tests/guvenlik.test.mjs` `src/app/**/page.tsx` ve `**/eylemler.ts`
dosyalarını tarıyor:

- Her sayfanın istediği rol tabloda YAZILI; tabloda yeri olmayan yeni bir
  `page.tsx` sınavı düşürür (kapısız olması gerekenler ayrı listede: kiosk,
  kurulum, giriş, hub, ziyaretçi tableti).
- Her sunucu eylemi ya `kapi()`/`kapiGirisli()` çağırır ya da bilinçli
  istisna listesindedir (`girisEylem`, `cikisEylem`, `kurulumEylem`, üç kiosk
  eylemi, iki ziyaretçi oynatma eylemi). **Düğmeyi gizlemek önlem değildir:**
  Next sunucu eylemleri adreslenebilir uç noktalardır.
- Her API yolu kimlik arar; tek istisna `/api/medya/[id]` GET (kiosk
  hesapsızdır ve kart görselini oradan çeker) — onun tek savunması kimlik
  beyaz listesi, o da sınavlı.

Bu turda **kapısız kalmış tek bir yüzey ya da eylem bulunmadı.**
