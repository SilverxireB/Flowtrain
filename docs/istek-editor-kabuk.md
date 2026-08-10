# Editör kabuğu — gezinme ve düzen (hat: editör)

Kırk kartlık bir eğitimde editör tek uzun dikey listeydi: kart haritası yok,
sürükle-bırak yok, bölüm yok. Bu not yapılan işi değil, **verilen kararları ve
gerekçelerini** kaydeder — kodu okuyan kişi "neden böyle" sorusunu burada
cevaplasın.

Dokunulan dosyalar: `src/app/egitimler/[id]/` altındaki `Editor.tsx`,
`eylemler.ts`, `page.tsx` ve yeni açılan `KartHaritasi.tsx`, `BolumAyraci.tsx`,
`bolumler.ts`. Paylaşılan dosyalara (`src/lib/**`, `src/app/eylemler.ts`,
`globals.css`) ve diğer hatların dosyalarına (`src/components/editor/**`,
`src/components/oyun/**`, `tests/**`) dokunulmadı.

---

## 1. Düzen kararı: harita ÜÇÜNCÜ SÜTUN DEĞİL, KENAR BOŞLUĞUNDA RAY

**Karar.** Geniş ekranda (≥1760px) kart haritası, sayfanın solunda **sabit
(fixed) dar bir ray** olarak duruyor; kabın dışında, iki yanda zaten boş duran
alanda. Bu genişliğin altında ray gizleniyor ve harita **çekmeceye** düşüyor
(başlıktaki "Kart haritası" düğmesi açıyor, kart seçilince kapanıyor).
**Editör ve önizleme bugünkü genişliklerini AYNEN koruyor.**

**Neden üçüncü sütun değil.** Kokpitin genişliği tek yerde sabit:
`.sayfa-kap` = `max-w-7xl` (80rem / 1280px, `globals.css`). Yani ekran 1920 de
olsa 2560 de olsa içerik 1280px'te kalıyor ve iki yanda 300–600px boşluk
duruyor. Haritayı ızgaraya üçüncü sütun olarak koysaydık:

| | bugün (xl) | 3 sütun olsaydı |
|---|---|---|
| editör | ~768px | ~560px |
| önizleme | 416px | 416px |
| harita | — | 192px |
| **kullanılmayan kenar boşluğu (1920px'te)** | 2 × 320px | 2 × 320px |

Yani harita 192px'i **editörden** alırdı, boşluktan değil — ve 2560px'lik bir
monitörde bile editör daralmaya devam ederdi. Kart satırında yan yana duran
160px'lik görsel küçük resimleri 560px'te ikiye düşüyor; asıl işin yapıldığı
sütunu daraltıp ekranın yarısını boş bırakmak savunulabilir değil.

**Neden önizleme küçültülmedi.** Canlı önizleme bu editörün en değerli parçası:
kiosk kartının KENDİSİNİ çiziyor. 416px zaten kiosk kartının küçültülmüş hâli;
daha da daraltmak önizlemeyi "fikir veren küçük resim"e çevirirdi, oysa değeri
"sahada göreceğin şey bu" diyebilmesinde.

**Rayın konumu kabın soluna bağlı** (`left: max(0.75rem, 50vw − 53.5rem)`),
ekranın soluna değil: 2560px'lik bir monitörde sabit `left` rayı içerikten
yarım ekran uzağa düşürür, göz o mesafeyi her kart seçiminde kat ederdi.

**Eşik neden 1760px.** Ray 192px + 2 × 16px nefes payı ≈ 224px'lik bir kenar
boşluğu istiyor; `(1760 − 1280) / 2 = 240px`. 1440/1536'lık dizüstü ekranlarda
boşluk yetmiyor, orada harita çekmece. Çekmece kart seçilince kapanıyor: açık
kalsaydı, atladığı kartın üstünü örterdi.

**Dar ekran.** `Düzenle | Önizleme` sekmeleri olduğu gibi duruyor; harita
düğmesi onların yanında. Haritadan kart seçmek "Düzenle" sekmesine de geçiyor,
yoksa tıklama görünmeyen bir listeyi kaydırırdı.

---

## 2. Bölüm başlıkları: `ayar` tablosunda JSON, şema değişmeden

**Karar.** Bölüm başlıkları `ayar` tablosuna, eğitim başına tek satır olarak
yazılıyor: anahtar `bolumler:<egitimId>`, değer `{ "<sayfaId>": "Acil durum" }`.
"Bu kartın ÜSTÜNDE bölüm başlar" demek. Kod: `bolumler.ts` +
`bolumBasligiEylem`.

Üç kısıt da sağlanıyor:

- **(a) yeni sütun/tablo yok.** `ayar` tablosu zaten var ve zaten JSON blob
  tutuyor — `ziyaretciDepo.ts` varsayılan bilgilendirme listesini aynı yolla
  saklıyor. Desen yeni değil, taklit edilen desen.
- **(b) kioskta fazladan kart görünmez.** Bölüm başlığı bir `Sayfa` değil;
  `sayfalariGetir` onu hiç görmüyor, oynatıcı, dışa aktarım ve yükseltme
  betiği hiç etkilenmiyor. İşçinin ekranında karşılığı YOK.
- **(c)** gerekçe bu dosyada.

**Neden "başlığı `## ` ile başlayan kart" değil.** Denenmesi en kolay yol
buydu ve (b)'yi ihlal ediyor: o kart gerçek bir karttır, kioskta işçinin önüne
düşer ve başlığında `## ` yazar. Kartı kioskta gizlemek için oynatıcıya süzgeç
koymak gerekirdi — yani kiosk hattının dosyasına bölüm mantığı sızardı ve
"kaç kart var" sayısı editörle kioskta ayrışırdı.

**Neden `sira` aralıkları değil.** Sıra numarasına bağlanan başlık, araya tek
kart eklendiğinde hepsi birden kayardı. Karta bağlıyken bölüm **kendi ilk
kartıyla birlikte taşınıyor** — kartı sürükleyince bölüm de gidiyor.

**Neden localStorage değil.** Başlık makineye değil eğitime ait; ikinci bir
hazırlayan aynı eğitimi açtığında aynı bölümleri görmeli.

**Öksüz kayıt.** Bölümün ilk kartı silinince ayar satırında karşılıksız bir
kayıt kalıyordu ve hiçbir ekranda görünmediği için elle de temizlenemiyordu:
`bolumleriCoz` hem okumada hem yazmada var olan sayfa kimliklerine göre
süzüyor, satır ilk yazımda kendiliğinden toparlanıyor.

**Arayüz.** Kart listesinde iki kartın arasında, **fare gelince beliren** ince
bir "+ Bölüm başlığı" bağlantısı. Kırk kartın kırkında sürekli duran bir düğme
listeyi gürültüye çevirir ve asıl işi — kart içeriğini — bastırırdı. Yazılmış
başlık kalıcı olarak görünüyor ve haritada da bölüm ayracı olarak çiziliyor.

---

## 3. Sürükle-bırak sıralama

- **Kütüphane yok** (altın kural 8): HTML5 `draggable` + `dragover`/`drop`.
- **Tutamak var, kartın tamamı sürüklenmiyor.** Kart gövdesi metin alanlarıyla
  dolu; sürüklenebilir bir kutuda metin seçmek imkânsızlaşıyor.
- **▲▼ düğmeleri DURUYOR.** Sürükleme dokunmatikte zor, klavyeyle imkânsız.
- **Bırakma yeri araya çizilen çizgiyle** belli oluyor. Çizgi mutlak konumlu:
  akışa girseydi imlecin altındaki kart her kıpırdanışta kayar, hedef titrerdi.
- **Tek yazım.** Yeni sıra tamamı hesaplanıp `sayfalariSiralaEylem`e bir kez
  gönderiliyor; yarım sıralama listeyi bozardı. Sıra değişmiyorsa hiç yazılmıyor.
- **Haritada da sürüklenebiliyor.** Kırk kartlık listede kartı otuz sıra yukarı
  taşımak, editör satırında ekranı sürekli kaydırmak demek; haritada kaynak da
  hedef de aynı ekranda.

## 4. Klavye

| Kısayol | Ne yapar |
|---|---|
| `Alt` + `↑` / `↓` | önceki/sonraki karta gider, seçer ve ilk alanına odaklanır |
| `Ctrl` + `↑` / `↓` | odaktaki kartı bir sıra yukarı/aşağı taşır |
| `Esc` | harita çekmecesini kapatır |

`Alt` kısayolu **belge seviyesinde**: hazırlayan hangi alanda yazıyor olursa
olsun çalışmalı, yoksa "önce listeye tıkla" adımı geri gelirdi. Prova (▶ Dene)
açıkken susuyor — orada ekranda editör değil kiosk var.

`Ctrl+↑/↓` için kart başına geri çağrı üretilmedi; **tek dinleyici** liste
kabında duruyor ve taşınacak kartı odaktan `data-kart` niteliğiyle buluyor.
Satır başına kapanış, `SayfaSatiri` sarmalayıcılarını her çizimde tazelerdi.

## 5. Başarım — bozulmayan şeyler

`SayfaSatiri`/`SoruSatiri` üzerindeki `memo` düzeni **aynen duruyor**: yeni geri
çağrıların hepsi `useCallback` ile kararlı, sürükleme durumu satırlara değil
**sarmalayıcı `div`e** bağlı, `dragover` aynı aralık için durum yazmıyor.
Harita satırları her tuş vuruşunda yeniden kuruluyor — bu İSTENEN davranış
(başlık yazılırken haritadaki "(başlıksız)" anında düzeliyor) ve satırlar
`SayfaSatiri`ye göre çok hafif (üç metin + bir simge).

---

## Eksikler ve diğer hatlara istekler

1. **`kartSorunlu` iki yerde yaşıyor.** Haritadaki uyarı noktası, yayın kontrol
   listesiyle aynı ölçütleri kullanıyor ama ölçütler `Editor.tsx` içinde
   yeniden yazıldı: ortak yardımcı `src/components/editor/YayinKontrol.tsx`e
   girmeliydi, orası kart hattının dosyası. **İstek (kart hattı):**
   `yayinKontrolu`nun yanına `kartSorunlu(sayfa, kirikIdler): boolean` ya da
   satır başına sorun döndüren bir sürüm eklenirse harita onu kullanır ve iki
   ölçüt bir daha ayrışamaz. Bugün ayrışırsa harita yalan söyler.
2. **Bölüm başlıkları yayındaki eğitimde salt okunur.** Bilinçli (yayındayken
   hiçbir şey değişmez) ama bölüm içeriğin parçası değil; ileride gevşetilmek
   istenirse `bolumBasligiEylem`deki `taslakMi` kapısı kaldırılır.
3. **Bölüm başlıkları eğitim kopyalanınca taşınmıyor.** `egitimKopyala`
   (`src/lib/depo.ts`, paylaşılan dosya) sayfa kimliklerini yeniden üretiyor;
   eski kimliklere bağlı bölüm haritası kopyada karşılıksız kalıyor ve
   `bolumleriCoz` onu eliyor — yani kopya bölümsüz açılıyor, bozuk değil ama
   eksik. **İstek (depo/çekirdek hattı):** `egitimKopyala` eski→yeni sayfa
   kimliği eşlemesini döndürürse editör hattı bölüm haritasını da kopyalar.
4. **`.sayfa-kap` 80rem'de sabit.** Bu karara saygı duyuldu (rule: `globals.css`
   paylaşılan dosya) ve düzen ona GÖRE kuruldu. Kokpit genişliği ileride
   büyütülürse bu notun 1. bölümündeki hesap yeniden yapılmalı.
