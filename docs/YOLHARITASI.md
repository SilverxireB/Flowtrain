# FlowTrain — Teslim Yol Haritası (10 sprint)

**Hedef:** İSG ve iş başı eğitimlerinin tamamen dijitalleşmesi. Ürün müşteriye
**yeni yetenekleri eklenmiş ve hatasız** teslim edilecek.

**Değişmeyen kısıt:** Kullanılabilirlik batırılmaz. Her yeni yetenek, kioskta
eldivenle çalışan işçinin akışını KOLAYLAŞTIRMALI ya da hiç görünmemeli.
Hazırlayanın ekranı zenginleşebilir; işçinin ekranı sadeleşir.

---

## Dört paralel hat

| Hat | Alan | Sahip olduğu dosyalar |
|---|---|---|
| **A** | Eğitim editörü, medya, içerik | `src/app/egitimler/**`, `src/components/editor/**`, `src/lib/sablonlar.ts`, `src/app/api/medya/**` |
| **B** | Katalog, paketler, atama, QR | `src/app/atama/**`, `src/app/gruplar/**`, `src/app/api/qr/**` |
| **C** | Kayıt defteri, rapor, sertifika | `src/app/kayitlar/**`, `src/app/pano/**`, `src/lib/panoPdf.ts`, `src/lib/rapor*.ts` |
| **D** | Kiosk, oynatıcı, ziyaretçi, kalite | `src/app/kiosk/**`, `src/components/oyun/**`, `src/app/ziyaretci/**`, `tests/**` |

**Paylaşılan dosyalar tek elden yönetilir** (`db.ts`, `depo.ts`, `tipler.ts`,
`adaptor.ts`, `app/page.tsx`, `app/eylemler.ts`, `globals.css`). Hatlar bunlara
DOKUNMAZ; ihtiyaçları önden karşılanır, ek istek `docs/istek-<hat>.md`e yazılır.

---

## Sprintler

### S1 — Temel (tamamlandı)
Personel yüzeyi · maliyet merkezi eşlemesi · dış aktarım · çekirdek şema
(kategori, paket, medya, oturum kaynağı, soru görseli).

### S2 — Editörün hissi
- A: Canlı önizleme (yazarken kiosk görünümü yanda)
- B: Kategori alanı + katalog süzgeci
- C: Kayıt defteri iskeleti `/kayitlar` + filtreler
- D: Oynatıcıda soru açıklaması ("neden yanlış") gösterimi

### S3 — İçerik zenginliği
- A: Kart başına çoklu görsel, medya kütüphanesi, görsel yeniden kullanımı
- B: Eğitim paketleri `/gruplar` + pakete atama kuralı
- C: Kayıt defteri CSV/PDF dışa aktarımı
- D: Kiosk akış sadeleştirmesi, büyük dokunma hedefleri denetimi

### S4 — Sınav kalitesi
- A: Soru görseli, açıklama, soru istatistiğinin editörde gösterimi
- B: QR kod üretimi + yazdırılabilir etiket sayfası
- C: Sınıf eğitimi toplu kayıt girişi (eğitmen + katılımcı listesi)
- D: Kioskta QR ile doğrudan eğitim açma

### S5 — Geçmişin taşınması
- A: PPTX içe aktarma (PDF kapısının yanına)
- B: Zorunluluk tipi + planlanan süre alanları katalogda
- C: Geçmiş kayıt içe aktarımı (dış sistemden CSV) — canlıya geçişin şartı
- D: Ziyaretçi CSV/PDF çıktısı + KVKK saklama süresi ayarı

### S6 — Görünürlük
- A: Kart kopyalama (eğitimler arası), şablon kütüphanesi genişletme
- B: Katalog listesi: atanan kişi sayısı, tamamlanma oranı sütunları
- C: Pano trendleri (aylık seyir, bölüm karşılaştırma, kategori kırılımı)
- D: Erişilebilirlik turu (klavye, kontrast, ekran okuyucu)

### S7 — Belge
- A: Editör içi doğrulama ("bu eğitim yayına hazır mı" kontrol listesi)
- B: Paket bazlı ilerleme (kişi paketin kaçında)
- C: Kişi sertifikası PDF + toplu sertifika basımı
- D: Kiosk dayanıklılık sınavları (donma bekçisi, gece reload, çevrimdışı)

### S8 — Bütünleşme
- A: Editör son cila, büyük içerikte başarım
- B: OPM adaptör iskeleti (webservice arayüzü, sizin yazılımcılar takacak)
- C: Rapor dışa aktarımlarının denetim uyumu
- D: Uçtan uca sınav genişletme (yeni yüzeylerin tamamı)

### S9 — Sertleştirme
Tüm hatlar: hata avı, sınır durumları, yük denemesi (1000+ kişi, 60+ eğitim),
güvenlik turu, yetki matrisi doğrulaması.

### S10 — Teslim
Kurulum paketi, sürüm notları, kullanım rehberi güncellemesi, canlıya geçiş
kontrol listesi (`data/` yeniden ignore, repo private, yedek planı, demo
verisinin temizlenmesi).

---

## Teslim ölçütleri

1. `npm run build` temiz (uyarı kabul, hata yok).
2. `npm test` ve `npm run e2e` tam geçer; her yeni yüzeyin sınavı vardır.
3. Hiçbir ekran somut adaptörü çağırmaz (`tests/sinir.test.mjs`).
4. Kioskta hiçbir akış 3 dokunuştan uzun değildir.
5. Her kayıt denetlenebilir: kim, ne zaman, hangi sürüm, hangi kaynak.
