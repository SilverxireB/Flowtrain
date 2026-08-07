# FlowTrain — bilgisayarınızda çalıştırma

Bu belge tek bir şey için: FlowTrain'i kendi bilgisayarınızda açıp denemek.
Fabrika kurulumu da aynı adımlar (fark yalnız sunucunun hangi makinede
durduğu ve veri klasörünün yeri).

---

## 1. Node.js kurun

**Node 20.9 veya üstü** gerekiyor. Kurulu mu diye bakın:

```bash
node -v
```

`v20.9.0` ya da üstü görmüyorsanız <https://nodejs.org> adresinden **LTS**
sürümünü kurun (Windows/Mac için indirilebilir kurulum dosyası var).

---

## 2. Projeyi indirin

**Git ile:**

```bash
git clone https://github.com/SilverxireB/Flowtrain.git
cd Flowtrain
```

**Git yoksa:** GitHub sayfasında yeşil **Code** düğmesi → **Download ZIP** →
açtığınız klasöre girin.

---

## 3. Kurun ve başlatın

```bash
npm install
npm run build
npm start
```

Tarayıcıda açın: **<http://localhost:3000>**

> `npm install` birkaç dakika sürebilir. Veritabanı motoru (`better-sqlite3`)
> makinenize uygun hazır ikili dosyayı indirir; ek bir program kurmanız
> gerekmez.

**Geliştirme yaparken** `npm start` yerine `npm run dev` kullanın — dosyaları
kaydettikçe sayfa kendini yeniler, `npm run build` gerekmez.

---

## 4. İlk açılış

1. Sayfa sizi **kurulum ekranına** götürür. İlk yönetici hesabını burada
   açarsınız — **ürünle gelen varsayılan şifre yoktur.**
2. Aynı ekranda **veri klasörünün yolu** yazar. Not alın: yedek almak o
   klasörü kopyalamaktır.

---

## 5. Personel listesini koyun

Kural motoru ve kiosk, personel dosyasını okur. Depodaki örneği veri
klasörüne kopyalayın:

```bash
# macOS / Linux
cp ornek/personel.csv data/personel.csv

# Windows (PowerShell)
copy ornek\personel.csv data\personel.csv
```

Sonra **Ayarlar → "Personel dosyasını yeniden oku"** deyin.

Dosyanın biçimi (ayırıcı `;` ya da `,` olabilir, Excel'in UTF-8 çıktısı da
okunur):

```csv
Sicil;Ad;Bölüm;Hat;Görev;Amir;İşe giriş
1001;Ali Yılmaz;Kaynak;Hat 1;Operatör;9001;2026-08-01
9001;Veli Usta;Kaynak;Hat 1;Amir;;2020-05-05
```

**Amir sütunu ekip listesini kurar.** Boşsa o kişi hiçbir amirin ekranında
görünmez; Ayarlar bunu doluluk oranı olarak söyler.

---

## 6. Beş dakikada uçtan uca deneme

1. **Eğitimler → yeni eğitim oluştur** (ya da hazır bir iskeletten başlayın).
2. Bir **Kural kartı** ekleyin, başlık yazın. İsterseniz elinizdeki bir
   **PDF'i yükleyin** — her sayfası bir karta dönüşür.
3. Bir **Doğru / Yanlış** sorusu ekleyin, doğru şıkkı yeşil tikle işaretleyin.
4. Sağ üstte **▶ Dene** — kiosk'ta nasıl görüneceğini gösterir, hiçbir kayıt
   düşmez.
5. **Yayınla.**
6. **Atama kuralları →** eğitimi seçin, "Kaynak" bölümünü seçin, kuralı ekleyin.
7. **Yeni bir sekmede** <http://localhost:3000/kiosk> açın. Sicil olarak
   `1001` yazın → eğitim listede çıkar → izleyin → sınavı olun → kendinize bir
   PIN belirleyin (işe giriş tarihi olarak `01.08.2026` girin).
8. **Pano →** tamamlanma oranı ve CSV/PDF çıktısı.

> Kiosk'u ayrı bir tarayıcı **profilinde ya da gizli pencerede** açın: aynı
> pencerede yönetici oturumunuz açıkken oturum "gözetimli" olarak kaydedilir
> (amir tableti davranışı). İkisi de doğrudur, ama farkı bilerek görün.

---

## 7. Veri, yedek, sıfırlama

Her şey tek klasörde: veritabanı, yüklenen görsel/videolar, `kayitlar.csv`,
personel dosyası.

- **Yedek:** klasörün tamamını kopyalayın (`-wal` ve `-shm` dosyaları dahil).
  En güvenlisi sunucuyu kısa süre durdurup kopyalamaktır.
- **Sıfırdan başlamak:** sunucuyu durdurun, `data/` klasörünü silin, yeniden
  başlatın — kurulum ekranı yine karşınıza gelir.
- **Başka bir yere koymak:** `FLOWTRAIN_DATA` ortam değişkeni.

```bash
# macOS / Linux
FLOWTRAIN_DATA=/Users/ben/flowtrain-veri npm start

# Windows (PowerShell)
$env:FLOWTRAIN_DATA="C:\flowtrain-veri"; npm start
```

---

## 8. Ağdaki başka cihazlardan açmak (tablet denemesi)

Kiosk'u gerçek bir tablette denemek isterseniz sunucuyu ağa açın:

```bash
npx next start -H 0.0.0.0 -p 3000
```

Sonra tabletten `http://<bilgisayarınızın-IP-adresi>:3000/kiosk` adresini açın.
IP adresini `ipconfig` (Windows) ya da `ifconfig` / `ip addr` (Mac/Linux) ile
bulabilirsiniz. Bilgisayarınızın güvenlik duvarı 3000 portunu sorabilir, izin
verin.

---

## Takılırsanız

| Belirti | Sebebi |
|---|---|
| `npm start` → "next: not found" | `npm install` çalışmamış ya da yanlış klasördesiniz. |
| `npm start` → "Could not find a production build" | Önce `npm run build`. |
| Port 3000 dolu | `npx next start -p 3001` ile başka port kullanın. |
| Kurulum yerine giriş ekranı geliyor | Zaten bir hesap açılmış. Şifreyi unuttuysanız `data/` klasörünü silip baştan başlayın. |
| PDF yükleme sonsuza kadar "çalışıyor" | `npm run pdf-isci` çalıştırın (işçi dosyası `public/`e kopyalanır). |
| Personel listesi boş | Dosya yanlış yerde. Ayarlar sayfasındaki yolu birebir kullanın, sonra "yeniden oku". |
| Türkçe harfler bozuk | CSV UTF-8 değil. Excel'de "CSV UTF-8" olarak kaydedin. |
| `better-sqlite3` derleme hatası | Node sürümünüz çok yeni/eski olabilir; LTS sürümüne geçin. |

---

## Sınavları koşmak (isteğe bağlı)

```bash
npm test        # saf mantık — 178 doğrulama, saniyeler sürer
```

Tarayıcı sınavı ayrıca Playwright ister (ürünün bağımlılığı değildir; kurulumu
yüzlerce megabayt tarayıcı indirir):

```bash
npm install --no-save playwright
npx playwright install chromium
npm run e2e     # gerçek tarayıcıda tüm zincir — 56 doğrulama
```
