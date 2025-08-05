#!/bin/bash

# Database switching script for CaterStation
# Usage: ./scripts/switch-db.sh [local|production]

LOCAL_DB="postgresql://postgres:postgres@localhost:5432/caterstation?schema=public"
PRODUCTION_DB="postgresql://postgres:tgFMycdsDzCztdcXyQCpEFvEAJuCwEql@mainline.proxy.rlwy.net:41096/railway"

case "$1" in
  "local")
    echo "🔄 Switching to LOCAL database..."
    sed -i '' "s|DATABASE_URL=.*|DATABASE_URL=\"$LOCAL_DB\"|" .env
    echo "✅ Now using LOCAL database"
    echo "📊 Database URL: $LOCAL_DB"
    ;;
  "production")
    echo "🔄 Switching to PRODUCTION database..."
    sed -i '' "s|DATABASE_URL=.*|DATABASE_URL=\"$PRODUCTION_DB\"|" .env
    echo "✅ Now using PRODUCTION database"
    echo "📊 Database URL: $PRODUCTION_DB"
    ;;
  *)
    echo "❌ Usage: ./scripts/switch-db.sh [local|production]"
    echo ""
    echo "Current database:"
    grep DATABASE_URL .env
    echo ""
    echo "Available options:"
    echo "  local      - Use local PostgreSQL database"
    echo "  production - Use Railway production database"
    exit 1
    ;;
esac

echo ""
echo "🔄 Regenerating Prisma client..."
npx prisma generate

echo ""
echo "📋 Next steps:"
echo "1. Restart your development server: npm run dev"
echo "2. Test the connection: npx prisma db pull" 