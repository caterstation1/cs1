export type NavLink = {
  href: string
  label: string
}

export const BASE_NAV_LINKS: NavLink[] = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/orders', label: 'All Orders' },
  { href: '/realtime-orders', label: 'Realtime Orders' },
  { href: '/products', label: 'Products' },
  { href: '/stock', label: 'Stock' },
  { href: '/bakery', label: 'Bakery' },
  { href: '/bnb', label: 'B&B' },
  { href: '/cart', label: 'Cart' },
  { href: '/shop', label: 'Shop' },
  { href: '/customers', label: 'Customers' },
  { href: '/calendar', label: 'Calendar' },
  { href: '/wlg-calendar', label: 'WLG Calendar' },
  { href: '/wlg-staff', label: 'WLG Staff' },
  { href: '/wlg-comms', label: 'WLG Comms' },
  { href: '/staff', label: 'Staff' },
  { href: '/roster', label: 'Roster' },
  { href: '/timesheet', label: 'Timesheet' },
  { href: '/pricing-lab', label: 'Pricing Lab' },
  { href: '/recipe-builder', label: 'Recipe Builder' },
  { href: '/fcp', label: 'FCP' },
  { href: '/settings', label: 'Settings' },
]

export function getNavLinksForAccess(accessLevel: string | undefined): NavLink[] {
  const access = (accessLevel || '').toLowerCase()

  if (!access) {
    return []
  }

  if (access === 'bakery') {
    return BASE_NAV_LINKS.filter((l) => l.href === '/bakery')
  }
  if (access === 'pricing_lab') {
    return BASE_NAV_LINKS.filter((l) => l.href === '/pricing-lab' || l.href === '/recipe-builder')
  }
  if (access === 'wlg_team') {
    return BASE_NAV_LINKS.filter((l) => l.href === '/wlg-calendar' || l.href === '/wlg-staff')
  }
  if (access === 'wlg_admin') {
    return BASE_NAV_LINKS.filter(
      (l) =>
        l.href === '/wlg-calendar' ||
        l.href === '/wlg-staff' ||
        l.href === '/wlg-comms' ||
        l.href === '/pricing-lab' ||
        l.href === '/stock' ||
        l.href === '/bakery'
    )
  }

  return BASE_NAV_LINKS
}
