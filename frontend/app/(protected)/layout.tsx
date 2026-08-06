'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isLoggedIn, getCurrentUser } from '@/lib/auth'
import { useApp } from '@/lib/AppContext'
import { Header } from '@/components/layout/Header'
import { BottomNav } from '@/components/layout/BottomNav'
import { FullPageLoader } from '@/components/ui/spinner'

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { setUser } = useApp()
  const [authChecked, setAuthChecked] = useState(false)
  const [authenticated, setAuthenticated] = useState(false)

  useEffect(() => {
    const loggedIn = isLoggedIn()
    setAuthenticated(loggedIn)
    setAuthChecked(true)

    if (!loggedIn) {
      router.replace('/login')
      return
    }

    const user = getCurrentUser()
    if (user) {
      setUser(user)
    }
  }, [router, setUser])

  if (!authChecked) {
    return <FullPageLoader label="Checking your session…" />
  }

  if (!authenticated) {
    return <FullPageLoader label="Redirecting to sign in…" />
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <Header />
      <main className="flex-1 overflow-y-auto pb-20 sm:pb-0">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}
