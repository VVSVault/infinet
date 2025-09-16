'use client'

import { ChatInterface } from '@/components/chat/ChatInterface'
import { useChatStore } from '@/lib/store'
import { useEffect, useState } from 'react'

export default function ChatPage() {
  const { currentChatId, createChat, chats } = useChatStore()
  const [isInitialized, setIsInitialized] = useState(false)

  useEffect(() => {
    // Create a new chat if none exists
    if (chats.length === 0 && !currentChatId) {
      createChat()
    }
    setIsInitialized(true)
  }, [chats.length, currentChatId, createChat])

  // Don't render until client-side initialization is complete
  if (!isInitialized) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Loading chat...</p>
        </div>
      </div>
    )
  }

  return <ChatInterface />
}