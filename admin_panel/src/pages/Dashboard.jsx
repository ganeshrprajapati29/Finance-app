import React, { useEffect, useMemo, useState } from 'react'
import { Badge, Button, Col, Form, Modal, Row, Table } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import {
  Activity,
  ArrowRight,
  Banknote,
  Bell,
  CheckCircle2,
  Clock3,
  CreditCard,
  Download,
  Eye,
  FileText,
  IndianRupee,
  RefreshCcw,
  Search,
  Send,
  ShieldAlert,
  TrendingUp,
  Users,
  WalletCards,
  XCircle,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import api from '../api/axios'
import { AlertStrip, PageHeader } from '../components/AdminUI.jsx'

/**
 * Chart palette, drawn from the Khatu design tokens in index.css. Teal leads
 * (it is the money colour throughout the product), saffron carries revenue and
 * rewards, and the remaining hues are only used to separate series - the
 * purple that used to headline this page is gone.
 */
const COLORS = {
  teal: '#0F766E',
  mint: '#00A884',
  green: '#16A34A',
  amber: '#F59E0B',
  gold: '#B45309',
  red: '#DC2626',
  blue: '#2563EB',
  cyan: '#0891B2',
  slate: '#64748B',
  // Legacy key kept so any remaining reference resolves to a brand colour
  // rather than an undefined stroke.
  violet: '#0F766E',
}

const extractItems = (res) => {
  const data = res?.data?.data ?? res?.data ?? []
  if (Array.isArray(data)) return data
  if (Array.isArray(data.items)) return data.items
  if (Array.isArray(data.history)) return data.history
  return []
}

const normalize = (value) => String(value || '').trim().toUpperCase()

const formatNumber = (value) => Number(value || 0).toLocaleString('en-IN')

const formatCurrency = (value) => `Rs. ${Number(value || 0).toLocaleString('en-IN')}`

const formatDate = (date) => {
  if (!date) return 'N/A'
  return new Date(date).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const getUserName = (item) => item?.userId?.name || item?.user?.name || 'Unknown user'

const getUserPhone = (item) => item?.userId?.phone || item?.userId?.mobile || item?.user?.phone || ''

const getStatusTone = (status) => {
  const value = normalize(status)
  if (['CONFIRMED', 'SUCCESS', 'APPROVED', 'PAID', 'DISBURSED'].includes(value)) return 'success'
  if (['PENDING', 'PROCESSING'].includes(value)) return 'warning'
  if (['FAILED', 'REJECTED', 'OVERDUE', 'BLOCKED'].includes(value)) return 'danger'
  return 'secondary'
}

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeLoans: 0,
    totalPayments: 0,
    totalRevenue: 0,
    pendingLoans: 0,
    approvedLoans: 0,
    disbursedLoans: 0,
    rejectedLoans: 0,
    overdueLoans: 0,
    withdrawalsPending: 0,
    withdrawalsApproved: 0,
    withdrawalsRejected: 0,
  })
  const [payments, setPayments] = useState([])
  const [loans, setLoans] = useState([])
  const [users, setUsers] = useState([])
  const [marqueeMessages, setMarqueeMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedPayment, setSelectedPayment] = useState(null)

  const fetchDashboardData = async () => {
    try {
      setError('')
      const [statsRes, usersRes, loansRes, paymentsRes, marqueeRes, withdrawalsRes] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/admin/users?limit=1000'),
        api.get('/admin/loans?limit=1000'),
        api.get('/admin/payments?limit=1000'),
        api.get('/admin/marquee'),
        api.get('/admin/withdrawals?limit=1000'),
      ])

      const statsData = statsRes.data?.data || {}
      const usersData = extractItems(usersRes)
      const loansData = extractItems(loansRes)
      const paymentsData = extractItems(paymentsRes)
      const withdrawalsData = extractItems(withdrawalsRes)
      const messages = extractItems(marqueeRes)
      const now = new Date()

      const pendingLoans = loansData.filter((loan) => normalize(loan.status) === 'PENDING').length
      const approvedLoans = loansData.filter((loan) => normalize(loan.status) === 'APPROVED').length
      const disbursedLoans = loansData.filter((loan) => normalize(loan.status) === 'DISBURSED').length
      const rejectedLoans = loansData.filter((loan) => normalize(loan.status) === 'REJECTED').length
      const overdueLoans = loansData.filter((loan) => {
        if (normalize(loan.status) !== 'DISBURSED') return false
        const nextDue = loan.schedule?.find((item) => !item.paid)
        const dueDate = nextDue?.dueDate || loan.nextDueDate
        return dueDate && new Date(dueDate) < now
      }).length
      const successfulPayments = paymentsData.filter((payment) =>
        ['CONFIRMED', 'SUCCESS'].includes(normalize(payment.status))
      )
      const totalRevenue = successfulPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)

      setStats({
        totalUsers: usersData.length,
        activeLoans: disbursedLoans || statsData.disbursed || 0,
        totalPayments: paymentsData.length,
        totalRevenue,
        pendingLoans: pendingLoans || statsData.pending || 0,
        approvedLoans: approvedLoans || statsData.approved || 0,
        disbursedLoans: disbursedLoans || statsData.disbursed || 0,
        rejectedLoans,
        overdueLoans,
        withdrawalsPending: withdrawalsData.filter((item) => normalize(item.status) === 'PENDING').length,
        withdrawalsApproved: withdrawalsData.filter((item) => normalize(item.status) === 'APPROVED').length,
        withdrawalsRejected: withdrawalsData.filter((item) => normalize(item.status) === 'REJECTED').length,
      })
      setUsers(usersData)
      setLoans(loansData)
      setPayments(paymentsData)
      setMarqueeMessages(Array.isArray(messages) ? messages : [])
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Dashboard data could not be loaded')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const filteredPayments = useMemo(() => {
    const term = searchTerm.toLowerCase()
    return payments.filter((payment) => {
      const matchesStatus = statusFilter === 'ALL' || normalize(payment.status) === statusFilter
      const matchesType = typeFilter === 'ALL' || normalize(payment.type) === typeFilter
      const matchesSearch =
        !term ||
        getUserName(payment).toLowerCase().includes(term) ||
        getUserPhone(payment).includes(searchTerm) ||
        String(payment._id || '').toLowerCase().includes(term) ||
        String(payment.reference || '').toLowerCase().includes(term)

      return matchesStatus && matchesType && matchesSearch
    })
  }, [payments, searchTerm, statusFilter, typeFilter])

  const recentPayments = filteredPayments.slice(0, 8)

  const paymentTrend = useMemo(() => {
    const days = [...Array(7)].map((_, index) => {
      const date = new Date()
      date.setDate(date.getDate() - (6 - index))
      return {
        key: date.toISOString().slice(0, 10),
        label: date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
        amount: 0,
        count: 0,
      }
    })

    payments.forEach((payment) => {
      const key = payment.createdAt ? new Date(payment.createdAt).toISOString().slice(0, 10) : ''
      const day = days.find((item) => item.key === key)
      if (day && ['CONFIRMED', 'SUCCESS'].includes(normalize(payment.status))) {
        day.amount += Number(payment.amount || 0)
        day.count += 1
      }
    })

    return days
  }, [payments])

  const loanBreakdown = [
    { name: 'Pending', value: stats.pendingLoans, color: COLORS.amber },
    { name: 'Approved', value: stats.approvedLoans, color: COLORS.cyan },
    { name: 'Disbursed', value: stats.disbursedLoans, color: COLORS.green },
    { name: 'Rejected', value: stats.rejectedLoans, color: COLORS.red },
  ]

  const riskQueue = [
    { label: 'Overdue loans', value: stats.overdueLoans, to: '/overdue-users', tone: 'danger', icon: ShieldAlert },
    { label: 'Pending loans', value: stats.pendingLoans, to: '/loans', tone: 'warning', icon: Clock3 },
    { label: 'Pending withdrawals', value: stats.withdrawalsPending, to: '/withdrawals', tone: 'warning', icon: WalletCards },
    { label: 'Failed payments', value: payments.filter((item) => ['FAILED'].includes(normalize(item.status))).length, to: '/payments', tone: 'danger', icon: XCircle },
  ]

  const quickActions = [
    { label: 'Send push', to: '/push', icon: Send },
    { label: 'Track loan', to: '/track-loan', icon: Search },
    { label: 'Create agent', to: '/create-agent', icon: Users },
    { label: 'Export reports', to: '/reports', icon: Download },
  ]

  const paymentMix = ['REPAYMENT', 'BILL', 'DISBURSEMENT', 'FEE', 'PENALTY'].map((type) => ({
    name: type.replace('_', ' '),
    count: payments.filter((payment) => normalize(payment.type) === type).length,
  }))

  const refresh = () => {
    setRefreshing(true)
    fetchDashboardData()
  }

  if (loading) {
    return (
      <div className="dashboard-shell">
        <div className="dashboard-loading">
          <div className="spinner-border text-primary" role="status" />
          <p>Loading admin dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-shell">
      {/* Compact operations header. An admin console opens dozens of times a
          day, so the top of the page is a toolbar, not a marketing banner. */}
      <PageHeader
        icon={Activity}
        title="Operations Overview"
        subtitle="Users, loans, payments, withdrawals and risk across the platform."
        actions={
          <>
            <Button as={Link} to="/loans" variant="outline-primary" size="sm">
              Review loans <ArrowRight size={14} className="ms-1" />
            </Button>
            <Button size="sm" onClick={refresh} disabled={refreshing}>
              <RefreshCcw size={14} className={refreshing ? 'spin me-1' : 'me-1'} />
              {refreshing ? 'Refreshing' : 'Refresh'}
            </Button>
          </>
        }
      />

      {marqueeMessages.length > 0 && (
        <div className="dashboard-alert-strip">
          <Bell size={18} />
          <div>
            {marqueeMessages.slice(0, 5).map((message, index) => (
              <span key={`${message}-${index}`}>{message}</span>
            ))}
          </div>
        </div>
      )}

      {error && (
        <AlertStrip tone="danger" onRetry={refresh}>
          {error}
        </AlertStrip>
      )}

      <Row className="g-3">
        <Col xl={3} md={6}>
          <MetricCard title="Total users" value={formatNumber(stats.totalUsers)} icon={Users} color={COLORS.teal} to="/users" />
        </Col>
        <Col xl={3} md={6}>
          <MetricCard title="Active loans" value={formatNumber(stats.activeLoans)} icon={FileText} color={COLORS.green} to="/loans" note={`${stats.overdueLoans} overdue`} />
        </Col>
        <Col xl={3} md={6}>
          <MetricCard title="Payments" value={formatNumber(stats.totalPayments)} icon={CreditCard} color={COLORS.blue} to="/payments" />
        </Col>
        <Col xl={3} md={6}>
          <MetricCard title="Revenue collected" value={formatCurrency(stats.totalRevenue)} icon={IndianRupee} color={COLORS.gold} to="/payments" />
        </Col>
      </Row>

      <Row className="g-3 mt-1">
        <Col xl={8}>
          <Panel title="Revenue Trend" action={<Link to="/payments">View payments</Link>}>
            <div className="chart-box">
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={paymentTrend}>
                  <defs>
                    <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.blue} stopOpacity={0.28} />
                      <stop offset="95%" stopColor={COLORS.blue} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="label" tick={{ fill: '#64748B', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#64748B', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Area type="monotone" dataKey="amount" stroke={COLORS.blue} strokeWidth={3} fill="url(#revenueFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </Col>
        <Col xl={4}>
          <Panel title="Loan Pipeline">
            <div className="loan-chart-grid">
              <ResponsiveContainer width="100%" height={210}>
                <PieChart>
                  <Pie data={loanBreakdown} dataKey="value" nameKey="name" innerRadius={58} outerRadius={88} paddingAngle={4}>
                    {loanBreakdown.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="legend-list">
                {loanBreakdown.map((item) => (
                  <div key={item.name}>
                    <span style={{ background: item.color }} />
                    <strong>{item.name}</strong>
                    <em>{formatNumber(item.value)}</em>
                  </div>
                ))}
              </div>
            </div>
          </Panel>
        </Col>
      </Row>

      <Row className="g-3 mt-1">
        <Col xl={4}>
          <Panel title="Priority Queue">
            <div className="priority-list">
              {riskQueue.map((item) => {
                const Icon = item.icon
                return (
                  <Link key={item.label} to={item.to} className={`priority-item ${item.tone}`}>
                    <Icon size={18} />
                    <span>{item.label}</span>
                    <strong>{formatNumber(item.value)}</strong>
                  </Link>
                )
              })}
            </div>
          </Panel>
        </Col>
        <Col xl={4}>
          <Panel title="Payment Mix">
            <ResponsiveContainer width="100%" height={245}>
              <BarChart data={paymentMix}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="name" tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748B', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip />
                <Bar dataKey="count" fill={COLORS.green} radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Panel>
        </Col>
        <Col xl={4}>
          <Panel title="Quick Actions">
            <div className="quick-action-grid">
              {quickActions.map((item) => {
                const Icon = item.icon
                return (
                  <Link key={item.label} to={item.to} className="quick-action">
                    <Icon size={20} />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </div>
            <div className="health-card">
              <Activity size={18} />
              <div>
                <strong>System snapshot</strong>
                <span>{formatNumber(users.length)} users and {formatNumber(loans.length)} loans currently indexed.</span>
              </div>
            </div>
          </Panel>
        </Col>
      </Row>

      <Panel
        title="Recent Transactions"
        className="mt-3"
        action={<Link to="/payments">Open payment center</Link>}
      >
        <div className="dashboard-filters">
          <div className="dashboard-search">
            <Search size={17} />
            <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search name, phone, ID, reference" />
          </div>
          <Form.Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="ALL">All status</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="PENDING">Pending</option>
            <option value="FAILED">Failed</option>
          </Form.Select>
          <Form.Select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
            <option value="ALL">All types</option>
            <option value="REPAYMENT">Repayment</option>
            <option value="BILL">Bill</option>
            <option value="DISBURSEMENT">Disbursement</option>
            <option value="FEE">Fee</option>
            <option value="PENALTY">Penalty</option>
          </Form.Select>
        </div>

        <div className="table-wrap">
          <Table responsive hover className="dashboard-table">
            <thead>
              <tr>
                <th>Transaction</th>
                <th>User</th>
                <th>Amount</th>
                <th>Type</th>
                <th>Method</th>
                <th>Status</th>
                <th>Date</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {recentPayments.length > 0 ? (
                recentPayments.map((payment) => (
                  <tr key={payment._id}>
                    <td><span className="mono-id">{String(payment._id || '').slice(-8) || 'N/A'}</span></td>
                    <td>
                      <strong>{getUserName(payment)}</strong>
                      <small>{getUserPhone(payment) || 'No phone'}</small>
                    </td>
                    <td className="amount-cell">{formatCurrency(payment.amount)}</td>
                    <td>{normalize(payment.type) || 'N/A'}</td>
                    <td>{normalize(payment.method) || 'N/A'}</td>
                    <td><Badge bg={getStatusTone(payment.status)}>{normalize(payment.status) || 'N/A'}</Badge></td>
                    <td>{formatDate(payment.createdAt)}</td>
                    <td>
                      <Button variant="light" size="sm" onClick={() => setSelectedPayment(payment)}>
                        <Eye size={15} />
                      </Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="empty-state">No transactions found for current filters.</td>
                </tr>
              )}
            </tbody>
          </Table>
        </div>
      </Panel>

      <Modal show={Boolean(selectedPayment)} onHide={() => setSelectedPayment(null)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>Transaction Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedPayment && (
            <div className="detail-grid">
              <Detail label="Transaction ID" value={selectedPayment._id} />
              <Detail label="Status" value={<Badge bg={getStatusTone(selectedPayment.status)}>{normalize(selectedPayment.status) || 'N/A'}</Badge>} />
              <Detail label="User" value={`${getUserName(selectedPayment)} ${getUserPhone(selectedPayment) ? `(${getUserPhone(selectedPayment)})` : ''}`} />
              <Detail label="Amount" value={formatCurrency(selectedPayment.amount)} strong />
              <Detail label="Type" value={normalize(selectedPayment.type) || 'N/A'} />
              <Detail label="Method" value={normalize(selectedPayment.method) || 'N/A'} />
              <Detail label="Loan ID" value={selectedPayment.loanId?._id || selectedPayment.loanId || 'N/A'} />
              <Detail label="Reference" value={selectedPayment.reference || 'N/A'} />
              <Detail label="Created" value={formatDate(selectedPayment.createdAt)} />
              <Detail label="Updated" value={formatDate(selectedPayment.updatedAt)} />
            </div>
          )}
        </Modal.Body>
      </Modal>

      <style>{dashboardStyles}</style>
    </div>
  )
}

const MetricCard = ({ title, value, note, icon: Icon, color, to }) => (
  <Link to={to} className="metric-card">
    <div style={{ background: `${color}18`, color }}>
      <Icon size={24} />
    </div>
    <span>{title}</span>
    <strong>{value}</strong>
    {note && <em>{note}</em>}
  </Link>
)

const Panel = ({ title, action, className = '', children }) => (
  <section className={`dashboard-panel ${className}`}>
    <div className="panel-head">
      <h2>{title}</h2>
      {action && <div>{action}</div>}
    </div>
    {children}
  </section>
)

const Detail = ({ label, value, strong }) => (
  <div className="detail-item">
    <span>{label}</span>
    <strong className={strong ? 'detail-strong' : ''}>{value}</strong>
  </div>
)

const dashboardStyles = `
  .dashboard-shell {
    color: #0F172A;
  }

  .dashboard-loading {
    min-height: 50vh;
    display: grid;
    place-items: center;
    gap: 14px;
    color: #64748B;
  }


  .dashboard-alert-strip {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border-radius: 8px;
    margin-bottom: 16px;
    border: 1px solid #BAE6FD;
    background: #F0F9FF;
    color: #0C4A6E;
    font-weight: 700;
  }

  .dashboard-alert-strip > div {
    display: flex;
    gap: 24px;
    overflow: hidden;
    white-space: nowrap;
  }

  .metric-card {
    min-height: 150px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 20px;
    border-radius: 8px;
    background: #FFFFFF;
    border: 1px solid #E2E8F0;
    box-shadow: 0 12px 28px rgba(15, 23, 42, 0.07);
    text-decoration: none;
    color: #0F172A;
  }

  .metric-card:hover {
    transform: translateY(-2px);
    color: #0F172A;
    box-shadow: 0 18px 36px rgba(15, 23, 42, 0.12);
  }

  .metric-card > div {
    width: 48px;
    height: 48px;
    border-radius: 8px;
    display: grid;
    place-items: center;
  }

  .metric-card span {
    color: #64748B;
    font-size: 13px;
    font-weight: 800;
    text-transform: uppercase;
  }

  .metric-card strong {
    font-size: 28px;
    line-height: 1;
  }

  .metric-card em {
    color: #DC2626;
    font-style: normal;
    font-size: 13px;
    font-weight: 700;
  }

  .dashboard-panel {
    background: #FFFFFF;
    border: 1px solid #E2E8F0;
    border-radius: 8px;
    padding: 18px;
    box-shadow: 0 12px 28px rgba(15, 23, 42, 0.07);
    height: 100%;
  }

  .panel-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 16px;
  }

  .panel-head h2 {
    font-size: 17px;
    margin: 0;
    font-weight: 800;
  }

  .panel-head a {
    color: #2563EB;
    font-weight: 800;
    font-size: 13px;
    text-decoration: none;
  }

  .chart-box {
    min-height: 300px;
  }

  .loan-chart-grid {
    display: grid;
    gap: 12px;
  }

  .legend-list {
    display: grid;
    gap: 10px;
  }

  .legend-list div {
    display: flex;
    align-items: center;
    gap: 10px;
    color: #475569;
    font-size: 13px;
  }

  .legend-list span {
    width: 10px;
    height: 10px;
    border-radius: 999px;
  }

  .legend-list em {
    margin-left: auto;
    font-style: normal;
    font-weight: 800;
    color: #0F172A;
  }

  .priority-list,
  .quick-action-grid {
    display: grid;
    gap: 10px;
  }

  .priority-item,
  .quick-action {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 13px 14px;
    border-radius: 8px;
    text-decoration: none;
    color: #334155;
    background: #F8FAFC;
    border: 1px solid #E2E8F0;
    font-weight: 800;
  }

  .priority-item strong {
    margin-left: auto;
    color: #0F172A;
  }

  .priority-item.danger {
    background: #FEF2F2;
    border-color: #FECACA;
    color: #B91C1C;
  }

  .priority-item.warning {
    background: #FFFBEB;
    border-color: #FDE68A;
    color: #92400E;
  }

  .quick-action-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .quick-action:hover,
  .priority-item:hover {
    transform: translateY(-1px);
  }

  .health-card {
    margin-top: 14px;
    display: flex;
    gap: 12px;
    padding: 14px;
    border-radius: 8px;
    background: #ECFDF5;
    color: #065F46;
    border: 1px solid #A7F3D0;
  }

  .health-card div {
    display: grid;
    gap: 2px;
  }

  .health-card span {
    font-size: 13px;
    color: #047857;
  }

  .dashboard-filters {
    display: grid;
    grid-template-columns: minmax(240px, 1fr) 170px 170px;
    gap: 10px;
    margin-bottom: 14px;
  }

  .dashboard-search {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 12px;
    border-radius: 8px;
    border: 1px solid #CBD5E1;
    background: #FFFFFF;
  }

  .dashboard-search input {
    border: 0;
    outline: 0;
    width: 100%;
    min-height: 38px;
    font-weight: 600;
  }

  .table-wrap {
    overflow: hidden;
    border: 1px solid #E2E8F0;
    border-radius: 8px;
  }

  .dashboard-table {
    margin: 0;
  }

  .dashboard-table th {
    background: #F8FAFC;
    color: #475569;
    font-size: 12px;
    text-transform: uppercase;
    border-bottom: 1px solid #E2E8F0;
    padding: 13px 14px;
  }

  .dashboard-table td {
    vertical-align: middle;
    padding: 14px;
    color: #334155;
  }

  .dashboard-table td small {
    display: block;
    color: #64748B;
    font-weight: 600;
  }

  .mono-id {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    color: #2563EB;
    font-weight: 800;
  }

  .amount-cell {
    font-weight: 900;
    color: #065F46 !important;
  }

  .empty-state {
    text-align: center;
    color: #64748B !important;
    padding: 32px !important;
  }

  .detail-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
  }

  .detail-item {
    padding: 14px;
    border-radius: 8px;
    background: #F8FAFC;
    border: 1px solid #E2E8F0;
    display: grid;
    gap: 6px;
  }

  .detail-item span {
    color: #64748B;
    font-size: 12px;
    font-weight: 800;
    text-transform: uppercase;
  }

  .detail-item strong {
    color: #0F172A;
    word-break: break-word;
  }

  .detail-strong {
    color: #059669 !important;
    font-size: 20px;
  }

  .spin {
    animation: dashboardSpin 0.9s linear infinite;
  }

  @keyframes dashboardSpin {
    to { transform: rotate(360deg); }
  }

  @media (max-width: 992px) {
    .dashboard-filters {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 576px) {
    .metric-card {
      min-height: 132px;
    }

    .quick-action-grid,
    .detail-grid {
      grid-template-columns: 1fr;
    }
  }
`

export default Dashboard
