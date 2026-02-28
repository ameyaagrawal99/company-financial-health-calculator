'use client'
import { useState, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import { useDropzone } from 'react-dropzone'
import { useRouter } from 'next/navigation'
import { FileSpreadsheet, AlertCircle, CheckCircle2, Loader2, Camera, Settings } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { uploadFile } from '@/lib/api'
import { AIKeys } from '@/lib/ai-keys'

// Loaded client-side only (uses localStorage)
const AISettingsModal = dynamic(() => import('@/components/chat/AISettingsModal'), { ssr: false })

// File types that require an AI key to parse
const AI_REQUIRED_EXTS = new Set(['pdf', 'jpg', 'jpeg', 'png', 'webp'])

export default function HomePage() {
  const router = useRouter()
  const { setStatement, setRawText } = useAppStore()
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [parsedData, setParsedData] = useState<any>(null)
  const [showSettings, setShowSettings] = useState(false)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = useCallback(async (file: File) => {
    // Pre-flight: PDF and images need an AI key — catch this early with a friendly message
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    if (AI_REQUIRED_EXTS.has(ext) && !AIKeys.hasAnyKey()) {
      setUploadState('error')
      setErrorMsg('PDF and image parsing requires an AI key. Click ⚙ AI Settings above to add your Claude or OpenAI key.')
      return
    }

    setUploadState('uploading')
    setErrorMsg('')
    try {
      const result = await uploadFile(file, AIKeys.getHeaders())
      setParsedData(result)
      setUploadState('success')
    } catch (err: any) {
      setUploadState('error')
      setErrorMsg(err.message || 'Upload failed')
    }
  }, [])

  const onDrop = useCallback(async (files: File[]) => {
    if (!files.length) return
    handleFileUpload(files[0])
  }, [handleFileUpload])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv'],
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
    },
    maxSize: 20 * 1024 * 1024,  // 20MB — camera photos can be large
    multiple: false,
  })

  const handleCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFileUpload(file)
    e.target.value = ''  // Reset so same photo can be re-selected
  }

  const handleProceedToManual = () => router.push('/upload')
  const handleProceedWithFile = () => {
    if (!parsedData) return
    // Save parsed statement to Zustand so /upload can pre-fill the form
    const ps = parsedData.parsed_statement
    if (ps) {
      setStatement({
        company_name: ps.company_name || '',
        financial_year: ps.financial_year || 'FY 2024-25',
        currency_unit: (ps.currency_unit || 'lakhs') as any,
        balance_sheet: ps.balance_sheet,
        profit_loss: ps.profit_loss,
        cash_flow: ps.cash_flow,
      })
    }
    // Persist raw PDF text so the CFO chat can reference MD&A, auditor notes, etc.
    setRawText(parsedData.raw_text || null)
    router.push('/upload?from=file')
  }

  // Whether the error is specifically a "missing key" error (so we show the Settings CTA)
  const isMissingKeyError = errorMsg.includes('AI key') || errorMsg.includes('API key')

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Nav */}
      <nav style={{ borderBottom: '1px solid #E4E2DC', background: '#fff', padding: '0 32px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, background: '#3D5A80', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#fff', fontWeight: 800, fontSize: 13 }}>₹</span>
          </div>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#1C1917' }}>FinHealth India</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, fontSize: 13, color: '#6B6560' }}>
          <a href="/dashboard" style={{ color: '#6B6560', textDecoration: 'none' }}>Dashboard</a>
          <a href="/upload" style={{ color: '#6B6560', textDecoration: 'none' }}>Manual Entry</a>
          <button
            onClick={() => setShowSettings(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'transparent', border: '1px solid #E4E2DC',
              borderRadius: 6, padding: '5px 10px', cursor: 'pointer',
              color: '#6B6560', fontSize: 13, fontWeight: 500,
            }}
          >
            <Settings size={13} />
            AI Settings
          </button>
        </div>
      </nav>

      {/* Hero */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', maxWidth: 900, margin: '0 auto', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ display: 'inline-block', background: '#EFF6FF', color: '#3D5A80', padding: '4px 14px', borderRadius: 999, fontSize: 12, fontWeight: 600, marginBottom: 16 }}>
            🇮🇳 India's First SME Financial Health Platform
          </div>
          <h1 style={{ fontSize: 40, fontWeight: 800, color: '#1C1917', margin: '0 0 16px', lineHeight: 1.2 }}>
            Know Your Company's<br />Financial Health in 60 Seconds
          </h1>
          <p style={{ fontSize: 16, color: '#6B6560', margin: 0, maxWidth: 560, marginLeft: 'auto', marginRight: 'auto' }}>
            Upload your Balance Sheet, P&L, or Cash Flow statement. Get 50+ ratios, a 0–100 health score, and actionable recommendations — built for Indian businesses.
          </p>
        </div>

        {/* Upload Zone */}
        <div style={{ width: '100%', maxWidth: 560 }}>
          <div
            {...getRootProps()}
            style={{
              border: `2px dashed ${isDragActive ? '#3D5A80' : uploadState === 'success' ? '#4ADE80' : uploadState === 'error' ? '#F87171' : '#E4E2DC'}`,
              borderRadius: 16,
              padding: '48px 32px',
              textAlign: 'center',
              cursor: 'pointer',
              background: isDragActive ? '#EFF6FF' : uploadState === 'success' ? '#F0FDF4' : '#FFFFFF',
              transition: 'all 0.2s',
            }}
          >
            <input {...getInputProps()} />

            {uploadState === 'uploading' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <Loader2 size={40} color="#3D5A80" style={{ animation: 'spin 1s linear infinite' }} />
                <div style={{ fontWeight: 600, color: '#3D5A80' }}>Parsing your file...</div>
              </div>
            )}

            {uploadState === 'success' && parsedData && (
              <div>
                <CheckCircle2 size={40} color="#166534" style={{ marginBottom: 12 }} />
                <div style={{ fontWeight: 700, fontSize: 16, color: '#166534', marginBottom: 8 }}>File parsed successfully!</div>
                <div style={{ background: '#F0FDF4', borderRadius: 8, padding: '12px 16px', marginBottom: 16, textAlign: 'left' }}>
                  <div style={{ fontSize: 13, color: '#166534' }}>
                    <div>📋 Type detected: <strong>{parsedData.detected_type?.replace('_', ' ').toUpperCase()}</strong></div>
                    <div>📅 Financial year: <strong>{parsedData.financial_year || 'Not detected'}</strong></div>
                    <div>💰 Currency: <strong>{parsedData.currency_unit || 'Lakhs'}</strong></div>
                    <div>🔧 Confidence: <strong>{Math.round((parsedData.confidence || 0) * 100)}%</strong></div>
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleProceedWithFile() }}
                  style={{ width: '100%', background: '#3D5A80', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 24px', fontWeight: 600, fontSize: 14, cursor: 'pointer', marginBottom: 8 }}
                >
                  Review Mapping & Calculate →
                </button>
                <div style={{ fontSize: 12, color: '#6B6560' }}>Click to re-upload a different file</div>
              </div>
            )}

            {uploadState === 'error' && (
              <div>
                <AlertCircle size={40} color="#9F1239" style={{ marginBottom: 12 }} />
                <div style={{ fontWeight: 600, color: '#9F1239', marginBottom: 8 }}>Upload failed</div>
                <div style={{ fontSize: 13, color: '#6B6560', marginBottom: isMissingKeyError ? 16 : 0 }}>{errorMsg}</div>
                {isMissingKeyError && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowSettings(true) }}
                    style={{
                      background: '#3D5A80', color: '#fff', border: 'none', borderRadius: 7,
                      padding: '9px 20px', fontWeight: 600, fontSize: 13, cursor: 'pointer',
                      display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 12,
                    }}
                  >
                    <Settings size={14} /> Open AI Settings
                  </button>
                )}
                <div style={{ fontSize: 12, color: '#6B6560' }}>Click anywhere to try again</div>
              </div>
            )}

            {uploadState === 'idle' && (
              <>
                <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center', gap: 12 }}>
                  <FileSpreadsheet size={40} color={isDragActive ? '#3D5A80' : '#6B6560'} />
                  <Camera size={40} color={isDragActive ? '#3D5A80' : '#9CA3AF'} />
                </div>
                <div style={{ fontWeight: 600, fontSize: 16, color: '#1C1917', marginBottom: 8 }}>
                  {isDragActive ? 'Drop your file here' : 'Drop your financial statement here'}
                </div>
                <div style={{ fontSize: 13, color: '#6B6560', marginBottom: 4 }}>
                  Excel, CSV, PDF · or a photo/scan of a printed statement
                </div>
                <p style={{ fontSize: 12, color: '#9CA3AF', margin: '4px 0 0' }}>
                  PDF & image parsing uses AI —{' '}
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowSettings(true) }}
                    style={{ background: 'none', border: 'none', padding: 0, color: '#3D5A80', fontSize: 12, cursor: 'pointer', textDecoration: 'underline', fontWeight: 600 }}
                  >
                    add your key in ⚙ AI Settings
                  </button>
                </p>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginTop: 16 }}>
                  {['Schedule III', 'Tally Export', 'Manual Excel', 'MCA XBRL', 'Camera Scan'].map(f => (
                    <span key={f} style={{ background: '#F8F7F4', border: '1px solid #E4E2DC', borderRadius: 6, padding: '3px 10px', fontSize: 11, color: '#6B6560' }}>
                      {f}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Hidden camera input — opens rear camera on mobile, file picker on desktop */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={handleCameraCapture}
          />

          {/* Camera scan CTA — shown only when idle or error */}
          {(uploadState === 'idle' || uploadState === 'error') && (
            <button
              onClick={() => cameraInputRef.current?.click()}
              style={{
                width: '100%',
                marginTop: 12,
                background: '#F8F7F4',
                color: '#3D5A80',
                border: '1.5px solid #E4E2DC',
                borderRadius: 10,
                padding: '12px 24px',
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <Camera size={18} />
              📷 Scan with Camera (mobile) or Upload Photo
            </button>
          )}

          {/* OR divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0' }}>
            <div style={{ flex: 1, height: 1, background: '#E4E2DC' }} />
            <span style={{ fontSize: 12, color: '#6B6560' }}>OR</span>
            <div style={{ flex: 1, height: 1, background: '#E4E2DC' }} />
          </div>

          <button
            onClick={handleProceedToManual}
            style={{ width: '100%', background: '#fff', color: '#3D5A80', border: '1.5px solid #3D5A80', borderRadius: 8, padding: '12px 24px', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
          >
            Enter Data Manually →
          </button>
        </div>

        {/* Stats bar */}
        <div style={{ display: 'flex', gap: 40, marginTop: 56, borderTop: '1px solid #E4E2DC', paddingTop: 32, width: '100%', maxWidth: 560, justifyContent: 'center' }}>
          {[
            { n: '50+', label: 'Ratios Calculated' },
            { n: '60s', label: 'Time to Insight' },
            { n: '9+', label: 'Compliance Checks' },
            { n: '0–100', label: 'Health Score' },
          ].map(s => (
            <div key={s.n} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#3D5A80' }}>{s.n}</div>
              <div style={{ fontSize: 11, color: '#6B6560' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Settings Modal — accessible from home page without navigating away */}
      <AISettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />

      <style>{`@keyframes spin { to { transform: rotate(360deg); }}`}</style>
    </div>
  )
}
