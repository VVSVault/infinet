'use client'

import { useState, useRef, useEffect } from 'react'
import { useChatStore } from '@/lib/store'
import { MessageList } from './MessageList'
import { ShareDialog } from './ShareDialog'
import { ImageGenerator } from './ImageGenerator'
import { FileUploader } from './FileUploader'
import { UpgradePrompt } from './UpgradePrompt'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Send, StopCircle, Loader2, Share2, Trash2, ImageIcon, Paperclip } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import Link from 'next/link'
import { cycleLoadingMessages } from '@/lib/loading-messages'

export function ChatInterface() {
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [abortController, setAbortController] = useState<AbortController | null>(null)
  const [shareDialogOpen, setShareDialogOpen] = useState(false)
  const [imageGeneratorOpen, setImageGeneratorOpen] = useState(false)
  const [imageGeneratorPrompt, setImageGeneratorPrompt] = useState('')
  const [fileUploaderOpen, setFileUploaderOpen] = useState(false)
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false)
  const [tokenInfo, setTokenInfo] = useState<{ tier?: string; limit?: number; used?: number }>({})
  const [loadingMessage, setLoadingMessage] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { toast } = useToast()

  const {
    getCurrentChat,
    addMessage,
    createChat,
    currentChatId,
    isGenerating,
    setIsGenerating,
  } = useChatStore()

  const currentChat = getCurrentChat()

  // Effect to cycle through loading messages
  useEffect(() => {
    if (isGenerating || isLoading) {
      const messageGenerator = cycleLoadingMessages()
      setLoadingMessage(messageGenerator.next().value || '')

      const interval = setInterval(() => {
        setLoadingMessage(messageGenerator.next().value || '')
      }, 1000) // Change message every 1 second

      return () => clearInterval(interval)
    } else {
      setLoadingMessage('')
    }
  }, [isGenerating, isLoading])

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()

    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput('')

    // Check if user wants to generate an image
    const imageGenerationPhrases = [
      'generate an image',
      'generate me an image',
      'create an image',
      'create me an image',
      'make an image',
      'make me an image',
      'draw',
      'generate image',
      'create image'
    ]

    const lowerMessage = userMessage.toLowerCase()
    const isImageRequest = imageGenerationPhrases.some(phrase => lowerMessage.startsWith(phrase))

    if (isImageRequest) {
      // Extract the actual prompt (remove the trigger phrase)
      let imagePrompt = userMessage
      for (const phrase of imageGenerationPhrases) {
        if (lowerMessage.startsWith(phrase)) {
          imagePrompt = userMessage.substring(phrase.length).trim()
          // Remove "of" or ":" if they start the prompt
          imagePrompt = imagePrompt.replace(/^(of|:)\s*/i, '')
          break
        }
      }

      // Open image generator with the prompt
      if (imagePrompt) {
        setImageGeneratorOpen(true)
        // We'll need to pass the prompt to the image generator
        // For now, let's store it in a state
        setImageGeneratorPrompt(imagePrompt)
      }
      return
    }

    setIsLoading(true)
    setIsGenerating(true)

    // Create new chat if needed
    let chatId = currentChatId
    if (!chatId) {
      chatId = createChat()
    }

    // Add user message
    addMessage(chatId, {
      role: 'user',
      content: userMessage,
    })

    // Create temporary message for streaming
    const tempMessageId = crypto.randomUUID()
    addMessage(chatId, {
      role: 'assistant',
      content: '',
    })

    const controller = new AbortController()
    setAbortController(controller)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            ...currentChat?.messages.filter(m => m.content) || [],
            { role: 'user', content: userMessage }
          ],
          streaming: true,
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        if (response.status === 402 || response.status === 429) {
          // Payment required or rate limit - user has hit their token limit
          const errorData = await response.json()

          // Remove the last empty assistant message we added
          const store = useChatStore.getState()
          const chat = store.chats.find(c => c.id === chatId)
          if (chat && chat.messages.length > 0) {
            const lastMessage = chat.messages[chat.messages.length - 1]
            if (lastMessage.role === 'assistant' && !lastMessage.content) {
              store.chats = store.chats.map(c =>
                c.id === chatId
                  ? { ...c, messages: c.messages.slice(0, -1) }
                  : c
              )
            }
          }

          // Show upgrade prompt in the chat
          setShowUpgradePrompt(true)
          setTokenInfo({
            tier: errorData.subscription?.tier || 'free',
            limit: errorData.subscription?.tokenLimit || 500,
            used: errorData.subscription?.tokenLimit || 500
          })

          setIsLoading(false)
          setIsGenerating(false)
          return
        }
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let accumulatedContent = ''
      let buffer = ''

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          buffer += chunk
          const lines = buffer.split('\n')
          buffer = lines.pop() || '' // Keep the last incomplete line in the buffer

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim()
              if (data === '[DONE]') {
                break
              }
              if (!data) continue

              try {
                const parsed = JSON.parse(data)
                if (parsed.content) {
                  accumulatedContent += parsed.content
                  // Update the last assistant message with smoother streaming
                  const store = useChatStore.getState()
                  const chat = store.chats.find(c => c.id === chatId)
                  if (chat && chat.messages.length > 0) {
                    const lastMessage = chat.messages[chat.messages.length - 1]
                    if (lastMessage.role === 'assistant') {
                      // Use requestAnimationFrame for smoother updates
                      requestAnimationFrame(() => {
                        store.chats = store.chats.map(c =>
                          c.id === chatId
                            ? {
                                ...c,
                                messages: c.messages.map((m, idx) =>
                                  idx === c.messages.length - 1
                                    ? { ...m, content: accumulatedContent }
                                    : m
                                )
                              }
                            : c
                        )
                      })
                    }
                  }
                }
              } catch (e) {
                console.error('Error parsing SSE data:', e, 'Data:', data)
              }
            }
          }
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        toast({
          title: 'Generation stopped',
          description: 'The message generation was stopped.',
        })
      } else {
        console.error('Chat error:', error)
        toast({
          title: 'Error',
          description: 'Failed to get response. Please try again.',
          variant: 'destructive',
        })
      }
    } finally {
      setIsLoading(false)
      setIsGenerating(false)
      setAbortController(null)
    }
  }

  const handleStop = () => {
    if (abortController) {
      abortController.abort()
      setAbortController(null)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleImageGenerated = (images: string[], prompt: string, metadata?: any) => {
    // Create new chat if needed
    let chatId = currentChatId
    if (!chatId) {
      chatId = createChat()
    }

    // Add the image generation request as a user message
    addMessage(chatId, {
      role: 'user',
      content: `Generate image: ${prompt}`,
      type: 'text',
    })

    // Add the generated images as an assistant message
    addMessage(chatId, {
      role: 'assistant',
      content: `Generated ${images.length} image${images.length > 1 ? 's' : ''} for: "${prompt}"`,
      type: 'image',
      images: images.map(img => `data:image/png;base64,${img}`),
      metadata: metadata,
    })

    toast({
      title: 'Images Generated!',
      description: `Successfully created ${images.length} image${images.length > 1 ? 's' : ''}`,
    })
  }

  const handleFileUploaded = (file: File, content: string) => {
    // Create new chat if needed
    let chatId = currentChatId
    if (!chatId) {
      chatId = createChat()
    }

    // Determine file type and prepare message
    const fileType = file.type.startsWith('image/') ? 'image' : 'file'
    const fileName = file.name

    // Add message with file attachment
    addMessage(chatId, {
      role: 'user',
      content: `[Attached file: ${fileName}]\n\n${fileType === 'image' ? 'Please analyze this image.' : 'Please analyze this file.'}`,
      type: fileType === 'image' ? 'image' : 'text',
      images: fileType === 'image' ? [content] : undefined,
      metadata: {
        fileName,
        fileSize: file.size,
        fileType: file.type,
      },
    })

    toast({
      title: 'File Attached',
      description: `${fileName} has been added to the conversation`,
    })
  }

  useEffect(() => {
    textareaRef.current?.focus()
  }, [currentChatId])

  // Handle loading state to prevent hydration mismatch
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted || !currentChat) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Select or create a chat to get started</p>
          <Button
            onClick={() => createChat()}
            className="mt-4"
          >
            Start New Chat
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col relative">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <h2 className="font-semibold">{currentChat.title}</h2>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setImageGeneratorOpen(true)}
            title="Generate Image"
          >
            <ImageIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShareDialogOpen(true)}
            disabled={currentChat.messages.length === 0}
            title="Share Chat"
          >
            <Share2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <MessageList messages={currentChat.messages} loadingMessage={loadingMessage} />

      {showUpgradePrompt && (
        <UpgradePrompt
          currentTier={tokenInfo.tier}
          tokenLimit={tokenInfo.limit}
          tokensUsed={tokenInfo.used}
        />
      )}

      <div className="border-t p-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              onClick={() => {
                setImageGeneratorPrompt('')
                setImageGeneratorOpen(true)
              }}
              variant="outline"
              size="icon"
              title="Generate Image"
              disabled={isLoading}
            >
              <ImageIcon className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              onClick={() => setFileUploaderOpen(true)}
              variant="outline"
              size="icon"
              title="Attach File"
              disabled={isLoading}
            >
              <Paperclip className="h-4 w-4" />
            </Button>
          </div>
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder='Ask anything privately'
            className="min-h-[80px] resize-none"
            disabled={isLoading}
          />
          {isLoading ? (
            <Button
              type="button"
              onClick={handleStop}
              variant="destructive"
              size="icon"
            >
              <StopCircle className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="submit"
              disabled={!input.trim()}
              size="icon"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          )}
        </form>
      </div>

      <ShareDialog
        chat={currentChat}
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
      />

      <ImageGenerator
        open={imageGeneratorOpen}
        onOpenChange={(open) => {
          setImageGeneratorOpen(open)
          if (!open) setImageGeneratorPrompt('')
        }}
        onGenerated={handleImageGenerated}
        initialPrompt={imageGeneratorPrompt}
      />

      <FileUploader
        open={fileUploaderOpen}
        onOpenChange={setFileUploaderOpen}
        onFileUploaded={handleFileUploaded}
      />
    </div>
  )
}