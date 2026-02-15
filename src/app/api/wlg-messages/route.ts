import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAccessLevel } from '@/lib/authz'
import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD,
  },
})

// Parse @ mentions from message content
function parseMentions(content: string, staffList: any[]) {
  const mentions = {
    staffIds: [] as string[],
    orderNumbers: [] as number[]
  }
  
  // Find all @mentions: @12345 (orders) or @FirstName LastName (staff)
  const allMatches = content.matchAll(/@(\d+|[\w\s.@]+?)(?=\s|$|@|,|\.|\n|!|\?)/gi)
  
  for (const match of allMatches) {
    const mention = match[1].trim()
    
    // Check if it's a pure number (order)
    if (/^\d+$/.test(mention)) {
      const orderNum = parseInt(mention)
      if (!isNaN(orderNum) && !mentions.orderNumbers.includes(orderNum)) {
        mentions.orderNumbers.push(orderNum)
      }
      continue
    }
    
    // Try email match
    const emailStaff = staffList.find(s => (s.email || '').toLowerCase() === mention.toLowerCase())
    if (emailStaff) {
      if (!mentions.staffIds.includes(emailStaff.id)) mentions.staffIds.push(emailStaff.id)
      continue
    }
    
    // Try name match (case-insensitive, flexible whitespace)
    const mentionNormalized = mention.toLowerCase().trim()
    const nameStaff = staffList.find(s => {
      const fullName = `${s.firstName} ${s.lastName}`.toLowerCase().trim()
      const firstLast = `${s.firstName}`.toLowerCase().trim()
      const lastFirst = `${s.lastName}`.toLowerCase().trim()
      return fullName === mentionNormalized || 
             fullName.includes(mentionNormalized) ||
             (mentionNormalized.includes(firstLast) && mentionNormalized.includes(lastFirst))
    })
    if (nameStaff && !mentions.staffIds.includes(nameStaff.id)) {
      mentions.staffIds.push(nameStaff.id)
    }
  }
  
  console.log('📧 Parsed mentions:', mentions)
  return mentions
}

export async function GET(request: NextRequest) {
  try {
    const access = await getAccessLevel()
    if (!access || !['admin', 'owner', 'wlg_admin'].includes(access)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // new | understood | actioned | archived
    const includeReplies = searchParams.get('includeReplies') === 'true'

    const where: any = {}
    if (status) where.status = status
    if (!includeReplies) where.parentId = null // Only top-level messages

    const messages = await prisma.wLGMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        replies: {
          orderBy: { createdAt: 'asc' },
          include: { creator: { select: { id: true, firstName: true, lastName: true } } }
        }
      }
    })

    return NextResponse.json(messages)
  } catch (error) {
    console.error('Error fetching messages:', error)
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await getAccessLevel()
    if (!access || !['admin', 'owner', 'wlg_admin'].includes(access)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { content, createdBy, createdByName, parentId, stockOrderId } = body

    if (!content || !createdBy || !createdByName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Fetch all staff for mention parsing
    const allStaff = await prisma.staff.findMany({
      select: { id: true, firstName: true, lastName: true, email: true }
    })

    // Parse mentions
    const mentions = parseMentions(content, allStaff)

    // Create message
    const message = await prisma.wLGMessage.create({
      data: {
        content,
        createdBy,
        createdByName,
        parentId: parentId || null,
        stockOrderId: stockOrderId || undefined,
        mentionedStaffIds: mentions.staffIds.length > 0 ? mentions.staffIds : undefined,
        mentionedOrders: mentions.orderNumbers.length > 0 ? mentions.orderNumbers : undefined
      },
      include: {
        replies: true
      }
    })

    // If this is a reply, notify the parent message's creator even if not mentioned
    if (parentId) {
      try {
        const parent = await prisma.wLGMessage.findUnique({
          where: { id: String(parentId) },
          select: { id: true, createdBy: true }
        })
        if (parent && parent.createdBy && parent.createdBy !== createdBy) {
          const parentCreator = await prisma.staff.findUnique({
            where: { id: parent.createdBy },
            select: { email: true, firstName: true, lastName: true }
          })
          const toEmail = parentCreator?.email
          if (toEmail) {
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.PRODUCTION_URL || 'https://caterstation1.vercel.app'
            await transporter.sendMail({
              from: process.env.EMAIL_USER,
              to: toEmail,
              subject: `WLG Comms: New reply from ${createdByName}`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #2563eb;">New Reply in WLG Comms</h2>
                  <p><strong>From:</strong> ${createdByName}</p>
                  <p><strong>Time:</strong> ${new Date().toLocaleString('en-NZ')}</p>
                  <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
                    <p style="white-space: pre-wrap;">${content}</p>
                  </div>
                  <a href="${appUrl}/wlg-comms" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 16px;">
                    View Thread
                  </a>
                </div>
              `
            })
          }
        }
      } catch (notifyErr) {
        console.error('❌ Failed to send reply notification:', notifyErr)
      }
    }

    // Send email notifications to mentioned staff
    if (mentions.staffIds.length > 0) {
      console.log('📧 Sending emails to mentioned staff:', mentions.staffIds)
      const mentionedStaff = allStaff.filter(s => mentions.staffIds.includes(s.id))
      console.log('📧 Mentioned staff:', mentionedStaff.map(s => s.email))
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.PRODUCTION_URL || 'https://caterstation1.vercel.app'
      
      for (const staff of mentionedStaff) {
        try {
          console.log(`📧 Sending email to ${staff.email}...`)
          const info = await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: staff.email,
            subject: `WLG Comms: ${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2563eb;">New WLG Message</h2>
                <p><strong>From:</strong> ${createdByName}</p>
                <p><strong>Time:</strong> ${new Date().toLocaleString('en-NZ')}</p>
                <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
                  <p style="white-space: pre-wrap;">${content}</p>
                </div>
                <a href="${appUrl}/wlg-comms" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 16px;">
                  View Message
                </a>
              </div>
            `
          })
          console.log(`✅ Email sent to ${staff.email}:`, info.messageId)
        } catch (emailError) {
          console.error(`❌ Failed to send email to ${staff.email}:`, emailError)
        }
      }
    } else {
      console.log('📧 No staff mentions found, skipping email')
    }

    return NextResponse.json(message, { status: 201 })
  } catch (error) {
    console.error('Error creating message:', error)
    return NextResponse.json({ error: 'Failed to create message' }, { status: 500 })
  }
}

