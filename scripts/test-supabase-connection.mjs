#!/usr/bin/env node

import { PrismaClient } from '../src/generated/prisma/index.js';

const connectionStrings = [
  // Transaction Pooler (current)
  'postgresql://postgres.mikwwdwscdwqhpasujmi:6y9og6zCNC926bm@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres',
  
  // Direct connection (try this)
  'postgresql://postgres:6y9og6zCNC926bm@db.mikwwdwscdwqhpasujmi.supabase.co:5432/postgres',
  
  // With SSL
  'postgresql://postgres.mikwwdwscdwqhpasujmi:6y9og6zCNC926bm@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require',
  
  // Direct with SSL
  'postgresql://postgres:6y9og6zCNC926bm@db.mikwwdwscdwqhpasujmi.supabase.co:5432/postgres?sslmode=require'
];

async function testConnection(connectionString, name) {
  console.log(`\n🧪 Testing ${name}...`);
  console.log(`URL: ${connectionString.replace(/:[^:@]*@/, ':****@')}`);
  
  try {
    const prisma = new PrismaClient({
      datasources: {
        db: {
          url: connectionString
        }
      }
    });
    
    // Test basic connection
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log(`✅ ${name} - Connection successful:`, result);
    
    await prisma.$disconnect();
    return true;
  } catch (error) {
    console.log(`❌ ${name} - Connection failed:`, error.message);
    return false;
  }
}

async function main() {
  console.log('🔍 Testing Supabase connection strings...\n');
  
  for (let i = 0; i < connectionStrings.length; i++) {
    const name = ['Transaction Pooler', 'Direct Connection', 'Transaction Pooler + SSL', 'Direct + SSL'][i];
    const success = await testConnection(connectionStrings[i], name);
    
    if (success) {
      console.log(`\n🎉 Found working connection: ${name}`);
      console.log(`Use this DATABASE_URL: ${connectionStrings[i]}`);
      break;
    }
  }
}

main().catch(console.error); 