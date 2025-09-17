'use client'

import { useUser } from '@clerk/nextjs'
import { useEffect, useRef } from 'react'
import { useChatStore } from '@/lib/store'

export function UserStoreProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser()
  const lastUserId = useRef<string | null>(null)
  const hasInitialized = useRef(false)

  useEffect(() => {
    if (!isLoaded) return

    const currentUserId = user?.id || 'anonymous'

    // Store user ID for the store to use
    if (typeof window !== 'undefined') {
      (window as any).__clerk_user_id = currentUserId
      localStorage.setItem('clerk-user-id', currentUserId)
    }

    // Check if user changed
    if (hasInitialized.current && lastUserId.current !== currentUserId) {
      // User changed, clear the current store
      const store = useChatStore.getState()
      store.clearAllData()

      // Update the store's localStorage key
      const newKey = `infinet-chat-store-${currentUserId}`
      useChatStore.persist.setOptions({
        name: newKey,
      })

      // Rehydrate the store with user-specific data
      useChatStore.persist.rehydrate()
    }

    // If this is the first load and there's old generic data, migrate it
    if (!hasInitialized.current) {
      const oldData = localStorage.getItem('infinet-chat-store')
      const userSpecificKey = `infinet-chat-store-${currentUserId}`

      if (oldData && !localStorage.getItem(userSpecificKey)) {
        // Migrate old data to user-specific key
        localStorage.setItem(userSpecificKey, oldData)
        localStorage.removeItem('infinet-chat-store')
      }

      // Set the correct key and rehydrate
      useChatStore.persist.setOptions({
        name: userSpecificKey,
      })
      useChatStore.persist.rehydrate()
    }

    // Update the last user ID
    lastUserId.current = currentUserId
    hasInitialized.current = true
  }, [user?.id, isLoaded])

  return <>{children}</>
}