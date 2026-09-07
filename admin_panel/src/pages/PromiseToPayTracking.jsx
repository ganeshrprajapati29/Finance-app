import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Col, Form, InputGroup, Modal, ProgressBar, Row, Table } from 'react-bootstrap';
import { CalendarClock, CheckCircle2, Download, Edit3, Eye, RefreshCw, Search, ShieldAlert, WalletCards, XCircle } from 'lucide-react';
import api from '../api/axios';

const statuses = ['PENDING', 'KEPT', 'BROKEN', 'EXTENDED', 'PARTIAL', 'CANCELLED'];
const formatCurrency = (amount) => `Rs. ${Number(amount || 0).toLocaleString('en-IN')}`;
const formatDate = (date) => date ? new Date(date).toLocaleDateString('en-IN') : 'N/A';
const formatDateTime = (date) => date ? new Date(date).toLocaleString('en-IN') : 'N/A';
const statusTone = (status) => ({ PENDING: 'warning', KEPT: 'success', BROKEN: 'danger', EXTENDED: 'info', PARTIAL: 'primary', CANCELLED: 'secondary' }[status] || 'secondary');

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

const dueBadge = (date, status) => {
  if (status !== 'PENDING' && status !== 'EXTENDED') return <Badge bg={statusTone(status)}>{status}</Badge>;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(date);
  due.setHours(0, 0, 0, 0);
  const days = Math.ceil((due - today) / 86400000);
  if (days < 0) return <Badge bg="danger">{Math.abs(days)} days overdue</Badge>;
  if (days === 0) return <Badge bg="warning">Due today</Badge>;
  return <Badge bg={days <= 3 ? 'info' : 'secondary'}>{days} days left</Badge>;
};

const StatCard = ({ icon: Icon, label, value, tone }) => (
  <div className={`ptp-stat ptp-stat-${tone}`}>
    <div className="ptp-stat-icon"><Icon size={20} /></div>
    <div><span>{label}</span><strong>{value}</strong></div>
  </div>
);

const PromiseToPayTracking = () => {
  const [ptps, setPtps] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });
  const [filters, setFilters] = useState({ status: '', agentId: '', dateFrom: '', dateTo: '', search: '' });
  const [updateForm, setUpdateForm] = useState({ status: 'PENDING', amount: '', date: '', promisedDate: '', notes: '' });

  const fetchAgents = async () => {
    try {
      const res = await api.get('/agents');
      setAgents(res.data?.data?.agents || []);
    } catch {
      setAgents([]);
    }
  };

  const fetchPtps = async () => {
    try {
      setLoading(true);
      setError('');
      const query = new URLSearchParams({ page: pagination.page, limit: pagination.limit });
      ['status', 'agentId', 'dateFrom', 'dateTo'].forEach((key) => filters[key] && query.append(key, filters[key]));
      const res = await api.get(`/admin/collections/ptp-tracking?${query}`);
      setPtps(res.data?.data?.ptps || []);
      setPagination((current) => ({ ...current, ...(res.data?.data?.pagination || {}) }));
    } catch (err) {
      setError(err.response?.data?.message || 'PTP records load nahi ho paaye.');
      setPtps([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAgents(); }, []);
  useEffect(() => { fetchPtps(); }, [pagination.page, pagination.limit, filters.status, filters.agentId, filters.dateFrom, filters.dateTo]);

  const filtered = useMemo(() => {
    const term = filters.search.trim().toLowerCase();
    if (!term) return ptps;
    return ptps.filter((ptp) => [ptp.userId?.name, ptp.userId?.mobile, ptp.loanId?.loanAccountNumber, ptp.agentId?.name, ptp.reason].some((value) => String(value || '').toLowerCase().includes(term)));
  }, [filters.search, ptps]);

  const stats = useMemo(() => {
    const totalAmount = ptps.reduce((sum, item) => sum + Number(item.promisedAmount || 0), 0);
    const kept = ptps.filter((item) => item.status === 'KEPT');
    const broken = ptps.filter((item) => item.status === 'BROKEN');
    const resolved = kept.length + broken.length;
    return {
      total: pagination.total || ptps.length,
      totalAmount,
      pending: ptps.filter((item) => item.status === 'PENDING').length,
      kept: kept.length,
      broken: broken.length,
      successRate: resolved ? Math.round((kept.length / resolved) * 100) : 0
    };
  }, [pagination.total, ptps]);

  const updateFilter = (field, value) => {
    setFilters((current) => ({ ...current, [field]: value }));
    setPagination((current) => ({ ...current, page: 1 }));
  };

  const openUpdate = (ptp) => {
    setSelected(ptp);
    setUpdateForm({
      status: ptp.status || 'PENDING',
      amount: ptp.actualPaymentAmount || ptp.promisedAmount || '',
      date: ptp.actualPaymentDate ? new Date(ptp.actualPaymentDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      promisedDate: ptp.promisedDate ? new Date(ptp.promisedDate).toISOString().slice(0, 10) : '',
      notes: ptp.notes || ''
    });
  };

  const saveUpdate = async () => {
    if (!selected) return;
    try {
      setProcessing(true);
      setError('');
      await api.put(`/admin/collections/ptp/${selected._id}`, {
        status: updateForm.status,
        actualPaymentAmount: ['KEPT', 'PARTIAL'].includes(updateForm.status) ? Number(updateForm.amount || 0) : undefined,
        actualPaymentDate: ['KEPT', 'PARTIAL'].includes(updateForm.status) ? updateForm.date : undefined,
        promisedDate: updateForm.status === 'EXTENDED' ? updateForm.promisedDate : undefined,
        notes: updateForm.notes
      });
      setSuccess('PTP status update ho gaya.');
      setSelected(null);
      fetchPtps();
    } catch (err) {
      setError(err.response?.data?.message || 'PTP update nahi ho paaya.');
    } finally {
      setProcessing(false);
    }
  };

  const exportRows = () => {
    downloadCsv(filtered.map((ptp) => ({
      loanAccount: ptp.loanId?.loanAccountNumber || '',
      customer: ptp.userId?.name || '',
      mobile: ptp.userId?.mobile || '',
      agent: ptp.agentId?.name || '',
      promisedAmount: ptp.promisedAmount || 0,
      promisedDate: formatDate(ptp.promisedDate),
      status: ptp.status,
      actualAmount: ptp.actualPaymentAmount || '',
      actualDate: formatDate(ptp.actualPaymentDate),
      reason: ptp.reason || ''
    })), 'ptp-tracking.csv');
  };

  return (
    <div className="ptp-page">
      <div className="ptp-header">
        <div>
          <div className="ptp-eyebrow">Collections</div>
          <h1>PTP Tracking</h1>
          <p>Promise to Pay commitments, due dates, agent follow-up and recovery outcomes.</p>
        </div>
        <div className="ptp-actions">
          <Button variant="light" onClick={fetchPtps}><RefreshCw size={16} /> Refresh</Button>
          <Button variant="outline-light" onClick={exportRows} disabled={!filtered.length}><Download size={16} /> Export</Button>
        </div>
      </div>

      {error && <Alert variant="danger" className="mt-3" dismissible onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert variant="success" className="mt-3" dismissible onClose={() => setSuccess('')}>{success}</Alert>}

      <Row className="g-3 mt-1">
        <Col xl={2} md={4}><StatCard icon={CalendarClock} label="Total PTP" value={stats.total} tone="blue" /></Col>
        <Col xl={3} md={4}><StatCard icon={WalletCards} label="Promised Amount" value={formatCurrency(stats.totalAmount)} tone="amber" /></Col>
        <Col xl={2} md={4}><StatCard icon={ShieldAlert} label="Pending" value={stats.pending} tone="purple" /></Col>
        <Col xl={2} md={4}><StatCard icon={CheckCircle2} label="Kept" value={stats.kept} tone="green" /></Col>
        <Col xl={1} md={4}><StatCard icon={XCircle} label="Broken" value={stats.broken} tone="red" /></Col>
        <Col xl={2} md={4}><StatCard icon={CheckCircle2} label="Success" value={`${stats.successRate}%`} tone="cyan" /></Col>
      </Row>

      <div className="ptp-panel">
        <Row className="g-3">
          <Col lg={2}><Form.Select value={filters.status} onChange={(e) => updateFilter('status', e.target.value)}><option value="">All status</option>{statuses.map((item) => <option key={item}>{item}</option>)}</Form.Select></Col>
          <Col lg={2}><Form.Select value={filters.agentId} onChange={(e) => updateFilter('agentId', e.target.value)}><option value="">All agents</option>{agents.map((agent) => <option key={agent._id} value={agent._id}>{agent.name}</option>)}</Form.Select></Col>
          <Col lg={2}><Form.Control type="date" value={filters.dateFrom} onChange={(e) => updateFilter('dateFrom', e.target.value)} /></Col>
          <Col lg={2}><Form.Control type="date" value={filters.dateTo} onChange={(e) => updateFilter('dateTo', e.target.value)} /></Col>
          <Col lg={4}><InputGroup><InputGroup.Text><Search size={16} /></InputGroup.Text><Form.Control value={filters.search} onChange={(e) => setFilters((current) => ({ ...current, search: e.target.value }))} placeholder="Search customer, loan, agent..." /></InputGroup></Col>
        </Row>
      </div>

      <div className="ptp-table-card">
        <div className="table-responsive">
          <Table hover className="ptp-table mb-0">
            <thead><tr><th>Customer</th><th>Loan</th><th>Promise</th><th>Due</th><th>Agent</th><th>Contact</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {loading && <tr><td colSpan="8" className="text-center py-5">Loading PTP records...</td></tr>}
              {!loading && filtered.map((ptp) => (
                <tr key={ptp._id}>
                  <td><strong>{ptp.userId?.name || 'N/A'}</strong><span>{ptp.userId?.mobile || ptp.userId?.email || ''}</span></td>
                  <td>{ptp.loanId?.loanAccountNumber || '-'}</td>
                  <td><strong className="text-danger">{formatCurrency(ptp.promisedAmount)}</strong><span>{formatDate(ptp.promisedDate)}</span></td>
                  <td>{dueBadge(ptp.promisedDate, ptp.status)}</td>
                  <td>{ptp.agentId?.name || 'N/A'}</td>
                  <td><Badge bg="secondary">{ptp.contactMethod || '-'}</Badge></td>
                  <td><Badge bg={statusTone(ptp.status)}>{ptp.status || 'PENDING'}</Badge></td>
                  <td><div className="ptp-row-actions"><Button size="sm" variant="outline-secondary" onClick={() => setDetail(ptp)}><Eye size={15} /></Button><Button size="sm" variant="outline-primary" onClick={() => openUpdate(ptp)}><Edit3 size={15} /></Button></div></td>
                </tr>
              ))}
              {!loading && !filtered.length && <tr><td colSpan="8" className="text-center py-5 text-muted">No PTP records found</td></tr>}
            </tbody>
          </Table>
        </div>
        <div className="ptp-pagination">
          <span>Page {pagination.page} of {pagination.pages || 1} - {pagination.total} records</span>
          <div><Button size="sm" variant="outline-secondary" disabled={pagination.page <= 1} onClick={() => setPagination((current) => ({ ...current, page: current.page - 1 }))}>Previous</Button><Button size="sm" variant="outline-secondary" disabled={pagination.page >= pagination.pages} onClick={() => setPagination((current) => ({ ...current, page: current.page + 1 }))}>Next</Button></div>
        </div>
      </div>

      <Modal show={!!selected} onHide={() => setSelected(null)} centered>
        <Modal.Header closeButton><Modal.Title>Update PTP</Modal.Title></Modal.Header>
        <Modal.Body>
          {selected && <>
            <Alert variant="info">{selected.userId?.name} - {formatCurrency(selected.promisedAmount)} promised on {formatDate(selected.promisedDate)}</Alert>
            <Form.Group className="mb-3"><Form.Label>Status</Form.Label><Form.Select value={updateForm.status} onChange={(e) => setUpdateForm({ ...updateForm, status: e.target.value })}>{statuses.map((item) => <option key={item}>{item}</option>)}</Form.Select></Form.Group>
            {['KEPT', 'PARTIAL'].includes(updateForm.status) && <Row><Col md={6}><Form.Label>Actual Amount</Form.Label><Form.Control type="number" value={updateForm.amount} onChange={(e) => setUpdateForm({ ...updateForm, amount: e.target.value })} /></Col><Col md={6}><Form.Label>Payment Date</Form.Label><Form.Control type="date" value={updateForm.date} onChange={(e) => setUpdateForm({ ...updateForm, date: e.target.value })} /></Col></Row>}
            {updateForm.status === 'EXTENDED' && <Form.Group className="mt-3"><Form.Label>New Promise Date</Form.Label><Form.Control type="date" value={updateForm.promisedDate} onChange={(e) => setUpdateForm({ ...updateForm, promisedDate: e.target.value })} /></Form.Group>}
            <Form.Group className="mt-3"><Form.Label>Notes</Form.Label><Form.Control as="textarea" rows={3} value={updateForm.notes} onChange={(e) => setUpdateForm({ ...updateForm, notes: e.target.value })} /></Form.Group>
          </>}
        </Modal.Body>
        <Modal.Footer><Button variant="secondary" onClick={() => setSelected(null)}>Cancel</Button><Button onClick={saveUpdate} disabled={processing}>{processing ? 'Saving...' : 'Save'}</Button></Modal.Footer>
      </Modal>

      <Modal show={!!detail} onHide={() => setDetail(null)} size="lg" centered>
        <Modal.Header closeButton><Modal.Title>PTP Details</Modal.Title></Modal.Header>
        <Modal.Body>{detail && <div className="ptp-detail"><p><span>Customer</span><strong>{detail.userId?.name || 'N/A'}</strong></p><p><span>Loan</span><strong>{detail.loanId?.loanAccountNumber || 'N/A'}</strong></p><p><span>Agent</span><strong>{detail.agentId?.name || 'N/A'}</strong></p><p><span>Promise</span><strong>{formatCurrency(detail.promisedAmount)} on {formatDate(detail.promisedDate)}</strong></p><p><span>Status</span><strong>{detail.status || 'PENDING'}</strong></p><p><span>Contact</span><strong>{detail.contactMethod} - {detail.contactPerson} ({detail.relationship})</strong></p><p><span>Reason</span><strong>{detail.reason || 'N/A'}</strong></p><p><span>Actual Payment</span><strong>{formatCurrency(detail.actualPaymentAmount)} on {formatDate(detail.actualPaymentDate)}</strong></p><p><span>Notes</span><strong>{detail.notes || 'N/A'}</strong></p><p><span>Created</span><strong>{formatDateTime(detail.createdAt)}</strong></p></div>}</Modal.Body>
        <Modal.Footer><Button variant="secondary" onClick={() => setDetail(null)}>Close</Button></Modal.Footer>
      </Modal>

      <style>{`
        .ptp-page { color: #0f172a; }
        .ptp-header { background: linear-gradient(135deg, #0f172a 0%, #7c3aed 55%, #0f766e 100%); border-radius: 18px; padding: 28px; color: #fff; display: flex; justify-content: space-between; gap: 18px; align-items: flex-start; box-shadow: 0 18px 45px rgba(15,23,42,.18); }
        .ptp-header h1 { margin: 2px 0 8px; font-size: 30px; font-weight: 850; } .ptp-header p { margin: 0; color: rgba(255,255,255,.78); font-weight: 500; }
        .ptp-eyebrow { font-size: 12px; text-transform: uppercase; font-weight: 800; color: #ddd6fe; } .ptp-actions { display: flex; gap: 10px; flex-wrap: wrap; }
        .ptp-actions .btn, .ptp-row-actions .btn { display: inline-flex; align-items: center; gap: 8px; font-weight: 800; }
        .ptp-stat, .ptp-panel, .ptp-table-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; box-shadow: 0 12px 30px rgba(15,23,42,.06); }
        .ptp-stat { min-height: 112px; padding: 17px; display: flex; gap: 13px; align-items: flex-start; } .ptp-stat-icon { width: 42px; height: 42px; border-radius: 12px; display: grid; place-items: center; color: #fff; }
        .ptp-stat-blue .ptp-stat-icon { background:#2563eb; } .ptp-stat-amber .ptp-stat-icon { background:#d97706; } .ptp-stat-purple .ptp-stat-icon { background:#7c3aed; } .ptp-stat-green .ptp-stat-icon { background:#059669; } .ptp-stat-red .ptp-stat-icon { background:#dc2626; } .ptp-stat-cyan .ptp-stat-icon { background:#0891b2; }
        .ptp-stat span { display:block; color:#64748b; font-size:12px; font-weight:850; text-transform:uppercase; } .ptp-stat strong { font-size:21px; font-weight:850; }
        .ptp-panel { padding:18px; margin:18px 0; } .ptp-table-card { overflow:hidden; } .ptp-table thead th { background:#f8fafc; color:#475569; font-size:12px; text-transform:uppercase; white-space:nowrap; }
        .ptp-table td { vertical-align:middle; font-weight:600; } .ptp-table td span { display:block; color:#64748b; font-size:12px; } .ptp-row-actions { display:flex; gap:6px; }
        .ptp-pagination { display:flex; justify-content:space-between; gap:12px; padding:14px 18px; border-top:1px solid #e2e8f0; color:#64748b; font-weight:700; } .ptp-pagination div { display:flex; gap:8px; }
        .ptp-detail p { display:flex; justify-content:space-between; gap:16px; border-bottom:1px solid #f1f5f9; padding:10px 0; margin:0; } .ptp-detail span { color:#64748b; font-weight:850; text-transform:uppercase; font-size:12px; } .ptp-detail strong { text-align:right; overflow-wrap:anywhere; }
        @media (max-width:768px){ .ptp-header{flex-direction:column;padding:22px;} .ptp-actions{width:100%;} .ptp-actions .btn{flex:1;justify-content:center;} .ptp-pagination{flex-direction:column;} }
      `}</style>
    </div>
  );
};

export default PromiseToPayTracking;
