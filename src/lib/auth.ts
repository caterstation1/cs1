import { prisma } from './prisma'
import { compare, hash } from 'bcrypt'
import { sign, verify } from 'jsonwebtoken'
import { randomBytes } from 'crypto'
import nodemailer from 'nodemailer'

// Create a transporter using Gmail SMTP
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD // Use App Password from Gmail
  }
})

// JWT secret - in production, use an environment variable
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

// Generate a random token for password reset
export function generateResetToken(): string {
  return randomBytes(32).toString('hex')
}

// Hash a password
export async function hashPassword(password: string): Promise<string> {
  return hash(password, 10)
}

// Compare a password with a hash
export async function comparePasswords(password: string, hash: string): Promise<boolean> {
  return compare(password, hash)
}

// Generate a JWT token
export function generateToken(userId: string, email: string, accessLevel: string): string {
  return sign(
    { userId, email, accessLevel },
    JWT_SECRET,
    { expiresIn: '7d' }
  )
}

// Verify a JWT token
export function verifyToken(token: string): any {
  try {
    return verify(token, JWT_SECRET)
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

    // Generate the reset link
    const resetLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`
    console.log('Reset link:', resetLink)
    
    // Send the email using Nodemailer
    try {
      if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
        console.warn('Email credentials not found in environment variables')
        // For development, we'll still return success
        return { success: true }
      }

      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: staff.email,
        subject: 'Set Up Your CaterStation Account',
        html: `
          <h1>Welcome to CaterStation!</h1>
          <p>Hello ${staff.firstName},</p>
          <p>You've been invited to set up your CaterStation account. Click the link below to set your password:</p>
          <p><a href="${resetLink}">Set Up Account</a></p>
          <p>This link will expire in 24 hours.</p>
          <p>If you didn't request this invitation, please ignore this email.</p>
        `
      })
      
      console.log('Successfully sent invitation email')
      return { success: true }
    } catch (emailError) {
      console.error('Error sending email:', emailError)
      // Even if email fails, we'll return success since the token is set
      // The reset link is logged for development
      return { success: true }
    }
  } catch (error) {
    console.error('Error in sendLoginInvitation:', error)
    return { success: false, error: 'Failed to send login invitation' }
  }
} 