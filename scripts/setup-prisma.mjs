#!/usr/bin/env node

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

console.log('🚀 Setting up Prisma for CaterStation...\n');

try {
  // 1. Generate Prisma client
  console.log('📦 Generating Prisma client...');
  execSync('npx prisma generate', { cwd: projectRoot, stdio: 'inherit' });
  
  // 2. Push schema to database (for development)
  console.log('\n🗄️ Pushing schema to database...');
  execSync('npx prisma db push', { cwd: projectRoot, stdio: 'inherit' });
  
  // 3. Run migrations (for production)
  console.log('\n🔄 Running database migrations...');
  execSync('npx prisma migrate deploy', { cwd: projectRoot, stdio: 'inherit' });
  
  console.log('\n✅ Prisma setup complete!');
  console.log('\n📋 Next steps:');
  console.log('1. Update your API routes to use Prisma instead of Firestore');
  console.log('2. Test your application with the new database');
  console.log('3. Remove Firestore dependencies when ready');
  
} catch (error) {
  console.error('❌ Error setting up Prisma:', error.message);
  process.exit(1);
}