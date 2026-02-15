import { NextRequest, NextResponse } from 'next/server'
import { sendWhatsAppText, sendWhatsAppTemplate } from '@/lib/whatsapp'

export async function POST(req: NextRequest) {
  try {
    const { to, text, template, templateName } = await req.json()
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || process.env.WHATSAPP_PHONE_ID || ''
    const token = process.env.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_TOKEN || ''
    if (!phoneId || !token) {
      return NextResponse.json({ ok: false, error: 'WhatsApp env not configured' })
    }
    if (!to) return NextResponse.json({ ok: false, error: 'to is required' })
    // Normalize NZ-style numbers (021..., +64..., 64...)
    const normalized = (() => {
      let n = String(to || '').trim()
      n = n.replace(/[^\d+]/g, '')
      if (n.startsWith('+')) n = n.slice(1)
      if (n.startsWith('0')) n = '64' + n.slice(1)
      if (!n.startsWith('64') && /^\d{8,15}$/.test(n)) n = '64' + n
      return n
    })()
    const body = typeof text === 'string' && text.trim().length ? text : 'Hello from CaterStation 👋'
    const name = typeof templateName === 'string' && templateName.trim().length
      ? templateName.trim()
      : (process.env.WHATSAPP_TEMPLATE_NAME || 'delivery_confirmation_5')

    let templateResult: any = null
    let templateError: any = null
    if (template || typeof templateName === 'string') {
      try {
        templateResult = await sendWhatsAppTemplate({ phoneId, token, toPhoneE164: normalized, templateName: name })
      } catch (e: any) {
        templateError = e?.message || String(e)
      }
    }

    let textResult: any = null
    let textError: any = null
    try {
      textResult = await sendWhatsAppText({ phoneId, token, toPhoneE164: normalized, text: body })
    } catch (e: any) {
      textError = e?.message || String(e)
    }

    const ok = !textError
    return NextResponse.json({
      ok,
      to: normalized,
      templateName: template || templateName ? name : null,
      templateResult,
      templateError,
      textResult,
      textError,
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'send failed' })
  }
}

