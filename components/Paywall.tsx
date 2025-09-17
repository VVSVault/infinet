'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertTriangle, CreditCard, Lock, Sparkles } from 'lucide-react'
import { useUser } from '@clerk/nextjs'

interface PaywallProps {
  reason?: 'no_subscription' | 'trial_expired' | 'limit_exceeded' | 'payment_failed'
  tokensUsed?: number
  tokenLimit?: number
  periodEnd?: Date
}

export function Paywall({
  reason = 'no_subscription',
  tokensUsed,
  tokenLimit,
  periodEnd
}: PaywallProps) {
  const router = useRouter()
  const { user } = useUser()
  const [daysRemaining, setDaysRemaining] = useState(0)

  useEffect(() => {
    if (periodEnd) {
      const days = Math.max(0, Math.ceil((new Date(periodEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      setDaysRemaining(days)
    }
  }, [periodEnd])

  const getTitle = () => {
    switch (reason) {
      case 'trial_expired':
        return 'Trial Expired'
      case 'limit_exceeded':
        return 'Token Limit Reached'
      case 'payment_failed':
        return 'Payment Failed'
      default:
        return 'Subscription Required'
    }
  }

  const getMessage = () => {
    switch (reason) {
      case 'trial_expired':
        return 'Your 3-day trial has ended. Subscribe to continue using Infinet.'
      case 'limit_exceeded':
        return `You've used all ${tokenLimit?.toLocaleString()} tokens this month. Upgrade or wait ${daysRemaining} days for reset.`
      case 'payment_failed':
        return 'Your payment method was declined. Please update your payment information to continue.'
      default:
        return 'Infinet requires a paid subscription. Choose a plan to get started.'
    }
  }

  const getIcon = () => {
    switch (reason) {
      case 'limit_exceeded':
        return <AlertTriangle className="h-12 w-12 text-yellow-500" />
      case 'payment_failed':
        return <CreditCard className="h-12 w-12 text-red-500" />
      default:
        return <Lock className="h-12 w-12 text-primary" />
    }
  }

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="max-w-lg w-full">
        <CardHeader>
          <div className="flex flex-col items-center text-center space-y-4">
            {getIcon()}
            <CardTitle className="text-2xl">{getTitle()}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-center text-muted-foreground">
            {getMessage()}
          </p>

          {reason === 'limit_exceeded' && tokensUsed && tokenLimit && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Tokens Used</span>
                <span className="font-semibold">{tokensUsed.toLocaleString()} / {tokenLimit.toLocaleString()}</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2">
                <div
                  className="bg-red-500 h-2 rounded-full"
                  style={{ width: '100%' }}
                />
              </div>
              {daysRemaining > 0 && (
                <p className="text-xs text-center text-muted-foreground">
                  Resets in {daysRemaining} days
                </p>
              )}
            </div>
          )}

          <div className="space-y-3">
            {reason === 'payment_failed' ? (
              <Button
                className="w-full"
                size="lg"
                onClick={() => router.push('/billing')}
              >
                <CreditCard className="mr-2 h-4 w-4" />
                Update Payment Method
              </Button>
            ) : (
              <>
                <Button
                  className="w-full"
                  size="lg"
                  onClick={() => router.push('/pricing')}
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  {reason === 'limit_exceeded' ? 'Upgrade Plan' : 'View Plans'}
                </Button>
                {reason === 'limit_exceeded' && (
                  <Button
                    className="w-full"
                    size="lg"
                    variant="outline"
                    onClick={() => router.push('/dashboard')}
                  >
                    View Usage Details
                  </Button>
                )}
              </>
            )}
          </div>

          <div className="text-center space-y-2">
            <p className="text-xs text-muted-foreground">
              No free tier available • Payment required for all features
            </p>
            <p className="text-xs text-muted-foreground">
              Questions? Contact support@infinet.ai
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}