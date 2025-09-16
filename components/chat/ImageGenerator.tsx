'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Image as ImageIcon, Sparkles, Wand2 } from 'lucide-react'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'

interface ImageGeneratorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onGenerated: (images: string[], prompt: string, metadata?: any) => void
  initialPrompt?: string
}

export function ImageGenerator({ open, onOpenChange, onGenerated, initialPrompt = '' }: ImageGeneratorProps) {
  const [prompt, setPrompt] = useState(initialPrompt)
  const [negativePrompt, setNegativePrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [styles, setStyles] = useState<string[]>([])
  const [selectedStyle, setSelectedStyle] = useState<string>('')
  const [variants, setVariants] = useState(1)
  const [width, setWidth] = useState(1024)
  const [height, setHeight] = useState(1024)
  const [cfgScale, setCfgScale] = useState(7.5)
  const [steps, setSteps] = useState(20)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    // Fetch available styles
    const fetchStyles = async () => {
      try {
        const response = await fetch('/api/image/styles')
        if (response.ok) {
          const data = await response.json()
          setStyles(data.data || [])
        }
      } catch (error) {
        console.error('Failed to fetch styles:', error)
      }
    }

    if (open) {
      fetchStyles()
      // Set the initial prompt when dialog opens
      if (initialPrompt) {
        setPrompt(initialPrompt)
      }
    }
  }, [open, initialPrompt])

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a prompt for image generation',
        variant: 'destructive',
      })
      return
    }

    setIsGenerating(true)

    try {
      const response = await fetch('/api/image/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          negative_prompt: negativePrompt,
          style_preset: selectedStyle || undefined,
          variants,
          width,
          height,
          cfg_scale: cfgScale,
          steps,
          safe_mode: false,  // Explicitly disable safe_mode to prevent blurring
        }),
      })

      if (!response.ok) {
        throw new Error(`Image generation failed: ${response.status}`)
      }

      const data = await response.json()

      if (data.images && data.images.length > 0) {
        onGenerated(data.images, prompt, {
          style: selectedStyle,
          model: 'venice-sd35',
          variants,
        })
        onOpenChange(false)
        // Reset form
        setPrompt('')
        setNegativePrompt('')
        setSelectedStyle('')
        setVariants(1)
        setShowAdvanced(false)
      } else {
        throw new Error('No images generated')
      }
    } catch (error: any) {
      console.error('Image generation error:', error)
      toast({
        title: 'Generation Failed',
        description: error.message || 'Failed to generate image. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const aspectRatios = [
    { label: 'Square (1:1)', width: 1024, height: 1024 },
    { label: 'Portrait (3:4)', width: 768, height: 1024 },
    { label: 'Landscape (4:3)', width: 1024, height: 768 },
    { label: 'Wide (16:9)', width: 1024, height: 576 },
    { label: 'Ultra Wide (21:9)', width: 1280, height: 549 },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Generate Image
          </DialogTitle>
          <DialogDescription>
            Create AI-generated images using natural language descriptions
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="prompt">Prompt</Label>
            <Textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the image you want to generate... (e.g., 'A serene mountain landscape at sunset with a crystal clear lake')"
              className="min-h-[100px]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="style">Style</Label>
            <Select value={selectedStyle || "none"} onValueChange={(value) => setSelectedStyle(value === "none" ? "" : value)}>
              <SelectTrigger id="style">
                <SelectValue placeholder="Choose a style (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No style</SelectItem>
                {styles.map((style) => (
                  <SelectItem key={style} value={style}>
                    {style}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="variants">Number of Images: {variants}</Label>
            <Slider
              id="variants"
              min={1}
              max={4}
              step={1}
              value={[variants]}
              onValueChange={(value) => setVariants(value[0])}
            />
          </div>

          <div className="space-y-2">
            <Label>Aspect Ratio</Label>
            <Select
              value={`${width}x${height}`}
              onValueChange={(value) => {
                const ratio = aspectRatios.find(r => `${r.width}x${r.height}` === value)
                if (ratio) {
                  setWidth(ratio.width)
                  setHeight(ratio.height)
                }
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {aspectRatios.map((ratio) => (
                  <SelectItem key={ratio.label} value={`${ratio.width}x${ratio.height}`}>
                    {ratio.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            variant="outline"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full"
          >
            <Wand2 className="mr-2 h-4 w-4" />
            {showAdvanced ? 'Hide' : 'Show'} Advanced Settings
          </Button>

          {showAdvanced && (
            <div className="space-y-4 border rounded-lg p-4">
              <div className="space-y-2">
                <Label htmlFor="negative">Negative Prompt</Label>
                <Textarea
                  id="negative"
                  value={negativePrompt}
                  onChange={(e) => setNegativePrompt(e.target.value)}
                  placeholder="Describe what you don't want in the image... (e.g., 'blurry, low quality, distorted')"
                  className="min-h-[60px]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cfg">Guidance Scale: {cfgScale}</Label>
                <Slider
                  id="cfg"
                  min={1}
                  max={20}
                  step={0.5}
                  value={[cfgScale]}
                  onValueChange={(value) => setCfgScale(value[0])}
                />
                <p className="text-xs text-muted-foreground">
                  Higher values follow the prompt more closely
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="steps">Inference Steps: {steps}</Label>
                <Slider
                  id="steps"
                  min={10}
                  max={50}
                  step={5}
                  value={[steps]}
                  onValueChange={(value) => setSteps(value[0])}
                />
                <p className="text-xs text-muted-foreground">
                  More steps can improve quality but take longer
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isGenerating}>
            Cancel
          </Button>
          <Button onClick={handleGenerate} disabled={isGenerating || !prompt.trim()}>
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <ImageIcon className="mr-2 h-4 w-4" />
                Generate
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}