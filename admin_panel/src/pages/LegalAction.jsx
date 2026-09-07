import { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, InputGroup, Modal, Row, Spinner, Table } from 'react-bootstrap';
import { Download, Eye, FileText, Gavel, Plus, RefreshCw, Search } from 'lucide-react';
import api from '../api/axios';

const unwrap = (res) => res?.data?.data || res?.data || {};
const currency = (value) => `Rs. ${Number(value || 0).toLocaleString('en-IN')}`;
const dateOnly = (value) => (value ? new Date(value).toLocaleDateString('en-IN') : 'N/A');
const dateTime = (value) => (value ? new Date(value).toLocaleString('en-IN') : 'N/A');

const actionLabels = {
  warning_notice: 'Warning Notice',
  legal_notice: 'Legal Notice',
  court_notice: 'Court Notice'
};

const noticeLabels = {
  warning: 'Warning',
  formal: 'Formal',
  court: 'Court'
};

const defaultForm = {
  loanId: '',
  actionType: 'warning_notice',
  noticeType: 'warning',
  language: 'english',
  message: '',
  sendEmail: true,
  sendSMS: true
};

const LegalAction = () => {
  const [actions, setActions] = useState([]);
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filters, setFilters] = useState({ search: '', status: '', actionType: '', language: '' });
  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [showStatus, setShowStatus] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [statusForm, setStatusForm] = useState({ status: 'sent', response: '', notes: '', followUpDate: '' });

  const loadData = async (filterValues = filters) => {
    try {
      setLoading(true);
      setError('');
      const params = new URLSearchParams();
      ['status', 'actionType', 'language'].forEach((key) => {
        if (filterValues[key]) params.set(key, filterValues[key]);
      });
      const [actionsRes, loansRes] = await Promise.all([
        api.get(`/admin/settlements/legal-actions${params.toString() ? `?${params.toString()}` : ''}`),
        api.get('/admin/settlements/loans/defaulted')
      ]);
      const actionsData = unwrap(actionsRes);
      const loansData = unwrap(loansRes);
      setActions(Array.isArray(actionsData) ? actionsData : []);
      setLoans((Array.isArray(loansData) ? loansData : []).filter((loan) => Number(loan.outstandingAmount || 0) > 0));
    } catch (err) {
      setActions([]);
      setLoans([]);
      setError(err.response?.data?.message || err.message || 'Legal actions data load nahi ho paya');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const stats = useMemo(() => ({
    total: actions.length,
    sent: actions.filter((item) => item.status === 'sent').length,
    escalated: actions.filter((item) => item.status === 'escalated').length,
    resolved: actions.filter((item) => item.status === 'resolved').length,
    exposure: loans.reduce((sum, loan) => sum + Number(loan.outstandingAmount || 0), 0)
  }), [actions, loans]);

  const filteredActions = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    if (!q) return actions;
    return actions.filter((item) =>
      item.userId?.name?.toLowerCase().includes(q) ||
      item.userId?.mobile?.includes(q) ||
      item.userId?.email?.toLowerCase().includes(q) ||
      item.loanId?.loanAccountNumber?.toLowerCase().includes(q) ||
      item.actionType?.toLowerCase().includes(q)
    );
  }, [actions, filters.search]);

  const selectedLoan = useMemo(
    () => loans.find((loan) => loan._id === form.loanId),
    [loans, form.loanId]
  );

  const buildMessage = (loan, actionType = form.actionType) => {
    if (!loan) return '';
    const borrower = loan.userId?.name || 'Customer';
    const account = loan.loanAccountNumber || loan._id;
    const amount = currency(loan.outstandingAmount);
    const templates = {
      warning_notice: `Dear ${borrower}, your Khatu Pay loan ${account} has outstanding dues of ${amount}. Please clear the pending amount immediately to avoid further action.`,
      legal_notice: `Dear ${borrower}, this is a formal legal notice for Khatu Pay loan ${account}. Outstanding amount ${amount} is pending. Contact support immediately to resolve this matter.`,
      court_notice: `Dear ${borrower}, court proceedings may be initiated for Khatu Pay loan ${account} due to unpaid outstanding amount of ${amount}. Contact Khatu Pay immediately.`
    };
    return templates[actionType] || templates.warning_notice;
  };

  const openCreate = (loan = null) => {
    const targetLoan = loan || loans[0] || null;
    setForm({
      ...defaultForm,
      loanId: targetLoan?._id || '',
      message: buildMessage(targetLoan, defaultForm.actionType)
    });
    setShowCreate(true);
  };

  const handleFormChange = (key, value) => {
    const nextForm = { ...form, [key]: value };
    if (key === 'loanId' || key === 'actionType') {
      const loan = key === 'loanId' ? loans.find((item) => item._id === value) : selectedLoan;
      nextForm.message = buildMessage(loan, nextForm.actionType);
      if (key === 'actionType') {
        nextForm.noticeType = value === 'court_notice' ? 'court' : value === 'legal_notice' ? 'formal' : 'warning';
      }
    }
    setForm(nextForm);
  };

  const createAction = async () => {
    if (!form.loanId || !form.message.trim()) {
      setError('Loan aur message required hai');
      return;
    }
    try {
      setSaving(true);
      setError('');
      await api.post(`/admin/settlements/loans/${form.loanId}/legal-action`, {
        actionType: form.actionType,
        noticeType: form.noticeType,
        language: form.language,
        message: form.message,
        sendEmail: form.sendEmail,
        sendSMS: form.sendSMS
      });
      setShowCreate(false);
      setSuccess('Legal action notice successfully created');
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Legal action create nahi ho paya');
    } finally {
      setSaving(false);
    }
  };

  const openStatus = (item) => {
    setSelected(item);
    setStatusForm({
      status: item.status || 'sent',
      response: item.response || '',
      notes: item.notes || '',
      followUpDate: item.followUpDate ? new Date(item.followUpDate).toISOString().slice(0, 10) : ''
    });
    setShowStatus(true);
  };

  const updateStatus = async () => {
    if (!selected) return;
    try {
      setSaving(true);
      setError('');
      await api.put(`/admin/settlements/legal-actions/${selected._id}/status`, {
        status: statusForm.status,
        response: statusForm.response,
        notes: statusForm.notes,
        followUpDate: statusForm.followUpDate || null
      });
      setShowStatus(false);
      setSuccess('Legal action status updated');
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Status update nahi ho paya');
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = () => {
    const rows = [
      ['Loan', 'Borrower', 'Mobile', 'Action', 'Status', 'Email Sent', 'SMS Sent', 'Follow Up', 'Created'],
      ...filteredActions.map((item) => [
        item.loanId?.loanAccountNumber || item.loanId?._id || '',
        item.userId?.name || '',
        item.userId?.mobile || '',
        actionLabels[item.actionType] || item.actionType,
        item.status,
        item.emailSent ? 'Yes' : 'No',
        item.smsSent ? 'Yes' : 'No',
        item.followUpDate || '',
        item.createdAt || ''
      ])
    ];
    const blob = new Blob([rows.map((row) => row.map((cell) => `"${String(cell || '').replace(/"/g, '""')}"`).join(',')).join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'legal-actions.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const resetFilters = () => {
    const cleanFilters = { search: '', status: '', actionType: '', language: '' };
    setFilters(cleanFilters);
    loadData(cleanFilters);
  };

  const statusBadge = (status) => {
    const variants = { initiated: 'secondary', sent: 'primary', responded: 'info', escalated: 'danger', resolved: 'success' };
    return <Badge bg={variants[status] || 'secondary'}>{String(status || 'N/A').replace(/_/g, ' ').toUpperCase()}</Badge>;
  };

  const actionBadge = (type) => {
    const variants = { warning_notice: 'warning', legal_notice: 'danger', court_notice: 'dark' };
    return <Badge bg={variants[type] || 'secondary'}>{actionLabels[type] || type || 'N/A'}</Badge>;
  };

  return (
    <div className="legal-page">
      <div className="legal-head">
        <div>
          <p>Recovery Desk</p>
          <h2><Gavel size={28} /> Legal Actions</h2>
          <span>Create notices, track communication status and manage follow-ups.</span>
        </div>
        <div className="legal-actions">
          <Button variant="outline-secondary" onClick={() => loadData()}><RefreshCw size={16} /> Refresh</Button>
          <Button variant="outline-success" onClick={exportCsv}><Download size={16} /> Export</Button>
          <Button onClick={() => openCreate()}><Plus size={16} /> New Notice</Button>
        </div>
      </div>

      {error && <Alert variant="warning" dismissible onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert variant="success" dismissible onClose={() => setSuccess('')}>{success}</Alert>}

      <Row className="g-3 mb-3">
        <Col md={3}><Card className="legal-stat"><span>Total Actions</span><strong>{stats.total}</strong><small>{stats.sent} notices sent</small></Card></Col>
        <Col md={3}><Card className="legal-stat danger"><span>Escalated</span><strong>{stats.escalated}</strong><small>Court/legal priority</small></Card></Col>
        <Col md={3}><Card className="legal-stat success"><span>Resolved</span><strong>{stats.resolved}</strong><small>Closed legal cases</small></Card></Col>
        <Col md={3}><Card className="legal-stat"><span>Open Exposure</span><strong>{currency(stats.exposure)}</strong><small>{loans.length} loans eligible</small></Card></Col>
      </Row>

      <Card className="legal-panel mb-3">
        <Row className="g-2">
          <Col xl={4} md={6}>
            <InputGroup>
              <InputGroup.Text><Search size={16} /></InputGroup.Text>
              <Form.Control placeholder="Search borrower, mobile, loan..." value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
            </InputGroup>
          </Col>
          <Col xl={2} md={6}>
            <Form.Select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
              <option value="">All Status</option>
              <option value="initiated">Initiated</option>
              <option value="sent">Sent</option>
              <option value="responded">Responded</option>
              <option value="escalated">Escalated</option>
              <option value="resolved">Resolved</option>
            </Form.Select>
          </Col>
          <Col xl={2} md={6}>
            <Form.Select value={filters.actionType} onChange={(e) => setFilters({ ...filters, actionType: e.target.value })}>
              <option value="">All Actions</option>
              <option value="warning_notice">Warning Notice</option>
              <option value="legal_notice">Legal Notice</option>
              <option value="court_notice">Court Notice</option>
            </Form.Select>
          </Col>
          <Col xl={2} md={6}>
            <Form.Select value={filters.language} onChange={(e) => setFilters({ ...filters, language: e.target.value })}>
              <option value="">All Languages</option>
              <option value="english">English</option>
              <option value="hindi">Hindi</option>
            </Form.Select>
          </Col>
          <Col xl={1} md={6}><Button className="w-100" variant="dark" onClick={() => loadData()}>Apply</Button></Col>
          <Col xl={1} md={6}><Button className="w-100" variant="outline-secondary" onClick={resetFilters}>Reset</Button></Col>
        </Row>
      </Card>

      <Card className="legal-table-card">
        <Table responsive hover className="align-middle mb-0">
          <thead>
            <tr><th>Loan</th><th>Borrower</th><th>Outstanding</th><th>Action</th><th>Status</th><th>Delivery</th><th>Follow Up</th><th className="text-end">Action</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="8" className="text-center py-5"><Spinner animation="border" size="sm" /> Loading legal actions...</td></tr>
            ) : filteredActions.length === 0 ? (
              <tr><td colSpan="8" className="text-center py-5">No legal actions found.</td></tr>
            ) : filteredActions.map((item) => (
              <tr key={item._id}>
                <td><strong>{item.loanId?.loanAccountNumber || item.loanId?._id || 'N/A'}</strong><small>{dateOnly(item.createdAt)}</small></td>
                <td>{item.userId?.name || 'N/A'}<small>{item.userId?.mobile || item.userId?.email}</small></td>
                <td className="fw-bold text-danger">{currency(getOutstanding(item.loanId))}</td>
                <td>{actionBadge(item.actionType)}<small>{noticeLabels[item.noticeType] || item.noticeType}</small></td>
                <td>{statusBadge(item.status)}</td>
                <td><small>Email: {item.emailSent ? 'Sent' : 'Pending'}</small><small>SMS: {item.smsSent ? 'Sent' : 'Pending'}</small></td>
                <td>{dateOnly(item.followUpDate)}</td>
                <td>
                  <div className="legal-row-actions justify-content-end">
                    <Button size="sm" variant="outline-primary" onClick={() => { setSelected(item); setShowDetail(true); }}><Eye size={14} /></Button>
                    <Button size="sm" variant="outline-warning" onClick={() => openStatus(item)}>Update</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <Modal show={showCreate} onHide={() => setShowCreate(false)} size="lg">
        <Modal.Header closeButton><Modal.Title>Create Legal Notice</Modal.Title></Modal.Header>
        <Modal.Body>
          <Row className="g-3">
            <Col md={12}>
              <Form.Label>Borrower / Loan</Form.Label>
              <Form.Select value={form.loanId} onChange={(e) => handleFormChange('loanId', e.target.value)}>
                <option value="">Select eligible loan</option>
                {loans.map((loan) => (
                  <option value={loan._id} key={loan._id}>
                    {loan.userId?.name || 'N/A'} - {loan.loanAccountNumber || loan._id} - {currency(loan.outstandingAmount)}
                  </option>
                ))}
              </Form.Select>
            </Col>
            <Col md={4}>
              <Form.Label>Action Type</Form.Label>
              <Form.Select value={form.actionType} onChange={(e) => handleFormChange('actionType', e.target.value)}>
                <option value="warning_notice">Warning Notice</option>
                <option value="legal_notice">Legal Notice</option>
                <option value="court_notice">Court Notice</option>
              </Form.Select>
            </Col>
            <Col md={4}>
              <Form.Label>Notice Type</Form.Label>
              <Form.Select value={form.noticeType} onChange={(e) => handleFormChange('noticeType', e.target.value)}>
                <option value="warning">Warning</option>
                <option value="formal">Formal</option>
                <option value="court">Court</option>
              </Form.Select>
            </Col>
            <Col md={4}>
              <Form.Label>Language</Form.Label>
              <Form.Select value={form.language} onChange={(e) => handleFormChange('language', e.target.value)}>
                <option value="english">English</option>
                <option value="hindi">Hindi</option>
              </Form.Select>
            </Col>
            {selectedLoan && (
              <Col md={12}>
                <div className="legal-loan-strip">
                  <span>{selectedLoan.userId?.name}</span>
                  <strong>{currency(selectedLoan.outstandingAmount)} outstanding</strong>
                  <small>{selectedLoan.userId?.mobile || selectedLoan.userId?.email}</small>
                </div>
              </Col>
            )}
            <Col md={12}>
              <Form.Label>Notice Message</Form.Label>
              <Form.Control as="textarea" rows={5} value={form.message} onChange={(e) => handleFormChange('message', e.target.value)} />
            </Col>
            <Col md={12}>
              <div className="legal-checks">
                <Form.Check type="switch" label="Send Email" checked={form.sendEmail} onChange={(e) => handleFormChange('sendEmail', e.target.checked)} />
                <Form.Check type="switch" label="Send SMS" checked={form.sendSMS} onChange={(e) => handleFormChange('sendSMS', e.target.checked)} />
              </div>
            </Col>
          </Row>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
          <Button disabled={saving} onClick={createAction}>{saving ? 'Sending...' : 'Create Notice'}</Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showDetail} onHide={() => setShowDetail(false)} size="lg">
        <Modal.Header closeButton><Modal.Title>Legal Action Details</Modal.Title></Modal.Header>
        <Modal.Body>
          {selected && (
            <>
              <div className="detail-grid mb-3">
                <Info label="Borrower" value={selected.userId?.name} />
                <Info label="Loan" value={selected.loanId?.loanAccountNumber || selected.loanId?._id} />
                <Info label="Action" value={actionLabels[selected.actionType] || selected.actionType} />
                <Info label="Status" value={selected.status} />
                <Info label="Email Sent" value={selected.emailSent ? dateTime(selected.emailSentAt) : 'No'} />
                <Info label="SMS Sent" value={selected.smsSent ? dateTime(selected.smsSentAt) : 'No'} />
                <Info label="Follow Up" value={dateOnly(selected.followUpDate)} />
                <Info label="Created" value={dateTime(selected.createdAt)} />
              </div>
              <Form.Label>Message</Form.Label>
              <Form.Control as="textarea" rows={5} value={selected.message || ''} readOnly />
            </>
          )}
        </Modal.Body>
        <Modal.Footer><Button variant="outline-secondary" onClick={() => setShowDetail(false)}>Close</Button></Modal.Footer>
      </Modal>

      <Modal show={showStatus} onHide={() => setShowStatus(false)}>
        <Modal.Header closeButton><Modal.Title>Update Legal Action</Modal.Title></Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>Status</Form.Label>
            <Form.Select value={statusForm.status} onChange={(e) => setStatusForm({ ...statusForm, status: e.target.value })}>
              <option value="initiated">Initiated</option>
              <option value="sent">Sent</option>
              <option value="responded">Responded</option>
              <option value="escalated">Escalated</option>
              <option value="resolved">Resolved</option>
            </Form.Select>
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Follow Up Date</Form.Label>
            <Form.Control type="date" value={statusForm.followUpDate} onChange={(e) => setStatusForm({ ...statusForm, followUpDate: e.target.value })} />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Borrower Response</Form.Label>
            <Form.Control as="textarea" rows={3} value={statusForm.response} onChange={(e) => setStatusForm({ ...statusForm, response: e.target.value })} />
          </Form.Group>
          <Form.Group>
            <Form.Label>Internal Notes</Form.Label>
            <Form.Control as="textarea" rows={3} value={statusForm.notes} onChange={(e) => setStatusForm({ ...statusForm, notes: e.target.value })} />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setShowStatus(false)}>Cancel</Button>
          <Button disabled={saving} onClick={updateStatus}>{saving ? 'Updating...' : 'Update Status'}</Button>
        </Modal.Footer>
      </Modal>

      <style>{`
        .legal-page{padding:8px 0 24px;color:#111827}.legal-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:18px}.legal-head p{margin:0 0 4px;color:#991b1b;font-size:12px;font-weight:900;text-transform:uppercase}.legal-head h2{display:flex;align-items:center;gap:10px;margin:0;font-weight:850}.legal-head span,.legal-table-card td small{color:#64748b}.legal-actions,.legal-row-actions,.legal-checks{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.legal-actions .btn,.legal-row-actions .btn{display:inline-flex;align-items:center;gap:6px}
        .legal-stat,.legal-panel,.legal-table-card{border:1px solid #e5e7eb;border-radius:8px;box-shadow:0 10px 26px rgba(15,23,42,.06)}.legal-stat{padding:16px}.legal-stat span,.legal-stat small{color:#64748b;font-weight:800}.legal-stat strong{display:block;font-size:24px;margin:4px 0}.legal-stat.danger strong{color:#b91c1c}.legal-stat.success strong{color:#047857}.legal-panel{padding:16px}.legal-table-card{overflow:hidden}.legal-table-card thead th{background:#f8fafc;color:#475569;font-size:12px;text-transform:uppercase}.legal-table-card td small{display:block}.legal-loan-strip{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:12px;border:1px solid #fee2e2;background:#fff7ed;border-radius:8px}.detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.info-box{padding:12px;border:1px solid #e5e7eb;border-radius:8px;background:#f8fafc}.info-box span{display:block;color:#64748b;font-size:12px;font-weight:900;text-transform:uppercase}.info-box strong{display:block;margin-top:4px}
        @media(max-width:768px){.legal-head{flex-direction:column}.legal-actions .btn{flex:1;justify-content:center}.detail-grid{grid-template-columns:1fr}.legal-loan-strip{align-items:flex-start;flex-direction:column}}
      `}</style>
    </div>
  );
};

const getOutstanding = (loan) => {
  if (!loan) return 0;
  if (loan.outstandingAmount) return loan.outstandingAmount;
  if (!Array.isArray(loan.schedule)) return 0;
  return loan.schedule.reduce((sum, item) => sum + (item.paid ? 0 : Number(item.total || 0)), 0);
};

const Info = ({ label, value }) => (
  <div className="info-box"><span>{label}</span><strong>{value || 'N/A'}</strong></div>
);

export default LegalAction;
