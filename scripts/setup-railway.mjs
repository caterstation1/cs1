#!/usr/bin/env node

import { execSync } from 'child_process';

const RAILWAY_DATABASE_URL = 'postgresql://postgres:tgFMycdsDzCztdcXyQCpEFvEAJuCwEql@mainline.proxy.rlwy.net:41096/railway';

console.log('🚀 Setting up Railway database...');

try {
  console.log('📋 Pushing schema to Railway...');
  execSync('npx prisma db push --schema=prisma/schema.prisma', {
    env: { ...process.env, DATABASE_URL: RAILWAY_DATABASE_URL },
    stdio: 'inherit'
  });
  
  console.log('✅ Schema pushed successfully!');
  
  console.log('🔧 Generating Prisma client...');
  execSync('npx prisma generate', {
    env: { ...process.env, DATABASE_URL: RAILWAY_DATABASE_URL },
    stdio: 'inherit'
  });
  
  console.log('✅ Prisma client generated!');
  
  console.log('🧪 Testing database connection...');
  execSync('npx prisma db execute --stdin', {
    input: 'SELECT 1 as test;',
    env: { ...process.env, DATABASE_URL: RAILWAY_DATABASE_URL },
    stdio: 'inherit'
  });
  
  console.log('✅ Railway database setup complete!');
  console.log('🌐 Database URL: postgresql://postgres:****@mainline.proxy.rlwy.net:41096/railway');
  
} catch (error) {
  console.error('❌ Error setting up Railway database:', error.message);
  process.exit(1);
} 