# FlowTrain

Kapalı ağda çalışan **eğitim dağıtım ve sınav aracı**. İşçinin hesabı, şifresi
veya e-postası olmasına gerek yoktur: kiosk'ta sicilini/kartını okutur, eğitimini
izler, sınavını olur, kaydı düşer.

- **Tek kutu, iç ağda.** İnternet, VPN, SSO gerekmez.
- **Personel listesi dışarıdan** gelir (CSV veya kurumun kendi sistemi), FlowTrain
  personel verisi tutmaz.
- **Tamamlama kaydı dışarı verilebilir** (dosya çıktısı veya kurumun eğitim
  sistemine besleme).

## Kurulum

```bash
npm install
npm run build
npm start                      # http://localhost:3000
```

Veri klasörü varsayılan olarak `./data`; `FLOWTRAIN_DATA` ile değiştirilir.
İlk açılışta kurulum ekranı gelir ve ilk yönetici hesabı orada açılır —
**ürünle birlikte gelen varsayılan şifre yoktur.**

### Personel listesi

Veri klasörüne `personel.csv` bırakın (yolu Ayarlar sayfası birebir gösterir):

```csv
Sicil;Ad;Bölüm;Hat;Görev;Amir;İşe giriş
1001;Ali Yılmaz;Kaynak;Hat 1;Operatör;9001;2026-08-01
```

Ayırıcı `;` ya da `,` olabilir; Excel'in BOM'lu UTF-8 çıktısı da okunur.
Amir sütunu **ekip listesini** kurar — boşsa o kişi hiçbir amirin ekranında
görünmez (Ayarlar bunu doluluk oranı olarak söyler).

### Yedek

Veritabanı, yüklenen medya ve kayıt dosyası tek klasörde. **Yedek almak = veri
klasörünü kopyalamak.** Başka yerde saklanan veri yoktur.

## Sınavlar

```bash
npm test        # saf mantık — 86 doğrulama
npm run e2e     # gerçek tarayıcıda tüm zincir — 37 doğrulama
```

## Belgeler

- `docs/KAPSAM.md` — ne yapar, ne yapmaz, yol haritası
- `CLAUDE.md` — mimari kurallar
- Uygulama içi: her kokpit başlığındaki **?** düğmesi
