import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Col, Form, InputGroup, Modal, Row, Table } from 'react-bootstrap';
import { AlertTriangle, Download, History, MessageSquare, RefreshCw, Search, Send, ShieldAlert, Users, WalletCards } from 'lucide-react';
import api from '../api/axios';

const buckets = ['1-7', '8-15', '16-30', '31-60', '60-90', '90+'];
const templates = [
  { name: 'Standard', message: 'Dear {name}, your loan account {loanAccount} has overdue amount {amount}. Please pay immediately. Khatu Pay' },
  { name: 'Urgent', message: 'Dear {name}, your loan {loanAccount} is overdue by {days} days. Pending amount {amount}. Please contact us today. Khatu Pay' },
  { name: 'Final Notice', message: 'FINAL NOTICE: Loan {loanAccount} is overdue by {days} days. Amount {amount}. Legal action may start if payment is not received. Khatu Pay' }
];

const formatCurrency = (amount) => `Rs. ${Number(amount || 0).toLocaleString('en-IN')}`;
const formatDateTime = (date) => date ? new Date(date).toLocaleString('en-IN') : 'N/A';
const bucketTone = (bucket) => ({ '1-7': 'success', '8-15': 'warning', '16-30': 'danger', '31-60': 'danger', '60-90': 'dark', '90+': 'dark' }[bucket] || 'secondary');

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
  <div className={`sms-stat sms-stat-${tone}`}>
    <div className="sms-stat-icon"><Icon size={20} /></div>
    <div><span>{label}</span><strong>{value}</strong></div>
  </div>
);

const WarningSmsTrigger = () => {
  const [users, setUsers] = useState([]);
  const [summary, setSummary] = useState({});
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filters, setFilters] = useState({ bucket: '', search: '' });
  const [selectedIds, setSelectedIds] = useState([]);
  const [showSend, setShowSend] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [message, setMessage] = useState('');
  const [sendEmail, setSendEmail] = useState(false);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError('');
      const query = filters.bucket ? `?bucket=${filters.bucket}` : '';
      const res = await api.get(`/admin/collections/overdue-users${query}`);
      const payload = res.data?.data || {};
      setUsers(payload.users || []);
      setSummary(payload.summary || {});
      setSelectedIds([]);
    } catch (err) {
      setError(err.response?.data?.message || 'Overdue users load nahi ho paaye.');
      setUsers([]);
      setSummary({});
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await api.get('/admin/collections/sms-history?limit=100');
      setHistory(res.data?.data?.smsHistory || []);
    } catch {
      setHistory([]);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [filters.bucket]);

  useEffect(() => {
    fetchHistory();
  }, []);

  const filteredUsers = useMemo(() => {
    const term = filters.search.trim().toLowerCase();
    if (!term) return users;
    return users.filter((user) => [user.userName, user.userPhone, user.userEmail, user.loanAccountNumber].some((value) => String(value || '').toLowerCase().includes(term)));
  }, [filters.search, users]);

  const stats = useMemo(() => ({
    total: Number(summary.total || users.length),
    amount: Number(summary.totalOverdueAmount || users.reduce((sum, user) => sum + Number(user.overdueAmount || 0), 0)),
    critical: users.filter((user) => user.daysOverdue > 30).length,
    sent: history.filter((item) => item.status === 'SENT').length
  }), [history, summary, users]);

  const hydrateMessage = (template, user) => template
    .replaceAll('{name}', user?.userName || 'Customer')
    .replaceAll('{loanAccount}', user?.loanAccountNumber || user?.loanId || '')
    .replaceAll('{amount}', formatCurrency(user?.overdueAmount))
    .replaceAll('{days}', user?.daysOverdue || 0);

  const openSendModal = (user) => {
    const template = user?.daysOverdue > 30 ? templates[2] : user?.daysOverdue > 7 ? templates[1] : templates[0];
    setSelectedUser(user);
    setMessage(hydrateMessage(template.message, user));
    setShowSend(true);
  };

  const sendSingle = async () => {
    if (!selectedUser || !message.trim()) return;
    try {
      setProcessing(true);
      setError('');
      await api.post('/admin/collections/warning-sms', {
        collectionId: selectedUser.collectionId,
        loanId: selectedUser.loanId,
        message,
        sendEmail
      });
      setSuccess('Warning SMS sent successfully.');
      setShowSend(false);
      await fetchHistory();
    } catch (err) {
      setError(err.response?.data?.message || 'SMS send nahi ho paaya.');
    } finally {
      setProcessing(false);
    }
  };

  const sendBulk = async () => {
    const targets = selectedIds.length ? filteredUsers.filter((user) => selectedIds.includes(String(user.loanId))) : filteredUsers;
    if (!targets.length) return;
    try {
      setProcessing(true);
      setError('');
      await api.post('/admin/collections/bulk-warning-sms', {
        loanIds: targets.map((user) => user.loanId)
      });
      setSuccess(`Bulk SMS processed for ${targets.length} users.`);
      setSelectedIds([]);
      await fetchHistory();
    } catch (err) {
      setError(err.response?.data?.message || 'Bulk SMS send nahi ho paaya.');
    } finally {
      setProcessing(false);
    }
  };

  const toggleUser = (loanId) => {
    const id = String(loanId);
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const toggleAll = () => {
    setSelectedIds((current) => current.length === filteredUsers.length ? [] : filteredUsers.map((user) => String(user.loanId)));
  };

  const exportHistory = () => {
    downloadCsv(history.map((item) => ({
      date: formatDateTime(item.createdAt),
      borrower: item.userId?.name || '',
      phone: item.phone || item.userId?.mobile || '',
      loan: item.loanId?.loanAccountNumber || '',
      status: item.status,
      message: item.message
    })), 'warning-sms-history.csv');
  };

  return (
    <div className="sms-page">
      <div className="sms-header">
        <div>
          <div className="sms-eyebrow">Collections</div>
          <h1>Warning SMS</h1>
          <p>Overdue borrowers ko template-based warning SMS bhejein aur delivery history track karein.</p>
        </div>
        <div className="sms-actions">
          <Button variant="light" onClick={() => setShowHistory(true)}><History size={16} /> History</Button>
          <Button variant="outline-light" onClick={fetchUsers}><RefreshCw size={16} /> Refresh</Button>
          <Button variant="outline-light" onClick={sendBulk} disabled={processing || !filteredUsers.length}><Send size={16} /> Send Bulk</Button>
        </div>
      </div>

      {error && <Alert variant="danger" className="mt-3" dismissible onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert variant="success" className="mt-3" dismissible onClose={() => setSuccess('')}>{success}</Alert>}

      <Row className="g-3 mt-1">
        <Col xl={3} md={6}><StatCard icon={Users} label="Overdue Users" value={stats.total} tone="red" /></Col>
        <Col xl={3} md={6}><StatCard icon={WalletCards} label="Overdue Amount" value={formatCurrency(stats.amount)} tone="amber" /></Col>
        <Col xl={3} md={6}><StatCard icon={ShieldAlert} label="Critical" value={stats.critical} tone="dark" /></Col>
        <Col xl={3} md={6}><StatCard icon={MessageSquare} label="SMS Sent" value={stats.sent} tone="blue" /></Col>
      </Row>

      <div className="sms-panel">
        <Row className="g-3">
          <Col lg={3} md={6}><Form.Select value={filters.bucket} onChange={(e) => setFilters((current) => ({ ...current, bucket: e.target.value }))}><option value="">All buckets</option>{buckets.map((bucket) => <option key={bucket} value={bucket}>{bucket} days</option>)}</Form.Select></Col>
          <Col lg={5} md={6}><InputGroup><InputGroup.Text><Search size={16} /></InputGroup.Text><Form.Control value={filters.search} onChange={(e) => setFilters((current) => ({ ...current, search: e.target.value }))} placeholder="Search borrower, phone, loan..." /></InputGroup></Col>
          <Col lg={2} md={6}><Button variant="outline-secondary" className="w-100" onClick={toggleAll}>{selectedIds.length === filteredUsers.length ? 'Clear All' : 'Select All'}</Button></Col>
          <Col lg={2} md={6}><Button variant="danger" className="w-100" onClick={sendBulk} disabled={processing || !filteredUsers.length}>Send {selectedIds.length || filteredUsers.length}</Button></Col>
        </Row>
      </div>

      <div className="sms-table-card">
        <div className="table-responsive">
          <Table hover className="sms-table mb-0">
            <thead><tr><th></th><th>Borrower</th><th>Loan</th><th>Overdue</th><th>Bucket</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              {loading && <tr><td colSpan="7" className="text-center py-5">Loading overdue users...</td></tr>}
              {!loading && filteredUsers.map((user) => (
                <tr key={user.loanId}>
                  <td><Form.Check checked={selectedIds.includes(String(user.loanId))} onChange={() => toggleUser(user.loanId)} /></td>
                  <td><strong>{user.userName || 'N/A'}</strong><span>{user.userPhone || ''}</span></td>
                  <td>{user.loanAccountNumber || 'N/A'}</td>
                  <td><strong className="text-danger">{formatCurrency(user.overdueAmount)}</strong><span>{user.daysOverdue} days</span></td>
                  <td><Badge bg={bucketTone(user.bucket)}>{user.bucket}</Badge></td>
                  <td><Badge bg={user.collectionStatus === 'LEGAL' ? 'danger' : user.collectionStatus === 'UNASSIGNED' ? 'warning' : 'success'}>{user.collectionStatus || 'UNASSIGNED'}</Badge></td>
                  <td><Button size="sm" variant="outline-danger" onClick={() => openSendModal(user)}><Send size={15} /> Send</Button></td>
                </tr>
              ))}
              {!loading && !filteredUsers.length && <tr><td colSpan="7" className="text-center py-5 text-muted"><AlertTriangle size={30} /><div>No overdue users found</div></td></tr>}
            </tbody>
          </Table>
        </div>
      </div>

      <Modal show={showSend} onHide={() => setShowSend(false)} size="lg" centered>
        <Modal.Header closeButton><Modal.Title>Send Warning SMS</Modal.Title></Modal.Header>
        <Modal.Body>
          {selectedUser && <>
            <Alert variant="warning"><strong>{selectedUser.userName}</strong> - {selectedUser.loanAccountNumber} - {formatCurrency(selectedUser.overdueAmount)} overdue</Alert>
            <div className="sms-template-row">
              {templates.map((template) => <Button key={template.name} size="sm" variant="outline-primary" onClick={() => setMessage(hydrateMessage(template.message, selectedUser))}>{template.name}</Button>)}
            </div>
            <Form.Group className="mt-3">
              <Form.Label>Message</Form.Label>
              <Form.Control as="textarea" rows={5} value={message} onChange={(e) => setMessage(e.target.value)} />
              <Form.Text>{message.length} chars, {Math.max(1, Math.ceil(message.length / 160))} SMS part(s)</Form.Text>
            </Form.Group>
            <Form.Check className="mt-3" label="Also send email notification" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} />
          </>}
        </Modal.Body>
        <Modal.Footer><Button variant="secondary" onClick={() => setShowSend(false)}>Cancel</Button><Button variant="danger" onClick={sendSingle} disabled={processing || !message.trim()}>{processing ? 'Sending...' : 'Send SMS'}</Button></Modal.Footer>
      </Modal>

      <Modal show={showHistory} onHide={() => setShowHistory(false)} size="xl" centered>
        <Modal.Header closeButton><Modal.Title>SMS History</Modal.Title></Modal.Header>
        <Modal.Body>
          <div className="d-flex justify-content-end mb-3"><Button size="sm" variant="outline-success" onClick={exportHistory}><Download size={15} /> Export</Button></div>
          <div className="table-responsive">
            <Table hover className="sms-table">
              <thead><tr><th>Date</th><th>Borrower</th><th>Phone</th><th>Loan</th><th>Status</th><th>Message</th></tr></thead>
              <tbody>
                {history.map((item) => <tr key={item._id}><td>{formatDateTime(item.createdAt)}</td><td>{item.userId?.name || 'N/A'}</td><td>{item.phone || item.userId?.mobile || '-'}</td><td>{item.loanId?.loanAccountNumber || '-'}</td><td><Badge bg={item.status === 'SENT' ? 'success' : 'danger'}>{item.status}</Badge></td><td className="sms-message-cell">{item.message}</td></tr>)}
                {!history.length && <tr><td colSpan="6" className="text-center py-4 text-muted">No SMS history found</td></tr>}
              </tbody>
            </Table>
          </div>
        </Modal.Body>
        <Modal.Footer><Button variant="secondary" onClick={() => setShowHistory(false)}>Close</Button></Modal.Footer>
      </Modal>

      <style>{`
        .sms-page { color: #0f172a; }
        .sms-header { background: linear-gradient(135deg, #111827 0%, #991b1b 58%, #dc2626 100%); border-radius: 18px; padding: 28px; color: #fff; display: flex; justify-content: space-between; gap: 18px; align-items: flex-start; box-shadow: 0 18px 45px rgba(15,23,42,.18); }
        .sms-header h1 { margin: 2px 0 8px; font-size: 30px; font-weight: 850; } .sms-header p { margin: 0; color: rgba(255,255,255,.78); font-weight: 500; }
        .sms-eyebrow { font-size: 12px; text-transform: uppercase; font-weight: 800; color: #fecaca; }
        .sms-actions { display: flex; gap: 10px; flex-wrap: wrap; } .sms-actions .btn, .sms-table .btn { display: inline-flex; align-items: center; gap: 8px; font-weight: 800; }
        .sms-stat, .sms-panel, .sms-table-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; box-shadow: 0 12px 30px rgba(15,23,42,.06); }
        .sms-stat { min-height: 112px; padding: 17px; display: flex; gap: 13px; align-items: flex-start; }
        .sms-stat-icon { width: 42px; height: 42px; border-radius: 12px; display: grid; place-items: center; color: #fff; }
        .sms-stat-red .sms-stat-icon { background: #dc2626; } .sms-stat-amber .sms-stat-icon { background: #d97706; } .sms-stat-dark .sms-stat-icon { background: #111827; } .sms-stat-blue .sms-stat-icon { background: #2563eb; }
        .sms-stat span { display: block; color: #64748b; font-size: 12px; font-weight: 850; text-transform: uppercase; } .sms-stat strong { font-size: 22px; font-weight: 850; }
        .sms-panel { padding: 18px; margin: 18px 0; } .sms-table-card { overflow: hidden; }
        .sms-table thead th { background: #f8fafc; color: #475569; font-size: 12px; text-transform: uppercase; white-space: nowrap; }
        .sms-table td { vertical-align: middle; font-weight: 600; } .sms-table td span { display: block; color: #64748b; font-size: 12px; }
        .sms-template-row { display: flex; flex-wrap: wrap; gap: 8px; } .sms-message-cell { max-width: 420px; white-space: normal; }
        @media (max-width: 768px) { .sms-header { flex-direction: column; padding: 22px; } .sms-actions { width: 100%; } .sms-actions .btn { flex: 1; justify-content: center; } }
      `}</style>
    </div>
  );
};

export default WarningSmsTrigger;
