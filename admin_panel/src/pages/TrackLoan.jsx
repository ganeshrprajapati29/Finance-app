import React, { useMemo, useState } from 'react';
import { Alert, Badge, Button, Col, Form, InputGroup, Modal, ProgressBar, Row, Table } from 'react-bootstrap';
import {
  AlertTriangle,
  Banknote,
  CalendarClock,
  CheckCircle2,
  Clock3,
  CreditCard,
  Download,
  Eye,
  FileSpreadsheet,
  RefreshCw,
  Search,
  ShieldAlert,
  UserRound,
  WalletCards,
  XCircle
} from 'lucide-react';
import api from '../api/axios';

const formatCurrency = (amount) => {
  const value = Number(amount || 0);
  return `Rs. ${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
};

const formatDate = (date) => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

const statusMeta = {
  PENDING: { bg: 'warning', label: 'Pending' },
  APPROVED: { bg: 'info', label: 'Approved' },
  DISBURSED: { bg: 'success', label: 'Disbursed' },
  ACTIVE: { bg: 'success', label: 'Active' },
  CLOSED: { bg: 'secondary', label: 'Closed' },
  REJECTED: { bg: 'danger', label: 'Rejected' },
  OVERDUE: { bg: 'danger', label: 'Overdue' },
  CONFIRMED: { bg: 'success', label: 'Confirmed' },
  FAILED: { bg: 'danger', label: 'Failed' }
};

const getInstallmentStatus = (installment) => {
  if (installment?.paid) return { bg: 'success', label: 'Paid', icon: CheckCircle2 };
  if (installment?.dueDate && new Date(installment.dueDate) < new Date()) {
    return { bg: 'danger', label: 'Overdue', icon: XCircle };
  }
  return { bg: 'warning', label: 'Pending', icon: Clock3 };
};

const downloadCsv = (rows, filename) => {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => `"${String(row[header] ?? '').replace(/"/g, '""')}"`).join(','))
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const StatTile = ({ icon: Icon, label, value, tone = 'blue', subtext }) => (
  <div className={`track-stat track-stat-${tone}`}>
    <div className="track-stat-icon"><Icon size={20} /></div>
    <div>
      <div className="track-stat-label">{label}</div>
      <div className="track-stat-value">{value}</div>
      {subtext && <div className="track-stat-subtext">{subtext}</div>}
    </div>
  </div>
);

const StatusBadge = ({ status }) => {
  const key = String(status || 'PENDING').toUpperCase();
  const meta = statusMeta[key] || { bg: 'secondary', label: status || 'N/A' };
  return <Badge bg={meta.bg}>{meta.label}</Badge>;
};

const TrackLoan = () => {
  const [query, setQuery] = useState('');
  const [loan, setLoan] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSchedule, setShowSchedule] = useState(false);
  const [showPayments, setShowPayments] = useState(false);

  const schedule = useMemo(() => loan?.schedule || [], [loan]);
  const paymentRows = payments.length ? payments : loan?.recentPayments || [];

  const summary = useMemo(() => {
    const paid = schedule.filter((item) => item.paid).length;
    const overdue = schedule.filter((item) => !item.paid && item.dueDate && new Date(item.dueDate) < new Date()).length;
    const pending = Math.max(schedule.length - paid - overdue, 0);
    const total = Number(loan?.totals?.total || 0);
    const paidAmount = Number(loan?.paid?.total || 0);
    return {
      paid,
      overdue,
      pending,
      progress: total > 0 ? Math.min(Math.round((paidAmount / total) * 100), 100) : 0
    };
  }, [loan, schedule]);

  const searchLoan = async (term) => {
    if (!term) {
      setError('Loan account, loan ID, email, mobile ya customer name enter karein.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setLoan(null);
      setPayments([]);
      const res = await api.get(`/admin/track-loan/search?query=${encodeURIComponent(term)}`);
      setLoan(res.data?.data || null);
      setPayments(res.data?.data?.recentPayments || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Loan details load nahi ho paayi.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (event) => {
    event.preventDefault();
    await searchLoan(query.trim());
  };

  const handleRefresh = async () => {
    await searchLoan(loan?.loanAccountNumber || query.trim());
  };

  const fetchPayments = async () => {
    if (!loan?._id) return;
    try {
      setPaymentsLoading(true);
      const res = await api.get(`/admin/track-loan/${loan._id}/payments`);
      setPayments(res.data?.data || []);
      setShowPayments(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Payment history load nahi ho paayi.');
    } finally {
      setPaymentsLoading(false);
    }
  };

  const exportSchedule = () => {
    downloadCsv(
      schedule.map((item) => {
        const status = getInstallmentStatus(item);
        return {
          installment: item.installmentNo,
          dueDate: formatDate(item.dueDate),
          principal: item.principal || 0,
          interest: item.interest || 0,
          total: item.total || 0,
          status: status.label,
          paidAt: formatDate(item.paidAt)
        };
      }),
      `${loan?.loanAccountNumber || 'loan'}-emi-schedule.csv`
    );
  };

  const exportPayments = () => {
    downloadCsv(
      paymentRows.map((item) => ({
        date: formatDate(item.createdAt),
        installment: item.installmentNo || item.metadata?.installmentNo || '',
        amount: item.amount || 0,
        status: item.status || '',
        method: item.method || '',
        type: item.type || '',
        reference: item.reference || item.gateway?.paymentId || item.gateway?.orderId || ''
      })),
      `${loan?.loanAccountNumber || 'loan'}-payment-history.csv`
    );
  };

  return (
    <div className="track-page">
      <div className="track-header">
        <div>
          <div className="track-eyebrow">Loan Operations</div>
          <h1>Track Loan</h1>
          <p>Loan account, borrower profile, EMI schedule, overdue amount aur payment history ek jagah.</p>
        </div>
        <Button variant="light" className="track-refresh" onClick={handleRefresh} disabled={loading || !loan}>
          <RefreshCw size={16} /> Refresh
        </Button>
      </div>

      <div className="track-search-panel">
        <Form onSubmit={handleSearch}>
          <Row className="g-3 align-items-end">
            <Col lg={9}>
              <Form.Label>Search loan</Form.Label>
              <InputGroup>
                <InputGroup.Text><Search size={18} /></InputGroup.Text>
                <Form.Control
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Loan account, loan ID, email, mobile, ya customer name"
                  disabled={loading}
                />
              </InputGroup>
            </Col>
            <Col lg={3}>
              <Button type="submit" className="w-100 track-primary-btn" disabled={loading}>
                {loading ? <span className="spinner-border spinner-border-sm" /> : <Search size={17} />}
                {loading ? 'Searching...' : 'Search Loan'}
              </Button>
            </Col>
          </Row>
        </Form>
      </div>

      {error && (
        <Alert variant="danger" className="track-alert" dismissible onClose={() => setError('')}>
          <AlertTriangle size={18} /> {error}
        </Alert>
      )}

      {!loan && !loading && (
        <div className="track-empty">
          <Search size={44} />
          <h3>Start with a loan search</h3>
          <p>Loan account number, borrower email, mobile number, name, ya loan ID se exact details fetch kar sakte hain.</p>
        </div>
      )}

      {loan && (
        <>
          <Row className="g-3">
            <Col xl={3} md={6}>
              <StatTile icon={Banknote} label="Approved Amount" value={formatCurrency(loan.decision?.amountApproved || loan.application?.amountRequested)} tone="blue" subtext={`${loan.decision?.rateAPR || 0}% APR`} />
            </Col>
            <Col xl={3} md={6}>
              <StatTile icon={WalletCards} label="Paid Amount" value={formatCurrency(loan.paid?.total)} tone="green" subtext={`${summary.paid}/${schedule.length} EMI paid`} />
            </Col>
            <Col xl={3} md={6}>
              <StatTile icon={CreditCard} label="Outstanding" value={formatCurrency(loan.outstanding?.total)} tone="amber" subtext={`${summary.progress}% recovered`} />
            </Col>
            <Col xl={3} md={6}>
              <StatTile icon={ShieldAlert} label="Overdue" value={formatCurrency(loan.overdue?.amount)} tone={summary.overdue ? 'red' : 'green'} subtext={`${summary.overdue} overdue EMI`} />
            </Col>
          </Row>

          <Row className="g-3 mt-1">
            <Col xl={7}>
              <div className="track-card">
                <div className="track-card-head">
                  <div>
                    <h2>{loan.loanAccountNumber || 'Loan Account'}</h2>
                    <p>{loan.user?.name || loan.application?.personal?.name || 'Customer'} - {loan.user?.mobile || loan.application?.personal?.mobile || 'No mobile'}</p>
                  </div>
                  <StatusBadge status={loan.status} />
                </div>

                <div className="track-progress-block">
                  <div className="d-flex justify-content-between">
                    <span>Repayment Progress</span>
                    <strong>{summary.progress}%</strong>
                  </div>
                  <ProgressBar now={summary.progress} variant={summary.overdue ? 'danger' : 'success'} />
                </div>

                <div className="track-info-grid">
                  <div><span>Customer Email</span><strong>{loan.user?.email || loan.application?.personal?.email || 'N/A'}</strong></div>
                  <div><span>Loan Status</span><strong><StatusBadge status={loan.status} /></strong></div>
                  <div><span>Tenure</span><strong>{loan.decision?.tenureMonths || loan.application?.tenureMonths || 0} months</strong></div>
                  <div><span>Disbursed On</span><strong>{formatDate(loan.disbursementDate)}</strong></div>
                  <div><span>Purpose</span><strong>{loan.application?.purpose || 'N/A'}</strong></div>
                  <div><span>Applied On</span><strong>{formatDate(loan.createdAt)}</strong></div>
                </div>
              </div>
            </Col>

            <Col xl={5}>
              <div className="track-card h-100">
                <div className="track-card-head">
                  <div>
                    <h2>Next Due</h2>
                    <p>Upcoming EMI and risk status</p>
                  </div>
                  <CalendarClock size={24} />
                </div>

                {loan.nextDue ? (
                  <div className="track-nextdue">
                    <div>
                      <span>EMI #{loan.nextDue.installmentNo}</span>
                      <strong>{formatCurrency(loan.nextDue.total)}</strong>
                    </div>
                    <div>
                      <span>Due Date</span>
                      <strong>{formatDate(loan.nextDue.dueDate)}</strong>
                    </div>
                  </div>
                ) : (
                  <div className="track-complete">
                    <CheckCircle2 size={36} />
                    <strong>No upcoming EMI</strong>
                    <span>Loan may be closed or schedule is not generated yet.</span>
                  </div>
                )}

                <div className="track-mini-stats">
                  <span><CheckCircle2 size={15} /> Paid: {summary.paid}</span>
                  <span><Clock3 size={15} /> Pending: {summary.pending}</span>
                  <span><XCircle size={15} /> Overdue: {summary.overdue}</span>
                </div>
              </div>
            </Col>
          </Row>

          <Row className="g-3 mt-1">
            <Col xl={4}>
              <div className="track-card h-100">
                <div className="track-card-head compact">
                  <h2><UserRound size={20} /> Borrower Details</h2>
                </div>
                <div className="track-detail-list">
                  <div><span>Name</span><strong>{loan.application?.personal?.name || loan.user?.name || 'N/A'}</strong></div>
                  <div><span>Father</span><strong>{loan.application?.personal?.fatherName || 'N/A'}</strong></div>
                  <div><span>Address</span><strong>{loan.application?.personal?.address || 'N/A'}</strong></div>
                  <div><span>Income</span><strong>{formatCurrency(loan.application?.employment?.monthlyIncome)}</strong></div>
                  <div><span>Employment</span><strong>{loan.application?.employment?.employmentType || 'N/A'}</strong></div>
                </div>
              </div>
            </Col>
            <Col xl={4}>
              <div className="track-card h-100">
                <div className="track-card-head compact">
                  <h2><CreditCard size={20} /> Bank Details</h2>
                </div>
                <div className="track-detail-list">
                  <div><span>Bank</span><strong>{loan.application?.bankDetails?.bankName || 'N/A'}</strong></div>
                  <div><span>Account Holder</span><strong>{loan.application?.bankDetails?.accountHolderName || 'N/A'}</strong></div>
                  <div><span>Account No.</span><strong>{loan.application?.bankDetails?.accountNumber || 'N/A'}</strong></div>
                  <div><span>IFSC</span><strong>{loan.application?.bankDetails?.ifscCode || 'N/A'}</strong></div>
                </div>
              </div>
            </Col>
            <Col xl={4}>
              <div className="track-card h-100">
                <div className="track-card-head compact">
                  <h2><FileSpreadsheet size={20} /> Quick Actions</h2>
                </div>
                <div className="track-actions">
                  <Button variant="outline-primary" onClick={() => setShowSchedule(true)} disabled={!schedule.length}>
                    <Eye size={16} /> View EMI Schedule
                  </Button>
                  <Button variant="outline-success" onClick={fetchPayments} disabled={paymentsLoading}>
                    <WalletCards size={16} /> {paymentsLoading ? 'Loading...' : 'Payment History'}
                  </Button>
                  <Button variant="outline-secondary" onClick={exportSchedule} disabled={!schedule.length}>
                    <Download size={16} /> Export Schedule
                  </Button>
                  <Button variant="outline-secondary" onClick={exportPayments} disabled={!paymentRows.length}>
                    <Download size={16} /> Export Payments
                  </Button>
                </div>
              </div>
            </Col>
          </Row>

          <div className="track-card mt-3">
            <div className="track-card-head">
              <div>
                <h2>EMI Schedule</h2>
                <p>Latest installment status and due dates</p>
              </div>
              <Button size="sm" variant="outline-primary" onClick={() => setShowSchedule(true)} disabled={!schedule.length}>
                <Eye size={15} /> Full View
              </Button>
            </div>
            <div className="table-responsive">
              <Table hover className="track-table mb-0">
                <thead>
                  <tr>
                    <th>EMI</th>
                    <th>Due Date</th>
                    <th>Principal</th>
                    <th>Interest</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th>Paid On</th>
                  </tr>
                </thead>
                <tbody>
                  {schedule.slice(0, 8).map((item) => {
                    const status = getInstallmentStatus(item);
                    const Icon = status.icon;
                    return (
                      <tr key={item.installmentNo}>
                        <td>#{item.installmentNo}</td>
                        <td>{formatDate(item.dueDate)}</td>
                        <td>{formatCurrency(item.principal)}</td>
                        <td>{formatCurrency(item.interest)}</td>
                        <td><strong>{formatCurrency(item.total)}</strong></td>
                        <td><Badge bg={status.bg}><Icon size={13} /> {status.label}</Badge></td>
                        <td>{formatDate(item.paidAt)}</td>
                      </tr>
                    );
                  })}
                  {!schedule.length && (
                    <tr><td colSpan="7" className="text-center text-muted py-4">EMI schedule abhi generate nahi hua.</td></tr>
                  )}
                </tbody>
              </Table>
            </div>
          </div>

          <div className="track-card mt-3">
            <div className="track-card-head">
              <div>
                <h2>Recent Payments</h2>
                <p>Confirmed, pending, and failed repayment activity</p>
              </div>
              <Button size="sm" variant="outline-success" onClick={fetchPayments}>
                <WalletCards size={15} /> View All
              </Button>
            </div>
            <div className="table-responsive">
              <Table hover className="track-table mb-0">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Installment</th>
                    <th>Method</th>
                    <th>Reference</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentRows.slice(0, 6).map((item) => (
                    <tr key={item._id}>
                      <td>{formatDate(item.createdAt)}</td>
                      <td><strong>{formatCurrency(item.amount)}</strong></td>
                      <td>{item.installmentNo || item.metadata?.installmentNo || '-'}</td>
                      <td>{item.method || '-'}</td>
                      <td className="track-ref">{item.reference || item.gateway?.paymentId || item.gateway?.orderId || '-'}</td>
                      <td><StatusBadge status={item.status} /></td>
                    </tr>
                  ))}
                  {!paymentRows.length && (
                    <tr><td colSpan="6" className="text-center text-muted py-4">Payment history available nahi hai.</td></tr>
                  )}
                </tbody>
              </Table>
            </div>
          </div>
        </>
      )}

      <Modal show={showSchedule} onHide={() => setShowSchedule(false)} size="xl" centered>
        <Modal.Header closeButton>
          <Modal.Title>EMI Schedule - {loan?.loanAccountNumber}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="table-responsive">
            <Table hover className="track-table">
              <thead>
                <tr>
                  <th>EMI</th>
                  <th>Due Date</th>
                  <th>Principal</th>
                  <th>Interest</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Paid On</th>
                </tr>
              </thead>
              <tbody>
                {schedule.map((item) => {
                  const status = getInstallmentStatus(item);
                  const Icon = status.icon;
                  return (
                    <tr key={item.installmentNo}>
                      <td>#{item.installmentNo}</td>
                      <td>{formatDate(item.dueDate)}</td>
                      <td>{formatCurrency(item.principal)}</td>
                      <td>{formatCurrency(item.interest)}</td>
                      <td><strong>{formatCurrency(item.total)}</strong></td>
                      <td><Badge bg={status.bg}><Icon size={13} /> {status.label}</Badge></td>
                      <td>{formatDate(item.paidAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={exportSchedule} disabled={!schedule.length}>
            <Download size={16} /> Export CSV
          </Button>
          <Button variant="secondary" onClick={() => setShowSchedule(false)}>Close</Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showPayments} onHide={() => setShowPayments(false)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>Payment History - {loan?.loanAccountNumber}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="table-responsive">
            <Table hover className="track-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Type</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th>Reference</th>
                </tr>
              </thead>
              <tbody>
                {paymentRows.map((item) => (
                  <tr key={item._id}>
                    <td>{formatDate(item.createdAt)}</td>
                    <td><strong>{formatCurrency(item.amount)}</strong></td>
                    <td>{item.type || '-'}</td>
                    <td>{item.method || '-'}</td>
                    <td><StatusBadge status={item.status} /></td>
                    <td className="track-ref">{item.reference || item.gateway?.paymentId || item.gateway?.orderId || '-'}</td>
                  </tr>
                ))}
                {!paymentRows.length && (
                  <tr><td colSpan="6" className="text-center text-muted py-4">Payment history available nahi hai.</td></tr>
                )}
              </tbody>
            </Table>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={exportPayments} disabled={!paymentRows.length}>
            <Download size={16} /> Export CSV
          </Button>
          <Button variant="secondary" onClick={() => setShowPayments(false)}>Close</Button>
        </Modal.Footer>
      </Modal>

      <style>{`
        .track-page { color: #0f172a; }
        .track-header { background: linear-gradient(135deg, #0f172a 0%, #155e75 52%, #047857 100%); border-radius: 18px; padding: 28px; color: #fff; display: flex; justify-content: space-between; gap: 18px; align-items: flex-start; box-shadow: 0 18px 45px rgba(15, 23, 42, 0.18); }
        .track-header h1 { margin: 2px 0 8px; font-size: 30px; font-weight: 850; letter-spacing: 0; }
        .track-header p { margin: 0; max-width: 780px; color: rgba(255,255,255,0.78); font-weight: 500; }
        .track-eyebrow { font-size: 12px; text-transform: uppercase; font-weight: 800; color: #99f6e4; }
        .track-refresh { display: inline-flex; align-items: center; gap: 8px; font-weight: 800; white-space: nowrap; }
        .track-search-panel, .track-card, .track-empty { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; box-shadow: 0 12px 30px rgba(15, 23, 42, 0.06); }
        .track-search-panel { padding: 18px; margin: 18px 0; }
        .track-search-panel label { font-size: 13px; font-weight: 800; color: #334155; }
        .track-primary-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; font-weight: 800; background: #0f766e; border-color: #0f766e; }
        .track-alert { display: flex; align-items: center; gap: 8px; }
        .track-empty { text-align: center; padding: 54px 20px; color: #64748b; }
        .track-empty svg { color: #0f766e; margin-bottom: 12px; }
        .track-empty h3 { color: #0f172a; font-size: 22px; font-weight: 850; }
        .track-stat { min-height: 112px; border-radius: 14px; padding: 18px; display: flex; gap: 14px; align-items: flex-start; border: 1px solid #e2e8f0; background: #fff; box-shadow: 0 10px 26px rgba(15, 23, 42, 0.06); }
        .track-stat-icon { width: 42px; height: 42px; border-radius: 12px; display: grid; place-items: center; color: #fff; flex-shrink: 0; }
        .track-stat-blue .track-stat-icon { background: #2563eb; }
        .track-stat-green .track-stat-icon { background: #059669; }
        .track-stat-amber .track-stat-icon { background: #d97706; }
        .track-stat-red .track-stat-icon { background: #dc2626; }
        .track-stat-label { font-size: 12px; color: #64748b; font-weight: 800; text-transform: uppercase; }
        .track-stat-value { font-size: 20px; font-weight: 850; margin-top: 2px; color: #0f172a; }
        .track-stat-subtext { font-size: 12px; color: #64748b; margin-top: 3px; font-weight: 700; }
        .track-card { padding: 20px; }
        .track-card-head { display: flex; justify-content: space-between; gap: 14px; align-items: flex-start; margin-bottom: 18px; }
        .track-card-head.compact { margin-bottom: 12px; }
        .track-card-head h2 { margin: 0; font-size: 19px; font-weight: 850; display: flex; align-items: center; gap: 8px; }
        .track-card-head p { margin: 4px 0 0; color: #64748b; font-weight: 600; }
        .track-progress-block { padding: 15px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 16px; font-size: 13px; font-weight: 800; color: #334155; }
        .track-progress-block .progress { height: 10px; margin-top: 10px; }
        .track-info-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
        .track-info-grid div, .track-detail-list div { padding: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; min-width: 0; }
        .track-info-grid span, .track-detail-list span, .track-nextdue span { display: block; font-size: 12px; color: #64748b; font-weight: 800; text-transform: uppercase; }
        .track-info-grid strong, .track-detail-list strong { display: block; margin-top: 4px; color: #0f172a; overflow-wrap: anywhere; }
        .track-nextdue { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
        .track-nextdue div { padding: 18px; border-radius: 12px; background: #ecfeff; border: 1px solid #a5f3fc; }
        .track-nextdue strong { display: block; margin-top: 8px; font-size: 20px; }
        .track-complete { min-height: 132px; display: grid; place-items: center; text-align: center; color: #64748b; }
        .track-complete svg { color: #059669; }
        .track-complete strong { color: #0f172a; }
        .track-mini-stats { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 16px; }
        .track-mini-stats span { display: inline-flex; align-items: center; gap: 6px; padding: 8px 10px; border-radius: 999px; background: #f8fafc; border: 1px solid #e2e8f0; font-size: 12px; font-weight: 800; color: #334155; }
        .track-detail-list { display: grid; gap: 10px; }
        .track-actions { display: grid; gap: 10px; }
        .track-actions .btn, .track-card-head .btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; font-weight: 800; }
        .track-table thead th { background: #f8fafc; color: #475569; font-size: 12px; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; white-space: nowrap; }
        .track-table td { vertical-align: middle; color: #334155; font-weight: 600; }
        .track-table .badge { display: inline-flex; align-items: center; gap: 5px; }
        .track-ref { max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        @media (max-width: 768px) {
          .track-header { flex-direction: column; padding: 22px; }
          .track-header h1 { font-size: 25px; }
          .track-info-grid, .track-nextdue { grid-template-columns: 1fr; }
          .track-card { padding: 16px; }
        }
      `}</style>
    </div>
  );
};

export default TrackLoan;
