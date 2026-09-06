// Resend Inbound API client.
//
// The email.received webhook carries metadata only; body and attachments are
// fetched afterwards from the Receiving API. Raw fetch rather than the resend
// SDK because the installed SDK (v4.2) predates the receiving namespace.

const API_BASE = 'https://api.resend.com'

export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024

export interface ReceivedEmail {
  id: string
  from: string
  subject: string
  html: string | null
  text: string | null
  headers: Record<string, string>
}

export interface ReceivedAttachment {
  id: string
  filename: string
  contentType: string
  size: number
  downloadUrl: string
}

function apiKey(): string {
  const key = process.env.RESEND_API_KEY
  if (!key) throw new Error('RESEND_API_KEY is not set')
  return key
}

async function resendGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${apiKey()}` },
    cache: 'no-store',
  })
  if (!res.ok) {
    throw new Error(`Resend API ${path} failed: ${res.status} ${await res.text().catch(() => '')}`)
  }
  return (await res.json()) as T
}

export async function getReceivedEmail(emailId: string): Promise<ReceivedEmail> {
  const raw = await resendGet<{
    id: string
    from: string
    subject: string | null
    html: string | null
    text: string | null
    headers?: Record<string, string>
  }>(`/emails/receiving/${emailId}`)
  return {
    id: raw.id,
    from: raw.from ?? '',
    subject: raw.subject ?? '',
    html: raw.html,
    text: raw.text,
    headers: raw.headers ?? {},
  }
}

export async function listReceivedAttachments(emailId: string): Promise<ReceivedAttachment[]> {
  const raw = await resendGet<{
    data?: Array<{
      id: string
      filename: string | null
      content_type: string | null
      size: number | null
      download_url: string
    }>
  }>(`/emails/receiving/${emailId}/attachments`)
  return (raw.data ?? []).map((a) => ({
    id: a.id,
    filename: a.filename ?? '',
    contentType: a.content_type ?? '',
    size: a.size ?? 0,
    downloadUrl: a.download_url,
  }))
}

/** Downloads one attachment, refusing anything over the size cap. */
export async function downloadAttachment(attachment: ReceivedAttachment): Promise<Buffer> {
  if (attachment.size > MAX_ATTACHMENT_BYTES) {
    throw new Error(`Attachment ${attachment.filename} exceeds ${MAX_ATTACHMENT_BYTES} bytes`)
  }
  const res = await fetch(attachment.downloadUrl, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Attachment download failed: ${res.status}`)
  const buffer = Buffer.from(await res.arrayBuffer())
  if (buffer.byteLength > MAX_ATTACHMENT_BYTES) {
    throw new Error(`Attachment ${attachment.filename} exceeds ${MAX_ATTACHMENT_BYTES} bytes`)
  }
  return buffer
}
