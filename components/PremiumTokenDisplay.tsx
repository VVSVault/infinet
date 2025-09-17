'use client'

import { useTokenEstimation } from '@/hooks/useTokenEstimation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { AlertTriangle, TrendingUp, Calendar, Zap } from 'lucide-react'
import { formatTokenCount } from '@/lib/subscription-tiers'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

export function PremiumTokenDisplay() {
  const { usage, loading, getWarningMessage, getStatusColor } = useTokenEstimation()
  const router = useRouter()

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="p-4">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-secondary rounded w-1/3" />
            <div className="h-2 bg-secondary rounded" />
            <div className="h-3 bg-secondary rounded w-1/2" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!usage) return null

  const warningMessage = getWarningMessage()
  const statusColor = getStatusColor()

  const getProgressColor = () => {
    switch (statusColor) {
      case 'red':
        return 'bg-red-500'
      case 'yellow':
        return 'bg-yellow-500'
      default:
        return 'bg-green-500'
    }
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Token Usage
          </CardTitle>
          {usage.status === 'exceeded' && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => router.push('/pricing')}
            >
              Upgrade Now
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium">
              {formatTokenCount(usage.used)} used
            </span>
            <span className="text-muted-foreground">
              {formatTokenCount(usage.remaining)} remaining
            </span>
          </div>
          <div className="relative">
            <Progress
              value={usage.percentage}
              className="h-3"
            />
            <div
              className={cn(
                "absolute inset-0 h-3 rounded-full opacity-50",
                getProgressColor()
              )}
              style={{ width: `${Math.min(usage.percentage, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0</span>
            <span>{formatTokenCount(usage.limit)}</span>
          </div>
        </div>

        {/* Warning Message */}
        {warningMessage && (
          <div
            className={cn(
              "flex items-start gap-2 p-3 rounded-lg text-sm",
              statusColor === 'red' && "bg-red-500/10 text-red-600 dark:text-red-400",
              statusColor === 'yellow' && "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
              statusColor === 'green' && usage.isOverPace && "bg-blue-500/10 text-blue-600 dark:text-blue-400"
            )}
          >
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>{warningMessage}</span>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              Days Remaining
            </div>
            <p className="text-lg font-semibold">{usage.daysRemaining}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3" />
              Daily Average
            </div>
            <p className={cn(
              "text-lg font-semibold",
              usage.isOverPace && "text-yellow-600 dark:text-yellow-400"
            )}>
              {usage.currentDailyAverage}
              <span className="text-xs text-muted-foreground ml-1">
                / {usage.recommendedDailyPace}
              </span>
            </p>
          </div>
        </div>

        {/* Upgrade Prompt */}
        {usage.percentage >= 80 && usage.status !== 'exceeded' && (
          <Button
            className="w-full"
            variant="outline"
            size="sm"
            onClick={() => router.push('/pricing')}
          >
            Running low? Upgrade to Limitless
          </Button>
        )}

        {/* View Details */}
        <Button
          className="w-full"
          variant="ghost"
          size="sm"
          onClick={() => router.push('/dashboard')}
        >
          View Detailed Usage
        </Button>
      </CardContent>
    </Card>
  )
}