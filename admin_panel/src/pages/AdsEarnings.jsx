import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, InputGroup, Modal, Row, Table } from 'react-bootstrap';
import { BarChart3, Download, Edit3, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import api from '../api/axios';

const blankForm = {
  partner: 'Google Ads',
  campaign: '',
  leadsClicks: 0,
  perLeadRate: 0,
  status: 'active',
  startDate: '',
  endDate: '',
  notes: ''
};

const partners = ['Google Ads', 'Facebook Ads', 'Instagram Ads', 'LinkedIn Ads', 'YouTube Ads', 'Referral Partner', 'Other'];
const currency = (value) => `Rs. ${Number(value || 0).toLocaleString('en-IN')}`;
const dateOnly = (value) => (value ? new Date(value).toLocaleDateString('en-IN') : 'N/A');
const unwrap = (res) => res?.data?.data || res?.data || {};

const AdsEarnings = () => {
  const [campaigns, setCampaigns] = useState([]);
  const [stats, setStats] = useState({ totalEarnings: 0, totalLeads: 0, activeCampaigns: 0, avgRate: 0, campaigns: 0 });
  const [filters, setFilters] = useState({ partner: 'ALL', status: 'ALL', dateFrom: '', dateTo: '', search: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blankForm);

  const fetchAdsEarnings = async () => {
    try {
      setLoading(true);
      setError('');
      const params = new URLSearchParams();
      if (filters.partner !== 'ALL') params.set('partner', filters.partner);
      if (filters.status !== 'ALL') params.set('status', filters.status);
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.set('dateTo', filters.dateTo);
      if (filters.search.trim()) params.set('search', filters.search.trim());

      const res = await api.get(`/admin/earnings/ads?${params.toString()}`);
      const data = unwrap(res);
      setCampaigns(Array.isArray(data.items) ? data.items : []);
      setStats(data.stats || { totalEarnings: 0, totalLeads: 0, activeCampaigns: 0, avgRate: 0, campaigns: 0 });
    } catch (err) {
      setCampaigns([]);
      setStats({ totalEarnings: 0, totalLeads: 0, activeCampaigns: 0, avgRate: 0, campaigns: 0 });
      setError(err.response?.data?.message || err.message || 'Ads earnings load nahi ho paya');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdsEarnings();
  }, []);

  const calculatedTotal = useMemo(
    () => Number(form.leadsClicks || 0) * Number(form.perLeadRate || 0),
    [form.leadsClicks, form.perLeadRate]
  );

  const partnerBreakdown = useMemo(() => {
    const map = {};
    campaigns.forEach((item) => {
      map[item.partner] = (map[item.partner] || 0) + Number(item.totalEarned || 0);
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [campaigns]);

  const openModal = (campaign = null) => {
    setEditing(campaign);
    setForm(campaign ? {
      partner: campaign.partner || 'Google Ads',
      campaign: campaign.campaign || '',
      leadsClicks: campaign.leadsClicks || 0,
      perLeadRate: campaign.perLeadRate || 0,
      status: campaign.status || 'active',
      startDate: campaign.startDate ? campaign.startDate.slice(0, 10) : '',
      endDate: campaign.endDate ? campaign.endDate.slice(0, 10) : '',
      notes: campaign.notes || ''
    } : blankForm);
    setShowModal(true);
  };

  const saveCampaign = async (event) => {
    event.preventDefault();
    try {
      setSaving(true);
      const payload = { ...form, totalEarned: calculatedTotal };
      if (editing) await api.put(`/admin/earnings/ads/${editing._id}`, payload);
      else await api.post('/admin/earnings/ads', payload);
      setShowModal(false);
      setEditing(null);
      setForm(blankForm);
      fetchAdsEarnings();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Campaign save nahi ho paya');
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (campaign, status) => {
    await api.put(`/admin/earnings/ads/${campaign._id}`, { status });
    fetchAdsEarnings();
  };

  const deleteCampaign = async (campaign) => {
    if (!window.confirm(`${campaign.campaign} delete karna hai?`)) return;
    await api.delete(`/admin/earnings/ads/${campaign._id}`);
    fetchAdsEarnings();
  };

  const exportCsv = () => {
    const rows = [
      ['Partner', 'Campaign', 'Leads Clicks', 'Rate', 'Total Earned', 'Status', 'Start Date', 'End Date', 'Notes'],
      ...campaigns.map((item) => [item.partner, item.campaign, item.leadsClicks, item.perLeadRate, item.totalEarned, item.status, item.startDate || '', item.endDate || '', item.notes || ''])
    ];
    const blob = new Blob([rows.map((row) => row.map((cell) => `"${String(cell || '').replace(/"/g, '""')}"`).join(',')).join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'ads-earnings.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const statusBadge = (status) => {
    const map = { active: 'success', paused: 'warning', completed: 'primary', cancelled: 'secondary' };
    return <Badge bg={map[status] || 'secondary'}>{status || 'active'}</Badge>;
  };

  return (
    <div className="ads-page">
      <div className="ads-head">
        <div>
          <p>Marketing Revenue</p>
          <h2><BarChart3 size={28} /> Ads Earnings</h2>
          <span>Track partner campaigns, leads/clicks, per-lead rates and earned revenue.</span>
        </div>
        <div className="ads-actions">
          <Button variant="outline-secondary" onClick={fetchAdsEarnings}><RefreshCw size={16} /> Refresh</Button>
          <Button variant="outline-success" onClick={exportCsv}><Download size={16} /> Export</Button>
          <Button onClick={() => openModal()}><Plus size={16} /> Add Campaign</Button>
        </div>
      </div>

      {error && <Alert variant="warning" dismissible onClose={() => setError('')}>{error}</Alert>}

      <Row className="g-3 mb-3">
        <Col lg={3} md={6}><Card className="ads-stat"><span>Total Earnings</span><strong>{currency(stats.totalEarnings)}</strong><small>{stats.campaigns || campaigns.length} campaigns</small></Card></Col>
        <Col lg={3} md={6}><Card className="ads-stat"><span>Leads / Clicks</span><strong>{Number(stats.totalLeads || 0).toLocaleString('en-IN')}</strong><small>Total tracked leads</small></Card></Col>
        <Col lg={3} md={6}><Card className="ads-stat"><span>Active Campaigns</span><strong>{stats.activeCampaigns || 0}</strong><small>Currently earning</small></Card></Col>
        <Col lg={3} md={6}><Card className="ads-stat"><span>Average Rate</span><strong>{currency(stats.avgRate)}</strong><small>Per lead/click</small></Card></Col>
      </Row>

      <Card className="ads-panel mb-3">
        <Row className="g-2">
          <Col xl={3} md={6}>
            <InputGroup>
              <InputGroup.Text><Search size={16} /></InputGroup.Text>
              <Form.Control placeholder="Search campaign, notes..." value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
            </InputGroup>
          </Col>
          <Col xl={2} md={6}>
            <Form.Select value={filters.partner} onChange={(e) => setFilters({ ...filters, partner: e.target.value })}>
              <option value="ALL">All Partners</option>
              {partners.map((partner) => <option key={partner} value={partner}>{partner}</option>)}
            </Form.Select>
          </Col>
          <Col xl={2} md={6}>
            <Form.Select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
              <option value="ALL">All Status</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </Form.Select>
          </Col>
          <Col xl={2} md={6}><Form.Control type="date" value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} /></Col>
          <Col xl={2} md={6}><Form.Control type="date" value={filters.dateTo} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} /></Col>
          <Col xl={1} md={6}><Button variant="dark" className="w-100" onClick={fetchAdsEarnings}>Apply</Button></Col>
        </Row>
      </Card>

      <Row className="g-3">
        <Col xl={8}>
          <Card className="ads-table-card">
            <Table responsive hover className="align-middle mb-0">
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Leads</th>
                  <th>Rate</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Dates</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="7" className="text-center py-5">Loading ads earnings...</td></tr>
                ) : campaigns.length === 0 ? (
                  <tr><td colSpan="7" className="text-center py-5">No ads campaigns found. Add your first campaign.</td></tr>
                ) : campaigns.map((item) => (
                  <tr key={item._id}>
                    <td><strong>{item.campaign}</strong><small>{item.partner}</small></td>
                    <td>{Number(item.leadsClicks || 0).toLocaleString('en-IN')}</td>
                    <td>{currency(item.perLeadRate)}</td>
                    <td className="fw-bold text-success">{currency(item.totalEarned)}</td>
                    <td>{statusBadge(item.status)}</td>
                    <td><small>{dateOnly(item.startDate)} - {dateOnly(item.endDate)}</small></td>
                    <td>
                      <div className="ads-row-actions justify-content-end">
                        <Form.Select size="sm" value={item.status || 'active'} onChange={(e) => updateStatus(item, e.target.value)}>
                          <option value="active">Active</option>
                          <option value="paused">Paused</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                        </Form.Select>
                        <Button size="sm" variant="outline-primary" onClick={() => openModal(item)}><Edit3 size={14} /></Button>
                        <Button size="sm" variant="outline-danger" onClick={() => deleteCampaign(item)}><Trash2 size={14} /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </Col>
        <Col xl={4}>
          <Card className="ads-panel h-100">
            <h5>Partner Breakdown</h5>
            <p className="text-muted">Revenue split by ad partner.</p>
            {partnerBreakdown.length === 0 ? (
              <div className="text-center text-muted py-4">No partner data.</div>
            ) : partnerBreakdown.map(([partner, amount]) => {
              const percent = stats.totalEarnings ? Math.round((amount / stats.totalEarnings) * 100) : 0;
              return (
                <div className="ads-partner" key={partner}>
                  <div><strong>{partner}</strong><span>{percent}%</span></div>
                  <div className="ads-progress"><i style={{ width: `${percent}%` }} /></div>
                  <small>{currency(amount)}</small>
                </div>
              );
            })}
          </Card>
        </Col>
      </Row>

      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
        <Form onSubmit={saveCampaign}>
          <Modal.Header closeButton><Modal.Title>{editing ? 'Edit Campaign' : 'Add Ads Campaign'}</Modal.Title></Modal.Header>
          <Modal.Body>
            <Row className="g-3">
              <Col md={6}>
                <Form.Label>Partner</Form.Label>
                <Form.Select value={form.partner} onChange={(e) => setForm({ ...form, partner: e.target.value })}>
                  {partners.map((partner) => <option key={partner} value={partner}>{partner}</option>)}
                </Form.Select>
              </Col>
              <Col md={6}>
                <Form.Label>Campaign Name</Form.Label>
                <Form.Control value={form.campaign} onChange={(e) => setForm({ ...form, campaign: e.target.value })} required />
              </Col>
              <Col md={4}>
                <Form.Label>Leads / Clicks</Form.Label>
                <Form.Control type="number" min="0" value={form.leadsClicks} onChange={(e) => setForm({ ...form, leadsClicks: e.target.value })} />
              </Col>
              <Col md={4}>
                <Form.Label>Rate Per Lead</Form.Label>
                <Form.Control type="number" min="0" value={form.perLeadRate} onChange={(e) => setForm({ ...form, perLeadRate: e.target.value })} />
              </Col>
              <Col md={4}>
                <Form.Label>Total Earned</Form.Label>
                <Form.Control value={currency(calculatedTotal)} disabled />
              </Col>
              <Col md={4}>
                <Form.Label>Status</Form.Label>
                <Form.Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </Form.Select>
              </Col>
              <Col md={4}>
                <Form.Label>Start Date</Form.Label>
                <Form.Control type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              </Col>
              <Col md={4}>
                <Form.Label>End Date</Form.Label>
                <Form.Control type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
              </Col>
              <Col md={12}>
                <Form.Label>Notes</Form.Label>
                <Form.Control as="textarea" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Campaign'}</Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <style>{`
        .ads-page { padding: 8px 0 24px; }
        .ads-head { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; margin-bottom:18px; }
        .ads-head p { margin:0 0 4px; color:#0f766e; font-size:12px; font-weight:900; text-transform:uppercase; }
        .ads-head h2 { display:flex; align-items:center; gap:10px; margin:0; font-weight:850; color:#111827; }
        .ads-head span { color:#64748b; }
        .ads-actions, .ads-row-actions { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
        .ads-actions .btn, .ads-row-actions .btn { display:inline-flex; align-items:center; gap:6px; }
        .ads-row-actions .form-select { width:120px; }
        .ads-stat, .ads-panel, .ads-table-card { border:1px solid #e5e7eb; border-radius:8px; box-shadow:0 10px 26px rgba(15,23,42,.06); }
        .ads-stat { padding:16px; }
        .ads-stat span, .ads-stat small { color:#64748b; font-weight:800; }
        .ads-stat strong { display:block; font-size:24px; margin:4px 0; color:#111827; }
        .ads-panel { padding:16px; }
        .ads-table-card { overflow:hidden; }
        .ads-table-card thead th { background:#f8fafc; color:#475569; font-size:12px; text-transform:uppercase; }
        .ads-table-card td small { display:block; color:#64748b; }
        .ads-partner { padding:12px 0; border-bottom:1px solid #eef2f7; }
        .ads-partner div:first-child { display:flex; justify-content:space-between; color:#111827; }
        .ads-progress { height:8px; background:#eef2f7; border-radius:99px; overflow:hidden; margin:8px 0; }
        .ads-progress i { display:block; height:100%; background:linear-gradient(90deg,#0f766e,#2563eb); }
        @media(max-width:768px){ .ads-head{flex-direction:column;} .ads-actions .btn{flex:1; justify-content:center;} }
      `}</style>
    </div>
  );
};

export default AdsEarnings;
