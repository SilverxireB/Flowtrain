# Sürüm notları

## v1.1 — Katalog, kayıt defteri, QR

İlk sürüm eğitimi hazırlayıp kioskta tamamlatıyordu. Bu sürüm iki eksiği
kapatıyor: **eğitim sayısı arttığında düzen** ve **kaydın denetimde işe
yaraması**.

### Eğitim editörü
- **Canlı önizleme** — yazarken yanda gerçek kiosk görünümü. Önizleme kiosk
  kartının kendisini çiziyor, kopyasını değil: önizlemede görünmeyen sahada
  da görünmez.
- Kart başına **birden çok görsel**, sıralanabilir.
- **Medya kütüphanesi** — yüklenen görsel yeniden kullanılabilir; silmeden
  önce kaç kartta kullanıldığı söylenir.
- Soruya **görsel** ve yanlış cevaba **açıklama** eklenebiliyor.
- Sorunun kaç kez yanlış yapıldığı editörde görünüyor — yüksek oran içeriğin
  zayıf olduğunun işareti.
- **Yayın öncesi kontrol listesi**: boş başlık, kırık görsel, havuzdan büyük
  sınav. Engellemez, söyler.
- Kart kopyalama (aynı eğitimde ve başka eğitime), 6 yeni İSG şablonu.

### Katalog ve paketler
- Eğitim listesi artık bir katalog: arama, kategori/durum/zorunluluk süzgeci,
  sıralama, **atanan kişi sayısı ve tamamlanma oranı**.
- **Eğitim paketleri** — birlikte verilen eğitimler tek ada bağlanır. Atama
  kuralı pakete yazılır; pakete sonradan eklenen eğitim, kural yeniden
  yazılmadan aynı kişilere gider.

### QR etiketleri
- Her eğitimin bir QR kodu var; A4'e basılıp istasyona asılıyor. İşçi
  okutunca kiosk **doğrudan o eğitimi** açıyor, listede aramıyor.
- İş başı eğitimi böylece makinenin başında, işin yapıldığı yerde tamamlanıyor.

### Kayıt defteri
- **`/kayitlar`** — tüm tamamlamalar tek yerde. Süzgeçler, CSV/PDF çıktısı,
  kişi sertifikası. Denetimde açılan ekran budur.
- **Kayıtlar düzenlenmez ve silinmez.** Sonradan değiştirilebilen bir kayıt
  hiçbir şey ispat etmez. Düzeltme yolu: doğrusunu yeni kayıt olarak gir,
  notuna gerekçesini yaz; iki satır da defterde kalır.
- **Sınıf eğitimi kaydı** — her eğitim kioskta verilmez. Eğitmen anlatır,
  katılım listesi girilir, kayıt aynı deftere düşer.
- **Geçmiş kayıt aktarımı** — başka sistemden gelen eski tamamlamalar.
  Canlıya geçişte ilk yapılacak iş.
- Her kaydın **kaynağı** görünür: kiosk · amir gözetiminde · sınıf · dış aktarım.

### Personel
- **`/personel`** — kayıt üç şeydir: sicil, ad, maliyet merkezi. Artı rol.
- **Bölüm ve amir elle yazılmaz**, maliyet merkezi eşlemesinden türer. Eşleme
  veridir: fabrika kendi kodlarını kendi bağlar.
- Rol Operatör/Amir; amir yapılan kişi eşlemede amir olarak seçilebilir.

### Kiosk ve ziyaretçi
- Dokunuş sayısı 4'ten 2'ye indi.
- Sınav bitince **yanlış yapılan soruların açıklaması** gösteriliyor. Doğru
  cevap istemciye hiçbir zaman gönderilmiyor.
- Erişilebilirlik turu: klavye, odak, ekran okuyucu etiketleri, 72px hedefler.
- Kiosk dayanıklılığı: Wake Lock, donma bekçisi, gece yenilemesi, çevrimdışı
  şeridi.
- Ziyaretçi kayıtları CSV/PDF olarak dışa aktarılıyor; KVKK saklama süresi
  ayarlanabiliyor (varsayılan sınırsız).

### Düzeltilen hatalar
- **Kart içeriği kaydedilmiyordu.** Canlı önizlemenin iyimser durumu
  "değişti mi" kontrolünü kandırıyor, yazılan hiçbir şey sunucuya
  gitmiyordu. Ekranda doğru görünüyordu; sayfa yenilenince kayboluyordu.
- **Var olan kurulumda şema yükseltmesi yarıda kesiliyordu**; yeni tablolar
  hiç oluşmuyordu. Yalnız yükseltme yolunda çıkan bir hataydı.
- **Kiosk düğmeleri ağ kopunca kalıcı ölüyordu**; tek çare tableti yeniden
  başlatmaktı.
- Havuz uyarısı çözümü kapalı bir bölümde saklıyordu.
- Uçtan uca sınav Windows'ta hiç koşamıyordu.

### Bilinmesi gerekenler
- `better-sqlite3` 12.11.1'e sabitlendi: 13.x'in Windows için hazır ikili
  dosyası yok, kaynaktan derlemek Python ve C++ derleyici istiyor.
- Kayıt defteri çıktıları **ekrandaki süzgeci izler** ve süzgeç belgenin
  başlığına yazılır. Panodan indirilen CSV ise her zaman tam listedir.
