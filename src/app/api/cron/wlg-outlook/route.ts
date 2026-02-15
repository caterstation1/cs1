import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import nodemailer from 'nodemailer'
import { formatWLGOutlookEmail } from '@/lib/email-formatter'
import { format, addDays } from 'date-fns'
import { isWellingtonOrder } from '@/lib/region'

// Create email transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD,
  },
})

// Helper function to check if SKU is an addon
function isAddon(sku?: string): boolean {
  return !!sku && (sku.startsWith('ADD') || sku.startsWith('AA'))
}

// Helper function to parse line items
function parseLineItems(order: any): any[] {
  if (Array.isArray(order.lineItems)) return order.lineItems
  if (typeof order.lineItems === 'string') {
    try {
      return JSON.parse(order.lineItems)
    } catch {}
  }
  return []
}

export async function GET(request: NextRequest) {
  try {
    // Verify authorization (optional: add auth header check)
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get email setting from database
    const emailSetting = await prisma.emailSetting.findUnique({
      where: { name: 'WLG_3DAY_OUTLOOK' },
    })

    if (!emailSetting || !emailSetting.isActive) {
      return NextResponse.json(
        { message: 'Email setting not configured or not active' },
        { status: 200 }
      )
    }

    // Calculate today, tomorrow and day after tomorrow (using NZ timezone)
    const now = new Date()
    // Convert to NZ timezone (UTC+12 for NZST, UTC+13 for NZDT)
    const nzOffset = 12 * 60 // 12 hours in minutes for NZST (adjust to 13*60 for NZDT if needed)
    const nzTime = new Date(now.getTime() + (nzOffset * 60 * 1000))
    
    const today = new Date(nzTime.getFullYear(), nzTime.getMonth(), nzTime.getDate())
    const tomorrow = addDays(today, 1)
    const dayAfter = addDays(today, 2)

    // Format dates for database query (start and end of day)
    const todayStart = new Date(today)
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date(today)
    todayEnd.setHours(23, 59, 59, 999)

    const tomorrowStart = new Date(tomorrow)
    tomorrowStart.setHours(0, 0, 0, 0)
    const tomorrowEnd = new Date(tomorrow)
    tomorrowEnd.setHours(23, 59, 59, 999)

    const dayAfterStart = new Date(dayAfter)
    dayAfterStart.setHours(0, 0, 0, 0)
    const dayAfterEnd = new Date(dayAfter)
    dayAfterEnd.setHours(23, 59, 59, 999)

    // Fetch orders for all three days
    const [todayOrdersRaw, tomorrowOrdersRaw, dayAfterOrdersRaw] = await Promise.all([
      prisma.order.findMany({
        where: {
          deliveryDateResolved: {
            gte: todayStart,
            lte: todayEnd,
          },
        },
        orderBy: { deliveryTime: 'asc' },
      }),
      prisma.order.findMany({
        where: {
          deliveryDateResolved: {
            gte: tomorrowStart,
            lte: tomorrowEnd,
          },
        },
        orderBy: { deliveryTime: 'asc' },
      }),
      prisma.order.findMany({
        where: {
          deliveryDateResolved: {
            gte: dayAfterStart,
            lte: dayAfterEnd,
          },
        },
        orderBy: { deliveryTime: 'asc' },
      }),
    ])

    // Filter for WLG orders
    const todayOrders = todayOrdersRaw.filter(isWellingtonOrder)
    const tomorrowOrders = tomorrowOrdersRaw.filter(isWellingtonOrder)
    const dayAfterOrders = dayAfterOrdersRaw.filter(isWellingtonOrder)

    // Fetch all products for display names (get unique SKUs)
    const allOrders = [...todayOrders, ...tomorrowOrders, ...dayAfterOrders]
    const skus = new Set<string>()
    allOrders.forEach(order => {
      const items = parseLineItems(order)
      items.forEach(item => {
        if (item.sku) skus.add(item.sku)
      })
    })

    const productsMap: Record<string, any> = {}
    if (skus.size > 0) {
      const products = await prisma.productWithCustomData.findMany({
        where: { shopifySku: { in: Array.from(skus) } },
      })
      products.forEach(p => {
        if (p.shopifySku) productsMap[p.shopifySku] = p
      })
    }

    // Format orders for email
    const formatOrdersForEmail = (orders: any[]) => {
      return orders.map(order => {
        const items = parseLineItems(order)
        const ship = order.shippingAddress || order.shipping_address || {}

        const productItems: any[] = []
        const addonItems: any[] = []

        items.forEach((item: any) => {
          const qty = Number(item.quantity || 0)
          const product = item.sku ? productsMap[item.sku] : undefined

          if (isAddon(item.sku)) {
            // For addons, use the actual item title from the order
            addonItems.push({
              name: item.title || item.name || 'Unknown Addon',
              quantity: qty,
            })
          } else {
            // For products, use the actual item title from the order, not database display name
            const displayName = item.title || item.name || 'Unknown Product'
            
            const variantTitle =
              item.variant_title || item.variantTitle || item.variant_name || ''
            const variantInfo =
              variantTitle && variantTitle !== 'Default Title' ? variantTitle : undefined

            productItems.push({
              displayName,
              quantity: qty,
              variantInfo,
            })
          }
        })

        return {
          orderNumber: order.orderNumber,
          deliveryTime: order.deliveryTime || '',
          companyName: ship.company || '',
          customerName: `${order.customerFirstName || ''} ${order.customerLastName || ''}`.trim() || 'N/A',
          address1: ship.address1 || ship.addr1 || '',
          address2: ship.address2 || ship.addr2 || '',
          phone: ship.phone || order.phone || '',
          productItems,
          addonItems,
          orderNotes: order.note || '',
        }
      })
    }

    const todayEmailData = formatOrdersForEmail(todayOrders)
    const tomorrowEmailData = formatOrdersForEmail(tomorrowOrders)
    const dayAfterEmailData = formatOrdersForEmail(dayAfterOrders)

    // Format dates for display
    const todayDateStr = format(today, 'EEEE, MMMM d, yyyy')
    const tomorrowDateStr = format(tomorrow, 'EEEE, MMMM d, yyyy')
    const dayAfterDateStr = format(dayAfter, 'EEEE, MMMM d, yyyy')

    // ISO dates for links
    const todayISO = format(today, 'yyyy-MM-dd')
    const tomorrowISO = format(tomorrow, 'yyyy-MM-dd')
    const dayAfterISO = format(dayAfter, 'yyyy-MM-dd')

    // Generate email HTML
    const emailHTML = formatWLGOutlookEmail(
      todayEmailData,
      tomorrowEmailData,
      dayAfterEmailData,
      todayDateStr,
      tomorrowDateStr,
      dayAfterDateStr,
      todayISO,
      tomorrowISO,
      dayAfterISO
    )

    // Send email to recipient from database
    const recipient = emailSetting.recipientEmail

    // Generate PDFs for today's runsheet and labels
    let runsheetPDF: Buffer | null = null
    let labelsPDF: Buffer | null = null
    
    try {
      console.log('📄 Starting runsheet PDF generation...')
      const React = await import('react')
      const { renderToBuffer } = await import('@react-pdf/renderer')
      const { RunsheetDocument } = await import('@/lib/pdf/runsheet-document')
      const { fetchRunsheetData } = await import('@/lib/runsheet-data')
      
      console.log('📄 Fetching runsheet data for today...')
      // Generate runsheet PDF for today
      const runsheetData = await fetchRunsheetData(today, true) // isWLG = true
      console.log('📄 Runsheet data fetched:', {
        orderCount: runsheetData.orderCount,
        boxesCount: runsheetData.boxesCount,
        productsCount: runsheetData.productsList.length
      })
      
      console.log('📄 Creating PDF document...')
      const doc = React.createElement(RunsheetDocument, { data: runsheetData })
      runsheetPDF = await renderToBuffer(doc as any)
      console.log('✅ Generated runsheet PDF, size:', runsheetPDF.length, 'bytes')
    } catch (pdfError: any) {
      console.error('❌ Failed to generate runsheet PDF:', pdfError)
      console.error('❌ Error stack:', pdfError?.stack)
    }

    // Note: Labels PDF generation requires order data - simplified for now
    // You can add labels PDF generation here if needed

    const attachments: any[] = []
    if (runsheetPDF) {
      console.log('📎 Adding runsheet PDF attachment')
      attachments.push({
        filename: `runsheet-${format(today, 'yyyy-MM-dd')}.pdf`,
        content: runsheetPDF,
        contentType: 'application/pdf'
      })
    } else {
      console.log('⚠️ No runsheet PDF generated, skipping attachment')
    }
    // if (labelsPDF) {
    //   attachments.push({
    //     filename: `labels-${format(today, 'yyyy-MM-dd')}.pdf`,
    //     content: labelsPDF,
    //     contentType: 'application/pdf'
    //   })
    // }

    console.log(`📧 Sending email to ${recipient} with ${attachments.length} attachments`)
    
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: recipient,
      subject: `WLG 3-Day Outlook - ${format(today, 'MMM d')}, ${format(tomorrow, 'MMM d')} & ${format(dayAfter, 'MMM d')}`,
      html: emailHTML,
      attachments
    })

    console.log(`✅ WLG Outlook email sent to ${recipient} with ${attachments.length} attachments`)
    console.log(`   Today (${todayDateStr}): ${todayOrders.length} orders`)
    console.log(`   Tomorrow (${tomorrowDateStr}): ${tomorrowOrders.length} orders`)
    console.log(`   Day After (${dayAfterDateStr}): ${dayAfterOrders.length} orders`)

    return NextResponse.json({
      success: true,
      today: {
        date: todayDateStr,
        orderCount: todayOrders.length,
      },
      tomorrow: {
        date: tomorrowDateStr,
        orderCount: tomorrowOrders.length,
      },
      dayAfter: {
        date: dayAfterDateStr,
        orderCount: dayAfterOrders.length,
      },
    })
  } catch (error) {
    console.error('Error sending WLG outlook email:', error)
    return NextResponse.json(
      { error: 'Failed to send WLG outlook email', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

