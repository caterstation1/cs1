// Order.driverId is a free-form string with no foreign key to Staff, so a run
// can be handed to a courier that will never exist as a staff record.

/** Sentinel driverId for orders sent out with Uber rather than a staff driver. */
export const UBER_DRIVER_ID = 'UBER'
export const UBER_DRIVER_LABEL = 'Uber'

export function isUberDriver(driverId?: string | null): boolean {
  return String(driverId || '').trim().toUpperCase() === UBER_DRIVER_ID
}

/** First name shown over the driver select, including non-staff couriers. */
export function driverDisplayName(
  driverId: string | null | undefined,
  staffDriver: { firstName?: string | null } | undefined
): string {
  if (isUberDriver(driverId)) return UBER_DRIVER_LABEL
  return staffDriver?.firstName?.trim() || ''
}
