#!/usr/bin/env bash
# Draait één keer als de Codespace wordt aangemaakt.
set -euo pipefail

echo "Afhankelijkheden installeren…"
npm install

if [ ! -f .env ]; then
  echo ".env aanmaken…"
  WACHTWOORD="svr-$(head -c 4 /dev/urandom | od -An -tx1 | tr -d ' \n')"
  GEHEIM="$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
  cat > .env <<EOF
DATABASE_URL="file:./prisma/dev.db"
APP_WACHTWOORD="${WACHTWOORD}"
AUTH_SECRET="${GEHEIM}"
EOF
  echo "Het inlogwachtwoord staat in .env: ${WACHTWOORD}"
fi

echo "Database klaarzetten…"
npx prisma migrate deploy
npx prisma db seed

echo
echo "Klaar. Start de app met:  npm run dev"
echo "Het inlogwachtwoord staat in het bestand .env"
