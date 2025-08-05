#!/bin/bash

# Development setup script for CaterStation
# This script switches to production database and starts development server

echo "🚀 Setting up development environment with production database..."

# Switch to production database
./scripts/switch-db.sh production

echo ""
echo "🔄 Testing database connection..."
npx prisma db pull

if [ $? -eq 0 ]; then
    echo "✅ Database connection successful!"
    echo ""
    echo "🚀 Starting development server..."
    echo "📝 You can now work locally with the same data as production!"
    echo "💡 Use './scripts/switch-db.sh local' to switch back to local database"
    echo ""
    npm run dev
else
    echo "❌ Database connection failed!"
    echo "💡 Check your internet connection and try again"
    exit 1
fi 