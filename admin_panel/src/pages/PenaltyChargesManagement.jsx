import { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, InputGroup, Modal, Row, Spinner, Table } from 'react-bootstrap';
import { AlertTriangle, Plus, RefreshCw, Search } from 'lucide-react';
import api from '../api/axios';

const unwrap = (res) => res?.data?.data || res?.data || {};
const money = (value) => `Rs. ${Number(value || 0).toLocaleString('en-IN')}`;
const date = (value) => (value ? new Date(value).toLocaleDateString('en-IN') : 'N/A');
const today = () => new Date().toISOString().slice(0, 10);

export default function PenaltyChargesManagement() {
  const [penalties, setPenalties] = useState([]);
  const [stats, setStats] = useState({});
  const [loans, setLoans] = useState([]);
  const [filters, setFilters] = useState({ search: '', status: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [selectedPenalty, setSelectedPenalty] = useState(null);
  const [form, setForm] = useState({ loanId: '', installmentNo: '', amount: '', reason: 'Late EMI payment', dueDate: today() });

  const load = async () => {
    try {
      setLoading(true); setError('');
      const [penaltyRes, loansRes] = await Promise.all([api.get('/admin/emi-control/penalties'), api.get('/admin/loans?status=DISBURSED')]);
      const pData = unwrap(penaltyRes);
      setPenalties(pData.penalties || []);
      setStats(pData.statistics || {});
      setLoans(unwrap(loansRes).items || []);
    } catch (err) { setError(err.response?.data?.message || err.message || 'Penalty data load nahi ho paya'); setPenalties([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => penalties.filter((p) => {
    if (filters.status && p.status !== filters.status) return false;
    const q = filters.search.trim().toLowerCase();
    return !q || p.loanId?.toLowerCase().includes(q) || p.userName?.toLowerCase().includes(q) || p.userEmail?.toLowerCase().includes(q);
  }), [penalties, filters]);

  const selectedLoan = loans.find((loan) => loan._id === form.loanId);
  const pendingEmis = selectedLoan?.schedule?.filter((emi) => !emi.paid) || [];

  const addPenalty = async () => {
    if (!form.loanId || !form.installmentNo || Number(form.amount) <= 0) return setError('Loan, EMI aur valid amount required hai');
    try {
      setSaving(true); setError('');
      await api.post(`/admin/emi-control/penalty/${form.loanId}/${form.installmentNo}`, { amount: Number(form.amount), reason: form.reason, dueDate: form.dueDate });
      setSuccess('Penalty added successfully');
      setShowAdd(false);
      setForm({ loanId: '', installmentNo: '', amount: '', reason: 'Late EMI payment', dueDate: today() });
      await load();
    } catch (err) { setError(err.response?.data?.message || err.message || 'Penalty add nahi ho paya'); }
    finally { setSaving(false); }
  };

  const updateStatus = async (status) => {
    if (!selectedPenalty) return;
    try {
      setSaving(true); setError('');
      await api.put(`/admin/emi-control/penalty/${selectedPenalty._id}/status`, { status });
      setSuccess(`Penalty marked ${status}`);
      setSelectedPenalty(null);
      await load();
    } catch (err) { setError(err.response?.data?.message || err.message || 'Penalty status update nahi ho paya'); }
    finally { setSaving(false); }
  };

  const badge = (status) => <Badge bg={status === 'PAID' ? 'success' : status === 'WAIVED' ? 'info' : 'warning'}>{status || 'PENDING'}</Badge>;

  return (
    <div className="emi-page">
      <div className="emi-head"><div><p>EMI Control</p><h2><AlertTriangle size={28} /> Penalty Charges Management</h2><span>Add, waive and track penalty charges on overdue EMIs.</span></div><div className="head-actions"><Button variant="outline-secondary" onClick={load}><RefreshCw size={16} /> Refresh</Button><Button variant="danger" onClick={() => setShowAdd(true)}><Plus size={16} /> Add Penalty</Button></div></div>
      {error && <Alert variant="warning" dismissible onClose={() => setError('')}>{error}</Alert>}{success && <Alert variant="success" dismissible onClose={() => setSuccess('')}>{success}</Alert>}
      <Row className="g-3 mb-3"><Col md={3}><Card className="emi-stat"><span>Total Penalties</span><strong>{stats.totalPenalties || 0}</strong></Card></Col><Col md={3}><Card className="emi-stat danger"><span>Total Amount</span><strong>{money(stats.totalPenaltyAmount)}</strong></Card></Col><Col md={3}><Card className="emi-stat"><span>Pending</span><strong>{stats.pendingPenalties || 0}</strong></Card></Col><Col md={3}><Card className="emi-stat success"><span>Paid/Waived</span><strong>{Number(stats.paidPenalties || 0) + Number(stats.waivedPenalties || 0)}</strong></Card></Col></Row>
      <Card className="emi-panel mb-3"><Row className="g-2"><Col md={8}><InputGroup><InputGroup.Text><Search size={16} /></InputGroup.Text><Form.Control placeholder="Search loan, user, email..." value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} /></InputGroup></Col><Col md={4}><Form.Select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}><option value="">All Status</option><option value="PENDING">Pending</option><option value="PAID">Paid</option><option value="WAIVED">Waived</option></Form.Select></Col></Row></Card>
      <Card className="emi-table-card"><Table responsive hover className="align-middle mb-0"><thead><tr><th>Loan</th><th>User</th><th>EMI</th><th>Amount</th><th>Reason</th><th>Due</th><th>Status</th><th className="text-end">Action</th></tr></thead><tbody>{loading ? <tr><td colSpan="8" className="text-center py-5"><Spinner animation="border" size="sm" /> Loading...</td></tr> : filtered.length === 0 ? <tr><td colSpan="8" className="text-center py-5">No penalties found.</td></tr> : filtered.map((p) => <tr key={p._id}><td><strong>{p.loanId}</strong></td><td>{p.userName}<small>{p.userEmail}</small></td><td>#{p.installmentNo}</td><td className="fw-bold text-danger">{money(p.amount)}</td><td>{p.reason || 'Late payment'}</td><td>{date(p.dueDate)}</td><td>{badge(p.status)}</td><td className="text-end"><Button size="sm" variant="outline-primary" onClick={() => setSelectedPenalty(p)}>Update</Button></td></tr>)}</tbody></Table></Card>
      <Modal show={showAdd} onHide={() => setShowAdd(false)}><Modal.Header closeButton><Modal.Title>Add Penalty</Modal.Title></Modal.Header><Modal.Body><Form.Group className="mb-3"><Form.Label>Loan</Form.Label><Form.Select value={form.loanId} onChange={(e) => setForm({ ...form, loanId: e.target.value, installmentNo: '' })}><option value="">Select loan</option>{loans.map((loan) => <option key={loan._id} value={loan._id}>{loan.loanAccountNumber} - {loan.userId?.name || loan.application?.personal?.name || 'N/A'}</option>)}</Form.Select></Form.Group><Form.Group className="mb-3"><Form.Label>Pending EMI</Form.Label><Form.Select value={form.installmentNo} onChange={(e) => setForm({ ...form, installmentNo: e.target.value })}><option value="">Select EMI</option>{pendingEmis.map((emi) => <option key={emi.installmentNo} value={emi.installmentNo}>EMI #{emi.installmentNo} - {date(emi.dueDate)} - {money(emi.total)}</option>)}</Form.Select></Form.Group><Form.Group className="mb-3"><Form.Label>Amount</Form.Label><Form.Control type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Form.Group><Form.Group className="mb-3"><Form.Label>Due Date</Form.Label><Form.Control type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></Form.Group><Form.Group><Form.Label>Reason</Form.Label><Form.Control as="textarea" rows={3} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></Form.Group></Modal.Body><Modal.Footer><Button variant="outline-secondary" onClick={() => setShowAdd(false)}>Cancel</Button><Button disabled={saving} onClick={addPenalty}>{saving ? 'Saving...' : 'Add Penalty'}</Button></Modal.Footer></Modal>
      <Modal show={!!selectedPenalty} onHide={() => setSelectedPenalty(null)}><Modal.Header closeButton><Modal.Title>Update Penalty Status</Modal.Title></Modal.Header><Modal.Body>{selectedPenalty && <Alert variant="info">{selectedPenalty.loanId} - {money(selectedPenalty.amount)} - {selectedPenalty.status}</Alert>}</Modal.Body><Modal.Footer><Button variant="outline-secondary" onClick={() => setSelectedPenalty(null)}>Cancel</Button><Button variant="success" disabled={saving} onClick={() => updateStatus('PAID')}>Mark Paid</Button><Button variant="info" disabled={saving} onClick={() => updateStatus('WAIVED')}>Waive</Button><Button variant="warning" disabled={saving} onClick={() => updateStatus('PENDING')}>Pending</Button></Modal.Footer></Modal>
      <PageStyle />
    </div>
  );
}

const PageStyle = () => <style>{`.emi-page{padding:8px 0 24px;color:#111827}.emi-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:18px}.emi-head p{margin:0 0 4px;color:#0f766e;font-size:12px;font-weight:900;text-transform:uppercase}.emi-head h2{display:flex;gap:10px;align-items:center;margin:0;font-weight:850}.emi-head span,.emi-table-card td small{color:#64748b}.head-actions{display:flex;gap:8px;flex-wrap:wrap}.emi-head .btn,.emi-table-card .btn{display:inline-flex;align-items:center;gap:6px}.emi-stat,.emi-panel,.emi-table-card{border:1px solid #e5e7eb;border-radius:8px;box-shadow:0 10px 26px rgba(15,23,42,.06)}.emi-stat{padding:16px}.emi-stat span{display:block;color:#64748b;font-weight:800}.emi-stat strong{display:block;font-size:24px;margin:4px 0}.emi-stat.success strong{color:#047857}.emi-stat.danger strong{color:#b91c1c}.emi-panel{padding:16px}.emi-table-card{overflow:hidden}.emi-table-card thead th{background:#f8fafc;color:#475569;font-size:12px;text-transform:uppercase}.emi-table-card td small{display:block}@media(max-width:768px){.emi-head{flex-direction:column}}`}</style>;
