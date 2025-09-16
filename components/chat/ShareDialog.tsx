'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { Copy, Mail, Link as LinkIcon, Check } from 'lucide-react'
import { Chat } from '@/lib/store'

interface ShareDialogProps {
  chat: Chat | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ShareDialog({ chat, open, onOpenChange }: ShareDialogProps) {
  const [copied, setCopied] = useState(false)
  const { toast } = useToast()

  if (!chat) return null

  // Generate a shareable URL (in production, this would create a real share link)
  const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/share/${chat.id}`

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      toast({
        title: 'Link copied!',
        description: 'The share link has been copied to your clipboard.',
      })
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      toast({
        title: 'Failed to copy',
        description: 'Please try copying the link manually.',
        variant: 'destructive',
      })
    }
  }

  const handleEmailShare = () => {
    const subject = encodeURIComponent(`Check out this chat: ${chat.title}`)
    const body = encodeURIComponent(
      `I wanted to share this interesting conversation with you:\n\n${shareUrl}`
    )
    window.open(`mailto:?subject=${subject}&body=${body}`)
  }

  const handleExportMarkdown = () => {
    const markdown = chat.messages
      .map((msg) => `**${msg.role === 'user' ? 'You' : 'Infinet'}:**\n${msg.content}\n`)
      .join('\n---\n\n')

    const blob = new Blob([markdown], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${chat.title.replace(/[^a-z0-9]/gi, '_')}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast({
      title: 'Chat exported',
      description: 'The chat has been exported as a Markdown file.',
    })
  }

  const handleExportJSON = () => {
    const json = JSON.stringify(chat, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${chat.title.replace(/[^a-z0-9]/gi, '_')}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast({
      title: 'Chat exported',
      description: 'The chat has been exported as a JSON file.',
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share Chat</DialogTitle>
          <DialogDescription>
            Share this conversation or export it for later use.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Share Link</label>
            <div className="flex items-center gap-2 mt-1">
              <Input value={shareUrl} readOnly className="flex-1" />
              <Button
                type="button"
                size="sm"
                onClick={handleCopyLink}
                className="px-3"
              >
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              onClick={handleEmailShare}
              className="justify-start"
            >
              <Mail className="mr-2 h-4 w-4" />
              Share via Email
            </Button>

            <Button
              variant="outline"
              onClick={handleExportMarkdown}
              className="justify-start"
            >
              <LinkIcon className="mr-2 h-4 w-4" />
              Export as Markdown
            </Button>

            <Button
              variant="outline"
              onClick={handleExportJSON}
              className="justify-start"
            >
              <LinkIcon className="mr-2 h-4 w-4" />
              Export as JSON
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}