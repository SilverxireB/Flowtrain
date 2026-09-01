import FlowSpinner from "./FlowSpinner";

/**
 * YÜKLENİYOR — sayfa geçişinde boş ekran yerine markanın kendisi.
 *
 * NEDEN LOGO: bekleme anı bir kusur değil, ürünün bir parçası; ama BOŞ bir
 * ekran kusurdur — insan tıklamasının gidip gitmediğini bilemiyor ve tekrar
 * basıyor. Dönen şey markanın O-halkası: zaten bir halka, dolayısıyla ayrıca
 * bir "spinner çizimi" uydurmaya gerek yok.
 *
 * ARTIK `FlowSpinner` ÇİZİYOR (FlowUI'dan kopyalandı). Eskiden burada dönen
 * `Halka` vardı ve tek bir hareketi vardı; kadro dörde çıktı ve dördü de
 * marka yaylarının kendisiyle oynuyor. Hareketi azalt açık olan cihazda
 * süsler susup yaylar nefes alıyor — o dert bileşenin kendi CSS'inde
 * çözülü, burada tekrar edilmiyor.
 */
export default function Yukleniyor({ not }: { not?: string }) {
  return (
    <div className="grid min-h-[60vh] place-items-center px-5">
      <FlowSpinner etiket={not ?? "Yükleniyor…"} />
    </div>
  );
}
