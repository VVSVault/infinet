'use client'

import { ChatSidebar } from '@/components/chat/ChatSidebar'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'
import { UserStoreProvider } from '@/components/providers/UserStoreProvider'
import { Menu } from 'lucide-react'
import { useState, useEffect } from 'react'
import { UserButton } from '@clerk/nextjs'

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Default to closed on mobile, open on desktop
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    // Open sidebar by default on desktop
    const handleResize = () => {
      if (window.innerWidth >= 1024) { // lg breakpoint
        setSidebarOpen(true)
      }
    }

    // Check initial size
    handleResize()

    // Listen for resize events
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <UserStoreProvider>
      <div className="flex h-[100dvh] bg-background">
        <ChatSidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <div className="flex flex-1 flex-col">
          <header className="flex h-14 items-center justify-between border-b px-4">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                <Menu className="h-5 w-5" />
              </Button>
              <span className="font-semibold">Infinet</span>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <UserButton />
            </div>
          </header>

          <main className="flex-1 overflow-hidden">
            {children}
          </main>
        </div>
      </div>
    </UserStoreProvider>
  )
}