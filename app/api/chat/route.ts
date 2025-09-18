import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { checkSubscription, isSubscriptionError } from '@/middleware/checkSubscription'
import { trackTokenUsage, checkUsageAlerts } from '@/lib/database/db'
import { estimateTokens } from '@/lib/subscription-tiers'

// More accurate token counter
function countTokens(text: string): number {
  // Better estimation based on OpenAI's approximation:
  // ~1 token per 4 characters in English
  // But we'll be more conservative for smaller counts
  const words = text.split(/\s+/).length
  const chars = text.length

  // Use word count for shorter texts (more accurate for typical messages)
  // Approximately 0.75 tokens per word
  if (chars < 1000) {
    return Math.ceil(words * 0.75)
  }

  // For longer texts, use character count
  return Math.ceil(chars / 4)
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        {
          error: 'Authentication required',
          message: 'Please sign in to use the chat API',
          code: 'NO_AUTH'
        },
        { status: 401 }
      )
    }

    // Check subscription and token limits
    const subscriptionCheck = await checkSubscription(request)
    if (isSubscriptionError(subscriptionCheck)) {
      return subscriptionCheck
    }

    const { messages, streaming = true } = await request.json()

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Messages array is required' },
        { status: 400 }
      )
    }

    // Estimate tokens for this request
    const lastMessage = messages[messages.length - 1]?.content || ''
    const estimatedTokens = estimateTokens(lastMessage)

    console.log('Token calculation:', {
      messageLength: lastMessage.length,
      estimatedTokens,
      calculation: `${lastMessage.length} / 4 = ${lastMessage.length / 4}`
    })

    const veniceApiKey = process.env.VENICE_API_KEY
    const veniceApiUrl = process.env.VENICE_API_URL

    if (!veniceApiKey || !veniceApiUrl) {
      return NextResponse.json(
        { error: 'API configuration missing' },
        { status: 500 }
      )
    }

    console.log(`Processing chat for user ${userId}, estimated tokens: ${estimatedTokens}`)

    const response = await fetch(veniceApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${veniceApiKey}`,
        'Accept': streaming ? 'text/event-stream' : 'application/json',
      },
      body: JSON.stringify({
        model: 'venice-uncensored',
        messages,
        stream: streaming,
        temperature: 0.7,
        max_tokens: 4096,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Venice API error:', response.status, errorText)
      return NextResponse.json(
        { error: `API error: ${response.status}` },
        { status: response.status }
      )
    }

    // Track the actual tokens used
    let totalTokensUsed = 0
    let fullResponse = ''

    if (streaming) {
      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        async start(controller) {
          if (!response.body) {
            controller.close()
            return
          }

          const reader = response.body.getReader()
          const decoder = new TextDecoder()

          try {
            while (true) {
              const { done, value } = await reader.read()
              if (done) break

              const chunk = decoder.decode(value, { stream: true })
              const lines = chunk.split('\n')

              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const data = line.slice(6)
                  if (data === '[DONE]') {
                    // Calculate total tokens and track usage
                    totalTokensUsed = countTokens(lastMessage) + countTokens(fullResponse)

                    console.log('Final token usage:', {
                      userMessage: lastMessage.substring(0, 50) + '...',
                      userMessageLength: lastMessage.length,
                      userMessageTokens: countTokens(lastMessage),
                      responseLength: fullResponse.length,
                      responseTokens: countTokens(fullResponse),
                      totalTokensUsed,
                      userId
                    })

                    // Track token usage in database
                    await trackTokenUsage({
                      user_id: userId,
                      tokens_used: totalTokensUsed,
                      tokens_estimated: estimatedTokens,
                      timestamp: new Date(),
                      billing_period_start: subscriptionCheck.subscription.currentPeriodStart,
                      billing_period_end: subscriptionCheck.subscription.currentPeriodEnd,
                      chat_id: request.headers.get('X-Chat-Id') || undefined,
                      message_id: crypto.randomUUID(),
                      message_type: 'text',
                      model_used: 'venice-uncensored',
                    })

                    // Check if we need to send usage alerts
                    await checkUsageAlerts(userId)

                    // Send final token count
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                      type: 'usage',
                      tokensUsed: totalTokensUsed,
                      subscription: subscriptionCheck.subscription
                    })}\n\n`))

                    controller.enqueue(encoder.encode('data: [DONE]\n\n'))
                    controller.close()
                    return
                  }

                  try {
                    const parsed = JSON.parse(data)
                    const content = parsed.choices?.[0]?.delta?.content || ''
                    if (content) {
                      fullResponse += content
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`))
                    }
                  } catch (e) {
                    console.error('Error parsing SSE data:', e)
                  }
                }
              }
            }
          } catch (error) {
            console.error('Stream reading error:', error)
            controller.error(error)
          } finally {
            reader.releaseLock()
            controller.close()
          }
        },
      })

      return new NextResponse(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      })
    } else {
      const data = await response.json()
      const responseContent = data.choices?.[0]?.message?.content || ''
      totalTokensUsed = countTokens(lastMessage) + countTokens(responseContent)

      // Track token usage
      await trackTokenUsage({
        user_id: userId,
        tokens_used: totalTokensUsed,
        tokens_estimated: estimatedTokens,
        timestamp: new Date(),
        billing_period_start: subscriptionCheck.subscription.currentPeriodStart,
        billing_period_end: subscriptionCheck.subscription.currentPeriodEnd,
        chat_id: request.headers.get('X-Chat-Id') || undefined,
        message_id: crypto.randomUUID(),
        message_type: 'text',
        model_used: 'venice-uncensored',
      })

      // Check if we need to send usage alerts
      await checkUsageAlerts(userId)

      return NextResponse.json({
        ...data,
        usage: {
          tokensUsed: totalTokensUsed,
          subscription: subscriptionCheck.subscription,
        },
      })
    }
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error', code: 'SERVER_ERROR' },
      { status: 500 }
    )
  }
}