import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Building2, CheckCircle2, LoaderCircle, LockKeyhole, QrCode } from 'lucide-react'
import api from '../api/axios.js'
import '../styles/publicSite.css'

export default function MerchantPay() {
  const { merchantId } = useParams()
  const [merchant, setMerchant] = useState(null)
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ amount: '', firstName: '', lastName: '', email: '', phone: '' })

  useEffect(() => {
    api.get(`/merchant-qr/public/${encodeURIComponent(merchantId)}`)
      .then((response) => setMerchant(response.data?.data))
      .catch((requestError) => setError(requestError.response?.data?.message || 'This merchant is not accepting payments right now.'))
      .finally(() => setLoading(false))
  }, [merchantId])

  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  const submit = async (event) => {
    event.preventDefault()
    setError('')
    const amount = Number(form.amount)
    if (!(amount > 0)) return setError('Enter a valid payment amount.')
    try {
      setPaying(true)
      const response = await api.post('/merchant-qr/payment-order', { ...form, amount, merchantId })
      const checkoutUrl = response.data?.data?.checkoutUrl
      if (!checkoutUrl) throw new Error('Payment page was not returned.')
      window.location.assign(checkoutUrl)
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || 'Payment could not be started.')
      setPaying(false)
    }
  }

  return <main className="public-page portal-shell">
    <section className="public-section" style={{ minHeight: '76vh', display: 'grid', placeItems: 'center' }}>
      <div className="public-panel" style={{ width: 'min(100%, 520px)' }}>
        {loading ? <div style={{ textAlign: 'center', padding: 40 }}><LoaderCircle className="spin" /><p>Checking merchant...</p></div> : <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22 }}>
            <div style={{ width: 52, height: 52, display: 'grid', placeItems: 'center', borderRadius: 8, background: '#e8f8f4', color: '#075e54' }}><Building2 /></div>
            <div><small style={{ color: '#64748b', fontWeight: 700 }}>PAYING TO</small><h1 style={{ margin: '3px 0', fontSize: 24 }}>{merchant?.businessName || 'Khatu Pay Business'}</h1><span style={{ color: '#64748b' }}>{merchant?.category}</span></div>
          </div>
          {error && <div style={{ background: '#fef2f2', color: '#b91c1c', padding: 12, borderRadius: 8, marginBottom: 14 }}>{error}</div>}
          {merchant && <form onSubmit={submit} style={{ display: 'grid', gap: 13 }}>
            <label>Amount<input name="amount" value={form.amount} onChange={update} type="number" min="1" step="0.01" required placeholder="Enter amount" /></label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}><label>First name<input name="firstName" value={form.firstName} onChange={update} required /></label><label>Last name<input name="lastName" value={form.lastName} onChange={update} /></label></div>
            <label>Mobile number<input name="phone" value={form.phone} onChange={update} inputMode="numeric" pattern="[6-9][0-9]{9}" required /></label>
            <label>Email receipt<input name="email" value={form.email} onChange={update} type="email" required /></label>
            <button className="public-btn primary" disabled={paying} style={{ justifyContent: 'center', width: '100%', border: 0 }}>{paying ? <><LoaderCircle size={18} className="spin" /> Starting secure payment</> : <>Pay securely <QrCode size={18} /></>}</button>
          </form>}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 18, color: '#64748b', fontSize: 13 }}><LockKeyhole size={16} /><span>Payment details are sent securely to the payment provider.</span><CheckCircle2 size={16} color="#00a884" /></div>
        </>}
      </div>
    </section>
  </main>
}
