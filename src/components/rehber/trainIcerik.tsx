"use client";

import { Adimlar, Baslik, Dugme, Kutu, Tablo } from "@/components/RehberParcalari";
import type { RehberBolum } from "@/components/Rehber";
import { KART_ACIKLAMA, KART_ETIKET, SORU_ETIKET, type KartTipi } from "@/lib/tipler";
import { DURUM_ETIKET, type AtamaDurumu } from "@/lib/kurallar";

/**
 * FlowTrain kullanım rehberi içeriği.
 *
 * EKRAN GÖRÜNTÜSÜ YOK: düğmeler ürünün GERÇEK sınıflarıyla basılır, referans
 * tabloları ürünün KENDİ SABİTLERİNDEN türer (`KART_ETIKET`, `SORU_ETIKET`,
 * `DURUM_ETIKET`). Yeni bir kart tipi ya da durum eklendiğinde rehber
 * kendiliğinden güncellenir — kimse "rehberi de güncelle" diye hatırlamak
 * zorunda kalmaz, eskimiş ekran görüntüsü diye bir şey olmaz.
 *
 * Editoryal kural: tekrar yok (aynı bilgi iki bölümde geçmez), dolgu yok,
 * her bölümde bir "sık karşılaşılanlar" tablosu, uyarı kutusu YALNIZ gerçek
 * tuzak için.
 */
/**
 * Pano tablosunun açıklama sütunu — durum etiketleriyle aynı kaynaktan beslenir.
 *
 * TRAIN_BOLUMLER'DEN ÖNCE tanımlı olmak ZORUNDA: bölümlerin içeriği JSX olarak
 * modül yüklenirken değerlendiriliyor ve içindeki `.map(...)` bu sabiti okuyor.
 * Aşağıda dursaydı geçici ölü bölgeye düşer ve rehber açılır açılmaz tüm sayfa
 * "Application error" ile çökerdi — derleme de, tip denetimi de sessiz kalır.
 */
const DURUM_ACIKLAMA: Record<AtamaDurumu, string> = {
  tamam: "Geçerli bir tamamlama var, yapılacak bir şey yok.",
  suresiDoluyor: "Geçerliliğin bitmesine 30 günden az kaldı.",
  suresiDoldu: "Tekrar süresi geçti; yeniden alınmalı.",
  eksik: "Hiç girilmemiş, son tarih henüz geçmemiş.",
  gecikti: "Son tarih geçti ve hâlâ girilmemiş.",
  kaldi: "Girmiş ama geçememiş — \"hiç girmemiş\" ile karıştırmayın.",
};

export const TRAIN_BOLUMLER: RehberBolum[] = [
  {
    id: "kurulum",
    kicker: "BAŞLARKEN",
    baslik: "Kurulum ve personel listesi",
    icerik: (
      <>
        <p>
          FlowTrain iç ağdaki tek bir sunucuda çalışır. İnternet, VPN veya kurumsal hesap gerektirmez; işçi tarafında
          hiçbir kurulum yoktur.
        </p>

        <Adimlar
          items={[
            {
              baslik: "İlk yöneticiyi açın",
              metin: (
                <>
                  Sunucu adresini açtığınızda kurulum ekranı gelir. Ürünle birlikte gelen varsayılan şifre{" "}
                  <strong>yoktur</strong> — ilk hesabı siz belirlersiniz. Kurulum bir kez çalışır, sonra kapanır.
                </>
              ),
            },
            {
              baslik: "Personel listesini getirin",
              metin: (
                <>
                  İki yol var: veri klasörüne <code>personel.csv</code> koyun (yolu <strong>Ayarlar</strong> gösterir),
                  ya da <strong>Personel</strong> sayfasından kurumun dışa aktarımını içe aktarın. Bir kayıt üç
                  şeydir: <code>sicil</code>, <code>ad</code>, <code>maliyet merkezi</code>. Ayırıcı <code>;</code> ya
                  da <code>,</code> olabilir, Excel&apos;in BOM&apos;lu dosyası da okunur.
                </>
              ),
            },
            {
              baslik: "Maliyet merkezlerini eşleyin",
              metin: (
                <>
                  <strong>Personel → Maliyet merkezi eşlemesi</strong>: her koda bir bölüm ve bir amir bağlayın.
                  Bölüm ve amir elle yazılmaz, koddan türer.
                </>
              ),
            },
            {
              baslik: "Hesapları tanımlayın",
              metin: (
                <>
                  <strong>Hazırlayan</strong> eğitim yazar, <strong>onaylayan</strong> yayına alır,{" "}
                  <strong>amir</strong> kendi ekibini görür, <strong>yönetici</strong> hepsini yapar.
                </>
              ),
            },
          ]}
        />

        <Kutu tur="uyari" baslik="Amir hesabına sicil girmeyi unutmayın">
          Ekip listesi, personel kaydındaki <strong>amir</strong> alanından çıkar. Amir hesabına sicil girilmezse o
          kişi giriş yapar ama ekranı boş görür — hiçbir hata da almaz. Ayarlar sayfasındaki &quot;amir sütunu
          doluluk&quot; satırı bunu size söyler.
        </Kutu>

        <Baslik>Neden bölüm ve amir elle yazılmıyor</Baslik>
        <p>
          Kurumun sisteminde kişinin bölümü ayrı bir alan olarak durmaz; <strong>maliyet merkezi</strong> kodu onu
          söyler. FlowTrain de bölümü ve amiri o koddan türetir. Elle de girilebilseydi iki gerçek yarışırdı: kurumdan
          gelen her yeni liste, elle yapılan düzeltmeleri ezer ve kimse neyin doğru olduğunu bilemezdi.
        </p>
        <p>
          Bir kişiyi <strong>amir</strong> yapmak için Personel sayfasından rolünü değiştirin; o kişi artık maliyet
          merkezi eşlemesinde amir olarak seçilebilir ve kendi ekibini görür. Varsayılan rol operatördür.
        </p>

        <Baslik>Sık karşılaşılanlar</Baslik>
        <Tablo
          basliklar={["Durum", "Sebebi"]}
          satirlar={[
            ["Personel listesi boş görünüyor", "Dosya yanlış klasörde ya da adı farklı. Ayarlar'daki yolu birebir kullanın."],
            ["Türkçe harfler bozuk", "Dosya UTF-8 değil. Excel'de \"CSV UTF-8\" olarak kaydedin."],
            ["Yeni giren personel görünmüyor", "Dosya güncellendi ama okunmadı: Ayarlar → \"Personel dosyasını yeniden oku\"."],
            ["Tüm satırlar tek sütuna yapışmış", "Ayırıcı sorunudur; dosyayı olduğu gibi bırakın, FlowTrain ikisini de tanır."],
            ["Kişinin bölümü boş", "O maliyet merkezinin eşlemesi tanımlı değil. Personel sayfasından tanımlayıp \"Tüm listeye uygula\" deyin."],
          ]}
        />
      </>
    ),
  },

  {
    id: "hazirlama",
    kicker: "İÇERİK",
    baslik: "Eğitim hazırlama",
    icerik: (
      <>
        <p>
          <strong>En hızlı yol sıfırdan yazmak değil.</strong> Elinizde zaten bir ISG sunumu, talimat ya da prosedür
          vardır: onu PDF olarak kaydedip yükleyin, her sayfa bir karta dönüşür. Üç dakikada ilk eğitiminiz ayaktadır.
        </p>
        <p>
          PowerPoint için: <em>Dosya → Farklı Kaydet → PDF</em>. Dönüştürme tarayıcıda yapılır, sunucuya ek bir program
          kurmanız gerekmez.
        </p>

        <Baslik>Sıfırdan yazarken: kart tipleri</Baslik>
        <p>
          Serbest tasarım tuvali <strong>bilerek yok</strong>. Siz metni yazar ve görseli seçersiniz; yerleşimi,
          puntoyu ve rengi ürün belirler. Böylece hiçbir eğitim &quot;kötü görünen eğitim&quot; olamaz.
        </p>
        <Tablo
          basliklar={["Kart", "Ne için"]}
          satirlar={(Object.keys(KART_ETIKET) as KartTipi[]).map((t) => [KART_ETIKET[t], KART_ACIKLAMA[t]])}
        />

        <Baslik>Sorular</Baslik>
        <Tablo
          basliklar={["Tip", "Notu"]}
          satirlar={[
            [SORU_ETIKET.coktanSecmeli, "Tek doğru şık. En yaygın kullanılan."],
            [SORU_ETIKET.dogruYanlis, "Şıklar sabittir, yazmanıza gerek yok."],
            [
              SORU_ETIKET.cokluSecim,
              "Birden çok doğru şık. Puanlama hep ya da hiç: eksik işaretleme yarım puan almaz.",
            ],
          ]}
        />
        <p>
          Havuza sınavda sorulacaktan <strong>fazla</strong> soru yazın. Havuz sınavla eşitse herkese aynı sorular
          gelir ve karıştırmanın bir anlamı kalmaz.
        </p>

        <p>
          Hazır olduğunuzda <Dugme icon="play">Dene</Dugme> düğmesi eğitimi kiosk&apos;ta göründüğü gibi açar. Bu bir
          provadır: hiçbir kayıt düşmez, kimsenin sicili işlenmez.
        </p>

        <Baslik>Sık karşılaşılanlar</Baslik>
        <Tablo
          basliklar={["Durum", "Sebebi"]}
          satirlar={[
            ["Yayınla düğmesi kapalı", "Eğitimde hiç sayfa yok; en az bir kart ekleyin."],
            ["Yayınla düğmesi hiç görünmüyor", "Rolünüz hazırlayan. Yayına almayı onaylayan yapar."],
            ["PDF yükleniyor ama bitmiyor", "Çok büyük bir dosya olabilir; sayfa sayısını bölerek deneyin."],
            ["Bir soruda \"anlatım yetersiz olabilir\" yazıyor", "O soruyu çoğunluk yanlış yapıyor — sorun kişilerde değil, o konuyu anlatan sayfada."],
          ]}
        />
      </>
    ),
  },

  {
    id: "atama",
    kicker: "DAĞITIM",
    baslik: "Kime, ne zamana kadar",
    icerik: (
      <>
        <p>
          Kişi kişi atama yapmayın. <strong>Kural yazın</strong>: &quot;Kaynak bölümündeki herkes&quot;, &quot;işe
          girişinden itibaren ilk 3 gün içinde&quot;, &quot;yılda bir tekrar&quot;. Kişi kişi atama bir kereye mahsus
          kampanyadır; yarın işe giren kişi hiçbir eğitime atanmaz ve bunu kimse fark etmez.
        </p>

        <Baslik>Koşullar nasıl birleşir</Baslik>
        <Tablo
          basliklar={["Seçim", "Anlamı"]}
          satirlar={[
            ["Hiçbir şey seçilmedi", "Tüm personel."],
            ["Bölüm: Kaynak, Montaj", "Bu iki bölümden biri (VEYA)."],
            ["Bölüm: Kaynak + Görev: Forklift", "Kaynak bölümünde VE forklift görevinde olanlar."],
            ["İşe girişten sonra 3 gün", "Kişiye özel son tarih: herkesin kendi giriş tarihine göre."],
            ["Hem sabit hem kişiye özel tarih", "Erken olan geçerlidir."],
          ]}
        />
        <p>
          Kural formunda süzgeç değerleri elle yazılmaz, personel listesinden gelir. Kuralı eklerken kaç kişiyi
          kapsadığı satırın altında yazar — atadığınız kişi sayısını kiosk&apos;ta kuyruk olunca değil, şimdi görün.
        </p>

        <Kutu tur="uyari" baslik="Taslak eğitim kimseye düşmez">
          Kural yazsanız bile eğitim <strong>yayında</strong> değilse kiosk&apos;ta hiç görünmez. Bu bilinçli: yarım
          kalmış içerik hatta çıkmasın. Kural satırında &quot;eğitim taslakta&quot; uyarısı belirir.
        </Kutu>

        <Baslik>Sık karşılaşılanlar</Baslik>
        <Tablo
          basliklar={["Durum", "Sebebi"]}
          satirlar={[
            ["Kural 0 kişiyi kapsıyor", "Seçtiğiniz bölüm/görev personel dosyasında o yazımla geçmiyor olabilir."],
            ["Kişide görev boş, kural görev süzüyor", "O kişi kapsam dışı kalır. \"Bilinmiyor\" herkes demek değildir."],
            ["Eğitim iki kuraldan da düşüyor", "Kişiye bir kez atanır; iki tarihten erken olanı geçerlidir."],
          ]}
        />
      </>
    ),
  },

  {
    id: "kiosk",
    kicker: "SAHA",
    baslik: "Kiosk ve amir tableti",
    icerik: (
      <>
        <p>
          İşçinin hesabı, şifresi ya da e-postası <strong>olmasına gerek yoktur</strong>. Kiosk ekranı hattaki tablette
          açık kalır; kişi kartını okutur veya sicilini yazar, eğitimini izler, sınavını olur.
        </p>
        <p>
          Kart okuyucular klavye gibi davranır: kartı okutunca rakamları yazıp Enter&apos;a basarlar. Sicil alanı bu
          yüzden hep odakta durur, önce ekrana dokunmak gerekmez.
        </p>

        <Baslik>Amir tableti</Baslik>
        <p>
          <strong>Ekibim</strong> ekranı amirin karnesidir: kaç kişi, kaç eksik, kaçının süresi doluyor.{" "}
          <Dugme icon="play" birincil>
            Başlat
          </Dugme>{" "}
          dediğinizde eğitim sizin gözetiminizde açılır — ama bitirme PIN&apos;ini <strong>kişinin kendisi</strong>{" "}
          girer. Kayıtta hem sizin hem onun imzası durur; bu, kâğıt imzadan daha güçlü bir belgedir.
        </p>

        <Kutu tur="uyari" baslik="PIN imza yerine geçer">
          Kişi ilk kez girerken kendi PIN&apos;ini belirler ve bundan sonra her tamamlamada onu girer. Amir bu adımı
          atlayamaz. PIN&apos;i paylaşmak, kâğıda başkasının yerine imza atmakla aynı şeydir.
        </Kutu>

        <Baslik>Sık karşılaşılanlar</Baslik>
        <Tablo
          basliklar={["Durum", "Sebebi"]}
          satirlar={[
            ["\"Sicil bulunamadı\"", "Kişi personel dosyasında yok ya da dosya güncellenmemiş."],
            ["\"Bekleyen eğitiminiz yok\"", "Kişi kapsam dışı, ya da hepsini zaten tamamlamış."],
            ["İleri düğmesi kilitli, geri sayıyor", "Kartın asgari kalma süresi dolmadı. Süreyi hazırlayan belirler."],
            ["Video ileri sarılmıyor", "İlk izlemede atlanamaz. İkinci izlemede geri sarıp tekrar bakabilirsiniz."],
            ["\"Deneme hakkınız doldu\"", "Sınırı hazırlayan koyar. Yeni hak vermek için amire/hazırlayana başvurun."],
          ]}
        />
      </>
    ),
  },

  {
    id: "katalog",
    kicker: "DÜZEN",
    baslik: "Paketler ve QR etiketleri",
    icerik: (
      <>
        <p>
          Eğitim sayısı otuzu geçtiğinde liste tek başına yetmez. İki araç var: <strong>kategori</strong> (katalogda
          süzer, panoda kırılım verir) ve <strong>paket</strong> (birlikte verilen eğitimleri tek ada bağlar).
        </p>

        <Baslik>Paket neden kuralı kolaylaştırır</Baslik>
        <p>
          Atama kuralını tek tek eğitimlere yazarsanız, oryantasyona altıncı eğitim eklendiği gün altı kuralı da elden
          geçirmeniz gerekir — biri mutlaka unutulur ve o eğitim kimseye düşmez. Kural{" "}
          <strong>pakete</strong> yazılırsa, pakete sonradan eklenen eğitim aynı kişilere kendiliğinden gider.
        </p>
        <p>
          Paket silinirse kuralları da silinir; paketten çıkarılan eğitim o kuralla artık atanmaz. Boş pakete kural
          yazılamaz — hiçbir şey atamayacağı hâlde &quot;yazdım&quot; hissi verirdi.
        </p>

        <Baslik>QR: eğitimi istasyonun başına götürmek</Baslik>
        <p>
          Her eğitimin bir QR etiketi var. Etiket hattaki istasyona asılır; işçi tabletle okutur ve doğrudan o eğitim
          açılır — listede arayıp bulması gerekmez. İş başı eğitimi böylece makinenin başında, işin yapıldığı yerde
          tamamlanır.
        </p>
        <Adimlar
          items={[
            {
              baslik: "Adresi bir kez yazın",
              metin: (
                <>
                  Ayarlar → <strong>Kurulumun ağ adresi</strong>. Tabletin tarayıcısından kurulumun göründüğü adresi
                  yazın.
                </>
              ),
            },
            { baslik: "Etiketleri seçin", metin: "Eğitimler → QR etiketleri. Basılacak eğitimleri işaretleyin." },
            { baslik: "Yazdırın ve asın", metin: "A4'e üçlü ızgarada çıkar. Etiket, ait olduğu makinenin yanına asılır." },
          ]}
        />

        <Kutu tur="uyari" baslik="localhost yazmayın">
          Ofis makinesinde çalışan tarayıcının adres çubuğundaki <code>localhost</code>, tablette &quot;tabletin
          kendisi&quot; demektir. O adresle basılan etiketler hatta hiçbir şey açmaz. Kurulumun ağdaki gerçek adresini
          yazın.
        </Kutu>

        <Baslik>Sık karşılaşılanlar</Baslik>
        <Tablo
          basliklar={["Durum", "Sebebi"]}
          satirlar={[
            ["Aynı kategori listede iki kez", "Yazım farkı. Kategori yazarken mevcut olanlardan seçin; sistem büyük/küçük harf farkını kendiliğinden birleştirir."],
            ["QR okutuldu ama eğitim açılmadı", "O eğitim kişiye atanmamış olabilir, ya da eğitim taslakta. Taslak eğitim kimseye düşmez."],
            ["Pakete kural yazılamıyor", "Paket boş. Önce üye eğitimleri ekleyin."],
          ]}
        />
      </>
    ),
  },

  {
    id: "takip",
    kicker: "TAKİP",
    baslik: "Pano, denetim ve kayıtlar",
    icerik: (
      <>
        <p>
          <strong>Pano</strong> tek bir soruya cevap verir: kim geride? Tamamlanma oranı, bölüm kırılımı ve durum
          dağılımı burada. Durumların anlamı:
        </p>
        <Tablo
          basliklar={["Durum", "Anlamı"]}
          satirlar={(Object.keys(DURUM_ETIKET) as AtamaDurumu[]).map((d) => [DURUM_ETIKET[d], DURUM_ACIKLAMA[d]])}
        />

        <Baslik>Gözetimli oturum deseni</Baslik>
        <p>
          Panodaki bu satır, bir amirin gözetiminde yapılan oturumlar beklenenden çok daha hızlı bittiğinde dolar —
          örneğin <em>&quot;12 kayıt · ort. 2 dk · beklenen 6 dk&quot;</em>.
        </p>
        <p>
          Bu bir <strong>suçlama değil, bir sorudur</strong>. Kayıt engellenmez, kimse kilitlenmez; hızlı bitirmenin
          masum açıklamaları olabilir. Ama görünmeyen bir desen düzeltilemez, ve sahte bir eğitim kaydı kâğıttan
          beterdir.
        </p>

        <Baslik>Kayıt defteri</Baslik>
        <p>
          Panonun cevapladığı soru &quot;kim geride&quot;; <strong>Kayıt defteri</strong>nin cevapladığı soru
          &quot;bu kişi bunu ne zaman aldı&quot;. Denetimde açılan ekran budur: süzülür, CSV/PDF olarak indirilir,
          kişi başına sertifika basılır.
        </p>
        <p>
          Defterde <strong>düzenleme ve silme yoktur</strong>. Sonradan değiştirilebilen bir tamamlama kaydı denetimde
          hiçbir şey kanıtlamaz — kaydın değeri, değiştirilememesinden gelir. Yanlış bir kayıt{" "}
          <em>silinmez, düzeltilir</em>: doğru bilgiyle yeni bir kayıt girilir ve notuna hangi kaydı düzelttiği
          yazılır. İki satır da defterde kalır, denetçi ikisini de görür.
        </p>

        <Baslik>Kioskta verilmeyen eğitimler</Baslik>
        <p>
          Her eğitim tablette tamamlanmaz; bir eğitmen otuz kişiye sınıfta anlatır. O kayıt da aynı deftere düşmeli,
          yoksa panonun tamamlanma oranı gerçeği göstermez.
        </p>
        <Tablo
          basliklar={["Yol", "Ne zaman", "Kaydın kaynağı"]}
          satirlar={[
            ["Kayıtlar → Sınıf eğitimi", "Eğitmen anlattı, katılım listesi var", "Sınıf eğitimi"],
            ["Kayıtlar → Geçmiş aktarımı", "Başka sistemden gelen eski kayıtlar", "Dış aktarım"],
          ]}
        />
        <p>
          Her kaydın kaynağı defterde görünür: kioskta mı dönmüş, amir gözetiminde mi, sınıfta mı verilmiş, dışarıdan
          mı gelmiş. Denetimde karıştırılmaz.
        </p>

        <Kutu tur="uyari" baslik="Canlıya geçerken İLK yapılacak iş">
          Geçmiş kayıtları içe aktarmadan başlarsanız, ilk gün pano <strong>herkesi eksik gösterir</strong>: yıllardır
          eğitimli olan fabrika, sisteme göre hiç eğitim almamıştır. Amirler yüzlerce sahte eksikle karşılaşır ve
          ürüne olan güven ilk günden gider. Önce aktarın, sonra duyurun.
        </Kutu>

        <Baslik>Kayıtlar ve yedek</Baslik>
        <p>
          Her tamamlama, veri klasöründeki <code>kayitlar.csv</code> dosyasına eklenir — bu dosya kurumun belgesidir,
          FlowTrain kaldırılsa bile elinizde kalır. Panodan indirilen CSV ise <strong>tam listedir</strong>: ekrandaki
          süzgeç ne gizlerse gizlesin, denetim belgesi eksik çıkmaz. Kayıt defterinden indirilen çıktı süzülmüş
          olabilir; o yüzden hangi süzgeçle alındığı belgenin başlığına yazılır.
        </p>

        <Kutu tur="not" baslik="Yedek almak = veri klasörünü kopyalamak">
          Veritabanı, yüklenen görsel ve videolar, kayıt dosyası — hepsi tek klasörde. Yolu Ayarlar sayfası gösterir.
          Başka hiçbir yerde saklanan veri yoktur.
        </Kutu>

        <Baslik>Sık karşılaşılanlar</Baslik>
        <Tablo
          basliklar={["Durum", "Sebebi"]}
          satirlar={[
            ["\"X kayıt gönderilemedi, bekliyor\"", "Dış hedefe yazılamadı. Kayıtlar yerelde duruyor, kaybolmadı — Ayarlar'dan yeniden gönderin."],
            ["Oran düşük ama kimse eksik görünmüyor", "Eğitim taslakta olabilir; taslak eğitimin ataması sayılmaz."],
            ["CSV Excel'de bozuk açılıyor", "Dosyayı çift tıklayarak açın; içe aktarma sihirbazı ayırıcıyı değiştirebiliyor."],
          ]}
        />
      </>
    ),
  },
];
