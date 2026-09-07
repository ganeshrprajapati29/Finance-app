import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, InputGroup, Pagination, Row, Table } from 'react-bootstrap';
import { Download, Eye, QrCode, RefreshCw, Search } from 'lucide-react';
import api from '../api/axios';

const currency = (value) => `Rs. ${Number(value || 0).toLocaleString('en-IN')}`;
const unwrap = (res) => res?.data?.data || res?.data || {};

const QREarnings = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ search: '', dateFrom: '', dateTo: '' });
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState(null);
  const limit = 20;

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (filters.search.trim()) params.set('merchant', filters.search.trim());
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.set('dateTo', filters.dateTo);
      const res = await api.get(`/admin/earnings/qr?${params.toString()}`);
      const data = unwrap(res);
      setItems(Array.isArray(data.items) ? data.items : []);
      setTotal(Number(data.total || 0));
    } catch (err) {
      setItems([]);
      setTotal(0);
      setError(err.response?.data?.message || err.message || 'QR earnings load nahi ho paya');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [page]);

  const stats = useMemo(() => ({
    merchants: items.length,
    volume: items.reduce((sum, item) => sum + Number(item.totalVolume || 0), 0),
    fees: items.reduce((sum, item) => sum + Number(item.razorpayFee || 0), 0),
    profit: items.reduce((sum, item) => sum + Number(item.netProfit || 0), 0)
  }), [items]);

  const exportCsv = () => {
    const rows = [
      ['Merchant', 'Volume', 'Commission %', 'Razorpay Fee', 'Subscription', 'Net Profit'],
      ...items.map((item) => [
        item.merchantName || 'Unknown',
        item.totalVolume || 0,
        item.commissionPercent || 0,
        item.razorpayFee || 0,
        item.subscriptionFee || 0,
        item.netProfit || 0
      ])
    ];
    const blob = new Blob([rows.map((row) => row.join(',')).join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'qr-earnings.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="container-fluid p-4">
      <div className="d-flex justify-content-between align-items-start mb-4 gap-3">
        <div>
          <p className="text-uppercase text-success fw-bold mb-1 small">Payments Revenue</p>
          <h2 className="d-flex align-items-center gap-2 mb-1"><QrCode size={28} /> QR Earnings</h2>
          <p className="text-muted mb-0">Merchant QR volume, platform fee and net profit tracking.</p>
        </div>
        <div className="d-flex gap-2">
          <Button variant="outline-secondary" onClick={load}><RefreshCw size={16} /> Refresh</Button>
          <Button variant="outline-success" onClick={exportCsv}><Download size={16} /> Export</Button>
        </div>
      </div>

      {error && <Alert variant="warning" dismissible onClose={() => setError('')}>{error}</Alert>}

      <Row className="g-3 mb-3">
        <Col md={3}><Card className="p-3 shadow-sm border-0"><small className="text-muted fw-bold">Merchants</small><h3>{stats.merchants}</h3></Card></Col>
        <Col md={3}><Card className="p-3 shadow-sm border-0"><small className="text-muted fw-bold">QR Volume</small><h3>{currency(stats.volume)}</h3></Card></Col>
        <Col md={3}><Card className="p-3 shadow-sm border-0"><small className="text-muted fw-bold">Gateway Fees</small><h3>{currency(stats.fees)}</h3></Card></Col>
        <Col md={3}><Card className="p-3 shadow-sm border-0"><small className="text-muted fw-bold">Net Profit</small><h3 className="text-success">{currency(stats.profit)}</h3></Card></Col>
      </Row>

      <Card className="mb-3 shadow-sm border-0">
        <Card.Body>
          <Row className="g-2">
            <Col lg={5}>
              <InputGroup>
                <InputGroup.Text><Search size={16} /></InputGroup.Text>
                <Form.Control placeholder="Search merchant id/name" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
              </InputGroup>
            </Col>
            <Col lg={2}><Form.Control type="date" value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} /></Col>
            <Col lg={2}><Form.Control type="date" value={filters.dateTo} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} /></Col>
            <Col lg={3}><Button className="w-100" variant="dark" onClick={() => { setPage(1); load(); }}>Apply Filters</Button></Col>
          </Row>
        </Card.Body>
      </Card>

      <Card className="shadow-sm border-0">
        <Table responsive hover className="align-middle mb-0">
          <thead className="table-light">
            <tr>
              <th>Merchant</th>
              <th>Total Volume</th>
              <th>Commission</th>
              <th>Gateway Fee</th>
              <th>Subscription</th>
              <th>Net Profit</th>
              <th className="text-end">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="7" className="text-center py-5">Loading...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan="7" className="text-center py-5">No QR earnings found.</td></tr>
            ) : items.map((item) => (
              <tr key={item.merchantId}>
                <td><strong>{item.merchantName}</strong><small className="d-block text-muted">{item.merchantId}</small></td>
                <td>{currency(item.totalVolume)}</td>
                <td><Badge bg="info">{item.commissionPercent || 0}%</Badge></td>
                <td>{currency(item.razorpayFee)}</td>
                <td>{currency(item.subscriptionFee)}</td>
                <td className="fw-bold text-success">{currency(item.netProfit)}</td>
                <td className="text-end"><Button size="sm" variant="outline-primary" onClick={() => setSelected(item)}><Eye size={14} /></Button></td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      {totalPages > 1 && (
        <Pagination className="justify-content-center mt-3">
          <Pagination.Prev disabled={page === 1} onClick={() => setPage(page - 1)} />
          <Pagination.Item active>{page}</Pagination.Item>
          <Pagination.Next disabled={page === totalPages} onClick={() => setPage(page + 1)} />
        </Pagination>
      )}

      {selected && (
        <Card className="mt-3 border-0 shadow-sm">
          <Card.Body>
            <div className="d-flex justify-content-between">
              <div><h5>{selected.merchantName}</h5><p className="text-muted mb-0">{selected.merchantId}</p></div>
              <Button variant="outline-secondary" size="sm" onClick={() => setSelected(null)}>Close</Button>
            </div>
            <Row className="g-3 mt-2">
              <Col md={3}><strong>{currency(selected.totalVolume)}</strong><small className="d-block text-muted">Volume</small></Col>
              <Col md={3}><strong>{currency(selected.razorpayFee)}</strong><small className="d-block text-muted">Gateway Fee</small></Col>
              <Col md={3}><strong>{currency(selected.subscriptionFee)}</strong><small className="d-block text-muted">Subscription</small></Col>
              <Col md={3}><strong className="text-success">{currency(selected.netProfit)}</strong><small className="d-block text-muted">Profit</small></Col>
            </Row>
          </Card.Body>
        </Card>
      )}
    </div>
  );
};

export default QREarnings;
