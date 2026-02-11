#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const prismaDir = path.join(__dirname, '../src/generated/prisma');

// Fix all index.d.ts files (including ones with spaces/numbers in the name)
const files = fs.readdirSync(prismaDir).filter(f => f.includes('index.d') && f.endsWith('.ts'));

files.forEach(file => {
  const filePath = path.join(prismaDir, file);
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Fix the SmsTemplateType enum syntax error - match various whitespace patterns
    const patterns = [
      // Pattern 1: Original format
      /export const SmsTemplateType: \{\s+delivery: 'delivery',\s+pickup: 'pickup'\s+\};/g,
      // Pattern 2: With different spacing
      /export const SmsTemplateType:\s*\{\s*delivery:\s*'delivery',\s*pickup:\s*'pickup'\s*\};/g,
      // Pattern 3: More flexible
      /export\s+const\s+SmsTemplateType\s*:\s*\{\s*delivery\s*:\s*'delivery',\s*pickup\s*:\s*'pickup'\s*\};/g
    ];
    
    const replacement = `export const SmsTemplateType: {
    delivery: 'delivery',
    pickup: 'pickup'
  } = {
    delivery: 'delivery',
    pickup: 'pickup'
  };`;
  
    patterns.forEach(pattern => {
      if (pattern.test(content)) {
        content = content.replace(pattern, replacement);
        modified = true;
      }
    });
    
    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Fixed SmsTemplateType enum syntax error in ${file}`);
    }
  } catch (error) {
    console.error(`❌ Error fixing Prisma enum in ${file}:`, error);
  }
});

console.log(`✅ Processed ${files.length} Prisma type definition file(s)`);
