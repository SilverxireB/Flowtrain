# Canlıya geçiş kontrol listesi

Fabrikaya açmadan önce baştan sona yapılacaklar. Sıra önemli: **veri
hazırlığı duyurudan önce gelir.** Eksik veriyle açılan bir sistem ilk gün
yanlış rakam gösterir ve bir daha kimse ona güvenmez.

---

## A. Depo ve gizlilik

- [ ] **`data/` yeniden yok sayılsın.** Bugün dummy veriyle çalışıldığı için
      repoda izleniyor. `.gitignore` içindeki iki satırın başındaki `#`
      kaldırılacak:
      ```
      data/
      veri/
      ```
- [ ] Geçmişte izlenen veriyi takipten çıkar (dosyalar diskte kalır):
      ```
      git rm -r --cached data
      ```
- [ ] **Repoyu private yap** — gerçek personel verisi girecekse zorunlu.
      GitHub → Settings → Change visibility.
- [ ] Demo verisi temizlensin: `node scripts/demo-veri.mjs --sil`
- [ ] Kurulum sırasında açılan deneme hesapları silinsin (Ayarlar → Hesaplar).

## B. Sunucu

- [ ] Node 20.9+ kurulu.
- [ ] Kurulum iç ağdan erişilebilir bir makinede; adres sabit (DHCP değil).
- [ ] **Ayarlar → Kurulumun ağ adresi** doldurulmuş. QR etiketleri buradan
      basılır; `localhost` yazılırsa hattaki tablette hiçbir kod çalışmaz.
- [ ] Sunucu makine yeniden başladığında kendiliğinden ayağa kalkıyor
      (Windows görev zamanlayıcı ya da hizmet).
- [ ] Makine **uyku moduna geçmiyor** — uyuyan sunucu, kioskta "sayfa
      açılmıyor" olarak görünür.

## C. Veri

- [ ] Personel listesi yüklendi (Personel → içe aktarım ya da `personel.csv`).
- [ ] **Maliyet merkezi eşlemesi tanımlı**: her kodun bölümü ve amiri var.
      Eşlemesiz kod bırakılırsa o kişiler bölümsüz kalır ve bölüm bazlı
      atama kuralları onları kapsamaz.
- [ ] Amir rolündeki kişiler işaretlendi; amir hesaplarına sicil girildi
      (Ayarlar → "amir sütunu doluluk" oranı bunu gösterir).
- [ ] **GEÇMİŞ KAYITLAR AKTARILDI** (Kayıtlar → Geçmiş kayıt). Bu madde
      atlanırsa pano ilk gün herkesi eksik gösterir.
- [ ] Atlanan satırların gerekçesi okundu ve kabul edildi.

## D. İçerik

- [ ] Eğitimler yayında (taslak eğitim kimseye düşmez).
- [ ] Her eğitimin kategorisi var; yasal zorunlu olanlar işaretli.
- [ ] Soru havuzu sınavdan büyük (havuz küçükse herkese aynı sorular gelir).
- [ ] Tekrar süresi gereken eğitimlerde `tekrarAy` dolu.
- [ ] Atama kuralları yazıldı; **Pano'da beklenen kişi sayısı tutuyor.**

## E. Saha

- [ ] Kiosk tabletleri `/kiosk` adresinde, tam ekran, uyku kapalı.
- [ ] QR etiketleri basıldı ve ait oldukları istasyona asıldı.
- [ ] Ziyaretçi kayıt masası tableti `/ziyaretci` adresinde.
- [ ] KVKK saklama süresi ayarlandı (Ziyaretçi → Sorular → Saklama).
- [ ] Bir işçiyle **baştan sona deneme** yapıldı: sicil → içerik → sınav →
      PIN → kayıt panoda göründü.

## F. Yedek

- [ ] Veri klasörünün yolu biliniyor (Ayarlar gösterir).
- [ ] **Yedek = o klasörü kopyalamak.** Günlük kopyalama planlandı ve bir
      kez geri yükleme denendi. Denenmemiş yedek, yedek değildir.

## G. Devir

- [ ] Yönetici hesabı fabrikadaki sorumluya verildi, şifresi değiştirildi.
- [ ] Kullanım rehberi gösterildi (her ekranın sağ üstündeki `?`).
- [ ] `docs/OPM-ENTEGRASYON.md` bilgi işleme iletildi.
