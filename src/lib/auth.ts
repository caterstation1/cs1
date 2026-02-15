import { prisma } from './prisma'
import bcryptjs from 'bcryptjs'
import { sign, verify } from 'jsonwebtoken'
import { randomBytes } from 'crypto'
import nodemailer from 'nodemailer'
import fs from 'fs/promises'
import path from 'path'
import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'

// Create a transporter using Gmail SMTP
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD // Use App Password from Gmail
  }
})

// Auth secret - use NEXTAUTH_SECRET consistently (fallback to JWT_SECRET for backward compat)
const AUTH_SECRET = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || 'your-secret-key'

// NextAuth configuration
export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const staff = await prisma.staff.findUnique({
          where: { email: credentials.email as string }
        })

        if (!staff || !staff.password) {
          return null
        }

        let isValid = false
        try {
          isValid = await comparePasswords(credentials.password as string, staff.password)
        } catch {}
        // Backward-compat: allow plaintext match if DB stored un-hashed password
        if (!isValid && credentials.password === staff.password) {
          isValid = true
          console.warn('⚠️ Plaintext password match used for staff:', staff.email)
        }

        if (!isValid) {
          return null
        }

        // Update last login
        await prisma.staff.update({
          where: { id: staff.id },
          data: { lastLogin: new Date() }
        })

        return {
          id: staff.id,
          email: staff.email,
          name: `${staff.firstName} ${staff.lastName}`,
          accessLevel: staff.accessLevel
        }
      }
    })
  ],
  secret: AUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.accessLevel = (user as any).accessLevel
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.accessLevel = token.accessLevel as string
      }
      return session
    }
  }
}

// Generate a random token for password reset
export function generateResetToken(): string {
  return randomBytes(32).toString('hex')
}

// Hash a password
export async function hashPassword(password: string): Promise<string> {
  return bcryptjs.hash(password, 10)
}

// Compare a password with a hash
export async function comparePasswords(password: string, hash: string): Promise<boolean> {
  return bcryptjs.compare(password, hash)
}

// Generate a JWT token
export function generateToken(userId: string, email: string, accessLevel: string): string {
  return sign(
    { userId, email, accessLevel },
    AUTH_SECRET,
    { expiresIn: '7d' }
  )
}

// Verify a JWT token
export function verifyToken(token: string): any {
  try {
    return verify(token, AUTH_SECRET)
  } catch (error) {
    return null
  }
}

// Send a login invitation email
export async function sendLoginInvitation(staffId: string): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('Finding staff member with ID:', staffId)
    const staff = await prisma.staff.findUnique({
      where: { id: staffId }
    })

    if (!staff) {
      console.log('Staff member not found with ID:', staffId)
      return { success: false, error: 'Staff member not found' }
    }

    console.log('Found staff member:', staff.email)

    // Generate a reset token
    const resetToken = generateResetToken()
    const resetTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    console.log('Generated reset token:', resetToken)
    console.log('Token expiry:', resetTokenExpiry)

    // Update the staff record with the reset token
    try {
      await prisma.staff.update({
        where: { id: staffId },
        data: {
          resetToken,
          resetTokenExpiry
        }
      })
      console.log('Successfully updated staff record with reset token')
    } catch (updateError) {
      console.error('Error updating staff record:', updateError)
      return { success: false, error: 'Failed to update staff record' }
    }

    // Generate the reset link using the best available public URL
    const publicBaseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXTAUTH_URL ||
      process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}` ||
      'http://localhost:3000'
    const resetLink = `${publicBaseUrl}/reset-password?token=${resetToken}`
    console.log('Reset link:', resetLink)
    
    // Send the email using Nodemailer
    try {
      if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
        console.warn('Email credentials not found in environment variables')
        // For development, we'll still return success
        return { success: true }
      }

      // Determine if WLG staff (keep existing email), otherwise use AKL-specific copy + attachment
      const isWlg = staff.accessLevel === 'wlg_team' || staff.accessLevel === 'wlg_admin'

      // Default (WLG or legacy) email HTML
      const defaultHtml = `
          <h1>Welcome to CaterStation!</h1>
          <p>Hello ${staff.firstName},</p>
          <p>You've been invited to set up your CaterStation account. Click the link below to set your password:</p>
          <p><a href="${resetLink}">Set Up Account</a></p>
          <p>This link will expire in 24 hours.</p>
          <p>If you didn't request this invitation, please ignore this email.</p>
        `

      // AKL-specific email HTML
      const aklHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <p>Hi ${staff.firstName}</p>
          <p>Please see the link below to generate a new password.</p>
          <p><a href="${resetLink}" style="color: #2563eb; text-decoration: underline;">Create your password</a></p>
          <p>Please also fill out this link <a href="https://b8lphoy2f40.typeform.com/to/TTJw3LGb" style="color: #2563eb; text-decoration: underline;">https://b8lphoy2f40.typeform.com/to/TTJw3LGb</a> so we can load you into our payroll system.</p>
          <p>Attached you will find a brief CS introduction manual - please take a minute to read through.</p>
          <p>Thanks again.</p>
        </div>
      `

      // Attempt to attach AKL manual PDF (best-effort)
      let attachments: { filename: string; content: Buffer; contentType: string }[] | undefined
      if (!isWlg) {
        const manualPath = path.join(process.cwd(), 'public', 'docs', 'cs-introduction-manual.pdf')
        try {
          const manualBuffer = await fs.readFile(manualPath)
          attachments = [{
            filename: 'CS-Introduction-Manual.pdf',
            content: manualBuffer,
            contentType: 'application/pdf'
          }]
          console.log('📎 Added CS Introduction Manual attachment from:', manualPath)
        } catch (pdfErr) {
          console.warn('⚠️ CS Introduction Manual PDF not found. Expected at:', manualPath)
        }
      }

      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: staff.email,
        subject: 'Set Up Your CaterStation Account',
        html: isWlg ? defaultHtml : aklHtml,
        attachments
      })
      
      console.log('Successfully sent invitation email')
      return { success: true }
    } catch (emailError) {
      console.error('Error sending email:', emailError)
      // Even if email fails, we'll still return success since the token is set
      // The reset link is logged for development
      return { success: true }
    }
  } catch (error) {
    console.error('Error in sendLoginInvitation:', error)
    return { success: false, error: 'Failed to send login invitation' }
  }
} 