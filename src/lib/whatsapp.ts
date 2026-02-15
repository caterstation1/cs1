export type WaInteractiveButton = {
  type: 'reply'
  reply: { id: string; title: string }
}

export async function sendWhatsAppInteractiveMessage(opts: {
  phoneId: string
  token: string
  toPhoneE164: string
  header?: string
  body: string
  buttons: WaInteractiveButton[]
}) {
  const { phoneId, token, toPhoneE164, header, body, buttons } = opts
  const url = `https://graph.facebook.com/v19.0/${phoneId}/messages`
  const payload = {
    messaging_product: 'whatsapp',
    to: toPhoneE164,
    type: 'interactive',
    interactive: {
      type: 'button',
      header: header ? { type: 'text', text: header } : undefined,
      body: { text: body },
      action: { buttons },
    },
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`WA send failed ${res.status}: ${text}`)
  }
  return res.json().catch(() => ({}))
}

export async function sendWhatsAppText(opts: {
  phoneId: string
  token: string
  toPhoneE164: string
  text: string
}) {
  const { phoneId, token, toPhoneE164, text } = opts
  const url = `https://graph.facebook.com/v19.0/${phoneId}/messages`
  const payload = {
    messaging_product: 'whatsapp',
    to: toPhoneE164,
    type: 'text',
    text: { body: text },
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const tx = await res.text().catch(() => '')
    throw new Error(`WA text failed ${res.status}: ${tx}`)
  }
  return res.json().catch(() => ({}))
}

export async function sendWhatsAppTemplate(opts: {
  phoneId: string
  token: string
  toPhoneE164: string
  templateName?: string // default hello_world
  language?: string // default en_US
}) {
  const { phoneId, token, toPhoneE164, templateName = 'hello_world', language = 'en_US' } = opts
  const url = `https://graph.facebook.com/v19.0/${phoneId}/messages`
  const payload = {
    messaging_product: 'whatsapp',
    to: toPhoneE164,
    type: 'template',
    template: {
      name: templateName,
      language: { code: language },
    },
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const tx = await res.text().catch(() => '')
    throw new Error(`WA template failed ${res.status}: ${tx}`)
  }
  return res.json().catch(() => ({}))
}

