'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import { signIn, useSession } from 'next-auth/react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const { toast } = useToast()
  const { status, data } = useSession()

  // If we already have a session (e.g., after redirect loop), push user off /login immediately
  useEffect(() => {
    if (status === 'authenticated') {
      const rawParam = (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('callbackUrl')) || undefined
      const callbackUrl = rawParam ? (() => {
        try {
          const decoded = decodeURIComponent(rawParam)
          return decoded.startsWith('/') ? decoded : undefined
        } catch { return undefined }
      })() : undefined
      const accessLevel = (data as any)?.user?.accessLevel
      const fallback = accessLevel === 'pricing_lab' ? '/pricing-lab' : accessLevel === 'basic' ? '/realtime-orders' : (accessLevel === 'wlg_team' || accessLevel === 'wlg_admin') ? '/wlg-calendar' : '/dashboard'
      // Hard redirect to ensure middleware gets a fresh request with cookies
      if (typeof window !== 'undefined') {
        window.location.replace(callbackUrl && callbackUrl !== '/' ? callbackUrl : fallback)
      }
    }
  }, [status, data])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const rawParam = (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('callbackUrl')) || undefined
      // Decode and validate callbackUrl: must be a relative path starting with '/'
      const callbackUrl = rawParam ? (() => {
        try {
          const decoded = decodeURIComponent(rawParam)
          return decoded.startsWith('/') ? decoded : undefined
        } catch {
          return undefined
        }
      })() : undefined

      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
        callbackUrl, // passed for consistency; we handle client redirect after session is ready
      })

      if (result?.error) {
        throw new Error(result.error)
      }
      
      toast({
        title: 'Success',
        description: 'You have been logged in successfully',
      })
      
      // Wait until session cookie is readable before redirecting (prevents bounce back to /login)
      try {
        const start = Date.now()
        let sessionOk = false
        while (Date.now() - start < 1500 && !sessionOk) {
          // short delay between checks
          await new Promise(r => setTimeout(r, 100))
          const res = await fetch('/api/auth/session', { cache: 'no-store' })
          if (res.ok) {
            const data = await res.json().catch(() => ({}))
            if (data?.user) {
              sessionOk = true
              // Prefer callbackUrl if provided (and not '/')
              const redirectTo = callbackUrl && callbackUrl !== '/' ? callbackUrl : undefined
              const accessLevel = data?.user?.accessLevel || data?.accessLevel
              const fallback = accessLevel === 'pricing_lab' ? '/pricing-lab' : accessLevel === 'basic' ? '/realtime-orders' : (accessLevel === 'wlg_team' || accessLevel === 'wlg_admin') ? '/wlg-calendar' : '/dashboard'
              // Use hard redirect to guarantee middleware sees session cookie
              if (typeof window !== 'undefined') {
                window.location.replace(redirectTo || fallback)
              }
              return
            }
          }
        }
        // Fallback if session not readable in time
        if (typeof window !== 'undefined') {
          window.location.replace(callbackUrl && callbackUrl !== '/' ? callbackUrl : '/dashboard')
        }
      } catch {
        if (typeof window !== 'undefined') {
          window.location.replace(callbackUrl && callbackUrl !== '/' ? callbackUrl : '/dashboard')
        }
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Login failed',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md space-y-8 rounded-lg border p-6 shadow-md">
        <div className="text-center">
          <h1 className="text-2xl font-bold">CaterStation Login</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter your credentials to access your account
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="Enter your email"
              />
            </div>
            
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Enter your password"
              />
            </div>
          </div>
          
          <Button
            type="submit"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? 'Logging in...' : 'Login'}
          </Button>
        </form>
      </div>
    </div>
  )
} 