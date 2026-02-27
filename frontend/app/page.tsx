'use client'
import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useRouter } from 'next/navigation'
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { uploadFile } from '@/lib/api'
import { AIKeys } from '@/lib/ai-keys'

export default function HomePage() {
  const router = useRouter()
  const { setStatement } = useAppStore()
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [parsedData, setParsedData] = useState<any>(null)

  const onDrop = useCallback(async (files: File[]) => {
    if (!files.length) return
    setUploadState('uploading')
    setErrorMsg('')
    try {
      const result = await uploadFile(files[0], AIKeys.getHeaders())
      setParsedData(result)
      setUploadState('success')
    } catch (err: any) {
      setUploadState('error')
      setErrorMsg(err.message || 'Upload failed')
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive, acceptedFiles } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv'],
      'application/pdf': ['.pdf'],
    },
    maxSize: 10 * 1024 * 1024,
    multiple: false,
  })

  const handleProceedToManual = () => {
    router.push('/upload')
  }

  const handleProceedWithFile = () => {
    if (parsedData) {
      // Store minimal info, go to mapping wizard
      router.push('/upload?from=file')
    }
  }

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
        <div style={{ display: 'flex', gap: 24, fontSize: 13, color: '#6B6560' }}>
          <a href="/dashboard" style={{ color: '#6B6560', textDecoration: 'none' }}>Dashboard</a>
          <a href="/upload" style={{ color: '#6B6560', textDecoration: 'none' }}>Manual Entry</a>
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
                  onClick={handleProceedWithFile}
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
                <div style={{ fontSize: 13, color: '#6B6560', marginBottom: 16 }}>{errorMsg}</div>
                <div style={{ fontSize: 12, color: '#6B6560' }}>Click to try again</div>
              </div>
            )}

            {uploadState === 'idle' && (
              <>
                <div style={{ marginBottom: 16 }}>
                  <FileSpreadsheet size={48} color={isDragActive ? '#3D5A80' : '#6B6560'} />
                </div>
                <div style={{ fontWeight: 600, fontSize: 16, color: '#1C1917', marginBottom: 8 }}>
                  {isDragActive ? 'Drop your file here' : 'Drop your financial statement here'}
                </div>
                <div style={{ fontSize: 13, color: '#6B6560', marginBottom: 4 }}>
                  Supports .xlsx, .xls, .csv · Max 10MB · Balance Sheet, P&L, or Cash Flow
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Supports Excel (.xlsx/.xls), CSV, and PDF (digital or scanned).{' '}
                  PDF parsing uses AI — add your API key in AI Settings.
                </p>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginTop: 16 }}>
                  {['Schedule III', 'Tally Export', 'Manual Excel', 'MCA XBRL'].map(f => (
                    <span key={f} style={{ background: '#F8F7F4', border: '1px solid #E4E2DC', borderRadius: 6, padding: '3px 10px', fontSize: 11, color: '#6B6560' }}>
                      {f}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>

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

      <style>{`@keyframes spin { to { transform: rotate(360deg); }}`}</style>
    </div>
  )
}
