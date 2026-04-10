#!/bin/bash

# PM2 — Next.js app e-gp (production)
APP_NAME="rpp-e-gp"
ECOSYSTEM_CONFIG="./ecosystem.config.cjs"
NODE_ENV="production"

set -e

if [ ! -d "node_modules/next" ]; then
  echo "ยังไม่มี dependencies — รัน npm ci หรือ npm install ก่อน"
  exit 1
fi

if [ ! -d ".next" ]; then
  echo "ยังไม่มี build — รัน npm run build ก่อน (รวม prisma generate)"
  exit 1
fi

mkdir -p logs

pm2 delete "$APP_NAME" 2>/dev/null || true

pm2 start "$ECOSYSTEM_CONFIG" --env "$NODE_ENV"

pm2 status
