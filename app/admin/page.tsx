'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ArrowLeft, Users, Activity, CreditCard, Zap, Search, RefreshCw } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import Link from 'next/link'

interface UserData {
  id: string
  email: string
  fullName: string
  firstName?: string
  lastName?: string
  createdAt: number
  lastSignInAt: number | null
  imageUrl?: string
  subscription: {
    tier: string
    status: string
    currentPeriodEnd?: string
  }
  usage: {
    totalRequests: number
    totalTokens: number
    lastActivity?: string
  }
}

interface Stats {
  totalUsers: number
  activeUsers: number
  paidUsers: number
  totalTokensUsed: number
}

export default function AdminPage() {
  const { user, isLoaded } = useUser()
  const router = useRouter()
  const { toast } = useToast()
  const [users, setUsers] = useState<UserData[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  // Admin emails - add your admin emails here
  const adminEmails = ['tannercarlson@vvsvault.com']

  useEffect(() => {
    if (isLoaded && !user) {
      router.push('/sign-in')
    } else if (isLoaded && user) {
      const userEmail = user.emailAddresses[0]?.emailAddress
      if (!adminEmails.includes(userEmail || '')) {
        toast({
          title: 'Access Denied',
          description: 'You do not have admin access',
          variant: 'destructive'
        })
        router.push('/chat')
      } else {
        fetchUsers()
      }
    }
  }, [isLoaded, user])

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/users')
      if (!response.ok) {
        throw new Error('Failed to fetch users')
      }
      const data = await response.json()
      setUsers(data.users)
      setStats(data.stats)
    } catch (error) {
      console.error('Error fetching users:', error)
      toast({
        title: 'Error',
        description: 'Failed to fetch user data',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (timestamp: number | string | null) => {
    if (!timestamp) return 'Never'
    const date = new Date(timestamp)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num)
  }

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'limitless': return 'bg-purple-600'
      case 'premium': return 'bg-blue-600'
      case 'starter': return 'bg-green-600'
      case 'free': return 'bg-gray-500'
      default: return 'bg-gray-500'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500'
      case 'canceled': return 'bg-red-500'
      case 'past_due': return 'bg-yellow-500'
      default: return 'bg-gray-500'
    }
  }

  const filteredUsers = users.filter(user =>
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.fullName.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (!isLoaded || loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading admin dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/chat">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Chat
                </Button>
              </Link>
              <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            </div>
            <Button onClick={fetchUsers} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(stats.totalUsers)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Users (7d)</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(stats.activeUsers)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Paid Users</CardTitle>
                <CreditCard className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(stats.paidUsers)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Tokens Used</CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(stats.totalTokensUsed)}</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Users</CardTitle>
            <CardDescription>
              Manage and monitor all registered users
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Search Bar */}
            <div className="flex items-center gap-4 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Users List */}
            <div className="space-y-4">
              {filteredUsers.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No users found</p>
              ) : (
                filteredUsers.map((user) => (
                  <div key={user.id} className="border rounded-lg p-4 hover:bg-accent/50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={user.imageUrl} />
                          <AvatarFallback>
                            {user.fullName.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{user.fullName || 'Unknown User'}</p>
                            <Badge className={getTierColor(user.subscription.tier)}>
                              {user.subscription.tier}
                            </Badge>
                            <Badge className={getStatusColor(user.subscription.status)} variant="outline">
                              {user.subscription.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                          <div className="flex gap-4 text-xs text-muted-foreground">
                            <span>Joined: {formatDate(user.createdAt)}</span>
                            <span>Last sign-in: {formatDate(user.lastSignInAt)}</span>
                            {user.usage.lastActivity && (
                              <span>Last active: {formatDate(user.usage.lastActivity)}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right space-y-1">
                        <p className="text-sm font-medium">{formatNumber(user.usage.totalTokens)} tokens</p>
                        <p className="text-xs text-muted-foreground">{user.usage.totalRequests} requests</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}