import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Col, Form, InputGroup, Modal, Row, Table } from 'react-bootstrap';
import { Download, Eye, KeyRound, RefreshCw, Search, ShieldCheck, Trash2, UserPlus, Users, WalletCards } from 'lucide-react';
import api from '../api/axios';

const departments = ['COLLECTIONS', 'VERIFICATION', 'LEGAL', 'RECOVERY', 'SUPPORT', 'OPERATIONS'];
const defaultForm = {
  name: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
  department: 'COLLECTIONS',
  designation: 'Collection Agent',
  employeeId: '',
  joiningDate: new Date().toISOString().slice(0, 10),
  area: '',
  zone: '',
  targetCollection: '',
  salary: '',
  address: '',
  aadhaarNumber: '',
  panNumber: '',
  emergencyContact: '',
  emergencyContactName: ''
};

const formatCurrency = (amount) => `Rs. ${Number(amount || 0).toLocaleString('en-IN')}`;
const formatDate = (date) => date ? new Date(date).toLocaleDateString('en-IN') : 'N/A';

const downloadCsv = (rows, filename) => {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(','), ...rows.map((row) => headers.map((header) => `"${String(row[header] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const profile = (agent) => agent.agentProfile || agent.data || {};

const StatCard = ({ icon: Icon, label, value, tone }) => (
  <div className={`agent-stat agent-stat-${tone}`}>
    <div className="agent-stat-icon"><Icon size={20} /></div>
    <div><span>{label}</span><strong>{value}</strong></div>
  </div>
);

const CreateAgent = () => {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('create');
  const [filters, setFilters] = useState({ status: '', department: '', search: '' });
  const [form, setForm] = useState(defaultForm);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [resetPassword, setResetPassword] = useState('');

  const fetchAgents = async () => {
    try {
      setLoading(true);
      setError('');
      const query = new URLSearchParams();
      if (filters.status) query.append('status', filters.status);
      if (filters.department) query.append('department', filters.department);
      const res = await api.get(`/agents${query.toString() ? `?${query}` : ''}`);
      setAgents(res.data?.data?.agents || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Agents load nahi ho paaye.');
      setAgents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, [filters.status, filters.department]);

  const filteredAgents = useMemo(() => {
    const term = filters.search.trim().toLowerCase();
    if (!term) return agents;
    return agents.filter((agent) => {
      const p = profile(agent);
      return [agent.name, agent.email, agent.phone, p.employeeId, p.area, p.zone].some((value) => String(value || '').toLowerCase().includes(term));
    });
  }, [agents, filters.search]);

  const stats = useMemo(() => ({
    total: agents.length,
    active: agents.filter((agent) => agent.isActive !== false && agent.status !== 'inactive').length,
    departments: new Set(agents.map((agent) => agent.department).filter(Boolean)).size,
    target: agents.reduce((sum, agent) => sum + Number(profile(agent).targetCollection || 0), 0)
  }), [agents]);

  const updateForm = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const handleCreate = async (event) => {
    event.preventDefault();
    if (form.password !== form.confirmPassword) {
      setError('Password aur confirm password match nahi ho rahe.');
      return;
    }
    if (!/^[6-9]\d{9}$/.test(form.phone)) {
      setError('Valid 10-digit Indian mobile number enter karein.');
      return;
    }
    try {
      setProcessing(true);
      setError('');
      await api.post('/agents', {
        name: form.name,
        email: form.email.toLowerCase(),
        phone: form.phone,
        password: form.password,
        roles: ['COLLECTION_AGENT'],
        department: form.department,
        isActive: true,
        agentProfile: {
          employeeId: form.employeeId,
          designation: form.designation,
          joiningDate: form.joiningDate,
          area: form.area,
          zone: form.zone,
          targetCollection: form.targetCollection,
          salary: form.salary,
          address: form.address,
          aadhaarNumber: form.aadhaarNumber,
          panNumber: form.panNumber.toUpperCase(),
          emergencyContact: form.emergencyContact,
          emergencyContactName: form.emergencyContactName
        }
      });
      setSuccess('Agent successfully create ho gaya.');
      setForm(defaultForm);
      setActiveTab('list');
      fetchAgents();
    } catch (err) {
      setError(err.response?.data?.message || 'Agent create nahi ho paaya.');
    } finally {
      setProcessing(false);
    }
  };

  const deactivateAgent = async (agent) => {
    try {
      setProcessing(true);
      await api.delete(`/agents/${agent._id}`);
      setSuccess('Agent deactivate ho gaya.');
      fetchAgents();
    } catch (err) {
      setError(err.response?.data?.message || 'Agent deactivate nahi ho paaya.');
    } finally {
      setProcessing(false);
    }
  };

  const handleResetPassword = async () => {
    if (!selectedAgent || resetPassword.length < 6) {
      setError('New password minimum 6 characters ka hona chahiye.');
      return;
    }
    try {
      setProcessing(true);
      await api.post(`/agents/${selectedAgent.agent._id}/reset-password`, { password: resetPassword });
      setSuccess('Agent password reset ho gaya.');
      setSelectedAgent(null);
      setResetPassword('');
    } catch (err) {
      setError(err.response?.data?.message || 'Password reset nahi ho paaya.');
    } finally {
      setProcessing(false);
    }
  };

  const exportAgents = () => {
    downloadCsv(filteredAgents.map((agent) => {
      const p = profile(agent);
      return {
        employeeId: p.employeeId || '',
        name: agent.name,
        email: agent.email,
        phone: agent.phone,
        department: agent.department,
        designation: p.designation || '',
        area: p.area || '',
        zone: p.zone || '',
        targetCollection: p.targetCollection || 0,
        status: agent.status || (agent.isActive ? 'active' : 'inactive')
      };
    }), 'collection-agents.csv');
  };

  return (
    <div className="agent-page">
      <div className="agent-header">
        <div>
          <div className="agent-eyebrow">Team Management</div>
          <h1>Create Agent</h1>
          <p>Create collection agents, manage login access, territories, targets, and operational status.</p>
        </div>
        <div className="agent-actions">
          <Button variant="light" onClick={() => setActiveTab('create')}><UserPlus size={16} /> New Agent</Button>
          <Button variant="outline-light" onClick={fetchAgents}><RefreshCw size={16} /> Refresh</Button>
          <Button variant="outline-light" onClick={exportAgents} disabled={!filteredAgents.length}><Download size={16} /> Export</Button>
        </div>
      </div>

      {error && <Alert variant="danger" className="mt-3" dismissible onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert variant="success" className="mt-3" dismissible onClose={() => setSuccess('')}>{success}</Alert>}

      <Row className="g-3 mt-1">
        <Col xl={3} md={6}><StatCard icon={Users} label="Total Agents" value={stats.total} tone="blue" /></Col>
        <Col xl={3} md={6}><StatCard icon={ShieldCheck} label="Active Agents" value={stats.active} tone="green" /></Col>
        <Col xl={3} md={6}><StatCard icon={UserPlus} label="Departments" value={stats.departments} tone="purple" /></Col>
        <Col xl={3} md={6}><StatCard icon={WalletCards} label="Monthly Target" value={formatCurrency(stats.target)} tone="amber" /></Col>
      </Row>

      <div className="agent-tabs">
        <button className={activeTab === 'create' ? 'active' : ''} onClick={() => setActiveTab('create')}>Create Agent</button>
        <button className={activeTab === 'list' ? 'active' : ''} onClick={() => setActiveTab('list')}>All Agents</button>
      </div>

      {activeTab === 'create' && (
        <div className="agent-card">
          <Form onSubmit={handleCreate}>
            <div className="agent-section-title">Basic Information</div>
            <Row className="g-3">
              <Col md={4}><Form.Label>Name</Form.Label><Form.Control required value={form.name} onChange={(e) => updateForm('name', e.target.value)} /></Col>
              <Col md={4}><Form.Label>Email</Form.Label><Form.Control required type="email" value={form.email} onChange={(e) => updateForm('email', e.target.value)} /></Col>
              <Col md={4}><Form.Label>Phone</Form.Label><Form.Control required maxLength={10} value={form.phone} onChange={(e) => updateForm('phone', e.target.value.replace(/\D/g, ''))} /></Col>
              <Col md={6}><Form.Label>Password</Form.Label><Form.Control required type="password" minLength={6} value={form.password} onChange={(e) => updateForm('password', e.target.value)} /></Col>
              <Col md={6}><Form.Label>Confirm Password</Form.Label><Form.Control required type="password" value={form.confirmPassword} onChange={(e) => updateForm('confirmPassword', e.target.value)} /></Col>
            </Row>

            <div className="agent-section-title">Job Details</div>
            <Row className="g-3">
              <Col md={3}><Form.Label>Employee ID</Form.Label><Form.Control value={form.employeeId} onChange={(e) => updateForm('employeeId', e.target.value)} placeholder="Auto if blank" /></Col>
              <Col md={3}><Form.Label>Department</Form.Label><Form.Select value={form.department} onChange={(e) => updateForm('department', e.target.value)}>{departments.map((item) => <option key={item}>{item}</option>)}</Form.Select></Col>
              <Col md={3}><Form.Label>Designation</Form.Label><Form.Control value={form.designation} onChange={(e) => updateForm('designation', e.target.value)} /></Col>
              <Col md={3}><Form.Label>Joining Date</Form.Label><Form.Control type="date" value={form.joiningDate} onChange={(e) => updateForm('joiningDate', e.target.value)} /></Col>
              <Col md={3}><Form.Label>Area</Form.Label><Form.Control value={form.area} onChange={(e) => updateForm('area', e.target.value)} /></Col>
              <Col md={3}><Form.Label>Zone</Form.Label><Form.Control value={form.zone} onChange={(e) => updateForm('zone', e.target.value)} /></Col>
              <Col md={3}><Form.Label>Target Collection</Form.Label><InputGroup><InputGroup.Text>Rs.</InputGroup.Text><Form.Control type="number" value={form.targetCollection} onChange={(e) => updateForm('targetCollection', e.target.value)} /></InputGroup></Col>
              <Col md={3}><Form.Label>Salary</Form.Label><InputGroup><InputGroup.Text>Rs.</InputGroup.Text><Form.Control type="number" value={form.salary} onChange={(e) => updateForm('salary', e.target.value)} /></InputGroup></Col>
            </Row>

            <div className="agent-section-title">Documents & Emergency</div>
            <Row className="g-3">
              <Col md={6}><Form.Label>Address</Form.Label><Form.Control as="textarea" rows={2} value={form.address} onChange={(e) => updateForm('address', e.target.value)} /></Col>
              <Col md={3}><Form.Label>Aadhaar</Form.Label><Form.Control maxLength={12} value={form.aadhaarNumber} onChange={(e) => updateForm('aadhaarNumber', e.target.value.replace(/\D/g, ''))} /></Col>
              <Col md={3}><Form.Label>PAN</Form.Label><Form.Control maxLength={10} value={form.panNumber} onChange={(e) => updateForm('panNumber', e.target.value.toUpperCase())} /></Col>
              <Col md={6}><Form.Label>Emergency Contact</Form.Label><Form.Control maxLength={10} value={form.emergencyContact} onChange={(e) => updateForm('emergencyContact', e.target.value.replace(/\D/g, ''))} /></Col>
              <Col md={6}><Form.Label>Emergency Contact Name</Form.Label><Form.Control value={form.emergencyContactName} onChange={(e) => updateForm('emergencyContactName', e.target.value)} /></Col>
            </Row>

            <div className="agent-form-actions">
              <Button type="submit" disabled={processing}>{processing ? 'Creating...' : 'Create Agent'}</Button>
              <Button type="button" variant="outline-secondary" onClick={() => setForm(defaultForm)}>Reset</Button>
            </div>
          </Form>
        </div>
      )}

      {activeTab === 'list' && (
        <div className="agent-card">
          <Row className="g-3 mb-3">
            <Col lg={3}><Form.Select value={filters.status} onChange={(e) => setFilters((current) => ({ ...current, status: e.target.value }))}><option value="">All status</option><option value="active">Active</option><option value="inactive">Inactive</option></Form.Select></Col>
            <Col lg={3}><Form.Select value={filters.department} onChange={(e) => setFilters((current) => ({ ...current, department: e.target.value }))}><option value="">All departments</option>{departments.map((item) => <option key={item}>{item}</option>)}</Form.Select></Col>
            <Col lg={6}><InputGroup><InputGroup.Text><Search size={16} /></InputGroup.Text><Form.Control value={filters.search} onChange={(e) => setFilters((current) => ({ ...current, search: e.target.value }))} placeholder="Search name, phone, employee id, area..." /></InputGroup></Col>
          </Row>
          <div className="table-responsive">
            <Table hover className="agent-table mb-0">
              <thead><tr><th>Agent</th><th>Employee ID</th><th>Department</th><th>Territory</th><th>Target</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead>
              <tbody>
                {loading && <tr><td colSpan="8" className="text-center py-5">Loading agents...</td></tr>}
                {!loading && filteredAgents.map((agent) => {
                  const p = profile(agent);
                  return (
                    <tr key={agent._id}>
                      <td><strong>{agent.name}</strong><span>{agent.email}<br />{agent.phone}</span></td>
                      <td>{p.employeeId || '-'}</td>
                      <td>{agent.department || '-'}</td>
                      <td>{p.area || '-'}<span>{p.zone || ''}</span></td>
                      <td><strong>{formatCurrency(p.targetCollection)}</strong></td>
                      <td><Badge bg={agent.isActive !== false && agent.status !== 'inactive' ? 'success' : 'secondary'}>{agent.status || (agent.isActive ? 'active' : 'inactive')}</Badge></td>
                      <td>{formatDate(p.joiningDate || agent.createdAt)}</td>
                      <td><div className="agent-row-actions"><Button size="sm" variant="outline-secondary" onClick={() => setSelectedAgent({ mode: 'detail', agent })}><Eye size={15} /></Button><Button size="sm" variant="outline-warning" onClick={() => setSelectedAgent({ mode: 'reset', agent })}><KeyRound size={15} /></Button><Button size="sm" variant="outline-danger" onClick={() => deactivateAgent(agent)} disabled={processing}><Trash2 size={15} /></Button></div></td>
                    </tr>
                  );
                })}
                {!loading && !filteredAgents.length && <tr><td colSpan="8" className="text-center py-5 text-muted">No agents found</td></tr>}
              </tbody>
            </Table>
          </div>
        </div>
      )}

      <Modal show={selectedAgent?.mode === 'detail'} onHide={() => setSelectedAgent(null)} size="lg" centered>
        <Modal.Header closeButton><Modal.Title>Agent Details</Modal.Title></Modal.Header>
        <Modal.Body>{selectedAgent?.agent && (() => { const p = profile(selectedAgent.agent); return <div className="agent-detail"><p><span>Name</span><strong>{selectedAgent.agent.name}</strong></p><p><span>Contact</span><strong>{selectedAgent.agent.email} / {selectedAgent.agent.phone}</strong></p><p><span>Employee ID</span><strong>{p.employeeId || 'N/A'}</strong></p><p><span>Role</span><strong>{p.designation || 'Collection Agent'}</strong></p><p><span>Territory</span><strong>{p.area || 'N/A'} {p.zone ? `(${p.zone})` : ''}</strong></p><p><span>Target</span><strong>{formatCurrency(p.targetCollection)}</strong></p><p><span>Address</span><strong>{p.address || 'N/A'}</strong></p><p><span>Emergency</span><strong>{p.emergencyContactName || 'N/A'} - {p.emergencyContact || 'N/A'}</strong></p></div>; })()}</Modal.Body>
        <Modal.Footer><Button variant="secondary" onClick={() => setSelectedAgent(null)}>Close</Button></Modal.Footer>
      </Modal>

      <Modal show={selectedAgent?.mode === 'reset'} onHide={() => setSelectedAgent(null)} centered>
        <Modal.Header closeButton><Modal.Title>Reset Password</Modal.Title></Modal.Header>
        <Modal.Body><Alert variant="info">{selectedAgent?.agent?.name}</Alert><Form.Label>New Password</Form.Label><Form.Control type="password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} /></Modal.Body>
        <Modal.Footer><Button variant="secondary" onClick={() => setSelectedAgent(null)}>Cancel</Button><Button onClick={handleResetPassword} disabled={processing || resetPassword.length < 6}>Reset</Button></Modal.Footer>
      </Modal>

      <style>{`
        .agent-page { color: #0f172a; }
        .agent-header { background: linear-gradient(135deg, #0f172a 0%, #0f766e 56%, #2563eb 100%); border-radius: 18px; padding: 28px; color: #fff; display: flex; justify-content: space-between; gap: 18px; align-items: flex-start; box-shadow: 0 18px 45px rgba(15,23,42,.18); }
        .agent-header h1 { margin: 2px 0 8px; font-size: 30px; font-weight: 850; } .agent-header p { margin: 0; color: rgba(255,255,255,.78); font-weight: 500; }
        .agent-eyebrow { font-size: 12px; text-transform: uppercase; font-weight: 800; color: #bfdbfe; } .agent-actions { display: flex; gap: 10px; flex-wrap: wrap; }
        .agent-actions .btn, .agent-row-actions .btn { display: inline-flex; align-items: center; gap: 8px; font-weight: 800; }
        .agent-stat, .agent-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; box-shadow: 0 12px 30px rgba(15,23,42,.06); }
        .agent-stat { min-height: 112px; padding: 17px; display: flex; gap: 13px; align-items: flex-start; } .agent-stat-icon { width: 42px; height: 42px; border-radius: 12px; display: grid; place-items: center; color: #fff; }
        .agent-stat-blue .agent-stat-icon { background: #2563eb; } .agent-stat-green .agent-stat-icon { background: #059669; } .agent-stat-purple .agent-stat-icon { background: #7c3aed; } .agent-stat-amber .agent-stat-icon { background: #d97706; }
        .agent-stat span { display: block; color: #64748b; font-size: 12px; font-weight: 850; text-transform: uppercase; } .agent-stat strong { font-size: 22px; font-weight: 850; }
        .agent-tabs { display: flex; gap: 8px; margin: 18px 0; } .agent-tabs button { border: 1px solid #e2e8f0; background: #fff; border-radius: 10px; padding: 10px 16px; font-weight: 850; } .agent-tabs button.active { background: #0f766e; color: #fff; border-color: #0f766e; }
        .agent-card { padding: 20px; } .agent-section-title { margin: 20px 0 12px; color: #334155; font-weight: 850; text-transform: uppercase; font-size: 12px; }
        .agent-form-actions { display: flex; gap: 10px; margin-top: 20px; } .agent-table thead th { background: #f8fafc; color: #475569; font-size: 12px; text-transform: uppercase; white-space: nowrap; }
        .agent-table td { vertical-align: middle; font-weight: 600; } .agent-table td span { display: block; color: #64748b; font-size: 12px; }
        .agent-row-actions { display: flex; gap: 6px; } .agent-detail p { display: flex; justify-content: space-between; gap: 16px; border-bottom: 1px solid #f1f5f9; padding: 10px 0; margin: 0; }
        .agent-detail span { color: #64748b; font-weight: 850; text-transform: uppercase; font-size: 12px; } .agent-detail strong { text-align: right; overflow-wrap: anywhere; }
        @media (max-width: 768px) { .agent-header { flex-direction: column; padding: 22px; } .agent-actions { width: 100%; } .agent-actions .btn { flex: 1; justify-content: center; } }
      `}</style>
    </div>
  );
};

export default CreateAgent;
