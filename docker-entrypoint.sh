#!/bin/sh
set -e

# Auto-seed database on first run
if [ ! -f /app/data/database.sqlite ]; then
  echo "First run — initializing database..."
  npx tsx src/scripts/seed.ts
fi

exec "$@"
