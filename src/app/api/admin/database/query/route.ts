import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';

const prisma = new PrismaClient();

// List of allowed SQL keywords for SELECT queries only
const ALLOWED_KEYWORDS = ['SELECT', 'FROM', 'WHERE', 'ORDER', 'BY', 'LIMIT', 'OFFSET', 'GROUP', 'HAVING', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'ON', 'AS', 'DISTINCT', 'COUNT', 'SUM', 'AVG', 'MAX', 'MIN', 'AND', 'OR', 'NOT', 'LIKE', 'ILIKE', 'IN', 'BETWEEN', 'IS', 'NULL', 'ASC', 'DESC'];

// List of forbidden keywords that could modify data
const FORBIDDEN_KEYWORDS = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'CREATE', 'ALTER', 'TRUNCATE', 'GRANT', 'REVOKE', 'EXECUTE', 'EXEC'];

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required and must be a string' },
        { status: 400 }
      );
    }

    // Security checks
    const upperQuery = query.toUpperCase();
    
    // Check for forbidden keywords
    for (const keyword of FORBIDDEN_KEYWORDS) {
      if (upperQuery.includes(keyword)) {
        return NextResponse.json(
          { error: `Query contains forbidden keyword: ${keyword}. Only SELECT queries are allowed.` },
          { status: 403 }
        );
      }
    }

    // Ensure it starts with SELECT
    if (!upperQuery.trim().startsWith('SELECT')) {
      return NextResponse.json(
        { error: 'Only SELECT queries are allowed for security reasons' },
        { status: 403 }
      );
    }

    // Limit query length to prevent abuse
    if (query.length > 10000) {
      return NextResponse.json(
        { error: 'Query is too long. Maximum length is 10,000 characters.' },
        { status: 400 }
      );
    }

    const startTime = Date.now();
    
    // Execute the query
    const result = await prisma.$queryRawUnsafe(query);
    
    const executionTime = Date.now() - startTime;

    // Convert result to array format
    const rows = Array.isArray(result) ? result : [result];
    
    // Extract column names from the first row
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

    return NextResponse.json({
      columns,
      rows,
      rowCount: rows.length,
      executionTime
    });

  } catch (error) {
    console.error('Error executing query:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Query execution failed' },
      { status: 500 }
    );
  }
} 