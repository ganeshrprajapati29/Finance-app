import { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, InputGroup, Modal, Pagination, Row, Table } from 'react-bootstrap';
import { Eye, PackageCheck, RefreshCw, Search, StickyNote } from 'lucide-react';
import api from '../api/axios';

const unwrap = (res) => res?.data?.data || res?.data || {};
const money = (value) => `Rs. ${Number(value || 0).toLocaleString('en-IN')}`;
const dateTime = (value) => (value ? new Date(value).toLocaleString('en-IN') : 'N/A');

const orderStatuses = ['PLACED', 'PAYMENT_PENDING', 'CONFIRMED', 'PRINTING', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
const paymentStatuses = ['FREE', 'PENDING', 'PAID', 'FAILED', 'REFUNDED'];

export default function QRStickerOrders() {
  const [orders, setOrders] = useState([]);
  const [summary, setSummary] = useState({});
  const [filters, setFilters] = useState({ search: '', status: 'ALL', paymentStatus: 'ALL' });
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  const limit = 20;

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError('');
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        status: filters.status,
        paymentStatus: filters.paymentStatus
      });
      if (filters.search.trim()) params.set('search', filters.search.trim());
      const res = await api.get(`/admin/qr-sticker-orders?${params.toString()}`);
      const data = unwrap(res);
      setOrders(Array.isArray(data.items) ? data.items : []);
      setSummary(data.summary || {});
      setTotal(Number(data.total || 0));
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Sticker orders load nahi hue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [page, filters.status, filters.paymentStatus]);

  const openDetails = async (order) => {
    try {
      const res = await api.get(`/admin/qr-sticker-orders/${order._id}`);
      setSelected(unwrap(res));
    } catch {
      setSelected(order);
    }
  };

  const updateOrder = async (event) => {
    event.preventDefault();
    try {
      setSaving(true);
      const form = new FormData(event.currentTarget);
      const payload = Object.fromEntries(form.entries());
      const res = await api.put(`/admin/qr-sticker-orders/${selected._id}/status`, payload);
      setSelected(unwrap(res));
      fetchOrders();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Order update nahi hua');
    } finally {
      setSaving(false);
    }
  };

  const badge = (value) => {
    const variant = value === 'PAID' || value === 'DELIVERED' ? 'success' : value === 'CANCELLED' || value === 'FAILED' ? 'danger' : 'warning';
    return <Badge bg={variant}>{value}</Badge>;
  };

  return (
    <div className="kp-admin-page">
      <div className="kp-page-head">
        <div>
          <p className="kp-eyebrow">QR Fulfilment</p>
          <h2><StickyNote size={28} /> QR Sticker Orders</h2>
          <p>Customer sticker requests, payment status, printing queue, shipping and tracking management.</p>
        </div>
        <Button variant="outline-secondary" onClick={fetchOrders}><RefreshCw size={16} /> Refresh</Button>
      </div>

      {error && <Alert variant="warning" onClose={() => setError('')} dismissible>{error}</Alert>}

      <Row className="g-3 mb-3">
        <Col md={3}><Card className="kp-stat"><span>Orders</span><strong>{summary.orders || total}</strong><small>Total requests</small></Card></Col>
        <Col md={3}><Card className="kp-stat success"><span>Stickers</span><strong>{summary.stickers || 0}</strong><small>Print quantity</small></Card></Col>
        <Col md={3}><Card className="kp-stat"><span>Revenue</span><strong>{money(summary.revenue)}</strong><small>Order value</small></Card></Col>
        <Col md={3}><Card className="kp-stat"><span>Paid</span><strong>{money(summary.paid)}</strong><small>Collected amount</small></Card></Col>
      </Row>

      <Card className="kp-panel mb-3">
        <Row className="g-2">
          <Col lg={5}>
            <InputGroup>
              <InputGroup.Text><Search size={16} /></InputGroup.Text>
              <Form.Control
                placeholder="Search order no, customer, mobile, pincode, tracking..."
                value={filters.search}
                onChange={(event) => setFilters({ ...filters, search: event.target.value })}
                onKeyDown={(event) => event.key === 'Enter' && fetchOrders()}
              />
            </InputGroup>
          </Col>
          <Col lg={2}>
            <Form.Select value={filters.status} onChange={(event) => { setPage(1); setFilters({ ...filters, status: event.target.value }); }}>
              <option value="ALL">All Order Status</option>
              {orderStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
            </Form.Select>
          </Col>
          <Col lg={2}>
            <Form.Select value={filters.paymentStatus} onChange={(event) => { setPage(1); setFilters({ ...filters, paymentStatus: event.target.value }); }}>
              <option value="ALL">All Payment</option>
              {paymentStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
            </Form.Select>
          </Col>
          <Col lg={3}><Button className="w-100" variant="dark" onClick={fetchOrders}>Apply Filters</Button></Col>
        </Row>
      </Card>

      <Card className="kp-table-card">
        <Table responsive hover className="align-middle mb-0">
          <thead>
            <tr>
              <th>Order</th>
              <th>Customer</th>
              <th>Sticker</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Tracking</th>
              <th className="text-end">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="7" className="text-center py-5">Loading sticker orders...</td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan="7" className="text-center py-5">No sticker orders found.</td></tr>
            ) : orders.map((order) => (
              <tr key={order._id}>
                <td><strong>{order.orderNo}</strong><small>{dateTime(order.createdAt)}</small></td>
                <td><strong>{order.shippingAddress?.name || order.userId?.name || 'Customer'}</strong><small>{order.shippingAddress?.mobile || order.userId?.mobile}</small></td>
                <td><strong>{order.quantity} x {order.stickerType}</strong><small>{order.freeQuantity} free, {order.chargeableQuantity} paid</small></td>
                <td><strong>{money(order.totalAmount)}</strong><small>{order.razorpayOrderId || 'Free order'}</small></td>
                <td>{badge(order.orderStatus)} {badge(order.paymentStatus)}</td>
                <td><strong>{order.tracking?.courierName || 'N/A'}</strong><small>{order.tracking?.trackingNumber || 'No tracking'}</small></td>
                <td className="text-end"><Button size="sm" variant="outline-primary" onClick={() => openDetails(order)}><Eye size={14} /></Button></td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      {totalPages > 1 && (
        <Pagination className="justify-content-center mt-3">
          <Pagination.Prev disabled={page === 1} onClick={() => setPage(page - 1)} />
          {[...Array(Math.min(5, totalPages))].map((_, index) => {
            const number = Math.max(1, Math.min(totalPages - 4, page - 2)) + index;
            if (number > totalPages) return null;
            return <Pagination.Item key={number} active={page === number} onClick={() => setPage(number)}>{number}</Pagination.Item>;
          })}
          <Pagination.Next disabled={page === totalPages} onClick={() => setPage(page + 1)} />
        </Pagination>
      )}

      <Modal show={!!selected} onHide={() => setSelected(null)} size="lg">
        <Form onSubmit={updateOrder}>
          <Modal.Header closeButton><Modal.Title>{selected?.orderNo}</Modal.Title></Modal.Header>
          <Modal.Body>
            {selected && (
              <Row className="g-3">
                <Col md={5}>
                  <div className="kp-sticker-preview">
                    {selected.qrImagePath ? <img src={selected.qrImagePath} alt="QR" /> : <StickyNote size={120} />}
                    <strong>{selected.qrPayload?.merchantName || selected.qrPayload?.pn || 'KhatuPay QR'}</strong>
                    <span>{selected.qrPayload?.merchantVpa || selected.qrPayload?.pa || ''}</span>
                  </div>
                </Col>
                <Col md={7}>
                  <Table size="sm" bordered>
                    <tbody>
                      <tr><th>User</th><td>{selected.userId?.name || 'N/A'} ({selected.userId?.mobile || selected.userId?.email || 'N/A'})</td></tr>
                      <tr><th>Address</th><td>{selected.shippingAddress?.line1}, {selected.shippingAddress?.city}, {selected.shippingAddress?.state} - {selected.shippingAddress?.pincode}</td></tr>
                      <tr><th>Amount</th><td>{money(selected.totalAmount)} / {selected.paymentStatus}</td></tr>
                      <tr><th>Payment</th><td>{selected.razorpayPaymentId || selected.razorpayOrderId || 'Free'}</td></tr>
                    </tbody>
                  </Table>
                  <Row className="g-2">
                    <Col md={6}>
                      <Form.Label>Order Status</Form.Label>
                      <Form.Select name="orderStatus" defaultValue={selected.orderStatus}>
                        {orderStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                      </Form.Select>
                    </Col>
                    <Col md={6}>
                      <Form.Label>Payment Status</Form.Label>
                      <Form.Select name="paymentStatus" defaultValue={selected.paymentStatus}>
                        {paymentStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                      </Form.Select>
                    </Col>
                    <Col md={6}><Form.Label>Courier</Form.Label><Form.Control name="courierName" defaultValue={selected.tracking?.courierName || ''} /></Col>
                    <Col md={6}><Form.Label>Tracking No.</Form.Label><Form.Control name="trackingNumber" defaultValue={selected.tracking?.trackingNumber || ''} /></Col>
                    <Col md={12}><Form.Label>Tracking URL</Form.Label><Form.Control name="trackingUrl" defaultValue={selected.tracking?.trackingUrl || ''} /></Col>
                    <Col md={12}><Form.Label>Admin Note</Form.Label><Form.Control as="textarea" rows={2} name="adminNote" defaultValue={selected.adminNote || ''} /></Col>
                  </Row>
                </Col>
              </Row>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-secondary" onClick={() => setSelected(null)}>Close</Button>
            <Button type="submit" disabled={saving}><PackageCheck size={16} /> {saving ? 'Updating...' : 'Update Order'}</Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <style>{`
        .kp-admin-page { padding: 8px 0 24px; }
        .kp-page-head { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; margin-bottom: 18px; }
        .kp-page-head h2 { display: flex; align-items: center; gap: 10px; margin: 0; font-weight: 800; color: #111827; }
        .kp-page-head p { margin: 4px 0 0; color: #64748b; }
        .kp-eyebrow { margin: 0 0 4px !important; color: #0f766e !important; font-size: 12px; font-weight: 800; text-transform: uppercase; }
        .kp-stat { border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; box-shadow: 0 8px 22px rgba(15, 23, 42, 0.05); }
        .kp-stat span, .kp-stat small, .kp-table-card td small { display: block; color: #64748b; font-weight: 700; }
        .kp-stat strong { display: block; margin: 4px 0; font-size: 24px; color: #111827; }
        .kp-stat.success strong { color: #047857; }
        .kp-panel, .kp-table-card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px; box-shadow: 0 10px 26px rgba(15, 23, 42, 0.06); }
        .kp-table-card { padding: 0; overflow: hidden; }
        .kp-table-card thead th { background: #f8fafc; color: #475569; font-size: 12px; text-transform: uppercase; }
        .kp-sticker-preview { border: 1px solid #d7eeea; border-radius: 8px; padding: 18px; text-align: center; background: #f8fffe; }
        .kp-sticker-preview img { width: 220px; height: 220px; object-fit: contain; display: block; margin: 0 auto 12px; }
        .kp-sticker-preview strong, .kp-sticker-preview span { display: block; word-break: break-word; }
        @media (max-width: 768px) { .kp-page-head { flex-direction: column; } }
      `}</style>
    </div>
  );
}
