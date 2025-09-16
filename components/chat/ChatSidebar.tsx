'use client'

import { useChatStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Plus,
  Search,
  MessageSquare,
  Folder,
  X,
  MoreVertical,
  Trash,
  Edit,
} from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

interface ChatSidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function ChatSidebar({ isOpen, onClose }: ChatSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [chatToDelete, setChatToDelete] = useState<string | null>(null)
  const [editingChatId, setEditingChatId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')

  const {
    chats,
    projects,
    currentChatId,
    createChat,
    deleteChat,
    setCurrentChat,
    updateChatTitle,
    searchChats,
  } = useChatStore()

  const filteredChats = searchQuery ? searchChats(searchQuery) : chats

  const handleDeleteChat = () => {
    if (chatToDelete) {
      deleteChat(chatToDelete)
      setChatToDelete(null)
      setDeleteDialogOpen(false)
    }
  }

  const handleStartEdit = (chatId: string, currentTitle: string) => {
    setEditingChatId(chatId)
    setEditingTitle(currentTitle)
  }

  const handleSaveEdit = () => {
    if (editingChatId && editingTitle.trim()) {
      updateChatTitle(editingChatId, editingTitle.trim())
      setEditingChatId(null)
      setEditingTitle('')
    }
  }

  const handleCancelEdit = () => {
    setEditingChatId(null)
    setEditingTitle('')
  }

  const handleNewChat = () => {
    const newChatId = createChat()
    setCurrentChat(newChatId)
  }

  // Group chats by project
  const chatsByProject = filteredChats.reduce((acc, chat) => {
    const key = chat.projectId || 'default'
    if (!acc[key]) acc[key] = []
    acc[key].push(chat)
    return acc
  }, {} as Record<string, typeof chats>)

  return (
    <>
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-72 bg-background border-r transition-transform lg:relative lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex h-14 items-center justify-between border-b px-4">
            <span className="font-semibold">Chats</span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleNewChat}
                title="New Chat"
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="lg:hidden"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="p-4">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search chats..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          <ScrollArea className="flex-1 px-4">
            <div className="space-y-4 pb-4">
              {Object.entries(chatsByProject).map(([projectId, projectChats]) => {
                const project = projects.find((p) => p.id === projectId)

                return (
                  <div key={projectId}>
                    {project && (
                      <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                        <Folder className="h-3 w-3" />
                        <span>{project.name}</span>
                      </div>
                    )}

                    <div className="space-y-1">
                      {projectChats.map((chat) => (
                        <div
                          key={chat.id}
                          className={cn(
                            'group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent cursor-pointer',
                            currentChatId === chat.id && 'bg-accent'
                          )}
                          onClick={() => setCurrentChat(chat.id)}
                        >
                          <MessageSquare className="h-4 w-4 flex-shrink-0" />

                          {editingChatId === chat.id ? (
                            <Input
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              onBlur={handleSaveEdit}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveEdit()
                                if (e.key === 'Escape') handleCancelEdit()
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="h-6 px-1"
                              autoFocus
                            />
                          ) : (
                            <span className="flex-1 truncate text-sm">
                              {chat.title}
                            </span>
                          )}

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreVertical className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleStartEdit(chat.id, chat.title)
                                }}
                              >
                                <Edit className="mr-2 h-4 w-4" />
                                Rename
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setChatToDelete(chat.id)
                                  setDeleteDialogOpen(true)
                                }}
                                className="text-destructive"
                              >
                                <Trash className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        </div>
      </div>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Chat</DialogTitle>
          </DialogHeader>
          <p>Are you sure you want to delete this chat? This action cannot be undone.</p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteChat}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}