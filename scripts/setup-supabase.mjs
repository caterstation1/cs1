#!/usr/bin/env node

import { execSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';

const SUPABASE_DATABASE_URL = 'postgresql://postgres.mikwwdwscdwqhpasujmi:6y9og6zCNC926bm@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres';

console.log('🚀 Setting up Supabase database...');

// Create a temporary .env file with the Supabase URL
const tempEnvContent = `DATABASE_URL="${SUPABASE_DATABASE_URL}"`;
writeFileSync('.env.temp', tempEnvContent);

try {
  console.log('📋 Pushing schema to Supabase...');
  execSync('npx prisma db push --schema=prisma/schema.prisma', {
    env: { ...process.env, DATABASE_URL: SUPABASE_DATABASE_URL },
    stdio: 'inherit'
  });
  
  console.log('✅ Schema pushed successfully!');
  
  console.log('🔧 Generating Prisma client...');
  execSync('npx prisma generate', {
    stdio: 'inherit'
  });
  
  console.log('✅ Prisma client generated!');
  
  console.log('🧪 Testing connection...');
  execSync('npx prisma db seed', {
    env: { ...process.env, DATABASE_URL: SUPABASE_DATABASE_URL },
    stdio: 'inherit'
  });
  
  console.log('🎉 Supabase database setup complete!');
  
} catch (error) {
  console.error('❌ Error setting up Supabase database:', error.message);
  process.exit(1);
} finally {
  // Clean up temporary file
  try {
    unlinkSync('.env.temp');
  } catch (e) {
    // Ignore cleanup errors
  }
} 