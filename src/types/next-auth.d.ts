import 'next-auth'

declare module 'next-auth' {
  interface User {
    id: string
    email: string
    name: string
    accessLevel: string
  }

  interface Session {
    user: User & {
      id: string
      accessLevel: string
    }
  }
} 