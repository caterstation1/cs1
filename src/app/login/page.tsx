'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import { signIn } from 'next-auth/react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const callbackUrl = (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('callbackUrl')) || undefined
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
        callbackUrl,
      })

      if (result?.error) {
        throw new Error(result.error)
      }
      
      toast({
        title: 'Success',
        description: 'You have been logged in successfully',
      })
      
      // Prefer callbackUrl if provided (and not '/')
      if (callbackUrl && callbackUrl !== '/') {
        router.replace(callbackUrl)
        return
      }
      // Otherwise fetch session and route by role
      try {
        // Ensure the session cookie is available
        await new Promise(r => setTimeout(r, 50))
        const res = await fetch('/api/auth/session')
        const data = await res.json().catch(() => ({}))
        const accessLevel = data?.user?.accessLevel || data?.accessLevel
        if (accessLevel === 'pricing_lab') router.replace('/pricing-lab')
        else if (accessLevel === 'basic') router.replace('/realtime-orders')
        else router.replace('/dashboard')
      } catch {
        router.replace('/dashboard')
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