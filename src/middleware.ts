import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { jwtVerify } from 'jose'

// Paths a pricing_lab user is allowed to access
const PRICING_PAGE_PREFIXES = [
  '/pricing-lab',
  '/login',
  '/reset-password',
]
const PRICING_API_PREFIXES = [
  '/api/products-with-custom-data',
  '/api/components',
  '/api/shopify/products', // GET only used for images map
  '/api/health',
]
const PUBLIC_PREFIXES = [
  '/api/auth',
  '/api/health',
  '/api/test',
  '/api/production-url',
  '/api/admin/backfill-scheduling', // Temporary: allow backfill endpoint
  '/_next',
  '/static',
  '/favicon.ico',
]

function isAllowedForPricing(path: string): boolean {
  return (
    PRICING_PAGE_PREFIXES.some(p => path === p || path.startsWith(p + '/')) ||
    PRICING_API_PREFIXES.some(p => path === p || path.startsWith(p + '/')) ||
    PUBLIC_PREFIXES.some(p => path === p || path.startsWith(p + '/'))
  )
}

// WLG role allow-lists
const WLG_TEAM_PAGE_PREFIXES = ['/wlg-calendar', '/wlg-staff', '/labels/print', '/login', '/reset-password']
const WLG_TEAM_API_PREFIXES = ['/api/orders', '/api/staff', '/api/products', '/api/labels', '/api/maps', '/api/health']

const WLG_ADMIN_PAGE_PREFIXES = ['/wlg-calendar', '/wlg-staff', '/wlg-comms', '/pricing-lab', '/labels/print', '/login', '/reset-password']
const WLG_ADMIN_API_PREFIXES = [
  ...PRICING_API_PREFIXES,
  '/api/orders', '/api/labels', '/api/maps',
  '/api/staff',
  '/api/products',
  '/api/wlg-messages',
  '/api/health',
]

async function readSession(request: NextRequest): Promise<{ accessLevel?: string } | null> {
  // Use a single, consistent secret fallback identical to NextAuth server config
  const AUTH_SECRET = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || 'your-secret-key'

  // Primary: NextAuth helper
  const token = await getToken({ req: request as any, secret: AUTH_SECRET })
  if (token) return { accessLevel: (token as any).accessLevel as string | undefined }

  // Fallback: decode JWT from cookie if helper fails (older tokens, edge quirks)
  const raw = request.cookies.get('next-auth.session-token')?.value
    || request.cookies.get('__Secure-next-auth.session-token')?.value
  if (!raw) return null
  try {
    const secret = new TextEncoder().encode(AUTH_SECRET)
    const { payload } = await jwtVerify(raw, secret)
    return { accessLevel: (payload as any).accessLevel }
  } catch {
    return null
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Always allow public assets and auth
  if (PUBLIC_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next()
  }

  const session = await readSession(request)
  const accessLevel = session?.accessLevel

  // Do NOT redirect authenticated users away from /login to avoid refresh loops
  // Users can navigate manually after sign-in

  // Require login for all non-public routes
  const isPublic =
    PUBLIC_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/')) ||
    pathname === '/login' || pathname.startsWith('/reset-password')
  if (!isPublic && !session) {
    if (pathname.startsWith('/api/')) {
      return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } })
    }
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // If user has pricing_lab role, restrict to approved routes only
  if (accessLevel === 'pricing_lab') {
    if (!isAllowedForPricing(pathname)) {
      // API requests get 403; pages redirect to /pricing-lab
      if (pathname.startsWith('/api/')) {
        return new NextResponse(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'content-type': 'application/json' } })
      }
      const url = new URL('/pricing-lab', request.url)
      return NextResponse.redirect(url)
    }
  }

  // WLG Team: only WLG Calendar and required APIs
  if (accessLevel === 'wlg_team') {
    const isAllowed =
      WLG_TEAM_PAGE_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/')) ||
      WLG_TEAM_API_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/')) ||
      PUBLIC_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))
    if (!isAllowed) {
      if (pathname.startsWith('/api/')) {
        return new NextResponse(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'content-type': 'application/json' } })
      }
      const url = new URL('/wlg-calendar', request.url)
      return NextResponse.redirect(url)
    }
  }

  // WLG Admin: WLG Calendar, WLG Staff, Pricing Lab, and required APIs
  if (accessLevel === 'wlg_admin') {
    const isAllowed =
      WLG_ADMIN_PAGE_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/')) ||
      WLG_ADMIN_API_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/')) ||
      PUBLIC_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))
    if (!isAllowed) {
      if (pathname.startsWith('/api/')) {
        return new NextResponse(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'content-type': 'application/json' } })
      }
      const url = new URL('/wlg-calendar', request.url)
      return NextResponse.redirect(url)
    }
  }

  // Admin: allow dashboard (Admin S view is served from /dashboard)
  // No additional restrictions here for now

  // Basic: allow limited app pages and APIs needed for basic operations (dashboard, roster, timesheet, orders)
  if (accessLevel === 'basic') {
    const allowedPages = ['/dashboard', '/realtime-orders', '/calendar', '/labels/print', '/login', '/reset-password']
    const allowedApis = [
      '/api/orders',
      '/api/calendar',
      '/api/labels',
      '/api/maps',
      '/api/staff',
      '/api/timesheet',
      '/api/roster',
      '/api/todos',
    ]
    const isAllowed =
      allowedPages.some(p => pathname === p || pathname.startsWith(p + '/')) ||
      allowedApis.some(p => pathname === p || pathname.startsWith(p + '/')) ||
      PUBLIC_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))
    if (!isAllowed) {
      if (pathname.startsWith('/api/')) {
        return new NextResponse(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'content-type': 'application/json' } })
      }
      const url = new URL('/realtime-orders', request.url)
      return NextResponse.redirect(url)
    }
  }

  return NextResponse.next()
}

export const config = {
  // Run on all routes so we can restrict non-whitelisted pages for pricing_lab
  matcher: ['/(.*)'],
}


