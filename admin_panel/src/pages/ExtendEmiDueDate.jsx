import { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, InputGroup, Modal, Row, Spinner, Table } from 'react-bootstrap';
import { CalendarPlus, RefreshCw, Search } from 'lucide-react';
import api from '../api/axios';

const unwrap = (res) => res?.data?.data || res?.data || {};
const money = (value) => `Rs. ${Number(value || 0).toLocaleString('en-IN')}`;
const date = (value) => (value ? new Date(value).toLocaleDateString('en-IN') : 'N/A');

export default function ExtendEmiDueDate() {
  const [extensions, setExtensions] = useState([]);
  const [stats, setStats] = useState({});
  const [loans, setLoans] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ newDueDate: '', reason: '', notes: '', approvedBy: 'Admin' });

  const load = async () => {
    try {
      setLoading(true); setError('');
      const [extRes, loansRes] = await Promise.all([api.get('/admin/emi-control/extensions'), api.get('/admin/loans?status=DISBURSED')]);
      const extData = unwrap(extRes);
      setExtensions(extData.extensions || []);
      setStats(extData.statistics || {});
      setLoans(unwrap(loansRes).items || []);
    } catch (err) { setError(err.response?.data?.message || err.message || 'Extension data load nahi ho paya'); setExtensions([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const pendingRows = useMemo(() => loans.flatMap((loan) => (loan.schedule || []).filter((emi) => !emi.paid).map((emi) => ({ loan, emi }))).filter(({ loan }) => {
    const q = query.trim().toLowerCase();
    return !q || loan.loanAccountNumber?.toLowerCase().includes(q) || loan.userId?.name?.toLowerCase().includes(q) || loan.application?.personal?.name?.toLowerCase().includes(q);
  }), [loans, query]);

  const open = (row) => {
    const current = new Date(row.emi.dueDate || Date.now());
    current.setDate(current.getDate() + 7);
    setSelected(row);
    setForm({ newDueDate: current.toISOString().slice(0, 10), reason: 'Customer requested due date extension', notes: '', approvedBy: 'Admin' });
  };

  const submit = async () => {
    if (!selected || !form.newDueDate || !form.reason.trim()) return setError('New due date aur reason required hai');
    if (new Date(form.newDueDate) <= new Date(selected.emi.dueDate)) return setError('New due date current due date ke baad hona chahiye');
    try {
      setSaving(true); setError('');
      await api.post(`/admin/emi-control/extend-due-date/${selected.loan._id}/${selected.emi.installmentNo}`, form);
      setSuccess('Due date extended successfully');
      setSelected(null);
      await load();
    } catch (err) { setError(err.response?.data?.message || err.message || 'Due date extend nahi ho paya'); }
    finally { setSaving(false); }
  };

  return (
    <div className="emi-page">
      <div className="emi-head"><div><p>EMI Control</p><h2><CalendarPlus size={28} /> Extend EMI / Due Date</h2><span>Approve due date extensions and keep a complete extension history.</span></div><Button variant="outline-secondary" onClick={load}><RefreshCw size={16} /> Refresh</Button></div>
      {error && <Alert variant="warning" dismissible onClose={() => setError('')}>{error}</Alert>}{success && <Alert variant="success" dismissible onClose={() => setSuccess('')}>{success}</Alert>}
      <Row className="g-3 mb-3"><Col md={3}><Card className="emi-stat"><span>Total Extensions</span><strong>{stats.totalExtensions || 0}</strong></Card></Col><Col md={3}><Card className="emi-stat success"><span>Approved</span><strong>{stats.approvedExtensions || 0}</strong></Card></Col><Col md={3}><Card className="emi-stat"><span>Pending EMIs</span><strong>{pendingRows.length}</strong></Card></Col><Col md={3}><Card className="emi-stat"><span>Extension Rate</span><strong>{stats.extensionRate || 0}%</strong></Card></Col></Row>
      <Card className="emi-panel mb-3"><InputGroup><InputGroup.Text><Search size={16} /></InputGroup.Text><Form.Control placeholder="Search loan or borrower..." value={query} onChange={(e) => setQuery(e.target.value)} /></InputGroup></Card>
      <Row className="g-3">
        <Col xl={7}><Card className="emi-table-card"><div className="table-title">Pending EMIs</div><Table responsive hover className="align-middle mb-0"><thead><tr><th>Loan</th><th>Borrower</th><th>EMI</th><th>Current Due</th><th>Amount</th><th className="text-end">Action</th></tr></thead><tbody>{loading ? <tr><td colSpan="6" className="text-center py-5"><Spinner animation="border" size="sm" /> Loading...</td></tr> : pendingRows.length === 0 ? <tr><td colSpan="6" className="text-center py-5">No pending EMIs found.</td></tr> : pendingRows.map((row) => <tr key={`${row.loan._id}-${row.emi.installmentNo}`}><td><strong>{row.loan.loanAccountNumber}</strong></td><td>{row.loan.userId?.name || row.loan.application?.personal?.name || 'N/A'}<small>{row.loan.userId?.email}</small></td><td>#{row.emi.installmentNo}</td><td>{date(row.emi.dueDate)}</td><td>{money(row.emi.total)}</td><td className="text-end"><Button size="sm" onClick={() => open(row)}>Extend</Button></td></tr>)}</tbody></Table></Card></Col>
        <Col xl={5}><Card className="emi-table-card"><div className="table-title">Extension History</div><Table responsive hover className="align-middle mb-0"><thead><tr><th>Loan</th><th>EMI</th><th>Old</th><th>New</th><th>By</th></tr></thead><tbody>{extensions.length === 0 ? <tr><td colSpan="5" className="text-center py-5">No history.</td></tr> : extensions.map((ext, i) => <tr key={ext._id || i}><td><strong>{ext.loanAccountNumber || ext.loanId}</strong><small>{ext.userName}</small></td><td>#{ext.installmentNo}</td><td><Badge bg="danger">{date(ext.originalDueDate)}</Badge></td><td><Badge bg="success">{date(ext.newDueDate)}</Badge></td><td>{ext.approvedBy || 'Admin'}</td></tr>)}</tbody></Table></Card></Col>
      </Row>
      <Modal show={!!selected} onHide={() => setSelected(null)}><Modal.Header closeButton><Modal.Title>Extend Due Date</Modal.Title></Modal.Header><Modal.Body>{selected && <><Alert variant="info">{selected.loan.loanAccountNumber} - EMI #{selected.emi.installmentNo} - Current {date(selected.emi.dueDate)}</Alert><Form.Group className="mb-3"><Form.Label>New Due Date</Form.Label><Form.Control type="date" value={form.newDueDate} onChange={(e) => setForm({ ...form, newDueDate: e.target.value })} /></Form.Group><Form.Group className="mb-3"><Form.Label>Approved By</Form.Label><Form.Control value={form.approvedBy} onChange={(e) => setForm({ ...form, approvedBy: e.target.value })} /></Form.Group><Form.Group className="mb-3"><Form.Label>Reason</Form.Label><Form.Control value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></Form.Group><Form.Group><Form.Label>Notes</Form.Label><Form.Control as="textarea" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Form.Group></>}</Modal.Body><Modal.Footer><Button variant="outline-secondary" onClick={() => setSelected(null)}>Cancel</Button><Button disabled={saving} onClick={submit}>{saving ? 'Saving...' : 'Extend Due Date'}</Button></Modal.Footer></Modal>
      <PageStyle />
    </div>
  );
}

const PageStyle = () => <style>{`.emi-page{padding:8px 0 24px;color:#111827}.emi-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:18px}.emi-head p{margin:0 0 4px;color:#0f766e;font-size:12px;font-weight:900;text-transform:uppercase}.emi-head h2{display:flex;gap:10px;align-items:center;margin:0;font-weight:850}.emi-head span,.emi-table-card td small{color:#64748b}.emi-head .btn,.emi-table-card .btn{display:inline-flex;align-items:center;gap:6px}.emi-stat,.emi-panel,.emi-table-card{border:1px solid #e5e7eb;border-radius:8px;box-shadow:0 10px 26px rgba(15,23,42,.06)}.emi-stat{padding:16px}.emi-stat span{display:block;color:#64748b;font-weight:800}.emi-stat strong{display:block;font-size:24px;margin:4px 0}.emi-stat.success strong{color:#047857}.emi-panel{padding:16px}.emi-table-card{overflow:hidden}.emi-table-card thead th{background:#f8fafc;color:#475569;font-size:12px;text-transform:uppercase}.emi-table-card td small{display:block}.table-title{font-weight:850;padding:14px 16px;border-bottom:1px solid #e5e7eb}@media(max-width:768px){.emi-head{flex-direction:column}}`}</style>;
