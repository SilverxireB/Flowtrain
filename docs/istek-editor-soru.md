# Editör · soru hattı — başka dosyalardan istekler

Dört yeni soru tipi (`bosluk · siralama · eslestirme · gorselIsaret`) editörde
kurulabilir hâle geldi (`src/components/editor/SoruSatiri.tsx` +
`src/components/editor/BolgeSecici.tsx`). Aşağıdakiler **benim dosyalarımın
dışında** kaldığı için yapılmadı.

---

## 1. Yeni sorunun varsayılan şıkları tipe göre olmalı — **çekirdek**

**Dosya:** `src/app/eylemler.ts` → `soruEkleEylem`

Bugün her tip aynı doğuyor:

```ts
secenekler: tip === "dogruYanlis" ? ["Doğru", "Yanlış"] : ["", ""],
dogru: [0],
```

İki tipte bu yanlış bir başlangıç durumu:

- **`gorselIsaret`** — şık değil BÖLGE tutuluyor (`x,y,g,y | etiket`). İki boş
  şık hiçbir bölge değil; `dogru: [0]` de var olmayan bir bölgeyi gösteriyor.
  Bölge seçici ilk kutu çizildiğinde ayrıştırılamayan şıkları atıp `dogru`yu
  birlikte kaydırıyor (`BolgeSecici.tsx` → `bolgeEkle`), yani ekran doğru
  çalışıyor; ama o ana kadar yayın kontrolü "boş şık var" diye uyarıyor.
  İstenen: `gorselIsaret` için `secenekler: []`, `dogru: []`.
- **`eslestirme`** — şık `sol | sağ` tek satır. Boş şık yerine `" | "` ile
  başlarsa editör de kayıt da aynı biçimi görür.
- **`siralama` / `eslestirme`** — `dogru` KULLANILMIYOR (doğru cevap kimlik
  sırası). `[0]` inert ama yanıltıcı; `[]` daha dürüst.

**DİKKAT (ayrı bir karar):** `soruDogruMu` şu an `dogru: []` olan bir soruya boş
cevap verildiğinde `true` döndürüyor (iki boş küme eşit). Yani "hiç doldurulmamış
soru herkes için doğru" sayılıyor. Bu bugün de `cokluSecim`de mümkün; yukarıdaki
değişiklik onu yeni tiplere de taşır. Puanlamada boş `dogru`nun asla doğru
sayılmaması (`soru.dogru.length === 0 → false`) çekirdeğin kararı.

## 2. Yayın kontrolü yeni tipleri görmüyor — **`YayinKontrol.tsx`**

**Dosya:** `src/components/editor/YayinKontrol.tsx` → `yayinKontrolu`

Soru satırının kendisi uyarıyor (metinde `___` yok · bölge yok · hiç tehlikeli
bölge işaretlenmemiş · görsel yok), ama bu uyarılar **o sorunun kartında**
duruyor. Yayına hazırlık listesi kırk soruluk havuzu tek bakışta özetleyen yer;
oraya düşmeyen uyarı, kartı kapalı olan soruda görülmez:

- `bosluk` tipinde metinde `___` yoksa → uyarı.
- `gorselIsaret` tipinde `gorselId` yoksa, hiç geçerli bölge yoksa ya da
  `dogru` boşsa → uyarı. (`bolgeCoz` `sinav.ts`te hazır.)
- `eslestirme` tipinde bir çiftin yarısı boşsa → uyarı (`eslestirmeCifti`).
- `siralama` tipinde ikiden az madde varsa → uyarı.

Ayrıca `bosSik` kontrolü (`q.secenekler.some((s) => !s.trim())`) bölge
şıklarında hiç tetiklenmez; boş etiketli bölge de "boş şık" sayılmamalı — orada
istenen kontrol yukarıdaki listedeki.

## 3. Soru ekleme düğmeleri hangi tipin ne olduğunu söylemiyor — **kabuk**

**Dosya:** `src/app/egitimler/[id]/Editor.tsx` (satır ~474)

Düğmeler `SORU_ETIKET`ten türüyor, yani yedi tip kendiliğinden listelendi — bu
doğru. Ama yan yana yedi düğme arasında "Sıralama" ile "Eşleştirme" arasındaki
fark yalnız deneyerek anlaşılıyor. Tek satırlık değişiklik yeter:

```tsx
<button key={t} title={SORU_ACIKLAMA[t]} …>
```

(`SORU_ACIKLAMA` zaten `tipler.ts`te; soru kartının içinde ben gösteriyorum,
eksik olan ekleme anı.)

## 4. `OtoMetin` `ref` almıyor — **kart hattı** (düşük öncelik)

**Dosya:** `src/components/editor/OtoMetin.tsx`

"Boşluk ekle (`___`)" düğmesi işareti **imlecin durduğu yere** koymalı; sona
eklemek "Baret ___ takılır" cümlesini kurdurmaz. Bileşen `forwardRef`
olmadığından metin alanına sarmalayıcı `div` üzerinden
(`querySelector("textarea")`) ulaşıyorum. Çalışıyor ama kırılgan: `OtoMetin`in
içine ikinci bir `textarea` girerse sessizce yanlış alanı bulur.
`forwardRef<HTMLTextAreaElement, …>` bunu temizler.
