#!/bin/sh
set -eu

CERT_HOSTNAME="${CERT_HOSTNAME:-localhost}"
CERT_SAN="${CERT_SAN:-localhost,127.0.0.1}"
DAYS="${DAYS:-365}"
OUT_DIR="${OUT_DIR:-/work}"
CN="${CN:-$CERT_HOSTNAME}"

if [ -f "$OUT_DIR/fullchain.pem" ] && [ -f "$OUT_DIR/privkey.pem" ]; then
  echo "Cert already present in $OUT_DIR, skipping generation."
  exit 0
fi

mkdir -p "$OUT_DIR"

# Build the SAN list. Supports DNS names and IP addresses, comma separated.
SAN_ENTRIES="DNS:$CN"
OLD_IFS="$IFS"
IFS=','
for entry in $CERT_SAN; do
  entry=$(printf '%s' "$entry" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//')
  [ -n "$entry" ] || continue
  case "$entry" in
    DNS:*|IP:*) san_entry="$entry" ;;
    *)
      case "$entry" in
        *[!0-9.]*|*.*.*.*.*) san_entry="DNS:$entry" ;;
        *) san_entry="IP:$entry" ;;
      esac
      ;;
  esac
  SAN_ENTRIES="$SAN_ENTRIES,$san_entry"
done
IFS="$OLD_IFS"

openssl req -x509 -nodes -newkey rsa:2048 \
  -keyout "$OUT_DIR/privkey.pem" \
  -out    "$OUT_DIR/fullchain.pem" \
  -days   "$DAYS" \
  -subj   "/CN=$CN" \
  -addext "subjectAltName=$SAN_ENTRIES"

chmod 0644 "$OUT_DIR/fullchain.pem"
chmod 0600 "$OUT_DIR/privkey.pem"
echo "Self-signed cert written to $OUT_DIR (CN=$CN, SAN=$SAN_ENTRIES)"
