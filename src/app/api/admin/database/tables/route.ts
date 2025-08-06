import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    // Get all tables and their row counts
    const tables = await prisma.$queryRaw`
      SELECT 
        table_name,
        (SELECT COUNT(*) FROM information_schema.tables t2 WHERE t2.table_name = t1.table_name) as row_count
      FROM information_schema.tables t1
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `;

    // Get actual row counts for each table
    const tableNames = (tables as any[]).map(t => t.table_name);
    const rowCounts: { [key: string]: number } = {};

    for (const tableName of tableNames) {
      try {
        const result = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM "${tableName}"`);
        rowCounts[tableName] = Number((result as any[])[0]?.count || 0);
      } catch (error) {
        rowCounts[tableName] = 0;
      }
    }

    const tablesWithCounts = (tables as any[]).map(table => ({
      table_name: table.table_name,
      row_count: rowCounts[table.table_name] || 0
    }));

    return NextResponse.json(tablesWithCounts);
  } catch (error) {
    console.error('Error fetching tables:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tables' },
      { status: 500 }
    );
  }
} 