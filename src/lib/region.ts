// Centralized region detection to prevent Auckland orders like "Mt/Mount Wellington"
// from being misclassified as Wellington (WLG).
//
// Priority:
// 1) Explicit note attributes / line item properties: City = WLG
// 2) Province / province_code: WGN/Wellington => WLG; AUK/Auckland => AKL
// 3) City fallback (strict): exact "wellington" => WLG; explicitly exclude "mt wellington"/"mount wellington" (AKL)
// 4) Zip guard: 10xx are Auckland postcodes -> AKL

function safelyParseArrayJSON(input: unknown): any[] {
  try {
    if (typeof input === 'string' && input.trim().startsWith('[')) {
      return JSON.parse(input)
    }
  } catch {}
  return []
}

export function isWellingtonOrder(order: any): boolean {
  try {
    // 1) Explicit note attributes
    const noteAttrs = order?.noteAttributes || order?.note_attributes || []
    const nCity = Array.isArray(noteAttrs)
      ? noteAttrs.find((a: any) => (a?.name || '').toLowerCase() === 'city')
      : null
    if (nCity && String(nCity.value || '').toUpperCase() === 'WLG') return true

    // Line item properties
    let items: any[] = []
    if (Array.isArray(order?.lineItems)) items = order.lineItems
    else if (typeof order?.lineItems === 'string') items = safelyParseArrayJSON(order.lineItems)
    if (items.some(it =>
      Array.isArray(it?.properties) &&
      it.properties.some((p: any) => (p?.name || '').toLowerCase() === 'city' && String(p?.value || '').toUpperCase() === 'WLG')
    )) return true

    // 2) Province / province code
    const ship = order?.shippingAddress || order?.shipping_address || {}
    const province = String(ship?.province || '').toLowerCase()
    const provCode = String(ship?.province_code || '').toUpperCase()
    if (provCode === 'WGN' || province === 'wellington') return true
    if (provCode === 'AUK' || province === 'auckland') return false

    // 3) City fallback (strict)
    const city = String(ship?.city || '').trim().toLowerCase()
    if (city === 'wellington') return true
    if (city === 'mt wellington' || city === 'mount wellington') return false

    // 4) Zip/postal code guard: Auckland urban 10xx
    const zip = String(ship?.zip || ship?.postal_code || '').trim()
    if (/^10\d{2}$/.test(zip)) return false
  } catch {}
  return false
}

export function isAucklandOrder(order: any): boolean {
  return !isWellingtonOrder(order)
}

