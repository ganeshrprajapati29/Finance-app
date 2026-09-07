import { useState } from 'react'
import { Alert, Badge, Button, Card, Col, Form, Row, Spinner } from 'react-bootstrap'
import api from '../api/axios'

const emptyResult = { title: '', data: null }

const ClubAPITools = () => {
  const [loading, setLoading] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [result, setResult] = useState(emptyResult)
  const [upi, setUpi] = useState({ upiId: '' })
  const [pan, setPan] = useState({ pan: '' })
  const [aadhaar, setAadhaar] = useState({ aadhaarNumber: '', aadhaarMobile: '', otp: '', otpSessionId: '' })
  const [recharge, setRecharge] = useState({ mobile: '', operatorId: '', amount: '', customerMobile: '', cbId: '', opvalue1: '', opvalue2: '' })
  const [bbps, setBbps] = useState({ mobile: '', bbpsId: '', customerMobile: '', amount: '', opvalue1: '', opvalue2: '', opvalue3: '', opvalue4: '', opvalue5: '' })

  const run = async (key, title, request, message) => {
    try {
      setLoading(key)
      setError('')
      setSuccess('')
      setResult(emptyResult)
      const response = await request()
      const data = response.data?.data || response.data
      setResult({ title, data })
      setSuccess(message || `${title} response received`)
      return data
    } catch (err) {
      setError(err.response?.data?.message || err.message || `${title} failed`)
      return null
    } finally {
      setLoading('')
    }
  }

  const change = (setter, upperFields = []) => (field, value) => {
    setter((current) => ({ ...current, [field]: upperFields.includes(field) ? value.toUpperCase() : value }))
  }

  const clean = (payload) => Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== ''))
  const busy = Boolean(loading)

  return (
    <div className="club-tools-page">
      <div className="tools-head">
        <div>
          <p>Club API</p>
          <h2>Service Tools</h2>
          <span>Admin console for validation, KYC, recharge and BBPS actions.</span>
        </div>
        <Badge bg={busy ? 'warning' : 'success'}>{busy ? 'Processing' : 'Ready'}</Badge>
      </div>

      {error && <Alert variant="danger" dismissible onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert variant="success" dismissible onClose={() => setSuccess('')}>{success}</Alert>}

      <Row className="g-3">
        <Col lg={4}>
          <ToolCard title="UPI Validation">
            <Form.Control className="mb-2" placeholder="name@upi" value={upi.upiId} onChange={(e) => setUpi({ upiId: e.target.value })} />
            <ActionButton loading={loading === 'upi'} label="Validate UPI" onClick={() => run('upi', 'UPI Validation', () => api.post('/admin/clubapi/upi/validate', upi))} />
          </ToolCard>
        </Col>

        <Col lg={4}>
          <ToolCard title="PAN Details">
            <Form.Control className="mb-2" placeholder="ABCDE1234F" value={pan.pan} onChange={(e) => setPan({ pan: e.target.value.toUpperCase() })} />
            <ActionButton loading={loading === 'pan'} label="Verify PAN" onClick={() => run('pan', 'PAN Details', () => api.post('/admin/clubapi/pan/verify', pan))} />
          </ToolCard>
        </Col>

        <Col lg={4}>
          <ToolCard title="Aadhaar Offline eKYC">
            <Form.Control className="mb-2" placeholder="Aadhaar number" value={aadhaar.aadhaarNumber} onChange={(e) => change(setAadhaar)('aadhaarNumber', e.target.value)} />
            <Form.Control className="mb-2" placeholder="Aadhaar linked mobile" value={aadhaar.aadhaarMobile} onChange={(e) => change(setAadhaar)('aadhaarMobile', e.target.value)} />
            <Form.Control className="mb-2" placeholder="OTP" value={aadhaar.otp} onChange={(e) => change(setAadhaar)('otp', e.target.value)} />
            <Form.Control className="mb-2" placeholder="OTP Session ID" value={aadhaar.otpSessionId} onChange={(e) => change(setAadhaar)('otpSessionId', e.target.value)} />
            <div className="tool-actions">
              <ActionButton loading={loading === 'aadhaar-send'} label="Send OTP" onClick={() => run('aadhaar-send', 'Aadhaar OTP', () => api.post('/admin/clubapi/aadhaar/send-otp', clean(aadhaar)))} />
              <ActionButton variant="outline-success" loading={loading === 'aadhaar-verify'} label="Verify OTP" onClick={() => run('aadhaar-verify', 'Aadhaar Verify', () => api.post('/admin/clubapi/aadhaar/verify-otp', clean(aadhaar)))} />
            </div>
          </ToolCard>
        </Col>

        <Col lg={6}>
          <ToolCard title="Mobile / DTH Recharge">
            <Row className="g-2">
              <Col md={6}><Form.Control placeholder="Mobile / DTH number" value={recharge.mobile} onChange={(e) => change(setRecharge)('mobile', e.target.value)} /></Col>
              <Col md={6}><Form.Control placeholder="Operator ID" value={recharge.operatorId} onChange={(e) => change(setRecharge)('operatorId', e.target.value)} /></Col>
              <Col md={6}><Form.Control placeholder="Amount" value={recharge.amount} onChange={(e) => change(setRecharge)('amount', e.target.value)} /></Col>
              <Col md={6}><Form.Control placeholder="Customer Mobile" value={recharge.customerMobile} onChange={(e) => change(setRecharge)('customerMobile', e.target.value)} /></Col>
              <Col md={6}><Form.Control placeholder="Callback ID" value={recharge.cbId} onChange={(e) => change(setRecharge)('cbId', e.target.value)} /></Col>
              <Col md={3}><Form.Control placeholder="opvalue1" value={recharge.opvalue1} onChange={(e) => change(setRecharge)('opvalue1', e.target.value)} /></Col>
              <Col md={3}><Form.Control placeholder="opvalue2" value={recharge.opvalue2} onChange={(e) => change(setRecharge)('opvalue2', e.target.value)} /></Col>
            </Row>
            <div className="tool-actions mt-3">
              <ActionButton variant="outline-primary" loading={loading === 'recharge-validate'} label="Validate Amount" onClick={() => run('recharge-validate', 'Recharge Amount', () => api.post('/admin/clubapi/recharge/validate-amount', {
                mobile: recharge.mobile,
                operatorId: recharge.operatorId,
                rechargeAmount: recharge.amount
              }))} />
              <ActionButton variant="danger" loading={loading === 'recharge'} label="Run Recharge" onClick={() => {
                if (!window.confirm(`Recharge ${recharge.mobile} for Rs. ${recharge.amount}?`)) return
                run('recharge', 'Recharge', () => api.post('/admin/clubapi/recharge', clean(recharge)))
              }} />
            </div>
          </ToolCard>
        </Col>

        <Col lg={6}>
          <ToolCard title="BBPS Bill Payment">
            <Row className="g-2">
              <Col md={6}><Form.Control placeholder="BBPS ID" value={bbps.bbpsId} onChange={(e) => change(setBbps)('bbpsId', e.target.value)} /></Col>
              <Col md={6}><Form.Control placeholder="Consumer / Account Number" value={bbps.mobile} onChange={(e) => change(setBbps)('mobile', e.target.value)} /></Col>
              <Col md={6}><Form.Control placeholder="Customer Mobile" value={bbps.customerMobile} onChange={(e) => change(setBbps)('customerMobile', e.target.value)} /></Col>
              <Col md={6}><Form.Control placeholder="Amount" value={bbps.amount} onChange={(e) => change(setBbps)('amount', e.target.value)} /></Col>
              {[1, 2, 3, 4, 5].map((i) => (
                <Col md={i < 3 ? 6 : 4} key={i}>
                  <Form.Control placeholder={`opvalue${i}`} value={bbps[`opvalue${i}`]} onChange={(e) => change(setBbps)(`opvalue${i}`, e.target.value)} />
                </Col>
              ))}
            </Row>
            <div className="tool-actions mt-3">
              <ActionButton variant="outline-primary" loading={loading === 'bbps-fetch'} label="Fetch Bill" onClick={() => run('bbps-fetch', 'BBPS Fetch Bill', () => api.post('/admin/clubapi/bbps/fetch-bill', clean(bbps)))} />
              <ActionButton variant="danger" loading={loading === 'bbps-pay'} label="Pay Bill" onClick={() => {
                if (!window.confirm(`Pay BBPS bill Rs. ${bbps.amount} for ${bbps.mobile}?`)) return
                run('bbps-pay', 'BBPS Pay Bill', () => api.post('/admin/clubapi/bbps/pay-bill', clean(bbps)))
              }} />
            </div>
          </ToolCard>
        </Col>
      </Row>

      {result.data && (
        <Card className="tools-result mt-3">
          <Card.Header>{result.title}</Card.Header>
          <Card.Body>
            <pre>{JSON.stringify(result.data, null, 2)}</pre>
          </Card.Body>
        </Card>
      )}

      <style>{`
        .club-tools-page{padding:8px 0 24px;color:#111827}.tools-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:18px}.tools-head p{margin:0 0 4px;color:#0f766e;font-size:12px;font-weight:900;text-transform:uppercase}.tools-head h2{margin:0;font-weight:850}.tools-head span{color:#64748b}.tool-card,.tools-result{border:1px solid #e5e7eb;border-radius:8px;box-shadow:0 10px 26px rgba(15,23,42,.06)}.tool-card{padding:16px;height:100%}.tool-card h5{font-weight:850;margin-bottom:14px}.tool-actions{display:flex;gap:10px;flex-wrap:wrap}.tools-result pre{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px;white-space:pre-wrap;margin:0}.btn{font-weight:800}
      `}</style>
    </div>
  )
}

const ToolCard = ({ title, children }) => (
  <Card className="tool-card">
    <h5>{title}</h5>
    {children}
  </Card>
)

const ActionButton = ({ loading, label, onClick, variant = 'primary' }) => (
  <Button variant={variant} onClick={onClick} disabled={loading}>
    {loading ? <Spinner animation="border" size="sm" /> : label}
  </Button>
)

export default ClubAPITools
