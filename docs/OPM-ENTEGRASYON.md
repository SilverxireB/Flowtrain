# FlowTrain ↔ OPM Entegrasyonu

Bu belge **kurumun kendi yazılımcıları içindir.** FlowTrain tekil çalışan bir
üründür; OPM ile yarışmaz, OPM'i beklemez. Personel listesini ve eğitim
kaydını OPM'e bağlamak istediğinizde dolduracağınız yer **iki dosya** ve
**bir ayar ekranıdır**. Çekirdeğe dokunmanız gerekmez ve dokunmamalısınız.

| | |
|---|---|
| Sözleşme | `src/lib/adaptor.ts` |
| Doldurulacak iskeletler | `src/lib/adaptorlar/opmPersonel.ts` · `src/lib/adaptorlar/opmKayit.ts` |
| Yapılandırma | `src/lib/adaptorlar/opmYapilandirma.ts` (anahtar adları) + `/ayarlar` ekranı |
| Seçim | `src/lib/adaptorlar/index.ts` |
| Sınır sınavı | `tests/sinir.test.mjs` |

---

## 0. Tek cümlelik mimari

Çekirdek **personelin nereden geldiğini ve kaydın nereye gittiğini bilmez.**
İki arayüz vardır; ekranlar yalnız onları çağırır:

```
PersonelKaynagi   ← CSV dosyası (varsayılan)  |  OPM webservice
KayitHedefi       → kayitlar.csv (varsayılan) |  OPM webservice
```

Bu yüzden OPM'i takmak **hiçbir ekranı değiştirmez.** Değiştirmesi gerekiyorsa
bir yerde sınır sızmış demektir; `npm test` bunu yakalar (bkz. §8).

---

## 1. `PersonelKaynagi` sözleşmesi

```ts
interface PersonelKaynagi {
  ad: string
  listele(): Promise<Kisi[]>
  bul(sicil: string): Promise<Kisi | null>
  ekip(amirSicil: string): Promise<Kisi[]>
  tazele?(): void
  yonetim?: PersonelYonetimi
}
```

| Metot | Alır | Döner | Hata durumunda |
|---|---|---|---|
| `listele()` | — | Tüm aktif personel | **Son bilinen listeyi döndürün** (§3). Hiç yoksa `throw`. Boş dizi DÖNDÜRMEYİN. |
| `bul(sicil)` | Sicil (kırpılmış) | `Kisi` ya da `null` | `null` = "böyle biri yok". Ağ hatası için `null` DÖNDÜRMEYİN — kiosk kişiyi işten çıkmış sanır. |
| `ekip(amirSicil)` | Amirin sicili | O amire bağlı kişiler | `listele()` ile aynı |
| `tazele()` | — | — | Önbelleği düşürür. Ayarlar'daki "yeniden oku" düğmesi bunu çağırır. |
| `yonetim` | — | — | **OPM'de `undefined` bırakın.** Bkz. §6. |

`Kisi` (çekirdek tip, `src/lib/tipler.ts`) — **genişletmeyin:**

```ts
interface Kisi {
  sicil: string          // zorunlu; boşsa kayıt ATILIR
  ad: string
  bolum?: string         // TÜRETİLİR — OPM'den gelse bile yok sayılır
  hat?: string
  gorev?: string         // 'Amir' ya da serbest metin; atama kuralları buna bakar
  amirSicil?: string     // TÜRETİLİR — OPM'den gelse bile yok sayılır
  iseGiris?: string      // ISO tarih; "işe girişten sonraki N gün" kuralı buna bakar
}
```

`listele()` **her ekran açılışında** çağrılır (hub, atama, kayıtlar, ayarlar ve
her kiosk girişinde). Önbellek zorunludur — iskelette hazırdır.

---

## 2. Beklenen veri biçimi

### 2.1 Kayıt üç alandır

```json
{ "sicil": "10432", "adSoyad": "Ayşe Yılmaz", "maliyetMerkezi": "MM-4120" }
```

**Bölüm ve amir OPM'den GELMEZ.** Gönderseniz bile yok sayılır. Sebebi:
FlowTrain'de bölüm/amir gerçeği `mmEsleme` tablosudur ve fabrika onu kendi
ekranından yönetir. İki gerçek yarışırsa her aktarım el emeğini ezer ve kimse
ezildiğini fark etmez.

İsteğe bağlı, varsa okunur: `gorev`, `hat`, `iseGiris`.
`gorev` **önerilir** — atama kuralları görev bazlı yazılabiliyor.

### 2.2 Alan adları esnektir

`opmPersonel.ts` içindeki `TAKMA` tablosu şu adları tanır (ilk dolu olan alınır):

| Alan | Tanınan adlar |
|---|---|
| sicil | `sicil`, `sicilNo`, `personelNo`, `registryNumber`, `employeeId`, `id` |
| ad | `ad`, `adSoyad`, `adiSoyadi`, `isim`, `name`, `fullName`, `nameAndSurname` |
| maliyet merkezi | `maliyetMerkezi`, `mm`, `costCenter`, `costCenterCode`, `maliyetMerkeziKodu` |
| görev | `gorev`, `görev`, `unvan`, `pozisyon`, `title`, `position`, `role` |
| işe giriş | `iseGiris`, `işeGiriş`, `girisTarihi`, `hireDate`, `startDate` |
| hat | `hat`, `line`, `uretimHatti` |

Servisiniz başka bir ad kullanıyorsa **tabloya bir satır ekleyin** — dönüştürücü
yazmayın.

### 2.3 Gövde sarmalayıcısı

Yanıt ya doğrudan bir dizidir ya da şu anahtarlardan biriyle sarılıdır:
`veri` · `data` · `items` · `kayitlar` · `personel` · `result`.
Başka bir sarmalayıcı varsa `listeyiCikar()` içine ekleyin.

### 2.4 Sayfalama

Servis 500'er kayıt döndürüyorsa döngü **yalnız `opmListesiniCek()` içine**
girer. Önbellek, hata davranışı, eşleme — hiçbiri değişmez.

### 2.5 Maliyet merkezi eşlemesi nasıl çalışır

```
OPM kaydı:  sicil · ad · maliyetMerkezi
                              │
                              ▼
                    mmEsleme tablosu  (kod → bölüm, amirSicil)
                              │
                              ▼
Kisi:       sicil · ad · bolum · amirSicil
```

- Tablo `/personel` ekranından yönetilir; **veridir, kod değildir.**
- Kural tek yerde: `src/lib/adaptorlar/mmTuretme.ts`. CSV adaptörü de aynı
  yardımcıyı kullanır — ayrıştırırsanız aynı fabrikada iki farklı bölüm gerçeği
  doğar.
- Kod tanımsızsa `bolum` ve `amirSicil` **boş kalır** (uydurulmaz). Böyle
  kişiler hiçbir amirin ekibinde görünmez; Ayarlar'daki "Amir sütunu doluluk"
  satırı ve "bağlantıyı sına" çıktısı bunu sayar.
- Eşleme sonradan tanımlandığında `tazele()` + yeniden okuma yeter.

---

## 3. Ağ hatası davranışı — **karar verilmiştir**

> **OPM'e ulaşılamazsa SON BİLİNEN LİSTE döner. Boş liste dönmez.**

Gerekçe: boş liste "kimse yok" demektir, "bilmiyorum" demez. Boş dönseydi
OPM'in birkaç dakikalık kesintisinde kiosk hiçbir sicili tanımaz, amir
tabletinde ekipler boşalır, panodaki tamamlanma oranı anlamsızlaşırdı. Fabrika
çalışmaya devam ediyorsa eğitim de devam etmelidir; iki saatlik bayat bir
personel listesiyle eğitim vermek, hiç verememekten iyidir.

Uygulanan sıra:

1. Bellek önbelleği taze mi? → onu döndür (varsayılan 10 dk, ayardan değişir)
2. OPM'i oku → başarı: önbelleğe **ve diske** yaz, döndür
3. Hata:
   - **Yapılandırma eksikse `throw`** — bayat listeye düşülmez; yarım kurulum
     "çalışıyor" gibi görünmemeli
   - bellek önbelleği (bayat olsa da) varsa → onu döndür
   - disk anlık görüntüsü (`<veri>/opm-personel-son.json`) varsa → onu döndür
     *(süreç yeniden başladığında bellek boştur; OPM hâlâ kapalıysa fabrika
     yine kimseyi tanımazdı)*
   - hiçbiri yoksa → **`throw`**, boş dizi değil

Bayatlık gizlenmez: `/ayarlar` son başarılı okumayı ve son hatayı yazar.

**200 + boş dizi de hatadır.** Yanlış uç nokta çoğu zaman böyle yanıt verir ve
"fabrikada kimse çalışmıyor" gibi görünürdü.

---

## 4. `KayitHedefi` sözleşmesi

```ts
interface KayitHedefi {
  ad: string
  gonder(oturum: Oturum): Promise<void>
}
```

| | |
|---|---|
| Başarı | `resolve` |
| Başarısızlık | **`throw`.** Yutmayın. |

Zincir:

```
gonder() throw
   → adaptorlar/index.ts → kaydiGonder() false döner (+ sebebi saklar)
   → depo.senkronIsaretle(id, "hata")
   → depo.bekleyenSenkronlar() kaydı listeler
   → /ayarlar → "N kaydı yeniden gönder" düğmesi
```

`gonder` içine `try/catch {}` yazmak bu zincirin tamamını sessizce koparır;
kaybolan kayıt aylar sonra denetimde ortaya çıkar. **Satılan şey kayıttır.**

Kayıt **her hâlükârda** yerel veritabanında durur — gönderilememesi kaydı
geçersiz kılmaz, yalnız "gönderilmedi" işaretler.

### 4.1 Dışarı verilen alanlar (`opmKayitGovdesi`)

```json
{
  "oturumId": "…",
  "sicil": "10432",
  "egitimId": "…",
  "egitimSurum": 3,
  "baslangic": "2026-02-11T07:41:00.000Z",
  "bitis": "2026-02-11T07:58:00.000Z",
  "puan": 80,
  "sonuc": "gecti",
  "kaynak": "kiosk",
  "gozeten": null,
  "egitmen": null,
  "cihaz": "hat-3-kiosk",
  "notlar": null
}
```

- `sonuc`: `gecti` · `kaldi` · `iptal` (`iptal` = yarıda kesilmiş, geçme/kalma
  sayılmaz)
- `kaynak`: `kiosk` · `amir` · `sinif` · `aktarim` — kaydın nereden doğduğu
- `gozeten`: doluysa oturum amir gözetiminde yapılmıştır (kâğıt imzadan güçlü
  bir denetim kaydıdır)
- **Gönderilmeyenler:** `sayfaSureleri` ve `sorulanSoruIdleri` (bizim içerik
  geri bildirimimiz, kurumun arşivinde işi yok ve gereksiz kişisel veri
  taşırdı), `senkron` (bizim gönderim defterimiz)

### 4.2 Tekrar gönderim

Aynı `oturumId` birden çok kez gelebilir (yeniden deneme düğmesi). **Yineleme
denetimi OPM tarafındadır**; `oturumId` benzersiz anahtardır. FlowTrain 409'u
başarı SAYMAZ — "zaten var"ı başarı saymak, gerçekten reddedilen kaydı da
başarı saymanın kapısını açar. Yinelemeyi sessizce yutmak istiyorsanız
servisiniz 200 döndürsün.

---

## 5. Nasıl takarım — adım adım

1. **`opmPersonel.ts` içindeki `opmListesiniCek()`u kendi yanıtınıza uydurun.**
   Çoğu kurulumda hiç değişiklik gerekmez; gerekirse `TAKMA` tablosuna alan adı
   ya da `listeyiCikar()` içine sarmalayıcı adı ekleyin. Sayfalama varsa
   döngüyü buraya yazın.
2. **`opmKayit.ts` gövdesini servisinizin beklediği şemaya uydurun**
   (`opmKayitGovdesi`). Alan adlarını değiştirmeniz yetiyorsa başka yere
   bakmayın.
3. **Ayarlardan açın:** `/ayarlar` → *Personel kaynağı ve kayıt hedefi*
   - Personel kaynağı → `OPM webservice`
   - Kayıt hedefi → `OPM webservice`
   - OPM adresi (ör. `http://10.20.0.9:8080`), uç noktalar, kimlik başlığı ve
     anahtarı, zaman aşımı, önbellek süresi
4. **"Bağlantıyı sına"ya basın.** Personel ayağı gerçekten okur ve kaç kişi
   geldiğini, kaçının maliyet merkezi eşlemesinin tanımsız olduğunu söyler.
   Kayıt ayağı yalnız yapılandırmayı denetler — sınama düğmesi kurumun eğitim
   arşivine sahte satır yazmaz.
5. **Maliyet merkezi eşlemesini doldurun** (`/personel` → MM eşlemesi). Eksik
   kodlar sınama çıktısında listelenir.
6. `npm test` ve `npm run build` çalıştırın.

Ayar anahtarları (`ayar` tablosu, hepsi `/ayarlar`dan yazılır):

| Anahtar | Varsayılan | Ne |
|---|---|---|
| `personelKaynagi` | `csv` | `csv` \| `opm` |
| `kayitHedefi` | `dosya` | `dosya` \| `opm` |
| `opmTemelAdres` | — | `http(s)://makine:port`, sonunda `/` yok |
| `opmPersonelYolu` | `/api/personel` | temel adrese eklenir |
| `opmKayitYolu` | `/api/egitim-kaydi` | temel adrese eklenir |
| `opmKimlikBasligi` | `X-API-Key` | kimliğin taşındığı HTTP başlığı |
| `opmKimlikAnahtari` | — | **sır** — ekrana geri dönmez, denetim izine değeri yazılmaz |
| `opmZamanAsimiMs` | `8000` | en az 500 |
| `opmOnbellekDk` | `10` | `0` = önbellek yok |

**Adres koda yazılmaz.** Kaynakta tek bir dış adres yoktur ve olmamalıdır
(§8, kural 7). Kimlik anahtarı yalnız `ayar` tablosunda durur; ağ seviyesinde
korunan servislerde boş bırakılabilir.

### Varsayılan neden değişmiyor

Ayar yoksa ya da tanınmayan bir değer taşıyorsa **CSV + dosya** kullanılır:
ürünün standart sürümü odur ve yanlış yazılmış tek bir satır kurulumu
kilitlememeli. Ama `opm` **açıkça** seçilmişse sessizce CSV'ye düşülmez —
eksik yapılandırma gürültülü hata verir. Sessiz düşüş, entegrasyonun çalıştığı
sanılırken çalışmaması demektir; en pahalı hata biçimi budur.

---

## 6. `yonetim` neden boş — ve neden boş kalmalı

`PersonelKaynagi.yonetim` **kaynağın yönetilebilir yüzüdür.** CSV adaptöründe
doludur (dosyayı biz yazıyoruz), OPM adaptöründe `undefined` bırakılmıştır.

- `/personel` ekranı adaptöre "sen kimsin" diye **sormaz**, yalnız bu yeteneğe
  bakar. Yetenek yoksa kendini **salt okunur** gösterir.
- Sebebi teknik değil: OPM tek yönlü okunuyorsa personeli FlowTrain'den
  düzenlemek, kurumun İK gerçeğinin yanına ikinci bir gerçek koymaktır. İlk
  senkronda o el emeği silinir ve kimse silindiğini fark etmez.
- Bir gün OPM yazma uçları açarsa `PersonelYonetimi` **yalnız `opmPersonel.ts`
  içinde** uygulanır; ekran kendiliğinden düzenlenebilir hâle gelir. Yine
  hiçbir ekran değişmez.

> Bu alanı doldurmamak için hiçbir ekranda tek satır değişmedi. Sınırın
> gerçekten çalıştığının kanıtı budur.

---

## 7. DOKUNULMAYACAKLAR

| Dosya / kavram | Neden |
|---|---|
| `src/lib/tipler.ts` (`Kisi`, `Oturum`, `Egitim`…) | **OPM'e özel hiçbir alan çekirdek tiplere girmez.** `Kisi`ye `opmId` eklemek, ürünü tek müşteriye kilitler. Ek veriye ihtiyacınız varsa adaptörün içinde tutun. |
| `src/lib/kurallar.ts` (atama kural motoru) | Saf mantıktır, sınavlıdır ve kaynağı tanımaz. Kural OPM alanına bakmaya başlarsa CSV müşterisinde sessizce yanlış çalışır. |
| `src/lib/adaptor.ts` (arayüzler) | Dört hattın kodu bu imzalara bağlıdır. Genişletmek gerekiyorsa **opsiyonel** alanla genişletin, imza bozmayın. |
| `src/lib/depo.ts`, `src/lib/db.ts` | Veri katmanı. OPM için yeni tablo gerekmiyor; yapılandırma `ayar` tablosuna girer. |
| Ekranlar (`src/app/**`) | Somut adaptörü doğrudan çağıran ekran = sızmış sınır. Sınav düşer (§8). |
| `Oturum` kaydının düzenlenmesi/silinmesi | Ürün kuralı: **kayıt düzenlenmez, silinmez.** Yanlış kayıt yeni bir kayıtla ve `notlar` ile düzeltilir. |

---

## 8. Sınır sınavı — `tests/sinir.test.mjs`

`npm test` içinde koşar. Ölçtükleri (OPM'i ilgilendiren maddeler):

1. **Hiçbir ekran somut adaptörü doğrudan çağırmıyor.** İzinli tek yer
   `ayarlar/page.tsx` (kurulumun gerçeğini yazan satırlar) ve `adaptorlar/`
   klasörünün kendisi.
2. **Kaynakta dış alan adı yok.** Kapalı ağ ürünüyüz; OPM adresi kurulumdan
   gelir. Koda örnek bir adres yazmak bu sınavı düşürür — örnekler bu belgede
   durur.

### Neden gevşetilmemeli

Sınırın aşınması hep aynı biçimde başlar: bir ekran "sadece şu bilgiyi
göstermek için" somut adaptörü doğrudan çağırır. Sonra bir tane daha. OPM
adaptörü devreye alındığında o çağrılar **yanlış kaynağa bakıp sessizce yanlış
sonuç verir** — hata vermez, sadece yanlış olur. Bir eğitim kaydının yanlış
olması, olmamasından beterdir.

Sınav bir dosyayı kırmızıya düşürüyorsa doğru hamle sınavı değil, çağrıyı
düzeltmektir: ihtiyacınız olan bilgi `personelKaynagi()` / `kayitHedefi()`
üzerinden gelmiyorsa arayüze **opsiyonel** bir metot ekleyin.

---

## 9. Sık sorulanlar

**OPM listeyi yavaş döndürüyor, ekranlar bekliyor.**
`opmOnbellekDk`u yükseltin. Personel listesi saatte bir değişir; 10 dakikalık
önbellek fazlasıyla tazedir.

**Ziyaretçiler de gelsin mi?**
Hayır. Ziyaretçi personel değildir: sicili, amiri, PIN'i, atama kuralı yoktur
ve panoya düşmez. Kendi defterinde yaşar (`ziyaretci*` tabloları). Personel
listesine karıştırmak, fabrikanın tamamlanma oranını her ay yüzlerce misafirle
sulandırır.

**İşten çıkanlar?**
OPM listesinden düşen kişi bir sonraki okumada listede olmaz — atamaları ve
panosu kendiliğinden kapanır. **Geçmiş oturum kayıtları silinmez** (kayıt
düzenlenmez, silinmez).

**Geçmiş eğitim kayıtlarını OPM'den alabilir miyiz?**
Bu adaptörün işi değil. `/kayitlar` ekranındaki **dış aktarım** (CSV) bunun
içindir; kayıtlar `kaynak: "aktarim"` ile düşer, böylece canlıya geçerken
kimse "eksik" görünmez.

**Kimlik anahtarını nereden okuyabilirim?**
Hiçbir yerden — ekrana geri dönmez, denetim izine değeri yazılmaz. Kaybolduysa
yenisini girin.
