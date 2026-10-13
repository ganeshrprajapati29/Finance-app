import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Badge, Button, Col, Form, Modal, Row, Table } from 'react-bootstrap'
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  Clock3,
  Download,
  Eye,
  FilePen as FileSignature,
  FileText,
  IndianRupee,
  RefreshCcw,
  Search,
  Send,
  ShieldAlert,
  UserRound,
  XCircle,
} from 'lucide-react'
import api from '../api/axios'
import { AlertStrip, PageHeader } from '../components/AdminUI.jsx'
import ExperianReport from '../components/ExperianReport.jsx'
import { allInclusiveApr, buildRepaymentSchedule } from '../utils/loanSchedule.js'

const normalize = (value) => String(value || '').trim().toUpperCase()

const formatCurrency = (amount) => `Rs. ${Number(amount || 0).toLocaleString('en-IN')}`

const formatDate = (date) => {
  if (!date) return 'N/A'
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const getUserName = (loan) => loan.userId?.name || loan.application?.personal?.name || 'Unknown user'

const getUserMobile = (loan) => loan.userId?.mobile || loan.userId?.phone || loan.application?.personal?.mobile || 'N/A'

const getRequestedAmount = (loan) => Number(loan.application?.amountRequested || 0)

const getApprovedAmount = (loan) => Number(loan.decision?.amountApproved || 0)

const getNextDue = (loan) => loan.schedule?.find((item) => !item.paid)

const joinName = (...parts) => parts.filter((part) => part !== undefined && part !== null && String(part).trim()).map((part) => String(part).trim()).join(' ')

const getPanVerification = (loan) => loan.application?.documents?.panVerification || loan.userId?.kyc?.panVerification || {}

const getPanData = (loan) => {
  const panVerification = getPanVerification(loan)
  return panVerification.panData || panVerification.response?.panData || loan.userId?.kyc?.panData || {}
}

const getPanName = (loan) => {
  const panVerification = getPanVerification(loan)
  const panData = getPanData(loan)
  return panVerification.panName ||
    panData.name ||
    panData.fullName ||
    panData.panName ||
    panVerification.response?.name ||
    panVerification.response?.panName ||
    joinName(panData.firstName, panData.middleName, panData.lastName) ||
    loan.userId?.kyc?.panName ||
    ''
}

const getPanNumber = (loan) => {
  const panVerification = getPanVerification(loan)
  const panData = getPanData(loan)
  return panVerification.panNumber || panData.pan || panData.panNumber || loan.userId?.kyc?.panNumber || ''
}

const getPanStatus = (loan) => {
  const panVerification = getPanVerification(loan)
  const panData = getPanData(loan)
  const raw = normalize(panVerification.response?.status || panData.status || panVerification.status)
  return Boolean(panVerification.verified || loan.userId?.kyc?.panVerified || raw === 'SUCCESS')
}

const statusMap = {
  PENDING: { bg: 'warning', label: 'Pending', color: '#D97706' },
  UNDER_REVIEW: { bg: 'warning', label: 'Under review', color: '#D97706' },
  DOCUMENTS_REQUIRED: { bg: 'warning', label: 'Documents required', color: '#D97706' },
  APPROVED: { bg: 'success', label: 'Approved', color: '#059669' },
  REJECTED: { bg: 'danger', label: 'Rejected', color: '#DC2626' },
  DISBURSEMENT_PROCESSING: { bg: 'info', label: 'Disbursing', color: '#0891B2' },
  DISBURSED: { bg: 'info', label: 'Disbursed', color: '#0891B2' },
  OVERDUE: { bg: 'danger', label: 'Overdue', color: '#DC2626' },
  CLOSED: { bg: 'secondary', label: 'Closed', color: '#475569' },
}

const OPEN_STATUSES = ['PENDING', 'UNDER_REVIEW', 'DOCUMENTS_REQUIRED']

// loan.agreement is the source of truth; decision.agreementStatus is its legacy mirror.
const getAgreementStatus = (loan) => {
  const status = normalize(loan.agreement?.status || loan.agreementDetails?.status)
  if (status) return status
  const legacy = normalize(loan.decision?.agreementStatus)
  if (legacy === 'SIGNED') return 'SIGNED'
  return loan.decision?.agreementDocumentId ? 'SIGNING' : legacy || 'NOT_AVAILABLE'
}

const agreementLabel = (status) => ({
  NOT_AVAILABLE: 'Agreement not generated',
  PENDING_SIGNATURE: 'Awaiting borrower eSign',
  SIGNING: 'eSign in progress',
  SIGNED: 'Signed',
  FAILED: 'eSign failed - borrower can retry',
}[normalize(status)] || String(status || '').replaceAll('_', ' '))

const agreementTone = (status) => ({ SIGNED: 'success', FAILED: 'danger', SIGNING: 'info' }[normalize(status)] || 'warning')

// Blob responses (the PDF preview) carry JSON errors as a Blob body.
const blobErrorMessage = async (err, fallback) => {
  try {
    const data = err.response?.data
    if (data instanceof Blob) return JSON.parse(await data.text())?.message || fallback
    return data?.message || fallback
  } catch {
    return fallback
  }
}

const riskTone = (riskLevel) => {
  const level = normalize(riskLevel)
  if (level === 'LOW') return 'success'
  if (level === 'MEDIUM') return 'warning'
  if (level === 'HIGH') return 'danger'
  return 'secondary'
}

const SORT_OPTIONS = {
  newest: { sortBy: 'createdAt', sortOrder: 'desc' },
  oldest: { sortBy: 'createdAt', sortOrder: 'asc' },
  requested: { sortBy: 'application.amountRequested', sortOrder: 'desc' },
  approved: { sortBy: 'decision.amountApproved', sortOrder: 'desc' },
  due: { sortBy: 'nextDueDate', sortOrder: 'asc' },
}

const MAX_APR = 48
const emptyDecisionForm = { amountApproved: '', rateAPR: '', tenureMonths: '', processingFee: '0', taxAmount: '0', lenderName: '', rejectionReason: '' }

// Client-side mirror of the backend Joi rules, so the admin sees problems
// before submitting. The backend stays the authority.
const validateOffer = (form, requested) => {
  const errors = {}
  const amount = Number(form.amountApproved)
  const rate = form.rateAPR === '' ? NaN : Number(form.rateAPR)
  const tenure = Number(form.tenureMonths)
  const fee = Number(form.processingFee || 0)
  const tax = Number(form.taxAmount || 0)
  if (!(amount > 0)) errors.amountApproved = 'Enter the approved amount.'
  else if (requested > 0 && amount > requested) errors.amountApproved = `Cannot exceed the requested ${formatCurrency(requested)}.`
  if (!Number.isFinite(rate) || rate < 0) errors.rateAPR = 'Enter an interest rate (0 or more).'
  else if (rate > MAX_APR) errors.rateAPR = `Interest rate cannot exceed ${MAX_APR}% per annum.`
  if (!Number.isInteger(tenure) || tenure < 3 || tenure > 60) errors.tenureMonths = 'Tenure must be 3 to 60 months.'
  if (!(fee >= 0)) errors.processingFee = 'Fee cannot be negative.'
  if (!(tax >= 0)) errors.taxAmount = 'Tax cannot be negative.'
  if (amount > 0 && fee + tax >= amount) errors.processingFee = 'Fee and tax must be less than the approved amount.'
  return errors
}

const Loans = () => {
  const [loans, setLoans] = useState([])
  const [summary, setSummary] = useState(null)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [riskFilter, setRiskFilter] = useState('ALL')
  const [sortBy, setSortBy] = useState('newest')
  const [searchInput, setSearchInput] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [selectedLoanId, setSelectedLoanId] = useState(null)
  const [decisionLoan, setDecisionLoan] = useState(null)
  const [decisionType, setDecisionType] = useState('')
  const [decisionForm, setDecisionForm] = useState(emptyDecisionForm)
  const [decisionError, setDecisionError] = useState('')
  const [disburseTarget, setDisburseTarget] = useState(null)
  const [processing, setProcessing] = useState(false)
  const [previewing, setPreviewing] = useState(false)

  // Debounce search so every keystroke is not a server round trip.
  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(searchInput.trim()), 350)
    return () => clearTimeout(timer)
  }, [searchInput])

  const fetchLoans = useCallback(async () => {
    try {
      setError('')
      const sort = SORT_OPTIONS[sortBy] || SORT_OPTIONS.newest
      const res = await api.get('/admin/loans', {
        params: { status: statusFilter, risk: riskFilter, search: searchTerm || undefined, page, limit, ...sort },
      })
      const data = res.data?.data || {}
      setLoans(Array.isArray(data.items) ? data.items : [])
      setTotal(Number(data.total || 0))
      if (data.summary) setSummary(data.summary)
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Loans could not be loaded')
      setLoans([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [statusFilter, riskFilter, searchTerm, page, limit, sortBy])

  useEffect(() => {
    fetchLoans()
  }, [fetchLoans])

  useEffect(() => {
    setPage(1)
  }, [statusFilter, riskFilter, sortBy, searchTerm, limit])

  const stats = useMemo(() => ({
    total: summary?.total ?? total,
    pending: (summary?.byStatus?.PENDING || 0) + (summary?.byStatus?.UNDER_REVIEW || 0) + (summary?.byStatus?.DOCUMENTS_REQUIRED || 0),
    approved: summary?.byStatus?.APPROVED || 0,
    disbursed: summary?.byStatus?.DISBURSED || 0,
    overdue: summary?.overdue || 0,
    totalRequested: summary?.totalRequested || 0,
    totalApproved: summary?.totalApproved || 0,
  }), [summary, total])

  const totalPages = Math.max(1, Math.ceil(total / limit))

  const openDecisionModal = (loan, type) => {
    setDecisionLoan(loan)
    setDecisionType(type)
    setDecisionError('')
    setDecisionForm({
      ...emptyDecisionForm,
      amountApproved: loan.decision?.amountApproved || loan.application?.amountRequested || '',
      rateAPR: loan.decision?.rateAPR ?? 12,
      tenureMonths: loan.decision?.tenureMonths || loan.application?.tenureMonths || 12,
      processingFee: loan.decision?.processingFee ?? 0,
      taxAmount: loan.decision?.taxAmount ?? 0,
      lenderName: loan.decision?.lenderName || '',
    })
  }

  const offerPayload = () => ({
    decision: 'APPROVED',
    amountApproved: Number(decisionForm.amountApproved),
    rateAPR: Number(decisionForm.rateAPR),
    tenureMonths: Number(decisionForm.tenureMonths),
    processingFee: Number(decisionForm.processingFee || 0),
    taxAmount: Number(decisionForm.taxAmount || 0),
    lenderName: String(decisionForm.lenderName || '').trim(),
  })

  const offerErrors = decisionLoan && decisionType === 'APPROVE'
    ? validateOffer(decisionForm, getRequestedAmount(decisionLoan))
    : {}
  const offerPreview = useMemo(() => {
    if (!decisionLoan || decisionType !== 'APPROVE') return null
    const principal = Number(decisionForm.amountApproved)
    const months = Number(decisionForm.tenureMonths)
    const rate = Number(decisionForm.rateAPR)
    if (!(principal > 0) || !(months >= 1) || !Number.isFinite(rate)) return null
    const upfrontCharges = Number(decisionForm.processingFee || 0) + Number(decisionForm.taxAmount || 0)
    const repayment = buildRepaymentSchedule({ principal, annualRatePercent: rate, months })
    return {
      ...repayment,
      netDisbursal: Math.max(0, principal - upfrontCharges),
      apr: allInclusiveApr({ principal, annualRatePercent: rate, months, upfrontCharges }),
    }
  }, [decisionLoan, decisionType, decisionForm])

  const approvalBlockers = decisionLoan?.verificationPolicy?.approvalBlockingLabels || []

  const previewAgreement = async () => {
    if (!decisionLoan || Object.keys(offerErrors).length) return
    try {
      setPreviewing(true)
      const res = await api.post(`/admin/loans/${decisionLoan._id}/agreement/preview`, offerPayload(), { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      window.open(url, '_blank', 'noopener')
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (err) {
      setDecisionError(await blobErrorMessage(err, 'Agreement preview could not be generated.'))
    } finally {
      setPreviewing(false)
    }
  }

  const submitDecision = async () => {
    if (!decisionLoan) return
    setDecisionError('')
    try {
      if (decisionType === 'APPROVE') {
        if (Object.keys(offerErrors).length) return
        setProcessing(true)
        await api.post(`/admin/loans/${decisionLoan._id}/decision`, offerPayload())
      } else {
        if (decisionForm.rejectionReason.trim().length < 3) {
          setDecisionError('Enter a customer-friendly rejection reason.')
          return
        }
        setProcessing(true)
        await api.post(`/admin/loans/${decisionLoan._id}/decision`, {
          decision: 'REJECTED', rejectionReason: decisionForm.rejectionReason.trim(),
        })
      }
      setDecisionLoan(null)
      await fetchLoans()
    } catch (err) {
      setDecisionError(err.response?.data?.message || 'Loan decision failed')
    } finally {
      setProcessing(false)
    }
  }

  const exportCsv = () => {
    const rows = loans.map((loan) => [
      loan._id,
      loan.loanAccountNumber || '',
      getUserName(loan),
      getUserMobile(loan),
      loan.userId?.email || loan.application?.personal?.email || '',
      normalize(loan.status || 'PENDING'),
      getRequestedAmount(loan),
      getApprovedAmount(loan),
      loan.decision?.rateAPR ?? '',
      loan.decision?.tenureMonths || '',
      formatDate(loan.createdAt),
      formatDate(loan.disbursementDate),
    ])
    const headers = ['Loan ID', 'Account No', 'User', 'Mobile', 'Email', 'Status', 'Requested', 'Approved', 'APR', 'Tenure', 'Applied', 'Disbursed']
    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `khatupay-loans-page-${page}-${Date.now()}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const refresh = () => {
    setRefreshing(true)
    fetchLoans()
  }

  if (loading) {
    return (
      <div className="loans-loading">
        <div className="spinner-border text-primary" role="status" />
        <p>Loading loans...</p>
      </div>
    )
  }

  return (
    <div className="loans-page">
      {/* Compact operations header - an admin console is a tool, not a
          landing page, so the marketing hero is replaced by a toolbar row. */}
      <PageHeader
        icon={FileText}
        title="Loans"
        subtitle="Review applications, clear verification, approve, track eSign and disburse."
        actions={
          <>
            <Button variant="outline-primary" size="sm" onClick={exportCsv}>
              <Download size={14} className="me-1" /> Export page CSV
            </Button>
            <Button size="sm" onClick={refresh} disabled={refreshing}>
              <RefreshCcw size={14} className={refreshing ? 'spin me-1' : 'me-1'} />
              {refreshing ? 'Refreshing' : 'Refresh'}
            </Button>
          </>
        }
      />

      {error && (
        <AlertStrip tone="danger" onRetry={refresh}>
          {error}
        </AlertStrip>
      )}

      <Row className="g-3">
        <Col xl={3} md={6}><StatCard title="Total loans" value={stats.total} icon={FileText} color="#2563EB" /></Col>
        <Col xl={3} md={6}><StatCard title="Pending review" value={stats.pending} icon={Clock3} color="#D97706" /></Col>
        <Col xl={3} md={6}><StatCard title="Awaiting signature / disbursal" value={stats.approved} icon={FileSignature} color="#0F766E" /></Col>
        <Col xl={3} md={6}><StatCard title="Overdue risk" value={stats.overdue} icon={ShieldAlert} color="#DC2626" /></Col>
      </Row>

      <Row className="g-3 mt-1">
        <Col lg={6}><AmountCard label="Requested amount" value={formatCurrency(stats.totalRequested)} icon={IndianRupee} /></Col>
        <Col lg={6}><AmountCard label="Approved amount" value={formatCurrency(stats.totalApproved)} icon={Banknote} /></Col>
      </Row>

      <section className="loans-panel mt-3">
        <div className="loans-panel-head">
          <div>
            <h2>Loan Applications</h2>
            <p>{total.toLocaleString('en-IN')} matching records</p>
          </div>
          <div className="loans-count-pill">Page {page} of {totalPages}</div>
        </div>

        <div className="loans-toolbar">
          <div className="loans-search">
            <Search size={18} />
            <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search name, mobile, email, application no." />
          </div>
          <Form.Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="ALL">All status</option>
            <option value="PENDING">Pending</option>
            <option value="UNDER_REVIEW">Under review</option>
            <option value="APPROVED">Approved</option>
            <option value="DISBURSED">Disbursed</option>
            <option value="REJECTED">Rejected</option>
            <option value="CLOSED">Closed</option>
          </Form.Select>
          <Form.Select value={riskFilter} onChange={(event) => setRiskFilter(event.target.value)}>
            <option value="ALL">All risk</option>
            <option value="OVERDUE">Overdue</option>
            <option value="DUE_SOON">Due in 7 days</option>
            <option value="NO_SCHEDULE">No schedule</option>
          </Form.Select>
          <Form.Select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="requested">Requested high</option>
            <option value="approved">Approved high</option>
            <option value="due">Next due</option>
          </Form.Select>
          <Form.Select value={limit} onChange={(event) => setLimit(Number(event.target.value))}>
            <option value={10}>10 rows</option>
            <option value={20}>20 rows</option>
            <option value={50}>50 rows</option>
            <option value={100}>100 rows</option>
          </Form.Select>
        </div>

        <div className="loans-table-wrap">
          <Table responsive hover className="loans-table">
            <thead>
              <tr>
                <th>Loan</th>
                <th>Borrower</th>
                <th>Amount</th>
                <th>Decision</th>
                <th>Verification</th>
                <th>Agreement / EMI</th>
                <th>Status</th>
                <th>Applied</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loans.length ? (
                loans.map((loan) => {
                  const status = statusMap[normalize(loan.status || 'PENDING')] || statusMap.PENDING
                  const nextDue = getNextDue(loan)
                  const overdue = isOverdue(loan)
                  const policy = loan.verificationPolicy || {}
                  const agreementStatus = getAgreementStatus(loan)
                  const open = OPEN_STATUSES.includes(normalize(loan.status))
                  return (
                    <tr key={loan._id}>
                      <td>
                        <div className="loan-id-cell">
                          <strong>{loan.loanAccountNumber || `LN-${String(loan._id).slice(-8)}`}</strong>
                          <small>{String(loan._id || '').slice(-12)}</small>
                        </div>
                      </td>
                      <td>
                        <div className="borrower-cell">
                          <div>{getUserName(loan).charAt(0).toUpperCase()}</div>
                          <section>
                            <strong>{getUserName(loan)}</strong>
                            <small>{getUserMobile(loan)}</small>
                          </section>
                        </div>
                      </td>
                      <td>
                        <strong>{formatCurrency(getRequestedAmount(loan))}</strong>
                        <small>Requested</small>
                      </td>
                      <td>
                        <strong>{formatCurrency(getApprovedAmount(loan))}</strong>
                        <small>{loan.decision?.rateAPR ?? 0}% / {loan.decision?.tenureMonths || loan.application?.tenureMonths || 0} mo</small>
                      </td>
                      <td>
                        {open ? (
                          <div className="pan-kyc-cell">
                            <Badge bg={policy.approvable ? 'success' : 'warning'}>{policy.approvable ? 'Ready' : `${policy.approvalBlocking?.length || 0} to clear`}</Badge>
                            <small>{policy.approvable ? 'All checks verified' : (policy.approvalBlockingLabels || []).join(', ')}</small>
                          </div>
                        ) : <span className="muted-text">Decided</span>}
                      </td>
                      <td>
                        {normalize(loan.status) === 'APPROVED' ? (
                          <Badge bg={agreementTone(agreementStatus)}>{agreementLabel(agreementStatus)}</Badge>
                        ) : nextDue ? (
                          <div className={overdue ? 'due-cell overdue' : 'due-cell'}>
                            <strong>{formatCurrency(nextDue.total)}</strong>
                            <small>{formatDate(nextDue.dueDate)}</small>
                          </div>
                        ) : (
                          <span className="muted-text">No EMI</span>
                        )}
                      </td>
                      <td><Badge bg={status.bg}>{status.label}</Badge></td>
                      <td>{formatDate(loan.createdAt)}</td>
                      <td>
                        <div className="loan-actions">
                          <Button variant="light" size="sm" onClick={() => setSelectedLoanId(loan._id)} title="View details">
                            <Eye size={15} />
                          </Button>
                          {open && (
                            <>
                              <Button variant="outline-success" size="sm" onClick={() => openDecisionModal(loan, 'APPROVE')} title="Approve">
                                <CheckCircle2 size={15} />
                              </Button>
                              <Button variant="outline-danger" size="sm" onClick={() => openDecisionModal(loan, 'REJECT')} title="Reject">
                                <XCircle size={15} />
                              </Button>
                            </>
                          )}
                          {normalize(loan.status) === 'APPROVED' && (
                            <Button
                              variant="outline-primary"
                              size="sm"
                              title={agreementStatus === 'SIGNED' ? 'Disburse loan' : 'Awaiting borrower agreement signature'}
                              onClick={() => setDisburseTarget(loan)}
                              disabled={processing || agreementStatus !== 'SIGNED'}
                            >
                              <Send size={15} />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan="9" className="loans-empty">No loans found for current filters.</td>
                </tr>
              )}
            </tbody>
          </Table>
        </div>

        <div className="loans-pagination">
          <span>Showing {total ? (page - 1) * limit + 1 : 0} to {Math.min(page * limit, total)} of {total}</span>
          <div>
            <Button variant="outline-secondary" size="sm" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>Previous</Button>
            <Button variant="outline-secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Next</Button>
          </div>
        </div>
      </section>

      <LoanDetailModal
        loanId={selectedLoanId}
        onHide={() => setSelectedLoanId(null)}
        onChanged={fetchLoans}
        onApprove={(loan) => {
          setSelectedLoanId(null)
          openDecisionModal(loan, 'APPROVE')
        }}
        onReject={(loan) => {
          setSelectedLoanId(null)
          openDecisionModal(loan, 'REJECT')
        }}
        onDisburse={(loan) => {
          setSelectedLoanId(null)
          setDisburseTarget(loan)
        }}
        processing={processing}
      />

      <Modal show={Boolean(decisionLoan)} onHide={() => setDecisionLoan(null)} centered size={decisionType === 'APPROVE' ? 'lg' : undefined}>
        <Modal.Header closeButton>
          <Modal.Title>{decisionType === 'APPROVE' ? 'Approve Loan' : 'Reject Loan'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {decisionLoan && (
            <div className="decision-body">
              <div className="decision-summary">
                <strong>{getUserName(decisionLoan)}</strong>
                <span>Requested {formatCurrency(getRequestedAmount(decisionLoan))} for {decisionLoan.application?.tenureMonths || 0} months</span>
              </div>
              {decisionError && <div className="reject-warning mb-3"><AlertTriangle size={18} />{decisionError}</div>}
              {decisionType === 'APPROVE' ? (
                <>
                  {approvalBlockers.length > 0 && (
                    <div className="blocker-box">
                      <strong><ShieldAlert size={16} /> Clear these checks before approving</strong>
                      <span>{approvalBlockers.join(', ')}</span>
                      <Button size="sm" variant="outline-warning" onClick={() => { const id = decisionLoan._id; setDecisionLoan(null); setSelectedLoanId(id) }}>
                        Open verification review
                      </Button>
                    </div>
                  )}
                  <Row className="g-3">
                    <Col md={6}><OfferField label="Approved amount (Rs.)" name="amountApproved" form={decisionForm} setForm={setDecisionForm} errors={offerErrors} min="1" /></Col>
                    <Col md={6}><OfferField label="Interest rate (% p.a.)" name="rateAPR" form={decisionForm} setForm={setDecisionForm} errors={offerErrors} min="0" step="0.01" /></Col>
                    <Col md={6}><OfferField label="Tenure (months)" name="tenureMonths" form={decisionForm} setForm={setDecisionForm} errors={offerErrors} min="3" max="60" /></Col>
                    <Col md={6}><OfferField label="Processing fee (Rs.)" name="processingFee" form={decisionForm} setForm={setDecisionForm} errors={offerErrors} min="0" /></Col>
                    <Col md={6}><OfferField label="GST / tax (Rs.)" name="taxAmount" form={decisionForm} setForm={setDecisionForm} errors={offerErrors} min="0" /></Col>
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>Lender name</Form.Label>
                        <Form.Control value={decisionForm.lenderName} onChange={(event) => setDecisionForm((form) => ({ ...form, lenderName: event.target.value }))} placeholder="Regulated lending partner" />
                      </Form.Group>
                    </Col>
                  </Row>
                  {offerPreview && (
                    <div className="offer-preview">
                      <Info label="EMI" value={formatCurrency(offerPreview.emi)} />
                      <Info label="Total interest" value={formatCurrency(offerPreview.totalInterest)} />
                      <Info label="Total repayment" value={formatCurrency(offerPreview.totalRepayment)} />
                      <Info label="Net disbursal" value={formatCurrency(offerPreview.netDisbursal)} />
                      <Info label="All-inclusive APR" value={`${offerPreview.apr.toFixed(2)}%`} />
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="reject-warning"><AlertTriangle size={18} />The borrower will see the reason below.</div>
                  <Form.Group className="mt-3">
                    <Form.Label>Customer-friendly reason</Form.Label>
                    <Form.Control as="textarea" rows={3} value={decisionForm.rejectionReason} onChange={(event) => setDecisionForm((form) => ({ ...form, rejectionReason: event.target.value }))} />
                  </Form.Group>
                </>
              )}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={() => setDecisionLoan(null)}>Cancel</Button>
          {decisionType === 'APPROVE' && (
            <Button variant="outline-primary" onClick={previewAgreement} disabled={previewing || Object.keys(offerErrors).length > 0}>
              {previewing ? 'Preparing...' : 'Preview agreement'}
            </Button>
          )}
          <Button
            variant={decisionType === 'APPROVE' ? 'success' : 'danger'}
            onClick={submitDecision}
            disabled={processing || (decisionType === 'APPROVE' && (Object.keys(offerErrors).length > 0 || approvalBlockers.length > 0))}
          >
            {processing ? 'Processing...' : decisionType === 'APPROVE' ? 'Approve & generate agreement' : 'Reject loan'}
          </Button>
        </Modal.Footer>
      </Modal>

      <DisburseModal
        loan={disburseTarget}
        onHide={() => setDisburseTarget(null)}
        onDone={async () => {
          setDisburseTarget(null)
          await fetchLoans()
        }}
      />

      <style>{loansStyles}</style>
    </div>
  )
}

const OfferField = ({ label, name, form, setForm, errors, ...props }) => (
  <Form.Group>
    <Form.Label>{label}</Form.Label>
    <Form.Control
      type="number"
      value={form[name]}
      isInvalid={Boolean(errors[name])}
      onChange={(event) => setForm((current) => ({ ...current, [name]: event.target.value }))}
      {...props}
    />
    <Form.Control.Feedback type="invalid">{errors[name]}</Form.Control.Feedback>
  </Form.Group>
)

const DisburseModal = ({ loan, onHide, onDone }) => {
  const [utr, setUtr] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    setUtr('')
    setConfirmed(false)
    setMessage('')
  }, [loan?._id])

  if (!loan) return null
  const bank = loan.application?.bankDetails || {}
  const net = loan.decision?.netDisbursalAmount ?? loan.decision?.amountApproved
  const validUtr = /^[A-Za-z0-9/_-]{4,64}$/.test(utr.trim())

  const submit = async () => {
    if (!validUtr || !confirmed) return
    try {
      setBusy(true)
      setMessage('')
      await api.post(`/admin/loans/${loan._id}/disburse`, { txnId: utr.trim() })
      await onDone()
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to disburse loan')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal show onHide={busy ? undefined : onHide} centered>
      <Modal.Header closeButton={!busy}>
        <Modal.Title>Confirm disbursal</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="decision-body">
          <div className="offer-preview mt-0">
            <Info label="Borrower" value={getUserName(loan)} />
            <Info label="Transfer amount" value={formatCurrency(net)} />
            <Info label="Bank" value={bank.bankName || 'N/A'} />
            <Info label="Account" value={maskAccount(bank.accountNumber)} />
            <Info label="IFSC" value={bank.ifscCode || 'N/A'} />
            <Info label="Account holder" value={bank.accountHolderName || 'N/A'} />
          </div>
          {message && <div className="reject-warning mt-3"><AlertTriangle size={18} />{message}</div>}
          <Form.Group className="mt-3">
            <Form.Label>Bank transfer UTR / reference</Form.Label>
            <Form.Control value={utr} onChange={(event) => setUtr(event.target.value)} isInvalid={Boolean(utr) && !validUtr} placeholder="e.g. HDFCN52026092812345" autoFocus />
            <Form.Control.Feedback type="invalid">4 to 64 letters, numbers, / _ or -.</Form.Control.Feedback>
          </Form.Group>
          <Form.Check
            className="mt-3"
            id="confirm-disbursal"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            label={`I confirm ${formatCurrency(net)} has been transferred to account ending ${String(bank.accountNumber || '').slice(-4) || 'N/A'}.`}
          />
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="light" onClick={onHide} disabled={busy}>Cancel</Button>
        <Button onClick={submit} disabled={busy || !validUtr || !confirmed}>{busy ? 'Saving...' : 'Mark disbursed'}</Button>
      </Modal.Footer>
    </Modal>
  )
}

const REVIEW_STAGES = [
  ['pan', 'PAN'], ['aadhaar', 'Aadhaar / DigiLocker'], ['liveness', 'Live selfie'], ['faceMatch', 'Face match'],
  ['bank', 'Bank account'], ['upi', 'UPI ID'], ['bankStatement', 'Bank statement'], ['credit', 'Credit report'],
]

const stageTone = (status) => {
  const value = normalize(status)
  if (value === 'VERIFIED') return 'success'
  if (value === 'FAILED') return 'danger'
  if (value === 'REVIEW') return 'warning'
  if (value === 'PENDING') return 'info'
  return 'secondary'
}

const LoanDetailModal = ({ loanId, onHide, onChanged, onApprove, onReject, onDisburse, processing }) => {
  const [loan, setLoan] = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [reviewing, setReviewing] = useState(null)
  const [reviewNote, setReviewNote] = useState('')
  const [reviewBusy, setReviewBusy] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    if (!loanId) return
    try {
      setLoadingDetail(true)
      setDetailError('')
      const res = await api.get(`/admin/loans/${loanId}`)
      setLoan(res.data?.data || null)
    } catch (err) {
      setDetailError(err.response?.data?.message || 'Loan details could not be loaded')
    } finally {
      setLoadingDetail(false)
    }
  }, [loanId])

  useEffect(() => {
    setLoan(null)
    setNotice('')
    setReviewing(null)
    load()
  }, [load])

  const submitReview = async (decision) => {
    if (!reviewing || reviewNote.trim().length < 3) return
    try {
      setReviewBusy(true)
      const res = await api.post(`/admin/loans/${loan._id}/verification/${reviewing}/review`, { decision, note: reviewNote.trim() })
      setNotice(res.data?.message || 'Verification updated.')
      setReviewing(null)
      setReviewNote('')
      await load()
      onChanged?.()
    } catch (err) {
      setNotice(err.response?.data?.message || 'Verification review failed')
    } finally {
      setReviewBusy(false)
    }
  }

  const refreshSignature = async () => {
    try {
      setSyncing(true)
      const res = await api.post(`/admin/loans/${loan._id}/agreement/refresh`)
      setNotice(res.data?.message || 'Signature status refreshed.')
      await load()
      onChanged?.()
    } catch (err) {
      setNotice(err.response?.data?.message || 'Signature status could not be refreshed')
    } finally {
      setSyncing(false)
    }
  }

  if (!loanId) return null

  if (!loan) {
    return (
      <Modal show onHide={onHide} size="xl" centered>
        <Modal.Header closeButton><Modal.Title>Loan Details</Modal.Title></Modal.Header>
        <Modal.Body>
          {detailError
            ? <AlertStrip tone="danger" onRetry={load}>{detailError}</AlertStrip>
            : <div className="loans-loading"><div className="spinner-border text-primary" role="status" /><p>{loadingDetail ? 'Loading details...' : ''}</p></div>}
        </Modal.Body>
      </Modal>
    )
  }

  const status = statusMap[normalize(loan.status || 'PENDING')] || statusMap.PENDING
  const open = OPEN_STATUSES.includes(normalize(loan.status))
  const personal = loan.application?.personal || {}
  const employment = loan.application?.employment || {}
  const bank = loan.application?.bankDetails || {}
  const docs = loan.application?.documents || {}
  const uploadStatus = docs.uploadStatus || {}
  const aadhaarEkyc = docs.aadhaarEkyc || {}
  const signcare = loan.signcareVerification || null
  const aadhaarData = { ...(signcare?.aadhaar?.data || {}), ...(aadhaarEkyc.aadhaarData || {}) }
  const aadhaarAddress = aadhaarData.completeAddress || aadhaarData.address || [
    aadhaarData.careOf, aadhaarData.house, aadhaarData.street, aadhaarData.locality,
    aadhaarData.postOffice, aadhaarData.district, aadhaarData.state, aadhaarData.pincode,
  ].filter(Boolean).join(', ')
  const panVerification = getPanVerification(loan)
  const panData = getPanData(loan)
  const panName = getPanName(loan)
  const panNumber = getPanNumber(loan)
  const panVerified = normalize(signcare?.pan?.status) === 'VERIFIED' || getPanStatus(loan)
  const nextDue = getNextDue(loan)
  const bsaData = signcare?.bankStatement?.data || {}
  const bsaReport = bsaData.jsonDetails || bsaData.json_details || null
  const statementAccount = bsaReport?.statementAccount || {}
  const statementTransactions = bsaReport?.consolidatedinfo?.xns_list || []
  const statementSummary = bsaReport?.consolidatedinfo?.xns || {}
  const underwriting = loan.underwriting || loan.verification?.snapshot?.underwriting || null
  const underwritingMetrics = underwriting?.metrics || {}
  const underwritingFlags = Array.isArray(underwriting?.flags) ? underwriting.flags : []
  const policy = loan.verificationPolicy || {}
  const requiredStages = new Set(policy.required || [])
  const agreement = loan.agreementDetails || {}
  const agreementStatus = agreement.status || getAgreementStatus(loan)

  return (
    <Modal show onHide={onHide} size="xl" centered>
      <Modal.Header closeButton>
        <Modal.Title>Loan Details</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="loan-detail">
          <div className="loan-detail-hero">
            <div>
              <span>Loan Account</span>
              <h3>{loan.loanAccountNumber || `LN-${String(loan._id).slice(-8)}`}</h3>
              <p>{String(loan._id || '')}</p>
            </div>
            <Badge bg={status.bg}>{status.label}</Badge>
          </div>

          {notice && <AlertStrip tone="info">{notice}</AlertStrip>}

          <Row className="g-3">
            <Col lg={4}><DetailBox icon={UserRound} label="Borrower" value={getUserName(loan)} meta={`${getUserMobile(loan)} | ${loan.userId?.email || personal.email || 'No email'}`} /></Col>
            <Col lg={4}><DetailBox icon={IndianRupee} label="Requested" value={formatCurrency(getRequestedAmount(loan))} meta={`${loan.application?.tenureMonths || 0} months | ${loan.application?.purpose || 'No purpose'}`} /></Col>
            <Col lg={4}><DetailBox icon={Banknote} label="Approved" value={formatCurrency(getApprovedAmount(loan))} meta={loan.decision?.amountApproved ? `${loan.decision?.rateAPR ?? 0}% p.a. / ${loan.decision?.tenureMonths || 0} months / EMI ${formatCurrency(loan.decision?.emi)}` : 'Not decided'} /></Col>
          </Row>

          <div className="detail-section">
            <div className="section-heading-row">
              <h4>Verification review</h4>
              <Badge bg={policy.approvable ? 'success' : 'warning'}>
                {policy.approvable ? 'Ready for approval' : `Clear: ${(policy.approvalBlockingLabels || []).join(', ')}`}
              </Badge>
            </div>
            <div className="detail-grid">
              {REVIEW_STAGES.map(([key, label]) => {
                const stage = signcare?.[key] || {}
                const stageStatus = normalize(stage.status || 'NOT_STARTED')
                const required = requiredStages.has(key)
                const canReview = open && required && stageStatus !== 'VERIFIED'
                return (
                  <div className={`info-box stage-box ${required ? '' : 'optional'}`} key={key}>
                    <span>{label}{required ? '' : ' (not required)'}</span>
                    <div className="d-flex align-items-center gap-2 mb-1"><Badge bg={stageTone(stageStatus)}>{stageStatus.replaceAll('_', ' ')}</Badge></div>
                    <strong>{stage.message || 'Awaiting customer action'}</strong>
                    {stage.reviewedAt && <small>Reviewed {formatDate(stage.reviewedAt)}: {stage.reviewNote}</small>}
                    {stage.verifiedAt && <small>Verified: {formatDate(stage.verifiedAt)}</small>}
                    {canReview && reviewing !== key && (
                      <Button size="sm" variant="outline-primary" className="mt-2" onClick={() => { setReviewing(key); setReviewNote('') }}>
                        Review manually
                      </Button>
                    )}
                    {reviewing === key && (
                      <div className="review-box">
                        <Form.Control as="textarea" rows={2} value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} placeholder="What did you check? (required)" />
                        <div className="d-flex gap-2 mt-2">
                          <Button size="sm" variant="success" disabled={reviewBusy || reviewNote.trim().length < 3} onClick={() => submitReview('VERIFIED')}>Mark verified</Button>
                          <Button size="sm" variant="outline-danger" disabled={reviewBusy || reviewNote.trim().length < 3} onClick={() => submitReview('FAILED')}>Mark failed</Button>
                          <Button size="sm" variant="light" disabled={reviewBusy} onClick={() => setReviewing(null)}>Cancel</Button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="detail-section">
            <div className="section-heading-row">
              <h4>Digital Loan Agreement</h4>
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <Badge bg={agreementTone(agreementStatus)}>{agreementLabel(agreementStatus)}</Badge>
                {['SIGNING', 'FAILED'].includes(agreementStatus) && (
                  <Button size="sm" variant="outline-primary" onClick={refreshSignature} disabled={syncing}>
                    <RefreshCcw size={14} className={syncing ? 'spin me-1' : 'me-1'} />
                    {syncing ? 'Checking...' : 'Refresh signature status'}
                  </Button>
                )}
              </div>
            </div>
            <div className="detail-grid">
              <Info label="SignCare document" value={agreement.documentId || 'Not created'} />
              <Info label="Signer status" value={agreement.signerStatus || agreement.providerStatus || 'N/A'} />
              <Info label="Signed at" value={formatDate(agreement.signedAt)} />
              <Info label="Last checked" value={formatDate(agreement.lastSyncedAt)} />
              <Info label="Audit trail" value={agreement.auditTrailStatus || 'NOT_STARTED'} />
              <Info label="Signing attempts" value={agreement.attempts ?? 0} />
              {agreement.lastError && <Info label="Last issue" value={agreement.lastError} />}
            </div>
            <div className="d-flex flex-wrap gap-2 mt-3">
              {agreement.agreementUrl && <Button as="a" size="sm" variant="outline-primary" href={agreement.agreementUrl} target="_blank" rel="noreferrer">View approved agreement PDF</Button>}
              {agreement.signedAgreementUrl && <Button as="a" size="sm" variant="success" href={agreement.signedAgreementUrl} target="_blank" rel="noreferrer">View signed agreement</Button>}
            </div>
          </div>

          <div className="detail-section">
            <div className="section-heading-row">
              <h4>Underwriting Risk Summary</h4>
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <Badge bg={riskTone(underwriting?.riskLevel)}>{underwriting?.riskLevel || 'Not generated'}</Badge>
                {underwriting?.recommendation && <Badge bg="info">{String(underwriting.recommendation).replaceAll('_', ' ')}</Badge>}
              </div>
            </div>
            <div className="detail-grid">
              <Info label="Risk score" value={underwriting?.score === undefined ? 'N/A' : `${underwriting.score}/100`} />
              <Info label="Bureau score" value={underwritingMetrics.bureauScore ?? 'N/A'} />
              <Info label="Monthly income" value={formatCurrency(underwritingMetrics.monthlyIncome || employment.monthlyIncome || 0)} />
              <Info label="Requested amount" value={formatCurrency(underwritingMetrics.requestedAmount || getRequestedAmount(loan))} />
              <Info label="Loan to annual income" value={underwritingMetrics.emiBurdenRatio === null || underwritingMetrics.emiBurdenRatio === undefined ? 'N/A' : `${underwritingMetrics.emiBurdenRatio}x`} />
              <Info label="Outstanding balance" value={formatCurrency(underwritingMetrics.outstandingBalance || 0)} />
              <Info label="Past due amount" value={formatCurrency(underwritingMetrics.overdueAmount || 0)} />
              <Info label="Recent enquiries" value={underwritingMetrics.inquiries30Days ?? 'N/A'} />
            </div>
            <div className="risk-flag-list">
              {underwritingFlags.length ? underwritingFlags.map((flag) => (
                <div className="risk-flag" key={`${flag.code}-${flag.message}`}>
                  <Badge bg={riskTone(flag.severity)}>{flag.severity || 'INFO'}</Badge>
                  <strong>{flag.code || 'RISK_FLAG'}</strong>
                  <span>{flag.message || 'Review this application manually.'}</span>
                </div>
              )) : (
                <div className="risk-flag muted">
                  <Badge bg="success">CLEAR</Badge>
                  <strong>No risk flags</strong>
                  <span>All available checks are within configured thresholds.</span>
                </div>
              )}
            </div>
          </div>

          <div className="detail-section">
            <h4>Applicant Details</h4>
            <div className="detail-grid">
              <Info label="Name" value={personal.name || getUserName(loan)} />
              <Info label="Mobile" value={personal.mobile || getUserMobile(loan)} />
              <Info label="Email" value={personal.email || loan.userId?.email || 'N/A'} />
              <Info label="Address" value={personal.address || 'N/A'} />
              <Info label="Father" value={personal.fatherName || 'N/A'} />
              <Info label="Mother" value={personal.motherName || 'N/A'} />
            </div>
          </div>

          <div className="detail-section">
            <h4>Aadhaar eKYC (DigiLocker)</h4>
            <div className="detail-grid">
              {aadhaarData.photoBase64 && (
                <div className="info-box">
                  <span>Aadhaar Photo</span>
                  <img
                    className="ekyc-photo"
                    alt="Aadhaar"
                    src={String(aadhaarData.photoBase64).startsWith('data:') ? aadhaarData.photoBase64 : `data:image/jpeg;base64,${aadhaarData.photoBase64}`}
                  />
                </div>
              )}
              <Info label="Aadhaar Number" value={maskAadhaar(aadhaarEkyc.aadhaarNumber) || aadhaarData.maskedAadhaar || 'N/A'} />
              <Info label="Aadhaar Verified" value={normalize(signcare?.aadhaar?.status) === 'VERIFIED' ? 'Verified' : 'Not verified'} />
              <Info label="Name (Aadhaar)" value={aadhaarData.fullName || 'N/A'} />
              <Info label="Care of / Guardian" value={aadhaarData.careOf || 'N/A'} />
              <Info label="Date of Birth" value={aadhaarData.dob || 'N/A'} />
              <Info label="Gender" value={aadhaarData.gender || 'N/A'} />
              <Info label="Complete Address (Aadhaar)" value={aadhaarAddress || 'N/A'} />
              <Info label="District" value={aadhaarData.district || 'N/A'} />
              <Info label="State" value={aadhaarData.state || 'N/A'} />
              <Info label="Pincode" value={aadhaarData.pincode || 'N/A'} />
            </div>
          </div>

          <div className="detail-section pan-detail-section">
            <div className="section-heading-row">
              <h4>PAN Card Verification</h4>
              <Badge bg={panVerified ? 'success' : 'warning'}>{panVerified ? 'Verified' : 'Not verified'}</Badge>
            </div>
            <div className="detail-grid">
              <Info label="PAN Number" value={maskPan(panNumber) || 'N/A'} />
              <Info label="Name on PAN" value={panName || 'N/A'} />
              <Info label="Provider Status" value={panData.panStatus || panData.status || 'N/A'} />
              <Info label="Aadhaar Seeding" value={panData.aadhaarSeedingStatus || 'N/A'} />
              <Info label="Verified At" value={formatDate(panVerification.verifiedAt || signcare?.pan?.verifiedAt)} />
            </div>
          </div>

          <div className="detail-section credit-report-section">
            <div className="section-heading-row">
              <h4>Bank Statement Analysis</h4>
              <Badge bg={stageTone(signcare?.bankStatement?.status)}>{signcare?.bankStatement?.status || 'Not analysed'}</Badge>
            </div>
            <div className="detail-grid">
              <Info label="Bank" value={statementAccount.bank || 'N/A'} />
              <Info label="Account" value={statementAccount.accountNo ? `****${String(statementAccount.accountNo).slice(-4)}` : 'N/A'} />
              <Info label="Account Type" value={statementAccount.accountType || statementAccount.accountSubType || 'N/A'} />
              <Info label="Current Balance" value={statementAccount.currentBalance || 'N/A'} />
              <Info label="Statement Period" value={[statementSummary.startDate, statementSummary.endDate].filter(Boolean).join(' to ') || 'N/A'} />
              <Info label="Transactions Analysed" value={statementTransactions.length || 'N/A'} />
            </div>
            {bsaReport && (
              <details className="ekyc-raw">
                <summary>View complete bank statement analysis</summary>
                <pre>{JSON.stringify(bsaReport, null, 2)}</pre>
              </details>
            )}
          </div>

          <ExperianReport
            stage={signcare?.credit}
            archive={loan.creditReport || null}
            userId={loan.userId?._id || loan.userId}
            customerName={panName || getUserName(loan)}
            panMasked={maskPan(panNumber)}
          />

          <div className="detail-section">
            <h4>Employment & Bank</h4>
            <div className="detail-grid">
              <Info label="Employment" value={employment.employmentType || 'N/A'} />
              <Info label="Monthly income" value={formatCurrency(employment.monthlyIncome || 0)} />
              <Info label="Employer / Business" value={employment.employerOrBusiness || 'N/A'} />
              <Info label="Bank" value={bank.bankName || 'N/A'} />
              <Info label="Account holder" value={bank.accountHolderName || 'N/A'} />
              <Info label="Account number" value={maskAccount(bank.accountNumber)} />
              <Info label="IFSC" value={bank.ifscCode || 'N/A'} />
              <Info label="UPI ID" value={bank.upiId || 'Not provided'} />
            </div>
          </div>

          <div className="detail-section">
            <h4>Documents</h4>
            {docs.uploadReview?.status === 'REVIEW' && (
              <div className="reject-warning mb-3"><AlertTriangle size={18} />{docs.uploadReview.message}</div>
            )}
            <div className="doc-grid">
              <DocLink label="Aadhaar Front" url={docs.aadhaarFrontUrl} upload={uploadStatus.aadhaarFrontUrl} />
              <DocLink label="Aadhaar Back" url={docs.aadhaarBackUrl} upload={uploadStatus.aadhaarBackUrl} />
              <DocLink label="PAN" url={docs.panUrl} upload={uploadStatus.panUrl} />
              <DocLink label="Selfie" url={docs.selfieUrl} upload={uploadStatus.selfieUrl} />
              <DocLink label={`Income Proof${docs.incomeProofType ? ` (${incomeProofLabel(docs.incomeProofType)})` : ''}`} url={docs.incomeProofUrl} upload={uploadStatus.incomeProofUrl} />
            </div>
          </div>

          <div className="detail-section">
            <h4>Repayment Schedule</h4>
            <div className="schedule-summary">
              <Info label="Next EMI" value={nextDue ? formatCurrency(nextDue.total) : 'N/A'} />
              <Info label="Next due date" value={nextDue ? formatDate(nextDue.dueDate) : 'N/A'} />
              <Info label="Paid installments" value={`${loan.schedule?.filter((item) => item.paid).length || 0} / ${loan.schedule?.length || 0}`} />
              <Info label="Total repayment" value={loan.decision?.totalRepaymentAmount ? formatCurrency(loan.decision.totalRepaymentAmount) : 'N/A'} />
            </div>
            <div className="schedule-table-wrap">
              <Table responsive hover className="schedule-table">
                <thead>
                  <tr>
                    <th>No</th>
                    <th>Due date</th>
                    <th>Principal</th>
                    <th>Interest</th>
                    <th>Total</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loan.schedule?.length ? loan.schedule.map((item) => (
                    <tr key={item.installmentNo}>
                      <td>{item.installmentNo}</td>
                      <td>{formatDate(item.dueDate)}</td>
                      <td>{formatCurrency(item.principal)}</td>
                      <td>{formatCurrency(item.interest)}</td>
                      <td><strong>{formatCurrency(item.total)}</strong></td>
                      <td><Badge bg={item.paid ? 'success' : new Date(item.dueDate) < new Date() ? 'danger' : 'warning'}>{item.paid ? 'Paid' : new Date(item.dueDate) < new Date() ? 'Overdue' : 'Pending'}</Badge></td>
                    </tr>
                  )) : (
                    <tr><td colSpan="6" className="loans-empty">The EMI schedule is created at disbursal.</td></tr>
                  )}
                </tbody>
              </Table>
            </div>
          </div>

          <div className="detail-section">
            <h4>History</h4>
            <div className="history-list">
              {(loan.statusHistory || []).slice().reverse().map((row, index) => (
                <div className="history-row" key={`${row.status}-${index}`}>
                  <Badge bg="light" text="dark">{String(row.status || '').replaceAll('_', ' ')}</Badge>
                  <div>
                    <strong>{row.title || row.status}</strong>
                    <small>{row.message}{row.reason ? ` - ${row.reason}` : ''}</small>
                  </div>
                  <span>{formatDate(row.createdAt)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="light" onClick={onHide}>Close</Button>
        {open && (
          <>
            <Button variant="outline-danger" onClick={() => onReject(loan)}>Reject</Button>
            <Button variant="success" onClick={() => onApprove(loan)} disabled={!policy.approvable} title={policy.approvable ? 'Approve' : 'Clear verification first'}>Approve</Button>
          </>
        )}
        {normalize(loan.status) === 'APPROVED' && (
          <Button
            onClick={() => onDisburse(loan)}
            disabled={processing || agreementStatus !== 'SIGNED'}
            title={agreementStatus === 'SIGNED' ? 'Disburse loan' : 'Awaiting borrower agreement signature'}
          >
            {agreementStatus === 'SIGNED' ? 'Disburse' : 'Awaiting signature'}
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  )
}

const StatCard = ({ title, value, icon: Icon, color }) => (
  <div className="loan-stat-card">
    <div style={{ color, background: `${color}18` }}><Icon size={24} /></div>
    <span>{title}</span>
    <strong>{Number(value || 0).toLocaleString('en-IN')}</strong>
  </div>
)

const AmountCard = ({ label, value, icon: Icon }) => (
  <div className="amount-card">
    <div><Icon size={20} /></div>
    <span>{label}</span>
    <strong>{value}</strong>
  </div>
)

const DetailBox = ({ icon: Icon, label, value, meta }) => (
  <div className="detail-box">
    <Icon size={20} />
    <span>{label}</span>
    <strong>{value}</strong>
    <small>{meta}</small>
  </div>
)

const Info = ({ label, value }) => (
  <div className="info-box">
    <span>{label}</span>
    <strong>{value}</strong>
  </div>
)

const DocLink = ({ label, url, upload }) => {
  if (url) {
    return (
      <a className="doc-link" href={url} target="_blank" rel="noreferrer">
        <FileText size={17} />
        {label}
      </a>
    )
  }
  const state = normalize(upload?.status)
  const text = state === 'FAILED' ? 'upload failed' : state === 'UPLOADING' ? 'uploading...' : 'not uploaded'
  return (
    <div className={`doc-link disabled ${state === 'FAILED' ? 'failed' : ''}`} title={upload?.message || ''}>
      <FileText size={17} />
      {label} {text}
    </div>
  )
}

const isOverdue = (loan) => {
  const nextDue = getNextDue(loan)
  return normalize(loan.status) === 'DISBURSED' && nextDue?.dueDate && new Date(nextDue.dueDate) < new Date()
}

const maskAccount = (value) => {
  if (!value) return 'N/A'
  const account = String(value)
  return account.length > 4 ? `XXXX-${account.slice(-4)}` : account
}

const maskAadhaar = (value) => {
  if (!value) return ''
  const digits = String(value)
  return digits.length >= 4 ? `XXXX-XXXX-${digits.slice(-4)}` : digits
}

const maskPan = (value) => {
  if (!value) return ''
  const raw = String(value).toUpperCase()
  return raw.length >= 4 ? `XXXXXX${raw.slice(-4)}` : raw
}

const incomeProofLabel = (type) => {
  const labels = { SALARY_SLIP: 'Salary Slip', BANK_STATEMENT: 'Bank Statement', OTHER: 'Other' }
  return labels[type] || type
}

const loansStyles = `
  .loans-loading {
    min-height: 50vh;
    display: grid;
    place-items: center;
    gap: 12px;
    color: #64748B;
  }

  .loans-page {
    color: #0F172A;
  }

  .loan-actions,
  .loans-pagination div {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
  }

  .loan-stat-card,
  .amount-card,
  .loans-panel {
    background: #FFFFFF;
    border: 1px solid #E2E8F0;
    border-radius: 8px;
    box-shadow: 0 12px 28px rgba(15, 23, 42, 0.07);
  }

  .loan-stat-card {
    min-height: 142px;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .loan-stat-card > div {
    width: 48px;
    height: 48px;
    border-radius: 8px;
    display: grid;
    place-items: center;
  }

  .loan-stat-card span,
  .amount-card span {
    color: #64748B;
    font-size: 13px;
    font-weight: 900;
    text-transform: uppercase;
  }

  .loan-stat-card strong {
    font-size: 27px;
    line-height: 1.1;
  }

  .amount-card {
    padding: 18px;
    display: grid;
    grid-template-columns: auto 1fr;
    align-items: center;
    gap: 4px 12px;
  }

  .amount-card > div {
    grid-row: span 2;
    width: 44px;
    height: 44px;
    display: grid;
    place-items: center;
    border-radius: 8px;
    color: #2563EB;
    background: #DBEAFE;
  }

  .amount-card strong {
    font-size: 22px;
  }

  .loans-panel {
    padding: 18px;
  }

  .loans-panel-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
  }

  .loans-panel-head h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 900;
  }

  .loans-panel-head p {
    margin: 3px 0 0;
    color: #64748B;
    font-weight: 700;
  }

  .loans-count-pill {
    padding: 8px 12px;
    border-radius: 999px;
    background: #F1F5F9;
    color: #334155;
    font-size: 13px;
    font-weight: 900;
    white-space: nowrap;
  }

  .loans-toolbar {
    display: grid;
    grid-template-columns: minmax(260px, 1.6fr) repeat(4, minmax(135px, 1fr));
    gap: 10px;
    margin-bottom: 14px;
  }

  .loans-search {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 12px;
    border-radius: 8px;
    border: 1px solid #CBD5E1;
    background: white;
  }

  .loans-search input {
    width: 100%;
    border: 0;
    outline: 0;
    min-height: 38px;
    font-weight: 700;
  }

  .loans-table-wrap,
  .schedule-table-wrap {
    border: 1px solid #E2E8F0;
    border-radius: 8px;
    overflow: hidden;
  }

  .loans-table,
  .schedule-table {
    margin: 0;
  }

  .loans-table th,
  .schedule-table th {
    background: #F8FAFC;
    color: #475569;
    font-size: 12px;
    text-transform: uppercase;
    padding: 13px 14px;
    border-bottom: 1px solid #E2E8F0;
    white-space: nowrap;
  }

  .loans-table td,
  .schedule-table td {
    vertical-align: middle;
    padding: 14px;
    color: #334155;
  }

  .loans-table td small,
  .schedule-table td small {
    display: block;
    color: #64748B;
    font-weight: 700;
    margin-top: 2px;
  }

  .loan-id-cell,
  .borrower-cell,
  .due-cell,
  .pan-kyc-cell {
    display: grid;
    gap: 3px;
    min-width: 150px;
  }

  .pan-kyc-cell {
    min-width: 170px;
  }

  .pan-kyc-cell .badge {
    width: fit-content;
  }

  .borrower-cell {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 220px;
  }

  .borrower-cell > div {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: linear-gradient(135deg, #2563EB, #059669);
    color: white;
    font-weight: 900;
    flex: 0 0 auto;
  }

  .due-cell.overdue strong {
    color: #DC2626;
  }

  .muted-text {
    color: #94A3B8;
    font-weight: 800;
  }

  .loan-actions .btn {
    width: 34px;
    height: 34px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
  }

  .loans-empty {
    text-align: center;
    color: #64748B !important;
    padding: 32px !important;
    font-weight: 700;
  }

  .loans-pagination {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    padding-top: 14px;
    color: #64748B;
    font-size: 13px;
    font-weight: 800;
  }

  .decision-body,
  .loan-detail {
    display: grid;
    gap: 16px;
  }

  .decision-summary,
  .reject-warning {
    display: grid;
    gap: 4px;
    padding: 14px;
    border-radius: 8px;
    background: #F8FAFC;
    border: 1px solid #E2E8F0;
  }

  .reject-warning {
    display: flex;
    align-items: center;
    background: #FEF2F2;
    border-color: #FECACA;
    color: #B91C1C;
    font-weight: 800;
  }

  .loan-detail-hero {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 18px;
    border-radius: 8px;
    background: linear-gradient(135deg, #0F172A, #1E293B);
    color: white;
  }

  .loan-detail-hero span {
    color: #7DD3FC;
    font-size: 12px;
    font-weight: 900;
    text-transform: uppercase;
  }

  .loan-detail-hero h3 {
    margin: 4px 0;
  }

  .loan-detail-hero p {
    margin: 0;
    color: #CBD5E1;
    word-break: break-word;
  }

  .detail-box {
    padding: 15px;
    border-radius: 8px;
    background: #F8FAFC;
    border: 1px solid #E2E8F0;
    display: grid;
    gap: 5px;
    height: 100%;
  }

  .detail-box svg {
    color: #2563EB;
  }

  .detail-box span,
  .info-box span {
    color: #64748B;
    font-size: 12px;
    font-weight: 900;
    text-transform: uppercase;
  }

  .detail-box strong {
    color: #0F172A;
    font-size: 18px;
  }

  .detail-box small {
    color: #64748B;
    font-weight: 700;
  }

  .detail-section {
    display: grid;
    gap: 12px;
  }

  .detail-section h4 {
    font-size: 16px;
    font-weight: 900;
    margin: 0;
  }

  .section-heading-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }

  .pan-detail-section {
    padding: 14px;
    border: 1px solid #BBF7D0;
    border-radius: 8px;
    background: #F0FDF4;
  }

  .pan-detail-section .info-box {
    border-color: #BBF7D0;
  }

  .detail-grid,
  .schedule-summary {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
  }

  .info-box {
    padding: 13px;
    border-radius: 8px;
    background: #FFFFFF;
    border: 1px solid #E2E8F0;
    display: grid;
    gap: 5px;
    min-width: 0;
  }

  .info-box strong {
    color: #0F172A;
    word-break: break-word;
  }

  .risk-flag-list {
    display: grid;
    gap: 8px;
  }

  .risk-flag {
    display: grid;
    grid-template-columns: auto minmax(140px, 220px) minmax(0, 1fr);
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border: 1px solid #E2E8F0;
    border-radius: 8px;
    background: #FFFFFF;
  }

  .risk-flag strong {
    color: #0F172A;
    font-size: 13px;
    word-break: break-word;
  }

  .risk-flag span:last-child {
    color: #475569;
    font-weight: 700;
    word-break: break-word;
  }

  .risk-flag.muted {
    background: #F8FAFC;
  }

  .ekyc-photo {
    width: 96px;
    height: 96px;
    object-fit: cover;
    border-radius: 8px;
    border: 1px solid #E2E8F0;
  }

  .ekyc-raw {
    margin-top: 14px;
  }

  .ekyc-raw summary {
    cursor: pointer;
    font-weight: 700;
    color: #0F766E;
    padding: 8px 0;
  }

  .ekyc-raw-label {
    font-weight: 800;
    color: #475569;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    margin: 10px 0 6px;
  }

  .ekyc-raw pre {
    background: #0B1220;
    color: #E2E8F0;
    padding: 14px;
    border-radius: 8px;
    max-height: 320px;
    overflow: auto;
    font-size: 12px;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .doc-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
  }

  .doc-link {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 12px;
    border-radius: 8px;
    background: #EFF6FF;
    border: 1px solid #BFDBFE;
    color: #1D4ED8;
    text-decoration: none;
    font-weight: 800;
  }

  .doc-link.disabled {
    background: #F8FAFC;
    border-color: #E2E8F0;
    color: #94A3B8;
  }

  .spin {
    animation: loansSpin 0.9s linear infinite;
  }

  @keyframes loansSpin {
    to { transform: rotate(360deg); }
  }

  @media (max-width: 1200px) {
    .loans-toolbar {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .loans-search {
      grid-column: 1 / -1;
    }

    .detail-grid,
    .schedule-summary,
    .doc-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 768px) {
    .loans-panel-head,
    .loans-pagination,
    .loan-detail-hero {
      align-items: flex-start;
      flex-direction: column;
    }

    .loans-toolbar,
    .detail-grid,
    .schedule-summary,
    .doc-grid {
      grid-template-columns: 1fr;
    }

    .risk-flag {
      grid-template-columns: 1fr;
      align-items: flex-start;
    }

    .offer-preview {
      grid-template-columns: 1fr 1fr;
    }

    .history-row {
      grid-template-columns: 1fr;
    }
  }

  .blocker-box {
    display: grid;
    gap: 6px;
    justify-items: start;
    padding: 12px 14px;
    margin-bottom: 16px;
    border: 1px solid #FCD34D;
    background: #FFFBEB;
    border-radius: 8px;
    color: #92400E;
  }

  .blocker-box strong {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .offer-preview {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 10px;
    margin-top: 16px;
    padding: 12px;
    border-radius: 8px;
    background: #F0FDFA;
    border: 1px solid #99F6E4;
  }

  .stage-box.optional {
    opacity: 0.7;
  }

  .review-box {
    margin-top: 10px;
  }

  .doc-link.disabled.failed {
    color: #B91C1C;
    border-color: #FECACA;
    background: #FEF2F2;
  }

  .history-list {
    display: grid;
    gap: 8px;
  }

  .history-row {
    display: grid;
    grid-template-columns: 170px 1fr auto;
    gap: 12px;
    align-items: start;
    padding: 10px 12px;
    border: 1px solid #E2E8F0;
    border-radius: 8px;
  }

  .history-row div {
    display: grid;
    gap: 2px;
  }

  .history-row small,
  .history-row span {
    color: #64748B;
    font-size: 12px;
  }
`

export default Loans
