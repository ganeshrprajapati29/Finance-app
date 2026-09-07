import { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, InputGroup, Row, Spinner } from 'react-bootstrap';
import { Bell, CheckCircle, RefreshCw, Search, Send, Users } from 'lucide-react';
import api from '../api/axios';

const unwrap = (res) => res?.data?.data || res?.data || {};

const defaultForm = {
  audience: 'all',
  userId: '',
  title: '',
  body: '',
  type: 'general',
  priority: 'MEDIUM',
  screen: 'home'
};

const Push = () => {
  const [form, setForm] = useState(defaultForm);
  const [users, setUsers] = useState([]);
  const [history, setHistory] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      const [usersRes, historyRes] = await Promise.all([
        api.get('/admin/users?status=active'),
        api.get('/admin/notification-history?page=1&limit=5')
      ]);
      const usersData = unwrap(usersRes);
      const historyData = unwrap(historyRes);
      setUsers(Array.isArray(usersData) ? usersData : []);
      setHistory(Array.isArray(historyData.history) ? historyData.history : []);
    } catch (err) {
      setUsers([]);
      setHistory([]);
      setError(err.response?.data?.message || err.message || 'Push notification data load nahi ho paya');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    const activeUsers = users.filter((user) => user.status === 'active');
    if (!q) return activeUsers.slice(0, 80);
    return activeUsers.filter((user) =>
      user.name?.toLowerCase().includes(q) ||
      user.email?.toLowerCase().includes(q) ||
      user.mobile?.includes(q)
    ).slice(0, 80);
  }, [users, userSearch]);

  const selectedUser = useMemo(
    () => users.find((user) => user._id === form.userId),
    [users, form.userId]
  );

  const stats = useMemo(() => ({
    activeUsers: users.filter((user) => user.status === 'active').length,
    withFcm: users.filter((user) => Array.isArray(user.fcmTokens) && user.fcmTokens.length > 0).length,
    recentRecipients: history.reduce((sum, item) => sum + Number(item.totalRecipients || 0), 0),
    recentSent: history.length
  }), [users, history]);

  const updateForm = (key, value) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
      ...(key === 'audience' && value === 'all' ? { userId: '' } : {})
    }));
  };

  const useTemplate = (template) => {
    const templates = {
      payment: {
        title: 'Payment Reminder',
        body: 'Your Khatu Pay payment is pending. Please clear it before the due date to avoid charges.',
        type: 'payment',
        priority: 'HIGH',
        screen: 'payments'
      },
      loan: {
        title: 'Loan Update',
        body: 'Your Khatu Pay loan account has a new update. Open the app to view details.',
        type: 'loan',
        priority: 'MEDIUM',
        screen: 'loans'
      },
      offer: {
        title: 'Khatu Pay Offer',
        body: 'A new Khatu Pay offer is available for you. Check the app for details.',
        type: 'general',
        priority: 'LOW',
        screen: 'home'
      }
    };
    setForm((prev) => ({ ...prev, ...templates[template] }));
  };

  const sendPush = async (event) => {
    event.preventDefault();
    if (!form.title.trim() || !form.body.trim()) {
      setError('Title aur message required hai');
      return;
    }
    if (form.audience === 'user' && !form.userId) {
      setError('Specific user select karo');
      return;
    }

    try {
      setSending(true);
      setError('');
      setSuccess('');
      const response = await api.post('/admin/push', {
        title: form.title.trim(),
        body: form.body.trim(),
        userId: form.audience === 'user' ? form.userId : null,
        type: form.type,
        priority: form.priority,
        data: { screen: form.screen }
      });
      const result = unwrap(response);
      setSuccess(`Notification sent: ${result.sent || 0} users, FCM success ${result.fcmSent || 0}, failed ${result.fcmFailed || 0}`);
      setForm(defaultForm);
      setUserSearch('');
      await load();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Notification send nahi ho paya');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="push-page">
      <div className="push-head">
        <div>
          <p>Communication</p>
          <h2><Send size={28} /> Push Notifications</h2>
          <span>Send targeted app notifications to all active users or a selected customer.</span>
        </div>
        <Button variant="outline-secondary" onClick={load}><RefreshCw size={16} /> Refresh</Button>
      </div>

      {error && <Alert variant="warning" dismissible onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert variant="success" dismissible onClose={() => setSuccess('')}>{success}</Alert>}

      <Row className="g-3 mb-3">
        <Col md={3}><Card className="push-stat"><Users /><span>Active Users</span><strong>{stats.activeUsers}</strong><small>Eligible recipients</small></Card></Col>
        <Col md={3}><Card className="push-stat"><Bell /><span>FCM Ready</span><strong>{stats.withFcm}</strong><small>Users with device tokens</small></Card></Col>
        <Col md={3}><Card className="push-stat success"><CheckCircle /><span>Recent Sends</span><strong>{stats.recentSent}</strong><small>Latest campaigns</small></Card></Col>
        <Col md={3}><Card className="push-stat"><Users /><span>Recent Reach</span><strong>{stats.recentRecipients}</strong><small>Last 5 campaigns</small></Card></Col>
      </Row>

      <Row className="g-3">
        <Col xl={8}>
          <Card className="push-panel">
            <div className="push-panel-head">
              <h5>Create Notification</h5>
              <div className="push-templates">
                <Button size="sm" variant="outline-secondary" onClick={() => useTemplate('payment')}>Payment</Button>
                <Button size="sm" variant="outline-secondary" onClick={() => useTemplate('loan')}>Loan</Button>
                <Button size="sm" variant="outline-secondary" onClick={() => useTemplate('offer')}>Offer</Button>
              </div>
            </div>

            <Form onSubmit={sendPush}>
              <Row className="g-3">
                <Col md={6}>
                  <Form.Label>Audience</Form.Label>
                  <div className="push-segment">
                    <Button type="button" variant={form.audience === 'all' ? 'dark' : 'outline-dark'} onClick={() => updateForm('audience', 'all')}>All Users</Button>
                    <Button type="button" variant={form.audience === 'user' ? 'dark' : 'outline-dark'} onClick={() => updateForm('audience', 'user')}>Specific User</Button>
                  </div>
                </Col>
                <Col md={3}>
                  <Form.Label>Type</Form.Label>
                  <Form.Select value={form.type} onChange={(e) => updateForm('type', e.target.value)}>
                    <option value="general">General</option>
                    <option value="loan">Loan</option>
                    <option value="payment">Payment</option>
                    <option value="kyc">KYC</option>
                    <option value="support">Support</option>
                  </Form.Select>
                </Col>
                <Col md={3}>
                  <Form.Label>Priority</Form.Label>
                  <Form.Select value={form.priority} onChange={(e) => updateForm('priority', e.target.value)}>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </Form.Select>
                </Col>

                {form.audience === 'user' && (
                  <Col md={12}>
                    <Form.Label>Select User</Form.Label>
                    <InputGroup className="mb-2">
                      <InputGroup.Text><Search size={16} /></InputGroup.Text>
                      <Form.Control placeholder="Search name, mobile, email..." value={userSearch} onChange={(e) => setUserSearch(e.target.value)} />
                    </InputGroup>
                    <Form.Select value={form.userId} onChange={(e) => updateForm('userId', e.target.value)}>
                      <option value="">Choose user</option>
                      {filteredUsers.map((user) => (
                        <option key={user._id} value={user._id}>{user.name || 'N/A'} - {user.mobile || user.email}</option>
                      ))}
                    </Form.Select>
                    {selectedUser && <div className="push-user-strip"><strong>{selectedUser.name}</strong><span>{selectedUser.mobile || selectedUser.email}</span><Badge bg={selectedUser.fcmTokens?.length ? 'success' : 'secondary'}>{selectedUser.fcmTokens?.length ? 'FCM Ready' : 'In-app only'}</Badge></div>}
                  </Col>
                )}

                <Col md={8}>
                  <Form.Label>Title</Form.Label>
                  <Form.Control value={form.title} onChange={(e) => updateForm('title', e.target.value)} placeholder="Notification title" maxLength={120} />
                </Col>
                <Col md={4}>
                  <Form.Label>Open Screen</Form.Label>
                  <Form.Select value={form.screen} onChange={(e) => updateForm('screen', e.target.value)}>
                    <option value="home">Home</option>
                    <option value="loans">Loans</option>
                    <option value="payments">Payments</option>
                    <option value="wallet">Wallet</option>
                    <option value="support">Support</option>
                  </Form.Select>
                </Col>
                <Col md={12}>
                  <Form.Label>Message</Form.Label>
                  <Form.Control as="textarea" rows={5} value={form.body} onChange={(e) => updateForm('body', e.target.value)} placeholder="Write push message..." maxLength={1000} />
                  <small className="text-muted">{form.body.length}/1000 characters</small>
                </Col>
                <Col md={12} className="text-end">
                  <Button type="submit" disabled={sending || loading}>{sending ? <><Spinner size="sm" /> Sending...</> : <><Send size={16} /> Send Notification</>}</Button>
                </Col>
              </Row>
            </Form>
          </Card>
        </Col>

        <Col xl={4}>
          <Card className="push-panel h-100">
            <div className="push-panel-head"><h5>Recent Notifications</h5></div>
            {loading ? (
              <div className="push-empty">Loading...</div>
            ) : history.length === 0 ? (
              <div className="push-empty">No recent notification history.</div>
            ) : history.map((item) => (
              <div className="push-history" key={item._id}>
                <strong>{item.title}</strong>
                <p>{item.message}</p>
                <div><Badge bg={item.sentTo === 'all' ? 'primary' : 'info'}>{item.sentTo === 'all' ? 'All Users' : 'Specific User'}</Badge><span>{item.totalRecipients || 0} recipients</span></div>
              </div>
            ))}
          </Card>
        </Col>
      </Row>

      <style>{`
        .push-page{padding:8px 0 24px;color:#111827}.push-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:18px}.push-head p{margin:0 0 4px;color:#0f766e;font-size:12px;font-weight:900;text-transform:uppercase}.push-head h2{display:flex;align-items:center;gap:10px;margin:0;font-weight:850}.push-head span{color:#64748b}.push-head .btn,.push-panel .btn{display:inline-flex;align-items:center;gap:6px}
        .push-stat,.push-panel{border:1px solid #e5e7eb;border-radius:8px;box-shadow:0 10px 26px rgba(15,23,42,.06)}.push-stat{padding:16px;min-height:150px}.push-stat svg{color:#0f766e}.push-stat span,.push-stat small{display:block;color:#64748b;font-weight:800}.push-stat strong{display:block;font-size:26px;margin:4px 0}.push-stat.success strong{color:#047857}.push-panel{padding:18px}.push-panel-head{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:16px}.push-panel-head h5{margin:0;font-weight:850}.push-templates,.push-segment{display:flex;gap:8px;flex-wrap:wrap}.push-user-strip{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:10px;border:1px solid #dbeafe;background:#eff6ff;border-radius:8px;margin-top:10px}.push-user-strip span{color:#64748b}.push-history{padding:12px 0;border-bottom:1px solid #eef2f7}.push-history strong{display:block}.push-history p{margin:4px 0;color:#64748b}.push-history div{display:flex;justify-content:space-between;gap:8px;align-items:center}.push-empty{text-align:center;color:#64748b;padding:48px 0;font-weight:700}
        @media(max-width:768px){.push-head{flex-direction:column}.push-head .btn,.push-segment .btn{width:100%;justify-content:center}.push-panel-head{align-items:flex-start;flex-direction:column}}
      `}</style>
    </div>
  );
};

export default Push;
