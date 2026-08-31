import assert from 'node:assert/strict'
import {
  LABOUR_TARGET_RATE,
  type RosterShiftInput,
  labourTarget,
  labourTone,
  rosterDayCost,
  shiftHours,
} from '../labour-target'

function shift(partial: Partial<RosterShiftInput> = {}): RosterShiftInput {
  return {
    id: partial.id ?? 's1',
    staffId: partial.staffId ?? 'staff1',
    staffName: partial.staffName ?? 'Someone',
    payRate: partial.payRate === undefined ? 30 : partial.payRate,
    startTime: partial.startTime === undefined ? '08:00' : partial.startTime,
    endTime: partial.endTime === undefined ? '14:30' : partial.endTime,
  }
}

// --- hours ----------------------------------------------------------------

assert.equal(shiftHours('08:00', '14:30'), 6.5)
assert.equal(shiftHours('09:00', '17:00'), 8)
assert.equal(shiftHours('22:00', '05:00'), 7, 'an end before the start is overnight, not negative')
assert.equal(shiftHours('10:00', '10:00'), 24, 'equal times are a full overnight loop, never zero')
assert.equal(shiftHours('', '14:30'), null)
assert.equal(shiftHours('08:00', null), null)
assert.equal(shiftHours('25:00', '26:00'), null, 'an impossible clock time is not a shift')

// --- day cost -------------------------------------------------------------

// The real 31 Aug 2026 roster: two cooks, 08:00-14:30, both on $30/h.
{
  const day = rosterDayCost([
    shift({ id: 'a', staffName: 'Luciano Federico' }),
    shift({ id: 'b', staffName: 'Florencia Natali' }),
  ])
  assert.equal(day.cost, 390)
  assert.equal(day.hours, 13)
  assert.equal(day.shiftCount, 2)
  assert.deepEqual(day.uncosted, [])
}

{
  const day = rosterDayCost([])
  assert.equal(day.cost, 0)
  assert.equal(day.shiftCount, 0, 'a day with nobody on is costed, not unknown')
}

// A rate of zero is "not on file", and treating it as free is exactly the
// silent understatement this panel is meant to prevent.
{
  const day = rosterDayCost([
    shift({ id: 'a', payRate: 30 }),
    shift({ id: 'b', staffName: 'No Rate', payRate: 0 }),
  ])
  assert.equal(day.cost, 195, 'the uncostable shift contributes nothing to cost')
  assert.equal(day.hours, 13, 'but its hours are still real and still counted')
  assert.deepEqual(day.uncosted, [{ id: 'b', staffName: 'No Rate', reason: 'no-pay-rate' }])
}

{
  const day = rosterDayCost([shift({ id: 'a', staffName: 'No Times', startTime: null, endTime: null })])
  assert.equal(day.hours, 0)
  assert.deepEqual(day.uncosted, [{ id: 'a', staffName: 'No Times', reason: 'no-times' }])
}

// --- target ---------------------------------------------------------------

assert.equal(LABOUR_TARGET_RATE, 0.1)
assert.equal(labourTarget(5184.35), 518.44)
assert.equal(labourTarget(0), 0, 'a day that genuinely sold nothing has a budget of nothing')
assert.equal(labourTarget(-10), 0)

// --- tone -----------------------------------------------------------------

assert.equal(labourTone(390, 518.43), 'green', 'comfortably under budget')
assert.equal(labourTone(518.43, 518.43), 'green', 'exactly on budget is not an overrun')
assert.equal(labourTone(560, 518.43), 'amber', 'within 15% over is a warning')
assert.equal(labourTone(700, 518.43), 'red')
assert.equal(labourTone(0, null), null, 'no sales figure means no verdict, not a pass')
assert.equal(labourTone(120, 0), 'red', 'staff rostered against no sales at all is an overrun')
assert.equal(labourTone(0, 0), 'green')

console.log('roster labour target tests passed')
