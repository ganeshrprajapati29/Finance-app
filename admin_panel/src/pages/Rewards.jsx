import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, Col, Form, Modal, Row, Table } from 'react-bootstrap';
import { Gift, Plus, RefreshCw, Trash2 } from 'lucide-react';
import api from '../api/axios';

const types = ['OFFER', 'COUPON', 'CASHBACK', 'SCRATCH', 'PUZZLE', 'POINTS'];
const placements = ['ALL', 'HOME', 'REWARDS', 'BILLS', 'RECHARGE', 'PAYMENT'];
const blank = {
  title: '',
  subtitle: '',
  description: '',
  imageUrl: '',
  type: 'CASHBACK',
  placement: 'ALL',
  couponCode: '',
  cashbackAmount: 0,
  minCashback: 0,
  maxCashback: 0,
  points: 0,
  usageLimit: 0,
  perUserLimit: 1,
  priority: 0,
  isActive: true,
  puzzle: { question: '', options: ['', '', '', ''], answerIndex: 0 },
  terms: ''
};

const unwrap = (res) => res?.data?.data || res?.data || {};
const money = (value) => `Rs. ${Number(value || 0).toLocaleString('en-IN')}`;

export default function Rewards() {
  const [items, setItems] = useState([]);
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState(null);
  const [message, setMessage] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [campaignRes, claimRes] = await Promise.all([
        api.get('/admin/rewards?limit=100'),
        api.get('/admin/rewards/claims/list')
      ]);
      setItems(unwrap(campaignRes).items || []);
      setClaims(Array.isArray(unwrap(claimRes)) ? unwrap(claimRes) : []);
    } catch (err) {
      setMessage(err.response?.data?.message || err.message || 'Rewards load nahi hue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const stats = useMemo(() => ({
    active: items.filter((x) => x.isActive).length,
    cashback: claims.reduce((sum, claim) => sum + Number(claim.cashbackAmount || 0), 0),
    claims: claims.length
  }), [items, claims]);

  const open = (item = null) => {
    setEditing(item);
    setForm(item ? {
      ...blank,
      ...item,
      terms: (item.terms || []).join('\n'),
      puzzle: { ...blank.puzzle, ...(item.puzzle || {}) }
    } : blank);
    setShow(true);
  };

  const save = async () => {
    const payload = {
      ...form,
      cashbackAmount: Number(form.cashbackAmount || 0),
      minCashback: Number(form.minCashback || 0),
      maxCashback: Number(form.maxCashback || 0),
      points: Number(form.points || 0),
      usageLimit: Number(form.usageLimit || 0),
      perUserLimit: Number(form.perUserLimit || 1),
      priority: Number(form.priority || 0)
    };
    try {
      if (editing) await api.put(`/admin/rewards/${editing._id}`, payload);
      else await api.post('/admin/rewards', payload);
      setShow(false);
      setMessage('Reward campaign save ho gaya.');
      load();
    } catch (err) {
      setMessage(err.response?.data?.message || err.message || 'Save failed');
    }
  };

  const toggle = async (item) => {
    await api.patch(`/admin/rewards/${item._id}/status`, { isActive: !item.isActive });
    load();
  };

  const remove = async (item) => {
    if (!window.confirm('Reward campaign delete karna hai?')) return;
    await api.delete(`/admin/rewards/${item._id}`);
    load();
  };

  return (
    <div className="rw-page">
      <div className="rw-head">
        <div><p>Engagement</p><h2><Gift size={28} /> Rewards, Coupons & Cashback</h2><span>Create dynamic offers, scratch cards, puzzle wins, coupon codes and wallet cashback.</span></div>
        <div className="rw-actions"><Button onClick={() => open()}><Plus size={16} /> Create</Button><Button variant="outline-secondary" onClick={load}><RefreshCw size={16} /> Refresh</Button></div>
      </div>
      {message && <div className="alert alert-info">{message}</div>}
      <Row className="g-3 mb-3">
        <Col md={4}><Card className="rw-stat"><span>Total Campaigns</span><strong>{items.length}</strong></Card></Col>
        <Col md={4}><Card className="rw-stat success"><span>Active</span><strong>{stats.active}</strong></Card></Col>
        <Col md={4}><Card className="rw-stat"><span>Cashback Given</span><strong>{money(stats.cashback)}</strong><small>{stats.claims} claims</small></Card></Col>
      </Row>
      <Card className="rw-table">
        <Table responsive hover className="align-middle mb-0">
          <thead><tr><th>Campaign</th><th>Type</th><th>Reward</th><th>Usage</th><th>Status</th><th className="text-end">Action</th></tr></thead>
          <tbody>{loading ? <tr><td colSpan="6" className="text-center py-5">Loading...</td></tr> : items.map((item) => (
            <tr key={item._id}>
              <td><strong>{item.title}</strong><small>{item.subtitle || item.couponCode || item.placement}</small></td>
              <td><Badge bg="dark">{item.type}</Badge></td>
              <td>{item.type === 'SCRATCH' ? `${money(item.minCashback)} - ${money(item.maxCashback)}` : item.cashbackAmount ? money(item.cashbackAmount) : item.points ? `${item.points} pts` : item.couponCode || '-'}</td>
              <td>{item.usedCount || 0}/{item.usageLimit || 'Unlimited'}</td>
              <td><Badge bg={item.isActive ? 'success' : 'secondary'}>{item.isActive ? 'ACTIVE' : 'INACTIVE'}</Badge></td>
              <td className="text-end"><Button size="sm" variant="outline-primary" onClick={() => open(item)}>Edit</Button>{' '}<Button size="sm" variant="outline-warning" onClick={() => toggle(item)}>{item.isActive ? 'Pause' : 'Live'}</Button>{' '}<Button size="sm" variant="outline-danger" onClick={() => remove(item)}><Trash2 size={14} /></Button></td>
            </tr>
          ))}</tbody>
        </Table>
      </Card>
      <Card className="rw-table mt-3">
        <div className="rw-sub">Recent Claims</div>
        <Table responsive className="mb-0"><thead><tr><th>User</th><th>Campaign</th><th>Cashback</th><th>Coupon</th><th>Date</th></tr></thead><tbody>{claims.slice(0, 20).map((claim) => <tr key={claim._id}><td>{claim.userId?.name || claim.userId?.mobile || 'User'}</td><td>{claim.campaignId?.title || claim.type}</td><td>{money(claim.cashbackAmount)}</td><td>{claim.couponCode || '-'}</td><td>{new Date(claim.createdAt).toLocaleString('en-IN')}</td></tr>)}</tbody></Table>
      </Card>
      <Modal show={show} onHide={() => setShow(false)} size="lg" centered>
        <Modal.Header closeButton><Modal.Title>{editing ? 'Edit' : 'Create'} Reward Campaign</Modal.Title></Modal.Header>
        <Modal.Body>
          <Row className="g-3">
            <Col md={8}><Form.Label>Title</Form.Label><Form.Control value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Col>
            <Col md={4}><Form.Label>Type</Form.Label><Form.Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{types.map((x) => <option key={x}>{x}</option>)}</Form.Select></Col>
            <Col md={6}><Form.Label>Subtitle</Form.Label><Form.Control value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} /></Col>
            <Col md={6}><Form.Label>Image URL</Form.Label><Form.Control value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} /></Col>
            <Col md={4}><Form.Label>Placement</Form.Label><Form.Select value={form.placement} onChange={(e) => setForm({ ...form, placement: e.target.value })}>{placements.map((x) => <option key={x}>{x}</option>)}</Form.Select></Col>
            <Col md={4}><Form.Label>Coupon</Form.Label><Form.Control value={form.couponCode} onChange={(e) => setForm({ ...form, couponCode: e.target.value })} /></Col>
            <Col md={4}><Form.Label>Priority</Form.Label><Form.Control type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} /></Col>
            <Col md={4}><Form.Label>Cashback</Form.Label><Form.Control type="number" value={form.cashbackAmount} onChange={(e) => setForm({ ...form, cashbackAmount: e.target.value })} /></Col>
            <Col md={4}><Form.Label>Scratch Min</Form.Label><Form.Control type="number" value={form.minCashback} onChange={(e) => setForm({ ...form, minCashback: e.target.value })} /></Col>
            <Col md={4}><Form.Label>Scratch Max</Form.Label><Form.Control type="number" value={form.maxCashback} onChange={(e) => setForm({ ...form, maxCashback: e.target.value })} /></Col>
            <Col md={4}><Form.Label>Points</Form.Label><Form.Control type="number" value={form.points} onChange={(e) => setForm({ ...form, points: e.target.value })} /></Col>
            <Col md={4}><Form.Label>Total Limit</Form.Label><Form.Control type="number" value={form.usageLimit} onChange={(e) => setForm({ ...form, usageLimit: e.target.value })} /></Col>
            <Col md={4}><Form.Label>User Limit</Form.Label><Form.Control type="number" value={form.perUserLimit} onChange={(e) => setForm({ ...form, perUserLimit: e.target.value })} /></Col>
            <Col md={12}><Form.Label>Description</Form.Label><Form.Control as="textarea" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Col>
            <Col md={8}><Form.Label>Puzzle Question</Form.Label><Form.Control value={form.puzzle.question} onChange={(e) => setForm({ ...form, puzzle: { ...form.puzzle, question: e.target.value } })} /></Col>
            <Col md={4}><Form.Label>Answer Index</Form.Label><Form.Control type="number" value={form.puzzle.answerIndex ?? 0} onChange={(e) => setForm({ ...form, puzzle: { ...form.puzzle, answerIndex: Number(e.target.value) } })} /></Col>
            <Col md={12}><Form.Label>Puzzle Options (one per line)</Form.Label><Form.Control as="textarea" rows={2} value={(form.puzzle.options || []).join('\n')} onChange={(e) => setForm({ ...form, puzzle: { ...form.puzzle, options: e.target.value.split('\n') } })} /></Col>
            <Col md={12}><Form.Check type="switch" checked={form.isActive} label="Active" onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /></Col>
          </Row>
        </Modal.Body>
        <Modal.Footer><Button variant="secondary" onClick={() => setShow(false)}>Cancel</Button><Button onClick={save}>Save Campaign</Button></Modal.Footer>
      </Modal>
      <style>{`.rw-head{display:flex;justify-content:space-between;gap:16px;margin-bottom:18px}.rw-head p{margin:0;color:#0f766e;font-size:12px;font-weight:900;text-transform:uppercase}.rw-head h2{display:flex;align-items:center;gap:10px;margin:0;font-weight:850}.rw-head span,.rw-table small,.rw-stat span,.rw-stat small{display:block;color:#64748b;font-weight:800}.rw-actions{display:flex;gap:8px}.rw-actions .btn{display:inline-flex;align-items:center;gap:6px}.rw-stat,.rw-table{border:1px solid #e5e7eb;border-radius:8px;box-shadow:0 10px 26px rgba(15,23,42,.06)}.rw-stat{padding:16px}.rw-stat strong{font-size:24px}.rw-stat.success strong{color:#047857}.rw-table{overflow:hidden}.rw-table thead th{background:#f8fafc;color:#475569;font-size:12px;text-transform:uppercase}.rw-sub{padding:14px 16px;font-weight:900;border-bottom:1px solid #e5e7eb}@media(max-width:768px){.rw-head{flex-direction:column}.rw-actions .btn{flex:1}}`}</style>
    </div>
  );
}
