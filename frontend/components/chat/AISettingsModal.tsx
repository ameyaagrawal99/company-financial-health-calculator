'use client'

import { useState, useEffect } from 'react'
import { X, Eye, EyeOff, ExternalLink } from 'lucide-react'
import { AIKeys, type AIProvider } from '@/lib/ai-keys'

interface Props {
  isOpen: boolean
  onClose: () => void
}

export default function AISettingsModal({ isOpen, onClose }: Props) {
  const [claudeKey, setClaudeKey] = useState('')
  const [openaiKey, setOpenaiKey] = useState('')
  const [provider, setProvider] = useState<AIProvider>('auto')
  const [showClaude, setShowClaude] = useState(false)
  const [showOpenAI, setShowOpenAI] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setClaudeKey(AIKeys.getClaude())
      setOpenaiKey(AIKeys.getOpenAI())
      setProvider(AIKeys.getProvider())
    }
  }, [isOpen])

  const handleSave = () => {
    AIKeys.setClaude(claudeKey.trim())
    AIKeys.setOpenAI(openaiKey.trim())
    AIKeys.setProvider(provider)
    setSaved(true)
    setTimeout(() => { setSaved(false); onClose() }, 1000)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">AI Settings</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Privacy notice */}
        <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3 leading-relaxed">
          Keys are stored only in your browser&apos;s localStorage and are never sent to our servers
          except as headers on each AI request.
        </p>

        {/* Claude Key */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700 flex items-center justify-between">
            Anthropic (Claude) API Key
            <a
              href="https://console.anthropic.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 flex items-center gap-0.5 hover:underline"
            >
              Get key <ExternalLink className="w-3 h-3" />
            </a>
          </label>
          <div className="relative">
            <input
              type={showClaude ? 'text' : 'password'}
              value={claudeKey}
              onChange={e => setClaudeKey(e.target.value)}
              placeholder="sk-ant-api03-..."
              className="w-full rounded-lg border border-gray-200 px-3 py-2 pr-10 text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => setShowClaude(v => !v)}
              className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
            >
              {showClaude ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* OpenAI Key */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700 flex items-center justify-between">
            OpenAI API Key
            <a
              href="https://platform.openai.com/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 flex items-center gap-0.5 hover:underline"
            >
              Get key <ExternalLink className="w-3 h-3" />
            </a>
          </label>
          <div className="relative">
            <input
              type={showOpenAI ? 'text' : 'password'}
              value={openaiKey}
              onChange={e => setOpenaiKey(e.target.value)}
              placeholder="sk-..."
              className="w-full rounded-lg border border-gray-200 px-3 py-2 pr-10 text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => setShowOpenAI(v => !v)}
              className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
            >
              {showOpenAI ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Provider selector */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">Preferred Provider</label>
          <div className="grid grid-cols-3 gap-2">
            {(['auto', 'claude', 'openai'] as AIProvider[]).map((p) => (
              <button
                key={p}
                onClick={() => setProvider(p)}
                className={`py-2 rounded-lg text-sm font-medium border transition-colors
                  ${provider === p
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}
              >
                {p === 'auto' ? 'Auto' : p === 'claude' ? 'Claude' : 'GPT-4o'}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400">
            Auto uses Claude if key present, otherwise OpenAI.
          </p>
        </div>

        {/* Save */}
        <button
          onClick={handleSave}
          className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-medium text-sm
                     hover:bg-blue-700 transition-colors"
        >
          {saved ? '✓ Saved!' : 'Save Settings'}
        </button>
      </div>
    </div>
  )
}
