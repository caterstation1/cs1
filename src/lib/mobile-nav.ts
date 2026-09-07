export type MobileMoreLink = {
  href: string
  label: string
  description?: string
  roles?: string[]
}

export const MOBILE_PRIMARY_TABS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/realtime-orders', label: 'Realtime' },
  { href: '/timesheet', label: 'Timesheets' },
  { href: '/mobile/menu', label: 'Menu' },
] as const

export const MOBILE_MORE_LINKS: MobileMoreLink[] = [
  { href: '/calendar', label: 'Calendar', description: 'Auckland day view and orders' },
  { href: '/orders', label: 'All Orders', description: 'Search and browse orders' },
  { href: '/stock', label: 'Stock', description: 'Stock summary and planning' },
  { href: '/roster', label: 'Roster', description: 'Staff shifts and roster' },
]

const ADMIN_MOBILE_MORE_LINKS: MobileMoreLink[] = [
  ...MOBILE_MORE_LINKS,
  { href: '/wlg-calendar', label: 'WLG Calendar', description: 'Wellington day view' },
  { href: '/wlg-comms', label: 'WLG Comms', description: 'Wellington messages' },
  { href: '/wlg-staff', label: 'WLG Staff', description: 'Wellington staff list' },
  { href: '/bakery', label: 'Bakery', description: 'Bakery dashboard' },
  { href: '/bnb', label: 'B&B', description: 'Weekly butcher and bakery owing' },
  { href: '/products', label: 'Products', description: 'Product catalog' },
  { href: '/customers', label: 'Customers', description: 'Customer records' },
  { href: '/staff', label: 'Staff', description: 'Staff management' },
  { href: '/fcp', label: 'FCP', description: 'Food control plan' },
  { href: '/settings', label: 'Settings', description: 'App settings' },
]

export function getMobileMoreLinks(accessLevel: string): MobileMoreLink[] {
  const access = (accessLevel || '').toLowerCase()

  if (access === 'bakery') {
    return [{ href: '/bakery', label: 'Bakery', description: 'Bakery dashboard' }]
  }
  if (access === 'pricing_lab') {
    return [{ href: '/pricing-lab', label: 'Pricing Lab', description: 'Pricing tools' }]
  }
  if (access === 'wlg_team') {
    return [
      { href: '/wlg-calendar', label: 'WLG Calendar', description: 'Wellington calendar' },
      { href: '/wlg-staff', label: 'WLG Staff', description: 'Staff list' },
      { href: '/labels/print', label: 'Labels', description: 'Print labels' },
    ]
  }
  if (access === 'wlg_admin') {
    return [
      { href: '/wlg-calendar', label: 'WLG Calendar', description: 'Wellington calendar' },
      { href: '/wlg-staff', label: 'WLG Staff', description: 'Staff list' },
      { href: '/wlg-comms', label: 'WLG Comms', description: 'Messages' },
      { href: '/stock', label: 'Stock', description: 'Stock summary' },
      { href: '/bakery', label: 'Bakery', description: 'Bakery dashboard' },
    ]
  }
  if (access === 'owner' || access === 'admin' || access === 'manager') {
    return ADMIN_MOBILE_MORE_LINKS
  }

  return MOBILE_MORE_LINKS
}

export function usesStandardMobileShell(accessLevel: string): boolean {
  const access = (accessLevel || '').toLowerCase()
  return !['bakery', 'pricing_lab', 'wlg_team', 'wlg_admin'].includes(access)
}
