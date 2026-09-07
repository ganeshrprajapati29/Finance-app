import React, { useEffect, useMemo, useState } from 'react'
import { Badge, Button, Col, Form, Modal, Row, Table } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  Banknote,
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  ChevronRight,
  Clock3,
  CreditCard,
  IndianRupee,
  RefreshCcw,
  Search,
  ShieldCheck,
  Split,
  WalletCards,
} from 'lucide-react'
import api from '../api/axios'

const formatCurrency = (amount) => `Rs. ${Number(amount || 0).toLocaleString('en-IN')}`

const formatDate = (date) => {
  if (!date) return 'N/A'
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const daysFromNow = (date) => {
  if (!date) return Infinity
  return Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

const getUserName = (loan) => loan.userId?.name || loan.application?.personal?.name || 'Unknown user'

const getUserMobile = (loan) => loan.userId?.mobile || loan.application?.personal?.mobile || 'N/A'

const getPendingEmis = (loan) => (loan.schedule || []).filter((item) => !item.paid)

const getNextEmi = (loan) => getPendingEmis(loan).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))[0]

const EmiControl = () => {
  const [loans, setLoans] = useState([])
  const [penaltyStats, setPenaltyStats] = useState(null)
  const [extensionStats, setExtensionStats] = useState(null)
  const [autoDebitStats, setAutoDebitStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [riskFilter, setRiskFilter] = useState('ALL')
  const [selectedLoan, setSelectedLoan] = useState(null)

  const fetchEmiDashboard = async () => {
    try {
      setError('')
      const [loansRes, penaltiesRes, extensionsRes, autoDebitRes] = await Promise.allSettled([
        api.get('/admin/loans?status=DISBURSED&limit=1000&sortBy=createdAt&sortOrder=desc'),
        api.get('/admin/emi-control/penalties'),
        api.get('/admin/emi-control/extensions'),
        api.get('/admin/emi-control/auto-debit'),
      ])

      if (loansRes.status === 'fulfilled') {
        const data = loansRes.value.data?.data || loansRes.value.data || {}
        setLoans(Array.isArray(data) ? data : data.items || [])
      } else {
        throw loansRes.reason
      }

      if (penaltiesRes.status === 'fulfilled') setPenaltyStats(penaltiesRes.value.data?.data?.statistics || null)
      if (extensionsRes.status === 'fulfilled') setExtensionStats(extensionsRes.value.data?.data?.statistics || null)
      if (autoDebitRes.status === 'fulfilled') setAutoDebitStats(autoDebitRes.value.data?.data?.statistics || null)
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'EMI dashboard could not be loaded')
      setLoans([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchEmiDashboard()
  }, [])

  const emiRows = useMemo(() => {
    const term = searchTerm.toLowerCase().trim()
    return loans
      .map((loan) => {
        const nextEmi = getNextEmi(loan)
        const pendingEmis = getPendingEmis(loan)
        const overdueEmis = pendingEmis.filter((emi) => new Date(emi.dueDate) < new Date())
        const pendingAmount = pendingEmis.reduce((sum, emi) => sum + Number(emi.total || 0), 0)
        return {
          loan,
          nextEmi,
          pendingEmis,
          overdueEmis,
          pendingAmount,
          dueIn: nextEmi ? daysFromNow(nextEmi.dueDate) : Infinity,
        }
      })
      .filter((row) => {
        const matchesSearch =
          !term ||
          getUserName(row.loan).toLowerCase().includes(term) ||
          getUserMobile(row.loan).toLowerCase().includes(term) ||
          String(row.loan.loanAccountNumber || '').toLowerCase().includes(term) ||
          String(row.loan._id || '').toLowerCase().includes(term)
        const matchesRisk =
          riskFilter === 'ALL' ||
          (riskFilter === 'OVERDUE' && row.overdueEmis.length > 0) ||
          (riskFilter === 'DUE_TODAY' && row.dueIn === 0) ||
          (riskFilter === 'DUE_7' && row.dueIn >= 0 && row.dueIn <= 7) ||
          (riskFilter === 'AUTO_DEBIT_OFF' && !row.loan.autoDebit?.enabled)
        return matchesSearch && matchesRisk
      })
      .sort((a, b) => a.dueIn - b.dueIn)
  }, [loans, searchTerm, riskFilter])

  const stats = useMemo(() => {
    const allEmis = loans.flatMap((loan) => loan.schedule || [])
    const pendingEmis = allEmis.filter((emi) => !emi.paid)
    const overdueEmis = pendingEmis.filter((emi) => new Date(emi.dueDate) < new Date())
    const dueSeven = pendingEmis.filter((emi) => {
      const days = daysFromNow(emi.dueDate)
      return days >= 0 && days <= 7
    })
    const collectedAmount = allEmis.filter((emi) => emi.paid).reduce((sum, emi) => sum + Number(emi.total || 0), 0)
    const pendingAmount = pendingEmis.reduce((sum, emi) => sum + Number(emi.total || 0), 0)
    const autoDebitEnabled = autoDebitStats?.autoDebitEnabled ?? loans.filter((loan) => loan.autoDebit?.enabled).length

    return {
      activeLoans: loans.length,
      pendingEmis: pendingEmis.length,
      overdueEmis: overdueEmis.length,
      dueSeven: dueSeven.length,
      collectedAmount,
      pendingAmount,
      autoDebitEnabled,
      autoDebitCoverage: autoDebitStats?.autoDebitCoverage || (loans.length ? Math.round((autoDebitEnabled / loans.length) * 100) : 0),
      totalPenalties: penaltyStats?.totalPenalties || 0,
      totalPenaltyAmount: penaltyStats?.totalPenaltyAmount || 0,
      totalExtensions: extensionStats?.totalExtensions || 0,
    }
  }, [loans, penaltyStats, extensionStats, autoDebitStats])

  const modules = [
    {
      title: 'Auto Debit Status',
      description: 'Enable, disable, and audit automatic EMI debit coverage.',
      icon: CreditCard,
      to: '/emi-control/auto-debit',
      color: '#0891B2',
      metric: `${stats.autoDebitCoverage}% coverage`,
    },
    {
      title: 'Manual Payment Update',
      description: 'Record manual repayments and mark full EMI payments.',
      icon: RefreshCcw,
      to: '/emi-control/manual-payment',
      color: '#2563EB',
      metric: `${stats.pendingEmis} pending`,
    },
    {
      title: 'Part Payment Support',
      description: 'Accept partial EMI payments and track installment progress.',
      icon: Split,
      to: '/emi-control/part-payment',
      color: '#D97706',
      metric: formatCurrency(stats.pendingAmount),
    },
    {
      title: 'Penalty Charges',
      description: 'Create, waive, and track overdue EMI penalties.',
      icon: AlertTriangle,
      to: '/emi-control/penalty-management',
      color: '#DC2626',
      metric: `${stats.totalPenalties} penalties`,
    },
    {
      title: 'Extend Due Date',
      description: 'Extend installment dates with admin approval history.',
      icon: CalendarPlus,
      to: '/emi-control/extend-due-date',
      color: '#7C3AED',
      metric: `${stats.totalExtensions} extensions`,
    },
  ]

  const refresh = () => {
    setRefreshing(true)
    fetchEmiDashboard()
  }

  if (loading) {
    return (
      <div className="emi-loading">
        <div className="spinner-border text-primary" role="status" />
        <p>Loading EMI control...</p>
      </div>
    )
  }

  return (
    <div className="emi-page">
      <section className="emi-hero">
        <div>
          <span>Repayment Operations</span>
          <h1>EMI Control Center</h1>
          <p>Monitor repayment schedules, overdue installments, auto-debit coverage, penalties, and date extensions in one dynamic workspace.</p>
        </div>
        <div className="emi-hero-actions">
          <Button className="emi-primary-btn" as={Link} to="/emi-control/manual-payment">
            <Banknote size={16} />
            Record Payment
          </Button>
          <Button variant="light" onClick={refresh} disabled={refreshing}>
            <RefreshCcw size={16} className={refreshing ? 'spin' : ''} />
            {refreshing ? 'Refreshing' : 'Refresh'}
          </Button>
        </div>
      </section>

      {error && (
        <div className="emi-warning">
          <AlertTriangle size={18} />
          <span>{error}</span>
          <button onClick={refresh}>Retry</button>
        </div>
      )}

      <Row className="g-3">
        <Col xl={3} md={6}><StatCard title="Active loans" value={stats.activeLoans} icon={WalletCards} color="#2563EB" /></Col>
        <Col xl={3} md={6}><StatCard title="Pending EMIs" value={stats.pendingEmis} icon={Clock3} color="#D97706" /></Col>
        <Col xl={3} md={6}><StatCard title="Overdue EMIs" value={stats.overdueEmis} icon={AlertTriangle} color="#DC2626" /></Col>
        <Col xl={3} md={6}><StatCard title="Auto debit enabled" value={stats.autoDebitEnabled} icon={ShieldCheck} color="#059669" /></Col>
      </Row>

      <Row className="g-3 mt-1">
        <Col lg={4}><AmountCard label="Collected amount" value={formatCurrency(stats.collectedAmount)} icon={IndianRupee} /></Col>
        <Col lg={4}><AmountCard label="Pending amount" value={formatCurrency(stats.pendingAmount)} icon={Banknote} /></Col>
        <Col lg={4}><AmountCard label="Penalty amount" value={formatCurrency(stats.totalPenaltyAmount)} icon={AlertTriangle} danger /></Col>
      </Row>

      <Row className="g-3 mt-1">
        {modules.map((item) => {
          const Icon = item.icon
          return (
            <Col xl={4} md={6} key={item.title}>
              <Link to={item.to} className="emi-module-card">
                <div style={{ color: item.color, background: `${item.color}18` }}>
                  <Icon size={24} />
                </div>
                <section>
                  <h2>{item.title}</h2>
                  <p>{item.description}</p>
                  <strong>{item.metric}</strong>
                </section>
                <ChevronRight size={18} />
              </Link>
            </Col>
          )
        })}
      </Row>

      <section className="emi-panel mt-3">
        <div className="emi-panel-head">
          <div>
            <h2>EMI Risk Queue</h2>
            <p>{emiRows.length.toLocaleString('en-IN')} loans matching current filters</p>
          </div>
          <Badge bg={stats.overdueEmis > 0 ? 'danger' : 'success'}>
            {stats.overdueEmis > 0 ? `${stats.overdueEmis} overdue` : 'No overdue EMI'}
          </Badge>
        </div>

        <div className="emi-toolbar">
          <div className="emi-search">
            <Search size={18} />
            <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search borrower, mobile, loan account, loan ID" />
          </div>
          <Form.Select value={riskFilter} onChange={(event) => setRiskFilter(event.target.value)}>
            <option value="ALL">All risk</option>
            <option value="OVERDUE">Overdue</option>
            <option value="DUE_TODAY">Due today</option>
            <option value="DUE_7">Due in 7 days</option>
            <option value="AUTO_DEBIT_OFF">Auto debit off</option>
          </Form.Select>
        </div>

        <div className="emi-table-wrap">
          <Table responsive hover className="emi-table">
            <thead>
              <tr>
                <th>Loan</th>
                <th>Borrower</th>
                <th>Next EMI</th>
                <th>Due Date</th>
                <th>Pending</th>
                <th>Auto Debit</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {emiRows.length ? emiRows.slice(0, 15).map((row) => {
                const overdue = row.overdueEmis.length > 0
                return (
                  <tr key={row.loan._id}>
                    <td>
                      <strong>{row.loan.loanAccountNumber || `LN-${String(row.loan._id).slice(-8)}`}</strong>
                      <small>{String(row.loan._id).slice(-12)}</small>
                    </td>
                    <td>
                      <strong>{getUserName(row.loan)}</strong>
                      <small>{getUserMobile(row.loan)}</small>
                    </td>
                    <td>{row.nextEmi ? formatCurrency(row.nextEmi.total) : 'N/A'}</td>
                    <td>
                      <div className={overdue ? 'emi-due overdue' : 'emi-due'}>
                        <CalendarClock size={15} />
                        <span>{row.nextEmi ? formatDate(row.nextEmi.dueDate) : 'N/A'}</span>
                      </div>
                    </td>
                    <td>
                      <strong>{row.pendingEmis.length} EMI</strong>
                      <small>{formatCurrency(row.pendingAmount)}</small>
                    </td>
                    <td><Badge bg={row.loan.autoDebit?.enabled ? 'success' : 'secondary'}>{row.loan.autoDebit?.enabled ? 'Enabled' : 'Disabled'}</Badge></td>
                    <td><Badge bg={overdue ? 'danger' : row.dueIn <= 7 ? 'warning' : 'info'}>{overdue ? 'Overdue' : row.dueIn <= 7 ? 'Due soon' : 'Upcoming'}</Badge></td>
                    <td>
                      <Button variant="light" size="sm" onClick={() => setSelectedLoan(row.loan)}>
                        View
                      </Button>
                    </td>
                  </tr>
                )
              }) : (
                <tr>
                  <td colSpan="8" className="emi-empty">No EMI records found.</td>
                </tr>
              )}
            </tbody>
          </Table>
        </div>
      </section>

      <Modal show={Boolean(selectedLoan)} onHide={() => setSelectedLoan(null)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>EMI Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedLoan && (
            <div className="emi-detail">
              <div className="emi-detail-hero">
                <div>
                  <span>Loan Account</span>
                  <h3>{selectedLoan.loanAccountNumber || `LN-${String(selectedLoan._id).slice(-8)}`}</h3>
                  <p>{getUserName(selectedLoan)} | {getUserMobile(selectedLoan)}</p>
                </div>
                <Badge bg={selectedLoan.autoDebit?.enabled ? 'success' : 'secondary'}>
                  Auto debit {selectedLoan.autoDebit?.enabled ? 'on' : 'off'}
                </Badge>
              </div>
              <div className="emi-detail-grid">
                <Info label="Approved amount" value={formatCurrency(selectedLoan.decision?.amountApproved || 0)} />
                <Info label="APR / Tenure" value={`${selectedLoan.decision?.rateAPR || 0}% / ${selectedLoan.decision?.tenureMonths || 0} months`} />
                <Info label="Pending EMIs" value={getPendingEmis(selectedLoan).length} />
                <Info label="Pending amount" value={formatCurrency(getPendingEmis(selectedLoan).reduce((sum, emi) => sum + Number(emi.total || 0), 0))} />
              </div>
              <div className="emi-mini-table">
                <Table responsive hover className="mb-0">
                  <thead>
                    <tr>
                      <th>No</th>
                      <th>Due date</th>
                      <th>Total</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedLoan.schedule || []).map((emi) => (
                      <tr key={emi.installmentNo}>
                        <td>{emi.installmentNo}</td>
                        <td>{formatDate(emi.dueDate)}</td>
                        <td>{formatCurrency(emi.total)}</td>
                        <td><Badge bg={emi.paid ? 'success' : new Date(emi.dueDate) < new Date() ? 'danger' : 'warning'}>{emi.paid ? 'Paid' : new Date(emi.dueDate) < new Date() ? 'Overdue' : 'Pending'}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={() => setSelectedLoan(null)}>Close</Button>
          <Button as={Link} to="/emi-control/manual-payment" onClick={() => setSelectedLoan(null)}>Record payment</Button>
        </Modal.Footer>
      </Modal>

      <style>{emiStyles}</style>
    </div>
  )
}

const StatCard = ({ title, value, icon: Icon, color }) => (
  <div className="emi-stat-card">
    <div style={{ color, background: `${color}18` }}><Icon size={24} /></div>
    <span>{title}</span>
    <strong>{Number(value || 0).toLocaleString('en-IN')}</strong>
  </div>
)

const AmountCard = ({ label, value, icon: Icon, danger }) => (
  <div className={danger ? 'emi-amount-card danger' : 'emi-amount-card'}>
    <div><Icon size={20} /></div>
    <span>{label}</span>
    <strong>{value}</strong>
  </div>
)

const Info = ({ label, value }) => (
  <div className="emi-info-box">
    <span>{label}</span>
    <strong>{value}</strong>
  </div>
)

const emiStyles = `
  .emi-loading {
    min-height: 50vh;
    display: grid;
    place-items: center;
    gap: 12px;
    color: #64748B;
  }

  .emi-page {
    color: #0F172A;
  }

  .emi-hero {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 20px;
    padding: 26px;
    margin-bottom: 18px;
    color: white;
    border-radius: 8px;
    background: linear-gradient(135deg, #0F172A, #1E293B);
    box-shadow: 0 20px 45px rgba(15, 23, 42, 0.16);
  }

  .emi-hero span,
  .emi-detail-hero span {
    color: #7DD3FC;
    font-size: 12px;
    font-weight: 900;
    text-transform: uppercase;
  }

  .emi-hero h1 {
    margin: 6px 0;
    font-size: 28px;
  }

  .emi-hero p {
    margin: 0;
    color: #CBD5E1;
    max-width: 760px;
  }

  .emi-hero-actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .emi-hero-actions .btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    border-radius: 8px;
    font-weight: 800;
  }

  .emi-primary-btn {
    background: linear-gradient(135deg, #2563EB, #059669) !important;
    border: 0 !important;
  }

  .emi-warning {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border-radius: 8px;
    background: #FFFBEB;
    border: 1px solid #FDE68A;
    color: #92400E;
    font-weight: 700;
    margin-bottom: 16px;
  }

  .emi-warning button {
    border: 0;
    background: transparent;
    color: #2563EB;
    font-weight: 900;
  }

  .emi-stat-card,
  .emi-amount-card,
  .emi-module-card,
  .emi-panel {
    background: #FFFFFF;
    border: 1px solid #E2E8F0;
    border-radius: 8px;
    box-shadow: 0 12px 28px rgba(15, 23, 42, 0.07);
  }

  .emi-stat-card {
    min-height: 142px;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .emi-stat-card > div {
    width: 48px;
    height: 48px;
    border-radius: 8px;
    display: grid;
    place-items: center;
  }

  .emi-stat-card span,
  .emi-amount-card span {
    color: #64748B;
    font-size: 13px;
    font-weight: 900;
    text-transform: uppercase;
  }

  .emi-stat-card strong {
    font-size: 27px;
    line-height: 1.1;
  }

  .emi-amount-card {
    padding: 18px;
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 4px 12px;
    align-items: center;
  }

  .emi-amount-card > div {
    grid-row: span 2;
    width: 44px;
    height: 44px;
    border-radius: 8px;
    display: grid;
    place-items: center;
    color: #2563EB;
    background: #DBEAFE;
  }

  .emi-amount-card.danger > div {
    color: #DC2626;
    background: #FEE2E2;
  }

  .emi-amount-card strong {
    font-size: 22px;
  }

  .emi-module-card {
    min-height: 160px;
    padding: 18px;
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 14px;
    align-items: start;
    color: #0F172A;
    text-decoration: none;
    height: 100%;
  }

  .emi-module-card:hover {
    color: #0F172A;
    transform: translateY(-2px);
  }

  .emi-module-card > div {
    width: 48px;
    height: 48px;
    border-radius: 8px;
    display: grid;
    place-items: center;
  }

  .emi-module-card h2 {
    margin: 0 0 6px;
    font-size: 16px;
    font-weight: 900;
  }

  .emi-module-card p {
    margin: 0 0 10px;
    color: #64748B;
    font-size: 13px;
    font-weight: 600;
  }

  .emi-module-card strong {
    color: #2563EB;
    font-size: 13px;
  }

  .emi-panel {
    padding: 18px;
  }

  .emi-panel-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
  }

  .emi-panel-head h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 900;
  }

  .emi-panel-head p {
    margin: 3px 0 0;
    color: #64748B;
    font-weight: 700;
  }

  .emi-toolbar {
    display: grid;
    grid-template-columns: minmax(260px, 1fr) 190px;
    gap: 10px;
    margin-bottom: 14px;
  }

  .emi-search {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 12px;
    border-radius: 8px;
    border: 1px solid #CBD5E1;
    background: white;
  }

  .emi-search input {
    width: 100%;
    border: 0;
    outline: 0;
    min-height: 38px;
    font-weight: 700;
  }

  .emi-table-wrap,
  .emi-mini-table {
    border: 1px solid #E2E8F0;
    border-radius: 8px;
    overflow: hidden;
  }

  .emi-table {
    margin: 0;
  }

  .emi-table th,
  .emi-mini-table th {
    background: #F8FAFC;
    color: #475569;
    font-size: 12px;
    text-transform: uppercase;
    padding: 13px 14px;
    border-bottom: 1px solid #E2E8F0;
    white-space: nowrap;
  }

  .emi-table td,
  .emi-mini-table td {
    vertical-align: middle;
    padding: 14px;
    color: #334155;
  }

  .emi-table td small {
    display: block;
    color: #64748B;
    font-weight: 700;
    margin-top: 2px;
  }

  .emi-due {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    color: #2563EB;
    font-weight: 800;
  }

  .emi-due.overdue {
    color: #DC2626;
  }

  .emi-empty {
    text-align: center;
    color: #64748B !important;
    padding: 32px !important;
    font-weight: 700;
  }

  .emi-detail {
    display: grid;
    gap: 16px;
  }

  .emi-detail-hero {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 18px;
    border-radius: 8px;
    background: linear-gradient(135deg, #0F172A, #1E293B);
    color: white;
  }

  .emi-detail-hero h3 {
    margin: 4px 0;
  }

  .emi-detail-hero p {
    margin: 0;
    color: #CBD5E1;
  }

  .emi-detail-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
  }

  .emi-info-box {
    padding: 13px;
    border-radius: 8px;
    background: #F8FAFC;
    border: 1px solid #E2E8F0;
    display: grid;
    gap: 5px;
  }

  .emi-info-box span {
    color: #64748B;
    font-size: 12px;
    font-weight: 900;
    text-transform: uppercase;
  }

  .emi-info-box strong {
    color: #0F172A;
    word-break: break-word;
  }

  .spin {
    animation: emiSpin 0.9s linear infinite;
  }

  @keyframes emiSpin {
    to { transform: rotate(360deg); }
  }

  @media (max-width: 992px) {
    .emi-hero,
    .emi-panel-head,
    .emi-detail-hero {
      align-items: flex-start;
      flex-direction: column;
    }

    .emi-toolbar,
    .emi-detail-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 576px) {
    .emi-hero {
      padding: 20px;
    }

    .emi-hero h1 {
      font-size: 23px;
    }
  }
`

export default EmiControl
