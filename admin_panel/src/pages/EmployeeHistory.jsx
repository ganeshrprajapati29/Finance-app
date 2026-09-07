import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, InputGroup, Row, Table } from 'react-bootstrap';
import { Download, History, RefreshCw, Search } from 'lucide-react';
import api from '../api/axios';

const unwrap = (res) => res?.data?.data || res?.data || {};
const dateTime = (value) => (value ? new Date(value).toLocaleString('en-IN') : 'N/A');

const EmployeeHistory = () => {
  const [employees, setEmployees] = useState([]);
  const [audit, setAudit] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      const [empRes, auditRes] = await Promise.all([
        api.get('/employees'),
        api.get('/admin/audit')
      ]);
      const empData = unwrap(empRes);
      const auditData = unwrap(auditRes);
      setEmployees(Array.isArray(empData.items) ? empData.items : Array.isArray(empData) ? empData : []);
      const auditRows = Array.isArray(auditData.logs) ? auditData.logs : Array.isArray(auditData) ? auditData : [];
      setAudit(auditRows.filter((row) => String(row.entityType || '').toLowerCase() === 'employee' || String(row.action || '').includes('EMPLOYEE')));
    } catch (err) {
      setEmployees([]);
      setAudit([]);
      setError(err.response?.data?.message || err.message || 'Employee history load nahi ho paya');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filteredEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((employee) =>
      employee.name?.toLowerCase().includes(q) ||
      employee.email?.toLowerCase().includes(q) ||
      employee.phone?.includes(q) ||
      employee.roles?.join(' ')?.toLowerCase().includes(q) ||
      Object.entries(employee.permissions || {}).filter(([, value]) => value).map(([key]) => key).join(' ').toLowerCase().includes(q)
    );
  }, [employees, search]);

  const stats = useMemo(() => ({
    total: employees.length,
    active: employees.filter((employee) => employee.status === 'active' || employee.isActive).length,
    inactive: employees.filter((employee) => employee.status === 'inactive' || employee.isActive === false).length,
    audit: audit.length
  }), [employees, audit]);

  const exportCsv = () => {
    const rows = [
      ['Name', 'Email', 'Phone', 'Roles', 'Status', 'Created At'],
      ...filteredEmployees.map((employee) => [
        employee.name,
        employee.email,
        employee.phone,
        employee.roles?.join('|') || 'employee',
        employee.status || (employee.isActive ? 'active' : 'inactive'),
        employee.createdAt
      ])
    ];
    const blob = new Blob([rows.map((row) => row.map((cell) => `"${String(cell || '').replace(/"/g, '""')}"`).join(',')).join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'employee-history.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container-fluid p-4">
      <div className="d-flex justify-content-between align-items-start mb-4 gap-3">
        <div>
          <p className="text-uppercase text-primary fw-bold mb-1 small">Team Operations</p>
          <h2 className="d-flex align-items-center gap-2 mb-1"><History size={28} /> Employee History</h2>
          <p className="text-muted mb-0">Employee lifecycle, permissions and admin audit activity.</p>
        </div>
        <div className="d-flex gap-2">
          <Button variant="outline-secondary" onClick={load}><RefreshCw size={16} /> Refresh</Button>
          <Button variant="outline-success" onClick={exportCsv}><Download size={16} /> Export</Button>
        </div>
      </div>

      {error && <Alert variant="warning" dismissible onClose={() => setError('')}>{error}</Alert>}

      <Row className="g-3 mb-3">
        <Col md={3}><Card className="p-3 border-0 shadow-sm"><small className="text-muted fw-bold">Employees</small><h3>{stats.total}</h3></Card></Col>
        <Col md={3}><Card className="p-3 border-0 shadow-sm"><small className="text-muted fw-bold">Active</small><h3 className="text-success">{stats.active}</h3></Card></Col>
        <Col md={3}><Card className="p-3 border-0 shadow-sm"><small className="text-muted fw-bold">Inactive</small><h3 className="text-danger">{stats.inactive}</h3></Card></Col>
        <Col md={3}><Card className="p-3 border-0 shadow-sm"><small className="text-muted fw-bold">Audit Events</small><h3>{stats.audit}</h3></Card></Col>
      </Row>

      <Card className="mb-3 border-0 shadow-sm">
        <Card.Body>
          <InputGroup>
            <InputGroup.Text><Search size={16} /></InputGroup.Text>
            <Form.Control placeholder="Search employee, role, email..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </InputGroup>
        </Card.Body>
      </Card>

      <Card className="border-0 shadow-sm mb-3">
        <Table responsive hover className="align-middle mb-0">
          <thead className="table-light">
            <tr>
              <th>Employee</th>
              <th>Role</th>
              <th>Permissions</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="5" className="text-center py-5">Loading...</td></tr>
            ) : filteredEmployees.length === 0 ? (
              <tr><td colSpan="5" className="text-center py-5">No employees found.</td></tr>
            ) : filteredEmployees.map((employee) => (
              <tr key={employee._id}>
                <td><strong>{employee.name}</strong><small className="d-block text-muted">{employee.email} | {employee.phone}</small></td>
                <td>{(employee.roles || ['employee']).map((role) => <Badge bg="primary" className="me-1" key={role}>{role}</Badge>)}</td>
                <td><small>{Object.entries(employee.permissions || {}).filter(([, value]) => value).map(([key]) => key.replace('can', '')).join(', ') || 'Basic support'}</small></td>
                <td><Badge bg={(employee.status === 'active' || employee.isActive) ? 'success' : 'secondary'}>{employee.status || (employee.isActive ? 'active' : 'inactive')}</Badge></td>
                <td>{dateTime(employee.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <Card className="border-0 shadow-sm">
        <Card.Header className="bg-white fw-bold">Recent Employee Audit</Card.Header>
        <Table responsive hover className="align-middle mb-0">
          <thead className="table-light"><tr><th>Action</th><th>Entity</th><th>Meta</th><th>Date</th></tr></thead>
          <tbody>
            {audit.slice(0, 15).length === 0 ? (
              <tr><td colSpan="4" className="text-center py-4">No employee audit events found.</td></tr>
            ) : audit.slice(0, 15).map((row) => (
              <tr key={row._id}>
                <td><Badge bg="dark">{row.action}</Badge></td>
                <td>{row.entityId || row.entityType}</td>
                <td><small>{row.meta ? JSON.stringify(row.meta) : '-'}</small></td>
                <td>{dateTime(row.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
};

export default EmployeeHistory;
