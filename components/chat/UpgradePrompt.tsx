import React from 'react'
import { Crown, Zap, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface UpgradePromptProps {
  currentTier?: string
  tokenLimit?: number
  tokensUsed?: number
}

export function UpgradePrompt({ currentTier = 'free', tokenLimit = 500, tokensUsed = 500 }: UpgradePromptProps) {
  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20 p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/50">
            <Crown className="h-6 w-6 text-amber-600 dark:text-amber-400" />
          </div>

          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Token Limit Reached
            </h3>

            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              You've used all {tokensUsed} of your {tokenLimit} free tokens this month.
              Upgrade to continue using Infinet without interruption.
            </p>

            <div className="mt-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <Link href="/pricing" className="block">
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full justify-start gap-2 border-amber-200 hover:bg-amber-100 hover:border-amber-300 dark:border-amber-900 dark:hover:bg-amber-950/50"
                  >
                    <Zap className="h-4 w-4" />
                    <div className="text-left">
                      <div className="font-medium">Starter</div>
                      <div className="text-xs opacity-75">10K tokens</div>
                    </div>
                  </Button>
                </Link>

                <Link href="/pricing" className="block">
                  <Button
                    size="sm"
                    className="w-full justify-start gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
                  >
                    <Crown className="h-4 w-4" />
                    <div className="text-left">
                      <div className="font-medium">Premium</div>
                      <div className="text-xs opacity-90">50K tokens</div>
                    </div>
                  </Button>
                </Link>

                <Link href="/pricing" className="block">
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full justify-start gap-2 border-amber-200 hover:bg-amber-100 hover:border-amber-300 dark:border-amber-900 dark:hover:bg-amber-950/50"
                  >
                    <TrendingUp className="h-4 w-4" />
                    <div className="text-left">
                      <div className="font-medium">Limitless</div>
                      <div className="text-xs opacity-75">100K tokens</div>
                    </div>
                  </Button>
                </Link>
              </div>

              <div className="text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  All plans include advanced features and priority support
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}