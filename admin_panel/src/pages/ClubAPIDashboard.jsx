import { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, Col, ProgressBar, Row, Spinner, Table } from 'react-bootstrap';
import { Activity, ArrowRight, CreditCard, RefreshCw, ShieldCheck, Wallet, Wifi } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

const unwrap = (res) => res?.data?.data || res?.data || {};
const currency = (value) => `Rs. ${Number(value || 0).toLocaleString('en-IN')}`;
const dateTime = (value) => (value ? new Date(value).toLocaleString('en-IN') : 'N/A');

const ClubAPIDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ overview: {}, byType: [], successRate: 0 });
  const [balance, setBalance] = useState(null);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError('');
      const [statsResponse, recentResponse, balanceResponse] = await Promise.all([
        api.get('/admin/clubapi/stats'),
        api.get('/admin/clubapi/recent'),
        api.get('/admin/clubapi/balance')
      ]);
      setStats(unwrap(statsResponse));
      setBalance(unwrap(balanceResponse));
      const recentData = unwrap(recentResponse);
      setRecent(Array.isArray(recentData) ? recentData : []);
    } catch (err) {
      setStats({ overview: {}, byType: [], successRate: 0 });
      setBalance(null);
      setRecent([]);
      setError(err.response?.data?.message || err.message || 'Club API dashboard load nahi ho paya');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const overview = stats.overview || {};
  const settings = balance?.settings || {};
  const pendingCount = overview.pendingTransactions || 0;
  const processingCount = useMemo(
    () => recent.filter((item) => item.status === 'processing').length,
    [recent]
  );

  const statusBadge = (status) => {
    const variants = { completed: 'success', failed: 'danger', pending: 'warning', processing: 'info', cancelled: 'secondary' };
    return <Badge bg={variants[status] || 'secondary'}>{status || 'unknown'}</Badge>;
  };

  if (loading) {
    return <div className="club-loading"><Spinner animation="border" variant="success" /></div>;
  }

  return (
    <div className="club-page">
      <div className="club-head">
        <div>
          <p>Club API Operations</p>
          <h2><Wifi size={28} /> Club API Dashboard</h2>
          <span>Monitor bill payment and recharge transaction health.</span>
        </div>
        <div className="club-actions">
          <Button variant="outline-secondary" onClick={fetchDashboardData}><RefreshCw size={16} /> Refresh</Button>
          <Button variant="outline-primary" onClick={() => navigate('/clubapi/fund-requests')}>Fund Requests <ArrowRight size={16} /></Button>
          <Button variant="outline-success" onClick={() => navigate('/clubapi/tools')}>Service Tools <ArrowRight size={16} /></Button>
          <Button onClick={() => navigate('/clubapi/transactions')}>View Transactions <ArrowRight size={16} /></Button>
        </div>
      </div>

      {error && <Alert variant="warning" dismissible onClose={() => setError('')}>{error}</Alert>}

      <Row className="g-3 mb-3">
        <Col lg={3} md={6}><Card className="club-stat balance"><Wallet /><span>Live ClubAPI Balance</span><strong>{balance?.balanceText || currency(balance?.balance)}</strong><small>{balance?.status || 'Not checked'}</small></Card></Col>
        <Col lg={3} md={6}><Card className="club-stat"><ShieldCheck /><span>Token Status</span><strong>{balance?.tokenConfigured ? 'Active' : 'Missing'}</strong><small>{settings.baseUrl || 'ClubAPI base URL'}</small></Card></Col>
        <Col lg={3} md={6}><Card className="club-stat"><Activity /><span>Callback</span><strong>{settings.callbackId || 'Not saved'}</strong><small>{settings.callbackUrl || 'Callback URL'}</small></Card></Col>
        <Col lg={3} md={6}><Card className="club-stat success"><RefreshCw /><span>Last Checked</span><strong>{dateTime(balance?.checkedAt)}</strong><small>Refresh to update balance</small></Card></Col>
      </Row>

      <Row className="g-3 mb-3">
        <Col lg={3} md={6}><Card className="club-stat"><Activity /><span>Total Transactions</span><strong>{overview.totalTransactions || 0}</strong><small>{stats.successRate || 0}% success rate</small></Card></Col>
        <Col lg={3} md={6}><Card className="club-stat"><CreditCard /><span>Total Amount</span><strong>{currency(overview.totalAmount)}</strong><small>All Club API volume</small></Card></Col>
        <Col lg={3} md={6}><Card className="club-stat success"><Activity /><span>Completed</span><strong>{overview.completedTransactions || 0}</strong><small>Successful transactions</small></Card></Col>
        <Col lg={3} md={6}><Card className="club-stat danger"><Activity /><span>Failed / Pending</span><strong>{(overview.failedTransactions || 0) + pendingCount}</strong><small>{processingCount} processing recently</small></Card></Col>
      </Row>

      <Row className="g-3">
        <Col xl={12}>
          <Card className="club-panel balance-panel">
            <div className="club-panel-head">
              <div><h5>ClubAPI Account Details</h5><p>Live balance, enabled services and provider response snapshot</p></div>
              <Button size="sm" variant="outline-success" onClick={fetchDashboardData}><RefreshCw size={15} /> Refresh Balance</Button>
            </div>
            <div className="club-detail-grid">
              <div><span>Available Balance</span><strong>{balance?.balanceText || currency(balance?.balance)}</strong></div>
              <div><span>Buyer Total</span><strong>{currency(balance?.buyer?.total)}</strong></div>
              <div><span>Buyer P2P</span><strong>{currency(balance?.buyer?.p2p)}</strong></div>
              <div><span>Buyer P2A</span><strong>{currency(balance?.buyer?.p2a)}</strong></div>
              <div><span>Points</span><strong>{currency(balance?.points)}</strong></div>
              <div><span>Balance Status</span><strong>{balance?.status || 'N/A'}</strong></div>
              <div><span>Token</span><strong>{balance?.tokenConfigured ? 'Configured' : 'Missing'}</strong></div>
              <div><span>Callback ID</span><strong>{settings.callbackId || 'Not saved'}</strong></div>
              <div><span>Mobile Recharge</span><strong>{settings.mobileRechargeEnabled !== false ? 'Enabled' : 'Disabled'}</strong></div>
              <div><span>DTH Recharge</span><strong>{settings.dthRechargeEnabled !== false ? 'Enabled' : 'Disabled'}</strong></div>
              <div><span>Bill Fetch</span><strong>{settings.billFetchEnabled !== false ? 'Enabled' : 'Disabled'}</strong></div>
              <div><span>Bill Payment</span><strong>{settings.billPaymentEnabled !== false ? 'Enabled' : 'Disabled'}</strong></div>
            </div>
            {balance?.message && <Alert variant="info" className="mt-3 mb-0">{balance.message}</Alert>}
            {balance?.raw && (
              <details className="club-raw">
                <summary>Provider raw response</summary>
                <pre>{JSON.stringify(balance.raw, null, 2)}</pre>
              </details>
            )}
          </Card>
        </Col>

        <Col xl={5}>
          <Card className="club-panel h-100">
            <div className="club-panel-head">
              <div><h5>Transaction Mix</h5><p>Volume by transaction type</p></div>
            </div>
            {(stats.byType || []).length === 0 ? (
              <div className="club-empty">No type stats available.</div>
            ) : stats.byType.map((type) => {
              const percent = overview.totalTransactions ? Math.round((type.count / overview.totalTransactions) * 100) : 0;
              return (
                <div className="club-type-row" key={type._id || 'unknown'}>
                  <div><strong>{String(type._id || 'other').replace(/_/g, ' ').toUpperCase()}</strong><span>{currency(type.totalAmount)}</span></div>
                  <ProgressBar now={percent} label={`${percent}%`} />
                  <small>{type.count} transactions</small>
                </div>
              );
            })}
          </Card>
        </Col>

        <Col xl={7}>
          <Card className="club-table-card">
            <div className="club-panel-head pad">
              <div><h5>Recent Transactions</h5><p>Latest Club API activity</p></div>
              <Button size="sm" variant="outline-primary" onClick={() => navigate('/clubapi/transactions')}>Open All</Button>
            </div>
            <Table responsive hover className="align-middle mb-0">
              <thead>
                <tr><th>URID</th><th>User</th><th>Type</th><th>Amount</th><th>Status</th><th>Date</th></tr>
              </thead>
              <tbody>
                {recent.length === 0 ? (
                  <tr><td colSpan="6" className="text-center py-5">No recent transactions.</td></tr>
                ) : recent.map((item) => (
                  <tr key={item._id}>
                    <td><code>{item.urid}</code><small>{item.accountRef}</small></td>
                    <td>{item.userId?.name || 'N/A'}<small>{item.userId?.mobile || item.customerMobile || item.userId?.email}</small></td>
                    <td>{String(item.type || 'other').replace(/_/g, ' ').toUpperCase()}</td>
                    <td className="fw-bold">{currency(item.amount)}</td>
                    <td>{statusBadge(item.status)}</td>
                    <td>{dateTime(item.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </Col>
      </Row>

      <style>{`
        .club-loading{min-height:420px;display:grid;place-items:center}.club-page{padding:8px 0 24px;color:#111827}
        .club-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:18px}.club-head p{margin:0 0 4px;color:#0f766e;font-weight:900;text-transform:uppercase;font-size:12px}.club-head h2{display:flex;align-items:center;gap:10px;margin:0;font-weight:850}.club-head span,.club-panel-head p,.club-table-card small,.club-type-row small{color:#64748b}.club-actions{display:flex;gap:8px;flex-wrap:wrap}.club-actions .btn{display:inline-flex;align-items:center;gap:6px}
        .club-stat,.club-panel,.club-table-card{border:1px solid #e5e7eb;border-radius:8px;box-shadow:0 10px 26px rgba(15,23,42,.06)}.club-stat{padding:16px;min-height:150px;overflow:hidden}.club-stat svg{color:#0f766e}.club-stat span{display:block;color:#64748b;font-weight:800;margin-top:8px}.club-stat strong{display:block;font-size:26px;margin:4px 0;word-break:break-word}.club-stat small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.club-stat.success strong{color:#047857}.club-stat.danger strong{color:#b91c1c}.club-stat.balance{background:linear-gradient(135deg,#0f766e,#0ea5e9);color:white}.club-stat.balance svg,.club-stat.balance span,.club-stat.balance small{color:white}.club-stat.balance strong{font-size:28px}
        .club-panel{padding:18px}.club-panel-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:14px}.club-panel-head.pad{padding:16px 16px 0}.club-panel-head h5{margin:0;font-weight:850}.club-panel-head p{margin:2px 0 0}.club-type-row{padding:13px 0;border-bottom:1px solid #eef2f7}.club-type-row>div{display:flex;justify-content:space-between;margin-bottom:8px}.club-type-row span{font-weight:800;color:#0f766e}.club-empty{text-align:center;color:#64748b;padding:45px 0;font-weight:700}
        .balance-panel{border-color:#bfe7df}.club-detail-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px}.club-detail-grid>div{background:#f8fafc;border:1px solid #edf2f7;border-radius:8px;padding:12px}.club-detail-grid span{display:block;color:#64748b;font-size:12px;font-weight:800;text-transform:uppercase}.club-detail-grid strong{display:block;margin-top:4px;color:#0f172a;word-break:break-word}.club-raw{margin-top:14px}.club-raw summary{cursor:pointer;color:#0f766e;font-weight:900}.club-raw pre{margin-top:10px;background:#0f172a;color:#e2e8f0;border-radius:8px;padding:14px;max-height:260px;overflow:auto}
        .club-table-card{overflow:hidden}.club-table-card thead th{background:#f8fafc;color:#475569;font-size:12px;text-transform:uppercase}.club-table-card td small{display:block}.club-table-card code{font-weight:800;color:#0f766e}
        @media(max-width:768px){.club-head{flex-direction:column}.club-actions .btn{flex:1;justify-content:center}}
      `}</style>
    </div>
  );
};

export default ClubAPIDashboard;
