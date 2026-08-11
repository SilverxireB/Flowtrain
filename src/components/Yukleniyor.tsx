/**
 * YÜKLENİYOR — sayfa geçişinde boş ekran yerine markanın kendisi.
 *
 * NEDEN LOGO: bekleme anı bir kusur değil, ürünün bir parçası; ama BOŞ bir
 * ekran kusurdur — insan tıklamasının gidip gitmediğini bilemiyor ve tekrar
 * basıyor. Dönen şey markanın O-halkası: zaten bir halka, dolayısıyla ayrıca
 * bir "spinner çizimi" uydurmaya gerek yok. Görsel yüklenemezse (kapalı ağda
 * dosya eksikse) CSS halkasına düşer — bekleme ekranı bir PNG'ye bağlı olamaz.
 *
 * HAREKETİ AZALT açık olan cihazda dönmez, nefes alır: `globals.css` bütün
 * animasyonları 0,01 ms'ye indiriyor, dönen bir halka orada DONMUŞ görünürdü.
 * Bu yüzden ikisi ayrı `@keyframes` ve ikincisi opaklıkla çalışıyor.
 */
export default function Yukleniyor({ not }: { not?: string }) {
  return (
    <div className="grid min-h-[60vh] place-items-center px-5" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-3">
        <span className="yukleme-halka" aria-hidden />
        <span className="text-sm font-semibold text-muted">{not ?? "Yükleniyor…"}</span>
      </div>
    </div>
  );
}
