import { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, InputGroup, Modal, Pagination, Row, Spinner, Table } from 'react-bootstrap';
import { Eye, HelpCircle, RefreshCw, Search } from 'lucide-react';
import api from '../api/axios';

const unwrap = (res) => res?.data?.data || res?.data || {};
const dateTime = (value) => (value ? new Date(value).toLocaleString('en-IN') : 'N/A');

const Support = () => {
  const [tickets, setTickets] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [filters, setFilters] = useState({ search: '', status: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selected, setSelected] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [response, setResponse] = useState({ status: 'OPEN', adminNotes: '' });
  const limit = 20;

  const load = async (page = pagination.page, filterValues = filters) => {
    try {
      setLoading(true);
      setError('');
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (filterValues.status) params.set('status', filterValues.status);
      if (filterValues.search) params.set('search', filterValues.search);
      const res = await api.get(`/support?${params.toString()}`);
      const data = unwrap(res);
      setTickets(Array.isArray(data.tickets) ? data.tickets : Array.isArray(data) ? data : []);
      setPagination(data.pagination || { page, pages: 1, total: Array.isArray(data) ? data.length : 0 });
    } catch (err) {
      setTickets([]);
      setPagination({ page: 1, pages: 1, total: 0 });
      setError(err.response?.data?.message || err.message || 'Support tickets load nahi ho paaye');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(1);
  }, []);

  const stats = useMemo(() => ({
    total: pagination.total || tickets.length,
    open: tickets.filter((ticket) => ticket.status === 'OPEN').length,
    progress: tickets.filter((ticket) => ticket.status === 'IN_PROGRESS').length,
    resolved: tickets.filter((ticket) => ['RESOLVED', 'CLOSED'].includes(ticket.status)).length
  }), [tickets, pagination.total]);

  const openTicket = (ticket) => {
    setSelected(ticket);
    setResponse({ status: ticket.status || 'OPEN', adminNotes: ticket.adminNotes || '' });
    setShowModal(true);
  };

  const updateTicket = async () => {
    if (!selected) return;
    try {
      setSaving(true);
      setError('');
      await api.put(`/support/${selected._id}`, response);
      setSuccess('Support ticket updated');
      setShowModal(false);
      await load(pagination.page);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Ticket update nahi ho paya');
    } finally {
      setSaving(false);
    }
  };

  const resetFilters = () => {
    const clean = { search: '', status: '' };
    setFilters(clean);
    load(1, clean);
  };

  const statusBadge = (status) => {
    const colors = { OPEN: 'warning', IN_PROGRESS: 'info', RESOLVED: 'success', CLOSED: 'secondary' };
    return <Badge bg={colors[status] || 'secondary'}>{status || 'N/A'}</Badge>;
  };

  return (
    <div className="support-page">
      <div className="support-head">
        <div>
          <p>Customer Desk</p>
          <h2><HelpCircle size={28} /> Support</h2>
          <span>Track customer tickets, update status and record admin resolution notes.</span>
        </div>
        <Button variant="outline-secondary" onClick={() => load(pagination.page)}><RefreshCw size={16} /> Refresh</Button>
      </div>

      {error && <Alert variant="warning" dismissible onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert variant="success" dismissible onClose={() => setSuccess('')}>{success}</Alert>}

      <Row className="g-3 mb-3">
        <Col md={3}><Card className="support-stat"><span>Total</span><strong>{stats.total}</strong><small>Matching tickets</small></Card></Col>
        <Col md={3}><Card className="support-stat warning"><span>Open</span><strong>{stats.open}</strong><small>Needs attention</small></Card></Col>
        <Col md={3}><Card className="support-stat info"><span>In Progress</span><strong>{stats.progress}</strong><small>Being handled</small></Card></Col>
        <Col md={3}><Card className="support-stat success"><span>Resolved</span><strong>{stats.resolved}</strong><small>Closed on page</small></Card></Col>
      </Row>

      <Card className="support-panel mb-3">
        <Row className="g-2">
          <Col md={7}>
            <InputGroup>
              <InputGroup.Text><Search size={16} /></InputGroup.Text>
              <Form.Control placeholder="Search subject, message, notes..." value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
            </InputGroup>
          </Col>
          <Col md={3}>
            <Form.Select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
              <option value="">All Status</option>
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed</option>
            </Form.Select>
          </Col>
          <Col md={1}><Button className="w-100" variant="dark" onClick={() => load(1)}>Apply</Button></Col>
          <Col md={1}><Button className="w-100" variant="outline-secondary" onClick={resetFilters}>Reset</Button></Col>
        </Row>
      </Card>

      <Card className="support-table-card">
        <Table responsive hover className="align-middle mb-0">
          <thead><tr><th>Ticket</th><th>User</th><th>Subject</th><th>Status</th><th>Updated</th><th className="text-end">Action</th></tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" className="text-center py-5"><Spinner animation="border" size="sm" /> Loading tickets...</td></tr>
            ) : tickets.length === 0 ? (
              <tr><td colSpan="6" className="text-center py-5">No support tickets found.</td></tr>
            ) : tickets.map((ticket) => (
              <tr key={ticket._id}>
                <td><strong>#{ticket._id?.slice(-8)}</strong><small>{dateTime(ticket.createdAt)}</small></td>
                <td>{ticket.userId?.name || 'N/A'}<small>{ticket.userId?.mobile || ticket.userId?.email}</small></td>
                <td><strong>{ticket.subject || 'No subject'}</strong><small>{ticket.message}</small></td>
                <td>{statusBadge(ticket.status)}</td>
                <td>{dateTime(ticket.updatedAt)}</td>
                <td className="text-end"><Button size="sm" variant="outline-primary" onClick={() => openTicket(ticket)}><Eye size={14} /> View</Button></td>
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

      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
        <Modal.Header closeButton><Modal.Title>Support Ticket</Modal.Title></Modal.Header>
        <Modal.Body>
          {selected && (
            <>
              <div className="support-detail mb-3">
                <div><span>User</span><strong>{selected.userId?.name || 'N/A'}</strong><small>{selected.userId?.mobile || selected.userId?.email}</small></div>
                <div><span>Ticket</span><strong>#{selected._id?.slice(-8)}</strong><small>{dateTime(selected.createdAt)}</small></div>
              </div>
              <Form.Label>Customer Message</Form.Label>
              <div className="message-box mb-3"><strong>{selected.subject}</strong><p>{selected.message}</p></div>
              <Form.Group className="mb-3">
                <Form.Label>Status</Form.Label>
                <Form.Select value={response.status} onChange={(e) => setResponse({ ...response, status: e.target.value })}>
                  <option value="OPEN">Open</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="RESOLVED">Resolved</option>
                  <option value="CLOSED">Closed</option>
                </Form.Select>
              </Form.Group>
              <Form.Group>
                <Form.Label>Admin Notes</Form.Label>
                <Form.Control as="textarea" rows={4} value={response.adminNotes} onChange={(e) => setResponse({ ...response, adminNotes: e.target.value })} />
              </Form.Group>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setShowModal(false)}>Close</Button>
          <Button disabled={saving} onClick={updateTicket}>{saving ? 'Updating...' : 'Update Ticket'}</Button>
        </Modal.Footer>
      </Modal>

      <style>{`
        .support-page{padding:8px 0 24px;color:#111827}.support-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:18px}.support-head p{margin:0 0 4px;color:#0f766e;font-size:12px;font-weight:900;text-transform:uppercase}.support-head h2{display:flex;align-items:center;gap:10px;margin:0;font-weight:850}.support-head span,.support-table-card td small{color:#64748b}.support-head .btn,.support-table-card .btn{display:inline-flex;align-items:center;gap:6px}
        .support-stat,.support-panel,.support-table-card{border:1px solid #e5e7eb;border-radius:8px;box-shadow:0 10px 26px rgba(15,23,42,.06)}.support-stat{padding:16px}.support-stat span,.support-stat small{display:block;color:#64748b;font-weight:800}.support-stat strong{display:block;font-size:26px;margin:4px 0}.support-stat.warning strong{color:#b45309}.support-stat.info strong{color:#0369a1}.support-stat.success strong{color:#047857}.support-panel{padding:16px}.support-table-card{overflow:hidden}.support-table-card thead th{background:#f8fafc;color:#475569;font-size:12px;text-transform:uppercase}.support-table-card td small{display:block}.support-detail{display:grid;grid-template-columns:1fr 1fr;gap:10px}.support-detail div,.message-box{padding:12px;border:1px solid #e5e7eb;border-radius:8px;background:#f8fafc}.support-detail span{display:block;color:#64748b;font-size:12px;font-weight:900;text-transform:uppercase}.support-detail strong,.support-detail small{display:block}.message-box p{margin:6px 0 0;color:#475569}
        @media(max-width:768px){.support-head{flex-direction:column}.support-detail{grid-template-columns:1fr}}
      `}</style>
    </div>
  );
};

export default Support;
