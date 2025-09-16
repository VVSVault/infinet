'use client'

import { Message } from '@/lib/store'
import { MessageList } from '@/components/chat/MessageList'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Bot } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

interface SharedChat {
  id: string
  title: string
  messages: Message[]
  createdAt: Date
  expiresAt?: Date
}

export default function SharePage({ params }: { params: { id: string } }) {
  const [chat, setChat] = useState<SharedChat | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // In production, this would fetch from a database
    // For now, we'll try to get it from localStorage if available
    const loadSharedChat = () => {
      try {
        const stored = localStorage.getItem('infinet-chat-store')
        if (stored) {
          const data = JSON.parse(stored)
          const foundChat = data.state?.chats?.find((c: any) => c.id === params.id)
          if (foundChat) {
            setChat(foundChat)
          } else {
            setError('Chat not found')
          }
        } else {
          setError('Chat not found')
        }
      } catch (e) {
        setError('Failed to load chat')
      } finally {
        setLoading(false)
      }
    }

    loadSharedChat()
  }, [params.id])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <Bot className="h-12 w-12 animate-pulse mx-auto mb-4" />
          <p>Loading chat...</p>
        </div>
      </div>
    )
  }

  if (error || !chat) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Chat Not Found</h1>
          <p className="text-muted-foreground mb-6">
            {error || 'This chat may have expired or been deleted.'}
          </p>
          <Link href="/">
            <Button>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go to Home
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
              </Link>
              <div>
                <h1 className="font-semibold">{chat.title}</h1>
                <p className="text-sm text-muted-foreground">
                  Shared conversation (read-only)
                </p>
              </div>
            </div>
            <Link href="/sign-up">
              <Button>Start Your Own Chat</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-4xl p-4">
        <div className="rounded-lg border bg-card">
          <MessageList messages={chat.messages} />
        </div>

        <div className="mt-8 text-center">
          <p className="text-muted-foreground mb-4">
            Want to continue this conversation or start your own?
          </p>
          <Link href="/sign-up">
            <Button size="lg">
              <Bot className="mr-2 h-5 w-5" />
              Get Started with Infinet
            </Button>
          </Link>
        </div>
      </main>
    </div>
  )
}