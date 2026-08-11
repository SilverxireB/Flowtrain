/**
 * SEÇİLEN DOSYANIN ÖNİZLEMESİ — yükleme başlamadan, tarayıcıda.
 *
 * NEDEN: video yüklerken ekranda yalnız "Yükleniyor…" yazıyordu. 200 MB'lık bir
 * hat videosunda bu dakikalarca süren boş bir bekleyiş demek ve insan doğru
 * dosyayı seçip seçmediğini ancak iş bittiğinde görüyor. Oysa ilk kare zaten
 * elimizde: dosya kullanıcının diskinde ve tarayıcı onu okuyabiliyor.
 *
 * SUNUCUYA HİÇBİR ŞEY SORULMAZ. Kapalı ağ kuralı bir yana, bunun için sunucuya
 * gitmek dosyayı iki kez okumak olurdu.
 */

/** Görselde dosyanın kendisi, videoda ilk kare. Başarısızsa null. */
export async function onizlemeUret(dosya: File): Promise<string | null> {
  if (dosya.type.startsWith("image/")) return URL.createObjectURL(dosya);
  if (!dosya.type.startsWith("video/")) return null;
  return videoIlkKare(dosya);
}

/**
 * Videonun ilk karesi.
 *
 * `currentTime = 0` GÜVENİLİR DEĞİL: bazı kodeklerde ilk kare siyah ya da
 * henüz çözülmemiş oluyor ve tuvale boş bir dikdörtgen düşüyor. Bu yüzden
 * kısa bir yere sarılıp `seeked` bekleniyor.
 *
 * ZAMAN AŞIMI ŞART: bozuk ya da tarayıcının çözemediği bir dosyada `seeked`
 * hiç gelmez ve söz sonsuza kadar askıda kalır — önizleme uğruna yüklemeyi
 * baştan öldürmüş oluruz. Süre dolarsa önizlemesiz devam edilir.
 */
function videoIlkKare(dosya: File, saniye = 0.15, zamanAsimiMs = 4000): Promise<string | null> {
  return new Promise((coz) => {
    const adres = URL.createObjectURL(dosya);
    const v = document.createElement("video");
    let bitti = false;

    const kapat = (sonuc: string | null) => {
      if (bitti) return;
      bitti = true;
      clearTimeout(sayac);
      v.removeAttribute("src");
      v.load();
      URL.revokeObjectURL(adres);
      coz(sonuc);
    };

    const sayac = setTimeout(() => kapat(null), zamanAsimiMs);

    v.muted = true;
    v.playsInline = true;
    v.preload = "metadata";
    v.src = adres;

    v.onloadeddata = () => {
      // Videodan kısa olan bir yere sar; 1 sn'lik klipte 0,15 sn hâlâ geçerli.
      v.currentTime = Math.min(saniye, (v.duration || 1) / 2);
    };

    v.onseeked = () => {
      try {
        const tuval = document.createElement("canvas");
        // Önizleme kutusu en fazla birkaç yüz piksel; tam çözünürlük boşuna
        // bellek ve base64 uzunluğu demek.
        const olcek = Math.min(1, 640 / (v.videoWidth || 640));
        tuval.width = Math.max(1, Math.round((v.videoWidth || 640) * olcek));
        tuval.height = Math.max(1, Math.round((v.videoHeight || 360) * olcek));
        tuval.getContext("2d")?.drawImage(v, 0, 0, tuval.width, tuval.height);
        kapat(tuval.toDataURL("image/jpeg", 0.7));
      } catch {
        // Tuval "kirlenmiş" olabilir (yerel dosyada olmaz ama garantisi yok).
        kapat(null);
      }
    };

    v.onerror = () => kapat(null);
  });
}

export interface YuklemeSonucu {
  id?: string;
  hata?: string;
}

/**
 * Dosyayı yükler ve GERÇEK ilerlemeyi bildirir.
 *
 * `fetch` DEĞİL `XMLHttpRequest`: fetch'in gönderim ilerlemesi yok. Yükleme
 * yüzdesi uydurulmuş bir animasyon olamaz — 200 MB'lık videoda sahte çubuk,
 * bittiğini söyleyip beklemeye devam eder ve insan "dondu" der.
 */
export function medyaYukle(dosya: File, onOran: (oran: number) => void): Promise<YuklemeSonucu> {
  return new Promise((coz) => {
    const istek = new XMLHttpRequest();
    const form = new FormData();
    form.append("dosya", dosya);

    istek.upload.onprogress = (e) => {
      if (e.lengthComputable) onOran((e.loaded / e.total) * 100);
    };

    /* GÖNDERİM BİTTİ ≠ İŞ BİTTİ: sunucu dosyayı diske yazana kadar bekleriz.
       %100'de takılı görünmesin diye oran orada bırakılıp durum metni
       çağıran tarafta "kaydediliyor"a döner. */
    istek.onload = () => {
      try {
        const sonuc = JSON.parse(istek.responseText);
        coz(istek.status >= 200 && istek.status < 300 ? { id: sonuc.id } : { hata: sonuc.hata ?? "Yüklenemedi." });
      } catch {
        coz({ hata: "Sunucu beklenmedik bir yanıt verdi." });
      }
    };
    istek.onerror = () => coz({ hata: "Bağlantı koptu. Tekrar deneyin." });
    istek.onabort = () => coz({ hata: "Yükleme iptal edildi." });

    istek.open("POST", "/api/medya");
    istek.send(form);
  });
}
