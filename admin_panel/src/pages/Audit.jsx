import { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, InputGroup, Modal, Pagination, Row, Spinner, Table } from 'react-bootstrap';
import { Download, Eye, History, RefreshCw, Search } from 'lucide-react';
import api from '../api/axios';

const unwrap = (res) => res?.data?.data || res?.data || {};
const dateTime = (value) => (value ? new Date(value).toLocaleString('en-IN') : 'N/A');

const Audit = () => {
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [filters, setFilters] = useState({ search: '', action: '', entityType: '' });
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
      if (filterValues.search) params.set('search', filterValues.search);
      if (filterValues.action) params.set('action', filterValues.action);
      if (filterValues.entityType) params.set('entityType', filterValues.entityType);
      const res = await api.get(`/admin/audit?${params.toString()}`);
      const data = unwrap(res);
      setLogs(Array.isArray(data.logs) ? data.logs : Array.isArray(data) ? data : []);
      setPagination(data.pagination || { page, pages: 1, total: Array.isArray(data) ? data.length : 0 });
    } catch (err) {
      setLogs([]);
      setPagination({ page: 1, pages: 1, total: 0 });
      setError(err.response?.data?.message || err.message || 'Audit logs load nahi ho paaye');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(1);
  }, []);

  const stats = useMemo(() => ({
    total: pagination.total || logs.length,
    users: logs.filter((log) => log.entityType === 'User').length,
    loans: logs.filter((log) => log.entityType === 'Loan').length,
    system: logs.filter((log) => ['System', 'Admin'].includes(log.entityType)).length
  }), [logs, pagination.total]);

  const actions = useMemo(() => [...new Set(logs.map((log) => log.action).filter(Boolean))].sort(), [logs]);
  const entityTypes = useMemo(() => [...new Set(logs.map((log) => log.entityType).filter(Boolean))].sort(), [logs]);

  const exportCsv = () => {
    const rows = [
      ['ID', 'Actor', 'Action', 'Entity Type', 'Entity ID', 'Meta', 'Date'],
      ...logs.map((log) => [log._id, log.actorId?.email || log.actorId?.name || log.actorId || 'System', log.action, log.entityType, log.entityId, JSON.stringify(log.meta || {}), log.createdAt])
    ];
    const blob = new Blob([rows.map((row) => row.map((cell) => `"${String(cell || '').replace(/"/g, '""')}"`).join(',')).join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'audit-log.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const resetFilters = () => {
    const clean = { search: '', action: '', entityType: '' };
    setFilters(clean);
    load(1, clean);
  };

  const actionBadge = (action) => {
    const text = action || 'UNKNOWN';
    const variant = text.includes('DELETE') || text.includes('REJECT') || text.includes('FAILED') ? 'danger' : text.includes('UPDATE') || text.includes('CHANGE') ? 'warning' : text.includes('CREATE') || text.includes('APPROVE') ? 'success' : 'secondary';
    return <Badge bg={variant}>{text}</Badge>;
  };

  return (
    <div className="audit-page">
      <div className="audit-head">
        <div>
          <p>System Trail</p>
          <h2><History size={28} /> Audit Log</h2>
          <span>Review admin activity, entity changes and operational metadata.</span>
        </div>
        <div className="audit-actions">
          <Button variant="outline-secondary" onClick={() => load(pagination.page)}><RefreshCw size={16} /> Refresh</Button>
          <Button variant="outline-success" onClick={exportCsv}><Download size={16} /> Export</Button>
        </div>
      </div>

      {error && <Alert variant="warning" dismissible onClose={() => setError('')}>{error}</Alert>}

      <Row className="g-3 mb-3">
        <Col md={3}><Card className="audit-stat"><span>Total Logs</span><strong>{stats.total}</strong><small>Matching results</small></Card></Col>
        <Col md={3}><Card className="audit-stat"><span>User Events</span><strong>{stats.users}</strong><small>Current page</small></Card></Col>
        <Col md={3}><Card className="audit-stat"><span>Loan Events</span><strong>{stats.loans}</strong><small>Current page</small></Card></Col>
        <Col md={3}><Card className="audit-stat"><span>System Events</span><strong>{stats.system}</strong><small>Current page</small></Card></Col>
      </Row>

      <Card className="audit-panel mb-3">
        <Row className="g-2">
          <Col xl={4} md={6}>
            <InputGroup>
              <InputGroup.Text><Search size={16} /></InputGroup.Text>
              <Form.Control placeholder="Search action, entity, id..." value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
            </InputGroup>
          </Col>
          <Col xl={3} md={6}>
            <Form.Select value={filters.action} onChange={(e) => setFilters({ ...filters, action: e.target.value })}>
              <option value="">All Actions</option>
              {actions.map((action) => <option value={action} key={action}>{action}</option>)}
            </Form.Select>
          </Col>
          <Col xl={3} md={6}>
            <Form.Select value={filters.entityType} onChange={(e) => setFilters({ ...filters, entityType: e.target.value })}>
              <option value="">All Entity Types</option>
              {entityTypes.map((type) => <option value={type} key={type}>{type}</option>)}
            </Form.Select>
          </Col>
          <Col xl={1} md={6}><Button className="w-100" variant="dark" onClick={() => load(1)}>Apply</Button></Col>
          <Col xl={1} md={6}><Button className="w-100" variant="outline-secondary" onClick={resetFilters}>Reset</Button></Col>
        </Row>
      </Card>

      <Card className="audit-table-card">
        <Table responsive hover className="align-middle mb-0">
          <thead><tr><th>Log</th><th>Actor</th><th>Action</th><th>Entity</th><th>Meta</th><th>Date</th><th className="text-end">Action</th></tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="7" className="text-center py-5"><Spinner animation="border" size="sm" /> Loading audit logs...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan="7" className="text-center py-5">No audit logs found.</td></tr>
            ) : logs.map((log) => (
              <tr key={log._id}>
                <td><strong>#{log._id?.slice(-8)}</strong></td>
                <td>{log.actorId?.name || log.actorId?.email || log.actorId || 'System'}<small>{log.actorId?.email || ''}</small></td>
                <td>{actionBadge(log.action)}</td>
                <td>{log.entityType || 'N/A'}<small>{log.entityId || ''}</small></td>
                <td><code>{JSON.stringify(log.meta || {}).slice(0, 90)}{JSON.stringify(log.meta || {}).length > 90 ? '...' : ''}</code></td>
                <td>{dateTime(log.createdAt)}</td>
                <td className="text-end"><Button size="sm" variant="outline-primary" onClick={() => { setSelected(log); setShowDetail(true); }}><Eye size={14} /></Button></td>
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
        <Modal.Header closeButton><Modal.Title>Audit Details</Modal.Title></Modal.Header>
        <Modal.Body>
          {selected && (
            <>
              <div className="detail-grid mb-3">
                <Info label="Log ID" value={selected._id} />
                <Info label="Actor" value={selected.actorId?.email || selected.actorId?.name || selected.actorId || 'System'} />
                <Info label="Action" value={selected.action} />
                <Info label="Entity" value={`${selected.entityType || 'N/A'} ${selected.entityId || ''}`} />
                <Info label="Created" value={dateTime(selected.createdAt)} />
                <Info label="Updated" value={dateTime(selected.updatedAt)} />
              </div>
              <Form.Label>Metadata</Form.Label>
              <Form.Control as="textarea" rows={8} value={JSON.stringify(selected.meta || {}, null, 2)} readOnly style={{ fontFamily: 'monospace' }} />
            </>
          )}
        </Modal.Body>
        <Modal.Footer><Button variant="outline-secondary" onClick={() => setShowDetail(false)}>Close</Button></Modal.Footer>
      </Modal>

      <style>{`
        .audit-page{padding:8px 0 24px;color:#111827}.audit-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:18px}.audit-head p{margin:0 0 4px;color:#0f766e;font-size:12px;font-weight:900;text-transform:uppercase}.audit-head h2{display:flex;align-items:center;gap:10px;margin:0;font-weight:850}.audit-head span,.audit-table-card td small{color:#64748b}.audit-actions{display:flex;gap:8px;flex-wrap:wrap}.audit-actions .btn,.audit-table-card .btn{display:inline-flex;align-items:center;gap:6px}
        .audit-stat,.audit-panel,.audit-table-card{border:1px solid #e5e7eb;border-radius:8px;box-shadow:0 10px 26px rgba(15,23,42,.06)}.audit-stat{padding:16px}.audit-stat span,.audit-stat small{display:block;color:#64748b;font-weight:800}.audit-stat strong{display:block;font-size:26px;margin:4px 0}.audit-panel{padding:16px}.audit-table-card{overflow:hidden}.audit-table-card thead th{background:#f8fafc;color:#475569;font-size:12px;text-transform:uppercase}.audit-table-card td small{display:block}.audit-table-card code{white-space:normal;color:#0f766e}.detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.info-box{padding:12px;border:1px solid #e5e7eb;border-radius:8px;background:#f8fafc}.info-box span{display:block;color:#64748b;font-size:12px;font-weight:900;text-transform:uppercase}.info-box strong{display:block;margin-top:4px;word-break:break-word}
        @media(max-width:768px){.audit-head{flex-direction:column}.audit-actions .btn{flex:1;justify-content:center}.detail-grid{grid-template-columns:1fr}}
      `}</style>
    </div>
  );
};

const Info = ({ label, value }) => (
  <div className="info-box"><span>{label}</span><strong>{value || 'N/A'}</strong></div>
);

export default Audit;
