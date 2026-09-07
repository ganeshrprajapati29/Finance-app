import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Col, Form, InputGroup, Modal, Row, Table } from 'react-bootstrap';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Download,
  Eye,
  MessageSquare,
  Phone,
  RefreshCw,
  Search,
  ShieldAlert,
  UserPlus,
  Users,
  WalletCards
} from 'lucide-react';
import api from '../api/axios';

const buckets = ['1-7', '8-15', '16-30', '31-60', '60-90', '90+'];
const statuses = ['UNASSIGNED', 'ACTIVE', 'LEGAL', 'RESOLVED', 'SETTLED'];

const formatCurrency = (amount) => {
  const value = Number(amount || 0);
  return `Rs. ${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
};

const formatDate = (date) => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

const bucketTone = (bucket) => ({
  '1-7': 'success',
  '8-15': 'warning',
  '16-30': 'danger',
  '31-60': 'danger',
  '60-90': 'dark',
  '90+': 'dark'
}[bucket] || 'secondary');

const priorityTone = (priority) => ({
  LOW: 'success',
  MEDIUM: 'warning',
  HIGH: 'danger',
  CRITICAL: 'dark'
}[priority] || 'secondary');

const statusTone = (status) => ({
  UNASSIGNED: 'warning',
  ACTIVE: 'primary',
  LEGAL: 'danger',
  RESOLVED: 'success',
  SETTLED: 'secondary'
}[status] || 'secondary');

const downloadCsv = (rows, filename) => {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => `"${String(row[header] ?? '').replace(/"/g, '""')}"`).join(','))
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const StatCard = ({ icon: Icon, label, value, tone, note }) => (
  <div className={`od-stat od-stat-${tone}`}>
    <div className="od-stat-icon"><Icon size={20} /></div>
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
      {note && <small>{note}</small>}
    </div>
  </div>
);

const OverdueUsersList = () => {
  const [users, setUsers] = useState([]);
  const [summary, setSummary] = useState({});
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filters, setFilters] = useState({ bucket: '', status: '', agentId: '', search: '' });
  const [selectedUser, setSelectedUser] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [showPtp, setShowPtp] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [assignForm, setAssignForm] = useState({ agentId: '', notes: '' });
  const [ptpForm, setPtpForm] = useState({ amount: '', date: '', agentId: '', notes: '' });

  const fetchOverdueUsers = async () => {
    try {
      setLoading(true);
      setError('');
      const query = new URLSearchParams();
      if (filters.bucket) query.append('bucket', filters.bucket);
      if (filters.status) query.append('status', filters.status);
      if (filters.agentId) query.append('agentId', filters.agentId);
      const res = await api.get(`/admin/collections/overdue-users${query.toString() ? `?${query}` : ''}`);
      const payload = res.data?.data || {};
      const list = payload.users || [];
      setUsers(list);
      setSummary(payload.summary || {});
    } catch (err) {
      setError(err.response?.data?.message || 'Overdue users load nahi ho paaye.');
      setUsers([]);
      setSummary({});
    } finally {
      setLoading(false);
    }
  };

  const fetchAgents = async () => {
    try {
      const res = await api.get('/employees');
      const list = res.data?.data?.items || res.data?.data || [];
      setAgents(list.filter((agent) =>
        agent.isActive !== false &&
        agent.status !== 'inactive' &&
        (
          agent.permissions?.canManageCollections ||
          agent.department === 'COLLECTION' ||
          agent.department === 'COLLECTIONS' ||
          agent.roles?.includes('collection') ||
          agent.roles?.includes('employee')
        )
      ));
    } catch {
      setAgents([]);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  useEffect(() => {
    fetchOverdueUsers();
  }, [filters.bucket, filters.status, filters.agentId]);

  const filteredUsers = useMemo(() => {
    const term = filters.search.trim().toLowerCase();
    if (!term) return users;
    return users.filter((user) => [
      user.userName,
      user.userPhone,
      user.userEmail,
      user.loanAccountNumber,
      user.assignedAgent?.name
    ].some((value) => String(value || '').toLowerCase().includes(term)));
  }, [filters.search, users]);

  const computedSummary = useMemo(() => {
    const totalOverdueAmount = Number(summary.totalOverdueAmount || users.reduce((sum, user) => sum + Number(user.overdueAmount || 0), 0));
    const critical = users.filter((user) => user.priority === 'CRITICAL' || user.daysOverdue > 60).length;
    const assigned = Number(summary.assigned ?? users.filter((user) => user.assignedAgent).length);
    const unassigned = Number(summary.unassigned ?? users.filter((user) => !user.assignedAgent).length);
    return { totalOverdueAmount, critical, assigned, unassigned };
  }, [summary, users]);

  const updateFilter = (field, value) => {
    setFilters((current) => ({ ...current, [field]: value }));
  };

  const openAssign = (user) => {
    setSelectedUser(user);
    setAssignForm({ agentId: user.assignedAgent?._id || '', notes: user.notes || '' });
    setShowAssign(true);
  };

  const openPtp = (user) => {
    setSelectedUser(user);
    setPtpForm({
      amount: user.overdueAmount || '',
      date: '',
      agentId: user.assignedAgent?._id || '',
      notes: ''
    });
    setShowPtp(true);
  };

  const handleAssign = async () => {
    if (!selectedUser || !assignForm.agentId) return;
    try {
      setProcessing(true);
      setError('');
      await api.post('/admin/collections/assign-agent', {
        loanId: selectedUser.loanId,
        agentId: assignForm.agentId,
        notes: assignForm.notes
      });
      setSuccess('Collection agent assign ho gaya.');
      setShowAssign(false);
      await fetchOverdueUsers();
    } catch (err) {
      setError(err.response?.data?.message || 'Agent assign nahi ho paaya.');
    } finally {
      setProcessing(false);
    }
  };

  const handleCreatePtp = async () => {
    if (!selectedUser || !ptpForm.amount || !ptpForm.date || !ptpForm.agentId) return;
    try {
      setProcessing(true);
      setError('');
      await api.post('/admin/collections/ptp', {
        loanId: selectedUser.loanId,
        collectionId: selectedUser.collectionId,
        agentId: ptpForm.agentId,
        amount: Number(ptpForm.amount),
        promiseDate: ptpForm.date,
        notes: ptpForm.notes
      });
      setSuccess('Promise to Pay create ho gaya.');
      setShowPtp(false);
      await fetchOverdueUsers();
    } catch (err) {
      setError(err.response?.data?.message || 'PTP create nahi ho paaya.');
    } finally {
      setProcessing(false);
    }
  };

  const handleSendSms = async (user) => {
    try {
      setProcessing(true);
      setError('');
      await api.post('/admin/collections/warning-sms', {
        collectionId: user.collectionId,
        loanId: user.loanId,
        message: `Dear ${user.userName || 'Customer'}, your loan account ${user.loanAccountNumber} is overdue by ${user.daysOverdue} days. Pending amount: ${formatCurrency(user.overdueAmount)}. Please pay immediately. Khatu Pay`
      });
      setSuccess('Warning SMS sent successfully.');
    } catch (err) {
      setError(err.response?.data?.message || 'SMS send nahi ho paaya.');
    } finally {
      setProcessing(false);
    }
  };

  const exportRows = () => {
    downloadCsv(
      filteredUsers.map((user) => ({
        loanAccount: user.loanAccountNumber,
        customer: user.userName,
        phone: user.userPhone,
        email: user.userEmail,
        overdueAmount: user.overdueAmount,
        daysOverdue: user.daysOverdue,
        bucket: user.bucket,
        overdueEmis: user.overdueInstallments,
        priority: user.priority,
        status: user.collectionStatus,
        agent: user.assignedAgent?.name || '',
        lastContact: formatDate(user.lastContactDate),
        nextFollowUp: formatDate(user.nextFollowUpDate)
      })),
      'overdue-users.csv'
    );
  };

  return (
    <div className="od-page">
      <div className="od-header">
        <div>
          <div className="od-eyebrow">Collections</div>
          <h1>Overdue Users</h1>
          <p>Overdue loan accounts, risk buckets, agent assignment, warning SMS aur Promise to Pay workflow manage karein.</p>
        </div>
        <div className="od-header-actions">
          <Button variant="light" onClick={fetchOverdueUsers} disabled={loading}>
            <RefreshCw size={16} /> Refresh
          </Button>
          <Button variant="outline-light" onClick={exportRows} disabled={!filteredUsers.length}>
            <Download size={16} /> Export
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="danger" className="od-alert" dismissible onClose={() => setError('')}>
          <AlertTriangle size={18} /> {error}
        </Alert>
      )}
      {success && (
        <Alert variant="success" className="od-alert" dismissible onClose={() => setSuccess('')}>
          <CheckCircle2 size={18} /> {success}
        </Alert>
      )}

      <Row className="g-3 mt-1">
        <Col xl={3} md={6}><StatCard icon={Users} label="Total Overdue" value={summary.total || users.length} tone="red" note={`${filteredUsers.length} visible`} /></Col>
        <Col xl={3} md={6}><StatCard icon={WalletCards} label="Overdue Amount" value={formatCurrency(computedSummary.totalOverdueAmount)} tone="amber" note="Pending EMI total" /></Col>
        <Col xl={3} md={6}><StatCard icon={ShieldAlert} label="Critical Cases" value={computedSummary.critical} tone="dark" note="60+ days or critical" /></Col>
        <Col xl={3} md={6}><StatCard icon={UserPlus} label="Assigned / Open" value={`${computedSummary.assigned} / ${computedSummary.unassigned}`} tone="blue" note="Collection allocation" /></Col>
      </Row>

      <div className="od-filter-panel">
        <Row className="g-3">
          <Col lg={3} md={6}>
            <Form.Label>Bucket</Form.Label>
            <Form.Select value={filters.bucket} onChange={(event) => updateFilter('bucket', event.target.value)}>
              <option value="">All buckets</option>
              {buckets.map((bucket) => <option key={bucket} value={bucket}>{bucket} days</option>)}
            </Form.Select>
          </Col>
          <Col lg={3} md={6}>
            <Form.Label>Status</Form.Label>
            <Form.Select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
              <option value="">All status</option>
              {statuses.map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}
            </Form.Select>
          </Col>
          <Col lg={3} md={6}>
            <Form.Label>Agent</Form.Label>
            <Form.Select value={filters.agentId} onChange={(event) => updateFilter('agentId', event.target.value)}>
              <option value="">All agents</option>
              {agents.map((agent) => <option key={agent._id} value={agent._id}>{agent.name}</option>)}
            </Form.Select>
          </Col>
          <Col lg={3} md={6}>
            <Form.Label>Search</Form.Label>
            <InputGroup>
              <InputGroup.Text><Search size={17} /></InputGroup.Text>
              <Form.Control value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} placeholder="Name, phone, loan..." />
            </InputGroup>
          </Col>
        </Row>

        <div className="od-bucket-strip">
          {buckets.map((bucket) => (
            <button key={bucket} className={filters.bucket === bucket ? 'active' : ''} onClick={() => updateFilter('bucket', filters.bucket === bucket ? '' : bucket)}>
              <span>{bucket}</span>
              <strong>{summary[`bucket${bucket.replace('-', '_').replace('+', '_plus')}`] || 0}</strong>
            </button>
          ))}
        </div>
      </div>

      <div className="od-table-card">
        <div className="od-table-head">
          <div>
            <h2>Overdue Portfolio</h2>
            <p>Highest risk accounts are sorted by overdue days.</p>
          </div>
          <Badge bg="secondary">{filteredUsers.length} accounts</Badge>
        </div>

        <div className="table-responsive">
          <Table hover className="od-table mb-0">
            <thead>
              <tr>
                <th>Borrower</th>
                <th>Loan</th>
                <th>Overdue</th>
                <th>Bucket</th>
                <th>Priority</th>
                <th>Agent</th>
                <th>Status</th>
                <th>Follow-up</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan="9" className="text-center py-5"><span className="spinner-border spinner-border-sm me-2" /> Loading overdue users...</td></tr>
              )}

              {!loading && filteredUsers.map((user) => (
                <tr key={`${user.loanId}-${user.userPhone}`}>
                  <td>
                    <div className="od-borrower">
                      <strong>{user.userName || 'N/A'}</strong>
                      <span><Phone size={13} /> {user.userPhone || 'N/A'}</span>
                    </div>
                  </td>
                  <td>
                    <strong>{user.loanAccountNumber || 'N/A'}</strong>
                    <span className="od-muted">{user.overdueInstallments || 0} overdue EMI</span>
                  </td>
                  <td>
                    <strong className="text-danger">{formatCurrency(user.overdueAmount)}</strong>
                    <span className="od-muted">{user.daysOverdue || 0} days overdue</span>
                  </td>
                  <td><Badge bg={bucketTone(user.bucket)}>{user.bucket || 'N/A'}</Badge></td>
                  <td><Badge bg={priorityTone(user.priority)}>{user.priority || 'MEDIUM'}</Badge></td>
                  <td>{user.assignedAgent?.name || <span className="text-muted">Unassigned</span>}</td>
                  <td><Badge bg={statusTone(user.collectionStatus)}>{user.collectionStatus || 'UNASSIGNED'}</Badge></td>
                  <td>
                    <span>{formatDate(user.nextFollowUpDate || user.lastContactDate)}</span>
                    <span className="od-muted">Oldest due {formatDate(user.oldestDueDate)}</span>
                  </td>
                  <td>
                    <div className="od-actions">
                      <Button size="sm" variant="outline-secondary" title="View details" onClick={() => { setSelectedUser(user); setShowDetail(true); }}><Eye size={15} /></Button>
                      <Button size="sm" variant="outline-primary" title="Assign agent" onClick={() => openAssign(user)}><UserPlus size={15} /></Button>
                      <Button size="sm" variant="outline-success" title="Create PTP" onClick={() => openPtp(user)}><CalendarClock size={15} /></Button>
                      <Button size="sm" variant="outline-warning" title="Send SMS" onClick={() => handleSendSms(user)} disabled={processing}><MessageSquare size={15} /></Button>
                    </div>
                  </td>
                </tr>
              ))}

              {!loading && !filteredUsers.length && (
                <tr>
                  <td colSpan="9" className="text-center py-5">
                    <AlertTriangle size={34} className="text-muted mb-2" />
                    <div className="fw-bold">No overdue users found</div>
                    <div className="text-muted">Filters clear karke dobara try karein.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </div>
      </div>

      <Modal show={showDetail} onHide={() => setShowDetail(false)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>Overdue Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedUser && (
            <Row className="g-3">
              <Col md={6}>
                <div className="od-detail-box">
                  <h3>Borrower</h3>
                  <p><span>Name</span><strong>{selectedUser.userName}</strong></p>
                  <p><span>Phone</span><strong>{selectedUser.userPhone}</strong></p>
                  <p><span>Email</span><strong>{selectedUser.userEmail || 'N/A'}</strong></p>
                  <p><span>Agent</span><strong>{selectedUser.assignedAgent?.name || 'Unassigned'}</strong></p>
                </div>
              </Col>
              <Col md={6}>
                <div className="od-detail-box">
                  <h3>Loan Risk</h3>
                  <p><span>Loan Account</span><strong>{selectedUser.loanAccountNumber}</strong></p>
                  <p><span>Overdue Amount</span><strong>{formatCurrency(selectedUser.overdueAmount)}</strong></p>
                  <p><span>Days Overdue</span><strong>{selectedUser.daysOverdue}</strong></p>
                  <p><span>Status</span><strong>{selectedUser.collectionStatus || 'UNASSIGNED'}</strong></p>
                </div>
              </Col>
              <Col md={12}>
                <div className="od-detail-box">
                  <h3>Collection Notes</h3>
                  <p><span>Last Contact</span><strong>{formatDate(selectedUser.lastContactDate)}</strong></p>
                  <p><span>Next Follow-up</span><strong>{formatDate(selectedUser.nextFollowUpDate)}</strong></p>
                  <p><span>Notes</span><strong>{selectedUser.notes || 'No notes added'}</strong></p>
                </div>
              </Col>
            </Row>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-primary" onClick={() => selectedUser && openAssign(selectedUser)}>Assign Agent</Button>
          <Button variant="secondary" onClick={() => setShowDetail(false)}>Close</Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showAssign} onHide={() => setShowAssign(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Assign Collection Agent</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedUser && (
            <>
              <Alert variant="info">
                <strong>{selectedUser.userName}</strong> - {formatCurrency(selectedUser.overdueAmount)} overdue for {selectedUser.daysOverdue} days.
              </Alert>
              <Form.Group className="mb-3">
                <Form.Label>Agent</Form.Label>
                <Form.Select value={assignForm.agentId} onChange={(event) => setAssignForm((current) => ({ ...current, agentId: event.target.value }))}>
                  <option value="">Select agent</option>
                  {agents.map((agent) => <option key={agent._id} value={agent._id}>{agent.name} - {agent.phone || agent.email}</option>)}
                </Form.Select>
              </Form.Group>
              <Form.Group>
                <Form.Label>Notes</Form.Label>
                <Form.Control as="textarea" rows={3} value={assignForm.notes} onChange={(event) => setAssignForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Collection instruction..." />
              </Form.Group>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowAssign(false)}>Cancel</Button>
          <Button variant="primary" onClick={handleAssign} disabled={processing || !assignForm.agentId}>{processing ? 'Assigning...' : 'Assign'}</Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showPtp} onHide={() => setShowPtp(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Create Promise to Pay</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedUser && (
            <>
              <Alert variant="warning">
                PTP for <strong>{selectedUser.userName}</strong>, loan <strong>{selectedUser.loanAccountNumber}</strong>.
              </Alert>
              <Row className="g-3">
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Promise Amount</Form.Label>
                    <InputGroup>
                      <InputGroup.Text>Rs.</InputGroup.Text>
                      <Form.Control type="number" value={ptpForm.amount} onChange={(event) => setPtpForm((current) => ({ ...current, amount: event.target.value }))} />
                    </InputGroup>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Promise Date</Form.Label>
                    <Form.Control type="date" min={new Date().toISOString().slice(0, 10)} value={ptpForm.date} onChange={(event) => setPtpForm((current) => ({ ...current, date: event.target.value }))} />
                  </Form.Group>
                </Col>
                <Col md={12}>
                  <Form.Group>
                    <Form.Label>Agent</Form.Label>
                    <Form.Select value={ptpForm.agentId} onChange={(event) => setPtpForm((current) => ({ ...current, agentId: event.target.value }))}>
                      <option value="">Select agent</option>
                      {agents.map((agent) => <option key={agent._id} value={agent._id}>{agent.name}</option>)}
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={12}>
                  <Form.Group>
                    <Form.Label>Notes</Form.Label>
                    <Form.Control as="textarea" rows={3} value={ptpForm.notes} onChange={(event) => setPtpForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Customer commitment, payment mode, follow-up..." />
                  </Form.Group>
                </Col>
              </Row>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowPtp(false)}>Cancel</Button>
          <Button variant="success" onClick={handleCreatePtp} disabled={processing || !ptpForm.amount || !ptpForm.date || !ptpForm.agentId}>{processing ? 'Creating...' : 'Create PTP'}</Button>
        </Modal.Footer>
      </Modal>

      <style>{`
        .od-page { color: #0f172a; }
        .od-header { background: linear-gradient(135deg, #111827 0%, #991b1b 58%, #d97706 100%); border-radius: 18px; padding: 28px; color: #fff; display: flex; justify-content: space-between; gap: 18px; align-items: flex-start; box-shadow: 0 18px 45px rgba(15, 23, 42, 0.18); }
        .od-header h1 { margin: 2px 0 8px; font-size: 30px; font-weight: 850; letter-spacing: 0; }
        .od-header p { margin: 0; max-width: 790px; color: rgba(255,255,255,0.78); font-weight: 500; }
        .od-eyebrow { font-size: 12px; text-transform: uppercase; font-weight: 800; color: #fed7aa; }
        .od-header-actions { display: flex; gap: 10px; flex-wrap: wrap; justify-content: flex-end; }
        .od-header-actions .btn, .od-actions .btn, .od-table-head .btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; font-weight: 800; }
        .od-alert { margin: 16px 0 0; display: flex; align-items: center; gap: 8px; }
        .od-stat, .od-filter-panel, .od-table-card, .od-detail-box { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; box-shadow: 0 12px 30px rgba(15, 23, 42, 0.06); }
        .od-stat { min-height: 116px; padding: 17px; display: flex; gap: 13px; align-items: flex-start; }
        .od-stat-icon { width: 42px; height: 42px; border-radius: 12px; display: grid; place-items: center; color: #fff; flex-shrink: 0; }
        .od-stat-red .od-stat-icon { background: #dc2626; }
        .od-stat-amber .od-stat-icon { background: #d97706; }
        .od-stat-dark .od-stat-icon { background: #111827; }
        .od-stat-blue .od-stat-icon { background: #2563eb; }
        .od-stat span { display: block; font-size: 12px; color: #64748b; font-weight: 850; text-transform: uppercase; }
        .od-stat strong { display: block; margin-top: 3px; font-size: 20px; color: #0f172a; font-weight: 850; }
        .od-stat small { display: block; color: #64748b; font-weight: 700; margin-top: 3px; }
        .od-filter-panel { padding: 18px; margin: 18px 0; }
        .od-filter-panel label { font-size: 13px; color: #334155; font-weight: 850; }
        .od-bucket-strip { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 14px; }
        .od-bucket-strip button { min-width: 82px; border: 1px solid #e2e8f0; background: #f8fafc; border-radius: 10px; padding: 9px 11px; color: #475569; font-weight: 850; display: flex; justify-content: space-between; gap: 10px; }
        .od-bucket-strip button.active { background: #991b1b; color: #fff; border-color: #991b1b; }
        .od-table-card { overflow: hidden; }
        .od-table-head { padding: 18px 20px; display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; border-bottom: 1px solid #e2e8f0; }
        .od-table-head h2 { margin: 0; font-size: 19px; font-weight: 850; }
        .od-table-head p { margin: 4px 0 0; color: #64748b; font-weight: 600; }
        .od-table thead th { background: #f8fafc; color: #475569; font-size: 12px; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; white-space: nowrap; }
        .od-table td { vertical-align: middle; color: #334155; font-weight: 600; }
        .od-borrower { display: grid; gap: 5px; }
        .od-borrower span, .od-muted { display: block; color: #64748b; font-size: 12px; font-weight: 700; }
        .od-borrower span { display: inline-flex; align-items: center; gap: 5px; }
        .od-actions { display: flex; gap: 6px; flex-wrap: nowrap; }
        .od-detail-box { padding: 16px; height: 100%; }
        .od-detail-box h3 { font-size: 16px; font-weight: 850; margin-bottom: 12px; }
        .od-detail-box p { display: flex; justify-content: space-between; gap: 12px; padding: 10px 0; margin: 0; border-bottom: 1px solid #f1f5f9; }
        .od-detail-box span { color: #64748b; font-size: 12px; font-weight: 850; text-transform: uppercase; }
        .od-detail-box strong { text-align: right; overflow-wrap: anywhere; }
        @media (max-width: 768px) {
          .od-header { flex-direction: column; padding: 22px; }
          .od-header h1 { font-size: 25px; }
          .od-header-actions { width: 100%; justify-content: stretch; }
          .od-header-actions .btn { flex: 1; }
          .od-actions { flex-wrap: wrap; }
        }
      `}</style>
    </div>
  );
};

export default OverdueUsersList;
