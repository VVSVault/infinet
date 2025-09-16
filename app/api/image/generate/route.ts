import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const body = await request.json()
    const {
      prompt,
      model = 'venice-sd35',  // Venice's Stable Diffusion 3.5 model
      width = 1024,
      height = 1024,
      variants = 1,
      style_preset,
      negative_prompt,
      cfg_scale = 7.5,
      steps = 20,
      safe_mode = false  // Set to false to prevent unwanted blurring
    } = body

    if (!prompt) {
      return new NextResponse('Prompt is required', { status: 400 })
    }

    const veniceApiKey = process.env.VENICE_API_KEY
    const veniceApiUrl = 'https://api.venice.ai/api/v1/image/generate'

    if (!veniceApiKey) {
      return new NextResponse('API configuration missing', { status: 500 })
    }

    console.log('Generating image with prompt:', prompt)
    console.log('Using model:', model)

    // Venice's /image/generate endpoint format
    const requestBody: any = {
      model,
      prompt,
      width,
      height,
      variants,
      safe_mode,  // Always include safe_mode to control blurring
    }

    // Add optional parameters if provided
    if (style_preset) requestBody.style_preset = style_preset
    if (negative_prompt) requestBody.negative_prompt = negative_prompt
    if (cfg_scale !== undefined) requestBody.cfg_scale = cfg_scale
    if (steps !== undefined) requestBody.steps = steps

    console.log('Request body:', JSON.stringify(requestBody, null, 2))
    console.log('API URL:', veniceApiUrl)

    const response = await fetch(veniceApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${veniceApiKey}`,
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Image generation error:', response.status, errorText)
      return new NextResponse(`Image generation failed: ${response.status}`, { status: response.status })
    }

    const data = await response.json()
    console.log('Venice API response structure:', Object.keys(data))

    // Venice's response format for /image/generate
    // The response should contain images array with base64 data
    const transformedResponse = {
      images: data.images || (data.data ? data.data.map((img: any) => img.b64_json || img.url) : []),
      id: data.id || data.created || Date.now()
    }

    console.log(`Successfully generated ${transformedResponse.images.length} images`)

    return NextResponse.json(transformedResponse)
  } catch (error) {
    console.error('Image API error:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}