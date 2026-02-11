#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/generated/prisma/index.d.ts');

try {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Fix the SmsTemplateType enum syntax error
  const fixPattern = /export const SmsTemplateType: \{\s+delivery: 'delivery',\s+pickup: 'pickup'\s+\};/g;
  const replacement = `export const SmsTemplateType: {
    delivery: 'delivery',
    pickup: 'pickup'
  } = {
    delivery: 'delivery',
    pickup: 'pickup'
  };`;
  
  if (fixPattern.test(content)) {
    content = content.replace(fixPattern, replacement);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('✅ Fixed SmsTemplateType enum syntax error');
  } else {
    console.log('ℹ️  SmsTemplateType enum already fixed or not found');
  }
} catch (error) {
  console.error('❌ Error fixing Prisma enum:', error);
  process.exit(1);
}
