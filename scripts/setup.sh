#!/usr/bin/env bash
# AGE — one-shot local bootstrap.
set -euo pipefail

echo "▶ Enabling corepack / pnpm"
corepack enable

echo "▶ Installing dependencies"
pnpm install

echo "▶ Preparing environment file"
[ -f .env ] || cp .env.example .env

echo "▶ Starting backing services (Postgres + Redis)"
docker compose up -d

echo "✓ AGE is ready. Run 'pnpm dev' to start the apps."
