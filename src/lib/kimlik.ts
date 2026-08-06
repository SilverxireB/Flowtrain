import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ayarOku, ayarYaz, hesapDogrula, hesapSayisi, type Hesap, type Rol } from "./depo";

/**
 * KOKPİT KİMLİĞİ — hazırlayan / onaylayan / amir / yönetici.
 *
 * KİOSK BURAYA HİÇ UĞRAMAZ. Kiosk'ta kimliği doğrulanan CİHAZDIR; kişi sicil
 * ve PIN ile ATFEDİLİR. Bunu "eksik kimlik" diye düzeltmeye kalkma — ürünün
 * var olma sebebi bu (işçilerin çoğunun kurumsal hesabı yok).
 *
 * Çerez imzalı, sunucu tarafında doğrulanır. Dış kimlik sağlayıcı YOK:
 * kapalı ağda Okta/SSO'ya erişim zaten yok.
 */
const COOKIE = "ft_oturum";
const SURE_SN = 60 * 60 * 12; // bir vardiya + pay

/** İmza anahtarı ilk çalıştırmada üretilip veri klasöründe saklanır. */
function anahtar(): string {
  let a = ayarOku("oturumAnahtari");
  if (!a) {
    a = randomBytes(32).toString("hex");
    ayarYaz("oturumAnahtari", a);
  }
  return a;
}

function imzala(govde: string): string {
  return createHmac("sha256", anahtar()).update(govde).digest("base64url");
}

function paketle(hesap: Hesap): string {
  const govde = Buffer.from(
    JSON.stringify({ k: hesap.kullanici, a: hesap.ad, r: hesap.rol, s: hesap.sicil ?? null, t: Date.now() }),
  ).toString("base64url");
  return `${govde}.${imzala(govde)}`;
}

function ac(deger: string | undefined): Hesap | null {
  if (!deger) return null;
  const [govde, imza] = deger.split(".");
  if (!govde || !imza) return null;

  const beklenen = Buffer.from(imzala(govde));
  const gelen = Buffer.from(imza);
  if (beklenen.length !== gelen.length || !timingSafeEqual(beklenen, gelen)) return null;

  try {
    const v = JSON.parse(Buffer.from(govde, "base64url").toString("utf8"));
    if (Date.now() - v.t > SURE_SN * 1000) return null;
    return { kullanici: v.k, ad: v.a, rol: v.r as Rol, sicil: v.s ?? undefined };
  } catch {
    return null;
  }
}

export async function girisYap(kullanici: string, sifre: string): Promise<Hesap | null> {
  const hesap = hesapDogrula(kullanici, sifre);
  if (!hesap) return null;
  cookies().set(COOKIE, paketle(hesap), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SURE_SN,
    // `secure` BİLEREK yok: kapalı ağda kurulum çoğu zaman düz http üstünden
    // yapılıyor (iç sunucuda sertifika yok). `secure` açık olsaydı çerez hiç
    // yazılmaz, giriş sessizce başarısız olurdu.
  });
  return hesap;
}

export function cikisYap(): void {
  cookies().delete(COOKIE);
}

export function aktifHesap(): Hesap | null {
  return ac(cookies().get(COOKIE)?.value);
}

/** Kurulum tamamlanmış mı — hiç hesap yoksa ilk yönetici oluşturulur. */
export function kurulumGerekli(): boolean {
  return hesapSayisi() === 0;
}

const ROL_SIRASI: Record<Rol, number> = { amir: 1, hazirlayan: 2, onaylayan: 3, yonetici: 4 };

/** Yönetici her kapıdan geçer; onaylayan hazırlayanın yaptığını da yapar. */
export function yetkili(hesap: Hesap | null, enAz: Rol): boolean {
  if (!hesap) return false;
  if (hesap.rol === "yonetici") return true;
  // Amir ayrı bir daldır: hazırlama yetkisi vermez, yalnız kendi ekibini görür.
  if (enAz === "amir") return true;
  if (hesap.rol === "amir") return false;
  return ROL_SIRASI[hesap.rol] >= ROL_SIRASI[enAz];
}

/**
 * Sayfa kapısı. Oturumsuz kullanıcı GELDİĞİ YERE dönebilsin diye hedef
 * `next` ile taşınır — paylaşılan bir bağlantıyı açan kişi giriş sonrası
 * aradığı şeye varır, hub'a düşmez.
 */
export function kapi(enAz: Rol, buYol: string): Hesap {
  if (kurulumGerekli()) redirect("/kurulum");
  const hesap = aktifHesap();
  if (!hesap) redirect(`/giris?next=${encodeURIComponent(buYol)}`);
  if (!yetkili(hesap, enAz)) redirect("/?yetki=yok");
  return hesap;
}

/**
 * `next` YALNIZ tek eğik çizgiyle başlayan iç yollar olabilir.
 * `//baska-site` protokole göreli bir ADRESTİR ve açık yönlendirme kapısı açar.
 */
export function guvenliYol(next: string | undefined, varsayilan = "/"): string {
  if (!next) return varsayilan;
  if (!next.startsWith("/") || next.startsWith("//")) return varsayilan;
  return next;
}
