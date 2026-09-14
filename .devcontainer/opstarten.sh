#!/usr/bin/env bash
# Draait één keer als de Codespace wordt aangemaakt.
set -euo pipefail

echo "Afhankelijkheden installeren..."
npm ci

echo "Verbind het Vercel-project: npx vercel link"
echo "Haal de ontwikkelvariabelen op: npx vercel env pull .env.local"
echo "Alleen voor een lege database: npm run setup"
echo "Start daarna de app: npm run dev"
