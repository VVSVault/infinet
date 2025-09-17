import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Bot, Zap, Lock, MessageSquare, Crown } from 'lucide-react'

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      <div className="container mx-auto px-4 py-16">
        <nav className="flex justify-between items-center mb-16">
          <div className="flex items-center gap-2">
            <Bot className="h-8 w-8" />
            <span className="text-2xl font-bold">Infinet</span>
          </div>
          <div className="flex gap-4">
            <Link href="/sign-in">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link href="/sign-up">
              <Button>Get Started</Button>
            </Link>
          </div>
        </nav>

        <main className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Advanced AI Chat Powered by Infinet
          </h1>

          <p className="text-xl text-muted-foreground mb-8">
            Your Thoughts Deserve Infinet Answers
          </p>

          <div className="flex gap-4 justify-center mb-16">
            <Link href="/sign-up">
              <Button size="lg" className="gap-2">
                <MessageSquare className="h-5 w-5" />
                Start Chatting
              </Button>
            </Link>
            <Link href="/pricing">
              <Button size="lg" variant="outline" className="gap-2">
                <Crown className="h-5 w-5" />
                View Premium Plans
              </Button>
            </Link>
            <Link href="/sign-in">
              <Button size="lg" variant="outline">
                Sign In
              </Button>
            </Link>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mt-16">
            <div className="p-6 rounded-lg border bg-card">
              <Zap className="h-12 w-12 mb-4 mx-auto text-primary" />
              <h3 className="text-lg font-semibold mb-2">Lightning Fast</h3>
              <p className="text-sm text-muted-foreground">
                Powered by Infinet's advanced infrastructure for rapid responses
              </p>
            </div>

            <div className="p-6 rounded-lg border bg-card">
              <Lock className="h-12 w-12 mb-4 mx-auto text-primary" />
              <h3 className="text-lg font-semibold mb-2">Secure & Private</h3>
              <p className="text-sm text-muted-foreground">
                Your conversations are protected with enterprise-grade security
              </p>
            </div>

            <div className="p-6 rounded-lg border bg-card">
              <MessageSquare className="h-12 w-12 mb-4 mx-auto text-primary" />
              <h3 className="text-lg font-semibold mb-2">Smart Organization</h3>
              <p className="text-sm text-muted-foreground">
                Organize chats with projects and find anything with powerful search
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
