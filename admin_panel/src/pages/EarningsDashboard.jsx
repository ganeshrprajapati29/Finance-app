import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, Col, ProgressBar, Row, Table } from 'react-bootstrap';
import { BarChart3, CreditCard, IndianRupee, QrCode, RefreshCw, TrendingUp, Wallet } from 'lucide-react';
import api from '../api/axios';

const currency = (value) => `Rs. ${Number(value || 0).toLocaleString('en-IN')}`;
const unwrap = (res) => res?.data?.data || res?.data || {};

const EarningsDashboard = () => {
  const [data, setData] = useState({
    totalEarnings: 0,
    todayEarnings: 0,
    monthEarnings: 0,
    categoryEarnings: {},
    trendData: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/admin/earnings/dashboard');
      setData({ ...data, ...unwrap(res) });
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Unable to load earnings dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const categories = useMemo(() => {
    const earnings = data.categoryEarnings || {};
    const items = [
      { key: 'bills', label: 'Bill Payments', value: earnings.bills || 0, icon: CreditCard, color: '#2563eb' },
      { key: 'loans', label: 'Loan Earnings', value: earnings.loans || 0, icon: IndianRupee, color: '#047857' },
      { key: 'qr', label: 'QR Earnings', value: earnings.qr || 0, icon: QrCode, color: '#7c3aed' },
      { key: 'wallet', label: 'Wallet Fees', value: earnings.wallet || 0, icon: Wallet, color: '#b45309' },
      { key: 'ads', label: 'Ads / Referral', value: earnings.ads || 0, icon: TrendingUp, color: '#be123c' }
    ];
    const total = items.reduce((sum, item) => sum + Number(item.value || 0), 0);
    return items.map((item) => ({ ...item, percent: total ? Math.round((item.value / total) * 100) : 0 }));
  }, [data.categoryEarnings]);

  const trend = useMemo(() => {
    const items = Array.isArray(data.trendData) ? data.trendData.slice(-14) : [];
    const max = Math.max(...items.map((item) => Number(item.earnings || 0)), 1);
    return items.map((item) => ({ ...item, height: Math.max(6, Math.round((Number(item.earnings || 0) / max) * 100)) }));
  }, [data.trendData]);

  const topCategory = categories.reduce((best, item) => (item.value > best.value ? item : best), categories[0] || {});

  return (
    <div className="kp-admin-page">
      <div className="kp-page-head">
        <div>
          <p className="kp-eyebrow">Finance Overview</p>
          <h2><BarChart3 size={28} /> Earnings Dashboard</h2>
          <p>Track KhatuPay earning sources, monthly progress, and recent trend in one clean view.</p>
        </div>
        <Button variant="outline-secondary" onClick={fetchDashboard}><RefreshCw size={16} /> Refresh</Button>
      </div>

      {error && <Alert variant="warning" dismissible onClose={() => setError('')}>{error}</Alert>}

      <Row className="g-3 mb-3">
        <Col lg={3} md={6}><Card className="kp-stat primary"><span>Total Earnings</span><strong>{currency(data.totalEarnings)}</strong><small>All channels combined</small></Card></Col>
        <Col lg={3} md={6}><Card className="kp-stat success"><span>Today</span><strong>{currency(data.todayEarnings)}</strong><small>Since midnight</small></Card></Col>
        <Col lg={3} md={6}><Card className="kp-stat info"><span>This Month</span><strong>{currency(data.monthEarnings)}</strong><small>Current month earnings</small></Card></Col>
        <Col lg={3} md={6}><Card className="kp-stat warning"><span>Top Source</span><strong>{topCategory?.label || 'N/A'}</strong><small>{currency(topCategory?.value || 0)}</small></Card></Col>
      </Row>

      <Row className="g-3">
        <Col xl={7}>
          <Card className="kp-panel h-100">
            <div className="kp-section-head">
              <div>
                <h5>Category Performance</h5>
                <p>Revenue contribution by product area</p>
              </div>
              <Badge bg="dark">{categories.length} streams</Badge>
            </div>
            <div className="kp-category-list">
              {categories.map((item) => {
                const Icon = item.icon;
                return (
                  <div className="kp-category-row" key={item.key}>
                    <div className="kp-category-title">
                      <span style={{ color: item.color }}><Icon size={20} /></span>
                      <div><strong>{item.label}</strong><small>{item.percent}% of total category earning</small></div>
                    </div>
                    <div className="kp-category-value">
                      <strong>{currency(item.value)}</strong>
                      <ProgressBar now={item.percent} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </Col>

        <Col xl={5}>
          <Card className="kp-panel h-100">
            <div className="kp-section-head">
              <div>
                <h5>Last 14 Days</h5>
                <p>Daily earnings trend</p>
              </div>
              {loading && <Badge bg="secondary">Loading</Badge>}
            </div>
            <div className="kp-trend">
              {trend.length === 0 ? (
                <div className="kp-empty">No trend data available.</div>
              ) : trend.map((item) => (
                <div className="kp-bar" key={item.date} title={`${item.date}: ${currency(item.earnings)}`}>
                  <span style={{ height: `${item.height}%` }} />
                  <small>{new Date(item.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</small>
                </div>
              ))}
            </div>
          </Card>
        </Col>

        <Col xl={12}>
          <Card className="kp-table-card">
            <Table responsive hover className="align-middle mb-0">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Earnings</th>
                  <th>Share</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((item) => (
                  <tr key={item.key}>
                    <td><strong>{item.label}</strong><small>{item.key.toUpperCase()}</small></td>
                    <td className="fw-bold">{currency(item.value)}</td>
                    <td style={{ minWidth: 180 }}><ProgressBar now={item.percent} label={`${item.percent}%`} /></td>
                    <td><Badge bg={item.value > 0 ? 'success' : 'secondary'}>{item.value > 0 ? 'ACTIVE' : 'NO DATA'}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </Col>
      </Row>

      <style>{`
        .kp-admin-page { padding: 8px 0 24px; }
        .kp-page-head { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; margin-bottom: 18px; }
        .kp-page-head h2 { display: flex; align-items: center; gap: 10px; margin: 0; font-weight: 800; color: #111827; }
        .kp-page-head p { margin: 4px 0 0; color: #64748b; }
        .kp-page-head .btn { display: inline-flex; align-items: center; gap: 6px; }
        .kp-eyebrow { margin: 0 0 4px !important; color: #0f766e !important; font-size: 12px; font-weight: 800; text-transform: uppercase; }
        .kp-stat, .kp-panel, .kp-table-card { border: 1px solid #e5e7eb; border-radius: 8px; box-shadow: 0 10px 26px rgba(15, 23, 42, 0.06); }
        .kp-stat { padding: 18px; }
        .kp-stat span, .kp-stat small { color: #64748b; font-weight: 700; }
        .kp-stat strong { display: block; margin: 5px 0; font-size: 24px; color: #111827; }
        .kp-stat.success strong { color: #047857; } .kp-stat.info strong { color: #2563eb; } .kp-stat.warning strong { color: #b45309; }
        .kp-panel { padding: 18px; }
        .kp-section-head { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
        .kp-section-head h5 { margin: 0; font-weight: 800; }
        .kp-section-head p { margin: 2px 0 0; color: #64748b; }
        .kp-category-list { display: grid; gap: 14px; }
        .kp-category-row { display: grid; grid-template-columns: 1fr 220px; gap: 18px; align-items: center; border: 1px solid #eef2f7; border-radius: 8px; padding: 14px; }
        .kp-category-title { display: flex; gap: 12px; align-items: center; }
        .kp-category-title span { width: 42px; height: 42px; border-radius: 8px; background: #f8fafc; display: grid; place-items: center; }
        .kp-category-title small, .kp-table-card small { display: block; color: #64748b; }
        .kp-category-value strong { display: block; margin-bottom: 7px; text-align: right; }
        .kp-trend { height: 320px; display: flex; align-items: end; gap: 8px; border: 1px solid #eef2f7; border-radius: 8px; padding: 18px 12px 36px; position: relative; }
        .kp-bar { flex: 1; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; gap: 8px; }
        .kp-bar span { width: 100%; min-width: 12px; border-radius: 8px 8px 2px 2px; background: linear-gradient(180deg, #0f766e, #2563eb); }
        .kp-bar small { position: absolute; bottom: 10px; transform: rotate(-35deg); transform-origin: top center; color: #64748b; font-size: 10px; }
        .kp-empty { margin: auto; color: #64748b; font-weight: 700; }
        .kp-table-card { overflow: hidden; }
        .kp-table-card thead th { background: #f8fafc; color: #475569; font-size: 12px; text-transform: uppercase; }
        @media (max-width: 768px) { .kp-page-head, .kp-section-head { flex-direction: column; } .kp-category-row { grid-template-columns: 1fr; } .kp-category-value strong { text-align: left; } }
      `}</style>
    </div>
  );
};

export default EarningsDashboard;
