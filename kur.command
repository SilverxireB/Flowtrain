#!/bin/bash
# macOS: çift tıklayınca çalışır. (İlk kullanımda: sağ tık → Aç.)
cd "$(dirname "$0")" || exit 1

if ! command -v node >/dev/null 2>&1; then
  echo
  echo "  Node.js bulunamadı."
  echo "  https://nodejs.org adresinden LTS sürümünü kurun,"
  echo "  sonra bu dosyayı tekrar çalıştırın."
  echo
  read -r -p "  Kapatmak için Enter…"
  exit 1
fi

node scripts/kur.mjs
