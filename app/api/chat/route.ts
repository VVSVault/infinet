import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const { messages, streaming = true } = await request.json()

    if (!messages || !Array.isArray(messages)) {
      return new NextResponse('Messages array is required', { status: 400 })
    }

    const veniceApiKey = process.env.VENICE_API_KEY
    const veniceApiUrl = process.env.VENICE_API_URL

    if (!veniceApiKey || !veniceApiUrl) {
      return new NextResponse('API configuration missing', { status: 500 })
    }

    console.log('Calling Venice API:', veniceApiUrl)

    const response = await fetch(veniceApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${veniceApiKey}`,
        'Accept': streaming ? 'text/event-stream' : 'application/json',
      },
      body: JSON.stringify({
        model: 'venice-uncensored',  // Using Venice's flagship uncensored model
        messages,
        stream: streaming,
        temperature: 0.7,
        max_tokens: 4096,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('API error:', response.status, response.statusText, errorText)
      return new NextResponse(`API error: ${response.status} - ${errorText}`, { status: response.status })
    }

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
                    controller.close()
                    return
                  }
                  try {
                    const parsed = JSON.parse(data)
                    const content = parsed.choices?.[0]?.delta?.content || ''
                    if (content) {
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
      return NextResponse.json(data)
    }
  } catch (error) {
    console.error('Chat API error:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}