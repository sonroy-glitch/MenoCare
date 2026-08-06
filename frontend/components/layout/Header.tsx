'use client'

import React, { useState } from 'react'
import { LogOut, Menu, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { logout } from '@/lib/auth'
import { useApp } from '@/lib/AppContext'

export function Header() {
  const router = useRouter()
  const { user, setUser } = useApp()
  const [showMenu, setShowMenu] = useState(false)

  const handleLogout = () => {
    logout()
    setUser(null)
    router.push('/login')
  }

  return (
    <header className="sticky top-0 z-40 bg-card border-b border-border shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3">
            <img
              src="/menocare-logo.png"
              alt="MenoCare"
              className="h-14 w-28 object-contain"
            />
            <p className="hidden text-xs text-muted-foreground sm:block">Your menopause companion</p>
          </div>
        </div>

        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 hover:bg-background rounded-lg transition-colors"
          >
            {showMenu ? (
              <X className="w-5 h-5 text-foreground" />
            ) : (
              <Menu className="w-5 h-5 text-foreground" />
            )}
          </button>
          {showMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-card border border-border rounded-lg shadow-lg py-2">
              <div className="px-4 py-2 text-sm text-foreground/60 border-b border-border">
                {user?.name || 'User'}
              </div>
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-background flex items-center gap-2 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
