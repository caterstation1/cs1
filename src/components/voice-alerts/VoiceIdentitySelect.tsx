'use client'

import { UserRound } from 'lucide-react'
import { useVoiceIdentity } from './useVoiceIdentity'

/**
 * Nav-bar picker for the name this screen answers to when voice alerts are sent.
 */
export function VoiceIdentitySelect({ className = '' }: { className?: string }) {
  const { identity, setIdentity, options, hydrated } = useVoiceIdentity()

  if (!hydrated || options.length === 0) return null

  return (
    <div
      className={`flex items-center gap-1.5 rounded-md border border-input bg-background px-2 h-8 ${className}`}
      title="Voice alerts addressed to this name play on this screen"
    >
      <UserRound className="h-4 w-4 text-muted-foreground" />
      <select
        aria-label="Voice alert identity"
        value={identity}
        onChange={(e) => setIdentity(e.target.value)}
        className="bg-transparent text-sm font-medium outline-none cursor-pointer pr-1"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  )
}
