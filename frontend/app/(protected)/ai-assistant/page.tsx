'use client'

import { useState, useEffect, useRef } from 'react'
import { useApp } from '@/lib/AppContext'
import { Send, MessageCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'

const mockAIResponses: { [key: string]: string } = {
  'hot flash': `Hot flashes are sudden waves of heat and flushing that are very common during menopause. They typically last 30 seconds to 10 minutes. To manage them:
  
• Keep your environment cool
• Wear breathable, layered clothing
• Stay hydrated
• Avoid caffeine and alcohol
• Practice deep breathing

If your hot flashes are severe, talk to your doctor about treatment options.`,

  symptom: `Different symptoms require different approaches. I'd recommend:
  
• Track patterns in your symptom logger
• Note what triggers your symptoms
• Try lifestyle changes like exercise, diet, and stress management
• Keep records to share with your healthcare provider
• Consider keeping a daily log

Would you like specific advice for a particular symptom?`,

  tired: `Fatigue during menopause is common due to hormonal changes and sleep disruption. Try these strategies:
  
• Get 7-9 hours of quality sleep
• Exercise regularly (but not too close to bedtime)
• Limit caffeine and alcohol
• Try relaxation techniques like yoga or meditation
• Maintain a consistent sleep schedule

If fatigue persists, consult your healthcare provider.`,

  mood: `Mood changes are a normal part of menopause. Here are some helpful strategies:
  
• Exercise regularly (great for mood)
• Practice stress management techniques
• Maintain social connections
• Get enough sleep
• Consider therapy or counseling
• Talk to your doctor if symptoms are severe

You're not alone in this experience!`,

  sleep: `Sleep problems are very common during menopause. Try these recommendations:
  
• Keep your bedroom cool and dark
• Establish a consistent sleep schedule
• Avoid screens 1 hour before bed
• Limit caffeine after 2 PM
• Try relaxation techniques before bed
• Exercise during the day

If sleep problems persist, discuss treatment options with your doctor.`,

  default: `I'm here to help! I can provide information about:
• Hot flashes and night sweats
• Mood and sleep changes
• Coping strategies
• When to see a doctor
• Lifestyle modifications

What would you like to know about?`,
}

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

  const getAIResponse = (userMessage: string): string => {
    const lower = userMessage.toLowerCase()

    for (const [key, value] of Object.entries(mockAIResponses)) {
      if (lower.includes(key)) {
        return value
      }
    }

    return mockAIResponses.default
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return

    // Add user message
    const userMsg = {
      id: `msg-${Date.now()}-user`,
      role: 'user' as const,
      content: input,
      timestamp: new Date(),
    }
    addChatMessage(userMsg)
    setInput('')
    setIsLoading(true)

    // Simulate API delay
    setTimeout(() => {
      const aiResponse = getAIResponse(input)
      const assistantMsg = {
        id: `msg-${Date.now()}-assistant`,
        role: 'assistant' as const,
        content: aiResponse,
        timestamp: new Date(),
      }
      addChatMessage(assistantMsg)
      setIsLoading(false)
    }, 800)
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
