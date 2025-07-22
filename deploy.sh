#!/bin/bash

echo "🚀 CaterStation Production Deployment Script"
echo "=============================================="

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Installing..."
    npm install -g vercel
fi

# Check if user is logged in to Vercel
if ! vercel whoami &> /dev/null; then
    echo "🔐 Please log in to Vercel..."
    vercel login
fi

# Build the project
echo "🔨 Building project..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed. Please fix the errors and try again."
    exit 1
fi

echo "✅ Build successful!"

# Deploy to production
echo "🚀 Deploying to production..."
vercel --prod

echo "🎉 Deployment completed!"
echo ""
echo "📋 Next steps:"
echo "1. Set up Firebase project and get credentials"
echo "2. Add environment variables in Vercel dashboard"
echo "3. Run data migration: node scripts/migrate-to-firestore.js"
echo "4. Test all functionality"
echo ""
echo "📖 See DEPLOYMENT.md for detailed instructions" 