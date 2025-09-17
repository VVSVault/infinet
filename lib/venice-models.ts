export interface VeniceModel {
  id: string
  name: string
  description: string
  strengths: string[]
  costPerMillion: {
    input: number
    output: number
  }
  contextLimit: number
  speed: 'fast' | 'medium' | 'slow'
  knowledge: 'recent' | 'standard' | 'basic'
}

export const VENICE_MODELS: Record<string, VeniceModel> = {
  'qwen3-235b': {
    id: 'qwen3-235b',
    name: 'Venice Large 1.1',
    description: 'Most powerful flagship model with advanced reasoning',
    strengths: ['complex reasoning', 'analysis', 'coding', 'recent events', 'technical questions'],
    costPerMillion: {
      input: 0.90,
      output: 4.50
    },
    contextLimit: 131072,
    speed: 'slow',
    knowledge: 'recent'
  },
  'llama-3.3-70b': {
    id: 'llama-3.3-70b',
    name: 'Llama 3.3 70B',
    description: 'Balanced high-performance model with recent knowledge',
    strengths: ['general knowledge', 'current events', 'balanced tasks', 'function calling'],
    costPerMillion: {
      input: 0.70,
      output: 2.80
    },
    contextLimit: 65536,
    speed: 'medium',
    knowledge: 'recent'
  },
  'mistral-31-24b': {
    id: 'mistral-31-24b',
    name: 'Venice Medium 3.1',
    description: 'Vision-capable model with function calling',
    strengths: ['vision', 'image analysis', 'function calling', 'moderate tasks'],
    costPerMillion: {
      input: 0.50,
      output: 2.00
    },
    contextLimit: 131072,
    speed: 'medium',
    knowledge: 'standard'
  },
  'venice-uncensored': {
    id: 'venice-uncensored',
    name: 'Venice Uncensored',
    description: 'Uncensored model for open conversations',
    strengths: ['uncensored', 'creative writing', 'open dialogue', 'controversial topics'],
    costPerMillion: {
      input: 0.30,
      output: 1.50
    },
    contextLimit: 32768,
    speed: 'fast',
    knowledge: 'standard'
  },
  'qwen3-4b': {
    id: 'qwen3-4b',
    name: 'Venice Small',
    description: 'Fast and affordable for simple tasks',
    strengths: ['simple questions', 'quick responses', 'basic chat', 'cost-effective'],
    costPerMillion: {
      input: 0.05,
      output: 0.15
    },
    contextLimit: 40960,
    speed: 'fast',
    knowledge: 'basic'
  }
}

/**
 * Analyzes a user's message to determine the best model to use
 */
export function selectModel(message: string, conversationHistory?: any[]): string {
  const lowerMessage = message.toLowerCase()

  // Check for current events or recent dates
  const currentEventKeywords = [
    '2024', '2025', 'recent', 'latest', 'current', 'today', 'yesterday',
    'this year', 'last year', 'news', 'election', 'president', 'update'
  ]

  // Check for complex reasoning or technical questions
  const complexKeywords = [
    'explain', 'analyze', 'compare', 'evaluate', 'code', 'debug', 'algorithm',
    'technical', 'scientific', 'mathematical', 'research', 'detailed'
  ]

  // Check for simple questions
  const simpleKeywords = [
    'what is', 'who is', 'when', 'where', 'define', 'hello', 'hi', 'thanks'
  ]

  // Check for creative or uncensored content
  const creativeKeywords = [
    'story', 'creative', 'imagine', 'controversial', 'opinion', 'uncensored'
  ]

  // Check for image-related queries
  const visionKeywords = [
    'image', 'picture', 'photo', 'visual', 'see', 'look', 'describe the image'
  ]

  // Scoring system
  let scores = {
    'qwen3-235b': 0,      // Venice Large - for complex/recent
    'llama-3.3-70b': 0,   // Llama 3.3 - for current events/general
    'mistral-31-24b': 0,  // Venice Medium - for vision/moderate
    'venice-uncensored': 0, // Uncensored - for creative/open
    'qwen3-4b': 0         // Venice Small - for simple/quick
  }

  // Check for vision needs first (override other factors)
  if (visionKeywords.some(keyword => lowerMessage.includes(keyword))) {
    return 'mistral-31-24b' // Only model with vision capabilities
  }

  // Score based on keywords
  if (currentEventKeywords.some(keyword => lowerMessage.includes(keyword))) {
    scores['llama-3.3-70b'] += 3
    scores['qwen3-235b'] += 2
  }

  if (complexKeywords.some(keyword => lowerMessage.includes(keyword))) {
    scores['qwen3-235b'] += 3
    scores['llama-3.3-70b'] += 1
  }

  if (simpleKeywords.some(keyword => lowerMessage.includes(keyword))) {
    scores['qwen3-4b'] += 3
    scores['venice-uncensored'] += 1
  }

  if (creativeKeywords.some(keyword => lowerMessage.includes(keyword))) {
    scores['venice-uncensored'] += 3
    scores['llama-3.3-70b'] += 1
  }

  // Consider message length
  if (message.length < 50) {
    scores['qwen3-4b'] += 2  // Short questions likely simple
  } else if (message.length > 500) {
    scores['qwen3-235b'] += 2  // Long questions likely complex
    scores['llama-3.3-70b'] += 1
  }

  // Consider conversation context
  if (conversationHistory && conversationHistory.length > 10) {
    // Long conversations benefit from larger context models
    scores['qwen3-235b'] += 1
    scores['llama-3.3-70b'] += 1
  }

  // Default scoring to ensure we always have a baseline
  if (Math.max(...Object.values(scores)) === 0) {
    // No specific indicators, use balanced model
    return 'llama-3.3-70b'
  }

  // Select model with highest score
  const selectedModel = Object.entries(scores).reduce((a, b) =>
    scores[a[0] as keyof typeof scores] > scores[b[0] as keyof typeof scores] ? a : b
  )[0]

  return selectedModel
}

/**
 * Get model by subscription tier for fallback
 */
export function getModelByTier(tier: string): string {
  switch(tier) {
    case 'limitless':
    case 'premium':
      return 'llama-3.3-70b' // Best balanced model
    case 'starter':
      return 'venice-uncensored' // Good middle ground
    case 'free':
    default:
      return 'qwen3-4b' // Most cost-effective
  }
}