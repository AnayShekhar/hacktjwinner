#!/bin/bash
# Run Fern AI mobile app. Usage: ./run_mobile.sh
set -e
cd "$(dirname "$0")"
ROOT="$(pwd)"
MOBILE="$ROOT/fernai/fernai-mobile"

# Load nvm if available (so npm/npx work)
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  . "$HOME/.nvm/nvm.sh"
fi

if ! command -v npm &>/dev/null; then
  echo "npm not found. Install Node (e.g. nvm install --lts) and try again."
  exit 1
fi

cd "$MOBILE"
[ -d node_modules ] || npm install
# Unset CI so Expo shows QR code and doesn't error on empty CI
unset CI
echo "Starting Expo at fernai/fernai-mobile - press i for iOS, a for Android, w for web"
echo "QR code will appear below (scan with Expo Go on your phone)."
exec npx expo start --port 8085 --lan
