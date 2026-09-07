import { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, InputGroup, Modal, Row, Spinner, Table } from 'react-bootstrap';
import { CreditCard, RefreshCw, Search } from 'lucide-react';
import api from '../api/axios';

const unwrap = (res) => res?.data?.data || res?.data || {};
const money = (value) => `Rs. ${Number(value || 0).toLocaleString('en-IN')}`;
const date = (value) => (value ? new Date(value).toLocaleDateString('en-IN') : 'N/A');
const today = () => new Date().toISOString().slice(0, 10);

export default function ManualPaymentUpdate() {
  const [loans, setLoans] = useState([]);
  const [payments, setPayments] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ amount: '', paymentDate: today(), reference: '', notes: '' });

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      const [loansRes, paymentsRes] = await Promise.all([api.get('/admin/loans?status=DISBURSED'), api.get('/admin/payments')]);
      setLoans(unwrap(loansRes).items || []);
      setPayments(Array.isArray(unwrap(paymentsRes)) ? unwrap(paymentsRes) : unwrap(paymentsRes).items || []);
    } catch (err) {
      setLoans([]);
      setPayments([]);
      setError(err.response?.data?.message || err.message || 'Manual payment data load nahi ho paya');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const pendingRows = useMemo(() => loans.flatMap((loan) => (loan.schedule || []).filter((emi) => !emi.paid).map((emi) => ({ loan, emi }))).filter(({ loan }) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return loan.loanAccountNumber?.toLowerCase().includes(q) || loan.userId?.name?.toLowerCase().includes(q) || loan.application?.personal?.name?.toLowerCase().includes(q);
  }), [loans, query]);

  const stats = useMemo(() => ({
    pending: pendingRows.length,
    overdue: pendingRows.filter(({ emi }) => new Date(emi.dueDate) < new Date()).length,
    collected: payments.filter((p) => ['CONFIRMED', 'COMPLETED'].includes(p.status)).reduce((sum, p) => sum + Number(p.amount || 0), 0)
  }), [pendingRows, payments]);

  const open = (row) => {
    setSelected(row);
    setForm({ amount: row.emi.total || '', paymentDate: today(), reference: '', notes: `Manual payment for EMI ${row.emi.installmentNo}` });
  };

  const submit = async () => {
    if (!selected || Number(form.amount) <= 0) return setError('Valid amount required hai');
    try {
      setSaving(true);
      setError('');
      await api.post(`/admin/emi-control/manual-payment/${selected.loan._id}/${selected.emi.installmentNo}`, {
        amount: Number(form.amount),
        paymentDate: form.paymentDate,
        reference: form.reference,
        notes: form.notes
      });
      setSuccess('Manual payment recorded successfully');
      setSelected(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Payment record nahi ho paya');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="emi-page">
      <div className="emi-head"><div><p>EMI Control</p><h2><CreditCard size={28} /> Manual Payment Update</h2><span>Record offline/manual EMI repayments directly against loan schedule.</span></div><Button variant="outline-secondary" onClick={load}><RefreshCw size={16} /> Refresh</Button></div>
      {error && <Alert variant="warning" dismissible onClose={() => setError('')}>{error}</Alert>}{success && <Alert variant="success" dismissible onClose={() => setSuccess('')}>{success}</Alert>}
      <Row className="g-3 mb-3"><Col md={4}><Card className="emi-stat"><span>Pending EMIs</span><strong>{stats.pending}</strong></Card></Col><Col md={4}><Card className="emi-stat danger"><span>Overdue EMIs</span><strong>{stats.overdue}</strong></Card></Col><Col md={4}><Card className="emi-stat success"><span>Total Collected</span><strong>{money(stats.collected)}</strong></Card></Col></Row>
      <Card className="emi-panel mb-3"><InputGroup><InputGroup.Text><Search size={16} /></InputGroup.Text><Form.Control placeholder="Search loan or borrower..." value={query} onChange={(e) => setQuery(e.target.value)} /></InputGroup></Card>
      <Card className="emi-table-card"><Table responsive hover className="align-middle mb-0"><thead><tr><th>Loan</th><th>Borrower</th><th>EMI</th><th>Due Date</th><th>Amount</th><th>Status</th><th className="text-end">Action</th></tr></thead><tbody>{loading ? <tr><td colSpan="7" className="text-center py-5"><Spinner animation="border" size="sm" /> Loading...</td></tr> : pendingRows.length === 0 ? <tr><td colSpan="7" className="text-center py-5">No pending EMIs found.</td></tr> : pendingRows.map((row) => <tr key={`${row.loan._id}-${row.emi.installmentNo}`}><td><strong>{row.loan.loanAccountNumber}</strong></td><td>{row.loan.userId?.name || row.loan.application?.personal?.name || 'N/A'}<small>{row.loan.userId?.email}</small></td><td>#{row.emi.installmentNo}</td><td>{date(row.emi.dueDate)}</td><td>{money(row.emi.total)}</td><td><Badge bg={new Date(row.emi.dueDate) < new Date() ? 'danger' : 'warning'}>{new Date(row.emi.dueDate) < new Date() ? 'Overdue' : 'Pending'}</Badge></td><td className="text-end"><Button size="sm" onClick={() => open(row)}>Record Payment</Button></td></tr>)}</tbody></Table></Card>
      <Modal show={!!selected} onHide={() => setSelected(null)}><Modal.Header closeButton><Modal.Title>Record Manual Payment</Modal.Title></Modal.Header><Modal.Body>{selected && <><Alert variant="info">{selected.loan.loanAccountNumber} - EMI #{selected.emi.installmentNo} - {money(selected.emi.total)}</Alert><Form.Group className="mb-3"><Form.Label>Amount</Form.Label><Form.Control type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Form.Group><Form.Group className="mb-3"><Form.Label>Payment Date</Form.Label><Form.Control type="date" value={form.paymentDate} onChange={(e) => setForm({ ...form, paymentDate: e.target.value })} /></Form.Group><Form.Group className="mb-3"><Form.Label>Reference</Form.Label><Form.Control value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} /></Form.Group><Form.Group><Form.Label>Notes</Form.Label><Form.Control as="textarea" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Form.Group></>}</Modal.Body><Modal.Footer><Button variant="outline-secondary" onClick={() => setSelected(null)}>Cancel</Button><Button disabled={saving} onClick={submit}>{saving ? 'Saving...' : 'Save Payment'}</Button></Modal.Footer></Modal>
      <PageStyle />
    </div>
  );
}

const PageStyle = () => <style>{`.emi-page{padding:8px 0 24px;color:#111827}.emi-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:18px}.emi-head p{margin:0 0 4px;color:#0f766e;font-size:12px;font-weight:900;text-transform:uppercase}.emi-head h2{display:flex;gap:10px;align-items:center;margin:0;font-weight:850}.emi-head span,.emi-table-card td small{color:#64748b}.emi-head .btn,.emi-table-card .btn{display:inline-flex;align-items:center;gap:6px}.emi-stat,.emi-panel,.emi-table-card{border:1px solid #e5e7eb;border-radius:8px;box-shadow:0 10px 26px rgba(15,23,42,.06)}.emi-stat{padding:16px}.emi-stat span{display:block;color:#64748b;font-weight:800}.emi-stat strong{display:block;font-size:24px;margin:4px 0}.emi-stat.success strong{color:#047857}.emi-stat.danger strong{color:#b91c1c}.emi-panel{padding:16px}.emi-table-card{overflow:hidden}.emi-table-card thead th{background:#f8fafc;color:#475569;font-size:12px;text-transform:uppercase}.emi-table-card td small{display:block}@media(max-width:768px){.emi-head{flex-direction:column}}`}</style>;
