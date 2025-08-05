# Local Development with Production Database

## 🚀 Quick Start

### Option 1: One-command setup (Recommended)
```bash
./scripts/dev-setup.sh
```

### Option 2: Manual setup
```bash
# Switch to production database
./scripts/switch-db.sh production

# Start development server
npm run dev
```

## 🔄 Database Switching

### Switch to Production Database
```bash
./scripts/switch-db.sh production
```

### Switch to Local Database
```bash
./scripts/switch-db.sh local
```

### Check Current Database
```bash
./scripts/switch-db.sh
```

## 📊 Benefits

✅ **Same data as production** - Test with real data  
✅ **Faster development** - No need to sync data  
✅ **Accurate testing** - Real-world scenarios  
✅ **Reduced deployments** - Test locally first  

## ⚠️ Important Notes

- **Be careful with data** - Changes affect production database
- **Test thoroughly** - Use the same data as production
- **Backup if needed** - Production data is valuable
- **Use local for destructive tests** - Switch to local for risky operations

## 🛠️ Troubleshooting

### Connection Issues
```bash
# Test database connection
npx prisma db pull

# Regenerate Prisma client
npx prisma generate
```

### Port Already in Use
```bash
# Kill existing process
lsof -ti:3000 | xargs kill -9

# Or use different port
npm run dev -- -p 3001
```

## 📝 Workflow

1. **Start development**: `./scripts/dev-setup.sh`
2. **Make changes**: Work locally with production data
3. **Test thoroughly**: Ensure everything works
4. **Deploy**: `vercel --prod` (once per day or when ready)
5. **Switch back**: `./scripts/switch-db.sh local` (if needed)

## 🔧 Scripts

- `./scripts/switch-db.sh` - Switch between databases
- `./scripts/dev-setup.sh` - One-command development setup
- `npm run dev` - Start development server
- `vercel --prod` - Deploy to production 