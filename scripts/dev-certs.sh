#!/usr/bin/env bash
# Generates SELF-SIGNED, TEST-ONLY Apple Wallet signing material in certs/dev/
# and prints the matching .env lines (base64 of each PEM, as lib/pass.ts expects).
#
# Passes signed with these certificates exercise the whole generation/signing
# code path locally, but iPhones REJECT them: real passes need the Pass Type ID
# certificate from your Apple Developer account and Apple's WWDR G4 certificate.
set -euo pipefail
cd "$(dirname "$0")/.."
DIR="${CERTS_DIR:-certs/dev}"   # CERTS_DIR lets tests use a temporary folder
mkdir -p "$DIR"
PASS_TYPE_ID="${PASS_TYPE_ID:-pass.com.example.coffee.dev}"
TEAM_ID="${TEAM_ID:-DEVTEAM123}"

# Fake "WWDR" CA, then a signer certificate issued by it.
openssl req -x509 -newkey rsa:2048 -nodes -days 3650 \
  -subj "/CN=DEV ONLY Fake WWDR CA/O=Local Test" \
  -keyout "$DIR/wwdr.key" -out "$DIR/wwdr.pem" 2>/dev/null
openssl req -newkey rsa:2048 -nodes \
  -subj "/UID=$PASS_TYPE_ID/CN=Pass Type ID: $PASS_TYPE_ID/OU=$TEAM_ID/O=Local Test" \
  -keyout "$DIR/signerKey.pem" -out "$DIR/signer.csr" 2>/dev/null
openssl x509 -req -days 3650 -in "$DIR/signer.csr" -CA "$DIR/wwdr.pem" -CAkey "$DIR/wwdr.key" \
  -CAcreateserial -out "$DIR/signerCert.pem" 2>/dev/null
rm -f "$DIR/signer.csr" "$DIR/wwdr.srl"

b64() { base64 < "$1" | tr -d '\n'; }
echo "# --- TEST-ONLY Apple certificates (self-signed, NOT accepted by iPhones) ---"
echo "PASS_TYPE_ID=$PASS_TYPE_ID"
echo "TEAM_ID=$TEAM_ID"
echo "PASS_WWDR=$(b64 "$DIR/wwdr.pem")"
echo "PASS_SIGNER_CERT=$(b64 "$DIR/signerCert.pem")"
echo "PASS_SIGNER_KEY=$(b64 "$DIR/signerKey.pem")"
