import { NextResponse } from 'next/server'
import { env } from '@/env.mjs'

async function fetchAllRawShopifyProducts(): Promise<any[]> {
  const shopUrl = env.SHOPIFY_SHOP_URL
  const accessToken = env.SHOPIFY_ACCESS_TOKEN
  const apiVersion = env.SHOPIFY_API_VERSION

  if (!shopUrl || !accessToken || !apiVersion) {
    throw new Error('Shopify credentials not fully configured')
  }

  const all: any[] = []
  let hasNextPage = true
  let nextPageInfo: string | null = null

  while (hasNextPage) {
    const url: string = nextPageInfo
      ? `https://${shopUrl}/admin/api/${apiVersion}/products.json?limit=250&page_info=${nextPageInfo}`
      : `https://${shopUrl}/admin/api/${apiVersion}/products.json?limit=250`

    const res = await fetch(url, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Shopify error ${res.status}: ${text}`)
    }
    const data = await res.json()
    const products = Array.isArray(data?.products) ? data.products : []
    all.push(...products)

    const linkHeader = res.headers.get('Link')
    if (linkHeader && linkHeader.includes('rel="next"')) {
      const m = linkHeader.match(/<[^>]*page_info=([^&>]+)[^>]*>; rel="next"/)
      nextPageInfo = m ? m[1] : null
      hasNextPage = Boolean(nextPageInfo)
      if (hasNextPage) await new Promise(r => setTimeout(r, 100))
    } else {
      hasNextPage = false
    }
  }
  return all
}

export async function GET() {
  try {
    const products = await fetchAllRawShopifyProducts()
    return NextResponse.json({ success: true, count: products.length, products })
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}


