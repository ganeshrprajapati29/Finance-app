import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, InputGroup, Modal, Pagination, Row, Table } from 'react-bootstrap';
import { CheckCircle, Download, Eye, Plus, Printer, RefreshCw, Search, Trash2, XCircle } from 'lucide-react';
import api from '../api/axios';
import khatuLogo from '../assets/khatulogo-removebg-preview.png';

const emptyItem = { description: '', quantity: 1, rate: 0, total: 0 };
const emptyForm = { userId: '', dueDate: '', description: '', notes: '', items: [emptyItem] };
const currency = (value) => `Rs. ${Number(value || 0).toLocaleString('en-IN')}`;
const dateOnly = (value) => (value ? new Date(value).toLocaleDateString('en-IN') : 'N/A');
const unwrap = (res) => res?.data?.data || res?.data || {};

const Invoices = () => {
  const [invoices, setInvoices] = useState([]);
  const [stats, setStats] = useState({ counts: {}, amounts: {} });
  const [filters, setFilters] = useState({ search: '', status: 'ALL' });
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [userSearch, setUserSearch] = useState('');
  const [users, setUsers] = useState([]);
  const limit = 20;

  const invoiceTotal = useMemo(
    () => form.items.reduce((sum, item) => sum + Number(item.total || 0), 0),
    [form.items]
  );

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      setError('');
      const params = new URLSearchParams({ page: String(page), limit: String(limit), status: filters.status });
      if (filters.search.trim()) params.set('search', filters.search.trim());
      const res = await api.get(`/admin/invoices?${params.toString()}`);
      const data = unwrap(res);
      const items = Array.isArray(data.items) ? data.items : [];
      setInvoices(items);
      setTotal(Number(data.total || items.length));
      setTotalPages(Number(data.pages || 1));
    } catch (err) {
      setInvoices([]);
      setTotal(0);
      setTotalPages(1);
      setError(err.response?.data?.message || err.message || 'Unable to load invoices');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await api.get('/admin/invoices/stats/summary');
      setStats(unwrap(res));
    } catch {
      setStats({ counts: {}, amounts: {} });
    }
  };

  useEffect(() => {
    fetchInvoices();
    fetchStats();
  }, [page, filters.status]);

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

  const updateItem = (index, key, value) => {
    const items = form.items.map((item, itemIndex) => {
      if (itemIndex !== index) return item;
      const next = { ...item, [key]: value };
      next.total = Number(next.quantity || 0) * Number(next.rate || 0);
      return next;
    });
    setForm({ ...form, items });
  };

  const createInvoice = async (event) => {
    event.preventDefault();
    if (!form.userId || invoiceTotal <= 0) {
      setError('User aur valid invoice amount required hai.');
      return;
    }

    try {
      setSaving(true);
      await api.post('/admin/invoices', { ...form, amount: invoiceTotal });
      setShowCreate(false);
      setForm(emptyForm);
      setUserSearch('');
      setUsers([]);
      fetchInvoices();
      fetchStats();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Invoice create nahi ho paya');
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (invoice, status) => {
    if (!window.confirm(`Invoice ko ${status} mark karna hai?`)) return;
    await api.put(`/admin/invoices/${invoice._id}`, { status });
    fetchInvoices();
    fetchStats();
  };

  const deleteInvoice = async (invoice) => {
    if (!window.confirm(`${invoice.invoiceNumber} delete karna hai?`)) return;
    await api.delete(`/admin/invoices/${invoice._id}`);
    fetchInvoices();
    fetchStats();
  };

  const downloadPDF = async (invoice) => {
    const res = await api.get(`/admin/invoices/${invoice._id}/pdf`, { responseType: 'blob' });
    const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${invoice.invoiceNumber || invoice._id}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const printInvoice = (invoice = selectedInvoice) => {
    if (!invoice) return;
    const rows = (invoice.items || []).map((item) => `
      <tr>
        <td>${item.description || 'Invoice item'}</td>
        <td>${item.quantity || 0}</td>
        <td>${currency(item.rate)}</td>
        <td>${currency(item.total)}</td>
      </tr>
    `).join('');
    const printWindow = window.open('', '_blank', 'width=860,height=980');
    printWindow.document.write(`
      <html>
        <head>
          <title>${invoice.invoiceNumber || 'KhatuPay Invoice'}</title>
          <style>
            * { box-sizing: border-box; }
            body { margin: 0; padding: 28px; font-family: Arial, sans-serif; color: #111827; background: #f3f7f7; }
            .sheet { width: 760px; margin: 0 auto; background: #fff; border: 1px solid #dbe7e5; border-radius: 18px; overflow: hidden; box-shadow: 0 22px 55px rgba(15, 23, 42, 0.14); }
            .top { background: #f0fdfa; border-top: 8px solid #0f766e; padding: 28px 34px; display: flex; justify-content: space-between; gap: 24px; }
            .brand { display: flex; gap: 16px; align-items: center; }
            .brand img { width: 78px; height: 78px; object-fit: contain; background: #fff; border: 1px solid #d7eeea; border-radius: 18px; padding: 8px; }
            .brand h1 { margin: 0; color: #0f766e; font-size: 30px; }
            .brand p, .meta p { margin: 4px 0 0; color: #64748b; font-size: 13px; }
            .meta { text-align: right; }
            .meta h2 { margin: 0; font-size: 28px; letter-spacing: 0; }
            .status { display: inline-block; margin-top: 10px; padding: 7px 14px; border-radius: 999px; color: #fff; background: ${invoice.status === 'PAID' ? '#047857' : invoice.status === 'OVERDUE' ? '#b91c1c' : '#b45309'}; font-weight: 800; font-size: 12px; }
            .content { padding: 32px 34px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-bottom: 26px; }
            .box { border: 1px solid #e5e7eb; border-radius: 14px; padding: 18px; }
            .box label { display: block; color: #0f766e; font-size: 12px; font-weight: 900; margin-bottom: 10px; }
            .box strong { display: block; font-size: 18px; margin-bottom: 6px; }
            .box span { display: block; color: #475569; font-size: 13px; margin-top: 3px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th { background: #0f766e; color: #fff; text-align: left; padding: 13px 14px; font-size: 12px; }
            th:nth-child(n+2), td:nth-child(n+2) { text-align: right; }
            td { padding: 13px 14px; border-bottom: 1px solid #eef2f7; font-size: 13px; }
            tbody tr:nth-child(even) { background: #f8fafc; }
            .summary { margin-left: auto; width: 310px; background: #f0fdfa; border: 1px solid #bdeee8; border-radius: 14px; padding: 18px; margin-top: 24px; }
            .summary div { display: flex; justify-content: space-between; align-items: center; }
            .summary label { color: #0f766e; font-weight: 900; }
            .summary strong { font-size: 24px; color: #053c3b; }
            .notes { margin-top: 24px; color: #475569; border: 1px solid #e5e7eb; border-radius: 14px; padding: 16px; }
            .foot { text-align: center; color: #64748b; font-size: 12px; padding: 18px 34px 28px; }
            @media print { body { padding: 0; background: #fff; } .sheet { width: 100%; border: 0; border-radius: 0; box-shadow: none; } }
          </style>
        </head>
        <body>
          <div class="sheet">
            <div class="top">
              <div class="brand">
                <img src="${khatuLogo}" />
                <div>
                  <h1>KhatuPay</h1>
                  <p>Digital payments, invoices and loan services</p>
                  <p>Secure billing document generated from admin panel</p>
                </div>
              </div>
              <div class="meta">
                <h2>INVOICE</h2>
                <p>${invoice.invoiceNumber || ''}</p>
                <span class="status">${invoice.status || 'PENDING'}</span>
              </div>
            </div>
            <div class="content">
              <div class="grid">
                <div class="box">
                  <label>BILL TO</label>
                  <strong>${invoice.userId?.name || 'Customer'}</strong>
                  <span>${invoice.userId?.email || 'N/A'}</span>
                  <span>${invoice.userId?.mobile || 'N/A'}</span>
                </div>
                <div class="box">
                  <label>INVOICE DETAILS</label>
                  <span>Date: ${dateOnly(invoice.date || invoice.createdAt)}</span>
                  <span>Due Date: ${dateOnly(invoice.dueDate)}</span>
                  <span>Invoice No: ${invoice.invoiceNumber || ''}</span>
                </div>
              </div>
              ${invoice.description ? `<div class="notes"><strong>Description:</strong> ${invoice.description}</div>` : ''}
              <table>
                <thead><tr><th>Description</th><th>Qty</th><th>Rate</th><th>Total</th></tr></thead>
                <tbody>${rows}</tbody>
              </table>
              <div class="summary"><div><label>AMOUNT PAYABLE</label><strong>${currency(invoice.amount)}</strong></div></div>
              ${invoice.notes ? `<div class="notes"><strong>Notes:</strong> ${invoice.notes}</div>` : ''}
            </div>
            <div class="foot">This is a system generated KhatuPay invoice.</div>
          </div>
          <script>window.onload = function(){ window.print(); };</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const exportCSV = async () => {
    const res = await api.get('/admin/invoices/csv/export', { responseType: 'blob' });
    const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'khatupay-invoices.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const openDetail = async (invoice) => {
    try {
      const res = await api.get(`/admin/invoices/${invoice._id}`);
      setSelectedInvoice(unwrap(res));
    } catch {
      setSelectedInvoice(invoice);
    }
    setShowDetail(true);
  };

  const badge = (status) => {
    const map = { PAID: 'success', PENDING: 'warning', OVERDUE: 'danger' };
    return <Badge bg={map[status] || 'secondary'}>{status}</Badge>;
  };

  return (
    <div className="kp-admin-page">
      <div className="kp-page-head">
        <div>
          <p className="kp-eyebrow">Billing</p>
          <h2><img className="kp-title-logo" src={khatuLogo} alt="KhatuPay" /> Invoices</h2>
          <p>Create invoices, track dues, update payment status, and download customer PDFs.</p>
        </div>
        <div className="kp-actions">
          <Button variant="outline-secondary" onClick={() => { fetchInvoices(); fetchStats(); }}><RefreshCw size={16} /> Refresh</Button>
          <Button variant="outline-success" onClick={exportCSV}><Download size={16} /> Export</Button>
          <Button onClick={() => setShowCreate(true)}><Plus size={16} /> Create Invoice</Button>
        </div>
      </div>

      {error && <Alert variant="warning" dismissible onClose={() => setError('')}>{error}</Alert>}

      <Row className="g-3 mb-3">
        <Col md={3}><Card className="kp-stat"><span>Total Billed</span><strong>{currency(stats.amounts?.totalAmount)}</strong><small>{stats.counts?.total || 0} invoices</small></Card></Col>
        <Col md={3}><Card className="kp-stat warning"><span>Pending</span><strong>{currency(stats.amounts?.pendingAmount)}</strong><small>{stats.counts?.pending || 0} waiting</small></Card></Col>
        <Col md={3}><Card className="kp-stat success"><span>Paid</span><strong>{currency(stats.amounts?.paidAmount)}</strong><small>{stats.counts?.paid || 0} cleared</small></Card></Col>
        <Col md={3}><Card className="kp-stat danger"><span>Overdue</span><strong>{currency(stats.amounts?.overdueAmount)}</strong><small>{stats.counts?.overdue || 0} delayed</small></Card></Col>
      </Row>

      <Card className="kp-panel mb-3">
        <Row className="g-2">
          <Col lg={6}>
            <InputGroup>
              <InputGroup.Text><Search size={16} /></InputGroup.Text>
              <Form.Control
                placeholder="Search invoice, user, mobile..."
                value={filters.search}
                onChange={(event) => setFilters({ ...filters, search: event.target.value })}
                onKeyDown={(event) => event.key === 'Enter' && fetchInvoices()}
              />
            </InputGroup>
          </Col>
          <Col lg={3}>
            <Form.Select value={filters.status} onChange={(event) => { setPage(1); setFilters({ ...filters, status: event.target.value }); }}>
              <option value="ALL">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="PAID">Paid</option>
              <option value="OVERDUE">Overdue</option>
            </Form.Select>
          </Col>
          <Col lg={3}><Button variant="dark" className="w-100" onClick={fetchInvoices}>Apply Filters</Button></Col>
        </Row>
      </Card>

      <Card className="kp-table-card">
        <Table responsive hover className="align-middle mb-0">
          <thead>
            <tr>
              <th>Invoice</th>
              <th>User</th>
              <th>Amount</th>
              <th>Date</th>
              <th>Due Date</th>
              <th>Status</th>
              <th className="text-end">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="7" className="text-center py-5">Loading invoices...</td></tr>
            ) : invoices.length === 0 ? (
              <tr><td colSpan="7" className="text-center py-5">No invoices found.</td></tr>
            ) : invoices.map((invoice) => (
              <tr key={invoice._id}>
                <td><strong>{invoice.invoiceNumber}</strong><small>{invoice.description || invoice.notes || 'KhatuPay invoice'}</small></td>
                <td><strong>{invoice.userId?.name || 'N/A'}</strong><small>{invoice.userId?.mobile || invoice.userId?.email || 'No contact'}</small></td>
                <td className="fw-bold">{currency(invoice.amount)}</td>
                <td>{dateOnly(invoice.date || invoice.createdAt)}</td>
                <td>{dateOnly(invoice.dueDate)}</td>
                <td>{badge(invoice.status)}</td>
                <td>
                  <div className="kp-row-actions justify-content-end">
                    <Button size="sm" variant="outline-primary" onClick={() => openDetail(invoice)}><Eye size={14} /></Button>
                    <Button size="sm" variant="outline-secondary" onClick={() => printInvoice(invoice)}><Printer size={14} /></Button>
                    <Button size="sm" variant="outline-dark" onClick={() => downloadPDF(invoice)}><Download size={14} /></Button>
                    {invoice.status !== 'PAID' && <Button size="sm" variant="outline-success" onClick={() => setStatus(invoice, 'PAID')}><CheckCircle size={14} /></Button>}
                    {invoice.status === 'PENDING' && <Button size="sm" variant="outline-warning" onClick={() => setStatus(invoice, 'OVERDUE')}><XCircle size={14} /></Button>}
                    <Button size="sm" variant="outline-danger" onClick={() => deleteInvoice(invoice)}><Trash2 size={14} /></Button>
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

      <Modal show={showCreate} onHide={() => setShowCreate(false)} size="xl">
        <Form onSubmit={createInvoice}>
          <Modal.Header closeButton><Modal.Title>Create Invoice</Modal.Title></Modal.Header>
          <Modal.Body>
            <Row className="g-3">
              <Col md={6}>
                <Form.Label>User *</Form.Label>
                <InputGroup>
                  <InputGroup.Text><Search size={16} /></InputGroup.Text>
                  <Form.Control value={userSearch} onChange={(event) => searchUsers(event.target.value)} placeholder="Search user by name/mobile/email" />
                </InputGroup>
                {users.length > 0 && (
                  <div className="kp-user-results">
                    {users.map((user) => (
                      <button type="button" key={user._id} onClick={() => {
                        setForm({ ...form, userId: user._id });
                        setUserSearch(`${user.name || 'User'} - ${user.mobile || user.email || ''}`);
                        setUsers([]);
                      }}>
                        <strong>{user.name || 'User'}</strong><span>{user.mobile || user.email}</span>
                      </button>
                    ))}
                  </div>
                )}
              </Col>
              <Col md={3}>
                <Form.Label>Due Date</Form.Label>
                <Form.Control type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} />
              </Col>
              <Col md={3}>
                <Form.Label>Total</Form.Label>
                <Form.Control value={currency(invoiceTotal)} disabled />
              </Col>
              <Col md={12}>
                <Form.Label>Description</Form.Label>
                <Form.Control value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Loan fee, service charge, settlement invoice..." />
              </Col>
            </Row>

            <div className="kp-items-head">
              <strong>Invoice Items</strong>
              <Button size="sm" variant="outline-primary" onClick={() => setForm({ ...form, items: [...form.items, { ...emptyItem }] })}><Plus size={14} /> Add Item</Button>
            </div>

            {form.items.map((item, index) => (
              <Row className="g-2 align-items-end mb-2" key={index}>
                <Col md={5}><Form.Control placeholder="Description" value={item.description} onChange={(event) => updateItem(index, 'description', event.target.value)} required /></Col>
                <Col md={2}><Form.Control type="number" min="1" value={item.quantity} onChange={(event) => updateItem(index, 'quantity', event.target.value)} required /></Col>
                <Col md={2}><Form.Control type="number" min="0" value={item.rate} onChange={(event) => updateItem(index, 'rate', event.target.value)} required /></Col>
                <Col md={2}><Form.Control value={currency(item.total)} disabled /></Col>
                <Col md={1}><Button variant="outline-danger" disabled={form.items.length === 1} onClick={() => setForm({ ...form, items: form.items.filter((_, itemIndex) => itemIndex !== index) })}><Trash2 size={14} /></Button></Col>
              </Row>
            ))}

            <Form.Label>Notes</Form.Label>
            <Form.Control as="textarea" rows={2} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Creating...' : 'Create Invoice'}</Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <Modal show={showDetail} onHide={() => setShowDetail(false)} size="lg">
        <Modal.Header closeButton><Modal.Title>Invoice Details</Modal.Title></Modal.Header>
        <Modal.Body>
          {selectedInvoice && (
            <>
              <Row className="g-3 mb-3">
                <Col md={6}><Card className="kp-detail-card kp-brand-card"><img src={khatuLogo} alt="KhatuPay" /><div><span>Invoice</span><strong>{selectedInvoice.invoiceNumber}</strong><small>{badge(selectedInvoice.status)}</small></div></Card></Col>
                <Col md={6}><Card className="kp-detail-card"><span>Customer</span><strong>{selectedInvoice.userId?.name || 'N/A'}</strong><small>{selectedInvoice.userId?.mobile || selectedInvoice.userId?.email}</small></Card></Col>
              </Row>
              <Table bordered responsive size="sm">
                <thead><tr><th>Description</th><th>Qty</th><th>Rate</th><th>Total</th></tr></thead>
                <tbody>
                  {(selectedInvoice.items || []).map((item, index) => (
                    <tr key={index}><td>{item.description}</td><td>{item.quantity}</td><td>{currency(item.rate)}</td><td>{currency(item.total)}</td></tr>
                  ))}
                </tbody>
                <tfoot><tr><th colSpan="3">Grand Total</th><th>{currency(selectedInvoice.amount)}</th></tr></tfoot>
              </Table>
              <p><strong>Due Date:</strong> {dateOnly(selectedInvoice.dueDate)}</p>
              <p><strong>Notes:</strong> {selectedInvoice.notes || 'N/A'}</p>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setShowDetail(false)}>Close</Button>
          {selectedInvoice && <Button variant="outline-dark" onClick={() => printInvoice(selectedInvoice)}><Printer size={16} /> Print</Button>}
          {selectedInvoice && <Button onClick={() => downloadPDF(selectedInvoice)}><Download size={16} /> Download PDF</Button>}
        </Modal.Footer>
      </Modal>

      <style>{`
        .kp-admin-page { padding: 8px 0 24px; }
        .kp-page-head { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; margin-bottom: 18px; }
        .kp-page-head h2 { display: flex; align-items: center; gap: 10px; margin: 0; font-weight: 800; color: #111827; }
        .kp-title-logo { width: 42px; height: 42px; object-fit: contain; }
        .kp-page-head p { margin: 4px 0 0; color: #64748b; }
        .kp-eyebrow { margin: 0 0 4px !important; color: #0f766e !important; font-size: 12px; font-weight: 800; text-transform: uppercase; }
        .kp-actions, .kp-row-actions, .kp-items-head { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
        .kp-actions { justify-content: flex-end; }
        .kp-actions .btn, .kp-row-actions .btn, .kp-items-head .btn { display: inline-flex; align-items: center; gap: 6px; }
        .kp-stat, .kp-panel, .kp-table-card, .kp-detail-card { border: 1px solid #e5e7eb; border-radius: 8px; box-shadow: 0 10px 26px rgba(15, 23, 42, 0.06); }
        .kp-stat { padding: 16px; }
        .kp-stat span, .kp-stat small, .kp-detail-card span, .kp-detail-card small { color: #64748b; font-weight: 700; }
        .kp-stat strong { display: block; margin: 4px 0; font-size: 24px; color: #111827; }
        .kp-stat.success strong { color: #047857; } .kp-stat.warning strong { color: #b45309; } .kp-stat.danger strong { color: #b91c1c; }
        .kp-panel { padding: 14px; }
        .kp-table-card { overflow: hidden; }
        .kp-table-card thead th { background: #f8fafc; color: #475569; font-size: 12px; text-transform: uppercase; }
        .kp-table-card td small { display: block; color: #64748b; }
        .kp-user-results { position: absolute; z-index: 20; margin-top: 4px; width: calc(50% - 28px); max-height: 190px; overflow: auto; background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; box-shadow: 0 18px 40px rgba(15, 23, 42, 0.16); }
        .kp-user-results button { width: 100%; border: 0; background: #fff; padding: 10px 12px; text-align: left; display: block; }
        .kp-user-results button:hover { background: #f8fafc; }
        .kp-user-results span { display: block; color: #64748b; font-size: 12px; }
        .kp-items-head { justify-content: space-between; margin: 18px 0 10px; }
        .kp-detail-card { padding: 14px; }
        .kp-brand-card { flex-direction: row; align-items: center; gap: 12px; }
        .kp-brand-card img { width: 54px; height: 54px; object-fit: contain; flex: 0 0 auto; }
        .kp-detail-card strong { display: block; font-size: 18px; color: #111827; }
        @media (max-width: 768px) { .kp-page-head { flex-direction: column; } .kp-actions .btn { flex: 1; justify-content: center; } .kp-user-results { width: calc(100% - 28px); } }
      `}</style>
    </div>
  );
};

export default Invoices;
