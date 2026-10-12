import assert from 'node:assert/strict'
import {
  deliveryRunKey,
  dispatchMinutes,
  ordinalLabel,
  sortOrdersIntoRuns,
  type RunSortableOrder,
} from '../delivery-sequence'

type TestOrder = RunSortableOrder & { driverId?: string | null; leaveTime?: string | null }

function order(partial: Partial<TestOrder> & { id: string }): TestOrder {
  return {
    createdAt: '2026-10-13T08:00:00.000Z',
    deliveryTime: '12:00',
    travelTime: '15',
    deliverySequence: null,
    ...partial,
  }
}

const idsOf = (orders: TestOrder[]) => orders.map((o) => o.id)
const sortByRun = (orders: TestOrder[]) => sortOrdersIntoRuns(orders, deliveryRunKey)

// --- ordinals -------------------------------------------------------------

assert.equal(ordinalLabel(1), '1st')
assert.equal(ordinalLabel(2), '2nd')
assert.equal(ordinalLabel(3), '3rd')
assert.equal(ordinalLabel(11), '11th')

// --- dispatch time --------------------------------------------------------

assert.equal(dispatchMinutes(order({ id: 'a', deliveryTime: '12:00', travelTime: '15' })), 705)
assert.equal(dispatchMinutes(order({ id: 'b', deliveryTime: '9:00 AM', travelTime: '30' })), 510)
assert.equal(dispatchMinutes(order({ id: 'c', deliveryTime: null, tags: null })), null)
assert.equal(
  dispatchMinutes(order({ id: 'd', deliveryTime: null, tags: 'Delivery 11:00 AM - 11:30 AM' })),
  645,
  'the delivery window in tags is the fallback'
)

// --- the bug this exists to prevent ---------------------------------------

// Two drivers leaving at 11:30. Ava's stops are 15 and 30 minutes out, Gero's
// 15, 15 and 30, so sorting by each order's own dispatch time interleaved them.
// Each run must now read as a block, in stop order.
{
  const orders: TestOrder[] = [
    order({ id: 'ava-1', driverId: 'ava', leaveTime: '11:30', travelTime: '15', deliverySequence: 1 }),
    order({ id: 'gero-1', driverId: 'gero', leaveTime: '11:30', travelTime: '15', deliverySequence: 1 }),
    order({ id: 'gero-2', driverId: 'gero', leaveTime: '11:30', travelTime: '15', deliverySequence: 2 }),
    order({ id: 'gero-3', driverId: 'gero', leaveTime: '11:30', travelTime: '30', deliverySequence: 3 }),
    order({ id: 'ava-2', driverId: 'ava', leaveTime: '11:30', travelTime: '30', deliverySequence: 2 }),
  ]

  assert.deepEqual(idsOf(sortByRun(orders)), ['ava-1', 'ava-2', 'gero-1', 'gero-2', 'gero-3'])
}

// Shuffling the input must not change the result.
{
  const orders: TestOrder[] = [
    order({ id: 'gero-3', driverId: 'gero', leaveTime: '11:30', travelTime: '30', deliverySequence: 3 }),
    order({ id: 'ava-2', driverId: 'ava', leaveTime: '11:30', travelTime: '30', deliverySequence: 2 }),
    order({ id: 'gero-1', driverId: 'gero', leaveTime: '11:30', travelTime: '15', deliverySequence: 1 }),
    order({ id: 'ava-1', driverId: 'ava', leaveTime: '11:30', travelTime: '15', deliverySequence: 1 }),
    order({ id: 'gero-2', driverId: 'gero', leaveTime: '11:30', travelTime: '15', deliverySequence: 2 }),
  ]

  assert.deepEqual(idsOf(sortByRun(orders)), ['ava-1', 'ava-2', 'gero-1', 'gero-2', 'gero-3'])
}

// --- runs still sort by when they leave -----------------------------------

// A run is placed by its earliest stop, so an earlier run stays above a later
// one even when the later run has a stop that leaves sooner on paper.
{
  const orders: TestOrder[] = [
    order({ id: 'late-1', driverId: 'gero', leaveTime: '12:00', deliveryTime: '12:30', travelTime: '15' }),
    order({ id: 'early-1', driverId: 'ava', leaveTime: '11:00', deliveryTime: '11:30', travelTime: '15', deliverySequence: 1 }),
    order({ id: 'early-2', driverId: 'ava', leaveTime: '11:00', deliveryTime: '13:00', travelTime: '15', deliverySequence: 2 }),
  ]

  assert.deepEqual(idsOf(sortByRun(orders)), ['early-1', 'early-2', 'late-1'])
}

// --- orders that are not on a run -----------------------------------------

// No driver or no leave time means no run; these sort on their own dispatch
// time as before, and never split a run apart.
{
  const orders: TestOrder[] = [
    order({ id: 'run-2', driverId: 'ava', leaveTime: '11:30', deliveryTime: '12:00', travelTime: '15', deliverySequence: 2 }),
    order({ id: 'unassigned', deliveryTime: '14:00', travelTime: '15' }),
    order({ id: 'run-1', driverId: 'ava', leaveTime: '11:30', deliveryTime: '12:00', travelTime: '15', deliverySequence: 1 }),
  ]

  assert.deepEqual(idsOf(sortByRun(orders)), ['run-1', 'run-2', 'unassigned'])
}

// An order with no readable delivery time sinks to the bottom.
{
  const orders: TestOrder[] = [
    order({ id: 'no-time', deliveryTime: null, tags: null }),
    order({ id: 'timed', deliveryTime: '12:00' }),
  ]

  assert.deepEqual(idsOf(sortByRun(orders)), ['timed', 'no-time'])
}

// --- non-staff couriers ---------------------------------------------------

// UBER is a driverId like any other, so its orders group the same way.
{
  const orders: TestOrder[] = [
    order({ id: 'uber-2', driverId: 'UBER', leaveTime: '11:30', travelTime: '15', deliverySequence: 2 }),
    order({ id: 'ava-1', driverId: 'ava', leaveTime: '11:30', travelTime: '15', deliverySequence: 1 }),
    order({ id: 'uber-1', driverId: 'UBER', leaveTime: '11:30', travelTime: '15', deliverySequence: 1 }),
  ]

  const sorted = idsOf(sortByRun(orders))
  assert.deepEqual(sorted.slice(sorted.indexOf('uber-1'), sorted.indexOf('uber-1') + 2), ['uber-1', 'uber-2'])
}

console.log('✅ delivery-sequence run ordering tests passed')
