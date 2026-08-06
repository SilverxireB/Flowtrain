/** Sınavlar için minik yardımcı — dış bağımlılık yok (kapalı ağ kuralı). */
let hata = 0;
let toplam = 0;

export function kontrol(gecti, yazi) {
  toplam++;
  if (!gecti) hata++;
  console.log(`${gecti ? "✓" : "✗"} ${yazi}`);
}

export function esit(a, b, yazi) {
  const ok = JSON.stringify(a) === JSON.stringify(b);
  kontrol(ok, ok ? yazi : `${yazi}\n    beklenen: ${JSON.stringify(b)}\n    gelen:    ${JSON.stringify(a)}`);
}

export function bitir(baslik) {
  console.log(`\n${baslik}: ${toplam - hata}/${toplam}`);
  if (hata) process.exit(1);
}
