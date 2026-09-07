import { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, InputGroup, Modal, Pagination, Row, Spinner, Table } from 'react-bootstrap';
import { Edit, KeyRound, RefreshCw, Search, ShieldCheck, UserPlus, Users } from 'lucide-react';
import api from '../api/axios';

const unwrap = (res) => res?.data?.data || res?.data || {};
const today = () => new Date().toISOString().slice(0, 10);

const permissionGroups = [
  { key: 'canManageUsers', label: 'Users' },
  { key: 'canManageLoans', label: 'Loans' },
  { key: 'canManagePayments', label: 'Payments' },
  { key: 'canManageSupport', label: 'Support' },
  { key: 'canSendNotifications', label: 'Push Notifications' },
  { key: 'canManageCollections', label: 'Collections' },
  { key: 'canViewReports', label: 'Reports' },
  { key: 'canViewAudit', label: 'Audit Log' },
  { key: 'canManageSettings', label: 'Settings' }
];

const blankPermissions = Object.fromEntries(permissionGroups.map((item) => [item.key, item.key === 'canManageSupport']));
const blankForm = {
  name: '',
  email: '',
  phone: '',
  password: '',
  department: 'SUPPORT',
  designation: 'Support Executive',
  employeeId: '',
  joiningDate: today(),
  roles: ['employee'],
  permissions: blankPermissions
};

const Employees = () => {
  const [employees, setEmployees] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [filters, setFilters] = useState({ search: '', role: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(blankForm);
  const [resetPassword, setResetPassword] = useState('');
  const limit = 20;

  const load = async (page = pagination.page, filterValues = filters) => {
    try {
      setLoading(true);
      setError('');
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (filterValues.search) params.set('search', filterValues.search);
      if (filterValues.role) params.set('role', filterValues.role);
      const res = await api.get(`/employees?${params.toString()}`);
      const data = unwrap(res);
      setEmployees(Array.isArray(data.items) ? data.items : []);
      setPagination({ page: data.page || page, pages: data.pages || 1, total: data.total || 0 });
    } catch (err) {
      setEmployees([]);
      setPagination({ page: 1, pages: 1, total: 0 });
      setError(err.response?.data?.message || err.message || 'Employees load nahi ho paaye');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(1); }, []);

  const stats = useMemo(() => ({
    total: pagination.total || employees.length,
    active: employees.filter((item) => item.status === 'active' || item.isActive).length,
    inactive: employees.filter((item) => item.status === 'inactive' || item.isActive === false).length,
    adminLike: employees.filter((item) => Object.values(item.permissions || {}).filter(Boolean).length >= 5).length
  }), [employees, pagination.total]);

  const openCreate = () => {
    setSelected(null);
    setForm(blankForm);
    setShowForm(true);
  };

  const openEdit = (employee) => {
    setSelected(employee);
    setForm({
      name: employee.name || '',
      email: employee.email || '',
      phone: employee.phone || '',
      password: '',
      department: employee.department || 'SUPPORT',
      designation: employee.agentProfile?.designation || 'Support Executive',
      employeeId: employee.agentProfile?.employeeId || '',
      joiningDate: employee.agentProfile?.joiningDate ? new Date(employee.agentProfile.joiningDate).toISOString().slice(0, 10) : today(),
      roles: employee.roles || ['employee'],
      permissions: { ...blankPermissions, ...(employee.permissions || {}) }
    });
    setShowForm(true);
  };

  const updatePermission = (key, value) => {
    setForm((current) => ({ ...current, permissions: { ...current.permissions, [key]: value } }));
  };

  const saveEmployee = async () => {
    if (!form.name || !form.email || !form.phone) return setError('Name, email aur phone required hai');
    if (!selected && form.password.length < 6) return setError('New employee password minimum 6 characters hona chahiye');
    try {
      setSaving(true);
      setError('');
      const payload = {
        name: form.name,
        email: form.email.toLowerCase(),
        phone: form.phone,
        roles: form.roles,
        department: form.department,
        permissions: form.permissions,
        agentProfile: {
          designation: form.designation,
          employeeId: form.employeeId,
          joiningDate: form.joiningDate
        }
      };
      if (!selected) payload.password = form.password;
      if (selected) await api.put(`/employees/${selected._id}`, payload);
      else await api.post('/employees', payload);
      setSuccess(selected ? 'Employee updated successfully' : 'Employee created successfully');
      setShowForm(false);
      await load(1);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Employee save nahi ho paya');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (employee) => {
    try {
      setSaving(true);
      await api.put(`/employees/${employee._id}/status`, { status: employee.status === 'active' || employee.isActive ? 'inactive' : 'active' });
      await load(pagination.page);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Employee status update nahi ho paya');
    } finally {
      setSaving(false);
    }
  };

  const resetEmployeePassword = async () => {
    if (!selected || resetPassword.length < 6) return setError('Password minimum 6 characters hona chahiye');
    try {
      setSaving(true);
      await api.post(`/employees/${selected._id}/reset-password`, { password: resetPassword });
      setSuccess('Employee password reset successfully');
      setSelected(null);
      setResetPassword('');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Password reset nahi ho paya');
    } finally {
      setSaving(false);
    }
  };

  const permissionText = (permissions = {}) => permissionGroups.filter((item) => permissions[item.key]).map((item) => item.label).join(', ') || 'No permissions';

  return (
    <div className="emp-page">
      <div className="emp-head">
        <div><p>Team Access</p><h2><Users size={28} /> Manage Employees</h2><span>Create employee logins and control exactly which admin modules they can access.</span></div>
        <div className="emp-actions"><Button variant="outline-secondary" onClick={() => load(pagination.page)}><RefreshCw size={16} /> Refresh</Button><Button onClick={openCreate}><UserPlus size={16} /> Add Employee</Button></div>
      </div>
      {error && <Alert variant="warning" dismissible onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert variant="success" dismissible onClose={() => setSuccess('')}>{success}</Alert>}

      <Row className="g-3 mb-3">
        <Col md={3}><Card className="emp-stat"><span>Total Employees</span><strong>{stats.total}</strong></Card></Col>
        <Col md={3}><Card className="emp-stat success"><span>Active</span><strong>{stats.active}</strong></Card></Col>
        <Col md={3}><Card className="emp-stat danger"><span>Inactive</span><strong>{stats.inactive}</strong></Card></Col>
        <Col md={3}><Card className="emp-stat"><span>Power Access</span><strong>{stats.adminLike}</strong></Card></Col>
      </Row>

      <Card className="emp-panel mb-3">
        <Row className="g-2">
          <Col md={8}><InputGroup><InputGroup.Text><Search size={16} /></InputGroup.Text><Form.Control placeholder="Search name, email, phone, department..." value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} /></InputGroup></Col>
          <Col md={2}><Button className="w-100" variant="dark" onClick={() => load(1)}>Search</Button></Col>
          <Col md={2}><Button className="w-100" variant="outline-secondary" onClick={() => { const clean = { search: '', role: '' }; setFilters(clean); load(1, clean); }}>Reset</Button></Col>
        </Row>
      </Card>

      <Card className="emp-table-card">
        <Table responsive hover className="align-middle mb-0">
          <thead><tr><th>Employee</th><th>Department</th><th>Permissions</th><th>Status</th><th>Created</th><th className="text-end">Action</th></tr></thead>
          <tbody>{loading ? <tr><td colSpan="6" className="text-center py-5"><Spinner animation="border" size="sm" /> Loading...</td></tr> : employees.length === 0 ? <tr><td colSpan="6" className="text-center py-5">No employees found.</td></tr> : employees.map((emp) => <tr key={emp._id}><td><strong>{emp.name}</strong><small>{emp.email} / {emp.phone}</small></td><td>{emp.department || 'GENERAL'}<small>{emp.agentProfile?.designation || ''}</small></td><td><small>{permissionText(emp.permissions)}</small></td><td><Badge bg={emp.status === 'active' || emp.isActive ? 'success' : 'secondary'}>{emp.status || (emp.isActive ? 'active' : 'inactive')}</Badge></td><td>{emp.createdAt ? new Date(emp.createdAt).toLocaleDateString('en-IN') : 'N/A'}</td><td className="text-end"><Button size="sm" variant="outline-primary" onClick={() => openEdit(emp)}><Edit size={14} /></Button> <Button size="sm" variant="outline-warning" onClick={() => { setSelected(emp); setResetPassword(''); }}><KeyRound size={14} /></Button> <Button size="sm" variant={emp.status === 'active' || emp.isActive ? 'outline-danger' : 'outline-success'} onClick={() => toggleStatus(emp)}>{emp.status === 'active' || emp.isActive ? 'Disable' : 'Enable'}</Button></td></tr>)}</tbody>
        </Table>
      </Card>
      {pagination.pages > 1 && <Pagination className="justify-content-center mt-3"><Pagination.Prev disabled={pagination.page <= 1} onClick={() => load(pagination.page - 1)} /><Pagination.Item active>{pagination.page}</Pagination.Item><Pagination.Next disabled={pagination.page >= pagination.pages} onClick={() => load(pagination.page + 1)} /></Pagination>}

      <Modal show={showForm} onHide={() => setShowForm(false)} size="lg"><Modal.Header closeButton><Modal.Title>{selected ? 'Edit Employee' : 'Add Employee'}</Modal.Title></Modal.Header><Modal.Body><Row className="g-3"><Col md={6}><Form.Label>Name</Form.Label><Form.Control value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Col><Col md={6}><Form.Label>Email</Form.Label><Form.Control type="email" disabled={!!selected} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Col><Col md={6}><Form.Label>Phone</Form.Label><Form.Control value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })} /></Col>{!selected && <Col md={6}><Form.Label>Password</Form.Label><Form.Control type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Col>}<Col md={4}><Form.Label>Department</Form.Label><Form.Select value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>{['SUPPORT','OPERATIONS','COLLECTIONS','LEGAL','FINANCE','ADMIN'].map((d) => <option key={d}>{d}</option>)}</Form.Select></Col><Col md={4}><Form.Label>Designation</Form.Label><Form.Control value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} /></Col><Col md={4}><Form.Label>Joining Date</Form.Label><Form.Control type="date" value={form.joiningDate} onChange={(e) => setForm({ ...form, joiningDate: e.target.value })} /></Col><Col md={12}><div className="perm-grid">{permissionGroups.map((permission) => <Form.Check key={permission.key} type="switch" label={permission.label} checked={!!form.permissions[permission.key]} onChange={(e) => updatePermission(permission.key, e.target.checked)} />)}</div></Col></Row></Modal.Body><Modal.Footer><Button variant="outline-secondary" onClick={() => setShowForm(false)}>Cancel</Button><Button disabled={saving} onClick={saveEmployee}>{saving ? 'Saving...' : 'Save Employee'}</Button></Modal.Footer></Modal>

      <Modal show={!!selected && !showForm} onHide={() => setSelected(null)}><Modal.Header closeButton><Modal.Title>Reset Password</Modal.Title></Modal.Header><Modal.Body><Alert variant="info">{selected?.name}</Alert><Form.Label>New Password</Form.Label><Form.Control type="password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} /></Modal.Body><Modal.Footer><Button variant="outline-secondary" onClick={() => setSelected(null)}>Cancel</Button><Button disabled={saving || resetPassword.length < 6} onClick={resetEmployeePassword}>Reset Password</Button></Modal.Footer></Modal>
      <style>{`.emp-page{padding:8px 0 24px;color:#111827}.emp-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:18px}.emp-head p{margin:0 0 4px;color:#0f766e;font-size:12px;font-weight:900;text-transform:uppercase}.emp-head h2{display:flex;gap:10px;align-items:center;margin:0;font-weight:850}.emp-head span,.emp-table-card td small{color:#64748b}.emp-actions{display:flex;gap:8px;flex-wrap:wrap}.emp-actions .btn,.emp-table-card .btn{display:inline-flex;align-items:center;gap:6px}.emp-stat,.emp-panel,.emp-table-card{border:1px solid #e5e7eb;border-radius:8px;box-shadow:0 10px 26px rgba(15,23,42,.06)}.emp-stat{padding:16px}.emp-stat span{display:block;color:#64748b;font-weight:800}.emp-stat strong{display:block;font-size:24px;margin:4px 0}.emp-stat.success strong{color:#047857}.emp-stat.danger strong{color:#b91c1c}.emp-panel{padding:16px}.emp-table-card{overflow:hidden}.emp-table-card thead th{background:#f8fafc;color:#475569;font-size:12px;text-transform:uppercase}.emp-table-card td small{display:block}.perm-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:12px;border:1px solid #e5e7eb;border-radius:8px;background:#f8fafc}@media(max-width:768px){.emp-head{flex-direction:column}.perm-grid{grid-template-columns:1fr}}`}</style>
    </div>
  );
};

export default Employees;
