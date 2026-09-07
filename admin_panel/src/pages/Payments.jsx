import React, { useEffect, useMemo, useState } from 'react'
import { Col, Form, Modal, Row } from 'react-bootstrap'
import {
  CheckCircle2,
  Clock3,
  CreditCard,
  Download,
  Eye,
  IndianRupee,
  RefreshCcw,
  XCircle,
} from 'lucide-react'
import api from '../api/axios'
import {
  AlertStrip,
  DataTable,
  EmptyState,
  ErrorState,
  FilterChips,
  IdentityCell,
  LoadingState,
  MetricTile,
  PageHeader,
  Pagination,
  SearchInput,
  StatusPill,
  Toolbar,
  formatCurrency,
  formatDateTime,
  prettify,
} from '../components/AdminUI.jsx'

const normalize = (value) => String(value || '').trim().toUpperCase()
const userName = (payment) => payment.userId?.name || 'Unknown user'
const userMobile = (payment) => payment.userId?.mobile || payment.userId?.phone || '--'
const loanLabel = (payment) =>
  payment.loanId?.loanAccountNumber || payment.loanId?._id || payment.loanId || '--'

const TYPE_LABELS = {
  REPAYMENT: 'Loan EMI',
  FULL_REPAYMENT: 'Loan closure',
  BILL: 'Bill',
  BBPS_BILL: 'BBPS bill',
  RECHARGE: 'Recharge',
  DISBURSEMENT: 'Disbursement',
  WALLET_TOPUP: 'Wallet top-up',
  WALLET_SPEND: 'Wallet spend',
  FEE: 'Fee',
  P2P: 'P2P transfer',
  PART_PAYMENT: 'Part payment',
  PENALTY: 'Penalty',
  OTHER: 'Other',
}

const Payments = () => {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [methodFilter, setMethodFilter] = useState('ALL')
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [selected, setSelected] = useState(null)

  const fetchPayments = async () => {
    try {
      setError('')
      const res = await api.get('/admin/payments?page=1&limit=1000')
      const data = res.data?.data ?? res.data ?? {}
      setPayments(Array.isArray(data) ? data : data.items || [])
    } catch (err) {
      setError(
        err.response?.data?.message || 'Payments could not be loaded. Please try again.'
      )
      setPayments([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchPayments()
  }, [])

  useEffect(() => {
    setPage(1)
  }, [statusFilter, typeFilter, methodFilter, searchTerm, sortBy, limit])

  const stats = useMemo(() => {
    const confirmed = payments.filter((p) =>
      ['CONFIRMED', 'SUCCESS'].includes(normalize(p.status))
    )
    return {
      total: payments.length,
      confirmed: confirmed.length,
      pending: payments.filter((p) => normalize(p.status) === 'PENDING').length,
      failed: payments.filter((p) => normalize(p.status) === 'FAILED').length,
      totalAmount: payments.reduce((sum, p) => sum + Number(p.amount || 0), 0),
      confirmedAmount: confirmed.reduce((sum, p) => sum + Number(p.amount || 0), 0),
    }
  }, [payments])

  const filtered = useMemo(() => {
    const term = searchTerm.toLowerCase().trim()
    return payments
      .filter((payment) => {
        if (statusFilter !== 'ALL' && normalize(payment.status) !== statusFilter) return false
        if (typeFilter !== 'ALL' && normalize(payment.type) !== typeFilter) return false
        if (methodFilter !== 'ALL' && normalize(payment.method) !== methodFilter) return false
        if (!term) return true
        return [
          userName(payment),
          userMobile(payment),
          payment.userId?.email,
          payment._id,
          payment.khatuPaymentId,
          payment.reference,
          payment.gateway?.orderId,
          loanLabel(payment),
        ].some((field) => String(field || '').toLowerCase().includes(term))
      })
      .sort((a, b) => {
        if (sortBy === 'oldest') return new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
        if (sortBy === 'amount') return Number(b.amount || 0) - Number(a.amount || 0)
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
      })
  }, [payments, searchTerm, statusFilter, typeFilter, methodFilter, sortBy])

  const totalPages = Math.max(1, Math.ceil(filtered.length / limit))
  const paged = filtered.slice((page - 1) * limit, page * limit)

  const refresh = () => {
    setRefreshing(true)
    fetchPayments()
  }

  const exportCsv = () => {
    const headers = [
      'Payment ID', 'Khatu ID', 'User', 'Mobile', 'Amount', 'Type',
      'Method', 'Status', 'Reference', 'Loan', 'Date',
    ]
    const rows = filtered.map((p) => [
      p._id, p.khatuPaymentId || '', userName(p), userMobile(p), p.amount || 0,
      normalize(p.type), normalize(p.method), normalize(p.status),
      p.reference || '', loanLabel(p), formatDateTime(p.createdAt),
    ])
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `khatupay-payments-${Date.now()}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const statusOptions = [
    { value: 'ALL', label: 'All', count: stats.total },
    { value: 'CONFIRMED', label: 'Confirmed', count: stats.confirmed },
    { value: 'PENDING', label: 'Pending', count: stats.pending },
    { value: 'FAILED', label: 'Failed', count: stats.failed },
  ]

  if (loading) return <LoadingState message="Loading payments..." />

  return (
    <div>
      <PageHeader
        icon={CreditCard}
        title="Payments"
        subtitle="Every EMI, bill, recharge, wallet and P2P transaction across the platform."
        actions={
          <>
            <button type="button" className="btn btn-outline-primary btn-sm" onClick={exportCsv}>
              <Download size={14} className="me-1" /> Export CSV
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={refresh}
              disabled={refreshing}
            >
              <RefreshCcw size={14} className="me-1" />
              {refreshing ? 'Refreshing' : 'Refresh'}
            </button>
          </>
        }
      />

      {error && (
        <AlertStrip tone="danger" onRetry={refresh}>
          {error}
        </AlertStrip>
      )}

      <Row className="g-2 mb-3">
        <Col xl={2} md={4} sm={6}>
          <MetricTile label="Total" value={stats.total.toLocaleString('en-IN')} icon={CreditCard} tone="blue" />
        </Col>
        <Col xl={2} md={4} sm={6}>
          <MetricTile label="Confirmed" value={stats.confirmed.toLocaleString('en-IN')} icon={CheckCircle2} tone="green" />
        </Col>
        <Col xl={2} md={4} sm={6}>
          <MetricTile label="Pending" value={stats.pending.toLocaleString('en-IN')} icon={Clock3} tone="saffron" />
        </Col>
        <Col xl={2} md={4} sm={6}>
          <MetricTile label="Failed" value={stats.failed.toLocaleString('en-IN')} icon={XCircle} tone="red" />
        </Col>
        <Col xl={2} md={6} sm={6}>
          <MetricTile
            label="Volume"
            value={formatCurrency(stats.totalAmount)}
            icon={IndianRupee}
            tone="teal"
            footnote="All statuses"
          />
        </Col>
        <Col xl={2} md={6} sm={6}>
          <MetricTile
            label="Settled"
            value={formatCurrency(stats.confirmedAmount)}
            icon={IndianRupee}
            tone="green"
            footnote="Confirmed only"
          />
        </Col>
      </Row>

      <Toolbar>
        <SearchInput
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Search user, mobile, reference, order or loan ID"
        />
        <Form.Select
          size="sm"
          style={{ maxWidth: 170 }}
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          aria-label="Filter by type"
        >
          <option value="ALL">All types</option>
          {Object.keys(TYPE_LABELS).map((type) => (
            <option key={type} value={type}>{TYPE_LABELS[type]}</option>
          ))}
        </Form.Select>
        <Form.Select
          size="sm"
          style={{ maxWidth: 150 }}
          value={methodFilter}
          onChange={(e) => setMethodFilter(e.target.value)}
          aria-label="Filter by method"
        >
          <option value="ALL">All methods</option>
          {['RAZORPAY', 'WALLET', 'UPI', 'BANK', 'CASH', 'MANUAL', 'OTHER'].map((m) => (
            <option key={m} value={m}>{prettify(m)}</option>
          ))}
        </Form.Select>
        <Form.Select
          size="sm"
          style={{ maxWidth: 150 }}
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          aria-label="Sort"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="amount">Highest amount</option>
        </Form.Select>
        <Form.Select
          size="sm"
          style={{ maxWidth: 110 }}
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
          aria-label="Rows per page"
        >
          {[10, 25, 50, 100].map((n) => (
            <option key={n} value={n}>{n} rows</option>
          ))}
        </Form.Select>
      </Toolbar>

      <div className="mb-3">
        <FilterChips options={statusOptions} value={statusFilter} onChange={setStatusFilter} />
      </div>

      {paged.length === 0 ? (
        <div className="kp-card">
          <EmptyState
            title="No payments match these filters"
            message="Try clearing the search box or switching back to All."
            action={
              <button
                type="button"
                className="btn btn-outline-primary btn-sm"
                onClick={() => {
                  setSearchTerm('')
                  setStatusFilter('ALL')
                  setTypeFilter('ALL')
                  setMethodFilter('ALL')
                }}
              >
                Clear filters
              </button>
            }
          />
        </div>
      ) : (
        <DataTable
          columns={['Payment', 'User', 'Amount', 'Type', 'Method', 'Status', 'Date', '']}
          footer={
            <Pagination
              page={page}
              totalPages={totalPages}
              total={filtered.length}
              limit={limit}
              onPage={setPage}
            />
          }
        >
          {paged.map((payment) => (
            <tr key={payment._id}>
              <td>
                <div className="kp-cell-primary kp-cell-mono">
                  {payment.khatuPaymentId || String(payment._id).slice(-10)}
                </div>
                <div className="kp-cell-sub">{loanLabel(payment)}</div>
              </td>
              <td style={{ maxWidth: 220 }}>
                <IdentityCell name={userName(payment)} sub={userMobile(payment)} />
              </td>
              <td className="kp-cell-mono" style={{ color: 'var(--kp-teal-dark)' }}>
                {formatCurrency(payment.amount)}
              </td>
              <td className="kp-cell-sub">
                {TYPE_LABELS[normalize(payment.type)] || prettify(payment.type)}
              </td>
              <td className="kp-cell-sub">{prettify(payment.method)}</td>
              <td><StatusPill status={payment.status} /></td>
              <td className="kp-cell-sub">{formatDateTime(payment.createdAt)}</td>
              <td>
                <button
                  type="button"
                  className="btn btn-outline-primary btn-sm"
                  onClick={() => setSelected(payment)}
                  aria-label="View payment details"
                >
                  <Eye size={14} />
                </button>
              </td>
            </tr>
          ))}
        </DataTable>
      )}

      <Modal show={Boolean(selected)} onHide={() => setSelected(null)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title style={{ fontSize: '1.05rem', fontWeight: 800 }}>
            Payment details
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>{selected && <PaymentDetail payment={selected} />}</Modal.Body>
      </Modal>
    </div>
  )
}

const Field = ({ label, value, strong }) => (
  <Col md={6} className="mb-2">
    <div
      className="p-2 rounded"
      style={{ background: 'var(--kp-surface-alt)', border: '1px solid var(--kp-line)' }}
    >
      <div className="kp-metric-label mb-1">{label}</div>
      <div
        className="kp-cell-primary"
        style={{
          wordBreak: 'break-word',
          color: strong ? 'var(--kp-teal-dark)' : undefined,
          fontSize: strong ? '1.05rem' : undefined,
        }}
      >
        {value ?? '--'}
      </div>
    </div>
  </Col>
)

const PaymentDetail = ({ payment }) => (
  <Row className="g-0">
    <Field label="Khatu payment ID" value={payment.khatuPaymentId || '--'} />
    <Field label="Internal ID" value={payment._id} />
    <Field
      label="User"
      value={`${payment.userId?.name || 'Unknown'} (${payment.userId?.mobile || '--'})`}
    />
    <Field label="Amount" value={formatCurrency(payment.amount)} strong />
    <Field label="Status" value={<StatusPill status={payment.status} />} />
    <Field label="Type" value={TYPE_LABELS[normalize(payment.type)] || prettify(payment.type)} />
    <Field label="Method" value={prettify(payment.method)} />
    <Field label="Loan" value={loanLabel(payment)} />
    <Field label="Installment" value={payment.installmentNo || payment.metadata?.installmentNo || '--'} />
    <Field label="Gateway order" value={payment.gateway?.orderId || '--'} />
    <Field label="Gateway payment" value={payment.gateway?.paymentId || '--'} />
    <Field label="Created" value={formatDateTime(payment.createdAt)} />
    {payment.metadata && (
      <Col xs={12}>
        <div className="kp-section-title mt-2">Raw metadata</div>
        <pre
          className="p-2 rounded kp-scroll"
          style={{
            background: 'var(--kp-surface-alt)',
            border: '1px solid var(--kp-line)',
            maxHeight: 220,
            overflow: 'auto',
            fontSize: '0.75rem',
          }}
        >
          {JSON.stringify(payment.metadata, null, 2)}
        </pre>
      </Col>
    )}
  </Row>
)

export default Payments
