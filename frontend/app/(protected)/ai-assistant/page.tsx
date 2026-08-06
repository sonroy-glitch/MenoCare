'use client'

import { useState, useEffect, useRef } from 'react'
import { useApp } from '@/lib/AppContext'
import { Send, MessageCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'

export default function AIAssistantPage() {
  const { chatMessages, addChatMessage, user } = useApp()
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [chatMessages])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return

    const userMsg = {
      id: `msg-${Date.now()}-user`,
      role: 'user' as const,
      content: input,
      timestamp: new Date(),
    }
    addChatMessage(userMsg)
    setInput('')
    setIsLoading(true)

    // Send the running conversation to the Groq-backed assistant.
    const history = [...chatMessages, userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }))
    try {
      const res = await api.chat(history)
      addChatMessage({
        id: `msg-${Date.now()}-assistant`,
        role: 'assistant' as const,
        content: res.reply || 'Sorry, I could not generate a response.',
        timestamp: new Date(),
      })
    } catch (err) {
      addChatMessage({
        id: `msg-${Date.now()}-assistant`,
        role: 'assistant' as const,
        content:
          err instanceof Error
            ? `Sorry, something went wrong: ${err.message}`
            : 'Sorry, something went wrong reaching the assistant.',
        timestamp: new Date(),
      })
    } finally {
      setIsLoading(false)
    }
  }

  const quickQuestions = [
    'How can I manage hot flashes?',
    'What helps with sleep problems?',
    'How to deal with mood swings?',
    'Is fatigue normal?',
  ]

  return (
    <div className="min-h-screen bg-background flex flex-col pb-24 sm:pb-8">
      {/* Header */}
      <div className="bg-secondary px-4 py-6 border-b border-border sticky top-0 z-10">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary">
              <MessageCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                AI Assistant
              </h1>
              <p className="text-sm text-foreground/60">
                Your personal menopause companion
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-5xl mx-auto space-y-4">
          {chatMessages.length === 0 ? (
            <div className="text-center py-12">
              <MessageCircle className="w-16 h-16 text-primary/20 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-foreground mb-2">
                Welcome to your AI Assistant
              </h2>
              <p className="text-foreground/60 mb-6">
                Ask me anything about menopause, symptoms, or wellness strategies
              </p>

              {/* Quick Questions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {quickQuestions.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => setInput(q)}
                    className="p-3 bg-card border border-border rounded-lg text-left text-sm text-foreground hover:border-primary hover:bg-primary/5 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-md rounded-2xl px-4 py-3 ${
                      msg.role === 'user'
                        ? 'bg-primary text-white rounded-br-none'
                        : 'bg-card border border-border text-foreground rounded-bl-none'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">
                      {msg.content}
                    </p>
                    <p
                      className={`text-xs mt-2 ${
                        msg.role === 'user'
                          ? 'text-white/70'
                          : 'text-foreground/50'
                      }`}
                    >
                      {msg.timestamp.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-card border border-border rounded-2xl rounded-bl-none px-4 py-3">
                    <div className="flex gap-2">
                      <div className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" />
                      <div
                        className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce"
                        style={{ animationDelay: '0.2s' }}
                      />
                      <div
                        className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce"
                        style={{ animationDelay: '0.4s' }}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="fixed sm:static bottom-0 left-0 right-0 bg-card border-t border-border px-4 py-4 sm:bg-transparent sm:border-0 sm:px-0">
        <div className="max-w-5xl mx-auto">
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask me anything about menopause..."
              disabled={isLoading}
              className="flex-1"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
