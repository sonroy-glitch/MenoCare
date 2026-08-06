'use client'

import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  ClipboardList,
  BarChart3,
  AlertCircle,
  HelpCircle,
  MessageCircle,
  Newspaper,
} from 'lucide-react'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/medical-profile', label: 'Medical', icon: ClipboardList },
  { href: '/symptom-logger', label: 'Logger', icon: BarChart3 },
  { href: '/alerts-center', label: 'Alerts', icon: AlertCircle },
  { href: '/faqs-community', label: 'FAQs', icon: HelpCircle },
  { href: '/ai-assistant', label: 'Assistant', icon: MessageCircle },
  { href: '/latest-news', label: 'News', icon: Newspaper },
]

export function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()

  return (
    <nav className="fixed sm:static bottom-0 left-0 right-0 bg-card border-t border-border">
      <div className="flex overflow-x-auto scrollbar-hide">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname.startsWith(item.href)

          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className={`flex-1 sm:flex-none flex flex-col items-center justify-center min-w-[60px] py-3 px-2 transition-colors ${
                isActive
                  ? 'text-primary bg-primary/10'
                  : 'text-foreground/60 hover:text-foreground'
              }`}
            >
              <Icon className="w-5 h-5 mb-1" />
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
