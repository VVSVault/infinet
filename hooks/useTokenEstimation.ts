import { useState, useEffect, useCallback } from 'react'
import { useUser } from '@clerk/nextjs'
import { estimateTokens, getUsageStatus, formatTokenCount, calculateRecommendedPace, daysUntilReset } from '@/lib/subscription-tiers'

interface TokenUsageData {
  used: number
  limit: number
  remaining: number
  percentage: number
  status: 'safe' | 'warning' | 'critical' | 'exceeded'
  color: string
  daysRemaining: number
  recommendedDailyPace: number
  currentDailyAverage: number
  isOverPace: boolean
}

interface TokenEstimation {
  messageTokens: number
  totalConversationTokens: number
  wouldExceedLimit: boolean
  costEstimate: number
}

export function useTokenEstimation() {
  const { user } = useUser()
  const [usage, setUsage] = useState<TokenUsageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [estimation, setEstimation] = useState<TokenEstimation | null>(null)

  // Fetch current usage
  const fetchUsage = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }

    try {
      const response = await fetch('/api/usage')
      if (!response.ok) {
        throw new Error('Failed to fetch usage')
      }

      const data = await response.json()

      const usageStatus = getUsageStatus(data.tokensUsed, data.tokenLimit)
      const periodEnd = new Date(data.periodEnd)
      const daysRemaining = daysUntilReset(periodEnd)
      const periodStart = new Date(data.periodStart)
      const daysElapsed = Math.max(1, Math.ceil((Date.now() - periodStart.getTime()) / (1000 * 60 * 60 * 24)))

      const usage: TokenUsageData = {
        used: data.tokensUsed,
        limit: data.tokenLimit,
        remaining: data.tokensRemaining,
        percentage: usageStatus.percentage,
        status: usageStatus.status,
        color: usageStatus.color,
        daysRemaining,
        recommendedDailyPace: calculateRecommendedPace(data.tokenLimit, 30),
        currentDailyAverage: Math.round(data.tokensUsed / daysElapsed),
        isOverPace: false,
      }

      // Check if over recommended pace
      usage.isOverPace = usage.currentDailyAverage > usage.recommendedDailyPace

      setUsage(usage)
    } catch (error) {
      console.error('Error fetching token usage:', error)
    } finally {
      setLoading(false)
    }
  }, [user])

  // Estimate tokens for a message
  const estimateMessageTokens = useCallback((message: string, includesImage = false): TokenEstimation | null => {
    if (!usage) return null

    const messageTokens = estimateTokens(message, includesImage)
    const totalConversationTokens = messageTokens * 2 // Estimate response will be similar size
    const wouldExceedLimit = usage.used + totalConversationTokens > usage.limit

    // Calculate cost (example: $0.002 per token for premium)
    const costPerToken = usage.limit === 25000 ? 0.002 : 0.0015 // Premium vs Limitless
    const costEstimate = totalConversationTokens * costPerToken

    const estimation = {
      messageTokens,
      totalConversationTokens,
      wouldExceedLimit,
      costEstimate,
    }

    setEstimation(estimation)
    return estimation
  }, [usage])

  // Check if can send message
  const canSendMessage = useCallback((estimatedTokens: number): boolean => {
    if (!usage) return false
    return usage.used + estimatedTokens <= usage.limit
  }, [usage])

  // Get warning message
  const getWarningMessage = useCallback((): string | null => {
    if (!usage) return null

    switch (usage.status) {
      case 'exceeded':
        return `Token limit exceeded! Upgrade or wait ${usage.daysRemaining} days for reset.`
      case 'critical':
        return `Critical: Only ${formatTokenCount(usage.remaining)} tokens remaining!`
      case 'warning':
        return `Warning: ${Math.round(usage.percentage)}% of monthly tokens used.`
      default:
        if (usage.isOverPace) {
          return `You're using tokens faster than recommended. Current: ${usage.currentDailyAverage}/day, Recommended: ${usage.recommendedDailyPace}/day`
        }
        return null
    }
  }, [usage])

  // Get color for UI elements
  const getStatusColor = useCallback((): string => {
    if (!usage) return 'gray'

    switch (usage.status) {
      case 'exceeded':
      case 'critical':
        return 'red'
      case 'warning':
        return 'yellow'
      default:
        return 'green'
    }
  }, [usage])

  useEffect(() => {
    fetchUsage()
    // Refresh usage every 30 seconds
    const interval = setInterval(fetchUsage, 30000)
    return () => clearInterval(interval)
  }, [fetchUsage])

  return {
    usage,
    loading,
    estimation,
    estimateMessageTokens,
    canSendMessage,
    getWarningMessage,
    getStatusColor,
    refreshUsage: fetchUsage,
  }
}