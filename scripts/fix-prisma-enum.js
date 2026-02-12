#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const prismaDir = path.join(__dirname, '../src/generated/prisma');

// Delete broken leftover files with spaces in the name
const brokenFiles = fs.readdirSync(prismaDir).filter(f => f.includes('index.d') && f.endsWith('.ts') && f.includes(' '));
brokenFiles.forEach(file => {
  const filePath = path.join(prismaDir, file);
  try {
    fs.unlinkSync(filePath);
    console.log(`🗑️  Deleted broken file: ${file}`);
  } catch (error) {
    console.error(`❌ Error deleting ${file}:`, error);
  }
});

// Fix all index.d.ts files (excluding ones with spaces/numbers in the name - these are broken leftovers)
const files = fs.readdirSync(prismaDir).filter(f => f.includes('index.d') && f.endsWith('.ts') && !f.includes(' '));

files.forEach(file => {
  const filePath = path.join(prismaDir, file);
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Fix ALL enum syntax errors - match pattern: export const EnumName: { ... };
    // This pattern matches enums that have type annotation but no value assignment
    const enumPattern = /export\s+const\s+(\w+)\s*:\s*\{([^}]+)\}\s*;/g;
    
    content = content.replace(enumPattern, (match, enumName, enumBody) => {
      // Check if this enum already has an assignment (already fixed)
      if (match.includes('=')) {
        return match; // Already fixed, skip
      }
      
      // Extract the enum values from the body
      const valuePairs = enumBody.split(',').map(pair => {
        const trimmed = pair.trim();
        const colonIndex = trimmed.indexOf(':');
        if (colonIndex === -1) return null;
        const key = trimmed.substring(0, colonIndex).trim();
        const value = trimmed.substring(colonIndex + 1).trim();
        return { key, value };
      }).filter(Boolean);
      
      // Reconstruct the enum with proper assignment
      const enumObject = valuePairs.map(({ key, value }) => `    ${key}: ${value}`).join(',\n');
      const fixedEnum = `export const ${enumName}: {
${enumObject}
  } = {
${enumObject}
  };`;
      
      modified = true;
      return fixedEnum;
    });
    
    // First, clean up any existing duplicate assignments
    // Remove orphaned "= $Enums.EnumName;" patterns that appear before export statements or comments
    content = content.replace(/(=\s+\$Enums\.\w+;)+(?=\s*(export|\/\*))/g, '');
    // Also remove duplicates after semicolons
    content = content.replace(/;\s*(=\s+\$Enums\.\w+;)+/g, ';');
    
    // Also fix external enum declarations like: export const EnumName: typeof $Enums.EnumName
    // Only fix if it doesn't already have an assignment, and preserve newlines
    const externalEnumPattern = /export\s+const\s+(\w+)\s*:\s*typeof\s+\$Enums\.\1\s*(?!=\s*\$Enums)(;?\s*\n?)/gm;
    let newContent = content;
    const matches = [...content.matchAll(externalEnumPattern)];
    if (matches.length > 0) {
      // Process in reverse to avoid index shifting
      for (let i = matches.length - 1; i >= 0; i--) {
        const match = matches[i];
        const enumName = match[1];
        const trailing = match[2] || '';
        const startIndex = match.index;
        const endIndex = startIndex + match[0].length;
        
        // Check the line doesn't already have an assignment
        const lineStart = newContent.lastIndexOf('\n', startIndex) + 1;
        const lineEnd = newContent.indexOf('\n', endIndex);
        const line = newContent.substring(lineStart, lineEnd === -1 ? newContent.length : lineEnd);
        
        // Only fix if line doesn't already have the correct assignment format
        // Check for the exact pattern: = $Enums.EnumName; (with semicolon) and ensure no duplicates
        const assignmentPattern = `= $Enums.${enumName};`;
        const hasAssignment = line.includes(assignmentPattern);
        const assignmentCount = (line.match(new RegExp(assignmentPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
        const alreadyFixed = hasAssignment && assignmentCount === 1; // Exactly one assignment, no duplicates
        
        if (!alreadyFixed) {
          const before = newContent.substring(0, startIndex);
          const after = newContent.substring(endIndex);
          // Preserve the newline if it was there, otherwise add one
          const newline = trailing.includes('\n') ? '' : '\n';
          const fixed = `export const ${enumName}: typeof $Enums.${enumName} = $Enums.${enumName};${newline}`;
          newContent = before + fixed + after;
          modified = true;
        }
      }
      content = newContent;
    }
    
    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Fixed enum syntax errors in ${file}`);
    }
  } catch (error) {
    console.error(`❌ Error fixing Prisma enum in ${file}:`, error);
  }
});

console.log(`✅ Processed ${files.length} Prisma type definition file(s)`);
