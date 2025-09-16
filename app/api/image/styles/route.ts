import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const veniceApiKey = process.env.VENICE_API_KEY
    const veniceApiUrl = 'https://api.venice.ai/api/v1/image/styles'

    if (!veniceApiKey) {
      return new NextResponse('API configuration missing', { status: 500 })
    }

    const response = await fetch(veniceApiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${veniceApiKey}`,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Styles fetch error:', response.status, errorText)
      return new NextResponse(`Failed to fetch styles: ${response.status}`, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Styles API error:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}