/**
 * Thank-you note upload for the cart page.
 *
 * Drop at: src/app/api/thankyou/upload/route.ts
 *
 * The cart section (sections/cs-cart-thankyou.liquid) POSTs multipart form data
 * {file, cart_token}. This route pushes the file into Shopify Files
 * (Admin → Content → Files) via stagedUploadsCreate + fileCreate, waits for
 * Shopify to mark it READY, and returns its permanent CDN URL. The theme then
 * stores that URL as the cart attribute "Thank you note file", which lands on
 * the order and in the notification emails.
 *
 * Requires SHOPIFY_ACCESS_TOKEN to carry read_files + write_files. Without them
 * stagedUploadsCreate returns access denied, surfaced here as a 502.
 *
 * Middleware: add '/api/thankyou' to the public prefixes in src/middleware.ts
 * (same list as /api/vip) or this returns 401 before it runs.
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const API_VERSION = process.env.SHOPIFY_API_VERSION || '2024-10';

/**
 * One route, both stores. The theme sends `store` = shop.permanent_domain.
 * AU falls back to the NZ credentials when SHOPIFY_AU_* are not set, so the
 * file still uploads (into the NZ store's Files) rather than failing.
 */
type Creds = { shop: string; token: string; label: string };
function credsFor(permanentDomain: string): Creds {
  const nz: Creds = {
    shop: process.env.SHOPIFY_SHOP_URL || '',
    token: process.env.SHOPIFY_ACCESS_TOKEN || '',
    label: 'nz',
  };
  if (/un40ik-2r|thecaterstation\.com\.au/i.test(permanentDomain)) {
    const shop = process.env.SHOPIFY_AU_SHOP_URL || '';
    const token = process.env.SHOPIFY_AU_ACCESS_TOKEN || '';
    if (shop && token) return { shop, token, label: 'au' };
  }
  return nz;
}

const MAX_BYTES = Number(process.env.THANKYOU_MAX_BYTES || 15 * 1024 * 1024);
const ALLOWED_ORIGINS = (
  process.env.THANKYOU_ALLOWED_ORIGINS ||
  process.env.VIP_ALLOWED_ORIGINS ||
  'https://caterstation.co.nz,https://www.caterstation.co.nz,https://thecaterstation.com.au,https://www.thecaterstation.com.au'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const ALLOWED_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
};

/* ------------------------------------------------------------------ helpers */

function corsHeaders(origin: string | null): Record<string, string> {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(body: unknown, status: number, origin: string | null) {
  return NextResponse.json(body, { status, headers: corsHeaders(origin) });
}

async function admin<T>(c: Creds, query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(`https://${c.shop}/admin/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': c.token },
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
  });
  const payload = await res.json();
  if (!res.ok || payload.errors) {
    throw new Error(`Shopify ${res.status}: ${JSON.stringify(payload.errors || payload)}`);
  }
  return payload.data as T;
}

function safeName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[^\w.\- ]+/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(-80) || 'note';
}

function stamp(): string {
  // NZ local time so the filename sorts sensibly in Admin → Files.
  const p = new Intl.DateTimeFormat('en-NZ', {
    timeZone: 'Pacific/Auckland',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const g = (t: string) => p.find((x) => x.type === t)?.value || '00';
  return `${g('year')}${g('month')}${g('day')}-${g('hour')}${g('minute')}`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------------ handlers */

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get('origin')) });
}

export async function GET(req: NextRequest) {
  const origin = req.headers.get('origin');
  return json(
    {
      ok: true,
      route: 'api/thankyou/upload',
      expects: 'POST multipart/form-data {file, cart_token}',
      config: {
        nz: Boolean(process.env.SHOPIFY_SHOP_URL && process.env.SHOPIFY_ACCESS_TOKEN),
        au: Boolean(process.env.SHOPIFY_AU_SHOP_URL && process.env.SHOPIFY_AU_ACCESS_TOKEN),
        apiVersion: API_VERSION, maxBytes: MAX_BYTES, allowedOrigins: ALLOWED_ORIGINS,
      },
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || null,
    },
    200,
    origin
  );
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin');

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ ok: false, error: 'Expected multipart form data' }, 400, origin);
  }

  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) return json({ ok: false, error: 'No file received' }, 400, origin);
  if (file.size > MAX_BYTES) return json({ ok: false, error: `File is over ${Math.round(MAX_BYTES / 1048576)}MB` }, 413, origin);

  const ext = (file.name.split('.').pop() || '').toLowerCase();
  const mime = ALLOWED_TYPES[ext];
  if (!mime) return json({ ok: false, error: 'Please upload a PDF, Word doc or image' }, 415, origin);

  const creds = credsFor(String(form.get('store') || ''));
  if (!creds.shop || !creds.token) return json({ ok: false, error: 'Server not configured' }, 500, origin);

  const token = String(form.get('cart_token') || '').replace(/[^a-z0-9]/gi, '').slice(0, 6) || 'nocart';
  const filename = `thankyou-${stamp()}-${token}-${safeName(file.name)}`;
  const isImage = mime.startsWith('image/');

  try {
    /* 1. Ask Shopify for a staged upload target. */
    const staged = await admin<{
      stagedUploadsCreate: {
        stagedTargets: { url: string; resourceUrl: string; parameters: { name: string; value: string }[] }[];
        userErrors: { field: string[] | null; message: string }[];
      };
    }>(creds,
      `mutation ($input: [StagedUploadInput!]!) {
         stagedUploadsCreate(input: $input) {
           stagedTargets { url resourceUrl parameters { name value } }
           userErrors { field message }
         }
       }`,
      {
        input: [
          {
            resource: isImage ? 'IMAGE' : 'FILE',
            filename,
            mimeType: mime,
            httpMethod: 'POST',
            fileSize: String(file.size),
          },
        ],
      }
    );
    const errs = staged.stagedUploadsCreate.userErrors;
    if (errs.length) return json({ ok: false, error: errs.map((e) => e.message).join('; ') }, 502, origin);
    const target = staged.stagedUploadsCreate.stagedTargets[0];
    if (!target) return json({ ok: false, error: 'No staged target returned' }, 502, origin);

    /* 2. Push the bytes to the staged target (Google Cloud Storage). */
    const fd = new FormData();
    for (const p of target.parameters) fd.append(p.name, p.value);
    fd.append('file', new Blob([await file.arrayBuffer()], { type: mime }), filename);
    const up = await fetch(target.url, { method: 'POST', body: fd });
    if (!up.ok) {
      const t = await up.text().catch(() => '');
      return json({ ok: false, error: `Storage rejected upload (${up.status}) ${t.slice(0, 200)}` }, 502, origin);
    }

    /* 3. Register it as a Shopify File. */
    const created = await admin<{
      fileCreate: {
        files: { id: string; fileStatus: string }[];
        userErrors: { field: string[] | null; message: string }[];
      };
    }>(creds,
      `mutation ($files: [FileCreateInput!]!) {
         fileCreate(files: $files) {
           files { id fileStatus }
           userErrors { field message }
         }
       }`,
      {
        files: [
          {
            originalSource: target.resourceUrl,
            filename,
            contentType: isImage ? 'IMAGE' : 'FILE',
            alt: `Thank-you note uploaded from cart ${token} (${file.name})`,
            duplicateResolutionMode: 'APPEND_UUID',
          },
        ],
      }
    );
    const cErrs = created.fileCreate.userErrors;
    if (cErrs.length) return json({ ok: false, error: cErrs.map((e) => e.message).join('; ') }, 502, origin);
    const id = created.fileCreate.files[0]?.id;
    if (!id) return json({ ok: false, error: 'File not created' }, 502, origin);

    /* 4. Wait for Shopify to process it and hand back the CDN URL. */
    let url: string | null = null;
    let status = 'UPLOADED';
    for (let i = 0; i < 20 && !url; i++) {
      await sleep(i < 3 ? 400 : 1000);
      const r = await admin<{
        node:
          | { __typename: 'GenericFile'; fileStatus: string; url: string | null }
          | { __typename: 'MediaImage'; fileStatus: string; image: { url: string } | null }
          | null;
      }>(creds,
        `query ($id: ID!) {
           node(id: $id) {
             __typename
             ... on GenericFile { fileStatus url }
             ... on MediaImage { fileStatus image { url } }
           }
         }`,
        { id }
      );
      const n = r.node;
      if (!n) break;
      status = n.fileStatus;
      if (status === 'FAILED') break;
      if (status === 'READY') {
        url = n.__typename === 'GenericFile' ? n.url : n.image?.url || null;
      }
    }
    if (!url) {
      return json({ ok: false, error: `Shopify is still processing the file (${status}). Please try again.` }, 504, origin);
    }

    console.log('[thankyou] uploaded', { store: creds.label, filename, id, size: file.size, cart: token });
    return json({ ok: true, url, filename: file.name, fileId: id }, 200, origin);
  } catch (err) {
    console.error('[thankyou] upload failed', err);
    const msg = err instanceof Error ? err.message : String(err);
    const denied = /access denied|not approved|write_files/i.test(msg);
    return json(
      { ok: false, error: denied ? 'Ops app is missing the write_files scope' : 'Upload failed' },
      502,
      origin
    );
  }
}
