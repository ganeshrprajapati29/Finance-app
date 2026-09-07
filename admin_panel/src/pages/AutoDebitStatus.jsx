import { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, InputGroup, Modal, ProgressBar, Row, Spinner, Table } from 'react-bootstrap';
import { Eye, RefreshCw, Search, ToggleLeft, Wallet } from 'lucide-react';
import api from '../api/axios';

const unwrap = (res) => res?.data?.data || res?.data || {};
const money = (value) => `Rs. ${Number(value || 0).toLocaleString('en-IN')}`;
const date = (value) => (value ? new Date(value).toLocaleDateString('en-IN') : 'N/A');

export default function AutoDebitStatus() {
  const [loans, setLoans] = useState([]);
  const [stats, setStats] = useState({});
  const [filters, setFilters] = useState({ search: '', status: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [confirmLoan, setConfirmLoan] = useState(null);

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/admin/emi-control/auto-debit');
      const data = unwrap(res);
      setLoans(Array.isArray(data.loans) ? data.loans : []);
      setStats(data.statistics || {});
    } catch (err) {
      setLoans([]);
      setStats({});
      setError(err.response?.data?.message || err.message || 'Auto debit data load nahi ho paya');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return loans.filter((loan) => {
      if (filters.status === 'enabled' && !loan.autoDebit?.enabled) return false;
      if (filters.status === 'disabled' && loan.autoDebit?.enabled) return false;
      if (!q) return true;
      return loan.loanAccountNumber?.toLowerCase().includes(q) || loan.userId?.name?.toLowerCase().includes(q) || loan.userId?.email?.toLowerCase().includes(q) || loan.application?.personal?.name?.toLowerCase().includes(q);
    });
  }, [loans, filters]);

  const scheduleStats = (loan) => {
    const schedule = loan.schedule || [];
    const paid = schedule.filter((item) => item.paid).length;
    const pending = schedule.length - paid;
    const next = schedule.find((item) => !item.paid);
    return { paid, pending, total: schedule.length, next, percent: schedule.length ? Math.round((paid / schedule.length) * 100) : 0 };
  };

  const toggle = async () => {
    if (!confirmLoan) return;
    try {
      setSaving(true);
      await api.post(`/admin/emi-control/auto-debit/${confirmLoan._id}/toggle`, { enabled: !confirmLoan.autoDebit?.enabled });
      setConfirmLoan(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Auto debit update nahi ho paya');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="emi-page">
      <div className="emi-head">
        <div><p>EMI Control</p><h2><Wallet size={28} /> Auto Debit Status</h2><span>Monitor and toggle auto debit mandate status for disbursed loans.</span></div>
        <Button variant="outline-secondary" onClick={load}><RefreshCw size={16} /> Refresh</Button>
      </div>
      {error && <Alert variant="warning" dismissible onClose={() => setError('')}>{error}</Alert>}
      <Row className="g-3 mb-3">
        <Col md={3}><Card className="emi-stat"><span>Total Loans</span><strong>{stats.totalLoans || loans.length}</strong><small>Disbursed loans</small></Card></Col>
        <Col md={3}><Card className="emi-stat success"><span>Enabled</span><strong>{stats.autoDebitEnabled || 0}</strong><small>Auto debit active</small></Card></Col>
        <Col md={3}><Card className="emi-stat danger"><span>Disabled</span><strong>{stats.autoDebitDisabled || 0}</strong><small>Manual collection</small></Card></Col>
        <Col md={3}><Card className="emi-stat"><span>Coverage</span><strong>{stats.autoDebitCoverage || 0}%</strong><ProgressBar now={stats.autoDebitCoverage || 0} /></Card></Col>
      </Row>
      <Card className="emi-panel mb-3"><Row className="g-2"><Col md={8}><InputGroup><InputGroup.Text><Search size={16} /></InputGroup.Text><Form.Control placeholder="Search loan, user, email..." value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} /></InputGroup></Col><Col md={4}><Form.Select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}><option value="">All Status</option><option value="enabled">Enabled</option><option value="disabled">Disabled</option></Form.Select></Col></Row></Card>
      <Card className="emi-table-card"><Table responsive hover className="align-middle mb-0"><thead><tr><th>Loan</th><th>User</th><th>Amount</th><th>EMI Progress</th><th>Auto Debit</th><th>Next Due</th><th className="text-end">Action</th></tr></thead><tbody>{loading ? <tr><td colSpan="7" className="text-center py-5"><Spinner animation="border" size="sm" /> Loading...</td></tr> : filtered.length === 0 ? <tr><td colSpan="7" className="text-center py-5">No loans found.</td></tr> : filtered.map((loan) => { const s = scheduleStats(loan); return <tr key={loan._id}><td><strong>{loan.loanAccountNumber || 'N/A'}</strong><small>{loan._id?.slice(-8)}</small></td><td>{loan.userId?.name || loan.application?.personal?.name || 'N/A'}<small>{loan.userId?.email}</small></td><td>{money(loan.decision?.amountApproved)}</td><td><ProgressBar now={s.percent} label={`${s.paid}/${s.total}`} /></td><td><Badge bg={loan.autoDebit?.enabled ? 'success' : 'danger'}>{loan.autoDebit?.enabled ? 'Enabled' : 'Disabled'}</Badge></td><td>{date(s.next?.dueDate)}</td><td className="text-end"><Button size="sm" variant="outline-primary" onClick={() => setSelected(loan)}><Eye size={14} /></Button> <Button size="sm" variant={loan.autoDebit?.enabled ? 'outline-danger' : 'outline-success'} onClick={() => setConfirmLoan(loan)}><ToggleLeft size={14} /> Toggle</Button></td></tr>; })}</tbody></Table></Card>
      <Modal show={!!selected} onHide={() => setSelected(null)} size="lg"><Modal.Header closeButton><Modal.Title>Loan EMI Detail</Modal.Title></Modal.Header><Modal.Body>{selected && <Table responsive size="sm"><thead><tr><th>EMI</th><th>Due Date</th><th>Amount</th><th>Status</th></tr></thead><tbody>{(selected.schedule || []).map((item) => <tr key={item.installmentNo}><td>{item.installmentNo}</td><td>{date(item.dueDate)}</td><td>{money(item.total)}</td><td><Badge bg={item.paid ? 'success' : 'warning'}>{item.paid ? 'Paid' : 'Pending'}</Badge></td></tr>)}</tbody></Table>}</Modal.Body></Modal>
      <Modal show={!!confirmLoan} onHide={() => setConfirmLoan(null)}><Modal.Header closeButton><Modal.Title>Confirm Auto Debit</Modal.Title></Modal.Header><Modal.Body>{confirmLoan && `Auto debit ${confirmLoan.autoDebit?.enabled ? 'disable' : 'enable'} karna hai for ${confirmLoan.loanAccountNumber}?`}</Modal.Body><Modal.Footer><Button variant="outline-secondary" onClick={() => setConfirmLoan(null)}>Cancel</Button><Button disabled={saving} onClick={toggle}>{saving ? 'Updating...' : 'Confirm'}</Button></Modal.Footer></Modal>
      <PageStyle />
    </div>
  );
}

const PageStyle = () => <style>{`.emi-page{padding:8px 0 24px;color:#111827}.emi-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:18px}.emi-head p{margin:0 0 4px;color:#0f766e;font-size:12px;font-weight:900;text-transform:uppercase}.emi-head h2{display:flex;gap:10px;align-items:center;margin:0;font-weight:850}.emi-head span,.emi-table-card td small{color:#64748b}.emi-head .btn,.emi-table-card .btn{display:inline-flex;align-items:center;gap:6px}.emi-stat,.emi-panel,.emi-table-card{border:1px solid #e5e7eb;border-radius:8px;box-shadow:0 10px 26px rgba(15,23,42,.06)}.emi-stat{padding:16px}.emi-stat span,.emi-stat small{display:block;color:#64748b;font-weight:800}.emi-stat strong{display:block;font-size:24px;margin:4px 0}.emi-stat.success strong{color:#047857}.emi-stat.danger strong{color:#b91c1c}.emi-panel{padding:16px}.emi-table-card{overflow:hidden}.emi-table-card thead th{background:#f8fafc;color:#475569;font-size:12px;text-transform:uppercase}.emi-table-card td small{display:block}@media(max-width:768px){.emi-head{flex-direction:column}}`}</style>;
