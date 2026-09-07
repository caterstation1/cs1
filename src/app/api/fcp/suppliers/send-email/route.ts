import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { requireRole } from '@/lib/authz'

type SendSupplierEmailPayload = {
  to?: string
  supplierId?: string | null
  supplierName?: string | null
  subject?: string
  body?: string
}

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD,
  },
})

export async function POST(request: NextRequest) {
  try {
    await requireRole(['owner', 'admin'])
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let payload: SendSupplierEmailPayload
  try {
    payload = (await request.json()) as SendSupplierEmailPayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const to = String(payload.to || '').trim()
  const subject = String(payload.subject || '').trim()
  const body = String(payload.body || '').trim()

  if (!to || !subject || !body) {
    return NextResponse.json({ error: 'to, subject and body are required' }, { status: 400 })
  }
  if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
    return NextResponse.json({ error: 'Email service is not configured' }, { status: 500 })
  }

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject,
      text: body,
      html: body.replace(/\n/g, '<br/>'),
    })

    return NextResponse.json({
      data: {
        to,
        subject,
        supplierId: payload.supplierId || null,
        supplierName: payload.supplierName || null,
        sentAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('fcp supplier email send error', error)
    return NextResponse.json({ error: 'Failed to send supplier email' }, { status: 500 })
  }
}
