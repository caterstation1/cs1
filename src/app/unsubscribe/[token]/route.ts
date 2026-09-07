import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyOptOutToken } from '@/lib/order-notification-optout'

function htmlPage(title: string, body: string) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;background:#f5f5f5;margin:0;padding:32px;">
  <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:10px;padding:24px;">
    <h1 style="margin-top:0;">${title}</h1>
    <p style="line-height:1.6;">${body}</p>
  </div>
</body>
</html>
`.trim()
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const result = verifyOptOutToken(token || '')
    if (!result.valid || !result.email) {
      return new NextResponse(htmlPage('Invalid opt-out link', 'This link is invalid or expired.'), {
        headers: { 'content-type': 'text/html; charset=utf-8' },
        status: 400,
      })
    }

    const email = result.email
    await prisma.orderNotificationOptOut.upsert({
      where: { email },
      update: { source: 'link_click' },
      create: {
        email,
        source: 'link_click',
        reason: 'Recipient opted out via day-prior notification link',
      },
    })

    return new NextResponse(
      htmlPage('You are opted out', `We will no longer send order-notification emails to <strong>${email}</strong>.`),
      {
        headers: { 'content-type': 'text/html; charset=utf-8' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error processing opt-out:', error)
    return new NextResponse(
      htmlPage('Unable to process request', 'Something went wrong while processing your opt-out request.'),
      {
        headers: { 'content-type': 'text/html; charset=utf-8' },
        status: 500,
      }
    )
  }
}
