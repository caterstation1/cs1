import { NextRequest, NextResponse } from 'next/server'
import { env } from '@/env.mjs'
import crypto from 'crypto'

function signParams(params: Record<string, any>, apiSecret: string) {
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&')
  return crypto.createHash('sha1').update(toSign + apiSecret).digest('hex')
}

export async function POST(req: NextRequest) {
  try {
    const { folder, publicId, resourceType } = await req.json()
    const cloudName = env.CLOUDINARY_CLOUD_NAME
    const apiKey = env.CLOUDINARY_API_KEY
    const apiSecret = env.CLOUDINARY_API_SECRET
    if (!cloudName || !apiKey || !apiSecret) {
      return NextResponse.json({ error: 'Cloudinary not configured' }, { status: 500 })
    }
    const timestamp = Math.floor(Date.now() / 1000)
    const params: Record<string, any> = { timestamp }
    if (folder) params.folder = folder
    if (publicId) params.public_id = publicId
    if (resourceType) params.resource_type = resourceType
    // Signed upload (default type=upload, resource_type=image unless client specifies)
    const signature = signParams(params, apiSecret)
    return NextResponse.json({
      cloudName,
      apiKey,
      timestamp,
      signature,
      folder: folder || null,
      publicId: publicId || null,
      resourceType: resourceType || 'image',
    })
  } catch (e) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }
}

