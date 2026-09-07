import { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, InputGroup, Modal, Row, Spinner, Table } from 'react-bootstrap';
import { RefreshCw, Search, Split } from 'lucide-react';
import api from '../api/axios';

const unwrap = (res) => res?.data?.data || res?.data || {};
const money = (value) => `Rs. ${Number(value || 0).toLocaleString('en-IN')}`;
const date = (value) => (value ? new Date(value).toLocaleDateString('en-IN') : 'N/A');
const today = () => new Date().toISOString().slice(0, 10);
const paidPart = (emi) => (emi.partPayments || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);

export default function PartPaymentSupport() {
  const [loans, setLoans] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ amount: '', paymentDate: today(), reference: '', notes: '' });

  const load = async () => {
    try {
      setLoading(true); setError('');
      const res = await api.get('/admin/loans?status=DISBURSED');
      setLoans(unwrap(res).items || []);
    } catch (err) {
      setLoans([]); setError(err.response?.data?.message || err.message || 'Loans load nahi ho paaye');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const rows = useMemo(() => loans.flatMap((loan) => (loan.schedule || []).filter((emi) => !emi.paid).map((emi) => ({ loan, emi, remaining: Number(emi.total || 0) - paidPart(emi) }))).filter(({ loan }) => {
    const q = query.trim().toLowerCase();
    return !q || loan.loanAccountNumber?.toLowerCase().includes(q) || loan.userId?.name?.toLowerCase().includes(q) || loan.application?.personal?.name?.toLowerCase().includes(q);
  }), [loans, query]);

  const stats = useMemo(() => ({
    loans: loans.length,
    count: loans.reduce((sum, loan) => sum + (loan.schedule || []).reduce((s, emi) => s + (emi.partPayments?.length || 0), 0), 0),
    amount: loans.reduce((sum, loan) => sum + (loan.schedule || []).reduce((s, emi) => s + paidPart(emi), 0), 0)
  }), [loans]);

  const open = (row) => {
    setSelected(row);
    setForm({ amount: Math.max(0, row.remaining).toString(), paymentDate: today(), reference: '', notes: `Part payment for EMI ${row.emi.installmentNo}` });
  };

  const submit = async () => {
    if (!selected || Number(form.amount) <= 0) return setError('Valid amount required hai');
    if (Number(form.amount) > selected.remaining) return setError('Part payment remaining amount se zyada nahi ho sakta');
    try {
      setSaving(true); setError('');
      await api.post(`/admin/emi-control/part-payment/${selected.loan._id}/${selected.emi.installmentNo}`, { amount: Number(form.amount), paymentDate: form.paymentDate, reference: form.reference, notes: form.notes });
      setSuccess('Part payment recorded successfully');
      setSelected(null);
      await load();
    } catch (err) { setError(err.response?.data?.message || err.message || 'Part payment record nahi ho paya'); }
    finally { setSaving(false); }
  };

  return (
    <div className="emi-page">
      <div className="emi-head"><div><p>EMI Control</p><h2><Split size={28} /> Part Payment Support</h2><span>Record partial payments and automatically close EMI once fully paid.</span></div><Button variant="outline-secondary" onClick={load}><RefreshCw size={16} /> Refresh</Button></div>
      {error && <Alert variant="warning" dismissible onClose={() => setError('')}>{error}</Alert>}{success && <Alert variant="success" dismissible onClose={() => setSuccess('')}>{success}</Alert>}
      <Row className="g-3 mb-3"><Col md={4}><Card className="emi-stat"><span>Disbursed Loans</span><strong>{stats.loans}</strong></Card></Col><Col md={4}><Card className="emi-stat"><span>Part Payments</span><strong>{stats.count}</strong></Card></Col><Col md={4}><Card className="emi-stat success"><span>Part Amount</span><strong>{money(stats.amount)}</strong></Card></Col></Row>
      <Card className="emi-panel mb-3"><InputGroup><InputGroup.Text><Search size={16} /></InputGroup.Text><Form.Control placeholder="Search loan or borrower..." value={query} onChange={(e) => setQuery(e.target.value)} /></InputGroup></Card>
      <Card className="emi-table-card"><Table responsive hover className="align-middle mb-0"><thead><tr><th>Loan</th><th>Borrower</th><th>EMI</th><th>Total</th><th>Part Paid</th><th>Remaining</th><th>Due</th><th className="text-end">Action</th></tr></thead><tbody>{loading ? <tr><td colSpan="8" className="text-center py-5"><Spinner animation="border" size="sm" /> Loading...</td></tr> : rows.length === 0 ? <tr><td colSpan="8" className="text-center py-5">No pending EMIs found.</td></tr> : rows.map((row) => <tr key={`${row.loan._id}-${row.emi.installmentNo}`}><td><strong>{row.loan.loanAccountNumber}</strong></td><td>{row.loan.userId?.name || row.loan.application?.personal?.name || 'N/A'}<small>{row.loan.userId?.email}</small></td><td>#{row.emi.installmentNo}</td><td>{money(row.emi.total)}</td><td>{money(paidPart(row.emi))}</td><td className="fw-bold">{money(row.remaining)}</td><td>{date(row.emi.dueDate)}</td><td className="text-end"><Button size="sm" disabled={row.remaining <= 0} onClick={() => open(row)}>Add Part Payment</Button></td></tr>)}</tbody></Table></Card>
      <Modal show={!!selected} onHide={() => setSelected(null)}><Modal.Header closeButton><Modal.Title>Add Part Payment</Modal.Title></Modal.Header><Modal.Body>{selected && <><Alert variant="info">{selected.loan.loanAccountNumber} - EMI #{selected.emi.installmentNo} - Remaining {money(selected.remaining)}</Alert>{selected.emi.partPayments?.length > 0 && <Table size="sm"><thead><tr><th>Date</th><th>Amount</th><th>Reference</th></tr></thead><tbody>{selected.emi.partPayments.map((p, i) => <tr key={i}><td>{date(p.paymentDate)}</td><td>{money(p.amount)}</td><td>{p.reference || '-'}</td></tr>)}</tbody></Table>}<Form.Group className="mb-3"><Form.Label>Amount</Form.Label><Form.Control type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Form.Group><Form.Group className="mb-3"><Form.Label>Payment Date</Form.Label><Form.Control type="date" value={form.paymentDate} onChange={(e) => setForm({ ...form, paymentDate: e.target.value })} /></Form.Group><Form.Group className="mb-3"><Form.Label>Reference</Form.Label><Form.Control value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} /></Form.Group><Form.Group><Form.Label>Notes</Form.Label><Form.Control as="textarea" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Form.Group></>}</Modal.Body><Modal.Footer><Button variant="outline-secondary" onClick={() => setSelected(null)}>Cancel</Button><Button disabled={saving} onClick={submit}>{saving ? 'Saving...' : 'Save Part Payment'}</Button></Modal.Footer></Modal>
      <PageStyle />
    </div>
  );
}

const PageStyle = () => <style>{`.emi-page{padding:8px 0 24px;color:#111827}.emi-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:18px}.emi-head p{margin:0 0 4px;color:#0f766e;font-size:12px;font-weight:900;text-transform:uppercase}.emi-head h2{display:flex;gap:10px;align-items:center;margin:0;font-weight:850}.emi-head span,.emi-table-card td small{color:#64748b}.emi-head .btn,.emi-table-card .btn{display:inline-flex;align-items:center;gap:6px}.emi-stat,.emi-panel,.emi-table-card{border:1px solid #e5e7eb;border-radius:8px;box-shadow:0 10px 26px rgba(15,23,42,.06)}.emi-stat{padding:16px}.emi-stat span{display:block;color:#64748b;font-weight:800}.emi-stat strong{display:block;font-size:24px;margin:4px 0}.emi-stat.success strong{color:#047857}.emi-panel{padding:16px}.emi-table-card{overflow:hidden}.emi-table-card thead th{background:#f8fafc;color:#475569;font-size:12px;text-transform:uppercase}.emi-table-card td small{display:block}@media(max-width:768px){.emi-head{flex-direction:column}}`}</style>;
