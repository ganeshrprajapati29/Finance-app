import React, { useEffect, useMemo, useState } from 'react'
import { Badge, Button, Col, Form, Modal, Row, Table } from 'react-bootstrap'
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Download,
  Eye,
  IndianRupee,
  RefreshCcw,
  Search,
  Wallet,
  XCircle,
} from 'lucide-react'
import api from '../api/axios'

const normalize = (value) => String(value || '').trim().toUpperCase()
const formatCurrency = (amount) => `Rs. ${Number(amount || 0).toLocaleString('en-IN')}`
const formatDate = (date) => date ? new Date(date).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A'
const getUserName = (item) => item.userId?.name || 'Unknown user'
const getUserMobile = (item) => item.userId?.mobile || item.userId?.phone || 'N/A'
const maskAccount = (value) => value ? `XXXX-${String(value).slice(-4)}` : 'N/A'

const statusMap = {
  PENDING: { bg: 'warning', label: 'Pending' },
  APPROVED: { bg: 'success', label: 'Approved' },
  REJECTED: { bg: 'danger', label: 'Rejected' },
}

const Withdrawals = () => {
  const [withdrawals, setWithdrawals] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [selectedWithdrawal, setSelectedWithdrawal] = useState(null)
  const [detailWithdrawal, setDetailWithdrawal] = useState(null)
  const [decisionType, setDecisionType] = useState('')
  const [transactionId, setTransactionId] = useState('')
  const [notes, setNotes] = useState('')
  const [processing, setProcessing] = useState(false)

  const fetchWithdrawals = async () => {
    try {
      setError('')
      const res = await api.get('/admin/withdrawals?page=1&limit=1000')
      const data = res.data?.data || res.data || {}
      setWithdrawals(Array.isArray(data) ? data : data.items || data.data || [])
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Withdrawals could not be loaded')
      setWithdrawals([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchWithdrawals()
  }, [])

  useEffect(() => {
    setPage(1)
  }, [statusFilter, searchTerm, sortBy, limit])

  const stats = useMemo(() => {
    const pending = withdrawals.filter((w) => normalize(w.status) === 'PENDING')
    const approved = withdrawals.filter((w) => normalize(w.status) === 'APPROVED')
    const rejected = withdrawals.filter((w) => normalize(w.status) === 'REJECTED')
    return {
      total: withdrawals.length,
      pending: pending.length,
      approved: approved.length,
      rejected: rejected.length,
      pendingAmount: pending.reduce((sum, w) => sum + Number(w.amount || 0), 0),
      approvedAmount: approved.reduce((sum, w) => sum + Number(w.amount || 0), 0),
      totalAmount: withdrawals.reduce((sum, w) => sum + Number(w.amount || 0), 0),
    }
  }, [withdrawals])

  const filteredWithdrawals = useMemo(() => {
    const term = searchTerm.toLowerCase().trim()
    return withdrawals
      .filter((item) => {
        const matchesStatus = statusFilter === 'ALL' || normalize(item.status) === statusFilter
        const matchesSearch =
          !term ||
          getUserName(item).toLowerCase().includes(term) ||
          getUserMobile(item).toLowerCase().includes(term) ||
          String(item.userId?.email || '').toLowerCase().includes(term) ||
          String(item._id || '').toLowerCase().includes(term) ||
          String(item.txnId || '').toLowerCase().includes(term) ||
          String(item.bankDetails?.accountNumber || '').toLowerCase().includes(term)
        return matchesStatus && matchesSearch
      })
      .sort((a, b) => {
        if (sortBy === 'oldest') return new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
        if (sortBy === 'amount') return Number(b.amount || 0) - Number(a.amount || 0)
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
      })
  }, [withdrawals, searchTerm, statusFilter, sortBy])

  const totalPages = Math.max(1, Math.ceil(filteredWithdrawals.length / limit))
  const pagedWithdrawals = filteredWithdrawals.slice((page - 1) * limit, page * limit)

  const openDecision = (item, type) => {
    setSelectedWithdrawal(item)
    setDecisionType(type)
    setTransactionId(type === 'APPROVED' ? `WD-${Date.now()}` : '')
    setNotes('')
  }

  const submitDecision = async () => {
    if (!selectedWithdrawal) return
    try {
      setProcessing(true)
      await api.post(`/admin/withdrawals/${selectedWithdrawal._id}/decision`, {
        decision: decisionType,
        txnId: decisionType === 'APPROVED' ? transactionId : undefined,
        notes: notes || undefined,
      })
      setSelectedWithdrawal(null)
      await fetchWithdrawals()
    } catch (err) {
      alert(err.response?.data?.message || 'Withdrawal decision failed')
    } finally {
      setProcessing(false)
    }
  }

  const refresh = () => {
    setRefreshing(true)
    fetchWithdrawals()
  }

  const exportCsv = () => {
    const headers = ['ID', 'User', 'Mobile', 'Amount', 'Bank', 'Account', 'IFSC', 'Status', 'Txn ID', 'Requested', 'Decided']
    const rows = filteredWithdrawals.map((w) => [w._id, getUserName(w), getUserMobile(w), w.amount || 0, w.bankDetails?.bankName || '', w.bankDetails?.accountNumber || '', w.bankDetails?.ifscCode || '', normalize(w.status), w.txnId || '', formatDate(w.createdAt), formatDate(w.decidedAt)])
    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `khatupay-withdrawals-${Date.now()}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  if (loading) {
    return <div className="wd-loading"><div className="spinner-border text-primary" role="status" /><p>Loading withdrawals...</p></div>
  }

  return (
    <div className="wd-page">
      <section className="wd-hero">
        <div>
          <span>Payout Operations</span>
          <h1>Withdrawals Management</h1>
          <p>Review payout requests, verify bank details, approve or reject withdrawals, and keep transaction IDs linked.</p>
        </div>
        <div className="wd-hero-actions">
          <Button className="wd-primary-btn" onClick={exportCsv}><Download size={16} /> Export CSV</Button>
          <Button variant="light" onClick={refresh} disabled={refreshing}><RefreshCcw size={16} className={refreshing ? 'spin' : ''} /> {refreshing ? 'Refreshing' : 'Refresh'}</Button>
        </div>
      </section>

      {error && <div className="wd-warning"><AlertTriangle size={18} /><span>{error}</span><button onClick={refresh}>Retry</button></div>}

      <Row className="g-3">
        <Col xl={3} md={6}><StatCard title="Total requests" value={stats.total} icon={Wallet} color="#2563EB" /></Col>
        <Col xl={3} md={6}><StatCard title="Pending" value={stats.pending} icon={Clock3} color="#D97706" /></Col>
        <Col xl={3} md={6}><StatCard title="Approved" value={stats.approved} icon={CheckCircle2} color="#059669" /></Col>
        <Col xl={3} md={6}><StatCard title="Rejected" value={stats.rejected} icon={XCircle} color="#DC2626" /></Col>
      </Row>

      <Row className="g-3 mt-1">
        <Col md={4}><AmountCard label="Pending amount" value={formatCurrency(stats.pendingAmount)} /></Col>
        <Col md={4}><AmountCard label="Approved amount" value={formatCurrency(stats.approvedAmount)} success /></Col>
        <Col md={4}><AmountCard label="Total amount" value={formatCurrency(stats.totalAmount)} /></Col>
      </Row>

      <section className="wd-panel mt-3">
        <div className="wd-panel-head">
          <div><h2>Withdrawal Requests</h2><p>{filteredWithdrawals.length.toLocaleString('en-IN')} matching records</p></div>
          <div className="wd-count-pill">Page {page} of {totalPages}</div>
        </div>

        <div className="wd-toolbar">
          <div className="wd-search"><Search size={18} /><input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search user, mobile, account, txn ID, request ID" /></div>
          <Form.Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="ALL">All status</option><option value="PENDING">Pending</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option></Form.Select>
          <Form.Select value={sortBy} onChange={(e) => setSortBy(e.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="amount">Amount high</option></Form.Select>
          <Form.Select value={limit} onChange={(e) => setLimit(Number(e.target.value))}><option value={10}>10 rows</option><option value={20}>20 rows</option><option value={50}>50 rows</option><option value={100}>100 rows</option></Form.Select>
        </div>

        <div className="wd-table-wrap">
          <Table responsive hover className="wd-table">
            <thead><tr><th>Request</th><th>User</th><th>Amount</th><th>Bank</th><th>Status</th><th>Txn ID</th><th>Requested</th><th>Action</th></tr></thead>
            <tbody>
              {pagedWithdrawals.length ? pagedWithdrawals.map((item) => {
                const status = statusMap[normalize(item.status)] || { bg: 'secondary', label: normalize(item.status) || 'N/A' }
                const pending = normalize(item.status) === 'PENDING'
                return (
                  <tr key={item._id}>
                    <td><strong>{String(item._id).slice(-10)}</strong><small>{formatDate(item.decidedAt)}</small></td>
                    <td><strong>{getUserName(item)}</strong><small>{getUserMobile(item)} | Balance {formatCurrency(item.userId?.walletBalance || 0)}</small></td>
                    <td className="amount-cell">{formatCurrency(item.amount)}</td>
                    <td><strong>{item.bankDetails?.bankName || 'N/A'}</strong><small>{maskAccount(item.bankDetails?.accountNumber)} | {item.bankDetails?.ifscCode || 'N/A'}</small></td>
                    <td><Badge bg={status.bg}>{status.label}</Badge></td>
                    <td><small>{item.txnId || '-'}</small></td>
                    <td>{formatDate(item.createdAt)}</td>
                    <td>
                      <div className="wd-actions">
                        <Button variant="light" size="sm" onClick={() => setDetailWithdrawal(item)}><Eye size={15} /></Button>
                        {pending && <><Button variant="outline-success" size="sm" onClick={() => openDecision(item, 'APPROVED')}><CheckCircle2 size={15} /></Button><Button variant="outline-danger" size="sm" onClick={() => openDecision(item, 'REJECTED')}><XCircle size={15} /></Button></>}
                      </div>
                    </td>
                  </tr>
                )
              }) : <tr><td colSpan="8" className="wd-empty">No withdrawals found.</td></tr>}
            </tbody>
          </Table>
        </div>

        <div className="wd-pagination">
          <span>Showing {filteredWithdrawals.length ? (page - 1) * limit + 1 : 0} to {Math.min(page * limit, filteredWithdrawals.length)} of {filteredWithdrawals.length}</span>
          <div><Button variant="outline-secondary" size="sm" disabled={page === 1} onClick={() => setPage((v) => v - 1)}>Previous</Button><Button variant="outline-secondary" size="sm" disabled={page === totalPages} onClick={() => setPage((v) => v + 1)}>Next</Button></div>
        </div>
      </section>

      <Modal show={Boolean(selectedWithdrawal)} onHide={() => setSelectedWithdrawal(null)} centered>
        <Modal.Header closeButton><Modal.Title>{decisionType === 'APPROVED' ? 'Approve Withdrawal' : 'Reject Withdrawal'}</Modal.Title></Modal.Header>
        <Modal.Body>{selectedWithdrawal && <div className="decision-body">
          <Info label="User" value={`${getUserName(selectedWithdrawal)} (${getUserMobile(selectedWithdrawal)})`} />
          <Info label="Amount" value={formatCurrency(selectedWithdrawal.amount)} highlight />
          <Info label="Bank" value={`${selectedWithdrawal.bankDetails?.bankName || 'N/A'} / ${maskAccount(selectedWithdrawal.bankDetails?.accountNumber)}`} />
          {decisionType === 'APPROVED' && <Form.Group><Form.Label>Transaction ID</Form.Label><Form.Control value={transactionId} onChange={(e) => setTransactionId(e.target.value)} required /></Form.Group>}
          <Form.Group><Form.Label>Notes</Form.Label><Form.Control as="textarea" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional internal note" /></Form.Group>
        </div>}</Modal.Body>
        <Modal.Footer><Button variant="light" onClick={() => setSelectedWithdrawal(null)}>Cancel</Button><Button variant={decisionType === 'APPROVED' ? 'success' : 'danger'} onClick={submitDecision} disabled={processing}>{processing ? 'Processing...' : decisionType === 'APPROVED' ? 'Approve' : 'Reject'}</Button></Modal.Footer>
      </Modal>

      <Modal show={Boolean(detailWithdrawal)} onHide={() => setDetailWithdrawal(null)} size="lg" centered>
        <Modal.Header closeButton><Modal.Title>Withdrawal Details</Modal.Title></Modal.Header>
        <Modal.Body>{detailWithdrawal && <div className="detail-grid">
          <Info label="Request ID" value={detailWithdrawal._id} />
          <Info label="User" value={`${getUserName(detailWithdrawal)} (${getUserMobile(detailWithdrawal)})`} />
          <Info label="Amount" value={formatCurrency(detailWithdrawal.amount)} highlight />
          <Info label="Status" value={normalize(detailWithdrawal.status)} />
          <Info label="Bank" value={detailWithdrawal.bankDetails?.bankName || 'N/A'} />
          <Info label="Account" value={maskAccount(detailWithdrawal.bankDetails?.accountNumber)} />
          <Info label="IFSC" value={detailWithdrawal.bankDetails?.ifscCode || 'N/A'} />
          <Info label="Account holder" value={detailWithdrawal.bankDetails?.accountHolderName || 'N/A'} />
          <Info label="Txn ID" value={detailWithdrawal.txnId || 'N/A'} />
          <Info label="Notes" value={detailWithdrawal.notes || 'N/A'} />
          <Info label="Requested" value={formatDate(detailWithdrawal.createdAt)} />
          <Info label="Decided" value={formatDate(detailWithdrawal.decidedAt)} />
        </div>}</Modal.Body>
      </Modal>

      <style>{styles}</style>
    </div>
  )
}

const StatCard = ({ title, value, icon: Icon, color }) => <div className="wd-stat"><div style={{ color, background: `${color}18` }}><Icon size={24} /></div><span>{title}</span><strong>{Number(value || 0).toLocaleString('en-IN')}</strong></div>
const AmountCard = ({ label, value, success }) => <div className={success ? 'wd-amount success' : 'wd-amount'}><IndianRupee size={22} /><span>{label}</span><strong>{value}</strong></div>
const Info = ({ label, value, highlight }) => <div className="info-box"><span>{label}</span><strong className={highlight ? 'highlight' : ''}>{value}</strong></div>

const styles = `
  .wd-loading{min-height:50vh;display:grid;place-items:center;gap:12px;color:#64748B}.wd-page{color:#0F172A}
  .wd-hero{display:flex;justify-content:space-between;align-items:center;gap:20px;padding:26px;margin-bottom:18px;color:white;border-radius:8px;background:linear-gradient(135deg,#0F172A,#1E293B);box-shadow:0 20px 45px rgba(15,23,42,.16)}
  .wd-hero span{color:#7DD3FC;font-size:12px;font-weight:900;text-transform:uppercase}.wd-hero h1{margin:6px 0;font-size:28px}.wd-hero p{margin:0;color:#CBD5E1;max-width:720px}.wd-hero-actions,.wd-actions,.wd-pagination div{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.wd-hero-actions .btn{display:inline-flex;align-items:center;gap:8px;border-radius:8px;font-weight:800}.wd-primary-btn{background:linear-gradient(135deg,#2563EB,#059669)!important;border:0!important}
  .wd-warning{display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:8px;background:#FFFBEB;border:1px solid #FDE68A;color:#92400E;font-weight:700;margin-bottom:16px}.wd-warning button{border:0;background:transparent;color:#2563EB;font-weight:900}
  .wd-stat,.wd-amount,.wd-panel{background:white;border:1px solid #E2E8F0;border-radius:8px;box-shadow:0 12px 28px rgba(15,23,42,.07)}.wd-stat{min-height:142px;padding:20px;display:flex;flex-direction:column;gap:10px}.wd-stat>div{width:48px;height:48px;border-radius:8px;display:grid;place-items:center}.wd-stat span,.wd-amount span{color:#64748B;font-size:13px;font-weight:900;text-transform:uppercase}.wd-stat strong{font-size:27px;line-height:1.1}
  .wd-amount{padding:18px;display:grid;grid-template-columns:auto 1fr;gap:4px 12px;align-items:center}.wd-amount svg{grid-row:span 2;color:#2563EB}.wd-amount.success svg{color:#059669}.wd-amount strong{font-size:22px}.wd-panel{padding:18px}.wd-panel-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:16px}.wd-panel-head h2{margin:0;font-size:18px;font-weight:900}.wd-panel-head p{margin:3px 0 0;color:#64748B;font-weight:700}.wd-count-pill{padding:8px 12px;border-radius:999px;background:#F1F5F9;color:#334155;font-size:13px;font-weight:900;white-space:nowrap}
  .wd-toolbar{display:grid;grid-template-columns:minmax(260px,1fr) repeat(3,minmax(130px,180px));gap:10px;margin-bottom:14px}.wd-search{display:flex;align-items:center;gap:8px;padding:0 12px;border-radius:8px;border:1px solid #CBD5E1;background:white}.wd-search input{width:100%;border:0;outline:0;min-height:38px;font-weight:700}
  .wd-table-wrap{border:1px solid #E2E8F0;border-radius:8px;overflow:hidden}.wd-table{margin:0}.wd-table th{background:#F8FAFC;color:#475569;font-size:12px;text-transform:uppercase;padding:13px 14px;border-bottom:1px solid #E2E8F0;white-space:nowrap}.wd-table td{vertical-align:middle;padding:14px;color:#334155}.wd-table td small{display:block;color:#64748B;font-weight:700;margin-top:2px}.amount-cell{font-weight:900;color:#065F46!important}.wd-actions .btn{width:34px;height:34px;display:inline-flex;align-items:center;justify-content:center;border-radius:8px}.wd-empty{text-align:center;color:#64748B!important;padding:32px!important;font-weight:700}
  .wd-pagination{display:flex;justify-content:space-between;align-items:center;gap:12px;padding-top:14px;color:#64748B;font-size:13px;font-weight:800}.decision-body,.detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.decision-body .form-group{grid-column:1/-1}.info-box{padding:13px;border-radius:8px;background:#F8FAFC;border:1px solid #E2E8F0;display:grid;gap:5px}.info-box span{color:#64748B;font-size:12px;font-weight:900;text-transform:uppercase}.info-box strong{word-break:break-word}.highlight{color:#059669!important;font-size:18px}.spin{animation:spin .9s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}
  @media(max-width:992px){.wd-toolbar{grid-template-columns:1fr}.wd-hero,.wd-panel-head,.wd-pagination{align-items:flex-start;flex-direction:column}.decision-body,.detail-grid{grid-template-columns:1fr}.wd-hero h1{font-size:23px}}
`

export default Withdrawals
