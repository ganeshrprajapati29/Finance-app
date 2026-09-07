import { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, InputGroup, Modal, Pagination, Row, Spinner, Table } from 'react-bootstrap';
import { Bell, Download, Eye, RefreshCw, Search, Send, Users } from 'lucide-react';
import api from '../api/axios';

const unwrap = (res) => res?.data?.data || res?.data || {};
const dateTime = (value) => (value ? new Date(value).toLocaleString('en-IN') : 'N/A');

const typeLabels = { general: 'General', loan: 'Loan', payment: 'Payment', kyc: 'KYC', support: 'Support' };

const NotificationHistory = () => {
  const [history, setHistory] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [filters, setFilters] = useState({ search: '', sentTo: '', type: '', priority: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const limit = 20;

  const load = async (page = pagination.page, filterValues = filters) => {
    try {
      setLoading(true);
      setError('');
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      ['search', 'sentTo', 'type', 'priority'].forEach((key) => {
        if (filterValues[key]) params.set(key, filterValues[key]);
      });
      const res = await api.get(`/admin/notification-history?${params.toString()}`);
      const data = unwrap(res);
      setHistory(Array.isArray(data.history) ? data.history : []);
      setPagination(data.pagination || { page, pages: 1, total: 0 });
    } catch (err) {
      setHistory([]);
      setPagination({ page: 1, pages: 1, total: 0 });
      setError(err.response?.data?.message || err.message || 'Notification history load nahi ho paya');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(1);
  }, []);

  const stats = useMemo(() => ({
    total: pagination.total || history.length,
    broadcasts: history.filter((item) => item.sentTo === 'all').length,
    targeted: history.filter((item) => item.sentTo === 'user').length,
    recipients: history.reduce((sum, item) => sum + Number(item.totalRecipients || 0), 0),
    fcmSent: history.reduce((sum, item) => sum + Number(item.fcmSent || 0), 0)
  }), [history, pagination.total]);

  const exportCsv = () => {
    const rows = [
      ['Title', 'Message', 'Audience', 'Type', 'Priority', 'Recipients', 'FCM Sent', 'FCM Failed', 'User', 'Sent By', 'Sent At'],
      ...history.map((item) => [
        item.title,
        item.message,
        item.sentTo,
        item.type,
        item.priority,
        item.totalRecipients,
        item.fcmSent,
        item.fcmFailed,
        item.userId?.email || item.userId?.mobile || '',
        item.sentBy?.email || item.sentBy?.name || '',
        item.sentAt || item.createdAt
      ])
    ];
    const blob = new Blob([rows.map((row) => row.map((cell) => `"${String(cell || '').replace(/"/g, '""')}"`).join(',')).join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'notification-history.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const resetFilters = () => {
    const cleanFilters = { search: '', sentTo: '', type: '', priority: '' };
    setFilters(cleanFilters);
    load(1, cleanFilters);
  };

  const audienceBadge = (sentTo) => (
    <Badge bg={sentTo === 'all' ? 'primary' : 'info'}>{sentTo === 'all' ? 'All Users' : 'Specific User'}</Badge>
  );

  const priorityBadge = (priority) => {
    const variants = { HIGH: 'danger', MEDIUM: 'warning', LOW: 'secondary' };
    return <Badge bg={variants[priority] || 'secondary'}>{priority || 'MEDIUM'}</Badge>;
  };

  return (
    <div className="history-page">
      <div className="history-head">
        <div>
          <p>Communication</p>
          <h2><Bell size={28} /> Notification History</h2>
          <span>Audit every push notification campaign, audience and delivery count.</span>
        </div>
        <div className="history-actions">
          <Button variant="outline-secondary" onClick={() => load(pagination.page)}><RefreshCw size={16} /> Refresh</Button>
          <Button variant="outline-success" onClick={exportCsv}><Download size={16} /> Export</Button>
        </div>
      </div>

      {error && <Alert variant="warning" dismissible onClose={() => setError('')}>{error}</Alert>}

      <Row className="g-3 mb-3">
        <Col md={3}><Card className="history-stat"><Send /><span>Total Sent</span><strong>{stats.total}</strong><small>Matching history</small></Card></Col>
        <Col md={3}><Card className="history-stat"><Users /><span>Broadcasts</span><strong>{stats.broadcasts}</strong><small>Current page</small></Card></Col>
        <Col md={3}><Card className="history-stat"><Bell /><span>Recipients</span><strong>{stats.recipients}</strong><small>Current page reach</small></Card></Col>
        <Col md={3}><Card className="history-stat success"><Bell /><span>FCM Sent</span><strong>{stats.fcmSent}</strong><small>Device pushes</small></Card></Col>
      </Row>

      <Card className="history-panel mb-3">
        <Row className="g-2">
          <Col xl={4} md={6}>
            <InputGroup>
              <InputGroup.Text><Search size={16} /></InputGroup.Text>
              <Form.Control placeholder="Search title or message..." value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
            </InputGroup>
          </Col>
          <Col xl={2} md={6}>
            <Form.Select value={filters.sentTo} onChange={(e) => setFilters({ ...filters, sentTo: e.target.value })}>
              <option value="">All Audience</option>
              <option value="all">All Users</option>
              <option value="user">Specific User</option>
            </Form.Select>
          </Col>
          <Col xl={2} md={6}>
            <Form.Select value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })}>
              <option value="">All Types</option>
              <option value="general">General</option>
              <option value="loan">Loan</option>
              <option value="payment">Payment</option>
              <option value="kyc">KYC</option>
              <option value="support">Support</option>
            </Form.Select>
          </Col>
          <Col xl={2} md={6}>
            <Form.Select value={filters.priority} onChange={(e) => setFilters({ ...filters, priority: e.target.value })}>
              <option value="">All Priority</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </Form.Select>
          </Col>
          <Col xl={1} md={6}><Button className="w-100" variant="dark" onClick={() => load(1)}>Apply</Button></Col>
          <Col xl={1} md={6}><Button className="w-100" variant="outline-secondary" onClick={resetFilters}>Reset</Button></Col>
        </Row>
      </Card>

      <Card className="history-table-card">
        <Table responsive hover className="align-middle mb-0">
          <thead>
            <tr><th>Notification</th><th>Audience</th><th>Type</th><th>Priority</th><th>Recipients</th><th>FCM</th><th>Sent By</th><th>Sent At</th><th className="text-end">Action</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="9" className="text-center py-5"><Spinner animation="border" size="sm" /> Loading...</td></tr>
            ) : history.length === 0 ? (
              <tr><td colSpan="9" className="text-center py-5">No notification history found.</td></tr>
            ) : history.map((item) => (
              <tr key={item._id}>
                <td><strong>{item.title}</strong><small>{item.message}</small></td>
                <td>{audienceBadge(item.sentTo)}<small>{item.userId?.name || item.userId?.mobile || item.userId?.email || ''}</small></td>
                <td>{typeLabels[item.type] || item.type || 'General'}</td>
                <td>{priorityBadge(item.priority)}</td>
                <td className="fw-bold">{item.totalRecipients || 0}</td>
                <td><small>Sent: {item.fcmSent || 0}</small><small>Failed: {item.fcmFailed || 0}</small></td>
                <td>{item.sentBy?.name || item.sentBy?.email || 'Admin'}</td>
                <td>{dateTime(item.sentAt || item.createdAt)}</td>
                <td className="text-end"><Button size="sm" variant="outline-primary" onClick={() => { setSelected(item); setShowDetail(true); }}><Eye size={14} /></Button></td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      {pagination.pages > 1 && (
        <Pagination className="justify-content-center mt-3">
          <Pagination.Prev disabled={pagination.page <= 1} onClick={() => load(pagination.page - 1)} />
          <Pagination.Item active>{pagination.page}</Pagination.Item>
          <Pagination.Next disabled={pagination.page >= pagination.pages} onClick={() => load(pagination.page + 1)} />
        </Pagination>
      )}

      <Modal show={showDetail} onHide={() => setShowDetail(false)} size="lg">
        <Modal.Header closeButton><Modal.Title>Notification Details</Modal.Title></Modal.Header>
        <Modal.Body>
          {selected && (
            <>
              <div className="detail-grid mb-3">
                <Info label="Audience" value={selected.sentTo === 'all' ? 'All Users' : 'Specific User'} />
                <Info label="Recipient" value={selected.userId?.name || selected.userId?.email || selected.userId?.mobile || 'N/A'} />
                <Info label="Type" value={typeLabels[selected.type] || selected.type || 'General'} />
                <Info label="Priority" value={selected.priority || 'MEDIUM'} />
                <Info label="Recipients" value={selected.totalRecipients || 0} />
                <Info label="FCM Sent" value={selected.fcmSent || 0} />
                <Info label="FCM Failed" value={selected.fcmFailed || 0} />
                <Info label="Sent At" value={dateTime(selected.sentAt || selected.createdAt)} />
              </div>
              <Form.Label>Title</Form.Label>
              <Form.Control className="mb-3" value={selected.title || ''} readOnly />
              <Form.Label>Message</Form.Label>
              <Form.Control as="textarea" rows={5} value={selected.message || ''} readOnly />
            </>
          )}
        </Modal.Body>
        <Modal.Footer><Button variant="outline-secondary" onClick={() => setShowDetail(false)}>Close</Button></Modal.Footer>
      </Modal>

      <style>{`
        .history-page{padding:8px 0 24px;color:#111827}.history-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:18px}.history-head p{margin:0 0 4px;color:#0f766e;font-size:12px;font-weight:900;text-transform:uppercase}.history-head h2{display:flex;align-items:center;gap:10px;margin:0;font-weight:850}.history-head span,.history-table-card td small{color:#64748b}.history-actions{display:flex;gap:8px;flex-wrap:wrap}.history-actions .btn,.history-table-card .btn{display:inline-flex;align-items:center;gap:6px}
        .history-stat,.history-panel,.history-table-card{border:1px solid #e5e7eb;border-radius:8px;box-shadow:0 10px 26px rgba(15,23,42,.06)}.history-stat{padding:16px;min-height:150px}.history-stat svg{color:#0f766e}.history-stat span,.history-stat small{display:block;color:#64748b;font-weight:800}.history-stat strong{display:block;font-size:26px;margin:4px 0}.history-stat.success strong{color:#047857}.history-panel{padding:16px}.history-table-card{overflow:hidden}.history-table-card thead th{background:#f8fafc;color:#475569;font-size:12px;text-transform:uppercase}.history-table-card td small{display:block}.detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.info-box{padding:12px;border:1px solid #e5e7eb;border-radius:8px;background:#f8fafc}.info-box span{display:block;color:#64748b;font-size:12px;font-weight:900;text-transform:uppercase}.info-box strong{display:block;margin-top:4px}
        @media(max-width:768px){.history-head{flex-direction:column}.history-actions .btn{flex:1;justify-content:center}.detail-grid{grid-template-columns:1fr}}
      `}</style>
    </div>
  );
};

const Info = ({ label, value }) => (
  <div className="info-box"><span>{label}</span><strong>{value ?? 'N/A'}</strong></div>
);

export default NotificationHistory;
