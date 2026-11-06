'use client'

/**
 * Public offer letter page — no login required.
 * URL: /offer/:token  (token = offerLetters.acceptanceToken)
 *
 * Candidates can:
 *   1. View the offer letter (PDF embed or formatted content fallback)
 *   2. Provide a drawn/typed signature
 *   3. Accept or decline the offer
 */
import { useState, useEffect, useRef } from 'react'
import { use } from 'react'

type OfferData = {
  id:              string
  type:            string
  status:          string
  candidateName:   string
  candidateEmail:  string | null
  position:        string
  department:      string | null
  employmentType:  string
  startDate:       string | null
  salaryAmount:    number | null
  salaryCycle:     string
  templateContent: string | null
  pdfUrl:          string | null
  sentAt:          string | null
  acceptedAt:      string | null
  rejectedAt:      string | null
  expiresAt:       string | null
  orgName:         string | null
  logoUrl:         string | null
  primaryColor:    string
}

const EMP_TYPE_LABELS: Record<string, string> = {
  full_time:  'Full Time',
  part_time:  'Part Time',
  casual:     'Casual',
  contractor: 'Contractor',
}

function fmtSalary(amount: number | null, cycle: string) {
  if (!amount) return null
  const formatted = amount.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 })
  const cycleLabel = cycle === 'annual' ? 'per annum' : cycle === 'hourly' ? 'per hour' : `per ${cycle}`
  return `${formatted} ${cycleLabel}`
}

function fmtDate(d: string | null) {
  if (!d) return null
  return new Date(d + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function OfferPage({ params }: { params: Promise<{ token: string }> }) {
  const { token }    = use(params)
  const [offer,      setOffer]      = useState<OfferData | null>(null)
  const [error,      setError]      = useState('')
  const [loading,    setLoading]    = useState(true)
  const [step,       setStep]       = useState<'view' | 'sign' | 'done' | 'declined' | 'expired'>('view')
  const [submitting, setSubmitting] = useState(false)
  const [sigMode,    setSigMode]    = useState<'draw' | 'type'>('draw')
  const [typedSig,   setTypedSig]   = useState('')

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing   = useRef(false)

  useEffect(() => {
    fetch(`/api/offer-letter/${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); setLoading(false); return }
        setOffer(d)
        if (d.status === 'accepted') setStep('done')
        if (d.status === 'rejected') setStep('declined')
        if (d.status === 'expired')  setStep('expired')
        if (d.status === 'withdrawn') setError('This offer has been withdrawn.')
        setLoading(false)
      })
      .catch(() => { setError('Failed to load offer. Please try again.'); setLoading(false) })
  }, [token])

  // ── Canvas drawing ─────────────────────────────────────────────────────────

  function getPos(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect()
    const scaleX = canvasRef.current!.width  / rect.width
    const scaleY = canvasRef.current!.height / rect.height
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY }
  }

  function startDraw(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault()
    drawing.current = true
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const { x, y } = getPos(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  function draw(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault()
    if (!drawing.current) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const { x, y } = getPos(e)
    ctx.lineTo(x, y)
    ctx.strokeStyle = '#1a1a1a'
    ctx.lineWidth   = 2.5
    ctx.lineCap     = 'round'
    ctx.lineJoin    = 'round'
    ctx.stroke()
  }

  function endDraw(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault()
    drawing.current = false
  }

  function clearCanvas() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }

  function getSignatureData(): string | undefined {
    if (sigMode === 'type') {
      if (!typedSig.trim()) return undefined
      const canvas  = document.createElement('canvas')
      canvas.width  = 560; canvas.height = 120
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.font      = 'italic 40px Georgia, serif'
      ctx.fillStyle = '#1a1a1a'
      ctx.fillText(typedSig.trim(), 20, 75)
      return canvas.toDataURL('image/png')
    }
    return canvasRef.current?.toDataURL('image/png')
  }

  async function handleSubmit(a: 'accept' | 'reject') {
    setSubmitting(true)
    const signature = a === 'accept' ? getSignatureData() : undefined
    try {
      const res  = await fetch(`/api/offer-letter/${token}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: a, signature }),
      })
      const data = await res.json()
      if (!res.ok) { alert(data.error ?? 'Something went wrong.'); setSubmitting(false); return }
      setStep(a === 'accept' ? 'done' : 'declined')
    } catch {
      alert('Network error — please try again.')
      setSubmitting(false)
    }
  }

  const color = offer?.primaryColor ?? '#0E3D52'

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400 text-sm animate-pulse">Loading your offer…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl p-10 shadow-sm border border-gray-200 text-center max-w-md">
          <div className="text-5xl mb-4">🔗</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Link unavailable</h1>
          <p className="text-sm text-gray-500">{error}</p>
        </div>
      </div>
    )
  }

  if (!offer) return null

  // ── Terminal states ────────────────────────────────────────────────────────

  if (step === 'done') {
    return (
      <PageShell offer={offer} color={color}>
        <div className="text-center py-8">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Offer accepted!</h2>
          <p className="text-gray-500 text-sm leading-relaxed">
            Thank you, <strong>{offer.candidateName}</strong>. You've accepted the offer for <strong>{offer.position}</strong>
            {offer.orgName ? ` at ${offer.orgName}` : ''}.
            {offer.acceptedAt && (
              <span className="block mt-1 text-gray-400">
                Accepted {new Date(offer.acceptedAt).toLocaleString('en-AU', { dateStyle: 'long', timeStyle: 'short' })}
              </span>
            )}
          </p>
          <p className="mt-4 text-xs text-gray-400">HR will be in touch with next steps. You may close this window.</p>
        </div>
      </PageShell>
    )
  }

  if (step === 'declined') {
    return (
      <PageShell offer={offer} color={color}>
        <div className="text-center py-8">
          <div className="text-5xl mb-4">👋</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Offer declined</h2>
          <p className="text-gray-500 text-sm">
            Thank you for letting us know, <strong>{offer.candidateName}</strong>. The HR team has been notified.
          </p>
          <p className="mt-4 text-xs text-gray-400">You may close this window.</p>
        </div>
      </PageShell>
    )
  }

  if (step === 'expired') {
    return (
      <PageShell offer={offer} color={color}>
        <div className="text-center py-8">
          <div className="text-5xl mb-4">⏰</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Offer expired</h2>
          <p className="text-gray-500 text-sm">
            This offer letter has passed its expiry date. Please contact HR if you'd like to discuss further.
          </p>
        </div>
      </PageShell>
    )
  }

  // ── Sign step ──────────────────────────────────────────────────────────────

  if (step === 'sign') {
    return (
      <PageShell offer={offer} color={color}>
        <div className="space-y-5">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Sign your offer</h2>
            <p className="text-sm text-gray-500 mt-1">
              By signing, you confirm your acceptance of the offer for <strong>{offer.position}</strong>
              {offer.orgName ? ` at ${offer.orgName}` : ''}.
            </p>
          </div>

          {/* Mode toggle */}
          <div className="flex bg-gray-100 rounded-xl p-1 w-fit">
            {(['draw', 'type'] as const).map(m => (
              <button key={m} onClick={() => setSigMode(m)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${sigMode === m ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                {m === 'draw' ? '✏️ Draw' : '⌨️ Type'}
              </button>
            ))}
          </div>

          {sigMode === 'draw' ? (
            <div className="space-y-2">
              <p className="text-xs text-gray-400">Draw your signature below:</p>
              <div className="border-2 border-gray-200 rounded-xl overflow-hidden bg-white relative">
                <canvas
                  ref={canvasRef}
                  width={560}
                  height={140}
                  className="w-full touch-none cursor-crosshair"
                  onMouseDown={startDraw}
                  onMouseMove={draw}
                  onMouseUp={endDraw}
                  onMouseLeave={endDraw}
                  onTouchStart={startDraw}
                  onTouchMove={draw}
                  onTouchEnd={endDraw}
                />
                <div className="absolute bottom-8 left-4 right-4 border-t border-dashed border-gray-200 pointer-events-none" />
                <p className="absolute bottom-2 left-4 text-[10px] text-gray-300 pointer-events-none">Sign here</p>
              </div>
              <button onClick={clearCanvas} className="text-xs text-gray-400 hover:text-gray-600">Clear</button>
            </div>
          ) : (
            <div>
              <p className="text-xs text-gray-400 mb-1">Type your full name to sign:</p>
              <input
                type="text"
                value={typedSig}
                onChange={e => setTypedSig(e.target.value)}
                placeholder={offer.candidateName}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-2xl italic text-gray-800 focus:outline-none focus:border-[#1A6080]"
                style={{ fontFamily: 'Georgia, serif' }}
              />
            </div>
          )}

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800 leading-relaxed">
            By clicking <strong>Accept Offer</strong> you agree that this electronic signature is legally binding and represents your acceptance of all terms in the offer letter.
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep('view')}
              className="flex-1 py-3 rounded-xl text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition">
              ← Back
            </button>
            <button onClick={() => handleSubmit('reject')} disabled={submitting}
              className="flex-1 py-3 rounded-xl text-sm font-semibold border border-red-200 text-red-600 hover:bg-red-50 transition disabled:opacity-50">
              Decline offer
            </button>
            <button
              onClick={() => handleSubmit('accept')}
              disabled={submitting || (sigMode === 'type' && !typedSig.trim())}
              className="flex-1 py-3 rounded-xl text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              style={{ background: color }}>
              {submitting ? 'Submitting…' : 'Accept offer ✓'}
            </button>
          </div>
        </div>
      </PageShell>
    )
  }

  // ── View offer ─────────────────────────────────────────────────────────────

  return (
    <PageShell offer={offer} color={color}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Your offer letter</h2>
          <p className="text-sm text-gray-500 mt-1">Please review carefully before accepting or declining.</p>
        </div>

        {/* Key offer details */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Position',   value: offer.position },
            { label: 'Employment', value: EMP_TYPE_LABELS[offer.employmentType] ?? offer.employmentType },
            offer.department ? { label: 'Department', value: offer.department } : null,
            offer.startDate  ? { label: 'Start Date',  value: fmtDate(offer.startDate) } : null,
            offer.salaryAmount ? { label: 'Remuneration', value: fmtSalary(offer.salaryAmount, offer.salaryCycle) } : null,
            offer.expiresAt  ? { label: 'Offer Expires', value: fmtDate(offer.expiresAt) } : null,
          ].filter(Boolean).map((item, i) => (
            <div key={i} className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-0.5">{item!.label}</p>
              <p className="text-sm font-semibold text-gray-800">{item!.value}</p>
            </div>
          ))}
        </div>

        {/* PDF or template content */}
        {offer.pdfUrl ? (
          <div className="border border-gray-200 rounded-xl overflow-hidden bg-gray-50" style={{ height: 480 }}>
            <iframe src={offer.pdfUrl} className="w-full h-full" title="Offer letter PDF" />
          </div>
        ) : offer.templateContent ? (
          <div className="border border-gray-200 rounded-xl p-5 bg-gray-50 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
            {offer.templateContent}
          </div>
        ) : (
          <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-8 text-center">
            <p className="text-sm text-gray-400">Your offer letter is attached. Click <strong>Review &amp; Sign</strong> to proceed.</p>
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={() => handleSubmit('reject')} disabled={submitting}
            className="flex-1 py-3 rounded-xl text-sm font-semibold border border-red-200 text-red-600 hover:bg-red-50 transition disabled:opacity-50">
            Decline offer
          </button>
          <button onClick={() => setStep('sign')}
            className="flex-1 py-3 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
            style={{ background: color }}>
            Review &amp; Sign →
          </button>
        </div>
      </div>
    </PageShell>
  )
}

// ── Shared shell ───────────────────────────────────────────────────────────

function PageShell({ offer, color, children }: {
  offer: Pick<OfferData, 'candidateName' | 'orgName' | 'logoUrl' | 'position'>
  color: string
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-10 px-4">
      <div className="w-full max-w-2xl space-y-6">

        {/* Header */}
        <div className="rounded-2xl p-6 text-white flex items-center gap-4"
          style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }}>
          {offer.logoUrl ? (
            <img src={offer.logoUrl} alt={offer.orgName ?? ''} className="h-12 max-w-[120px] object-contain bg-white/20 rounded-lg p-1" />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center text-2xl font-bold">
              {offer.orgName?.[0] ?? 'H'}
            </div>
          )}
          <div>
            <p className="text-sm font-medium opacity-80">{offer.orgName ?? 'Organisation'}</p>
            <h1 className="text-xl font-bold leading-tight">Offer letter for {offer.candidateName}</h1>
            <p className="text-xs opacity-70 mt-0.5">{offer.position}</p>
          </div>
        </div>

        {/* Content card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          {children}
        </div>

        <p className="text-center text-xs text-gray-300">
          Powered by HRMS · This is a secure, private link for {offer.candidateName} only.
        </p>
      </div>
    </div>
  )
}
