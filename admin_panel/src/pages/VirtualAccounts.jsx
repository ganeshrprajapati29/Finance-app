import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Col, Form, InputGroup, ListGroup, Modal, Row, Table } from 'react-bootstrap';
import { CheckCircle2, Download, Eye, Plus, RefreshCw, Search, Wallet, XCircle } from 'lucide-react';
import api from '../api/axios';

const formatCurrency = (amount) => `Rs. ${Number(amount || 0).toLocaleString('en-IN')}`;
const formatDateTime = (date) => date ? new Date(date).toLocaleString('en-IN') : 'N/A';
const statusTone = (status, active) => (!active || status === 'inactive') ? 'secondary' : status === 'closed' ? 'danger' : 'success';

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
  <div className={`va-stat va-stat-${tone}`}><div className="va-stat-icon"><Icon size={20} /></div><div><span>{label}</span><strong>{value}</strong></div></div>
);

const VirtualAccounts = () => {
  const [accounts, setAccounts] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [detail, setDetail] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });
  const [filters, setFilters] = useState({ status: 'ALL', search: '' });
  const [form, setForm] = useState({ userId: '', userText: '', description: '' });

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      setError('');
      const query = new URLSearchParams({ page: pagination.page, limit: pagination.limit, status: filters.status });
      const res = await api.get(`/admin/virtual-accounts?${query}`);
      const data = res.data?.data || {};
      setAccounts(data.items || []);
      setPagination((current) => ({ ...current, total: data.total || 0, pages: Math.max(1, Math.ceil((data.total || 0) / current.limit)) }));
    } catch (err) {
      setError(err.response?.data?.message || 'Virtual accounts load nahi ho paaye.');
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAccounts(); }, [pagination.page, pagination.limit, filters.status]);

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
    if (!term) return accounts;
    return accounts.filter((item) => [item.userId?.name, item.userId?.email, item.userId?.mobile, item.name, item.razorpayVirtualAccountId].some((value) => String(value || '').toLowerCase().includes(term)));
  }, [accounts, filters.search]);

  const stats = useMemo(() => ({
    total: pagination.total || accounts.length,
    active: accounts.filter((item) => item.isActive && item.status === 'active').length,
    inactive: accounts.filter((item) => !item.isActive || item.status === 'inactive').length,
    balance: accounts.reduce((sum, item) => sum + Number(item.balance || 0), 0)
  }), [accounts, pagination.total]);

  const createAccount = async () => {
    if (!form.userId) return;
    try {
      setProcessing(true);
      setError('');
      await api.post('/admin/virtual-accounts', { userId: form.userId, description: form.description });
      setSuccess('Virtual account create ho gaya.');
      setShowCreate(false);
      setForm({ userId: '', userText: '', description: '' });
      setUsers([]);
      fetchAccounts();
    } catch (err) {
      setError(err.response?.data?.message || 'Virtual account create nahi ho paaya.');
    } finally {
      setProcessing(false);
    }
  };

  const toggleAccount = async (account) => {
    try {
      setProcessing(true);
      await api.put(`/admin/virtual-accounts/${account._id}`, { isActive: !account.isActive });
      setSuccess('Virtual account update ho gaya.');
      fetchAccounts();
    } catch (err) {
      setError(err.response?.data?.message || 'Virtual account update nahi ho paaya.');
    } finally {
      setProcessing(false);
    }
  };

  const exportRows = () => downloadCsv(filtered.map((item) => ({
    user: item.userId?.name || '',
    email: item.userId?.email || '',
    mobile: item.userId?.mobile || '',
    virtualAccountId: item.razorpayVirtualAccountId || '',
    name: item.name || '',
    status: item.status,
    active: item.isActive ? 'Yes' : 'No',
    balance: item.balance || 0,
    credits: item.totalCredits || 0,
    debits: item.totalDebits || 0
  })), 'virtual-accounts.csv');

  return (
    <div className="va-page">
      <div className="va-header"><div><div className="va-eyebrow">Payments</div><h1>Virtual Accounts</h1><p>Razorpay virtual accounts, balances, receivers and account status management.</p></div><div className="va-actions"><Button variant="light" onClick={() => setShowCreate(true)}><Plus size={16} /> Create VA</Button><Button variant="outline-light" onClick={fetchAccounts}><RefreshCw size={16} /> Refresh</Button><Button variant="outline-light" onClick={exportRows} disabled={!filtered.length}><Download size={16} /> Export</Button></div></div>
      {error && <Alert variant="danger" className="mt-3" dismissible onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert variant="success" className="mt-3" dismissible onClose={() => setSuccess('')}>{success}</Alert>}
      <Row className="g-3 mt-1"><Col md={3}><StatCard icon={Wallet} label="Total" value={stats.total} tone="blue" /></Col><Col md={3}><StatCard icon={CheckCircle2} label="Active" value={stats.active} tone="green" /></Col><Col md={3}><StatCard icon={XCircle} label="Inactive" value={stats.inactive} tone="red" /></Col><Col md={3}><StatCard icon={Wallet} label="Balance" value={formatCurrency(stats.balance)} tone="amber" /></Col></Row>
      <div className="va-panel"><Row className="g-3"><Col lg={3}><Form.Select value={filters.status} onChange={(e) => { setFilters({ ...filters, status: e.target.value }); setPagination({ ...pagination, page: 1 }); }}><option value="ALL">All status</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></Form.Select></Col><Col lg={6}><InputGroup><InputGroup.Text><Search size={16} /></InputGroup.Text><Form.Control value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} placeholder="Search user, mobile, VA id..." /></InputGroup></Col><Col lg={3}><Form.Select value={pagination.limit} onChange={(e) => setPagination({ ...pagination, limit: Number(e.target.value), page: 1 })}><option value={10}>10 per page</option><option value={20}>20 per page</option><option value={50}>50 per page</option></Form.Select></Col></Row></div>
      <div className="va-table-card"><div className="table-responsive"><Table hover className="va-table mb-0"><thead><tr><th>User</th><th>Account</th><th>Receivers</th><th>Balance</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead><tbody>{loading && <tr><td colSpan="7" className="text-center py-5">Loading virtual accounts...</td></tr>}{!loading && filtered.map((item) => <tr key={item._id}><td><strong>{item.userId?.name || 'N/A'}</strong><span>{item.userId?.mobile || item.userId?.email || ''}</span></td><td><strong>{item.name || '-'}</strong><span>{item.razorpayVirtualAccountId || '-'}</span></td><td>{item.receivers?.vpa?.[0]?.address || '-'}</td><td><strong>{formatCurrency(item.balance)}</strong><span>Cr {formatCurrency(item.totalCredits)} | Dr {formatCurrency(item.totalDebits)}</span></td><td><Badge bg={statusTone(item.status, item.isActive)}>{item.isActive ? item.status : 'inactive'}</Badge></td><td>{formatDateTime(item.createdAt)}</td><td><div className="va-row-actions"><Button size="sm" variant="outline-secondary" onClick={() => setDetail(item)}><Eye size={15} /></Button><Button size="sm" variant={item.isActive ? 'outline-danger' : 'outline-success'} onClick={() => toggleAccount(item)} disabled={processing}>{item.isActive ? 'Disable' : 'Enable'}</Button></div></td></tr>)}{!loading && !filtered.length && <tr><td colSpan="7" className="text-center py-5 text-muted">No virtual accounts found</td></tr>}</tbody></Table></div><div className="va-pagination"><span>Page {pagination.page} of {pagination.pages || 1} - {pagination.total} records</span><div><Button size="sm" variant="outline-secondary" disabled={pagination.page <= 1} onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}>Previous</Button><Button size="sm" variant="outline-secondary" disabled={pagination.page >= pagination.pages} onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}>Next</Button></div></div></div>
      <Modal show={showCreate} onHide={() => setShowCreate(false)} centered><Modal.Header closeButton><Modal.Title>Create Virtual Account</Modal.Title></Modal.Header><Modal.Body><Form.Label>User</Form.Label><div className="position-relative"><InputGroup><InputGroup.Text><Search size={16} /></InputGroup.Text><Form.Control value={form.userText} onChange={(e) => searchUsers(e.target.value)} placeholder="Search name, email, mobile..." /></InputGroup>{users.length > 0 && <ListGroup className="position-absolute w-100 shadow" style={{ zIndex: 10 }}>{users.map((user) => <ListGroup.Item action key={user._id} onClick={() => { setForm({ ...form, userId: user._id, userText: `${user.name} (${user.mobile || user.email})` }); setUsers([]); }}><strong>{user.name}</strong><br /><small>{user.mobile} {user.email}</small></ListGroup.Item>)}</ListGroup>}</div><Form.Group className="mt-3"><Form.Label>Description</Form.Label><Form.Control as="textarea" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Form.Group></Modal.Body><Modal.Footer><Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button><Button onClick={createAccount} disabled={processing || !form.userId}>{processing ? 'Creating...' : 'Create'}</Button></Modal.Footer></Modal>
      <Modal show={!!detail} onHide={() => setDetail(null)} size="lg" centered><Modal.Header closeButton><Modal.Title>Virtual Account Details</Modal.Title></Modal.Header><Modal.Body>{detail && <div className="va-detail"><p><span>User</span><strong>{detail.userId?.name || 'N/A'} ({detail.userId?.mobile || '-'})</strong></p><p><span>Virtual Account ID</span><strong>{detail.razorpayVirtualAccountId || 'N/A'}</strong></p><p><span>Name</span><strong>{detail.name || 'N/A'}</strong></p><p><span>Status</span><strong>{detail.isActive ? detail.status : 'inactive'}</strong></p><p><span>Balance</span><strong>{formatCurrency(detail.balance)}</strong></p><p><span>Credits / Debits</span><strong>{formatCurrency(detail.totalCredits)} / {formatCurrency(detail.totalDebits)}</strong></p><p><span>VPA</span><strong>{detail.receivers?.vpa?.map((vpa) => vpa.address).join(', ') || 'N/A'}</strong></p><p><span>Description</span><strong>{detail.description || 'N/A'}</strong></p><p><span>Created</span><strong>{formatDateTime(detail.createdAt)}</strong></p></div>}</Modal.Body><Modal.Footer><Button variant="secondary" onClick={() => setDetail(null)}>Close</Button></Modal.Footer></Modal>
      <style>{`
        .va-page{color:#0f172a}.va-header{background:linear-gradient(135deg,#0f172a 0%,#0f766e 55%,#2563eb 100%);border-radius:18px;padding:28px;color:#fff;display:flex;justify-content:space-between;gap:18px;align-items:flex-start;box-shadow:0 18px 45px rgba(15,23,42,.18)}.va-header h1{margin:2px 0 8px;font-size:30px;font-weight:850}.va-header p{margin:0;color:rgba(255,255,255,.78);font-weight:500}.va-eyebrow{font-size:12px;text-transform:uppercase;font-weight:800;color:#bfdbfe}.va-actions{display:flex;gap:10px;flex-wrap:wrap}.va-actions .btn,.va-row-actions .btn{display:inline-flex;align-items:center;gap:8px;font-weight:800}.va-stat,.va-panel,.va-table-card{background:#fff;border:1px solid #e2e8f0;border-radius:14px;box-shadow:0 12px 30px rgba(15,23,42,.06)}.va-stat{min-height:112px;padding:17px;display:flex;gap:13px}.va-stat-icon{width:42px;height:42px;border-radius:12px;display:grid;place-items:center;color:#fff}.va-stat-blue .va-stat-icon{background:#2563eb}.va-stat-green .va-stat-icon{background:#059669}.va-stat-red .va-stat-icon{background:#dc2626}.va-stat-amber .va-stat-icon{background:#d97706}.va-stat span{display:block;color:#64748b;font-size:12px;font-weight:850;text-transform:uppercase}.va-stat strong{font-size:21px;font-weight:850}.va-panel{padding:18px;margin:18px 0}.va-table-card{overflow:hidden}.va-table thead th{background:#f8fafc;color:#475569;font-size:12px;text-transform:uppercase;white-space:nowrap}.va-table td{vertical-align:middle;font-weight:600}.va-table td span{display:block;color:#64748b;font-size:12px}.va-row-actions{display:flex;gap:6px}.va-pagination{display:flex;justify-content:space-between;padding:14px 18px;border-top:1px solid #e2e8f0;color:#64748b;font-weight:700}.va-pagination div{display:flex;gap:8px}.va-detail p{display:flex;justify-content:space-between;gap:16px;border-bottom:1px solid #f1f5f9;padding:10px 0;margin:0}.va-detail span{color:#64748b;font-weight:850;text-transform:uppercase;font-size:12px}.va-detail strong{text-align:right;overflow-wrap:anywhere}@media(max-width:768px){.va-header{flex-direction:column;padding:22px}.va-actions{width:100%}.va-actions .btn{flex:1;justify-content:center}.va-pagination{flex-direction:column;gap:10px}}
      `}</style>
    </div>
  );
};

export default VirtualAccounts;
