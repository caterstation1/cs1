/**
 * Xero Payroll NZ API wrappers.
 * Requires token to be set on client before calling (via setTokenSet).
 */
import { getXeroClient } from './client'
import { getStoredToken, saveToken } from './token-store'
import type { TokenSetParameters } from 'openid-client'

export async function withXeroClient<T>(
  tenantId: string,
  fn: (api: { payrollNZApi: any }) => Promise<T>
): Promise<T> {
  const client = getXeroClient()
  if (!client) throw new Error('Xero is not configured')
  const token = await getStoredToken(tenantId)
  if (!token) throw new Error(`No Xero connection for tenant ${tenantId}`)
  client.setTokenSet(token)
  try {
    const result = await fn({ payrollNZApi: client.payrollNZApi })
    const newToken = client.readTokenSet()
    if (newToken && (newToken as TokenSetParameters).refresh_token) {
      await saveToken(tenantId, null, newToken as TokenSetParameters)
    }
    return result
  } catch (e) {
    if (e && typeof (e as any).response?.status === 'number' && (e as any).response.status === 401) {
      try {
        const refreshed = await client.refreshToken()
        if (refreshed) {
          await saveToken(tenantId, null, refreshed as TokenSetParameters)
          client.setTokenSet(refreshed)
          return fn({ payrollNZApi: client.payrollNZApi })
        }
      } catch (_) {
        // fall through to original error
      }
    }
    throw e
  }
}

export async function getEmployees(tenantId: string) {
  return withXeroClient(tenantId, async ({ payrollNZApi }) => {
    const res = await payrollNZApi.getEmployees(tenantId)
    return res.body
  })
}

export async function getEarningsRates(tenantId: string) {
  return withXeroClient(tenantId, async ({ payrollNZApi }) => {
    const res = await payrollNZApi.getEarningsRates(tenantId)
    return res.body
  })
}

export async function getReimbursements(tenantId: string) {
  return withXeroClient(tenantId, async ({ payrollNZApi }) => {
    const res = await payrollNZApi.getReimbursements(tenantId)
    return res.body
  })
}

export async function getPayRunCalendars(tenantId: string) {
  return withXeroClient(tenantId, async ({ payrollNZApi }) => {
    const res = await payrollNZApi.getPayRunCalendars(tenantId)
    return res.body
  })
}

export async function getPayRuns(tenantId: string, status?: 'Draft' | 'Posted') {
  return withXeroClient(tenantId, async ({ payrollNZApi }) => {
    const res = await payrollNZApi.getPayRuns(tenantId, undefined, status)
    return res.body
  })
}

export async function getPayRun(tenantId: string, payRunId: string) {
  return withXeroClient(tenantId, async ({ payrollNZApi }) => {
    const res = await payrollNZApi.getPayRun(tenantId, payRunId)
    return res.body
  })
}

export async function getPaySlips(tenantId: string, payRunId: string) {
  return withXeroClient(tenantId, async ({ payrollNZApi }) => {
    const res = await payrollNZApi.getPaySlips(tenantId, payRunId)
    return res.body
  })
}

export async function createEmployee(
  tenantId: string,
  employee: { firstName: string; lastName: string; dateOfBirth: string; address: { addressLine1: string; city: string; postCode: string; countryName: string }; email?: string }
) {
  return withXeroClient(tenantId, async ({ payrollNZApi }) => {
    const res = await payrollNZApi.createEmployee(tenantId, employee as any)
    return res.body
  })
}

export async function createPayRun(
  tenantId: string,
  payRun: { payrollCalendarID: string; payRunType?: string }
) {
  return withXeroClient(tenantId, async ({ payrollNZApi }) => {
    const res = await payrollNZApi.createPayRun(tenantId, payRun as any)
    return res.body
  })
}

export async function createTimesheet(
  tenantId: string,
  timesheet: { payrollCalendarID: string; employeeID: string; startDate: string; endDate: string; timesheetLines?: any[] }
) {
  return withXeroClient(tenantId, async ({ payrollNZApi }) => {
    const res = await payrollNZApi.createTimesheet(tenantId, timesheet as any)
    return res.body
  })
}

export async function createTimesheetLine(
  tenantId: string,
  timesheetId: string,
  line: { date: string; earningsRateID: string; numberOfUnits: number }
) {
  return withXeroClient(tenantId, async ({ payrollNZApi }) => {
    const res = await payrollNZApi.createTimesheetLine(tenantId, timesheetId, line as any)
    return res.body
  })
}

export async function approveTimesheet(tenantId: string, timesheetId: string) {
  return withXeroClient(tenantId, async ({ payrollNZApi }) => {
    const res = await payrollNZApi.approveTimesheet(tenantId, timesheetId)
    return res.body
  })
}
