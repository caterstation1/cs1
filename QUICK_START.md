# 🚀 Quick Start: Deploy to Production

## Immediate Steps (30 minutes)

### 1. Set Up Firebase (5 minutes)
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create new project: `caterstation-prod`
3. Enable Firestore Database
4. Go to Project Settings → Service Accounts
5. Click "Generate new private key"
6. Download the JSON file

### 2. Get Firebase Credentials (2 minutes)
From the downloaded JSON file, extract:
- `project_id` → `FIREBASE_PROJECT_ID`
- `client_email` → `FIREBASE_CLIENT_EMAIL`
- `private_key` → `FIREBASE_PRIVATE_KEY`

### 3. Deploy to Vercel (10 minutes)
```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Deploy
./deploy.sh
```

### 4. Set Environment Variables (5 minutes)
In Vercel Dashboard → Your Project → Settings → Environment Variables:

**Required Variables:**
```bash
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-client-email
FIREBASE_PRIVATE_KEY=your-private-key
SHOPIFY_SHOP_URL=cater-station.myshopify.com
SHOPIFY_ACCESS_TOKEN=your-token
NEXTAUTH_SECRET=your-secret
NEXTAUTH_URL=https://your-domain.vercel.app
```

### 5. Migrate Data (5 minutes)
```bash
# Set up local environment
cp env.production.template .env
# Edit .env with your values

# Run migration
node scripts/migrate-to-firestore.js
```

### 6. Test (3 minutes)
1. Visit your Vercel URL
2. Test order sync
3. Test product management
4. Test rule system

## 🎉 You're Live!

Your CaterStation app is now running in production with:
- ✅ Vercel hosting
- ✅ Firestore database
- ✅ Real-time data sync
- ✅ Scalable infrastructure

## 📞 Support
- Vercel: https://vercel.com/support
- Firebase: https://firebase.google.com/support
- Documentation: See `DEPLOYMENT.md` for detailed guide 