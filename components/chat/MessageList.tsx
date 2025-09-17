'use client'

import { Message } from '@/lib/store'
import { ScrollArea } from '@/components/ui/scroll-area'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { useEffect, useRef, useState } from 'react'
import { User, Bot, Copy, Check, Download, Maximize2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import Image from 'next/image'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface MessageListProps {
  messages: Message[]
}

export function MessageList({ messages }: MessageListProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [expandedImage, setExpandedImage] = useState<string | null>(null)

  useEffect(() => {
    // Auto scroll to bottom when new messages arrive
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
    }
  }, [messages])

  const copyToClipboard = async (content: string, messageId: string) => {
    await navigator.clipboard.writeText(content)
    setCopiedId(messageId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const downloadImage = (dataUrl: string, index: number) => {
    const link = document.createElement('a')
    link.href = dataUrl
    link.download = `generated-image-${Date.now()}-${index}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
      {messages.length === 0 ? (
        <div className="flex h-full items-center justify-center">
          <div className="text-center text-muted-foreground">
            <Bot className="mx-auto h-12 w-12 mb-4" />
            <p>Start a conversation by typing a message below</p>
          </div>
        </div>
      ) : (
        <div className="space-y-6 max-w-4xl mx-auto py-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                'flex gap-3',
                message.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              {message.role !== 'user' && (
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center">
                    <Bot className="h-4 w-4" />
                  </div>
                </div>
              )}

              <div className={cn(
                'flex flex-col space-y-2',
                message.role === 'user' ? 'max-w-[70%]' : 'max-w-[85%]'
              )}>
                <div className={cn(
                  'rounded-lg px-4 py-3',
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground ml-auto'
                    : 'bg-muted'
                )}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium opacity-70">
                      {message.role === 'user' ? 'You' : 'Infinet'}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(message.content, message.id)}
                      className={cn(
                        "h-6 px-2 ml-2",
                        message.role === 'user' ? 'hover:bg-primary/80' : ''
                      )}
                    >
                      {copiedId === message.id ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>

                <div className={cn(
                  message.role === 'user'
                    ? "text-primary-foreground"
                    : "prose prose-sm dark:prose-invert max-w-none"
                )}>
                  {message.type === 'image' && message.images ? (
                    <div className="space-y-3">
                      <p className="text-sm mb-2">{message.content}</p>
                      <div className={cn(
                        "grid gap-3",
                        message.images.length === 1 ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"
                      )}>
                        {message.images.map((image, index) => (
                          <div key={index} className="relative group">
                            <div className="relative aspect-square w-full max-w-md overflow-hidden rounded-lg border">
                              <img
                                src={image}
                                alt={`Generated image ${index + 1}`}
                                className="object-cover w-full h-full"
                              />
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => setExpandedImage(image)}
                                >
                                  <Maximize2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => downloadImage(image, index)}
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      {message.metadata?.prompt && (
                        <p className="text-xs opacity-60 mt-2">
                          Model: {message.metadata.model || 'venice-sd35'}
                        </p>
                      )}
                    </div>
                  ) : (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        code({ node, className, children, ...props }) {
                          const match = /language-(\w+)/.exec(className || '')
                          const inline = !match
                          return !inline ? (
                            <SyntaxHighlighter
                              style={oneDark as any}
                              language={match[1]}
                              PreTag="div"
                              {...props}
                            >
                              {String(children).replace(/\n$/, '')}
                            </SyntaxHighlighter>
                          ) : (
                            <code className={className} {...props}>
                              {children}
                            </code>
                          )
                        },
                      }}
                    >
                      {message.content || '_Thinking..._'}
                    </ReactMarkdown>
                  )}
                </div>
                </div>
              </div>

              {message.role === 'user' && (
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                    <User className="h-4 w-4 text-primary-foreground" />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!expandedImage} onOpenChange={() => setExpandedImage(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Image Preview</DialogTitle>
          </DialogHeader>
          {expandedImage && (
            <div className="relative w-full">
              <img
                src={expandedImage}
                alt="Expanded view"
                className="w-full h-auto rounded-lg"
              />
              <Button
                className="absolute top-2 right-2"
                size="sm"
                variant="secondary"
                onClick={() => downloadImage(expandedImage, 0)}
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </ScrollArea>
  )
}