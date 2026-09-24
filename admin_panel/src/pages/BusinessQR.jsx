import { useEffect, useMemo, useState } from 'react'
import { Alert, Badge, Button, Card, Col, Form, Modal, Row, Spinner, Table } from 'react-bootstrap'
import { Ban, Building2, CheckCircle2, CircleDollarSign, Copy, ExternalLink, Eye, Power, QrCode, Send, XCircle } from 'lucide-react'
import api from '../api/axios.js'
import khatuLogo from '../assets/khatulogo-removebg-preview.png'

const money = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value || 0))
const date = (value) => value ? new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'N/A'
const statusTone = (status) => ({ APPROVED: 'success', ACTIVE: 'success', VERIFIED: 'success', SUCCESS: 'success', REVIEW: 'warning', REJECTED: 'danger', FAILED: 'danger', DISABLED: 'danger', SUSPENDED: 'danger', PENDING: 'warning', PROCESSING: 'warning', REQUESTED: 'warning', SUBMITTED: 'warning', UNDER_REVIEW: 'warning', DRAFT: 'secondary', CREATED: 'secondary' }[String(status || '').toUpperCase()] || 'secondary')
const canApproveBank = (status) => ['VERIFIED', 'REVIEW'].includes(String(status || '').toUpperCase())
const canActivateQr = (row) => canApproveBank(row?.bank?.status)
const textOf = (value) => {
  if (value == null || value === '') return 'N/A'
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  return String(value)
}

export default function BusinessQR() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('ALL')
  const [selected, setSelected] = useState(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const response = await api.get('/admin/merchant-businesses')
      setRows(Array.isArray(response.data?.data) ? response.data.data : [])
      setError('')
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Business QR records could not be loaded.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => rows.filter((row) => {
    const business = row.business || {}
    const value = `${business.businessName || ''} ${business.ownerName || ''} ${business.publicId || ''} ${business.mobile || ''}`.toLowerCase()
    return (filter === 'ALL' || business.status === filter) && value.includes(query.trim().toLowerCase())
  }), [rows, filter, query])

  const totals = useMemo(() => rows.reduce((sum, row) => {
    sum.businesses += 1
    sum.approved += row.business?.status === 'APPROVED' ? 1 : 0
    sum.activeQr += row.qr?.status === 'ACTIVE' ? 1 : 0
    sum.collected += Number(row.payments?.collectedAmount || 0)
    sum.pending += Number(row.settlements?.pendingAmount || 0)
    return sum
  }, { businesses: 0, approved: 0, activeQr: 0, collected: 0, pending: 0 }), [rows])

  const replaceRow = (updatedRow) => {
    if (!updatedRow) return
    setSelected(updatedRow)
    setRows((items) => items.map((item) => item.business?._id === updatedRow.business?._id ? updatedRow : item))
  }

  const decide = async (decision) => {
    if (!selected) return
    let reason = ''
    if (decision === 'REJECTED') {
      reason = window.prompt('Enter a customer-friendly reason for rejection:')?.trim() || ''
      if (!reason) return
    }
    setSaving(true)
    try {
      const response = await api.post(`/admin/merchant-businesses/${selected.business._id}/decision`, { decision, reason })
      setNotice(response.data?.message || `Business ${decision.toLowerCase()}.`)
      setSelected(null)
      await load()
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Business decision could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  const updateBankStatus = async (status) => {
    if (!selected) return
    const label = status === 'VERIFIED' ? 'VERIFIED' : 'REVIEW'
    const note = window.prompt(`Add a note for marking bank ${label}:`, status === 'VERIFIED' ? 'Verified by Khatu Pay team.' : 'Reviewed by Khatu Pay team.')?.trim()
    if (note == null) return
    setSaving(true)
    try {
      const response = await api.post(`/admin/merchant-businesses/${selected.business._id}/bank-status`, { status, note })
      setNotice(response.data?.message || `Bank marked ${label}.`)
      replaceRow(response.data?.data?.row)
      if (!response.data?.data?.row) await load()
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Bank status could not be updated.')
    } finally {
      setSaving(false)
    }
  }

  const updateQrStatus = async (status) => {
    if (!selected) return
    const label = status === 'ACTIVE' ? 'enable' : 'disable'
    const note = window.prompt(`Add a note to ${label} this business QR:`, status === 'ACTIVE' ? 'Enabled by Khatu Pay team.' : 'Disabled by Khatu Pay team.')?.trim()
    if (note == null) return
    setSaving(true)
    try {
      const response = await api.post(`/admin/merchant-businesses/${selected.business._id}/qr-status`, { status, note })
      setNotice(response.data?.message || `Business QR ${status === 'ACTIVE' ? 'enabled' : 'disabled'}.`)
      replaceRow(response.data?.data?.row)
      if (!response.data?.data?.row) await load()
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Business QR status could not be updated.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="container-fluid py-3">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div>
          <p className="text-uppercase text-primary fw-bold small mb-1">Business collections</p>
          <h2 className="mb-1">Business QR</h2>
          <p className="text-muted mb-0">Review merchant profiles, activate eligible QR collections, and monitor settlement activity.</p>
        </div>
        <Button variant="outline-primary" onClick={load} disabled={loading}>Refresh</Button>
      </div>
      {notice && <Alert variant="success" dismissible onClose={() => setNotice('')}>{notice}</Alert>}
      {error && <Alert variant="danger" dismissible onClose={() => setError('')}>{error}</Alert>}

      <Row className="g-3 mb-4">
        <Metric icon={Building2} label="Business profiles" value={totals.businesses} />
        <Metric icon={CheckCircle2} label="Approved businesses" value={totals.approved} tone="success" />
        <Metric icon={QrCode} label="Active QR codes" value={totals.activeQr} tone="primary" />
        <Metric icon={CircleDollarSign} label="Collections received" value={money(totals.collected)} tone="success" />
        <Metric icon={Send} label="Settlement pending" value={money(totals.pending)} tone="warning" />
      </Row>

      <Card className="border-0 shadow-sm">
        <Card.Body>
          <Row className="g-2 mb-3">
            <Col md={7}><Form.Control value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search business, owner, mobile or business ID" /></Col>
            <Col md={3}><Form.Select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="ALL">All statuses</option><option value="SUBMITTED">Submitted</option><option value="UNDER_REVIEW">Under review</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option><option value="SUSPENDED">Suspended</option></Form.Select></Col>
            <Col md={2}><Button className="w-100" variant="outline-secondary" onClick={() => { setQuery(''); setFilter('ALL') }}>Clear</Button></Col>
          </Row>
          <div className="table-responsive">
            <Table hover className="align-middle mb-0">
              <thead><tr><th>Business</th><th>Verification</th><th>QR</th><th>Collections</th><th>Settlements</th><th>Status</th><th className="text-end">Action</th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan="7" className="text-center py-5"><Spinner size="sm" className="me-2" />Loading business QR records...</td></tr> : filtered.length === 0 ? <tr><td colSpan="7" className="text-center text-muted py-5">No business profiles found.</td></tr> : filtered.map((row) => <BusinessRow key={row.business?._id} row={row} onView={() => setSelected(row)} />)}
              </tbody>
            </Table>
          </div>
        </Card.Body>
      </Card>
      <BusinessModal row={selected} onHide={() => setSelected(null)} onDecision={decide} onBankStatus={updateBankStatus} onQrStatus={updateQrStatus} saving={saving} />
    </div>
  )
}

function Metric({ icon: Icon, label, value, tone = 'primary' }) {
  return <Col xl md={6}><Card className="border-0 shadow-sm h-100"><Card.Body className="d-flex gap-3 align-items-center"><div className={`text-${tone}`}><Icon size={25} /></div><div><small className="text-muted fw-semibold">{label}</small><h4 className="mb-0 mt-1">{value}</h4></div></Card.Body></Card></Col>
}

function BusinessRow({ row, onView }) {
  const business = row.business || {}
  const qrStatus = row.qr?.status || 'NOT GENERATED'
  return <tr><td><strong>{business.businessName || 'Unnamed business'}</strong><small className="d-block text-muted">{business.ownerName || 'N/A'} | {business.mobile || 'N/A'}</small><small className="d-block text-muted">{business.publicId || 'N/A'}</small></td><td><Badge bg={statusTone(row.kyc?.status)} className="me-1">KYC {row.kyc?.status || 'PENDING'}</Badge><Badge bg={statusTone(row.bank?.status)}>Bank {row.bank?.status || 'PENDING'}</Badge></td><td><Badge bg={statusTone(qrStatus)}>{String(qrStatus).replaceAll('_', ' ')}</Badge>{row.qr?.qrReference && <small className="d-block text-muted">{row.qr.qrReference}</small>}</td><td><strong>{money(row.payments?.collectedAmount)}</strong><small className="d-block text-muted">{row.payments?.successful || 0} successful / {row.payments?.total || 0} total</small></td><td><strong>{money(row.settlements?.settledAmount)}</strong><small className="d-block text-muted">Pending {money(row.settlements?.pendingAmount)}</small></td><td><Badge bg={statusTone(business.status)}>{String(business.status || 'DRAFT').replaceAll('_', ' ')}</Badge></td><td className="text-end"><Button size="sm" variant="outline-primary" title="View business" onClick={onView}><Eye size={16} /></Button></td></tr>
}

function BusinessModal({ row, onHide, onDecision, onBankStatus, onQrStatus, saving }) {
  if (!row) return null
  const business = row.business || {}
  const bank = row.bank || {}
  const verification = bank.verificationData || {}
  const businessApproved = String(business.status || '').toUpperCase() === 'APPROVED'
  const qrStatus = String(row.qr?.status || '').toUpperCase()
  const qrActive = qrStatus === 'ACTIVE'
  const qrDisabled = qrStatus === 'DISABLED'
  const approvalBlocked = !canActivateQr(row)
  const primaryLabel = businessApproved && !qrActive ? 'Activate QR' : 'Approve & activate QR'

  return (
    <Modal show onHide={onHide} size="xl" centered>
      <Modal.Header closeButton><Modal.Title>Business QR profile</Modal.Title></Modal.Header>
      <Modal.Body>
        <Row className="g-3 mb-3">
          <Col lg={7}>
            <Card bg="light" className="border-0 h-100"><Card.Body><small className="text-muted fw-bold">BUSINESS</small><h4 className="mt-1 mb-2">{business.businessName}</h4><p className="mb-1">{business.ownerName} | {business.mobile}</p><small className="text-muted">{business.publicId} | Submitted {date(business.createdAt)}</small></Card.Body></Card>
          </Col>
          <Col lg={5}>
            <Card className="border-0 bg-light h-100"><Card.Body><small className="text-muted fw-bold">BUSINESS STATUS</small><h4 className="mt-2"><Badge bg={statusTone(business.status)}>{business.status}</Badge></h4><small className="text-muted">{business.rejectionReason || 'No review note'}</small></Card.Body></Card>
          </Col>
        </Row>

        <Row className="g-4">
          <Col xl={5}>
            <QrPreview row={row} />
            <div className="d-grid gap-2 mt-3">
              {row.qr?.payload && <Button size="sm" variant="outline-primary" onClick={() => navigator.clipboard?.writeText(row.qr.payload)}><Copy size={15} className="me-1" />Copy QR payment link</Button>}
              {row.qr?.paymentUrl && <Button size="sm" variant="outline-secondary" onClick={() => window.open(row.qr.paymentUrl, '_blank', 'noopener,noreferrer')}><ExternalLink size={15} className="me-1" />Open payment page</Button>}
              {qrActive && <Button size="sm" variant="outline-danger" disabled={saving} onClick={() => onQrStatus('DISABLED')}><Ban size={15} className="me-1" />Disable QR</Button>}
              {qrDisabled && <Button size="sm" variant="outline-success" disabled={saving || approvalBlocked} onClick={() => onQrStatus('ACTIVE')}><Power size={15} className="me-1" />Enable QR</Button>}
            </div>
          </Col>
          <Col xl={7}>
            <Detail title="KYC and bank verification" items={[['KYC', row.kyc?.status || 'PENDING'], ['Business type', row.kyc?.businessType || 'N/A'], ['GST', row.kyc?.gstNumber || 'Not provided'], ['Business proof', row.kyc?.documents?.businessProofUrl || 'N/A'], ['Bank', bank.bankName || 'N/A'], ['Account holder', bank.accountHolderName || 'N/A'], ['Account', bank.accountNumberMasked || 'N/A'], ['IFSC', bank.ifscCode || 'N/A'], ['Bank status', bank.status || 'PENDING'], ['Bank provider', bank.verificationProvider || 'N/A'], ['Verification ref', bank.verificationReference || 'N/A'], ['Verification message', bank.verificationMessage || verification.message || 'N/A'], ['Provider response', verification.bankResponse || verification.signcare?.message || 'N/A'], ['Review reason', verification.reviewReason || 'N/A']]} />
            {bank._id && <div className="d-flex flex-wrap gap-2 mb-3"><Button size="sm" variant="outline-warning" disabled={saving || String(bank.status || '').toUpperCase() === 'REVIEW'} onClick={() => onBankStatus('REVIEW')}>Mark bank REVIEW</Button><Button size="sm" variant="outline-success" disabled={saving || String(bank.status || '').toUpperCase() === 'VERIFIED'} onClick={() => onBankStatus('VERIFIED')}>Mark bank VERIFIED</Button></div>}
            <Detail title="Business QR and collections" items={[['QR status', row.qr?.status || 'Not generated'], ['QR reference', row.qr?.qrReference || business.publicId || 'N/A'], ['Provider', row.qr?.provider || 'VELXAPAY'], ['Collection mode', row.qr?.collectionMode || 'VELXAPAY_CHECKOUT'], ['Payment page', row.qr?.paymentUrl || 'N/A'], ['QR payload', row.qr?.payload || 'N/A'], ['Disabled reason', row.qr?.disabledReason || 'N/A'], ['Successful collections', `${row.payments?.successful || 0} of ${row.payments?.total || 0}`], ['Amount received', money(row.payments?.collectedAmount)], ['Settlement pending', money(row.settlements?.pendingAmount)], ['Settlement completed', money(row.settlements?.settledAmount)]]} />
          </Col>
        </Row>

        {approvalBlocked && <Alert variant="warning" className="mt-3 mb-0">Bank account must be VERIFIED or REVIEW before QR can be activated.</Alert>}
        <QrStatusHistory rows={row.qr?.statusHistory || []} />
        <PaymentHistory rows={row.history?.payments || []} />
        <SettlementHistory rows={row.history?.settlements || []} />
      </Modal.Body>
      <Modal.Footer>
        {!businessApproved && <Button variant="outline-danger" disabled={saving} onClick={() => onDecision('REJECTED')}><XCircle size={16} className="me-1" />Reject</Button>}
        {(!businessApproved || !qrActive) && <Button disabled={saving || approvalBlocked} onClick={() => onDecision('APPROVED')} title={approvalBlocked ? 'Bank account must be verified or marked for review first' : primaryLabel}>{saving ? 'Saving...' : <><CheckCircle2 size={16} className="me-1" />{primaryLabel}</>}</Button>}
        <Button variant="secondary" onClick={onHide}>Close</Button>
      </Modal.Footer>
    </Modal>
  )
}

function QrPreview({ row }) {
  const qr = row.qr || {}
  const business = row.business || {}
  if (!qr.payload) {
    return <Card className="border-0 bg-light h-100"><Card.Body className="text-center py-5"><QrCode size={58} className="text-muted mb-3" /><h5>No QR generated</h5><p className="text-muted mb-0">Approve this business to generate a direct UPI QR.</p></Card.Body></Card>
  }
  return (
    <div style={{ maxWidth: 360, margin: '0 auto', border: '1px solid #d7eeea', borderRadius: 28, overflow: 'hidden', boxShadow: '0 16px 36px rgba(15, 118, 110, 0.16)', background: '#fff' }}>
      <div style={{ background: 'linear-gradient(135deg, #053c3b, #0f766e, #14b8a6)', padding: '24px 20px 48px', textAlign: 'center', color: '#fff' }}>
        <div style={{ width: 80, height: 80, display: 'grid', placeItems: 'center', margin: '0 auto 8px', borderRadius: 22, background: '#fff', boxShadow: '0 12px 28px rgba(0,0,0,0.18)' }}><img src={khatuLogo} alt="Khatu Pay" style={{ width: 66, height: 66, objectFit: 'contain' }} /></div>
        <h4 className="mb-1 fw-bold">KhatuPay</h4>
        <div style={{ color: '#d7fffb', fontWeight: 700 }}>{business.businessName || 'Business QR'}</div>
      </div>
      <div style={{ marginTop: -34, padding: '0 20px 22px', textAlign: 'center' }}>
        <div style={{ position: 'relative', width: 246, height: 246, margin: '0 auto', padding: 12, borderRadius: 24, background: '#fff', border: '1px solid #d7eeea', boxShadow: '0 12px 28px rgba(15,118,110,0.14)' }}>
          {qr.qrImageDataUrl ? <img src={qr.qrImageDataUrl} alt="Business UPI QR" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <div className="h-100 d-flex align-items-center justify-content-center text-muted small px-3">Refresh QR to create preview image</div>}
          <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: 46, height: 46, display: 'grid', placeItems: 'center', borderRadius: 14, background: '#fff', border: '1px solid #e5e7eb' }}><img src={khatuLogo} alt="" style={{ width: 34, height: 34, objectFit: 'contain' }} /></div>
        </div>
        <Badge bg={qr.status === 'ACTIVE' ? 'success' : 'danger'} className="mt-3">{qr.status === 'ACTIVE' ? 'SECURE VELXAPAY QR' : 'QR DISABLED'}</Badge>
        <div className="mt-2 fw-bold text-break">{qr.qrReference}</div>
        <small className="text-muted">Scan opens Khatu Pay payment page and creates VelxaPay checkout</small>
      </div>
    </div>
  )
}

function Detail({ title, items }) {
  return <div className="mb-4"><h6 className="fw-bold mb-3">{title}</h6><Row className="g-2">{items.map(([label, value]) => <Col md={6} key={label}><div className="border rounded p-2 h-100"><small className="text-muted d-block">{label}</small><span className="text-break" style={{ whiteSpace: typeof value === 'object' ? 'pre-wrap' : 'normal' }}>{textOf(value)}</span></div></Col>)}</Row></div>
}

function QrStatusHistory({ rows }) {
  return <HistoryCard title="QR status history" empty="No QR status history yet." hasRows={rows.length > 0}><Table size="sm" responsive className="align-middle mb-0"><thead><tr><th>Status</th><th>Note</th><th>Actor</th><th>Time</th></tr></thead><tbody>{rows.map((item, index) => <tr key={`${item.at || index}-${item.status}`}><td><Badge bg={statusTone(item.status)}>{item.status}</Badge></td><td className="text-break">{item.note || 'N/A'}</td><td>{item.actor || 'N/A'}</td><td>{date(item.at)}</td></tr>)}</tbody></Table></HistoryCard>
}

function PaymentHistory({ rows }) {
  return <HistoryCard title="Payment history" empty="No payments found yet." hasRows={rows.length > 0}><Table size="sm" responsive className="align-middle mb-0"><thead><tr><th>Order</th><th>Customer</th><th>Amount</th><th>Status</th><th>Time</th></tr></thead><tbody>{rows.map((item) => <tr key={item._id || item.orderId}><td className="text-break">{item.orderId}</td><td>{item.customer?.phone || item.customer?.email || 'N/A'}</td><td>{money(item.amount)}</td><td><Badge bg={statusTone(item.status)}>{item.status}</Badge></td><td>{date(item.createdAt)}</td></tr>)}</tbody></Table></HistoryCard>
}

function SettlementHistory({ rows }) {
  return <HistoryCard title="Settlement history" empty="No settlements found yet." hasRows={rows.length > 0}><Table size="sm" responsive className="align-middle mb-0"><thead><tr><th>ID</th><th>Amount</th><th>Status</th><th>Time</th></tr></thead><tbody>{rows.map((item) => <tr key={item._id}><td className="text-break">{item.settlementId || item._id}</td><td>{money(item.amount)}</td><td><Badge bg={statusTone(item.status)}>{item.status}</Badge></td><td>{date(item.createdAt)}</td></tr>)}</tbody></Table></HistoryCard>
}

function HistoryCard({ title, empty, hasRows, children }) {
  return <div className="mt-4"><h6 className="fw-bold mb-3">{title}</h6>{hasRows ? children : <div className="border rounded p-3 text-muted">{empty}</div>}</div>
}
