import React, { useEffect, useMemo, useState } from 'react'
import { Badge, Button, Col, Form, Modal, Row, Table } from 'react-bootstrap'
import {
  AlertTriangle,
  CreditCard,
  Download,
  FileSpreadsheet,
  IndianRupee,
  ReceiptText,
  RefreshCcw,
  Search,
  Users,
  WalletCards,
} from 'lucide-react'
import api from '../api/axios'

const reportTypes = [
  { key: 'users', label: 'Users', icon: Users, endpoint: '/reports/users' },
  { key: 'loans', label: 'Loans', icon: CreditCard, endpoint: '/reports/loans' },
  { key: 'payments', label: 'Payments', icon: IndianRupee, endpoint: '/reports/payments' },
  { key: 'bills', label: 'Bills', icon: ReceiptText, endpoint: '/reports/bills' },
  { key: 'withdrawals', label: 'Withdrawals', icon: WalletCards, endpoint: '/reports/withdrawals' },
]

const formatCurrency = (amount) => `Rs. ${Number(amount || 0).toLocaleString('en-IN')}`
const formatNumber = (value) => Number(value || 0).toLocaleString('en-IN')

const today = new Date().toISOString().slice(0, 10)
const daysAgo = (days) => {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString().slice(0, 10)
}

const Reports = () => {
  const [activeType, setActiveType] = useState('loans')
  const [startDate, setStartDate] = useState(daysAgo(30))
  const [endDate, setEndDate] = useState(today)
  const [summary, setSummary] = useState(null)
  const [reportData, setReportData] = useState([])
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [detailRow, setDetailRow] = useState(null)

  const activeReport = reportTypes.find((item) => item.key === activeType) || reportTypes[1]

  const query = `startDate=${startDate}&endDate=${endDate}`

  const fetchReports = async () => {
    try {
      setError('')
      const [summaryRes, reportRes] = await Promise.all([
        api.get(`/reports/summary?${query}`),
        api.get(`${activeReport.endpoint}?${query}&format=json`),
      ])
      setSummary(summaryRes.data?.data || summaryRes.data || null)
      setReportData(reportRes.data?.data || reportRes.data || [])
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Reports could not be loaded')
      setReportData([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchReports()
  }, [activeType, startDate, endDate])

  const filteredData = useMemo(() => {
    const term = searchTerm.toLowerCase().trim()
    if (!term) return reportData
    return reportData.filter((row) =>
      Object.values(row).some((value) => String(value || '').toLowerCase().includes(term))
    )
  }, [reportData, searchTerm])

  const columns = useMemo(() => {
    const first = filteredData[0] || reportData[0]
    if (!first) return []
    return Object.keys(first)
  }, [filteredData, reportData])

  const totals = summary?.totals || {}
  const status = summary?.status || {}

  const refresh = () => {
    setRefreshing(true)
    fetchReports()
  }

  const downloadReport = async (format) => {
    try {
      setDownloading(format)
      const res = await api.get(`${activeReport.endpoint}?${query}&format=${format}`, {
        responseType: 'blob',
      })
      const ext = format === 'excel' ? 'xlsx' : format
      const blob = new Blob([res.data], { type: res.headers?.['content-type'] || 'application/octet-stream' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${activeType}_report_${startDate}_to_${endDate}.${ext}`
      link.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert(err.response?.data?.message || `Failed to download ${format} report`)
    } finally {
      setDownloading('')
    }
  }

  const exportClientCsv = () => {
    if (!filteredData.length) return alert('No data to export')
    const headers = Object.keys(filteredData[0])
    const csv = [headers, ...filteredData.map((row) => headers.map((key) => row[key] ?? ''))]
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${activeType}_report_filtered_${Date.now()}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="reports-loading">
        <div className="spinner-border text-primary" role="status" />
        <p>Loading reports...</p>
      </div>
    )
  }

  return (
    <div className="reports-page">
      <section className="reports-hero">
        <div>
          <span>Business Intelligence</span>
          <h1>Reports & Analytics</h1>
          <p>Generate users, loans, payments, bills, and withdrawals reports with date filters and downloadable formats.</p>
        </div>
        <div className="reports-hero-actions">
          <Button className="reports-primary-btn" onClick={() => downloadReport('csv')} disabled={Boolean(downloading)}>
            <Download size={16} />
            CSV
          </Button>
          <Button variant="light" onClick={refresh} disabled={refreshing}>
            <RefreshCcw size={16} className={refreshing ? 'spin' : ''} />
            {refreshing ? 'Refreshing' : 'Refresh'}
          </Button>
        </div>
      </section>

      {error && (
        <div className="reports-warning">
          <AlertTriangle size={18} />
          <span>{error}</span>
          <button onClick={refresh}>Retry</button>
        </div>
      )}

      <section className="reports-filters">
        <Form.Group>
          <Form.Label>Start date</Form.Label>
          <Form.Control type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
        </Form.Group>
        <Form.Group>
          <Form.Label>End date</Form.Label>
          <Form.Control type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
        </Form.Group>
        <div className="quick-ranges">
          <Button variant="light" onClick={() => { setStartDate(daysAgo(7)); setEndDate(today) }}>7 days</Button>
          <Button variant="light" onClick={() => { setStartDate(daysAgo(30)); setEndDate(today) }}>30 days</Button>
          <Button variant="light" onClick={() => { setStartDate(daysAgo(90)); setEndDate(today) }}>90 days</Button>
        </div>
      </section>

      <Row className="g-3">
        <Col xl={3} md={6}><Metric title="Users" value={formatNumber(totals.users)} icon={Users} color="#2563EB" /></Col>
        <Col xl={3} md={6}><Metric title="Loans" value={formatNumber(totals.loans)} icon={CreditCard} color="#059669" /></Col>
        <Col xl={3} md={6}><Metric title="Received" value={formatCurrency(totals.receivedAmount)} icon={IndianRupee} color="#D97706" /></Col>
        <Col xl={3} md={6}><Metric title="Withdrawals" value={formatCurrency(totals.withdrawalAmount)} icon={WalletCards} color="#7C3AED" /></Col>
      </Row>

      <Row className="g-3 mt-1">
        <Col lg={4}><StatusCard title="Loan Status" data={status.loans || {}} /></Col>
        <Col lg={4}><StatusCard title="Payment Status" data={status.payments || {}} /></Col>
        <Col lg={4}><StatusCard title="Withdrawal Status" data={status.withdrawals || {}} /></Col>
      </Row>

      <section className="report-tabs">
        {reportTypes.map((item) => {
          const Icon = item.icon
          return (
            <button key={item.key} className={activeType === item.key ? 'active' : ''} onClick={() => setActiveType(item.key)}>
              <Icon size={17} />
              {item.label}
            </button>
          )
        })}
      </section>

      <section className="reports-panel">
        <div className="reports-panel-head">
          <div>
            <h2>{activeReport.label} Report</h2>
            <p>{filteredData.length.toLocaleString('en-IN')} records from {startDate} to {endDate}</p>
          </div>
          <div className="download-actions">
            <Button variant="light" onClick={exportClientCsv}><FileSpreadsheet size={16} /> Filtered CSV</Button>
            <Button variant="outline-primary" onClick={() => downloadReport('excel')} disabled={Boolean(downloading)}>Excel</Button>
            <Button variant="outline-secondary" onClick={() => downloadReport('pdf')} disabled={Boolean(downloading)}>PDF</Button>
          </div>
        </div>

        <div className="reports-toolbar">
          <div className="reports-search">
            <Search size={18} />
            <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search within report records" />
          </div>
          <Badge bg="info">{activeReport.label}</Badge>
        </div>

        <div className="reports-table-wrap">
          <Table responsive hover className="reports-table">
            <thead>
              <tr>
                {columns.slice(0, 8).map((column) => <th key={column}>{toTitle(column)}</th>)}
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.length ? filteredData.slice(0, 100).map((row, index) => (
                <tr key={row.id || index}>
                  {columns.slice(0, 8).map((column) => (
                    <td key={column}>{formatCell(column, row[column])}</td>
                  ))}
                  <td><Button variant="light" size="sm" onClick={() => setDetailRow(row)}>View</Button></td>
                </tr>
              )) : (
                <tr><td colSpan={columns.length + 1 || 5} className="reports-empty">No report data found for this date range.</td></tr>
              )}
            </tbody>
          </Table>
        </div>
      </section>

      <Modal show={Boolean(detailRow)} onHide={() => setDetailRow(null)} size="lg" centered>
        <Modal.Header closeButton><Modal.Title>Report Record</Modal.Title></Modal.Header>
        <Modal.Body>
          {detailRow && (
            <div className="record-grid">
              {Object.entries(detailRow).map(([key, value]) => (
                <div key={key} className="record-box">
                  <span>{toTitle(key)}</span>
                  <strong>{String(value ?? 'N/A')}</strong>
                </div>
              ))}
            </div>
          )}
        </Modal.Body>
      </Modal>

      <style>{styles}</style>
    </div>
  )
}

const Metric = ({ title, value, icon: Icon, color }) => (
  <div className="report-metric">
    <div style={{ color, background: `${color}18` }}><Icon size={24} /></div>
    <span>{title}</span>
    <strong>{value}</strong>
  </div>
)

const StatusCard = ({ title, data }) => (
  <div className="status-card">
    <h3>{title}</h3>
    {Object.entries(data).length ? Object.entries(data).map(([key, value]) => (
      <div key={key}>
        <span>{toTitle(key)}</span>
        <strong>{formatNumber(value)}</strong>
      </div>
    )) : <p>No data</p>}
  </div>
)

const toTitle = (value) => String(value).replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())

const formatCell = (key, value) => {
  if (value === null || value === undefined || value === '') return 'N/A'
  if (/amount|balance|received|withdrawal|limit/i.test(key)) return formatCurrency(value)
  return String(value)
}

const styles = `
  .reports-loading{min-height:50vh;display:grid;place-items:center;gap:12px;color:#64748B}.reports-page{color:#0F172A}
  .reports-hero{display:flex;justify-content:space-between;align-items:center;gap:20px;padding:26px;margin-bottom:18px;color:white;border-radius:8px;background:linear-gradient(135deg,#0F172A,#1E293B);box-shadow:0 20px 45px rgba(15,23,42,.16)}
  .reports-hero span{color:#7DD3FC;font-size:12px;font-weight:900;text-transform:uppercase}.reports-hero h1{margin:6px 0;font-size:28px}.reports-hero p{margin:0;color:#CBD5E1;max-width:760px}
  .reports-hero-actions,.download-actions,.quick-ranges{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.reports-hero-actions .btn,.download-actions .btn{display:inline-flex;align-items:center;gap:8px;border-radius:8px;font-weight:800}.reports-primary-btn{background:linear-gradient(135deg,#2563EB,#059669)!important;border:0!important}
  .reports-warning{display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:8px;background:#FFFBEB;border:1px solid #FDE68A;color:#92400E;font-weight:700;margin-bottom:16px}.reports-warning button{border:0;background:transparent;color:#2563EB;font-weight:900}
  .reports-filters,.report-metric,.status-card,.reports-panel{background:white;border:1px solid #E2E8F0;border-radius:8px;box-shadow:0 12px 28px rgba(15,23,42,.07)}.reports-filters{display:grid;grid-template-columns:180px 180px 1fr;gap:12px;align-items:end;padding:16px;margin-bottom:16px}.reports-filters label{font-size:13px;font-weight:900;color:#475569}
  .report-metric{min-height:142px;padding:20px;display:flex;flex-direction:column;gap:10px}.report-metric>div{width:48px;height:48px;border-radius:8px;display:grid;place-items:center}.report-metric span{color:#64748B;font-size:13px;font-weight:900;text-transform:uppercase}.report-metric strong{font-size:24px;line-height:1.15}
  .status-card{padding:18px;height:100%}.status-card h3{font-size:16px;font-weight:900;margin:0 0 12px}.status-card div{display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid #F1F5F9}.status-card span{color:#64748B;font-weight:800}.status-card strong{color:#0F172A}
  .report-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0}.report-tabs button{display:inline-flex;align-items:center;gap:8px;border:1px solid #CBD5E1;background:white;color:#334155;border-radius:8px;padding:10px 13px;font-weight:900}.report-tabs button.active{background:#2563EB;color:white;border-color:#2563EB}
  .reports-panel{padding:18px}.reports-panel-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:16px}.reports-panel-head h2{font-size:18px;font-weight:900;margin:0}.reports-panel-head p{margin:3px 0 0;color:#64748B;font-weight:700}
  .reports-toolbar{display:grid;grid-template-columns:minmax(260px,1fr) auto;gap:10px;align-items:center;margin-bottom:14px}.reports-search{display:flex;align-items:center;gap:8px;padding:0 12px;border-radius:8px;border:1px solid #CBD5E1;background:white}.reports-search input{width:100%;border:0;outline:0;min-height:38px;font-weight:700}
  .reports-table-wrap{border:1px solid #E2E8F0;border-radius:8px;overflow:hidden}.reports-table{margin:0}.reports-table th{background:#F8FAFC;color:#475569;font-size:12px;text-transform:uppercase;padding:13px 14px;border-bottom:1px solid #E2E8F0;white-space:nowrap}.reports-table td{vertical-align:middle;padding:14px;color:#334155;white-space:nowrap}.reports-empty{text-align:center;color:#64748B!important;padding:32px!important;font-weight:700}
  .record-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.record-box{padding:13px;border-radius:8px;background:#F8FAFC;border:1px solid #E2E8F0;display:grid;gap:5px}.record-box span{color:#64748B;font-size:12px;font-weight:900;text-transform:uppercase}.record-box strong{word-break:break-word}.spin{animation:spin .9s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}
  @media(max-width:992px){.reports-hero,.reports-panel-head{align-items:flex-start;flex-direction:column}.reports-filters,.reports-toolbar,.record-grid{grid-template-columns:1fr}.reports-hero h1{font-size:23px}}
`

export default Reports
