import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type Database from "better-sqlite3";

/**
 * PIN = İŞÇİNİN İMZASI.
 *
 * NEDEN AYRI DOSYA: bu mantık ürünün sattığı şeyin ta kendisi (kayıt), ama
 * `depo.ts` içinde `server-only` ile birlikte durduğu için sınav yazılamıyordu.
 * Bedeli somuttu: `pinDogrula` boolean'dan durum dizgesine dönerken çağıran
 * bir süre `if (!pinDogrula(...))` olarak kaldı — `!"yanlis"` false olduğu için
 * HER YANLIŞ PIN kabul edilir hâle geldi ve ne TypeScript ne de sınavlar
 * bunu gördü. Artık `bellekDb()` ile doğrudan sınanıyor.
 *
 * Sınav: `node tests/pin.test.mjs`
 */

/** Kaç hatalı denemeden sonra kilitlenir ve ne kadar kilitli kalır. */
export const PIN_DENEME_SINIRI = 5;
export const PIN_KILIT_DK = 15;

export type PinSonucu = "dogru" | "yanlis" | "kilitli" | "yok";

function ozetle(deger: string, tuz: string): string {
  return scryptSync(deger, tuz, 32).toString("hex");
}

/**
 * PIN'i düz metin TUTMA. Dört haneli bir sırrın kaba kuvvete dayanması zaten
 * mümkün değil — buradaki amaç sızıntıda listeyi olduğu gibi vermemek ve aynı
 * PIN'i kullanan iki kişinin özetinin eşleşmemesi (kişiye özel tuz).
 */
export function pinKur(db: Database.Database, sicil: string, pin: string, simdi: string): void {
  const tuz = randomBytes(16).toString("hex");
  db.prepare(
    `INSERT INTO pin (sicil,ozet,tuz,olusturma,hataliDeneme,kilitBitis) VALUES (?,?,?,?,0,NULL)
     ON CONFLICT(sicil) DO UPDATE SET ozet=excluded.ozet, tuz=excluded.tuz, hataliDeneme=0, kilitBitis=NULL`,
  ).run(sicil, ozetle(pin, tuz), tuz, simdi);
}

export function pinVarMi(db: Database.Database, sicil: string): boolean {
  return !!db.prepare("SELECT 1 FROM pin WHERE sicil=?").get(sicil);
}

export function pinSifirla(db: Database.Database, sicil: string): void {
  db.prepare("DELETE FROM pin WHERE sicil=?").run(sicil);
}

/**
 * PIN doğrulama — DENEME SAYAÇLI.
 *
 * Sayaçsız bir doğrulama, kapalı ağdaki herhangi bir cihazdan 10.000 istekle
 * başkasının imzasını ele geçirmeye yeter. Kilit SİCİL bazlıdır (cihaz değil):
 * saldırgan tarayıcı değiştirerek sıfırlayamaz.
 */
export function pinDogrula(db: Database.Database, sicil: string, pin: string, simdi: string): PinSonucu {
  const r = db.prepare("SELECT ozet,tuz,hataliDeneme,kilitBitis FROM pin WHERE sicil=?").get(sicil) as
    | { ozet: string; tuz: string; hataliDeneme: number; kilitBitis: string | null }
    | undefined;
  if (!r) return "yok";
  if (r.kilitBitis && r.kilitBitis > simdi) return "kilitli";

  const a = Buffer.from(r.ozet, "hex");
  const b = Buffer.from(ozetle(pin, r.tuz), "hex");
  if (a.length === b.length && timingSafeEqual(a, b)) {
    db.prepare("UPDATE pin SET hataliDeneme=0, kilitBitis=NULL WHERE sicil=?").run(sicil);
    return "dogru";
  }

  const yeni = r.hataliDeneme + 1;
  const kilit =
    yeni >= PIN_DENEME_SINIRI
      ? new Date(new Date(simdi).getTime() + PIN_KILIT_DK * 60_000).toISOString()
      : null;
  db.prepare("UPDATE pin SET hataliDeneme=?, kilitBitis=? WHERE sicil=?").run(kilit ? 0 : yeni, kilit, sicil);
  return kilit ? "kilitli" : "yanlis";
}

export function pinDurumlari(
  db: Database.Database,
  simdi: string,
): { sicil: string; olusturma: string; kilitli: boolean }[] {
  return (
    db.prepare("SELECT sicil, olusturma, kilitBitis FROM pin ORDER BY olusturma DESC").all() as {
      sicil: string;
      olusturma: string;
      kilitBitis: string | null;
    }[]
  ).map((r) => ({ sicil: r.sicil, olusturma: r.olusturma, kilitli: !!r.kilitBitis && r.kilitBitis > simdi }));
}
