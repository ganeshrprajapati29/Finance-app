import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Col, Form, InputGroup, Modal, ProgressBar, Row, Table } from 'react-bootstrap';
import { BarChart3, Download, Eye, PhoneCall, RefreshCw, Route, Search, Target, Users, WalletCards } from 'lucide-react';
import api from '../api/axios';

const formatCurrency = (amount) => `Rs. ${Number(amount || 0).toLocaleString('en-IN')}`;
const formatDateTime = (date) => date ? new Date(date).toLocaleString('en-IN') : 'N/A';
const pct = (part, total) => total > 0 ? Math.round((part / total) * 100) : 0;
const locationText = (location) => !location ? '-' : typeof location === 'string' ? location : [location.address, location.city, location.state].filter(Boolean).join(', ') || '-';

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

const StatCard = ({ icon: Icon, label, value, tone }) => (
  <div className={`perf-stat perf-stat-${tone}`}>
    <div className="perf-stat-icon"><Icon size={20} /></div>
    <div><span>{label}</span><strong>{value}</strong></div>
  </div>
);

const AgentPerformanceReport = () => {
  const [performances, setPerformances] = useState([]);
  const [agents, setAgents] = useState([]);
  const [callLogs, setCallLogs] = useState([]);
  const [visitLogs, setVisitLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [filters, setFilters] = useState({ agentId: '', startDate: '', endDate: '', search: '' });

  const fetchAgents = async () => {
    try {
      const res = await api.get('/agents');
      setAgents(res.data?.data?.agents || []);
    } catch {
      setAgents([]);
    }
  };

  const fetchPerformance = async () => {
    try {
      setLoading(true);
      setError('');
      const query = new URLSearchParams();
      if (filters.agentId) query.append('agentId', filters.agentId);
      if (filters.startDate) query.append('startDate', filters.startDate);
      if (filters.endDate) query.append('endDate', filters.endDate);
      const res = await api.get(`/admin/collections/agent-performance${query.toString() ? `?${query}` : ''}`);
      setPerformances(res.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Agent performance load nahi ho paaya.');
      setPerformances([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  useEffect(() => {
    fetchPerformance();
  }, [filters.agentId, filters.startDate, filters.endDate]);

  const filtered = useMemo(() => {
    const term = filters.search.trim().toLowerCase();
    if (!term) return performances;
    return performances.filter((item) => [item.agent?.name, item.agent?.email, item.agent?.phone, item.agent?.agentProfile?.area].some((value) => String(value || '').toLowerCase().includes(term)));
  }, [filters.search, performances]);

  const stats = useMemo(() => ({
    agents: performances.length,
    assigned: performances.reduce((sum, item) => sum + Number(item.totalAssigned || 0), 0),
    recovered: performances.reduce((sum, item) => sum + Number(item.recoveredAmount || 0), 0),
    overdue: performances.reduce((sum, item) => sum + Number(item.totalOverdueAmount || 0), 0),
    calls: performances.reduce((sum, item) => sum + Number(item.callLogs || 0), 0),
    visits: performances.reduce((sum, item) => sum + Number(item.visitLogs || 0), 0)
  }), [performances]);

  const openDetail = async (item) => {
    setSelectedAgent(item);
    setDetailLoading(true);
    try {
      const [calls, visits] = await Promise.all([
        api.get(`/admin/collections/call-logs?agentId=${item.agent?._id}&limit=8`),
        api.get(`/admin/collections/visit-logs?agentId=${item.agent?._id}&limit=8`)
      ]);
      setCallLogs(calls.data?.data?.callLogs || []);
      setVisitLogs(visits.data?.data?.visitLogs || []);
    } catch {
      setCallLogs([]);
      setVisitLogs([]);
    } finally {
      setDetailLoading(false);
    }
  };

  const exportRows = () => {
    downloadCsv(filtered.map((item) => ({
      agent: item.agent?.name || '',
      email: item.agent?.email || '',
      assigned: item.totalAssigned || 0,
      active: item.activeCases || 0,
      resolved: item.resolvedCases || 0,
      legal: item.legalCases || 0,
      calls: item.callLogs || 0,
      visits: item.visitLogs || 0,
      ptpCreated: item.ptpCreated || 0,
      ptpKept: item.ptpKept || 0,
      recovered: item.recoveredAmount || 0,
      overdue: item.totalOverdueAmount || 0,
      target: item.targetCollection || 0
    })), 'agent-performance.csv');
  };

  return (
    <div className="perf-page">
      <div className="perf-header">
        <div>
          <div className="perf-eyebrow">Collections</div>
          <h1>Agent Performance</h1>
          <p>Track assignment load, recovery, calls, visits, PTP quality, and target achievement per agent.</p>
        </div>
        <div className="perf-actions">
          <Button variant="light" onClick={fetchPerformance}><RefreshCw size={16} /> Refresh</Button>
          <Button variant="outline-light" onClick={exportRows} disabled={!filtered.length}><Download size={16} /> Export</Button>
        </div>
      </div>

      {error && <Alert variant="danger" className="mt-3" dismissible onClose={() => setError('')}>{error}</Alert>}

      <Row className="g-3 mt-1">
        <Col xl={2} md={4}><StatCard icon={Users} label="Agents" value={stats.agents} tone="blue" /></Col>
        <Col xl={2} md={4}><StatCard icon={Target} label="Assigned" value={stats.assigned} tone="purple" /></Col>
        <Col xl={2} md={4}><StatCard icon={WalletCards} label="Recovered" value={formatCurrency(stats.recovered)} tone="green" /></Col>
        <Col xl={2} md={4}><StatCard icon={BarChart3} label="Overdue" value={formatCurrency(stats.overdue)} tone="amber" /></Col>
        <Col xl={2} md={4}><StatCard icon={PhoneCall} label="Calls" value={stats.calls} tone="cyan" /></Col>
        <Col xl={2} md={4}><StatCard icon={Route} label="Visits" value={stats.visits} tone="red" /></Col>
      </Row>

      <div className="perf-panel">
        <Row className="g-3">
          <Col lg={3}><Form.Select value={filters.agentId} onChange={(e) => setFilters((current) => ({ ...current, agentId: e.target.value }))}><option value="">All agents</option>{agents.map((agent) => <option key={agent._id} value={agent._id}>{agent.name}</option>)}</Form.Select></Col>
          <Col lg={2}><Form.Control type="date" value={filters.startDate} onChange={(e) => setFilters((current) => ({ ...current, startDate: e.target.value }))} /></Col>
          <Col lg={2}><Form.Control type="date" value={filters.endDate} onChange={(e) => setFilters((current) => ({ ...current, endDate: e.target.value }))} /></Col>
          <Col lg={5}><InputGroup><InputGroup.Text><Search size={16} /></InputGroup.Text><Form.Control value={filters.search} onChange={(e) => setFilters((current) => ({ ...current, search: e.target.value }))} placeholder="Search agent, email, phone, area..." /></InputGroup></Col>
        </Row>
      </div>

      <div className="perf-table-card">
        <div className="table-responsive">
          <Table hover className="perf-table mb-0">
            <thead><tr><th>Agent</th><th>Cases</th><th>Resolution</th><th>Recovery</th><th>Target</th><th>Calls</th><th>Visits</th><th>PTP</th><th>Action</th></tr></thead>
            <tbody>
              {loading && <tr><td colSpan="9" className="text-center py-5">Loading performance...</td></tr>}
              {!loading && filtered.map((item) => {
                const resolution = pct(item.resolvedCases || 0, item.totalAssigned || 0);
                const target = Number(item.targetCollection || 0);
                const achievement = pct(item.recoveredAmount || 0, target);
                const ptpRate = pct(item.ptpKept || 0, item.ptpCreated || 0);
                return (
                  <tr key={item.agent?._id}>
                    <td><strong>{item.agent?.name || 'N/A'}</strong><span>{item.agent?.email || ''}<br />{item.agent?.phone || ''}</span></td>
                    <td><strong>{item.totalAssigned || 0}</strong><span>{item.activeCases || 0} active, {item.legalCases || 0} legal</span></td>
                    <td><div className="perf-progress"><ProgressBar now={resolution} variant={resolution >= 70 ? 'success' : resolution >= 40 ? 'warning' : 'danger'} /><span>{resolution}%</span></div></td>
                    <td><strong className="text-success">{formatCurrency(item.recoveredAmount)}</strong><span>Due {formatCurrency(item.totalOverdueAmount)}</span></td>
                    <td><div className="perf-progress"><ProgressBar now={achievement} variant={achievement >= 80 ? 'success' : 'info'} /><span>{achievement}%</span></div><span>{formatCurrency(target)}</span></td>
                    <td>{item.callLogs || 0}</td>
                    <td>{item.visitLogs || 0}</td>
                    <td><Badge bg={ptpRate >= 60 ? 'success' : ptpRate ? 'warning' : 'secondary'}>{item.ptpKept || 0}/{item.ptpCreated || 0}</Badge></td>
                    <td><Button size="sm" variant="outline-secondary" onClick={() => openDetail(item)}><Eye size={15} /></Button></td>
                  </tr>
                );
              })}
              {!loading && !filtered.length && <tr><td colSpan="9" className="text-center py-5 text-muted">No performance data found</td></tr>}
            </tbody>
          </Table>
        </div>
      </div>

      <Modal show={!!selectedAgent} onHide={() => setSelectedAgent(null)} size="xl" centered>
        <Modal.Header closeButton><Modal.Title>{selectedAgent?.agent?.name || 'Agent'} Performance Details</Modal.Title></Modal.Header>
        <Modal.Body>
          {selectedAgent && (
            <>
              <Row className="g-3 mb-3">
                <Col md={3}><div className="perf-mini"><span>Assigned</span><strong>{selectedAgent.totalAssigned || 0}</strong></div></Col>
                <Col md={3}><div className="perf-mini"><span>Recovered</span><strong>{formatCurrency(selectedAgent.recoveredAmount)}</strong></div></Col>
                <Col md={3}><div className="perf-mini"><span>Calls</span><strong>{selectedAgent.callLogs || 0}</strong></div></Col>
                <Col md={3}><div className="perf-mini"><span>Visits</span><strong>{selectedAgent.visitLogs || 0}</strong></div></Col>
              </Row>
              {detailLoading ? <div className="text-center py-4">Loading activity...</div> : (
                <Row className="g-3">
                  <Col lg={6}>
                    <h3 className="perf-subtitle">Recent Calls</h3>
                    <Table size="sm" hover><thead><tr><th>Date</th><th>Borrower</th><th>Status</th><th>Next</th></tr></thead><tbody>{callLogs.map((log) => <tr key={log._id}><td>{formatDateTime(log.createdAt)}</td><td>{log.userId?.name || 'N/A'}</td><td><Badge bg={log.callStatus === 'CONNECTED' ? 'success' : 'warning'}>{log.callStatus}</Badge></td><td>{log.nextAction || '-'}</td></tr>)}{!callLogs.length && <tr><td colSpan="4" className="text-center text-muted">No calls found</td></tr>}</tbody></Table>
                  </Col>
                  <Col lg={6}>
                    <h3 className="perf-subtitle">Recent Visits</h3>
                    <Table size="sm" hover><thead><tr><th>Date</th><th>Borrower</th><th>Status</th><th>Location</th></tr></thead><tbody>{visitLogs.map((log) => <tr key={log._id}><td>{formatDateTime(log.createdAt)}</td><td>{log.userId?.name || 'N/A'}</td><td><Badge bg={log.visitStatus === 'COMPLETED' ? 'success' : 'warning'}>{log.visitStatus}</Badge></td><td>{locationText(log.location)}</td></tr>)}{!visitLogs.length && <tr><td colSpan="4" className="text-center text-muted">No visits found</td></tr>}</tbody></Table>
                  </Col>
                </Row>
              )}
            </>
          )}
        </Modal.Body>
        <Modal.Footer><Button variant="secondary" onClick={() => setSelectedAgent(null)}>Close</Button></Modal.Footer>
      </Modal>

      <style>{`
        .perf-page { color: #0f172a; }
        .perf-header { background: linear-gradient(135deg, #0f172a 0%, #4338ca 56%, #0f766e 100%); border-radius: 18px; padding: 28px; color: #fff; display: flex; justify-content: space-between; gap: 18px; align-items: flex-start; box-shadow: 0 18px 45px rgba(15,23,42,.18); }
        .perf-header h1 { margin: 2px 0 8px; font-size: 30px; font-weight: 850; } .perf-header p { margin: 0; color: rgba(255,255,255,.78); font-weight: 500; }
        .perf-eyebrow { font-size: 12px; text-transform: uppercase; font-weight: 800; color: #ddd6fe; } .perf-actions { display: flex; gap: 10px; flex-wrap: wrap; }
        .perf-actions .btn { display: inline-flex; align-items: center; gap: 8px; font-weight: 800; }
        .perf-stat, .perf-panel, .perf-table-card, .perf-mini { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; box-shadow: 0 12px 30px rgba(15,23,42,.06); }
        .perf-stat { min-height: 112px; padding: 17px; display: flex; gap: 13px; align-items: flex-start; } .perf-stat-icon { width: 42px; height: 42px; border-radius: 12px; display: grid; place-items: center; color: #fff; }
        .perf-stat-blue .perf-stat-icon { background: #2563eb; } .perf-stat-purple .perf-stat-icon { background: #7c3aed; } .perf-stat-green .perf-stat-icon { background: #059669; } .perf-stat-amber .perf-stat-icon { background: #d97706; } .perf-stat-cyan .perf-stat-icon { background: #0891b2; } .perf-stat-red .perf-stat-icon { background: #dc2626; }
        .perf-stat span, .perf-mini span { display: block; color: #64748b; font-size: 12px; font-weight: 850; text-transform: uppercase; } .perf-stat strong, .perf-mini strong { font-size: 21px; font-weight: 850; }
        .perf-panel { padding: 18px; margin: 18px 0; } .perf-table-card { overflow: hidden; }
        .perf-table thead th { background: #f8fafc; color: #475569; font-size: 12px; text-transform: uppercase; white-space: nowrap; } .perf-table td { vertical-align: middle; font-weight: 600; }
        .perf-table td span { display: block; color: #64748b; font-size: 12px; } .perf-progress { min-width: 115px; } .perf-progress .progress { height: 8px; margin-bottom: 4px; }
        .perf-mini { padding: 14px; } .perf-subtitle { font-size: 16px; font-weight: 850; margin: 0 0 10px; }
        @media (max-width: 768px) { .perf-header { flex-direction: column; padding: 22px; } .perf-actions { width: 100%; } .perf-actions .btn { flex: 1; justify-content: center; } }
      `}</style>
    </div>
  );
};

export default AgentPerformanceReport;
