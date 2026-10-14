import React from 'react'
import { useSearchParams } from 'react-router-dom'

// Landing page for flows that finish outside the app's WebView (DigiLocker
// consent, Aadhaar eSign, Razorpay connect opened in a normal browser).
// Inside the app this URL is intercepted and never rendered.
const copy = {
  razorpay: { done: 'Razorpay connected', failed: 'Razorpay was not connected' },
  digilocker: { done: 'Identity verification completed', failed: 'Verification was not completed' },
  default: { done: 'All done', failed: 'This step was not completed' },
}

const SigningComplete = () => {
  const [params] = useSearchParams()
  const flow = copy[params.get('flow')] || copy.default
  const failed = ['failed', 'cancelled', 'error'].includes(String(params.get('status') || '').toLowerCase())
  const message = params.get('message')

  return (
    <div style={{ minHeight: '70vh', display: 'grid', placeItems: 'center', padding: 24, background: '#F7FAF9' }}>
      <div style={{ maxWidth: 440, width: '100%', background: '#fff', border: '1px solid #E5ECEA', borderRadius: 16, padding: 32, textAlign: 'center' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', margin: '0 auto 18px', display: 'grid', placeItems: 'center', fontSize: 34, color: '#fff', background: failed ? '#DC2626' : '#00A884' }}>
          {failed ? '!' : '✓'}
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', marginBottom: 10 }}>{failed ? flow.failed : flow.done}</h1>
        <p style={{ color: '#64748B', marginBottom: 0 }}>
          {message || (failed
            ? 'Please go back to the KhatuPay app and try again.'
            : 'You can close this page and return to the KhatuPay app.')}
        </p>
      </div>
    </div>
  )
}

export default SigningComplete
