# FlowTrain — Kapsam v1.0 (uygulandı)

**Ne:** Kapalı ağda çalışan eğitim dağıtım ve sınav aracı. Sistem kaydı tutan yer
değil — **hazırlama, dağıtma, sınav** katmanı.

**Neden bu şekilde:** İç ağda yayınlanan bir şeye girmek Forti VPN + Okta ister;
işçilerin çoğunun hesabı bile yok. Bulut (Vercel) kurumsal olarak kabul edilmiyor.
Dolayısıyla: **tek kutu, iç ağda, hesapsız erişim.**

---

## Roller

| Rol | Nerede | Nasıl girer |
|---|---|---|
| Hazırlayan | Ofis PC | Hesap |
| Onaylayan | Ofis PC | Hesap — yayına **o** basar |
| Amir (master) | Tablet, sahada | Hesap |
| Operatör | Kiosk veya amir tableti | **Hesap yok** — sicil/kart + 4 hane PIN |
| Yönetici | Ofis PC | Hesap — kurulum, adaptör, yedek |

---

## Ekranlar (7 tane, fazlası yok)

1. **Eğitim listesi** — taslak/yayında, sürüm, kaç kişiye atandı.
2. **Eğitim editörü** — tek dikey liste. Üstte **"Dosya yükle"** kapısı
   (PDF → her sayfa bir kart; çevirim tarayıcıda). Kart tipleri: kural ·
   yap-yapma · adım adım · uyarı · video. Altta soru havuzu. Sağ üstte
   **▶ Dene** (kiosk görünümü, kayıt düşmez). Ayrıca iskelet şablonlar.
   **PPTX YOK, bilinçli:** PowerPoint'te "PDF olarak kaydet" tek tıktır;
   slaytları kendi motorumuzla yeniden çizmek (yazı tipi, SmartArt, animasyon)
   bitmeyen bir kuyudur.
   **Yayındaki eğitim SALT OKUNUR** — kayıtlar "sürüm N"e atıf yapar; içeriği
   yerinde değiştirmek insanların kayıtta yazandan başka bir şeyden sınav
   olmuş görünmesi demektir. Değişiklik için önce taslağa alınır (onaylayan).
3. **Atama kuralları** — kişi kişi değil kural: "Kaynak bölümü", "işe girişten
   itibaren 3 gün içinde", "yılda bir tekrar".
4. **Ekibim (amir tableti)** — `Ekibim 14 · Eksik 4 · Süresi doluyor 2` →
   satıra bas → `Başlat`.
5. **Kiosk** — kart okut/sicil → bekleyen eğitimler → izle → sınav →
   **kendi PIN'i ile bitir**.
6. **Pano** — bölüm bazında tamamlama, gecikenler, süresi dolanlar,
   **anomali işareti**, CSV (tam liste, denetim belgesi) + PDF (özet rapor).
7. **Ayarlar** — "kurulumun gerçeği" satırları (veri klasörü/yedek yeri,
   personel dosyası durumu, amir sütunu doluluk, kayıt hedefi, bekleyen
   senkron), hesaplar, PIN yönetimi/sıfırlama, denetim izi.
   **Adaptör SEÇİMİ yok, gösterimi var:** v1'de tek uygulama var; tek
   seçenekli bir açılır kutu yalan söylerdi. Seçim OPM adaptörüyle gelir.

---

## Adaptör sınırı

```ts
PersonelKaynagi  → CSV (v1) | OPM API (v1.5) | manuel
KayitHedefi      → dosya çıktı (v1) | OPM besleme (v1.5) | yok
```

Çekirdek ikisini de tanımaz (`src/lib/adaptor.ts`). **Önce CSV yazılır** — hem
ürünün standart sürümü odur (satılacak müşteride OPM yok), hem sınırın gerçekten
çalıştığı ilk günden kanıtlanır.

OPM'in getirisi: personel listesi hep güncel, sicil doğrulanır, ekip listesi
kendiliğinden kurulur, kayıt arşivi + sertifika geçerliliği bizde durmaz
(KVKK yükü geçer gider). Götürüsü: erişim/test ortamı beklemek — kod olarak
ucuz, takvim olarak pahalı.

---

## Sahtecilik önlemleri — **v1'de, ertelenmez**

Amir tableti tamamlama oranını yükseltir ama aynı tablet 12 kişiyi 4 dakikada
"tamamlanmış" gösterebilir. O zaman elde kâğıttan beter bir şey olur: **sahte
yasal kayıt.** Satılan şey kayıttır; kayıt sahteyse ürün yoktur.

- PIN'i **işçi** girer, **sonda** — imza yerine geçer. Amir başlatır, işçi bitirir.
  Beş hatalı denemede 15 dk kilit; kilitte oturum kapanır. İlk PIN'de işe
  giriş tarihi sorulur (yanlış tarih oturumu yakar).
- **Puan sunucuda** hesaplanır; cevap anahtarı istemciye hiç inmez; sınav seti
  oturum açılışında sabitlenir (havuz değişse bile kişi gördüğünden puanlanır).
- Soru havuzundan karışık seçim — aynı dokunma deseni 12 kere işlemez.
- Video ilk izlemede atlanamaz (geri sarma serbest); kartlarda asgari süre,
  sekme arkaya atılınca sayaç durur.
- **Süre sunucu damgalarından** ölçülür, istemciden gelen sayıdan değil.
- Panoda anomali satırı: *"12 kayıt · ort. 90 sn · beklenen 6 dk"* — kimseyi
  suçlamadan görünür. Gözetimsiz (kiosk) oturumlar da ölçülür.

---

## İçerik: üretmeyi kolaylaştırma, üretmeyi ortadan kaldır

1. Ana kapı **yükle** — mevcut ISG sunumu 3 dakikada eğitime döner. İlk kullanımda
   insanın gördüğü şey boş tuval değil, kendi dosyası olmalı.
2. Sıfırdan yazılacaksa **serbest tuval yok, sabit kart tipleri var** — kullanıcı
   yalnız metin yazar ve fotoğraf seçer; yerleşimi ürün belirler. Kötü yapma
   imkânı kalmaz.
3. **Üç soru tipi**, fazlası yok. Eşleştirme/sürükle-bırak hazırlayanı yorar,
   öğrenmeye katkı vermez.
4. **Ayar sormayan ürün** — geçme notu 70, iki deneme, havuzdan 5 soru, karışık
   sıra varsayılan gelir (`SINAV_VARSAYILAN`).
5. Yeni eğitim = boş sayfa değil, **kopya** + iskelet şablonlar.
6. İçeriği eğitim departmanı değil **işi bilen kişi** üretir; kalite güvencesi
   hazırlayan/onaylayan ayrımıyla sağlanır.
7. **Kalite ölçüsü sınav sonucudur:** bir soruyu %78 yanlış yapıyorsa insanlar
   değil, o sayfa kötüdür — hazırlayana bunu söyle.

---

## MVP dışı (bilerek)

SCORM/xAPI · kurs katalogu, öğrenme patikaları · rozet/gamification · serbest
tasarım tuvali · SMS entegrasyonu (v2 modülü) · mobil uygulama · içerik üretim
hizmeti · çoklu dil · PPTX ayrıştırma · otomatik soru üretimi (dil modeli
gerektirir; "dış servis yok" kuralıyla çelişir — karar bekliyor).

---

## Karar bekleyen 4 soru

1. **OPM'de `amirSicil` var mı?** — amir tabletinin tamamı buna bakıyor.
2. Yaka kartlarında okunabilir **barkod/QR** var mı, yoksa sicil elle mi girilecek?
3. Otomatik soru önerisi: ofiste **çevrimiçi hazırlama** kabul mü, yoksa sıfır
   bağımlılık (kural tabanlı zayıf öneri) mi?
4. Kiosk donanımı: tablet mi, mevcut PC + kart okuyucu mu?

Hiçbiri Aşama 1'i bloklamıyor.

---

## Yol

- ✅ **Aşama 1 (çekirdek):** editör + PDF yükleme kapısı + sınav + kiosk + CSV
  adaptörü.
- ✅ **Aşama 2:** amir tableti + kural motoru + pano + anomali.
- ✅ Rehber, PIN yönetimi, PDF/CSV çıktı, iskelet şablonlar, 178 birim + 56
  uçtan uca doğrulama.
- ⏳ **Aşama 3:** OPM adaptörü + besleme, self-host kurulum paketi/Docker,
  SMS dürtme modülü.

## Sınavlar

`npm test` (saf mantık) ve `npm run e2e` (gerçek tarayıcı + gerçek sunucu).
**İkisi de gerekli:** birim sınavlar küçültülmemiş kod koşar; SWC'nin bir
yardımcıyı satır içine alırken serbest değişken bıraktığı hatayı yalnız uçtan
uca sınav yakaladı. Rehberi çökerten geçici-ölü-bölge hatasını ise ancak ekranı
gerçekten AÇAN bir adım gördü — bu yüzden her yüzey en az bir kez açılır.
