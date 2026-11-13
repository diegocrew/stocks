#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
project_root="$(pwd -P)"
repository_root="$(git rev-parse --show-toplevel)"
signing_dir="$HOME/.config/stock-atlas"
umask 077
mkdir -p "$signing_dir"
chmod 700 "$signing_dir"
case "$(realpath "$signing_dir")/" in
  "$repository_root/"*) echo 'Signing credentials must be outside the repository.' >&2; exit 1 ;;
esac

credentials="$signing_dir/signing.env"
keystore="$signing_dir/upload.p12"
if [ ! -f "$credentials" ]; then
  if [ -e "$keystore" ]; then
    echo 'Upload key exists but signing.env is missing. Restore your credential backup; do not generate a replacement key.' >&2
    exit 1
  fi
  export STOCK_ATLAS_KEYSTORE="$keystore"
  export STOCK_ATLAS_KEY_ALIAS=stock-atlas-upload
  STOCK_ATLAS_STORE_PASSWORD="$(node -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("hex"))')"
  export STOCK_ATLAS_STORE_PASSWORD
  export STOCK_ATLAS_KEY_PASSWORD="$STOCK_ATLAS_STORE_PASSWORD"
  keytool -genkeypair -storetype PKCS12 -keystore "$keystore" \
    -alias "$STOCK_ATLAS_KEY_ALIAS" -keyalg RSA -keysize 3072 -validity 10000 \
    -dname 'CN=Stock Atlas Upload' \
    -storepass:env STOCK_ATLAS_STORE_PASSWORD -keypass:env STOCK_ATLAS_KEY_PASSWORD
  for name in STOCK_ATLAS_KEYSTORE STOCK_ATLAS_KEY_ALIAS STOCK_ATLAS_STORE_PASSWORD STOCK_ATLAS_KEY_PASSWORD; do
    printf 'export %s=%q\n' "$name" "${!name}" >> "$credentials"
  done
fi

chmod 600 "$credentials" "$keystore"
# shellcheck source=/dev/null
source "$credentials"
test -f "$STOCK_ATLAS_KEYSTORE"
printf 'Using private upload credentials in %s (back up this directory securely).\n' "$signing_dir"

npx expo prebuild --platform android --no-install
(
  cd android
  ./gradlew --no-daemon --max-workers=2 :app:bundleRelease :app:assembleRelease \
    -PreactNativeArchitectures=arm64-v8a,x86_64
)
mkdir -p releases
cp android/app/build/outputs/bundle/release/app-release.aab releases/stock-atlas-1.0.0.aab
cp android/app/build/outputs/apk/release/app-release.apk releases/stock-atlas-1.0.0.apk
printf 'Release bundle and standalone APK are in %s/releases/.\n' "$project_root"
