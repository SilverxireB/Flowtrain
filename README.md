# FlowTrain

Kapalı ağda çalışan **eğitim dağıtım ve sınav aracı**. İşçinin hesabı, şifresi
veya e-postası olmasına gerek yoktur: kiosk'ta sicilini/kartını okutur, eğitimini
izler, sınavını olur, kaydı düşer.

- **Tek kutu, iç ağda.** İnternet, VPN, SSO gerekmez.
- **Personel listesi dışarıdan** gelir (CSV veya kurumun kendi sistemi), FlowTrain
  personel verisi tutmaz.
- **Tamamlama kaydı dışarı verilebilir** (dosya çıktısı veya kurumun eğitim
  sistemine besleme).

## Çalıştırma

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # üretim derlemesi
```

## Belgeler

- `docs/KAPSAM.md` — ne yapar, ne yapmaz, yol haritası
- `CLAUDE.md` — mimari kurallar
