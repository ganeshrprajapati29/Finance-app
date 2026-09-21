import { useEffect, useMemo, useState } from 'react'
import { Alert, Badge, Button, Card, Col, Form, Modal, Row, Spinner, Table } from 'react-bootstrap'
import { Building2, CheckCircle2, CircleDollarSign, Eye, QrCode, Send, XCircle } from 'lucide-react'
import api from '../api/axios.js'

const money = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value || 0))
const date = (value) => value ? new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'N/A'
const statusTone = (status) => ({ APPROVED: 'success', ACTIVE: 'success', VERIFIED: 'success', REJECTED: 'danger', FAILED: 'danger', SUSPENDED: 'danger', PENDING: 'warning', SUBMITTED: 'warning', UNDER_REVIEW: 'warning', DRAFT: 'secondary' }[String(status || '').toUpperCase()] || 'secondary')

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
    } finally { setLoading(false) }
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
    } finally { setSaving(false) }
  }

  return (
    <div className="container-fluid py-3">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div><p className="text-uppercase text-primary fw-bold small mb-1">Business collections</p><h2 className="mb-1">Business QR</h2><p className="text-muted mb-0">Review merchant profiles, activate eligible QR collections, and monitor settlement activity.</p></div>
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
          <Row className="g-2 mb-3"><Col md={7}><Form.Control value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search business, owner, mobile or business ID" /></Col><Col md={3}><Form.Select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="ALL">All statuses</option><option value="SUBMITTED">Submitted</option><option value="UNDER_REVIEW">Under review</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option><option value="SUSPENDED">Suspended</option></Form.Select></Col><Col md={2}><Button className="w-100" variant="outline-secondary" onClick={() => { setQuery(''); setFilter('ALL') }}>Clear</Button></Col></Row>
          <div className="table-responsive"><Table hover className="align-middle mb-0"><thead><tr><th>Business</th><th>Verification</th><th>QR</th><th>Collections</th><th>Settlements</th><th>Status</th><th className="text-end">Action</th></tr></thead><tbody>
            {loading ? <tr><td colSpan="7" className="text-center py-5"><Spinner size="sm" className="me-2" />Loading business QR records...</td></tr> : filtered.length === 0 ? <tr><td colSpan="7" className="text-center text-muted py-5">No business profiles found.</td></tr> : filtered.map((row) => <BusinessRow key={row.business?._id} row={row} onView={() => setSelected(row)} />)}
          </tbody></Table></div>
        </Card.Body>
      </Card>
      <BusinessModal row={selected} onHide={() => setSelected(null)} onDecision={decide} saving={saving} />
    </div>
  )
}

function Metric({ icon: Icon, label, value, tone = 'primary' }) { return <Col xl md={6}><Card className="border-0 shadow-sm h-100"><Card.Body className="d-flex gap-3 align-items-center"><div className={`text-${tone}`}><Icon size={25} /></div><div><small className="text-muted fw-semibold">{label}</small><h4 className="mb-0 mt-1">{value}</h4></div></Card.Body></Card></Col> }

function BusinessRow({ row, onView }) {
  const business = row.business || {}
  return <tr><td><strong>{business.businessName || 'Unnamed business'}</strong><small className="d-block text-muted">{business.ownerName || 'N/A'} | {business.mobile || 'N/A'}</small><small className="d-block text-muted">{business.publicId || 'N/A'}</small></td><td><Badge bg={statusTone(row.kyc?.status)} className="me-1">KYC {row.kyc?.status || 'PENDING'}</Badge><Badge bg={statusTone(row.bank?.status)}>Bank {row.bank?.status || 'PENDING'}</Badge></td><td>{row.qr?.status === 'ACTIVE' ? <><Badge bg="success">Active</Badge><small className="d-block text-muted">{row.qr.qrReference}</small></> : <span className="text-muted">Not generated</span>}</td><td><strong>{money(row.payments?.collectedAmount)}</strong><small className="d-block text-muted">{row.payments?.successful || 0} successful / {row.payments?.total || 0} total</small></td><td><strong>{money(row.settlements?.settledAmount)}</strong><small className="d-block text-muted">Pending {money(row.settlements?.pendingAmount)}</small></td><td><Badge bg={statusTone(business.status)}>{String(business.status || 'DRAFT').replaceAll('_', ' ')}</Badge></td><td className="text-end"><Button size="sm" variant="outline-primary" title="View business" onClick={onView}><Eye size={16} /></Button></td></tr>
}

function BusinessModal({ row, onHide, onDecision, saving }) {
  if (!row) return null
  const business = row.business || {}
  const approvalReady = row.kyc?.status !== 'VERIFIED' || row.bank?.status !== 'VERIFIED'
  return <Modal show onHide={onHide} size="lg" centered><Modal.Header closeButton><Modal.Title>Business QR profile</Modal.Title></Modal.Header><Modal.Body>
    <Row className="g-3 mb-3"><Col md={7}><Card bg="light" className="border-0 h-100"><Card.Body><small className="text-muted fw-bold">BUSINESS</small><h4 className="mt-1 mb-2">{business.businessName}</h4><p className="mb-1">{business.ownerName} | {business.mobile}</p><small className="text-muted">{business.publicId} | Submitted {date(business.createdAt)}</small></Card.Body></Card></Col><Col md={5}><Card className="border-0 bg-light h-100"><Card.Body><small className="text-muted fw-bold">BUSINESS STATUS</small><h4 className="mt-2"><Badge bg={statusTone(business.status)}>{business.status}</Badge></h4><small className="text-muted">{business.rejectionReason || 'No review note'}</small></Card.Body></Card></Col></Row>
    <Detail title="KYC and bank verification" items={[["KYC", row.kyc?.status || 'PENDING'], ['Business type', row.kyc?.businessType || 'N/A'], ['GST', row.kyc?.gstNumber || 'Not provided'], ['Bank', row.bank?.bankName || 'N/A'], ['Account holder', row.bank?.accountHolderName || 'N/A'], ['IFSC', row.bank?.ifscCode || 'N/A'], ['Bank status', row.bank?.status || 'PENDING']]} />
    <Detail title="Business QR and collections" items={[["QR status", row.qr?.status || 'Not generated'], ['QR reference', row.qr?.qrReference || 'N/A'], ['Public payment page', row.qr?.payload || 'Available after approval'], ['Successful collections', `${row.payments?.successful || 0} of ${row.payments?.total || 0}`], ['Amount received', money(row.payments?.collectedAmount)], ['Settlement pending', money(row.settlements?.pendingAmount)], ['Settlement completed', money(row.settlements?.settledAmount)]]} />
  </Modal.Body><Modal.Footer>{business.status !== 'APPROVED' && <><Button variant="outline-danger" disabled={saving} onClick={() => onDecision('REJECTED')}><XCircle size={16} className="me-1" />Reject</Button><Button disabled={saving || approvalReady} onClick={() => onDecision('APPROVED')} title={approvalReady ? 'Verified KYC and bank account are required' : 'Approve business'}>{saving ? 'Saving...' : <><CheckCircle2 size={16} className="me-1" />Approve business</>}</Button></>}<Button variant="secondary" onClick={onHide}>Close</Button></Modal.Footer></Modal>
}

function Detail({ title, items }) { return <div className="mb-4"><h6 className="fw-bold mb-3">{title}</h6><Row className="g-2">{items.map(([label, value]) => <Col md={6} key={label}><div className="border rounded p-2 h-100"><small className="text-muted d-block">{label}</small><span className="text-break">{value}</span></div></Col>)}</Row></div> }
