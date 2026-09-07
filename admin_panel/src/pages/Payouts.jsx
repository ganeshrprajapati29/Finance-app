import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Col, Form, InputGroup, ListGroup, Modal, Row, Table } from 'react-bootstrap';
import { CheckCircle2, Download, Eye, Plus, RefreshCw, Search, Wallet, XCircle } from 'lucide-react';
import api from '../api/axios';

const statuses = ['pending', 'processing', 'processed', 'failed', 'cancelled'];
const modes = ['UPI', 'IMPS', 'NEFT', 'RTGS'];
const formatCurrency = (amount) => `Rs. ${Number(amount || 0).toLocaleString('en-IN')}`;
const formatDateTime = (date) => date ? new Date(date).toLocaleString('en-IN') : 'N/A';
const statusTone = (status) => ({ pending: 'warning', processing: 'info', processed: 'success', failed: 'danger', cancelled: 'secondary' }[status] || 'secondary');

const downloadCsv = (rows, filename) => {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(','), ...rows.map((row) => headers.map((header) => `"${String(row[header] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const StatCard = ({ icon: Icon, label, value, tone }) => (
  <div className={`po-stat po-stat-${tone}`}><div className="po-stat-icon"><Icon size={20} /></div><div><span>{label}</span><strong>{value}</strong></div></div>
);

const defaultForm = { userId: '', userText: '', amount: '', mode: 'UPI', accountNumber: '', ifsc: '', name: '', vpa: '', notes: '' };

const Payouts = () => {
  const [payouts, setPayouts] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [detail, setDetail] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });
  const [filters, setFilters] = useState({ status: 'ALL', search: '' });
  const [form, setForm] = useState(defaultForm);

  const fetchPayouts = async () => {
    try {
      setLoading(true);
      setError('');
      const query = new URLSearchParams({ page: pagination.page, limit: pagination.limit, status: filters.status === 'ALL' ? 'ALL' : filters.status });
      const res = await api.get(`/admin/payouts?${query}`);
      const data = res.data?.data || {};
      setPayouts(data.items || []);
      setPagination((current) => ({ ...current, total: data.total || 0, pages: Math.max(1, Math.ceil((data.total || 0) / current.limit)) }));
    } catch (err) {
      setError(err.response?.data?.message || 'Payouts load nahi ho paaye.');
      setPayouts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPayouts(); }, [pagination.page, pagination.limit, filters.status]);

  const searchUsers = async (term) => {
    setForm((current) => ({ ...current, userText: term }));
    if (term.trim().length < 2) return setUsers([]);
    try {
      const res = await api.get(`/admin/users/search?q=${encodeURIComponent(term.trim())}`);
      setUsers(res.data?.data || []);
    } catch {
      setUsers([]);
    }
  };

  const filtered = useMemo(() => {
    const term = filters.search.trim().toLowerCase();
    if (!term) return payouts;
    return payouts.filter((item) => [item.userId?.name, item.userId?.email, item.userId?.mobile, item.razorpayPayoutId, item._id, item.reference].some((value) => String(value || '').toLowerCase().includes(term)));
  }, [filters.search, payouts]);

  const stats = useMemo(() => ({
    total: pagination.total || payouts.length,
    amount: payouts.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    pending: payouts.filter((item) => item.status === 'pending').length,
    processed: payouts.filter((item) => item.status === 'processed').length,
    failed: payouts.filter((item) => item.status === 'failed' || item.status === 'cancelled').length
  }), [pagination.total, payouts]);

  const createPayout = async () => {
    if (!form.userId || !form.amount || !form.name) return;
    try {
      setProcessing(true);
      setError('');
      await api.post('/admin/payouts', {
        userId: form.userId,
        amount: Number(form.amount),
        mode: form.mode,
        accountDetails: { accountNumber: form.accountNumber || 'UPI', ifsc: form.ifsc || 'UPI0000000', name: form.name, vpa: form.vpa },
        description: form.notes,
        notes: form.notes
      });
      setSuccess('Payout create ho gaya.');
      setShowCreate(false);
      setForm(defaultForm);
      setUsers([]);
      fetchPayouts();
    } catch (err) {
      setError(err.response?.data?.message || 'Payout create nahi ho paaya.');
    } finally {
      setProcessing(false);
    }
  };

  const updateStatus = async (payout, status) => {
    try {
      setProcessing(true);
      await api.put(`/admin/payouts/${payout._id}/status`, { status });
      setSuccess(`Payout ${status} mark ho gaya.`);
      fetchPayouts();
    } catch (err) {
      setError(err.response?.data?.message || 'Payout status update nahi ho paaya.');
    } finally {
      setProcessing(false);
    }
  };

  const deletePayout = async (payout) => {
    try {
      setProcessing(true);
      await api.delete(`/admin/payouts/${payout._id}`);
      setSuccess('Payout delete ho gaya.');
      fetchPayouts();
    } catch (err) {
      setError(err.response?.data?.message || 'Payout delete nahi ho paaya.');
    } finally {
      setProcessing(false);
    }
  };

  const exportRows = () => downloadCsv(filtered.map((item) => ({
    id: item._id,
    payoutId: item.razorpayPayoutId || '',
    user: item.userId?.name || '',
    email: item.userId?.email || '',
    amount: item.amount || 0,
    mode: item.mode || '',
    status: item.status || '',
    fees: item.fees || 0,
    tax: item.tax || 0,
    processedAt: formatDateTime(item.processedAt)
  })), 'payouts.csv');

  return (
    <div className="po-page">
      <div className="po-header"><div><div className="po-eyebrow">Payments</div><h1>Payouts</h1><p>Create and monitor customer payouts, transfer status, bank details and processing outcomes.</p></div><div className="po-actions"><Button variant="light" onClick={() => setShowCreate(true)}><Plus size={16} /> Create</Button><Button variant="outline-light" onClick={fetchPayouts}><RefreshCw size={16} /> Refresh</Button><Button variant="outline-light" onClick={exportRows} disabled={!filtered.length}><Download size={16} /> Export</Button></div></div>
      {error && <Alert variant="danger" className="mt-3" dismissible onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert variant="success" className="mt-3" dismissible onClose={() => setSuccess('')}>{success}</Alert>}
      <Row className="g-3 mt-1"><Col md={3}><StatCard icon={Wallet} label="Total" value={stats.total} tone="blue" /></Col><Col md={3}><StatCard icon={Wallet} label="Amount" value={formatCurrency(stats.amount)} tone="amber" /></Col><Col md={2}><StatCard icon={RefreshCw} label="Pending" value={stats.pending} tone="purple" /></Col><Col md={2}><StatCard icon={CheckCircle2} label="Processed" value={stats.processed} tone="green" /></Col><Col md={2}><StatCard icon={XCircle} label="Failed" value={stats.failed} tone="red" /></Col></Row>
      <div className="po-panel"><Row className="g-3"><Col lg={3}><Form.Select value={filters.status} onChange={(e) => { setFilters({ ...filters, status: e.target.value }); setPagination({ ...pagination, page: 1 }); }}><option value="ALL">All status</option>{statuses.map((status) => <option key={status} value={status}>{status.toUpperCase()}</option>)}</Form.Select></Col><Col lg={6}><InputGroup><InputGroup.Text><Search size={16} /></InputGroup.Text><Form.Control value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} placeholder="Search customer, payout id..." /></InputGroup></Col><Col lg={3}><Form.Select value={pagination.limit} onChange={(e) => setPagination({ ...pagination, limit: Number(e.target.value), page: 1 })}><option value={10}>10 per page</option><option value={20}>20 per page</option><option value={50}>50 per page</option></Form.Select></Col></Row></div>
      <div className="po-table-card"><div className="table-responsive"><Table hover className="po-table mb-0"><thead><tr><th>User</th><th>Payout</th><th>Amount</th><th>Mode</th><th>Status</th><th>Fees</th><th>Processed</th><th>Actions</th></tr></thead><tbody>{loading && <tr><td colSpan="8" className="text-center py-5">Loading payouts...</td></tr>}{!loading && filtered.map((item) => <tr key={item._id}><td><strong>{item.userId?.name || 'N/A'}</strong><span>{item.userId?.mobile || item.userId?.email || ''}</span></td><td><strong>{item.razorpayPayoutId || item._id}</strong><span>{item.reference || item.notes || ''}</span></td><td><strong className="text-success">{formatCurrency(item.amount)}</strong></td><td><Badge bg="primary">{item.mode}</Badge></td><td><Badge bg={statusTone(item.status)}>{String(item.status || '').toUpperCase()}</Badge></td><td>{formatCurrency(Number(item.fees || 0) + Number(item.tax || 0))}</td><td>{formatDateTime(item.processedAt)}</td><td><div className="po-row-actions"><Button size="sm" variant="outline-secondary" onClick={() => setDetail(item)}><Eye size={15} /></Button>{['pending', 'processing'].includes(item.status) && <Button size="sm" variant="outline-success" disabled={processing} onClick={() => updateStatus(item, 'processed')}>Process</Button>}{item.status === 'pending' && <Button size="sm" variant="outline-danger" disabled={processing} onClick={() => updateStatus(item, 'cancelled')}>Cancel</Button>}{item.status === 'pending' && <Button size="sm" variant="outline-secondary" disabled={processing} onClick={() => deletePayout(item)}>Delete</Button>}</div></td></tr>)}{!loading && !filtered.length && <tr><td colSpan="8" className="text-center py-5 text-muted">No payouts found</td></tr>}</tbody></Table></div><div className="po-pagination"><span>Page {pagination.page} of {pagination.pages || 1} - {pagination.total} records</span><div><Button size="sm" variant="outline-secondary" disabled={pagination.page <= 1} onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}>Previous</Button><Button size="sm" variant="outline-secondary" disabled={pagination.page >= pagination.pages} onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}>Next</Button></div></div></div>
      <Modal show={showCreate} onHide={() => setShowCreate(false)} size="lg" centered><Modal.Header closeButton><Modal.Title>Create Payout</Modal.Title></Modal.Header><Modal.Body><Row className="g-3"><Col md={6}><Form.Label>User</Form.Label><div className="position-relative"><InputGroup><InputGroup.Text><Search size={16} /></InputGroup.Text><Form.Control value={form.userText} onChange={(e) => { const term = e.target.value; setForm({ ...form, userText: term }); if (term.length < 2) setUsers([]); else api.get(`/admin/users/search?q=${encodeURIComponent(term)}`).then((res) => setUsers(res.data?.data || [])).catch(() => setUsers([])); }} placeholder="Search user..." /></InputGroup>{users.length > 0 && <ListGroup className="position-absolute w-100 shadow" style={{ zIndex: 10 }}>{users.map((user) => <ListGroup.Item action key={user._id} onClick={() => { setForm({ ...form, userId: user._id, userText: `${user.name} (${user.mobile || user.email})`, name: form.name || user.name }); setUsers([]); }}><strong>{user.name}</strong><br /><small>{user.mobile} {user.email}</small></ListGroup.Item>)}</ListGroup>}</div></Col><Col md={6}><Form.Label>Amount</Form.Label><Form.Control type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Col><Col md={4}><Form.Label>Mode</Form.Label><Form.Select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>{modes.map((mode) => <option key={mode}>{mode}</option>)}</Form.Select></Col><Col md={4}><Form.Label>Account Holder</Form.Label><Form.Control value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Col><Col md={4}><Form.Label>VPA</Form.Label><Form.Control value={form.vpa} onChange={(e) => setForm({ ...form, vpa: e.target.value })} placeholder="user@upi" /></Col><Col md={6}><Form.Label>Account Number</Form.Label><Form.Control value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} /></Col><Col md={6}><Form.Label>IFSC</Form.Label><Form.Control value={form.ifsc} onChange={(e) => setForm({ ...form, ifsc: e.target.value.toUpperCase() })} /></Col><Col md={12}><Form.Label>Notes</Form.Label><Form.Control as="textarea" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Col></Row></Modal.Body><Modal.Footer><Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button><Button onClick={createPayout} disabled={processing || !form.userId || !form.amount || !form.name}>{processing ? 'Creating...' : 'Create Payout'}</Button></Modal.Footer></Modal>
      <Modal show={!!detail} onHide={() => setDetail(null)} size="lg" centered><Modal.Header closeButton><Modal.Title>Payout Details</Modal.Title></Modal.Header><Modal.Body>{detail && <div className="po-detail"><p><span>User</span><strong>{detail.userId?.name || 'N/A'} ({detail.userId?.mobile || '-'})</strong></p><p><span>Payout ID</span><strong>{detail.razorpayPayoutId || detail._id}</strong></p><p><span>Amount</span><strong>{formatCurrency(detail.amount)}</strong></p><p><span>Status</span><strong>{detail.status}</strong></p><p><span>Mode</span><strong>{detail.mode}</strong></p><p><span>Account</span><strong>{detail.accountDetails?.name || '-'} / {detail.accountDetails?.accountNumber || detail.accountDetails?.vpa || '-'}</strong></p><p><span>IFSC</span><strong>{detail.accountDetails?.ifsc || 'N/A'}</strong></p><p><span>Fees / Tax</span><strong>{formatCurrency(detail.fees)} / {formatCurrency(detail.tax)}</strong></p><p><span>Failure</span><strong>{detail.failureReason || 'N/A'}</strong></p><p><span>Created</span><strong>{formatDateTime(detail.createdAt)}</strong></p><p><span>Processed</span><strong>{formatDateTime(detail.processedAt)}</strong></p></div>}</Modal.Body><Modal.Footer><Button variant="secondary" onClick={() => setDetail(null)}>Close</Button></Modal.Footer></Modal>
      <style>{`
        .po-page{color:#0f172a}.po-header{background:linear-gradient(135deg,#0f172a 0%,#4338ca 55%,#0f766e 100%);border-radius:18px;padding:28px;color:#fff;display:flex;justify-content:space-between;gap:18px;align-items:flex-start;box-shadow:0 18px 45px rgba(15,23,42,.18)}.po-header h1{margin:2px 0 8px;font-size:30px;font-weight:850}.po-header p{margin:0;color:rgba(255,255,255,.78);font-weight:500}.po-eyebrow{font-size:12px;text-transform:uppercase;font-weight:800;color:#ddd6fe}.po-actions{display:flex;gap:10px;flex-wrap:wrap}.po-actions .btn,.po-row-actions .btn{display:inline-flex;align-items:center;gap:8px;font-weight:800}.po-stat,.po-panel,.po-table-card{background:#fff;border:1px solid #e2e8f0;border-radius:14px;box-shadow:0 12px 30px rgba(15,23,42,.06)}.po-stat{min-height:112px;padding:17px;display:flex;gap:13px}.po-stat-icon{width:42px;height:42px;border-radius:12px;display:grid;place-items:center;color:#fff}.po-stat-blue .po-stat-icon{background:#2563eb}.po-stat-green .po-stat-icon{background:#059669}.po-stat-red .po-stat-icon{background:#dc2626}.po-stat-amber .po-stat-icon{background:#d97706}.po-stat-purple .po-stat-icon{background:#7c3aed}.po-stat span{display:block;color:#64748b;font-size:12px;font-weight:850;text-transform:uppercase}.po-stat strong{font-size:21px;font-weight:850}.po-panel{padding:18px;margin:18px 0}.po-table-card{overflow:hidden}.po-table thead th{background:#f8fafc;color:#475569;font-size:12px;text-transform:uppercase;white-space:nowrap}.po-table td{vertical-align:middle;font-weight:600}.po-table td span{display:block;color:#64748b;font-size:12px}.po-row-actions{display:flex;gap:6px;flex-wrap:wrap}.po-pagination{display:flex;justify-content:space-between;padding:14px 18px;border-top:1px solid #e2e8f0;color:#64748b;font-weight:700}.po-pagination div{display:flex;gap:8px}.po-detail p{display:flex;justify-content:space-between;gap:16px;border-bottom:1px solid #f1f5f9;padding:10px 0;margin:0}.po-detail span{color:#64748b;font-weight:850;text-transform:uppercase;font-size:12px}.po-detail strong{text-align:right;overflow-wrap:anywhere}@media(max-width:768px){.po-header{flex-direction:column;padding:22px}.po-actions{width:100%}.po-actions .btn{flex:1;justify-content:center}.po-pagination{flex-direction:column;gap:10px}}
      `}</style>
    </div>
  );
};

export default Payouts;
