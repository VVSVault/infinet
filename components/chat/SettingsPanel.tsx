'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Settings, Crown, Zap, ExternalLink } from 'lucide-react'
import Link from 'next/link'

interface UsageData {
  subscription: {
    tier: string
    status: string
    periodStart: string
    periodEnd: string
  }
  usage: {
    tokensUsed: number
    tokenLimit: number | 'unlimited'
    tokensRemaining: number | 'unlimited'
    percentUsed: number
    totalRequests: number
  }
}

const TIER_DISPLAY: Record<string, { name: string; color: string }> = {
  free: { name: 'Free', color: 'text-muted-foreground' },
  starter: { name: 'Starter', color: 'text-blue-500' },
  premium: { name: 'Premium', color: 'text-purple-500' },
  limitless: { name: 'Limitless', color: 'text-amber-500' },
  trial: { name: 'Trial', color: 'text-green-500' },
  developer: { name: 'Developer', color: 'text-primary' },
}

export function SettingsPanel() {
  const [open, setOpen] = useState(false)
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(false)
  const [billingLoading, setBillingLoading] = useState(false)
  const { user } = useUser()

  const fetchUsage = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/user/usage')
      if (res.ok) {
        const data = await res.json()
        setUsage(data)
      }
    } catch (error) {
      console.error('Failed to fetch usage:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      fetchUsage()
    }
  }, [open])

  const tierInfo = usage ? TIER_DISPLAY[usage.subscription.tier] || TIER_DISPLAY.free : TIER_DISPLAY.free
  const isUnlimited = usage?.usage.tokenLimit === 'unlimited'
  const periodEnd = usage?.subscription.periodEnd
    ? new Date(usage.subscription.periodEnd).toLocaleDateString()
    : null
  const hasBilling = usage?.subscription.tier !== 'free' && usage?.subscription.tier !== 'developer'

  const handleManageBilling = async () => {
    setBillingLoading(true)
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        console.error('No portal URL returned:', data.error)
      }
    } catch (error) {
      console.error('Failed to open billing portal:', error)
    } finally {
      setBillingLoading(false)
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start gap-2"
        onClick={() => setOpen(true)}
      >
        <Settings className="h-4 w-4" />
        Settings
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Account Settings</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* User Info */}
            <div className="flex items-center gap-3">
              {user?.imageUrl && (
                <img
                  src={user.imageUrl}
                  alt="Profile"
                  className="h-10 w-10 rounded-full"
                />
              )}
              <div>
                <p className="font-medium">{user?.fullName || user?.username || 'User'}</p>
                <p className="text-sm text-muted-foreground">
                  {user?.emailAddresses?.[0]?.emailAddress}
                </p>
              </div>
            </div>

            {/* Subscription Tier */}
            <div className="rounded-lg border p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Crown className={`h-4 w-4 ${tierInfo.color}`} />
                  <span className="font-medium">Current Plan</span>
                </div>
                <span className={`font-semibold ${tierInfo.color}`}>
                  {tierInfo.name}
                </span>
              </div>
              {periodEnd && (
                <p className="text-xs text-muted-foreground">
                  Resets on {periodEnd}
                </p>
              )}
            </div>

            {/* Token Usage */}
            {usage && !loading && (
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-amber-500" />
                    <span className="font-medium">Token Usage</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {usage.usage.totalRequests} requests
                  </span>
                </div>

                {isUnlimited ? (
                  <p className="text-sm text-muted-foreground">
                    Unlimited tokens available
                  </p>
                ) : (
                  <>
                    <Progress value={usage.usage.percentUsed} className="h-2" />
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {usage.usage.tokensUsed.toLocaleString()} used
                      </span>
                      <span className="font-medium">
                        {(usage.usage.tokenLimit as number).toLocaleString()} limit
                      </span>
                    </div>
                    {usage.usage.percentUsed >= 80 && (
                      <p className="text-xs text-amber-500">
                        ⚠️ You've used {usage.usage.percentUsed}% of your monthly tokens
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            {loading && (
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground animate-pulse">
                  Loading usage data...
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-2">
              {usage?.subscription.tier !== 'limitless' && usage?.subscription.tier !== 'developer' && (
                <Link href="/pricing" onClick={() => setOpen(false)}>
                  <Button className="w-full gap-2">
                    <Crown className="h-4 w-4" />
                    Upgrade Plan
                  </Button>
                </Link>
              )}
              {hasBilling && (
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={handleManageBilling}
                  disabled={billingLoading}
                >
                  <ExternalLink className="h-4 w-4" />
                  {billingLoading ? 'Opening...' : 'Manage Billing'}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
