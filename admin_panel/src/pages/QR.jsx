import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, InputGroup, Modal, Pagination, Row, Table } from 'react-bootstrap';
import { Download, Eye, Plus, Printer, QrCode, RefreshCw, Search, Trash2, XCircle } from 'lucide-react';
import api from '../api/axios';
import khatuLogo from '../assets/khatulogo-removebg-preview.png';

const blankForm = {
  userId: '',
  merchantName: 'KhatuPay',
  merchantVpa: '',
  amount: '',
  label: 'KhatuPay Payment QR',
  note: 'KhatuPay payment',
  type: 'P2C'
};

const currency = (value) => `Rs. ${Number(value || 0).toLocaleString('en-IN')}`;
const dateTime = (value) => (value ? new Date(value).toLocaleString('en-IN') : 'N/A');
const unwrap = (res) => res?.data?.data || res?.data || {};
const qrMerchantName = (qr) => qr?.payload?.merchantName || qr?.payload?.pn || qr?.userId?.name || 'KhatuPay';
const qrVpa = (qr) => qr?.payload?.merchantVpa || qr?.payload?.pa || qr?.payload?.vpa || 'No UPI ID';
const qrAmount = (qr) => qr?.payload?.amount || qr?.payload?.am;
const qrLabel = (qr) => qr?.payload?.label || qr?.payload?.note || qr?.payload?.tn || 'KhatuPay QR';
const qrPayloadText = (qr) => qr?.payload?.qrString || qr?.payload?.uri || qr?.uri || '';

const QR = () => {
  const [qrCodes, setQrCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ search: '', status: 'ALL', type: 'ALL' });
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [selectedQR, setSelectedQR] = useState(null);
  const [form, setForm] = useState(blankForm);
  const [userSearch, setUserSearch] = useState('');
  const [users, setUsers] = useState([]);
  const limit = 20;

  const fetchQrCodes = async () => {
    try {
      setLoading(true);
      setError('');
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        status: filters.status,
        type: filters.type
      });
      if (filters.search.trim()) params.set('search', filters.search.trim());

      const res = await api.get(`/admin/qr?${params.toString()}`);
      const data = unwrap(res);
      const items = Array.isArray(data.items) ? data.items : [];
      setQrCodes(items);
      setTotal(Number(data.total || items.length));
      setTotalPages(Math.max(1, Math.ceil(Number(data.total || items.length) / limit)));
    } catch (err) {
      setQrCodes([]);
      setTotal(0);
      setTotalPages(1);
      setError(err.response?.data?.message || err.message || 'Unable to load QR codes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQrCodes();
  }, [page, filters.status, filters.type]);

  const stats = useMemo(() => {
    const active = qrCodes.filter((qr) => qr.isActive).length;
    const fixedAmount = qrCodes.reduce((sum, qr) => sum + Number(qrAmount(qr) || 0), 0);
    return {
      active,
      inactive: qrCodes.length - active,
      p2c: qrCodes.filter((qr) => qr.type === 'P2C').length,
      fixedAmount
    };
  }, [qrCodes]);

  const searchUsers = async (value) => {
    setUserSearch(value);
    if (value.trim().length < 2) {
      setUsers([]);
      return;
    }
    try {
      const res = await api.get(`/admin/users/search?q=${encodeURIComponent(value.trim())}`);
      const data = unwrap(res);
      setUsers(Array.isArray(data.items) ? data.items : Array.isArray(data) ? data : []);
    } catch {
      setUsers([]);
    }
  };

  const createQR = async (event) => {
    event.preventDefault();
    if (!form.merchantVpa.trim()) {
      setError('Merchant UPI ID required hai.');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        ...form,
        userId: form.userId || undefined,
        amount: form.amount ? Number(form.amount) : undefined
      };
      const res = await api.post('/admin/qr', payload);
      const created = unwrap(res);
      setSelectedQR(created);
      setShowCreate(false);
      setShowDetail(true);
      setForm(blankForm);
      setUserSearch('');
      setUsers([]);
      fetchQrCodes();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'QR create nahi ho paya');
    } finally {
      setSaving(false);
    }
  };

  const openDetail = async (qr) => {
    try {
      const res = await api.get(`/admin/qr/${qr._id}`);
      setSelectedQR(unwrap(res));
    } catch {
      setSelectedQR(qr);
    }
    setShowDetail(true);
  };

  const deactivateQR = async (qr) => {
    if (!window.confirm('Is QR ko inactive karna hai?')) return;
    await api.put(`/admin/qr/${qr._id}/deactivate`);
    fetchQrCodes();
  };

  const deleteQR = async (qr) => {
    if (qr.isActive) {
      setError('Active QR delete nahi ho sakta. Pehle inactive karein.');
      return;
    }
    if (!window.confirm('Inactive QR permanently delete karna hai?')) return;
    await api.delete(`/admin/qr/${qr._id}`);
    fetchQrCodes();
  };

  const printQR = (qr = selectedQR) => {
    if (!qr?.imagePath) return;
    const amount = qrAmount(qr);
    const label = qrLabel(qr);
    const vpa = qrVpa(qr);
    const printWindow = window.open('', '_blank', 'width=760,height=900');
    printWindow.document.write(`
      <html>
        <head>
          <title>${label}</title>
          <style>
            * { box-sizing: border-box; }
            body { font-family: Arial, sans-serif; margin: 0; padding: 28px; color: #111827; background: #eef6f5; }
            .sheet { width: 430px; margin: 0 auto; border-radius: 28px; overflow: hidden; background: #ffffff; border: 1px solid #dbe7e5; box-shadow: 0 22px 55px rgba(15, 23, 42, 0.18); }
            .top { background: linear-gradient(135deg, #053c3b 0%, #0f766e 58%, #14b8a6 100%); padding: 26px 26px 54px; color: white; text-align: center; position: relative; }
            .logo-wrap { width: 94px; height: 94px; border-radius: 24px; background: white; display: grid; place-items: center; margin: 0 auto 10px; box-shadow: 0 14px 30px rgba(0,0,0,0.18); }
            .logo { width: 78px; height: 78px; object-fit: contain; display: block; }
            .brand { font-size: 31px; font-weight: 900; letter-spacing: 0; }
            .sub { color: #d7fffb; margin-top: 6px; font-size: 14px; font-weight: 700; }
            .body { padding: 0 28px 28px; margin-top: -34px; text-align: center; position: relative; z-index: 2; }
            .qr-frame { width: 328px; min-height: 328px; margin: 0 auto; padding: 14px; background: #ffffff; border-radius: 24px; border: 1px solid #d7eeea; box-shadow: 0 16px 34px rgba(15, 118, 110, 0.16); position: relative; }
            .qr-frame:before, .qr-frame:after { content: ""; position: absolute; width: 42px; height: 42px; border-color: #0f766e; border-style: solid; }
            .qr-frame:before { left: 10px; top: 10px; border-width: 4px 0 0 4px; border-radius: 14px 0 0 0; }
            .qr-frame:after { right: 10px; bottom: 10px; border-width: 0 4px 4px 0; border-radius: 0 0 14px 0; }
            .qr { width: 296px; height: 296px; display: block; border-radius: 14px; }
            .amount { font-size: 26px; font-weight: 900; margin-top: 20px; color: #053c3b; }
            .pill { display: inline-block; margin-top: 10px; padding: 8px 14px; background: #ecfdf5; color: #047857; border-radius: 999px; font-size: 12px; font-weight: 900; text-transform: uppercase; }
            .vpa { font-size: 14px; border: 1px dashed #99c9c4; background: #f8fffe; padding: 12px; border-radius: 14px; margin-top: 14px; word-break: break-all; color: #334155; font-weight: 700; }
            .foot { margin-top: 16px; font-size: 12px; color: #64748b; }
            @media print { body { padding: 0; background: #ffffff; } .sheet { box-shadow: none; width: 100%; border-radius: 0; border: none; } }
          </style>
        </head>
        <body>
          <div class="sheet">
            <div class="top">
              <div class="logo-wrap"><img class="logo" src="${khatuLogo}" /></div>
              <div class="brand">KhatuPay</div>
              <div class="sub">${label}</div>
            </div>
            <div class="body">
              <div class="qr-frame"><img class="qr" src="${qr.imagePath}" /></div>
              <div class="amount">${amount ? currency(amount) : 'Open Amount'}</div>
              <div class="pill">Scan from any UPI app</div>
              <div class="vpa">${vpa}</div>
              <div class="foot">${label}</div>
            </div>
          </div>
          <script>window.onload = function(){ window.print(); };</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const statusBadge = (active) => (
    <Badge bg={active ? 'success' : 'secondary'}>{active ? 'ACTIVE' : 'INACTIVE'}</Badge>
  );

  const typeBadge = (type) => (
    <Badge bg={type === 'P2C' ? 'primary' : type === 'P2P' ? 'info' : 'warning'}>{type || 'STATIC'}</Badge>
  );

  return (
    <div className="kp-admin-page">
      <div className="kp-page-head">
        <div>
          <p className="kp-eyebrow">Payments Infrastructure</p>
          <h2><QrCode size={28} /> QR Codes</h2>
          <p>Create KhatuPay branded UPI QR codes, view details, and print merchant-ready sheets.</p>
        </div>
        <div className="kp-actions">
          <Button variant="outline-secondary" onClick={fetchQrCodes}><RefreshCw size={16} /> Refresh</Button>
          <Button onClick={() => setShowCreate(true)}><Plus size={16} /> Create QR</Button>
        </div>
      </div>

      {error && <Alert variant="warning" onClose={() => setError('')} dismissible>{error}</Alert>}

      <Row className="g-3 mb-3">
        <Col md={3}><Card className="kp-stat"><span>Total QR</span><strong>{total}</strong><small>All generated codes</small></Card></Col>
        <Col md={3}><Card className="kp-stat success"><span>Active</span><strong>{stats.active}</strong><small>Ready for payments</small></Card></Col>
        <Col md={3}><Card className="kp-stat"><span>P2C Codes</span><strong>{stats.p2c}</strong><small>Customer/merchant QR</small></Card></Col>
        <Col md={3}><Card className="kp-stat"><span>Fixed Amount</span><strong>{currency(stats.fixedAmount)}</strong><small>Amount locked in QR</small></Card></Col>
      </Row>

      <Card className="kp-panel mb-3">
        <Row className="g-2">
          <Col lg={5}>
            <InputGroup>
              <InputGroup.Text><Search size={16} /></InputGroup.Text>
              <Form.Control
                placeholder="Search user, QR label, UPI ID..."
                value={filters.search}
                onChange={(event) => setFilters({ ...filters, search: event.target.value })}
                onKeyDown={(event) => event.key === 'Enter' && fetchQrCodes()}
              />
            </InputGroup>
          </Col>
          <Col lg={2}>
            <Form.Select value={filters.status} onChange={(event) => { setPage(1); setFilters({ ...filters, status: event.target.value }); }}>
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </Form.Select>
          </Col>
          <Col lg={2}>
            <Form.Select value={filters.type} onChange={(event) => { setPage(1); setFilters({ ...filters, type: event.target.value }); }}>
              <option value="ALL">All Types</option>
              <option value="P2C">P2C</option>
              <option value="P2P">P2P</option>
              <option value="STATIC">Static</option>
            </Form.Select>
          </Col>
          <Col lg={3}><Button className="w-100" variant="dark" onClick={fetchQrCodes}>Apply Filters</Button></Col>
        </Row>
      </Card>

      <Card className="kp-table-card">
        <Table responsive hover className="align-middle mb-0">
          <thead>
            <tr>
              <th>QR</th>
              <th>Owner</th>
              <th>Merchant</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Created</th>
              <th className="text-end">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="7" className="text-center py-5">Loading QR codes...</td></tr>
            ) : qrCodes.length === 0 ? (
              <tr><td colSpan="7" className="text-center py-5">No QR codes found.</td></tr>
            ) : qrCodes.map((qr) => (
              <tr key={qr._id}>
                <td>
                  <div className="kp-qr-mini">{qr.imagePath ? <img src={qr.imagePath} alt="QR" /> : <QrCode size={34} />}</div>
                </td>
                <td>
                  <strong>{qr.userId?.name || 'KhatuPay Merchant'}</strong>
                  <small>{qr.userId?.mobile || qr.userId?.email || qrLabel(qr)}</small>
                </td>
                <td>
                  <strong>{qrMerchantName(qr)}</strong>
                  <small>{qrVpa(qr)}</small>
                </td>
                <td>{qrAmount(qr) ? currency(qrAmount(qr)) : 'Open'}</td>
                <td>{typeBadge(qr.type)} {statusBadge(qr.isActive)}</td>
                <td>{dateTime(qr.createdAt)}</td>
                <td>
                  <div className="kp-row-actions justify-content-end">
                    <Button size="sm" variant="outline-primary" onClick={() => openDetail(qr)}><Eye size={14} /></Button>
                    <Button size="sm" variant="outline-dark" onClick={() => printQR(qr)} disabled={!qr.imagePath}><Printer size={14} /></Button>
                    {qr.isActive ? (
                      <Button size="sm" variant="outline-warning" onClick={() => deactivateQR(qr)}><XCircle size={14} /></Button>
                    ) : (
                      <Button size="sm" variant="outline-danger" onClick={() => deleteQR(qr)}><Trash2 size={14} /></Button>
                    )}
                  </div>
                </td>
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

      <Modal show={showCreate} onHide={() => setShowCreate(false)} size="lg">
        <Form onSubmit={createQR}>
          <Modal.Header closeButton><Modal.Title>Create KhatuPay QR</Modal.Title></Modal.Header>
          <Modal.Body>
            <Row className="g-3">
              <Col md={6}>
                <Form.Label>Assign User</Form.Label>
                <InputGroup>
                  <InputGroup.Text><Search size={16} /></InputGroup.Text>
                  <Form.Control value={userSearch} onChange={(event) => searchUsers(event.target.value)} placeholder="Search name/mobile/email" />
                </InputGroup>
                {users.length > 0 && (
                  <div className="kp-user-results">
                    {users.map((user) => (
                      <button type="button" key={user._id} onClick={() => {
                        setForm({ ...form, userId: user._id, merchantName: user.name || 'KhatuPay' });
                        setUserSearch(`${user.name || 'User'} - ${user.mobile || user.email || ''}`);
                        setUsers([]);
                      }}>
                        <strong>{user.name || 'User'}</strong><span>{user.mobile || user.email}</span>
                      </button>
                    ))}
                  </div>
                )}
              </Col>
              <Col md={6}>
                <Form.Label>QR Type</Form.Label>
                <Form.Select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
                  <option value="P2C">P2C Merchant QR</option>
                  <option value="P2P">P2P QR</option>
                  <option value="STATIC">Static QR</option>
                </Form.Select>
              </Col>
              <Col md={6}>
                <Form.Label>Merchant Name</Form.Label>
                <Form.Control value={form.merchantName} onChange={(event) => setForm({ ...form, merchantName: event.target.value })} required />
              </Col>
              <Col md={6}>
                <Form.Label>Merchant UPI ID *</Form.Label>
                <Form.Control value={form.merchantVpa} onChange={(event) => setForm({ ...form, merchantVpa: event.target.value })} placeholder="khatupay@upi" required />
              </Col>
              <Col md={6}>
                <Form.Label>Fixed Amount</Form.Label>
                <Form.Control type="number" min="0" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} placeholder="Blank for open amount" />
              </Col>
              <Col md={6}>
                <Form.Label>Print Label</Form.Label>
                <Form.Control value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} />
              </Col>
              <Col md={12}>
                <Form.Label>Payment Note</Form.Label>
                <Form.Control value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} />
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Creating...' : 'Create Printable QR'}</Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <Modal show={showDetail} onHide={() => setShowDetail(false)} size="lg">
        <Modal.Header closeButton><Modal.Title>QR Details</Modal.Title></Modal.Header>
        <Modal.Body>
          {selectedQR && (
            <Row className="g-3">
              <Col md={5}>
                <div className="kp-print-card">
                  <div className="kp-print-top">
                    <div className="kp-logo-shell"><img className="kp-print-logo" src={khatuLogo} alt="KhatuPay" /></div>
                    <div className="kp-print-brand">KhatuPay</div>
                    <div className="kp-print-sub">{qrLabel(selectedQR)}</div>
                  </div>
                  <div className="kp-qr-frame-lg">
                    {selectedQR.imagePath ? <img className="kp-qr-image-lg" src={selectedQR.imagePath} alt="KhatuPay QR" /> : <QrCode size={180} />}
                  </div>
                  <strong>{qrAmount(selectedQR) ? currency(qrAmount(selectedQR)) : 'Open Amount'}</strong>
                  <em>Scan from any UPI app</em>
                  <span>{qrVpa(selectedQR)}</span>
                </div>
              </Col>
              <Col md={7}>
                <Table size="sm" bordered>
                  <tbody>
                    <tr><th>QR ID</th><td>{selectedQR.payload?.qrId || selectedQR._id}</td></tr>
                    <tr><th>Type</th><td>{typeBadge(selectedQR.type)}</td></tr>
                    <tr><th>Status</th><td>{statusBadge(selectedQR.isActive)}</td></tr>
                    <tr><th>Merchant</th><td>{qrMerchantName(selectedQR)}</td></tr>
                    <tr><th>User</th><td>{selectedQR.userId?.name || 'General QR'}</td></tr>
                    <tr><th>Created</th><td>{dateTime(selectedQR.createdAt)}</td></tr>
                    <tr><th>UPI Payload</th><td className="text-break"><code>{qrPayloadText(selectedQR)}</code></td></tr>
                  </tbody>
                </Table>
              </Col>
            </Row>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setShowDetail(false)}>Close</Button>
          <Button variant="outline-dark" onClick={() => printQR()}><Printer size={16} /> Print</Button>
          {selectedQR?.imagePath && <Button as="a" href={selectedQR.imagePath} download="khatupay-qr.png"><Download size={16} /> Download</Button>}
        </Modal.Footer>
      </Modal>

      <style>{`
        .kp-admin-page { padding: 8px 0 24px; }
        .kp-page-head { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; margin-bottom: 18px; }
        .kp-page-head h2 { display: flex; align-items: center; gap: 10px; margin: 0; font-weight: 800; color: #111827; }
        .kp-page-head p { margin: 4px 0 0; color: #64748b; }
        .kp-eyebrow { margin: 0 0 4px !important; color: #0f766e !important; font-size: 12px; font-weight: 800; text-transform: uppercase; }
        .kp-actions, .kp-row-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
        .kp-actions .btn, .kp-row-actions .btn { display: inline-flex; align-items: center; gap: 6px; }
        .kp-stat { border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; box-shadow: 0 8px 22px rgba(15, 23, 42, 0.05); }
        .kp-stat span, .kp-stat small { color: #64748b; font-weight: 700; }
        .kp-stat strong { display: block; margin: 4px 0; font-size: 24px; color: #111827; }
        .kp-stat.success strong { color: #047857; }
        .kp-panel, .kp-table-card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px; box-shadow: 0 10px 26px rgba(15, 23, 42, 0.06); }
        .kp-table-card { padding: 0; overflow: hidden; }
        .kp-table-card thead th { background: #f8fafc; color: #475569; font-size: 12px; text-transform: uppercase; }
        .kp-table-card td small { display: block; color: #64748b; }
        .kp-qr-mini { width: 54px; height: 54px; border: 1px solid #e5e7eb; border-radius: 8px; display: grid; place-items: center; background: #fff; }
        .kp-qr-mini img { width: 48px; height: 48px; object-fit: contain; }
        .kp-user-results { position: absolute; z-index: 20; margin-top: 4px; width: calc(50% - 28px); max-height: 190px; overflow: auto; background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; box-shadow: 0 18px 40px rgba(15, 23, 42, 0.16); }
        .kp-user-results button { width: 100%; border: 0; background: #fff; padding: 10px 12px; text-align: left; display: block; }
        .kp-user-results button:hover { background: #f8fafc; }
        .kp-user-results span { display: block; color: #64748b; font-size: 12px; }
        .kp-print-card { border: 1px solid #d7eeea; border-radius: 28px; overflow: hidden; text-align: center; background: #ffffff; box-shadow: 0 18px 42px rgba(15, 118, 110, 0.16); }
        .kp-print-top { background: linear-gradient(135deg, #053c3b 0%, #0f766e 58%, #14b8a6 100%); color: #fff; padding: 22px 18px 46px; }
        .kp-logo-shell { width: 82px; height: 82px; margin: 0 auto 8px; border-radius: 22px; display: grid; place-items: center; background: #fff; box-shadow: 0 12px 28px rgba(0,0,0,0.18); }
        .kp-print-logo { width: 68px !important; height: 68px !important; object-fit: contain !important; }
        .kp-print-brand { font-size: 28px; font-weight: 900; color: #ffffff; }
        .kp-print-sub { color: #d7fffb; margin-top: 4px; font-weight: 700; }
        .kp-qr-frame-lg { width: 254px; min-height: 254px; margin: -30px auto 14px; padding: 12px; background: #ffffff; border-radius: 24px; border: 1px solid #d7eeea; box-shadow: 0 14px 30px rgba(15, 118, 110, 0.16); position: relative; }
        .kp-qr-frame-lg:before, .kp-qr-frame-lg:after { content: ""; position: absolute; width: 34px; height: 34px; border-color: #0f766e; border-style: solid; }
        .kp-qr-frame-lg:before { left: 9px; top: 9px; border-width: 4px 0 0 4px; border-radius: 12px 0 0 0; }
        .kp-qr-frame-lg:after { right: 9px; bottom: 9px; border-width: 0 4px 4px 0; border-radius: 0 0 12px 0; }
        .kp-qr-image-lg { width: 228px !important; height: 228px !important; object-fit: contain; border-radius: 14px; }
        .kp-print-card strong { display: block; margin: 10px 18px 0; color: #053c3b; font-size: 22px; }
        .kp-print-card em { display: inline-block; margin-top: 8px; padding: 7px 12px; background: #ecfdf5; color: #047857; border-radius: 999px; font-size: 12px; font-style: normal; font-weight: 900; text-transform: uppercase; }
        .kp-print-card span { display: block; margin: 12px 18px 20px; padding: 10px; border: 1px dashed #99c9c4; border-radius: 12px; background: #f8fffe; color: #334155; font-weight: 700; word-break: break-all; }
        @media (max-width: 768px) { .kp-page-head { flex-direction: column; } .kp-actions { width: 100%; } .kp-actions .btn { flex: 1; justify-content: center; } .kp-user-results { width: calc(100% - 28px); } }
      `}</style>
    </div>
  );
};

export default QR;
