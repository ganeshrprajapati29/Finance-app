import React, { useEffect, useMemo, useState } from 'react'
import { Badge, Button, Col, Form, Modal, Row, Table } from 'react-bootstrap'
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  Clock3,
  Download,
  Eye,
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
  APPROVED: { bg: 'success', label: 'Approved', color: '#059669' },
  REJECTED: { bg: 'danger', label: 'Rejected', color: '#DC2626' },
  DISBURSED: { bg: 'info', label: 'Disbursed', color: '#0891B2' },
  CLOSED: { bg: 'secondary', label: 'Closed', color: '#475569' },
}

const Loans = () => {
  const [loans, setLoans] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [riskFilter, setRiskFilter] = useState('ALL')
  const [sortBy, setSortBy] = useState('newest')
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [selectedLoan, setSelectedLoan] = useState(null)
  const [decisionLoan, setDecisionLoan] = useState(null)
  const [decisionType, setDecisionType] = useState('')
  const [decisionForm, setDecisionForm] = useState({ amountApproved: '', rateAPR: '', tenureMonths: '', processingFee: '0', taxAmount: '0', lenderName: '', rejectionReason: '' })
  const [processing, setProcessing] = useState(false)

  const fetchLoans = async () => {
    try {
      setError('')
      const res = await api.get('/admin/loans?status=ALL&limit=1000&sortBy=createdAt&sortOrder=desc')
      const data = res.data?.data || res.data || {}
      const items = Array.isArray(data) ? data : data.items || []
      setLoans(items)
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Loans could not be loaded')
      setLoans([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchLoans()
  }, [])

  useEffect(() => {
    setPage(1)
  }, [statusFilter, riskFilter, sortBy, searchTerm, limit])

  const stats = useMemo(() => {
    const totalRequested = loans.reduce((sum, loan) => sum + getRequestedAmount(loan), 0)
    const totalApproved = loans.reduce((sum, loan) => sum + getApprovedAmount(loan), 0)
    const overdue = loans.filter((loan) => isOverdue(loan)).length
    return {
      total: loans.length,
      pending: loans.filter((loan) => normalize(loan.status) === 'PENDING').length,
      approved: loans.filter((loan) => normalize(loan.status) === 'APPROVED').length,
      disbursed: loans.filter((loan) => normalize(loan.status) === 'DISBURSED').length,
      rejected: loans.filter((loan) => normalize(loan.status) === 'REJECTED').length,
      overdue,
      totalRequested,
      totalApproved,
    }
  }, [loans])

  const filteredLoans = useMemo(() => {
    const term = searchTerm.toLowerCase().trim()

    return loans
      .filter((loan) => {
        const status = normalize(loan.status || 'PENDING')
        const nextDue = getNextDue(loan)
        const overdue = isOverdue(loan)
        const matchesStatus = statusFilter === 'ALL' || status === statusFilter
        const matchesRisk =
          riskFilter === 'ALL' ||
          (riskFilter === 'OVERDUE' && overdue) ||
          (riskFilter === 'DUE_SOON' && nextDue && !overdue && daysFromNow(nextDue.dueDate) <= 7) ||
          (riskFilter === 'NO_SCHEDULE' && status === 'DISBURSED' && !loan.schedule?.length)
        const matchesSearch =
          !term ||
          getUserName(loan).toLowerCase().includes(term) ||
          getUserMobile(loan).toLowerCase().includes(term) ||
          String(loan.userId?.email || '').toLowerCase().includes(term) ||
          String(loan.loanAccountNumber || '').toLowerCase().includes(term) ||
          String(loan._id || '').toLowerCase().includes(term)

        return matchesStatus && matchesRisk && matchesSearch
      })
      .sort((a, b) => {
        if (sortBy === 'oldest') return new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
        if (sortBy === 'requested') return getRequestedAmount(b) - getRequestedAmount(a)
        if (sortBy === 'approved') return getApprovedAmount(b) - getApprovedAmount(a)
        if (sortBy === 'due') return dueTime(a) - dueTime(b)
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
      })
  }, [loans, searchTerm, statusFilter, riskFilter, sortBy])

  const totalPages = Math.max(1, Math.ceil(filteredLoans.length / limit))
  const pagedLoans = filteredLoans.slice((page - 1) * limit, page * limit)

  const openDecisionModal = (loan, type) => {
    setDecisionLoan(loan)
    setDecisionType(type)
    setDecisionForm({
      amountApproved: loan.decision?.amountApproved || loan.application?.amountRequested || '',
      rateAPR: loan.decision?.rateAPR || 12,
      tenureMonths: loan.decision?.tenureMonths || loan.application?.tenureMonths || 12,
      processingFee: loan.decision?.processingFee || 0,
      taxAmount: loan.decision?.taxAmount || 0,
      lenderName: loan.decision?.lenderName || '',
      rejectionReason: '',
    })
  }

  const submitDecision = async () => {
    if (!decisionLoan) return
    try {
      setProcessing(true)
      if (decisionType === 'APPROVE') {
        await api.post(`/admin/loans/${decisionLoan._id}/decision`, {
          decision: 'APPROVED',
          amountApproved: Number(decisionForm.amountApproved || 0),
          rateAPR: Number(decisionForm.rateAPR || 0),
          tenureMonths: Number(decisionForm.tenureMonths || 0),
          processingFee: Number(decisionForm.processingFee || 0),
          taxAmount: Number(decisionForm.taxAmount || 0),
          lenderName: decisionForm.lenderName.trim(),
        })
      } else {
        if (!decisionForm.rejectionReason.trim()) {
          alert('Enter a customer-friendly rejection reason.')
          return
        }
        await api.post(`/admin/loans/${decisionLoan._id}/decision`, {
          decision: 'REJECTED', rejectionReason: decisionForm.rejectionReason.trim()
        })
      }
      setDecisionLoan(null)
      await fetchLoans()
    } catch (err) {
      alert(err.response?.data?.message || 'Loan decision failed')
    } finally {
      setProcessing(false)
    }
  }

  const disburseLoan = async (loan) => {
    const txnId = window.prompt('Enter confirmed bank transfer UTR/reference')?.trim()
    if (!txnId) return
    try {
      setProcessing(true)
      await api.post(`/admin/loans/${loan._id}/disburse`, { txnId })
      await fetchLoans()
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to disburse loan')
    } finally {
      setProcessing(false)
    }
  }

  const exportCsv = () => {
    const rows = filteredLoans.map((loan) => [
      loan._id,
      loan.loanAccountNumber || '',
      getUserName(loan),
      getUserMobile(loan),
      loan.userId?.email || loan.application?.personal?.email || '',
      normalize(loan.status || 'PENDING'),
      getRequestedAmount(loan),
      getApprovedAmount(loan),
      loan.decision?.rateAPR || '',
      loan.decision?.tenureMonths || '',
      formatDate(loan.createdAt),
      formatDate(loan.disbursementDate),
    ])
    const headers = ['Loan ID', 'Account No', 'User', 'Mobile', 'Email', 'Status', 'Requested', 'Approved', 'APR', 'Tenure', 'Applied', 'Disbursed']
    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `khatupay-loans-${Date.now()}.csv`
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
        subtitle="Review applications, approve and disburse, and track EMI schedules and overdue risk."
        actions={
          <>
            <Button variant="outline-primary" size="sm" onClick={exportCsv}>
              <Download size={14} className="me-1" /> Export CSV
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
        <Col xl={3} md={6}><StatCard title="Disbursed loans" value={stats.disbursed} icon={Send} color="#0891B2" /></Col>
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
            <p>{filteredLoans.length.toLocaleString('en-IN')} matching records</p>
          </div>
          <div className="loans-count-pill">Page {page} of {totalPages}</div>
        </div>

        <div className="loans-toolbar">
          <div className="loans-search">
            <Search size={18} />
            <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search user, mobile, email, loan ID" />
          </div>
          <Form.Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="ALL">All status</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="DISBURSED">Disbursed</option>
            <option value="REJECTED">Rejected</option>
            <option value="CLOSED">Closed</option>
          </Form.Select>
          <Form.Select value={riskFilter} onChange={(event) => setRiskFilter(event.target.value)}>
            <option value="ALL">All risk</option>
            <option value="OVERDUE">Overdue</option>
            <option value="DUE_SOON">Due soon</option>
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
                <th>Next EMI</th>
                <th>PAN KYC</th>
                <th>Status</th>
                <th>Applied</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagedLoans.length ? (
                pagedLoans.map((loan) => {
                  const status = statusMap[normalize(loan.status || 'PENDING')] || statusMap.PENDING
                  const nextDue = getNextDue(loan)
                  const overdue = isOverdue(loan)
                  const panVerified = getPanStatus(loan)
                  const panName = getPanName(loan)
                  const panNumber = getPanNumber(loan)
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
                        <small>{loan.decision?.rateAPR || 0}% APR / {loan.decision?.tenureMonths || loan.application?.tenureMonths || 0} mo</small>
                      </td>
                      <td>
                        {nextDue ? (
                          <div className={overdue ? 'due-cell overdue' : 'due-cell'}>
                            <strong>{formatCurrency(nextDue.total)}</strong>
                            <small>{formatDate(nextDue.dueDate)}</small>
                          </div>
                        ) : (
                          <span className="muted-text">No EMI</span>
                        )}
                      </td>
                      <td>
                        <div className="pan-kyc-cell">
                          <Badge bg={panVerified ? 'success' : 'warning'}>{panVerified ? 'Verified' : 'Pending'}</Badge>
                          <small>{panName || panNumber || 'No PAN data'}</small>
                        </div>
                      </td>
                      <td><Badge bg={status.bg}>{status.label}</Badge></td>
                      <td>{formatDate(loan.createdAt)}</td>
                      <td>
                        <div className="loan-actions">
                          <Button variant="light" size="sm" onClick={() => setSelectedLoan(loan)} title="View details">
                            <Eye size={15} />
                          </Button>
                          {normalize(loan.status) === 'PENDING' && (
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
                            <Button variant="outline-primary" size="sm" onClick={() => disburseLoan(loan)} disabled={processing}>
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
          <span>Showing {filteredLoans.length ? (page - 1) * limit + 1 : 0} to {Math.min(page * limit, filteredLoans.length)} of {filteredLoans.length}</span>
          <div>
            <Button variant="outline-secondary" size="sm" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>Previous</Button>
            <Button variant="outline-secondary" size="sm" disabled={page === totalPages} onClick={() => setPage((value) => value + 1)}>Next</Button>
          </div>
        </div>
      </section>

      <LoanDetailModal
        loan={selectedLoan}
        onHide={() => setSelectedLoan(null)}
        onApprove={(loan) => {
          setSelectedLoan(null)
          openDecisionModal(loan, 'APPROVE')
        }}
        onReject={(loan) => {
          setSelectedLoan(null)
          openDecisionModal(loan, 'REJECT')
        }}
        onDisburse={(loan) => {
          setSelectedLoan(null)
          disburseLoan(loan)
        }}
        processing={processing}
      />

      <Modal show={Boolean(decisionLoan)} onHide={() => setDecisionLoan(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>{decisionType === 'APPROVE' ? 'Approve Loan' : 'Reject Loan'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {decisionLoan && (
            <div className="decision-body">
              <div className="decision-summary">
                <strong>{getUserName(decisionLoan)}</strong>
                <span>Requested {formatCurrency(getRequestedAmount(decisionLoan))}</span>
              </div>
              {decisionType === 'APPROVE' ? (
                <>
                  <Form.Group>
                    <Form.Label>Approved amount</Form.Label>
                    <Form.Control type="number" min="1" value={decisionForm.amountApproved} onChange={(event) => setDecisionForm((form) => ({ ...form, amountApproved: event.target.value }))} />
                  </Form.Group>
                  <Form.Group>
                    <Form.Label>APR rate (%)</Form.Label>
                    <Form.Control type="number" min="0" step="0.1" value={decisionForm.rateAPR} onChange={(event) => setDecisionForm((form) => ({ ...form, rateAPR: event.target.value }))} />
                  </Form.Group>
                  <Form.Group>
                    <Form.Label>Tenure months</Form.Label>
                    <Form.Control type="number" min="1" value={decisionForm.tenureMonths} onChange={(event) => setDecisionForm((form) => ({ ...form, tenureMonths: event.target.value }))} />
                  </Form.Group>
                  <Form.Group>
                    <Form.Label>Processing fee</Form.Label>
                    <Form.Control type="number" min="0" value={decisionForm.processingFee} onChange={(event) => setDecisionForm((form) => ({ ...form, processingFee: event.target.value }))} />
                  </Form.Group>
                  <Form.Group>
                    <Form.Label>Tax amount</Form.Label>
                    <Form.Control type="number" min="0" value={decisionForm.taxAmount} onChange={(event) => setDecisionForm((form) => ({ ...form, taxAmount: event.target.value }))} />
                  </Form.Group>
                  <Form.Group>
                    <Form.Label>Lender name</Form.Label>
                    <Form.Control value={decisionForm.lenderName} onChange={(event) => setDecisionForm((form) => ({ ...form, lenderName: event.target.value }))} placeholder="Regulated lending partner" />
                  </Form.Group>
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
          <Button variant={decisionType === 'APPROVE' ? 'success' : 'danger'} onClick={submitDecision} disabled={processing}>
            {processing ? 'Processing...' : decisionType === 'APPROVE' ? 'Approve loan' : 'Reject loan'}
          </Button>
        </Modal.Footer>
      </Modal>

      <style>{loansStyles}</style>
    </div>
  )
}

const LoanDetailModal = ({ loan, onHide, onApprove, onReject, onDisburse, processing }) => {
  if (!loan) return null
  const status = statusMap[normalize(loan.status || 'PENDING')] || statusMap.PENDING
  const personal = loan.application?.personal || {}
  const employment = loan.application?.employment || {}
  const bank = loan.application?.bankDetails || {}
  const docs = loan.application?.documents || {}
  const aadhaarEkyc = docs.aadhaarEkyc || {}
  const aadhaarData = aadhaarEkyc.aadhaarData || {}
  const aadhaarAddress = aadhaarData.completeAddress || aadhaarData.address || [
    aadhaarData.careOf,
    aadhaarData.house,
    aadhaarData.street,
    aadhaarData.locality,
    aadhaarData.postOffice,
    aadhaarData.district,
    aadhaarData.state,
    aadhaarData.pincode,
  ].filter(Boolean).join(', ')
  const panVerification = getPanVerification(loan)
  const panData = getPanData(loan)
  const panResponse = panVerification.response || panData.raw || {}
  const panName = getPanName(loan)
  const panNumber = getPanNumber(loan)
  const panVerified = getPanStatus(loan)
  const nextDue = getNextDue(loan)
  const signcare = loan.signcareVerification || null
  const bsaData = signcare?.bankStatement?.data || {}
  const bsaReport = bsaData.jsonDetails || bsaData.json_details || null
  const statementAccount = bsaReport?.statementAccount || {}
  const statementTransactions = bsaReport?.consolidatedinfo?.xns_list || []
  const statementSummary = bsaReport?.consolidatedinfo?.xns || {}
  const signcareCredit = signcare?.credit?.data || {}
  const experianReport = signcareCredit.jsonExperianReport || signcareCredit.experianReport || null
  const experianAccounts = experianReport?.caiS_Account?.caiS_Account_DETAILS || []
  const experianSummary = experianReport?.caiS_Account?.caiS_Summary || {}
  const experianScore = experianReport?.score?.fcirexScore ?? signcare?.credit?.summary?.score ?? null
  const creditReport = loan.creditReport || loan.userKyc?.creditReport || (experianReport ? {
    provider: 'SignCare',
    environment: 'Production',
    bureau: 'Experian',
    status: signcare?.credit?.status || 'VERIFIED',
    score: experianScore,
    referenceId: signcare?.credit?.providerReference || signcare?.credit?.requestId,
    panMasked: maskPan(panNumber),
    name: panName,
    purpose: loan.application?.purpose,
    createdAt: signcare?.credit?.verifiedAt || signcare?.credit?.updatedAt,
    reportNumber: experianReport?.creditProfileHeader?.reportNumber,
    exactMatch: experianReport?.match_result?.exact_match,
    accountCount: experianAccounts.length,
    activeAccounts: experianAccounts.filter((item) => !item.date_Closed && Number(item.current_Balance || 0) > 0).length,
    outstandingBalance: experianAccounts.reduce((sum, item) => sum + Number(item.current_Balance || 0), 0),
    overdueAmount: experianAccounts.reduce((sum, item) => sum + Number(item.amount_Past_Due || 0), 0),
    inquiries30Days: experianReport?.totalCAPS_Summary?.totalCAPSLast30Days,
    response: signcareCredit,
  } : null)
  const signcareStages = [
    ['Consent', signcare?.consent?.accepted ? { status: 'VERIFIED', message: 'Customer consent recorded' } : null],
    ['PAN', signcare?.pan], ['Aadhaar OVSE', signcare?.aadhaar],
    ['Face liveness', signcare?.liveness], ['Face match', signcare?.faceMatch],
    ['Bank account', signcare?.bank], ['Bank statement analysis', signcare?.bankStatement], ['Experian', signcare?.credit],
    ['Account Aggregator', signcare?.accountAggregator], ['Agreement', signcare?.agreement],
    ['eStamp', signcare?.eStamp], ['Aadhaar eSign', signcare?.eSign], ['Audit trail', signcare?.auditTrail],
  ]

  return (
    <Modal show={Boolean(loan)} onHide={onHide} size="xl" centered>
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

          <Row className="g-3">
            <Col lg={4}><DetailBox icon={UserRound} label="Borrower" value={getUserName(loan)} meta={`${getUserMobile(loan)} | ${loan.userId?.email || personal.email || 'No email'}`} /></Col>
            <Col lg={4}><DetailBox icon={IndianRupee} label="Requested" value={formatCurrency(getRequestedAmount(loan))} meta={loan.application?.purpose || 'No purpose'} /></Col>
            <Col lg={4}><DetailBox icon={Banknote} label="Approved" value={formatCurrency(getApprovedAmount(loan))} meta={`${loan.decision?.rateAPR || 0}% APR / ${loan.decision?.tenureMonths || 0} months`} /></Col>
          </Row>

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
            <h4>Aadhaar eKYC Verification</h4>
            <div className="detail-grid">
              {aadhaarData.photoBase64 && (
                <div className="info-box">
                  <span>Aadhaar Photo</span>
                  <img
                    className="ekyc-photo"
                    alt="Aadhaar"
                    src={aadhaarData.photoBase64.startsWith('data:') ? aadhaarData.photoBase64 : `data:image/jpeg;base64,${aadhaarData.photoBase64}`}
                  />
                </div>
              )}
              <Info label="Aadhaar Number" value={maskAadhaar(aadhaarEkyc.aadhaarNumber) || aadhaarData.maskedAadhaar || 'N/A'} />
              <Info label="Aadhaar Verified" value={aadhaarEkyc.verified ? 'Verified' : 'Not verified'} />
              <Info label="Name (Aadhaar)" value={aadhaarData.fullName || 'N/A'} />
              <Info label="Care of / Guardian" value={aadhaarData.careOf || 'N/A'} />
              <Info label="Date of Birth" value={aadhaarData.dob || 'N/A'} />
              <Info label="Gender" value={aadhaarData.gender || 'N/A'} />
              <Info label="Complete Address (Aadhaar)" value={aadhaarAddress || 'N/A'} />
              <Info label="House / Street" value={[aadhaarData.house, aadhaarData.street].filter(Boolean).join(', ') || 'N/A'} />
              <Info label="Locality" value={aadhaarData.locality || 'N/A'} />
              <Info label="Post Office" value={aadhaarData.postOffice || 'N/A'} />
              <Info label="District" value={aadhaarData.district || 'N/A'} />
              <Info label="State" value={aadhaarData.state || 'N/A'} />
              <Info label="Pincode" value={aadhaarData.pincode || 'N/A'} />
              <Info label="Mobile Matched" value={aadhaarData.mobileMatched === undefined || aadhaarData.mobileMatched === null ? 'N/A' : (aadhaarData.mobileMatched ? 'Yes' : 'No')} />
            </div>
            {aadhaarData.raw && (
              <details className="ekyc-raw">
                <summary>View Aadhaar provider response</summary>
                <div className="ekyc-raw-label">Aadhaar e-KYC response</div>
                <pre>{JSON.stringify(aadhaarData.raw, null, 2)}</pre>
              </details>
            )}
          </div>

          <div className="detail-section pan-detail-section">
            <div className="section-heading-row">
              <h4>PAN Card Verification</h4>
              <Badge bg={panVerified ? 'success' : 'warning'}>{panVerified ? 'Verified' : 'Not verified'}</Badge>
            </div>
            <div className="detail-grid">
              <Info label="PAN Number" value={panNumber || 'N/A'} />
              <Info label="Name on PAN" value={panName || 'N/A'} />
              <Info label="First Name" value={panData.firstName || 'N/A'} />
              <Info label="Middle Name" value={panData.middleName || 'N/A'} />
              <Info label="Last Name" value={panData.lastName || 'N/A'} />
              <Info label="Provider Status" value={panResponse.status || panData.status || (panVerified ? 'SUCCESS' : 'N/A')} />
              <Info label="Order ID" value={panVerification.orderId || panResponse.orderId || 'N/A'} />
              <Info label="Transaction ID" value={panResponse.transId || panVerification.transId || 'N/A'} />
              <Info label="Point Used" value={panResponse.pointUsed || panVerification.pointUsed || 'N/A'} />
              <Info label="Verified At" value={formatDate(panVerification.verifiedAt)} />
              <Info label="Aadhaar Seeding" value={panData.aadhaarSeedingStatus || 'N/A'} />
              <Info label="PAN Document" value={docs.panUrl ? 'Uploaded' : 'Not uploaded'} />
            </div>
            {(Object.keys(panResponse || {}).length > 0 || Object.keys(panData || {}).length > 0) && (
              <details className="ekyc-raw">
                <summary>View full PAN provider response</summary>
                <div className="ekyc-raw-label">PAN verification response</div>
                <pre>{JSON.stringify(panResponse && Object.keys(panResponse).length ? panResponse : panData, null, 2)}</pre>
              </details>
            )}
          </div>

          <div className="detail-section credit-report-section">
            <div className="section-heading-row">
              <h4>Bank Statement Analysis</h4>
              <Badge bg={signcare?.bankStatement?.status === 'VERIFIED' ? 'success' : 'secondary'}>
                {signcare?.bankStatement?.status || 'Not analysed'}
              </Badge>
            </div>
            <div className="detail-grid">
              <Info label="Bank" value={statementAccount.bank || 'N/A'} />
              <Info label="Account" value={statementAccount.accountNo ? `****${String(statementAccount.accountNo).slice(-4)}` : 'N/A'} />
              <Info label="Account Type" value={statementAccount.accountType || statementAccount.accountSubType || 'N/A'} />
              <Info label="IFSC" value={statementAccount.ifsc || 'N/A'} />
              <Info label="Branch" value={statementAccount.branch || 'N/A'} />
              <Info label="Current Balance" value={statementAccount.currentBalance || 'N/A'} />
              <Info label="Statement Period" value={[statementSummary.startDate, statementSummary.endDate].filter(Boolean).join(' to ') || 'N/A'} />
              <Info label="Transactions Analysed" value={statementTransactions.length || 'N/A'} />
              <Info label="Analysis Order" value={signcare?.bankStatement?.providerReference || 'N/A'} />
              <Info label="Analysed At" value={formatDate(signcare?.bankStatement?.verifiedAt)} />
            </div>
            {bsaReport && (
              <details className="ekyc-raw">
                <summary>View complete bank statement analysis</summary>
                <div className="ekyc-raw-label">SignCare BSA response</div>
                <pre>{JSON.stringify(bsaReport, null, 2)}</pre>
              </details>
            )}
          </div>

          <div className="detail-section credit-report-section">
            <div className="section-heading-row">
              <h4>Experian Credit Report</h4>
              <Badge bg={creditReport?.status ? 'info' : 'secondary'}>{creditReport?.status || 'Not fetched'}</Badge>
            </div>
            <div className="detail-grid">
              <Info label="Provider" value={creditReport?.provider || 'N/A'} />
              <Info label="Environment" value={creditReport?.environment || 'N/A'} />
              <Info label="Bureau" value={creditReport?.bureau || 'N/A'} />
              <Info label="Score" value={creditReport?.score ?? 'N/A'} />
              <Info label="Reference ID" value={creditReport?.referenceId || 'N/A'} />
              <Info label="Report Number" value={creditReport?.reportNumber || 'N/A'} />
              <Info label="PAN" value={creditReport?.panMasked || maskPan(panNumber) || 'N/A'} />
              <Info label="Report Name" value={creditReport?.name || panName || 'N/A'} />
              <Info label="Purpose" value={creditReport?.purpose || loan.application?.purpose || 'N/A'} />
              <Info label="Exact Match" value={creditReport?.exactMatch || 'N/A'} />
              <Info label="Credit Accounts" value={creditReport?.accountCount ?? 'N/A'} />
              <Info label="Active Accounts" value={creditReport?.activeAccounts ?? 'N/A'} />
              <Info label="Outstanding Balance" value={creditReport?.outstandingBalance === undefined ? 'N/A' : formatCurrency(creditReport.outstandingBalance)} />
              <Info label="Past Due Amount" value={creditReport?.overdueAmount === undefined ? 'N/A' : formatCurrency(creditReport.overdueAmount)} />
              <Info label="Enquiries (30 days)" value={creditReport?.inquiries30Days ?? 'N/A'} />
              <Info label="Fetched At" value={formatDate(creditReport?.createdAt)} />
            </div>
            {experianAccounts.length > 0 && (
              <div className="table-responsive mt-3">
                <Table hover size="sm" className="align-middle mb-0">
                  <thead><tr><th>Lender</th><th>Account</th><th>Status</th><th>Balance</th><th>Past due</th></tr></thead>
                  <tbody>
                    {experianAccounts.map((account, index) => {
                      const number = String(account.account_Number || '')
                      return (
                        <tr key={`${number}-${index}`}>
                          <td>{account.subscriber_Name || 'N/A'}</td>
                          <td>{account.accountTypeDescription || account.account_Type || 'N/A'}{number ? ` | ****${number.slice(-4)}` : ''}</td>
                          <td>{account.accountStatusDescription || account.account_Status || 'N/A'}</td>
                          <td>{formatCurrency(account.current_Balance || 0)}</td>
                          <td>{formatCurrency(account.amount_Past_Due || 0)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </Table>
              </div>
            )}
            {creditReport?.response && (
              <details className="ekyc-raw">
                <summary>View full credit report response</summary>
                <div className="ekyc-raw-label">Credit report response</div>
                <pre>{JSON.stringify(creditReport.response, null, 2)}</pre>
              </details>
            )}
          </div>

          <div className="detail-section">
            <div className="section-heading-row">
              <h4>SignCare Verification Flow</h4>
              <Badge bg={signcare ? 'info' : 'secondary'}>{signcare ? 'Live record' : 'Not started'}</Badge>
            </div>
            <div className="detail-grid">
              {signcareStages.map(([label, stage]) => {
                const stageStatus = normalize(stage?.status || 'NOT_STARTED')
                const tone = stageStatus === 'VERIFIED' ? 'success' : stageStatus === 'FAILED' ? 'danger' : stageStatus === 'PENDING' ? 'warning' : 'secondary'
                return (
                  <div className="info-box" key={label}>
                    <span>{label}</span>
                    <div className="d-flex align-items-center gap-2 mb-1"><Badge bg={tone}>{stageStatus.replaceAll('_', ' ')}</Badge></div>
                    <strong>{stage?.message || 'Awaiting customer action'}</strong>
                    {stage?.requestId && <small>Request: {stage.requestId}</small>}
                    {stage?.providerReference && <small>Provider ref: {stage.providerReference}</small>}
                    {stage?.verifiedAt && <small>Verified: {formatDate(stage.verifiedAt)}</small>}
                  </div>
                )
              })}
            </div>
            {signcare && (
              <details className="ekyc-raw">
                <summary>View complete SignCare evidence</summary>
                <div className="ekyc-raw-label">Provider responses and audit metadata</div>
                <pre>{JSON.stringify(signcare, null, 2)}</pre>
              </details>
            )}
          </div>

          <div className="detail-section">
            <h4>Employment & Bank</h4>
            <div className="detail-grid">
              <Info label="Employment" value={employment.employmentType || 'N/A'} />
              <Info label="Monthly income" value={formatCurrency(employment.monthlyIncome || 0)} />
              <Info label="Employer / Business" value={employment.employerOrBusiness || 'N/A'} />
              <Info label="Experience" value={`${employment.experienceYears || 0} years`} />
              <Info label="Bank" value={bank.bankName || 'N/A'} />
              <Info label="Account holder" value={bank.accountHolderName || 'N/A'} />
              <Info label="Account number" value={maskAccount(bank.accountNumber)} />
              <Info label="IFSC" value={bank.ifscCode || 'N/A'} />
            </div>
          </div>

          <div className="detail-section">
            <h4>Documents</h4>
            <div className="doc-grid">
              <DocLink label="Aadhaar Front" url={docs.aadhaarFrontUrl} />
              <DocLink label="Aadhaar Back" url={docs.aadhaarBackUrl} />
              <DocLink label="PAN" url={docs.panUrl} />
              <DocLink label="Selfie" url={docs.selfieUrl} />
              <DocLink label={`Income Proof${docs.incomeProofType ? ` (${incomeProofLabel(docs.incomeProofType)})` : ''}`} url={docs.incomeProofUrl} />
            </div>
          </div>

          <div className="detail-section">
            <h4>Repayment Schedule</h4>
            <div className="schedule-summary">
              <Info label="Next EMI" value={nextDue ? formatCurrency(nextDue.total) : 'N/A'} />
              <Info label="Next due date" value={nextDue ? formatDate(nextDue.dueDate) : 'N/A'} />
              <Info label="Paid installments" value={`${loan.schedule?.filter((item) => item.paid).length || 0} / ${loan.schedule?.length || 0}`} />
              <Info label="Auto debit" value={loan.autoDebit?.enabled ? 'Enabled' : 'Disabled'} />
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
                    <tr><td colSpan="6" className="loans-empty">No repayment schedule generated yet.</td></tr>
                  )}
                </tbody>
              </Table>
            </div>
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="light" onClick={onHide}>Close</Button>
        {normalize(loan.status) === 'PENDING' && (
          <>
            <Button variant="outline-danger" onClick={() => onReject(loan)}>Reject</Button>
            <Button variant="success" onClick={() => onApprove(loan)}>Approve</Button>
          </>
        )}
        {normalize(loan.status) === 'APPROVED' && (
          <Button onClick={() => onDisburse(loan)} disabled={processing}>Disburse</Button>
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

const DocLink = ({ label, url }) => (
  url ? (
    <a className="doc-link" href={url} target="_blank" rel="noreferrer">
      <FileText size={17} />
      {label}
    </a>
  ) : (
    <div className="doc-link disabled">
      <FileText size={17} />
      {label} not uploaded
    </div>
  )
)

const daysFromNow = (date) => {
  if (!date) return Infinity
  return Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

const dueTime = (loan) => {
  const due = getNextDue(loan)?.dueDate
  return due ? new Date(due).getTime() : Infinity
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
  }

`

export default Loans
