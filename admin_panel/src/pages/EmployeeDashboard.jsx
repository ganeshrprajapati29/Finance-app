import { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Card, Col, Row, Spinner, Table } from 'react-bootstrap';
import api from '../api/axios';

const unwrap = (res) => res?.data?.data || res?.data || {};

const moduleConfig = {
  dashboard: { title: 'Employee Dashboard', endpoint: '/employee/profile' },
  users: { title: 'Users', endpoint: '/employee/users' },
  loans: { title: 'Loans', endpoint: '/employee/loans' },
  payments: { title: 'Payments', endpoint: '/employee/payments' },
  support: { title: 'Support Tickets', endpoint: '/employee/support' },
  history: { title: 'Employee History', endpoint: '/employee/history' },
  collections: { title: 'Collections', endpoint: '/employee/collections' },
  reports: { title: 'Reports', endpoint: '/employee/reports' },
  push: { title: 'Push Notifications', endpoint: '/employee/profile' }
};

const EmployeeDashboard = ({ module = 'dashboard' }) => {
  const config = moduleConfig[module] || moduleConfig.dashboard;
  const [employee, setEmployee] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      const profileRes = await api.get('/employee/profile');
      setEmployee(unwrap(profileRes));
      if (module !== 'dashboard' && module !== 'push') {
        const dataRes = await api.get(config.endpoint);
        const data = unwrap(dataRes);
        setRows(data.tickets || data.items || (Array.isArray(data) ? data : []));
      } else {
        setRows([]);
      }
    } catch (err) {
      setRows([]);
      setError(err.response?.data?.message || err.message || 'Data load nahi ho paya');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [module]);

  const allowed = useMemo(() => Object.entries(employee?.permissions || {}).filter(([, value]) => value).map(([key]) => key.replace('can', '').replace(/([A-Z])/g, ' $1').trim()), [employee]);

  return (
    <div className="employee-page">
      <div className="employee-head"><p>Employee Panel</p><h2>{config.title}</h2><span>{employee?.name || 'Employee'} access is controlled by admin permissions.</span></div>
      {error && <Alert variant="warning">{error}</Alert>}
      <Row className="g-3 mb-3">
        <Col md={4}><Card className="emp-card"><span>Name</span><strong>{employee?.name || 'N/A'}</strong><small>{employee?.email}</small></Card></Col>
        <Col md={4}><Card className="emp-card"><span>Role</span><strong>{employee?.roles?.join(', ') || 'employee'}</strong><small>{employee?.phone}</small></Card></Col>
        <Col md={4}><Card className="emp-card"><span>Permissions</span><strong>{allowed.length}</strong><small>{allowed.slice(0, 3).join(', ') || 'Basic'}</small></Card></Col>
      </Row>
      <Card className="emp-table-card">
        {loading ? <div className="text-center py-5"><Spinner animation="border" size="sm" /> Loading...</div> : module === 'dashboard' || module === 'push' ? (
          <div className="empty-state">{module === 'push' ? 'Push notification compose flow is available only when admin grants notification API access.' : 'Select an allowed module from the sidebar.'}</div>
        ) : rows.length === 0 ? <div className="empty-state">No records found or permission not granted.</div> : (
          <Table responsive hover className="mb-0"><thead><tr>{Object.keys(flatRow(rows[0])).slice(0, 6).map((key) => <th key={key}>{key}</th>)}</tr></thead><tbody>{rows.slice(0, 50).map((row, index) => { const flat = flatRow(row); return <tr key={row._id || index}>{Object.keys(flat).slice(0, 6).map((key) => <td key={key}>{String(flat[key] ?? 'N/A').slice(0, 80)}</td>)}</tr>; })}</tbody></Table>
        )}
      </Card>
      <style>{`.employee-page{padding:8px 0 24px;color:#111827}.employee-head{margin-bottom:18px}.employee-head p{margin:0 0 4px;color:#0f766e;font-size:12px;font-weight:900;text-transform:uppercase}.employee-head h2{margin:0;font-weight:850}.employee-head span,.emp-card small{color:#64748b}.emp-card,.emp-table-card{border:1px solid #e5e7eb;border-radius:8px;box-shadow:0 10px 26px rgba(15,23,42,.06)}.emp-card{padding:16px}.emp-card span,.emp-card small{display:block;font-weight:800}.emp-card strong{font-size:22px}.emp-table-card{overflow:hidden}.emp-table-card thead th{background:#f8fafc;color:#475569;font-size:12px;text-transform:uppercase}.empty-state{text-align:center;padding:54px;color:#64748b;font-weight:800}`}</style>
    </div>
  );
};

const flatRow = (row = {}) => ({
  id: row._id,
  name: row.name || row.userId?.name || row.loanAccountNumber || row.subject,
  email: row.email || row.userId?.email,
  status: row.status,
  amount: row.amount || row.decision?.amountApproved,
  createdAt: row.createdAt
});

export default EmployeeDashboard;
