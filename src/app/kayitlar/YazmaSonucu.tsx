import Link from "next/link";
import Icon from "@/components/Icon";

/**
 * "N kayıt deftere yazıldı" — SUNUCUDAN çizilen yazma onayı.
 *
 * NEDEN SUNUCUDA: bu yazı eskiden formun kendi durumunda tutuluyordu ve hiç
 * görünmüyordu. Sebebi ölçüldü (bkz. `eylemler.ts` → `sonucaDon`): yazma
 * eylemi `revalidatePath` çağırdığı için bulunulan sayfa yeniden kuruluyor ve
 * form bileşeni, az önce kurduğu sonuç durumuyla birlikte sıfırdan doğuyor.
 * Onay, yeniden kurulmayı atlatan bir yerde durmak zorunda; adres öyle bir yer.
 *
 * ONAY BOŞLUĞU ÜRÜNÜN EN PAHALI HATASIYDI: eğitmen otuz kişilik kâğıt listeyi
 * giriyor, Kaydet'e basıyor ve boşalmış bir form görüyordu. "Girdi mi, gitti
 * mi?" sorusunun cevabı yoktu; ikinci kez kaydetmek de mükerrer denetimine
 * takıldığı için ekranda yine bir şey değişmiyordu.
 *
 * DEFTERE BAĞLANTI BİLEREK VAR: onayın tek başına inandırıcılığı sınırlı,
 * "kaydı gör" bir tık ötede olmalı — denetime giren şey kaydın kendisi.
 */
export default function YazmaSonucu({ yazildi, atlanan }: { yazildi: number; atlanan: number }) {
  /* SIFIR YAZILDIYSA BAŞARI RENGİ KULLANILMAZ. "0 kayıt yazıldı" yeşil bir
     kutuda, hiçbir şey olmamasını olmuş gibi gösterirdi. */
  const basarili = yazildi > 0;

  return (
    <div
      role="status"
      className={`mb-5 rounded-xl border px-4 py-3 text-sm ${
        basarili ? "border-iyi/40 bg-iyi/10" : "border-orta/40 bg-orta/10"
      }`}
    >
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold">
        <Icon name={basarili ? "check" : "warning"} size={16} />
        {yazildi} kayıt deftere yazıldı
        {atlanan > 0 ? `, ${atlanan} satır atlandı.` : "."}
        {/* Bağlantıda süzgeç parametresi YOK: defter süzgeçlerini istemcide
            tutuyor ve adresten okumuyor; `?kaynak=sinif` yazmak süzülmüş bir
            görünüm vaat edip düz listeye götürürdü. */}
        {basarili ? (
          <Link href="/kayitlar" className="font-semibold text-accent underline">
            Kayıt defterinde gör
          </Link>
        ) : null}
      </p>
      {basarili ? (
        <p className="mt-1 font-normal text-muted">
          Kayıtlar düzenlenmez ve silinmez. Yanlış bir kayıt için defterden{" "}
          <strong className="text-ink">Düzeltme kaydı</strong> yolunu kullanın.
        </p>
      ) : null}
    </div>
  );
}

/**
 * Adresteki sayıyı güvenle okur.
 *
 * Adres çubuğuna elle yazılabilir; ekranda "NaN kayıt yazıldı" görmek, gerçek
 * bir hatayla karıştırılacak bir gürültüdür. Sayı değilse sonuç şeridi hiç
 * çizilmez (`null`).
 */
export function sonucOku(ham: string | string[] | undefined): number | null {
  if (typeof ham !== "string") return null;
  const n = Number(ham);
  return Number.isInteger(n) && n >= 0 && n < 1_000_000 ? n : null;
}
