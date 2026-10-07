#!/bin/bash
set -e

# === CONFIG — fill in these values ===
PASS_DIR="pass-sample.pass"
CERT_PEM="certs/passcert.pem"   # ton certificat Pass Type ID (avec cle privee), format PEM
WWDR_PEM="certs/wwdr.pem"       # certificat Apple WWDR G4, format PEM
CERT_PASSWORD=""                # mot de passe de la cle privee (vide si aucun)
# ======================================

cd "$(dirname "$0")"

echo "1/4  Verif certificats..."
[ -f "$CERT_PEM" ] || { echo "MANQUE: $CERT_PEM"; exit 1; }
[ -f "$WWDR_PEM" ] || { echo "MANQUE: $WWDR_PEM"; exit 1; }

echo "2/4  Generation manifest.json (SHA1 de chaque fichier)..."
cd "$PASS_DIR"
rm -f manifest.json signature
python3 - <<'PY'
import hashlib, json, os
m = {}
for f in os.listdir('.'):
    if f in ('manifest.json','signature') or os.path.isdir(f): continue
    m[f] = hashlib.sha1(open(f,'rb').read()).hexdigest()
json.dump(m, open('manifest.json','w'))
print("   fichiers:", ", ".join(sorted(m)))
PY
cd ..

echo "3/4  Signature (openssl smime)..."
openssl smime -binary -sign \
  -certfile "$WWDR_PEM" \
  -signer "$CERT_PEM" \
  -inkey "$CERT_PEM" \
  -in "$PASS_DIR/manifest.json" \
  -out "$PASS_DIR/signature" \
  -outform DER \
  -passin "pass:$CERT_PASSWORD"

echo "4/4  Zip -> SampleCard.pkpass..."
rm -f SampleCard.pkpass
cd "$PASS_DIR"
zip -q -r ../SampleCard.pkpass . -x '.*'
cd ..

echo "OK -> $(pwd)/SampleCard.pkpass"
echo "AirDrop ce fichier vers ton iPhone, ou ouvre-le sur Mac."
