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

### En kolayı: çift tıklayın

| İşletim sistemi | Dosya |
|---|---|
| Windows | **`kur.bat`** |
| macOS | **`kur.command`** (ilk seferde sağ tık → Aç) |

Bu dosya her şeyi kendisi yapar: Node sürümünü kontrol eder, bağımlılıkları
kurar, uygulamayı derler, veri klasörünü ve örnek personel listesini hazırlar,
sunucuyu başlatır ve **tarayıcıyı açar**. İlk kurulum birkaç dakika sürer;
sonraki açılışlar saniyeler.

Kapatmak için o pencerede **Ctrl+C**. Tekrar açmak için aynı dosyaya yine çift
tıklayın.

### Ya da terminalden

```bash
npm run kur      # yukarıdakinin aynısı
```

```bash
npm install      # adım adım yapmak isterseniz
npm run build
npm start
```

Tarayıcıda: **<http://localhost:3000>**

> Veritabanı motoru (`better-sqlite3`) makinenize uygun hazır ikili dosyayı
> indirir; derleyici ya da başka bir program kurmanız gerekmez.

**Geliştirme yaparken** `npm run dev` kullanın — dosyaları kaydettikçe sayfa
kendini yeniler, `npm run build` gerekmez.

---

## 4. İlk açılış

1. Sayfa sizi **kurulum ekranına** götürür. İlk yönetici hesabını burada
   açarsınız — **ürünle gelen varsayılan şifre yoktur.**
2. Aynı ekranda **veri klasörünün yolu** yazar. Not alın: yedek almak o
   klasörü kopyalamaktır.

---

## 5. Personel listesi

Kural motoru ve kiosk bu dosyayı okur. **`kur.bat`/`kur.command` ile
kurduysanız 6 kişilik örnek liste zaten kopyalandı** — hemen deneyebilirsiniz.

Kendi listenizle değiştirmek için `data/personel.csv` dosyasının üstüne yazın,
sonra **Ayarlar → "Personel dosyasını yeniden oku"** deyin. (Kurulum betiği var
olan bir listenin üstüne asla yazmaz.)

Dosyanın biçimi (ayırıcı `;` ya da `,` olabilir, Excel'in UTF-8 çıktısı da
okunur):

```csv
Sicil;Ad;Maliyet merkezi
1001;Ali Yılmaz;264302
9001;Veli Usta;264302
```

**Bir personel kaydı üç şeydir: sicil, ad, maliyet merkezi.** Bölüm ve amir
elle yazılmaz — maliyet merkezinden türer.

### Dosya yerine ekrandan

**Personel** sayfası aynı işi ekrandan yapar: kurumun dışa aktarımını (sicil ·
ad soyad · maliyet merkezi) yapıştırır ya da dosya olarak seçersiniz. Var olan
kayıtlar güncellenir, yenileri eklenir, **kimse silinmez** — silme kararı
insanın işidir.

### Maliyet merkezi eşlemesi

Aynı sayfanın altında her koda bir **bölüm** ve bir **amir** bağlarsınız:

```
264302  →  Montaj · amir 1001
```

Bir kodun eşlemesi yoksa o kişiler bölümsüz kalır ve bölüm bazlı atama
kuralları onları kapsamaz — aktarım sonrası eşlemesi olmayan kodları listeler.
Eşlemeyi sonradan tanımlayıp **"Tüm listeye uygula"** diyebilirsiniz.

Bölümü elle girilebilir yapmadık çünkü iki gerçek yarışırdı: kurumdan gelen
her yeni liste, elle yapılan düzeltmeleri ezer ve kimse hangisinin doğru
olduğunu bilemezdi.

### Amir kim?

Herkes varsayılan olarak **operatör**. Personel sayfasından bir kişinin rolünü
**Amir** yaparsınız; o kişi artık eşlemede amir olarak seçilebilir ve kendi
ekibini görür. Amirin **hesabına sicil girilmezse** giriş yapar ama ekranı boş
görür — Ayarlar bunu doluluk oranı olarak söyler.

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
9. **Kayıt defteri →** az önceki tamamlama burada; süzün, CSV/PDF indirin,
   kişiye sertifika basın.
10. **Eğitimler → QR etiketleri →** eğitimi işaretleyip yazdırın. Kodu bir
    telefonla okutun: kiosk doğrudan o eğitimi açar. (Önce **Ayarlar →
    Kurulumun ağ adresi**ni doldurun; `localhost` yazılırsa başka cihazda
    çalışmaz.)

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
| `kur.bat` bir anda kapanıyor | Node kurulu değil. Pencere kapanmadan mesajı okuyamıyorsanız komut isteminden `node scripts/kur.mjs` çalıştırın. |
| Windows "bu uygulamayı çalıştırmak güvenli değil" diyor | İndirilen dosya işaretlenmiştir: `kur.bat` → sağ tık → Özellikler → **Engellemeyi kaldır**. |
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
