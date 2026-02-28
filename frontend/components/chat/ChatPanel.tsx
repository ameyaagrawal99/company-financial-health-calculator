'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Send, StopCircle, Trash2, MessageSquare } from 'lucide-react'
import { useChatStore } from '@/lib/chat-store'
import { streamChat } from '@/lib/api'
import { AIKeys } from '@/lib/ai-keys'

// Inline FinancialStatement type to avoid import issues
interface FinancialStatement {
  [key: string]: unknown
}

interface Props {
  statement?: FinancialStatement
  companyName: string
  financialYear: string
  rawText?: string
  initialMessage?: string
}

const STARTER_QUESTIONS = [
  'What are the biggest financial risks for this company?',
  'How is the working capital position? Any concerns?',
  'Explain the debt-to-equity ratio and what it means.',
  'What should the CFO prioritise in the next 90 days?',
  'Is this company ready for a bank loan?',
]

export default function ChatPanel({ statement, companyName, financialYear, rawText, initialMessage }: Props) {
  const store = useChatStore()
  const messages = store.getMessages()

  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Set active company whenever props change
  useEffect(() => {
    store.setActiveCompany(companyName, financialYear)
  }, [companyName, financialYear])  // eslint-disable-line react-hooks/exhaustive-deps

  // Pre-fill textarea when a parent component pushes an initialMessage (e.g. per-card Ask AI)
  useEffect(() => {
    if (initialMessage) {
      setInput(initialMessage)
      textareaRef.current?.focus()
    }
  }, [initialMessage])

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
  }

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || isStreaming) return

    if (!AIKeys.hasAnyKey()) {
      store.addMessage('assistant',
        '⚠️ Please add a Claude or OpenAI API key in **AI Settings** (⚙️ button) to use chat.')
      return
    }

    store.setActiveCompany(companyName, financialYear)
    store.addMessage('user', trimmed)
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    // Create placeholder for assistant response
    const assistantId = store.addMessage('assistant', '')
    setIsStreaming(true)

    const controller = new AbortController()
    abortRef.current = controller

    let accumulated = ''

    await streamChat({
      messages: store.getMessages()
        .filter(m => m.id !== assistantId)
        .map(m => ({ role: m.role, content: m.content })),
      statement: statement as Record<string, unknown> | undefined,
      rawText,
      aiHeaders: AIKeys.getHeaders(),
      signal: controller.signal,
      onChunk: (chunk) => {
        accumulated += chunk
        store.updateMessage(assistantId, accumulated)
      },
      onDone: () => {
        setIsStreaming(false)
        abortRef.current = null
      },
      onError: (err) => {
        store.updateMessage(assistantId, `⚠️ ${err}`)
        setIsStreaming(false)
        abortRef.current = null
      },
    })
  }, [isStreaming, store, companyName, financialYear, statement])  // eslint-disable-line react-hooks/exhaustive-deps

  const handleStop = () => {
    abortRef.current?.abort()
    setIsStreaming(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-semibold text-gray-700">CFO Chat</span>
          <span className="text-xs text-gray-400">· {companyName}</span>
        </div>
        <button
          onClick={store.clearHistory}
          title="Clear chat history"
          className="p-1.5 rounded hover:bg-gray-200 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5 text-gray-400" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-gray-500 text-center">
              Ask me anything about {companyName}&apos;s financials
            </p>
            <div className="grid gap-2">
              {STARTER_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="text-left text-sm px-3 py-2 rounded-lg border border-blue-100
                             bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed
                ${msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-sm'
                  : 'bg-gray-100 text-gray-800 rounded-bl-sm'}`}
            >
              {msg.role === 'assistant' ? (
                <div className="prose prose-sm prose-gray max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {msg.content || '▋'}
                  </ReactMarkdown>
                </div>
              ) : (
                <span>{msg.content}</span>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-gray-100">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask about ratios, risks, recommendations…"
            rows={1}
            disabled={isStreaming}
            className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                       disabled:opacity-50 transition-all"
          />
          {isStreaming ? (
            <button
              onClick={handleStop}
              className="p-2 rounded-xl bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
            >
              <StopCircle className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim()}
              className="p-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700
                         disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-5 h-5" />
            </button>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-1.5">
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  )
}
