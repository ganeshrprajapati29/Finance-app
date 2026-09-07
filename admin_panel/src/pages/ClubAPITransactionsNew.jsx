import { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, InputGroup, Modal, Pagination, Row, Table } from 'react-bootstrap';
import { Download, Eye, RefreshCw, Search } from 'lucide-react';
import api from '../api/axios';

const unwrap = (res) => res?.data?.data || res?.data || {};
const currency = (value) => `Rs. ${Number(value || 0).toLocaleString('en-IN')}`;
const dateTime = (value) => (value ? new Date(value).toLocaleString('en-IN') : 'N/A');

const ClubAPITransactionsNew = () => {
  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState({ overview: {}, successRate: 0 });
  const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalTransactions: 0 });
  const [filters, setFilters] = useState({ search: '', status: '', type: '', startDate: '', endDate: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showStatus, setShowStatus] = useState(false);
  const [statusForm, setStatusForm] = useState({ status: 'pending', notes: '' });
  const limit = 20;

  const fetchTransactions = async (page = pagination.currentPage || 1, filterValues = filters) => {
    try {
      setLoading(true);
      setError('');
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      Object.entries(filterValues).forEach(([key, value]) => {
        if (value) params.set(key, value);
      });
      const response = await api.get(`/admin/clubapi/transactions?${params.toString()}`);
      const data = unwrap(response);
      setTransactions(Array.isArray(data.transactions) ? data.transactions : []);
      setPagination(data.pagination || { currentPage: page, totalPages: 1, totalTransactions: 0 });
    } catch (err) {
      setTransactions([]);
      setPagination({ currentPage: 1, totalPages: 1, totalTransactions: 0 });
      setError(err.response?.data?.message || err.message || 'Transactions load nahi ho paaye');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get('/admin/clubapi/stats');
      setStats(unwrap(response));
    } catch {
      setStats({ overview: {}, successRate: 0 });
    }
  };

  useEffect(() => {
    fetchTransactions(1);
    fetchStats();
  }, []);

  const pageStats = useMemo(() => ({
    amount: transactions.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    completed: transactions.filter((item) => item.status === 'completed').length,
    failed: transactions.filter((item) => item.status === 'failed').length,
    pending: transactions.filter((item) => item.status === 'pending').length
  }), [transactions]);

  const handleStatusUpdate = async () => {
    if (!selected) return;
    try {
      setSaving(true);
      await api.put(`/admin/clubapi/transactions/${selected._id}/status`, statusForm);
      setShowStatus(false);
      setSelected(null);
      fetchTransactions(pagination.currentPage);
      fetchStats();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Status update nahi ho paya');
    } finally {
      setSaving(false);
    }
  };

  const openDetail = async (transaction) => {
    try {
      const response = await api.get(`/admin/clubapi/transactions/${transaction._id}`);
      setSelected(unwrap(response));
    } catch {
      setSelected(transaction);
    }
    setShowDetail(true);
  };

  const exportCsv = () => {
    const rows = [
      ['URID', 'User', 'Mobile', 'Type', 'Provider', 'Amount', 'Status', 'Account Ref', 'Date'],
      ...transactions.map((item) => [item.urid, item.userId?.name || '', item.userId?.mobile || item.customerMobile || '', item.type, item.provider, item.amount, item.status, item.accountRef, item.createdAt])
    ];
    const blob = new Blob([rows.map((row) => row.map((cell) => `"${String(cell || '').replace(/"/g, '""')}"`).join(',')).join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'clubapi-transactions.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const resetFilters = () => {
    const cleanFilters = { search: '', status: '', type: '', startDate: '', endDate: '' };
    setFilters(cleanFilters);
    fetchTransactions(1, cleanFilters);
  };

  const statusBadge = (status) => {
    const variants = { completed: 'success', failed: 'danger', pending: 'warning', processing: 'info', cancelled: 'secondary' };
    return <Badge bg={variants[status] || 'secondary'}>{status || 'unknown'}</Badge>;
  };

  return (
    <div className="clubtx-page">
      <div className="clubtx-head">
        <div>
          <p>Club API Ledger</p>
          <h2>Club API Transactions</h2>
          <span>Search, filter, inspect and update transaction status.</span>
        </div>
        <div className="clubtx-actions">
          <Button variant="outline-secondary" onClick={() => { fetchTransactions(pagination.currentPage); fetchStats(); }}><RefreshCw size={16} /> Refresh</Button>
          <Button variant="outline-success" onClick={exportCsv}><Download size={16} /> Export</Button>
        </div>
      </div>

      {error && <Alert variant="warning" dismissible onClose={() => setError('')}>{error}</Alert>}

      <Row className="g-3 mb-3">
        <Col md={3}><Card className="clubtx-stat"><span>Total</span><strong>{stats.overview?.totalTransactions || 0}</strong><small>{pagination.totalTransactions || 0} matching</small></Card></Col>
        <Col md={3}><Card className="clubtx-stat"><span>Total Amount</span><strong>{currency(stats.overview?.totalAmount)}</strong><small>{currency(pageStats.amount)} on page</small></Card></Col>
        <Col md={3}><Card className="clubtx-stat success"><span>Completed</span><strong>{stats.overview?.completedTransactions || 0}</strong><small>{stats.successRate || 0}% success</small></Card></Col>
        <Col md={3}><Card className="clubtx-stat danger"><span>Failed</span><strong>{stats.overview?.failedTransactions || 0}</strong><small>{pageStats.pending} pending on page</small></Card></Col>
      </Row>

      <Card className="clubtx-panel mb-3">
        <Row className="g-2">
          <Col xl={3} md={6}>
            <InputGroup>
              <InputGroup.Text><Search size={16} /></InputGroup.Text>
              <Form.Control placeholder="URID, account, mobile..." value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
            </InputGroup>
          </Col>
          <Col xl={2} md={6}>
            <Form.Select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="cancelled">Cancelled</option>
            </Form.Select>
          </Col>
          <Col xl={2} md={6}>
            <Form.Select value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })}>
              <option value="">All Types</option>
              <option value="bill_fetch">Bill Fetch</option>
              <option value="bill_payment">Bill Payment</option>
              <option value="mobile">Mobile Recharge</option>
              <option value="dth">DTH Recharge</option>
              <option value="other">Other</option>
            </Form.Select>
          </Col>
          <Col xl={2} md={6}><Form.Control type="date" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} /></Col>
          <Col xl={2} md={6}><Form.Control type="date" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} /></Col>
          <Col xl={1} md={6}><Button className="w-100" variant="dark" onClick={() => fetchTransactions(1)}>Apply</Button></Col>
          <Col md={12}><Button size="sm" variant="outline-secondary" onClick={resetFilters}>Reset Filters</Button></Col>
        </Row>
      </Card>

      <Card className="clubtx-table-card">
        <Table responsive hover className="align-middle mb-0">
          <thead>
            <tr><th>Transaction</th><th>User</th><th>Type</th><th>Provider</th><th>Amount</th><th>Status</th><th>Date</th><th className="text-end">Action</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="8" className="text-center py-5">Loading transactions...</td></tr>
            ) : transactions.length === 0 ? (
              <tr><td colSpan="8" className="text-center py-5">No transactions found.</td></tr>
            ) : transactions.map((item) => (
              <tr key={item._id}>
                <td><code>{item.urid}</code><small>{item.accountRef}</small></td>
                <td>{item.userId?.name || 'N/A'}<small>{item.userId?.mobile || item.customerMobile || item.userId?.email}</small></td>
                <td>{String(item.type || 'other').replace(/_/g, ' ').toUpperCase()}</td>
                <td>{item.provider || 'N/A'}</td>
                <td className="fw-bold">{currency(item.amount)}</td>
                <td>{statusBadge(item.status)}</td>
                <td>{dateTime(item.createdAt)}</td>
                <td>
                  <div className="clubtx-row-actions justify-content-end">
                    <Button size="sm" variant="outline-primary" onClick={() => openDetail(item)}><Eye size={14} /></Button>
                    <Button size="sm" variant="outline-warning" onClick={() => { setSelected(item); setStatusForm({ status: item.status || 'pending', notes: item.notes || '' }); setShowStatus(true); }}>Status</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      {pagination.totalPages > 1 && (
        <Pagination className="justify-content-center mt-3">
          <Pagination.Prev disabled={pagination.currentPage <= 1} onClick={() => fetchTransactions(pagination.currentPage - 1)} />
          <Pagination.Item active>{pagination.currentPage}</Pagination.Item>
          <Pagination.Next disabled={pagination.currentPage >= pagination.totalPages} onClick={() => fetchTransactions(pagination.currentPage + 1)} />
        </Pagination>
      )}

      <Modal show={showDetail} onHide={() => setShowDetail(false)} size="lg">
        <Modal.Header closeButton><Modal.Title>Transaction Details</Modal.Title></Modal.Header>
        <Modal.Body>
          {selected && (
            <Row className="g-3">
              <Col md={6}><Info label="URID" value={selected.urid} /></Col>
              <Col md={6}><Info label="Status" value={selected.status} badge={statusBadge(selected.status)} /></Col>
              <Col md={6}><Info label="Type" value={String(selected.type || '').replace(/_/g, ' ').toUpperCase()} /></Col>
              <Col md={6}><Info label="Amount" value={currency(selected.amount)} /></Col>
              <Col md={6}><Info label="Provider" value={selected.provider} /></Col>
              <Col md={6}><Info label="Customer Mobile" value={selected.customerMobile || selected.userId?.mobile} /></Col>
              <Col md={12}>
                <Form.Label>API Response</Form.Label>
                <Form.Control as="textarea" rows={6} value={JSON.stringify(selected.response || {}, null, 2)} readOnly style={{ fontFamily: 'monospace' }} />
              </Col>
            </Row>
          )}
        </Modal.Body>
        <Modal.Footer><Button variant="outline-secondary" onClick={() => setShowDetail(false)}>Close</Button></Modal.Footer>
      </Modal>

      <Modal show={showStatus} onHide={() => setShowStatus(false)}>
        <Modal.Header closeButton><Modal.Title>Update Status</Modal.Title></Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>Status</Form.Label>
            <Form.Select value={statusForm.status} onChange={(e) => setStatusForm({ ...statusForm, status: e.target.value })}>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="cancelled">Cancelled</option>
            </Form.Select>
          </Form.Group>
          <Form.Group>
            <Form.Label>Notes</Form.Label>
            <Form.Control as="textarea" rows={3} value={statusForm.notes} onChange={(e) => setStatusForm({ ...statusForm, notes: e.target.value })} />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setShowStatus(false)}>Cancel</Button>
          <Button disabled={saving} onClick={handleStatusUpdate}>{saving ? 'Updating...' : 'Update Status'}</Button>
        </Modal.Footer>
      </Modal>

      <style>{`
        .clubtx-page{padding:8px 0 24px;color:#111827}.clubtx-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:18px}.clubtx-head p{margin:0 0 4px;color:#0f766e;font-size:12px;font-weight:900;text-transform:uppercase}.clubtx-head h2{margin:0;font-weight:850}.clubtx-head span,.clubtx-table-card td small{color:#64748b}.clubtx-actions,.clubtx-row-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.clubtx-actions .btn,.clubtx-row-actions .btn{display:inline-flex;align-items:center;gap:6px}
        .clubtx-stat,.clubtx-panel,.clubtx-table-card{border:1px solid #e5e7eb;border-radius:8px;box-shadow:0 10px 26px rgba(15,23,42,.06)}.clubtx-stat{padding:16px}.clubtx-stat span,.clubtx-stat small{color:#64748b;font-weight:800}.clubtx-stat strong{display:block;font-size:24px;margin:4px 0}.clubtx-stat.success strong{color:#047857}.clubtx-stat.danger strong{color:#b91c1c}.clubtx-panel{padding:16px}.clubtx-table-card{overflow:hidden}.clubtx-table-card thead th{background:#f8fafc;color:#475569;font-size:12px;text-transform:uppercase}.clubtx-table-card td small{display:block}.clubtx-table-card code{font-weight:800;color:#0f766e}.info-box{padding:12px;border:1px solid #e5e7eb;border-radius:8px;background:#f8fafc}.info-box span{display:block;color:#64748b;font-size:12px;font-weight:900;text-transform:uppercase}.info-box strong{display:block;margin-top:4px}
        @media(max-width:768px){.clubtx-head{flex-direction:column}.clubtx-actions .btn{flex:1;justify-content:center}}
      `}</style>
    </div>
  );
};

const Info = ({ label, value, badge }) => (
  <div className="info-box">
    <span>{label}</span>
    {badge || <strong>{value || 'N/A'}</strong>}
  </div>
);

export default ClubAPITransactionsNew;
