import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/authz';

export async function GET(request: NextRequest) {
  try {
    // Admin-only: exposes full database schema and row counts.
    try {
      await requireRole(['owner', 'admin']);
    } catch {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    // Single query using pg_stat_user_tables avoids N+1 COUNT(*) scans and
    // reduces pressure on database connections.
    const tables = await prisma.$queryRaw`
      SELECT 
        t.table_name,
        COALESCE(s.n_live_tup::bigint, 0) as row_count
      FROM information_schema.tables t
      LEFT JOIN pg_stat_user_tables s
        ON s.relname = t.table_name
      WHERE t.table_schema = 'public'
      ORDER BY t.table_name;
    `;
    return NextResponse.json(tables);
  } catch (error) {
    console.error('Error fetching tables:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tables' },
      { status: 500 }
    );
  }
} 