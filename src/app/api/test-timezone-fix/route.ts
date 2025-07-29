import { NextResponse } from 'next/server';
import { parseLocalDate, formatLocalDate, getTodayLocal } from '@/lib/date-utils';

export async function GET() {
  try {
    // Test various date formats
    const testCases = [
      '2025-07-23',
      'July 23, 2025',
      'Wed Jul 23 2025',
      '2025-07-23T00:00:00.000Z',
      '2025-07-23T12:00:00.000Z',
    ];

    const results = testCases.map(dateString => {
      const parsed = parseLocalDate(dateString);
      return {
        input: dateString,
        parsed: parsed ? parsed.toISOString() : null,
        formatted: parsed ? formatLocalDate(parsed) : null,
        localDate: parsed ? parsed.toDateString() : null,
      };
    });

    const today = getTodayLocal();

    return NextResponse.json({
      message: 'Timezone fix test results',
      testCases: results,
      today: {
        iso: today.toISOString(),
        formatted: formatLocalDate(today),
        localDate: today.toDateString(),
      },
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
  } catch (error) {
    console.error('Error in timezone test:', error);
    return NextResponse.json(
      { error: 'Failed to test timezone fix' },
      { status: 500 }
    );
  }
} 