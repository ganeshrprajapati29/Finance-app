import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Col, Form, InputGroup, Modal, Row, Table } from 'react-bootstrap';
import { Download, Eye, PhoneCall, Plus, RefreshCw, Search, Timer, UserCheck, Users } from 'lucide-react';
import api from '../api/axios';

const callStatuses = ['CONNECTED', 'NO_ANSWER', 'BUSY', 'WRONG_NUMBER', 'DISCONNECTED'];
const callTypes = ['OUTBOUND', 'INBOUND'];
const relationships = ['SELF', 'FAMILY', 'FRIEND', 'COLLEAGUE', 'OTHER'];
const nextActions = ['FOLLOW_UP', 'VISIT', 'LEGAL', 'SETTLEMENT', 'PAYMENT_REMINDER', 'NONE'];

const formatDateTime = (date) => date ? new Date(date).toLocaleString('en-IN') : 'N/A';
const formatDuration = (seconds) => {
  const value = Number(seconds || 0);
  if (value < 60) return `${value}s`;
  return `${Math.floor(value / 60)}m ${value % 60}s`;
};

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

const statusTone = (status) => ({
  CONNECTED: 'success',
  NO_ANSWER: 'warning',
  BUSY: 'info',
  WRONG_NUMBER: 'danger',
  DISCONNECTED: 'secondary'
}[status] || 'secondary');

const StatCard = ({ icon: Icon, label, value, tone }) => (
  <div className={`cl-stat cl-stat-${tone}`}>
    <div className="cl-stat-icon"><Icon size={20} /></div>
    <div><span>{label}</span><strong>{value}</strong></div>
  </div>
);

const emptyForm = {
  loanId: '',
  collectionId: '',
  agentId: '',
  callType: 'OUTBOUND',
  callStatus: 'CONNECTED',
  callDuration: 120,
  contactPerson: '',
  relationship: 'SELF',
  conversationSummary: '',
  nextAction: 'FOLLOW_UP',
  nextActionDate: '',
  ptpAmount: '',
  ptpDate: '',
  notes: ''
};

const CallLogs = () => {
  const [logs, setLogs] = useState([]);
  const [agents, setAgents] = useState([]);
  const [overdueUsers, setOverdueUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });
  const [filters, setFilters] = useState({ callStatus: '', callType: '', agentId: '', search: '' });
  const [form, setForm] = useState(emptyForm);

  const fetchAgents = async () => {
    try {
      const res = await api.get('/employees');
      setAgents(res.data?.data?.items || res.data?.data || []);
    } catch {
      setAgents([]);
    }
  };

  const fetchOverdueUsers = async () => {
    try {
      const res = await api.get('/admin/collections/overdue-users');
      setOverdueUsers(res.data?.data?.users || []);
    } catch {
      setOverdueUsers([]);
    }
  };

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError('');
      const query = new URLSearchParams({ page: pagination.page, limit: pagination.limit });
      if (filters.callStatus) query.append('callStatus', filters.callStatus);
      if (filters.callType) query.append('callType', filters.callType);
      if (filters.agentId) query.append('agentId', filters.agentId);
      const res = await api.get(`/admin/collections/call-logs?${query}`);
      setLogs(res.data?.data?.callLogs || []);
      setPagination((current) => ({ ...current, ...(res.data?.data?.pagination || {}) }));
    } catch (err) {
      setError(err.response?.data?.message || 'Call logs load nahi ho paaye.');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
    fetchOverdueUsers();
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [pagination.page, pagination.limit, filters.callStatus, filters.callType, filters.agentId]);

  const filteredLogs = useMemo(() => {
    const term = filters.search.trim().toLowerCase();
    if (!term) return logs;
    return logs.filter((log) => [
      log.userId?.name,
      log.userId?.mobile,
      log.loanId?.loanAccountNumber,
      log.agentId?.name,
      log.conversationSummary
    ].some((value) => String(value || '').toLowerCase().includes(term)));
  }, [filters.search, logs]);

  const stats = useMemo(() => ({
    total: logs.length,
    connected: logs.filter((log) => log.callStatus === 'CONNECTED').length,
    followUp: logs.filter((log) => log.nextAction && log.nextAction !== 'NONE').length,
    avgDuration: logs.length ? Math.round(logs.reduce((sum, log) => sum + Number(log.callDuration || 0), 0) / logs.length) : 0
  }), [logs]);

  const updateFilter = (field, value) => {
    setFilters((current) => ({ ...current, [field]: value }));
    setPagination((current) => ({ ...current, page: 1 }));
  };

  const handleLoanChange = (loanId) => {
    const selected = overdueUsers.find((user) => String(user.loanId) === String(loanId));
    setForm((current) => ({
      ...current,
      loanId,
      collectionId: selected?.collectionId || '',
      contactPerson: selected?.userName || current.contactPerson
    }));
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    try {
      setProcessing(true);
      setError('');
      const payload = {
        collectionId: form.collectionId || undefined,
        loanId: form.loanId,
        agentId: form.agentId,
        callType: form.callType,
        callStatus: form.callStatus,
        callDuration: Number(form.callDuration || 0),
        contactPerson: form.contactPerson,
        relationship: form.relationship,
        conversationSummary: form.conversationSummary,
        nextAction: form.nextAction,
        nextActionDate: form.nextActionDate || undefined,
        promiseToPay: form.ptpAmount && form.ptpDate ? { amount: Number(form.ptpAmount), date: form.ptpDate } : undefined,
        notes: form.notes
      };
      await api.post('/admin/collections/call-log', payload);
      setSuccess('Call log create ho gaya.');
      setShowCreate(false);
      setForm(emptyForm);
      fetchLogs();
    } catch (err) {
      setError(err.response?.data?.message || 'Call log save nahi ho paaya.');
    } finally {
      setProcessing(false);
    }
  };

  const exportRows = () => {
    downloadCsv(filteredLogs.map((log) => ({
      date: formatDateTime(log.createdAt),
      borrower: log.userId?.name || '',
      mobile: log.userId?.mobile || '',
      loan: log.loanId?.loanAccountNumber || '',
      agent: log.agentId?.name || '',
      type: log.callType,
      status: log.callStatus,
      duration: log.callDuration || 0,
      nextAction: log.nextAction || '',
      summary: log.conversationSummary || ''
    })), 'call-logs.csv');
  };

  return (
    <div className="cl-page">
      <div className="cl-header">
        <div>
          <div className="cl-eyebrow">Collections</div>
          <h1>Call Logs</h1>
          <p>Borrower calling activity, outcomes, next action, and Promise to Pay records.</p>
        </div>
        <div className="cl-actions">
          <Button variant="light" onClick={() => setShowCreate(true)}><Plus size={16} /> Add Call</Button>
          <Button variant="outline-light" onClick={fetchLogs}><RefreshCw size={16} /> Refresh</Button>
          <Button variant="outline-light" onClick={exportRows} disabled={!filteredLogs.length}><Download size={16} /> Export</Button>
        </div>
      </div>

      {error && <Alert variant="danger" className="mt-3" dismissible onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert variant="success" className="mt-3" dismissible onClose={() => setSuccess('')}>{success}</Alert>}

      <Row className="g-3 mt-1">
        <Col xl={3} md={6}><StatCard icon={PhoneCall} label="Total Calls" value={stats.total} tone="blue" /></Col>
        <Col xl={3} md={6}><StatCard icon={UserCheck} label="Connected" value={stats.connected} tone="green" /></Col>
        <Col xl={3} md={6}><StatCard icon={Timer} label="Avg Duration" value={formatDuration(stats.avgDuration)} tone="amber" /></Col>
        <Col xl={3} md={6}><StatCard icon={Users} label="Follow-ups" value={stats.followUp} tone="purple" /></Col>
      </Row>

      <div className="cl-panel">
        <Row className="g-3">
          <Col lg={3} md={6}><Form.Select value={filters.callStatus} onChange={(e) => updateFilter('callStatus', e.target.value)}><option value="">All status</option>{callStatuses.map((status) => <option key={status}>{status}</option>)}</Form.Select></Col>
          <Col lg={3} md={6}><Form.Select value={filters.callType} onChange={(e) => updateFilter('callType', e.target.value)}><option value="">All type</option>{callTypes.map((type) => <option key={type}>{type}</option>)}</Form.Select></Col>
          <Col lg={3} md={6}><Form.Select value={filters.agentId} onChange={(e) => updateFilter('agentId', e.target.value)}><option value="">All agents</option>{agents.map((agent) => <option key={agent._id} value={agent._id}>{agent.name}</option>)}</Form.Select></Col>
          <Col lg={3} md={6}><InputGroup><InputGroup.Text><Search size={16} /></InputGroup.Text><Form.Control value={filters.search} onChange={(e) => setFilters((current) => ({ ...current, search: e.target.value }))} placeholder="Search..." /></InputGroup></Col>
        </Row>
      </div>

      <div className="cl-table-card">
        <div className="table-responsive">
          <Table hover className="cl-table mb-0">
            <thead><tr><th>Date</th><th>Borrower</th><th>Loan</th><th>Agent</th><th>Type</th><th>Status</th><th>Duration</th><th>Next Action</th><th>Action</th></tr></thead>
            <tbody>
              {loading && <tr><td colSpan="9" className="text-center py-5">Loading call logs...</td></tr>}
              {!loading && filteredLogs.map((log) => (
                <tr key={log._id}>
                  <td>{formatDateTime(log.createdAt)}</td>
                  <td><strong>{log.userId?.name || 'N/A'}</strong><span>{log.userId?.mobile || ''}</span></td>
                  <td>{log.loanId?.loanAccountNumber || '-'}</td>
                  <td>{log.agentId?.name || 'N/A'}</td>
                  <td><Badge bg={log.callType === 'OUTBOUND' ? 'info' : 'primary'}>{log.callType}</Badge></td>
                  <td><Badge bg={statusTone(log.callStatus)}>{log.callStatus}</Badge></td>
                  <td>{formatDuration(log.callDuration)}</td>
                  <td>{log.nextAction || '-'}</td>
                  <td><Button size="sm" variant="outline-secondary" onClick={() => setSelectedLog(log)}><Eye size={15} /></Button></td>
                </tr>
              ))}
              {!loading && !filteredLogs.length && <tr><td colSpan="9" className="text-center py-5 text-muted">No call logs found</td></tr>}
            </tbody>
          </Table>
        </div>
        <div className="cl-pagination">
          <span>Page {pagination.page} of {pagination.pages || 1} - {pagination.total} records</span>
          <div>
            <Button size="sm" variant="outline-secondary" disabled={pagination.page <= 1} onClick={() => setPagination((current) => ({ ...current, page: current.page - 1 }))}>Previous</Button>
            <Button size="sm" variant="outline-secondary" disabled={pagination.page >= pagination.pages} onClick={() => setPagination((current) => ({ ...current, page: current.page + 1 }))}>Next</Button>
          </div>
        </div>
      </div>

      <Modal show={!!selectedLog} onHide={() => setSelectedLog(null)} size="lg" centered>
        <Modal.Header closeButton><Modal.Title>Call Details</Modal.Title></Modal.Header>
        <Modal.Body>
          {selectedLog && <div className="cl-detail">
            <p><span>Borrower</span><strong>{selectedLog.userId?.name || 'N/A'}</strong></p>
            <p><span>Loan</span><strong>{selectedLog.loanId?.loanAccountNumber || 'N/A'}</strong></p>
            <p><span>Agent</span><strong>{selectedLog.agentId?.name || 'N/A'}</strong></p>
            <p><span>Outcome</span><strong>{selectedLog.callStatus}</strong></p>
            <p><span>Contact Person</span><strong>{selectedLog.contactPerson || 'N/A'} ({selectedLog.relationship || 'N/A'})</strong></p>
            <p><span>Summary</span><strong>{selectedLog.conversationSummary || 'N/A'}</strong></p>
            <p><span>Next Action</span><strong>{selectedLog.nextAction || 'N/A'} {selectedLog.nextActionDate ? `on ${formatDateTime(selectedLog.nextActionDate)}` : ''}</strong></p>
            <p><span>Notes</span><strong>{selectedLog.notes || 'N/A'}</strong></p>
          </div>}
        </Modal.Body>
        <Modal.Footer><Button variant="secondary" onClick={() => setSelectedLog(null)}>Close</Button></Modal.Footer>
      </Modal>

      <Modal show={showCreate} onHide={() => setShowCreate(false)} size="lg" centered>
        <Modal.Header closeButton><Modal.Title>Add Call Log</Modal.Title></Modal.Header>
        <Form onSubmit={handleCreate}>
          <Modal.Body>
            <Row className="g-3">
              <Col md={6}><Form.Label>Loan</Form.Label><Form.Select required value={form.loanId} onChange={(e) => handleLoanChange(e.target.value)}><option value="">Select overdue loan</option>{overdueUsers.map((user) => <option key={user.loanId} value={user.loanId}>{user.loanAccountNumber} - {user.userName}</option>)}</Form.Select></Col>
              <Col md={6}><Form.Label>Agent</Form.Label><Form.Select required value={form.agentId} onChange={(e) => setForm({ ...form, agentId: e.target.value })}><option value="">Select agent</option>{agents.map((agent) => <option key={agent._id} value={agent._id}>{agent.name}</option>)}</Form.Select></Col>
              <Col md={3}><Form.Label>Type</Form.Label><Form.Select value={form.callType} onChange={(e) => setForm({ ...form, callType: e.target.value })}>{callTypes.map((type) => <option key={type}>{type}</option>)}</Form.Select></Col>
              <Col md={3}><Form.Label>Status</Form.Label><Form.Select value={form.callStatus} onChange={(e) => setForm({ ...form, callStatus: e.target.value })}>{callStatuses.map((status) => <option key={status}>{status}</option>)}</Form.Select></Col>
              <Col md={3}><Form.Label>Duration Seconds</Form.Label><Form.Control type="number" value={form.callDuration} onChange={(e) => setForm({ ...form, callDuration: e.target.value })} /></Col>
              <Col md={3}><Form.Label>Relationship</Form.Label><Form.Select value={form.relationship} onChange={(e) => setForm({ ...form, relationship: e.target.value })}>{relationships.map((item) => <option key={item}>{item}</option>)}</Form.Select></Col>
              <Col md={6}><Form.Label>Contact Person</Form.Label><Form.Control required value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} /></Col>
              <Col md={6}><Form.Label>Next Action</Form.Label><Form.Select value={form.nextAction} onChange={(e) => setForm({ ...form, nextAction: e.target.value })}>{nextActions.map((item) => <option key={item}>{item}</option>)}</Form.Select></Col>
              <Col md={12}><Form.Label>Conversation Summary</Form.Label><Form.Control required as="textarea" rows={3} value={form.conversationSummary} onChange={(e) => setForm({ ...form, conversationSummary: e.target.value })} /></Col>
              <Col md={4}><Form.Label>Next Action Date</Form.Label><Form.Control type="date" value={form.nextActionDate} onChange={(e) => setForm({ ...form, nextActionDate: e.target.value })} /></Col>
              <Col md={4}><Form.Label>PTP Amount</Form.Label><Form.Control type="number" value={form.ptpAmount} onChange={(e) => setForm({ ...form, ptpAmount: e.target.value })} /></Col>
              <Col md={4}><Form.Label>PTP Date</Form.Label><Form.Control type="date" value={form.ptpDate} onChange={(e) => setForm({ ...form, ptpDate: e.target.value })} /></Col>
              <Col md={12}><Form.Label>Notes</Form.Label><Form.Control as="textarea" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Col>
            </Row>
          </Modal.Body>
          <Modal.Footer><Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button><Button type="submit" disabled={processing}>{processing ? 'Saving...' : 'Save Call Log'}</Button></Modal.Footer>
        </Form>
      </Modal>

      <style>{`
        .cl-page { color: #0f172a; }
        .cl-header { background: linear-gradient(135deg, #0f172a 0%, #155e75 58%, #2563eb 100%); border-radius: 18px; padding: 28px; color: #fff; display: flex; justify-content: space-between; gap: 18px; align-items: flex-start; box-shadow: 0 18px 45px rgba(15,23,42,.18); }
        .cl-header h1 { margin: 2px 0 8px; font-size: 30px; font-weight: 850; }
        .cl-header p { margin: 0; color: rgba(255,255,255,.78); font-weight: 500; }
        .cl-eyebrow { font-size: 12px; text-transform: uppercase; font-weight: 800; color: #bfdbfe; }
        .cl-actions { display: flex; gap: 10px; flex-wrap: wrap; }
        .cl-actions .btn { display: inline-flex; align-items: center; gap: 8px; font-weight: 800; }
        .cl-stat, .cl-panel, .cl-table-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; box-shadow: 0 12px 30px rgba(15,23,42,.06); }
        .cl-stat { min-height: 112px; padding: 17px; display: flex; gap: 13px; align-items: flex-start; }
        .cl-stat-icon { width: 42px; height: 42px; border-radius: 12px; display: grid; place-items: center; color: #fff; }
        .cl-stat-blue .cl-stat-icon { background: #2563eb; } .cl-stat-green .cl-stat-icon { background: #059669; } .cl-stat-amber .cl-stat-icon { background: #d97706; } .cl-stat-purple .cl-stat-icon { background: #7c3aed; }
        .cl-stat span { display: block; color: #64748b; font-size: 12px; font-weight: 850; text-transform: uppercase; } .cl-stat strong { font-size: 22px; font-weight: 850; }
        .cl-panel { padding: 18px; margin: 18px 0; }
        .cl-table-card { overflow: hidden; } .cl-table thead th { background: #f8fafc; color: #475569; font-size: 12px; text-transform: uppercase; white-space: nowrap; }
        .cl-table td { vertical-align: middle; font-weight: 600; } .cl-table td span { display: block; color: #64748b; font-size: 12px; }
        .cl-pagination { display: flex; justify-content: space-between; gap: 12px; padding: 14px 18px; border-top: 1px solid #e2e8f0; color: #64748b; font-weight: 700; }
        .cl-pagination div { display: flex; gap: 8px; }
        .cl-detail p { display: flex; justify-content: space-between; gap: 16px; border-bottom: 1px solid #f1f5f9; padding: 10px 0; margin: 0; }
        .cl-detail span { color: #64748b; font-weight: 850; text-transform: uppercase; font-size: 12px; } .cl-detail strong { text-align: right; overflow-wrap: anywhere; }
        @media (max-width: 768px) { .cl-header { flex-direction: column; padding: 22px; } .cl-actions { width: 100%; } .cl-actions .btn { flex: 1; justify-content: center; } .cl-pagination { flex-direction: column; } }
      `}</style>
    </div>
  );
};

export default CallLogs;
