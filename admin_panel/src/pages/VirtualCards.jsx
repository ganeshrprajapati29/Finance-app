import { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, InputGroup, ListGroup, Modal, Row, Table } from 'react-bootstrap';
import { CreditCard, Download, Eye, Plus, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import api from '../api/axios';

const services = ['BILLS', 'RECHARGE', 'QR', 'LOAN_EMI', 'WALLET'];
const statuses = ['APPLIED', 'UNDER_REVIEW', 'APPROVED', 'ACTIVE', 'FROZEN', 'BLOCKED', 'REJECTED', 'EXPIRED'];
const blankCreate = {
  userId: '',
  userText: '',
  cardholderName: '',
  mobile: '',
  email: '',
  purpose: 'KhatuPay services',
  monthlyLimit: 10000,
  allowedServices: services,
  activateNow: true,
  adminNote: ''
};

const unwrap = (res) => res?.data?.data || res?.data || {};
const money = (value) => `Rs. ${Number(value || 0).toLocaleString('en-IN')}`;
const dateTime = (value) => (value ? new Date(value).toLocaleString('en-IN') : 'N/A');

export default function VirtualCards() {
  const [cards, setCards] = useState([]);
  const [users, setUsers] = useState([]);
  const [filters, setFilters] = useState({ search: '', status: 'ALL' });
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [detail, setDetail] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(blankCreate);
  const [statusForm, setStatusForm] = useState({ status: 'UNDER_REVIEW', rejectionReason: '', adminNote: '', monthlyLimit: 10000, allowedServices: services });

  const fetchCards = async () => {
    try {
      setLoading(true);
      setError('');
      const query = new URLSearchParams({
        page: String(pagination.page),
        limit: String(pagination.limit),
        status: filters.status
      });
      if (filters.search.trim()) query.set('search', filters.search.trim());
      const res = await api.get(`/admin/virtual-cards?${query.toString()}`);
      const data = unwrap(res);
      setCards(data.items || []);
      setStats(data.stats || []);
      setPagination((current) => ({ ...current, total: data.total || 0 }));
    } catch (err) {
      setCards([]);
      setError(err.response?.data?.message || err.message || 'Virtual cards load nahi hue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCards(); }, [pagination.page, pagination.limit, filters.status]);

  const statMap = useMemo(() => Object.fromEntries(stats.map((item) => [item._id, item.count])), [stats]);
  const pages = Math.max(1, Math.ceil((pagination.total || 0) / pagination.limit));

  const searchUsers = async (term) => {
    setCreateForm((current) => ({ ...current, userText: term }));
    if (term.trim().length < 2) return setUsers([]);
    try {
      const res = await api.get(`/admin/users/search?q=${encodeURIComponent(term.trim())}`);
      const data = unwrap(res);
      setUsers(Array.isArray(data.items) ? data.items : Array.isArray(data) ? data : []);
    } catch {
      setUsers([]);
    }
  };

  const createCard = async () => {
    if (!createForm.userId) return setError('User select karein');
    try {
      setSaving(true);
      const { userText, ...payload } = createForm;
      await api.post('/admin/virtual-cards', { ...payload, monthlyLimit: Number(payload.monthlyLimit || 0) });
      setSuccess('Virtual card create ho gaya aur user ko email bhej diya gaya.');
      setShowCreate(false);
      setCreateForm(blankCreate);
      fetchCards();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Card create nahi hua');
    } finally {
      setSaving(false);
    }
  };

  const openDetail = async (card) => {
    try {
      const res = await api.get(`/admin/virtual-cards/${card._id}`);
      const fresh = unwrap(res);
      setDetail(fresh);
      setStatusForm({
        status: fresh.status || 'UNDER_REVIEW',
        rejectionReason: fresh.rejectionReason || '',
        adminNote: fresh.adminNote || '',
        monthlyLimit: fresh.monthlyLimit || 10000,
        allowedServices: fresh.allowedServices || services
      });
    } catch {
      setDetail(card);
    }
  };

  const updateStatus = async () => {
    if (!detail) return;
    try {
      setSaving(true);
      const res = await api.put(`/admin/virtual-cards/${detail._id}/status`, {
        ...statusForm,
        monthlyLimit: Number(statusForm.monthlyLimit || 0)
      });
      setDetail(unwrap(res));
      setSuccess('Virtual card update ho gaya aur email notification trigger hua.');
      fetchCards();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Status update nahi hua');
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = () => {
    const rows = [
      ['Application', 'Card ID', 'User', 'Mobile', 'Status', 'Limit', 'Services'],
      ...cards.map((card) => [card.applicationNo, card.cardId || '', card.cardholderName, card.mobile, card.status, card.monthlyLimit, (card.allowedServices || []).join('|')])
    ];
    const blob = new Blob([rows.map((row) => row.map((cell) => `"${String(cell || '').replace(/"/g, '""')}"`).join(',')).join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'khatu-virtual-cards.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const badge = (status) => {
    const map = { ACTIVE: 'success', APPROVED: 'primary', APPLIED: 'warning', UNDER_REVIEW: 'info', FROZEN: 'secondary', BLOCKED: 'danger', REJECTED: 'secondary', EXPIRED: 'dark' };
    return <Badge bg={map[status] || 'secondary'}>{status}</Badge>;
  };

  return (
    <div className="vc-page">
      <div className="vc-header">
        <div>
          <div className="vc-eyebrow">KhatuPay Services Only</div>
          <h1><CreditCard size={30} /> Virtual Cards</h1>
          <p>Create, approve, block and manage KhatuPay-only virtual service cards. Not a bank/RBI card.</p>
        </div>
        <div className="vc-actions">
          <Button variant="light" onClick={() => setShowCreate(true)}><Plus size={16} /> Create Card</Button>
          <Button variant="outline-light" onClick={fetchCards}><RefreshCw size={16} /> Refresh</Button>
          <Button variant="outline-light" onClick={exportCsv}><Download size={16} /> Export</Button>
        </div>
      </div>

      {error && <Alert variant="danger" className="mt-3" dismissible onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert variant="success" className="mt-3" dismissible onClose={() => setSuccess('')}>{success}</Alert>}

      <Row className="g-3 mt-1">
        <Col md={3}><Card className="vc-stat"><span>Total</span><strong>{pagination.total}</strong><small>Applications/cards</small></Card></Col>
        <Col md={3}><Card className="vc-stat success"><span>Active</span><strong>{statMap.ACTIVE || 0}</strong><small>Usable in app</small></Card></Col>
        <Col md={3}><Card className="vc-stat"><span>Pending</span><strong>{(statMap.APPLIED || 0) + (statMap.UNDER_REVIEW || 0)}</strong><small>Needs review</small></Card></Col>
        <Col md={3}><Card className="vc-stat danger"><span>Blocked</span><strong>{statMap.BLOCKED || 0}</strong><small>Disabled cards</small></Card></Col>
      </Row>

      <Card className="vc-panel">
        <Row className="g-2">
          <Col lg={5}>
            <InputGroup><InputGroup.Text><Search size={16} /></InputGroup.Text><Form.Control value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && fetchCards()} placeholder="Search user, mobile, application, card..." /></InputGroup>
          </Col>
          <Col lg={3}>
            <Form.Select value={filters.status} onChange={(e) => { setFilters({ ...filters, status: e.target.value }); setPagination({ ...pagination, page: 1 }); }}>
              <option value="ALL">All Status</option>
              {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
            </Form.Select>
          </Col>
          <Col lg={2}><Form.Select value={pagination.limit} onChange={(e) => setPagination({ ...pagination, limit: Number(e.target.value), page: 1 })}><option value={10}>10 rows</option><option value={20}>20 rows</option><option value={50}>50 rows</option></Form.Select></Col>
          <Col lg={2}><Button variant="dark" className="w-100" onClick={fetchCards}>Apply</Button></Col>
        </Row>
      </Card>

      <Card className="vc-table-card">
        <Table responsive hover className="align-middle mb-0">
          <thead><tr><th>Card/User</th><th>Application</th><th>Limit</th><th>Services</th><th>Status</th><th>Created</th><th className="text-end">Action</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan="7" className="text-center py-5">Loading virtual cards...</td></tr> : cards.length === 0 ? <tr><td colSpan="7" className="text-center py-5">No virtual cards found.</td></tr> : cards.map((card) => (
              <tr key={card._id}>
                <td><strong>{card.cardholderName}</strong><span>{card.userId?.mobile || card.mobile} • {card.userId?.email || card.email}</span></td>
                <td><strong>{card.applicationNo}</strong><span>{card.cardNumberMasked || 'Card not issued yet'}</span></td>
                <td><strong>{money(card.monthlyLimit)}</strong><span>{card.cardId || 'Pending'}</span></td>
                <td>{(card.allowedServices || []).map((item) => <Badge bg="light" text="dark" className="me-1" key={item}>{item}</Badge>)}</td>
                <td>{badge(card.status)}</td>
                <td>{dateTime(card.createdAt)}</td>
                <td className="text-end"><Button size="sm" variant="outline-primary" onClick={() => openDetail(card)}><Eye size={14} /></Button></td>
              </tr>
            ))}
          </tbody>
        </Table>
        <div className="vc-pagination">
          <span>Page {pagination.page} of {pages}</span>
          <div><Button size="sm" variant="outline-secondary" disabled={pagination.page <= 1} onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}>Previous</Button><Button size="sm" variant="outline-secondary" disabled={pagination.page >= pages} onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}>Next</Button></div>
        </div>
      </Card>

      <Modal show={showCreate} onHide={() => setShowCreate(false)} size="lg" centered>
        <Modal.Header closeButton><Modal.Title>Create KhatuPay Virtual Card</Modal.Title></Modal.Header>
        <Modal.Body>
          <Alert variant="warning">This card is only for KhatuPay services. It is not a bank/RBI network card.</Alert>
          <Row className="g-3">
            <Col md={12}>
              <Form.Label>User</Form.Label>
              <div className="position-relative">
                <InputGroup><InputGroup.Text><Search size={16} /></InputGroup.Text><Form.Control value={createForm.userText} onChange={(e) => searchUsers(e.target.value)} placeholder="Search user..." /></InputGroup>
                {users.length > 0 && <ListGroup className="position-absolute w-100 shadow" style={{ zIndex: 20 }}>{users.map((user) => <ListGroup.Item action key={user._id} onClick={() => { setCreateForm({ ...createForm, userId: user._id, userText: `${user.name} (${user.mobile || user.email})`, cardholderName: user.name || '', mobile: user.mobile || '', email: user.email || '' }); setUsers([]); }}>{user.name}<br /><small>{user.mobile} {user.email}</small></ListGroup.Item>)}</ListGroup>}
              </div>
            </Col>
            <Col md={6}><Form.Label>Name on Card</Form.Label><Form.Control value={createForm.cardholderName} onChange={(e) => setCreateForm({ ...createForm, cardholderName: e.target.value })} /></Col>
            <Col md={6}><Form.Label>Monthly Limit</Form.Label><Form.Control type="number" value={createForm.monthlyLimit} onChange={(e) => setCreateForm({ ...createForm, monthlyLimit: e.target.value })} /></Col>
            <Col md={6}><Form.Label>Mobile</Form.Label><Form.Control value={createForm.mobile} onChange={(e) => setCreateForm({ ...createForm, mobile: e.target.value })} /></Col>
            <Col md={6}><Form.Label>Email</Form.Label><Form.Control value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} /></Col>
            <Col md={12}><Form.Label>Purpose</Form.Label><Form.Control value={createForm.purpose} onChange={(e) => setCreateForm({ ...createForm, purpose: e.target.value })} /></Col>
            <Col md={12}>
              <Form.Label>Allowed Services</Form.Label>
              <div className="vc-checks">{services.map((item) => <Form.Check inline key={item} label={item} checked={createForm.allowedServices.includes(item)} onChange={(e) => setCreateForm((current) => ({ ...current, allowedServices: e.target.checked ? [...current.allowedServices, item] : current.allowedServices.filter((value) => value !== item) }))} />)}</div>
            </Col>
            <Col md={12}><Form.Check type="switch" label="Activate immediately" checked={createForm.activateNow} onChange={(e) => setCreateForm({ ...createForm, activateNow: e.target.checked })} /></Col>
          </Row>
        </Modal.Body>
        <Modal.Footer><Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button><Button onClick={createCard} disabled={saving}>{saving ? 'Creating...' : 'Create Card'}</Button></Modal.Footer>
      </Modal>

      <Modal show={!!detail} onHide={() => setDetail(null)} size="lg" centered>
        <Modal.Header closeButton><Modal.Title>Virtual Card Control</Modal.Title></Modal.Header>
        <Modal.Body>{detail && (
          <Row className="g-3">
            <Col md={5}>
              <div className="vc-card-preview">
                <div><ShieldCheck size={26} /><span>KhatuPay Only</span></div>
                <strong>{detail.cardNumberMasked || 'XXXX XXXX XXXX XXXX'}</strong>
                <p>{detail.cardholderName}</p>
                <small>EXP {detail.expiryMonth || '--'}/{detail.expiryYear || '--'} • CVV {detail.cvv ? '***' : '---'}</small>
              </div>
              <div className="vc-note">Not a bank/RBI card. Only eligible KhatuPay services can use this card.</div>
            </Col>
            <Col md={7}>
              <Table size="sm" bordered><tbody>
                <tr><th>User</th><td>{detail.userId?.name || detail.cardholderName}</td></tr>
                <tr><th>Application</th><td>{detail.applicationNo}</td></tr>
                <tr><th>Card ID</th><td>{detail.cardId || 'Pending'}</td></tr>
                <tr><th>Email</th><td>{detail.email || 'N/A'}</td></tr>
                <tr><th>Status</th><td>{badge(detail.status)}</td></tr>
              </tbody></Table>
              <Row className="g-2">
                <Col md={6}><Form.Label>Status</Form.Label><Form.Select value={statusForm.status} onChange={(e) => setStatusForm({ ...statusForm, status: e.target.value })}>{statuses.filter((s) => s !== 'APPLIED').map((status) => <option key={status} value={status}>{status}</option>)}</Form.Select></Col>
                <Col md={6}><Form.Label>Monthly Limit</Form.Label><Form.Control type="number" value={statusForm.monthlyLimit} onChange={(e) => setStatusForm({ ...statusForm, monthlyLimit: e.target.value })} /></Col>
                <Col md={12}><Form.Label>Allowed Services</Form.Label><div className="vc-checks">{services.map((item) => <Form.Check inline key={item} label={item} checked={statusForm.allowedServices.includes(item)} onChange={(e) => setStatusForm((current) => ({ ...current, allowedServices: e.target.checked ? [...current.allowedServices, item] : current.allowedServices.filter((value) => value !== item) }))} />)}</div></Col>
                <Col md={12}><Form.Label>Rejection Reason</Form.Label><Form.Control value={statusForm.rejectionReason} onChange={(e) => setStatusForm({ ...statusForm, rejectionReason: e.target.value })} /></Col>
                <Col md={12}><Form.Label>Admin Note</Form.Label><Form.Control as="textarea" rows={2} value={statusForm.adminNote} onChange={(e) => setStatusForm({ ...statusForm, adminNote: e.target.value })} /></Col>
              </Row>
            </Col>
          </Row>
        )}</Modal.Body>
        <Modal.Footer><Button variant="secondary" onClick={() => setDetail(null)}>Close</Button><Button onClick={updateStatus} disabled={saving}>{saving ? 'Updating...' : 'Update & Notify User'}</Button></Modal.Footer>
      </Modal>

      <style>{`
        .vc-header{background:linear-gradient(135deg,#0f172a,#0f766e 55%,#2563eb);border-radius:18px;padding:28px;color:#fff;display:flex;justify-content:space-between;gap:18px;box-shadow:0 18px 45px rgba(15,23,42,.18)}.vc-header h1{display:flex;align-items:center;gap:10px;margin:2px 0 8px;font-size:30px;font-weight:850}.vc-header p{margin:0;color:rgba(255,255,255,.8);font-weight:600}.vc-eyebrow{font-size:12px;text-transform:uppercase;font-weight:900;color:#bfdbfe}.vc-actions{display:flex;gap:10px;flex-wrap:wrap}.vc-actions .btn{display:inline-flex;align-items:center;gap:8px;font-weight:800}.vc-stat,.vc-panel,.vc-table-card{background:#fff;border:1px solid #e2e8f0;border-radius:14px;box-shadow:0 12px 30px rgba(15,23,42,.06)}.vc-stat{padding:16px}.vc-stat span,.vc-stat small,.vc-table-card td span{display:block;color:#64748b;font-weight:800}.vc-stat strong{font-size:24px;color:#0f172a}.vc-stat.success strong{color:#059669}.vc-stat.danger strong{color:#dc2626}.vc-panel{padding:16px;margin:18px 0}.vc-table-card{overflow:hidden}.vc-table-card thead th{background:#f8fafc;color:#475569;font-size:12px;text-transform:uppercase}.vc-pagination{display:flex;justify-content:space-between;padding:14px 18px;border-top:1px solid #e2e8f0}.vc-pagination div{display:flex;gap:8px}.vc-checks{display:flex;gap:12px;flex-wrap:wrap}.vc-card-preview{min-height:220px;border-radius:22px;padding:22px;color:#fff;background:linear-gradient(135deg,#0f172a,#0f766e,#2563eb);box-shadow:0 18px 34px rgba(15,23,42,.18);display:flex;flex-direction:column;justify-content:space-between}.vc-card-preview div{display:flex;align-items:center;gap:8px;font-weight:900}.vc-card-preview strong{font-size:22px;letter-spacing:1.2px}.vc-card-preview p{margin:0;font-weight:900}.vc-card-preview small{color:rgba(255,255,255,.75);font-weight:800}.vc-note{margin-top:12px;padding:12px;border-radius:12px;background:#fffbeb;color:#78350f;font-weight:800}@media(max-width:768px){.vc-header{flex-direction:column;padding:22px}.vc-actions .btn{flex:1;justify-content:center}.vc-pagination{flex-direction:column;gap:10px}}
      `}</style>
    </div>
  );
}
