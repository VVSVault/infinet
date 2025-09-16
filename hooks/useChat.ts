import { useState, useCallback } from 'react'
import { useChatStore } from '@/lib/store'
import { useToast } from '@/hooks/use-toast'

export function useChat() {
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()
  const {
    getCurrentChat,
    addMessage,
    createChat,
    currentChatId,
    setIsGenerating,
  } = useChatStore()

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return

    setIsLoading(true)
    setIsGenerating(true)

    let chatId = currentChatId
    if (!chatId) {
      chatId = createChat()
    }

    // Add user message
    addMessage(chatId, {
      role: 'user',
      content,
    })

    try {
      const currentChat = getCurrentChat()
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            ...(currentChat?.messages || []),
            { role: 'user', content }
          ],
          streaming: true,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      // Handle streaming response
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let assistantMessage = ''

      // Add empty assistant message
      addMessage(chatId, {
        role: 'assistant',
        content: '',
      })

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') {
                break
              }
              try {
                const parsed = JSON.parse(data)
                if (parsed.content) {
                  assistantMessage += parsed.content
                  // Update the assistant message in real-time
                  // This would need to be implemented in the store
                }
              } catch (e) {
                console.error('Error parsing SSE data:', e)
              }
            }
          }
        }
      }

      // Final update with complete message
      if (assistantMessage) {
        // Update the last assistant message with final content
        // This would need proper implementation in store
      }
    } catch (error) {
      console.error('Chat error:', error)
      toast({
        title: 'Error',
        description: 'Failed to send message. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
      setIsGenerating(false)
    }
  }, [currentChatId, createChat, addMessage, getCurrentChat, setIsGenerating, toast])

  return {
    sendMessage,
    isLoading,
  }
}