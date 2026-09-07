// Run under TZ=Pacific/Auckland: the roster grid is a client component, so its
// day keys come from the browser's local calendar, and the bug this guards is a
// timezone one. Without the TZ these assertions pass for the wrong reason.

import assert from 'node:assert/strict'
import { formatLocalDate } from '../../date-utils'
import { rosterWeekDateKeys, rosterWeekDates } from '../week-dates'

assert.equal(new Date(2027, 0, 15).getTimezoneOffset(), -780, 'run this with TZ=Pacific/Auckland')
assert.equal(new Date(2027, 5, 15).getTimezoneOffset(), -720, 'run this with TZ=Pacific/Auckland')

/** Freezes the clock at an instant, runs fn, restores the real Date. */
function atInstant<T>(iso: string, fn: () => T): T {
  const RealDate = Date
  const frozen = new RealDate(iso).getTime()

  class FrozenDate extends RealDate {
    // A bare `new Date()` is "now"; every other signature passes straight
    // through. The cast is arity only — Date's type has a one-argument
    // constructor, but the spread hands all of them over at runtime.
    constructor(...args: unknown[]) {
      super(...((args.length === 0 ? [frozen] : args) as [number]))
    }
    static now() {
      return frozen
    }
  }

  globalThis.Date = FrozenDate as DateConstructor
  try {
    return fn()
  } finally {
    globalThis.Date = RealDate
  }
}

// --- the DST case the grid used to get wrong ------------------------------

// 15 Jan 2027 08:00 NZDT is 14 Jan 2027 19:00 UTC. A local Date for that
// instant renders as "2027-01-14" through toISOString(), which is the previous
// day and the wrong roster week.
{
  const nzdtMorning = '2027-01-14T19:00:00.000Z'

  const key = atInstant(nzdtMorning, () => formatLocalDate(new Date()))
  assert.equal(key, '2027-01-15', 'a NZDT morning is still its own calendar day')

  assert.equal(
    new Date(nzdtMorning).toISOString().split('T')[0],
    '2027-01-14',
    'the old derivation really does report the day before',
  )

  const keys = atInstant(nzdtMorning, () => rosterWeekDateKeys(new Date()))
  assert.deepEqual(
    keys,
    [
      '2027-01-11',
      '2027-01-12',
      '2027-01-13',
      '2027-01-14',
      '2027-01-15',
      '2027-01-16',
      '2027-01-17',
    ],
    'Friday 15 Jan sits in the Mon 11 - Sun 17 week',
  )

  const today = atInstant(nzdtMorning, () => formatLocalDate(new Date()))
  assert.ok(keys.includes(today), 'the TODAY column has to be one of the columns drawn')
  assert.equal(keys.indexOf(today), 4, 'and it is the Friday')
}

// Midnight is the worst case: 13 hours of NZDT offset to lose.
{
  const key = atInstant('2027-01-14T11:00:00.000Z', () => formatLocalDate(new Date()))
  assert.equal(key, '2027-01-15', '00:00 NZDT belongs to the day that just started')
}

// One minute before the DST changeover, and one minute after.
{
  // NZDT ends 05:00 on 4 Apr 2027, so 02:59 NZDT is 13:59Z on 3 Apr.
  assert.equal(
    atInstant('2027-04-03T13:59:00.000Z', () => formatLocalDate(new Date())),
    '2027-04-04',
  )
  // NZDT starts 26 Sep 2027; the morning before it is NZST, offset +12.
  assert.equal(
    atInstant('2027-09-25T20:00:00.000Z', () => formatLocalDate(new Date())),
    '2027-09-26',
  )
}

// --- NZST, where the old code happened to work ----------------------------

// 31 Aug 2026 12:20 NZST is 00:20Z the same day, so toISOString() agreed. This
// is why the bug sat in the page unnoticed.
{
  const nzstMidday = '2026-08-31T00:20:00.000Z'
  assert.equal(
    atInstant(nzstMidday, () => formatLocalDate(new Date())),
    '2026-08-31',
  )
  assert.equal(
    new Date(nzstMidday).toISOString().split('T')[0],
    '2026-08-31',
    'the old derivation was right here, which is the accident',
  )
}

// But an NZST morning before noon shifts too: 09:00 NZST is 21:00Z yesterday.
{
  const nzstMorning = '2026-08-30T21:00:00.000Z'
  assert.equal(
    atInstant(nzstMorning, () => formatLocalDate(new Date())),
    '2026-08-31',
  )
  assert.equal(
    new Date(nzstMorning).toISOString().split('T')[0],
    '2026-08-30',
    'NZST mornings were exposed as well, not only NZDT ones',
  )
}

// --- week boundaries ------------------------------------------------------

{
  // Monday is the start of its own week.
  assert.equal(rosterWeekDateKeys(new Date(2027, 0, 11))[0], '2027-01-11')
  // Sunday closes the week before it, not the one after.
  assert.deepEqual(
    [rosterWeekDateKeys(new Date(2027, 0, 17))[0], rosterWeekDateKeys(new Date(2027, 0, 17))[6]],
    ['2027-01-11', '2027-01-17'],
  )
  // A week spanning a month end still runs seven consecutive days.
  const across = rosterWeekDateKeys(new Date(2027, 0, 28))
  assert.deepEqual(across, [
    '2027-01-25',
    '2027-01-26',
    '2027-01-27',
    '2027-01-28',
    '2027-01-29',
    '2027-01-30',
    '2027-01-31',
  ])
}

// The Date objects themselves stay on their own calendar day, so date.getDate()
// in the column header matches the key.
{
  const dates = rosterWeekDates(new Date(2027, 0, 15))
  assert.deepEqual(dates.map((d) => d.getDate()), [11, 12, 13, 14, 15, 16, 17])
  assert.deepEqual(dates.map(formatLocalDate), rosterWeekDateKeys(new Date(2027, 0, 15)))
}

// The DST changeover days are 23 and 25 hours long; stepping by calendar date
// rather than by 24-hour arithmetic is what keeps them seven distinct days.
{
  const endOfNzdt = rosterWeekDateKeys(new Date(2027, 3, 4))
  assert.equal(new Set(endOfNzdt).size, 7, 'the 25-hour day must not duplicate a column')
  const startOfNzdt = rosterWeekDateKeys(new Date(2027, 8, 26))
  assert.equal(new Set(startOfNzdt).size, 7, 'the 23-hour day must not skip a column')
}

console.log('roster week-dates tests passed')
