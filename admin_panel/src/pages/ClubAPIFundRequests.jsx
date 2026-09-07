import { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, Modal, Row, Spinner, Table } from 'react-bootstrap';
import { Building2, CheckCircle2, Eye, RefreshCw, Send, Wallet } from 'lucide-react';
import api from '../api/axios';

const unwrap = (res) => res?.data?.data || res?.data || {};
const currency = (value) => `Rs. ${Number(value || 0).toLocaleString('en-IN')}`;
const dateTime = (value) => (value ? new Date(value).toLocaleString('en-IN') : 'N/A');

const initialForm = {
  amount: '',
  paymentMode: 'IMPS',
  utrNumber: '',
  paymentDate: new Date().toISOString().slice(0, 10),
  bankAccountNumber: '114505002084',
  walletType: 'P2P',
  proofUrl: '',
  remarks: '',
};

const statusVariant = (status) => ({
  DRAFT: 'secondary',
  SUBMITTED: 'primary',
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  FAILED: 'danger',
}[status] || 'secondary');

export default function ClubAPIFundRequests() {
  const [balance, setBalance] = useState(null);
  const [items, setItems] = useState([]);
  const [providerItems, setProviderItems] = useState([]);
  const [providerMeta, setProviderMeta] = useState({ total: 0, page: 1, limit: 20 });
  const [providerLoading, setProviderLoading] = useState(false);
  const [providerError, setProviderError] = useState('');
  const [stats, setStats] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [filters, setFilters] = useState({ status: '', search: '' });
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [detail, setDetail] = useState(null);
  const [statusForm, setStatusForm] = useState({ status: 'PENDING', reviewedNote: '', providerReference: '' });
  const [statusSaving, setStatusSaving] = useState(false);
  const banks = balance?.fundRequest?.banks?.length ? balance.fundRequest.banks : [{
    label: 'P2P Wallet - ICICI 1145',
    accountNumber: '114505002084',
    ifsc: 'ICIC0001145',
    accountName: 'RECHAPI PRIVATE LIMITED',
    walletType: 'P2P',
    minimumAmount: 1000,
  }];
  const selectedBank = banks.find((bank) => bank.accountNumber === form.bankAccountNumber) || banks[0];

  const totals = useMemo(() => {
    return stats.reduce((acc, row) => {
      acc.count += Number(row.count || 0);
      acc.amount += Number(row.amount || 0);
      if (row._id === 'APPROVED') acc.approved += Number(row.amount || 0);
      if (row._id === 'PENDING' || row._id === 'SUBMITTED') acc.pending += Number(row.amount || 0);
      return acc;
    }, { count: 0, amount: 0, approved: 0, pending: 0 });
  }, [stats]);

  const loadBalance = async () => {
    const response = await api.get('/admin/clubapi/balance');
    setBalance(unwrap(response));
  };

  const loadRequests = async (next = {}) => {
    const page = next.page || pagination.page || 1;
    const params = new URLSearchParams({
      page,
      limit: pagination.limit,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.search ? { search: filters.search } : {}),
    });
    const response = await api.get(`/admin/clubapi/fund-requests?${params.toString()}`);
    const data = unwrap(response);
    setItems(Array.isArray(data.items) ? data.items : []);
    setStats(Array.isArray(data.stats) ? data.stats : []);
    setPagination({
      page: data.page || page,
      limit: data.limit || pagination.limit,
      total: data.total || 0,
      pages: data.pages || 1,
    });
  };

  const loadProviderRequests = async (next = {}) => {
    setProviderLoading(true);
    setProviderError('');
    try {
      const page = next.page || providerMeta.page || 1;
      const params = new URLSearchParams({
        page,
        limit: providerMeta.limit,
        ...(filters.search ? { search: filters.search } : {}),
      });
      const response = await api.get(`/admin/clubapi/fund-requests/provider?${params.toString()}`);
      const data = unwrap(response);
      setProviderItems(Array.isArray(data.items) ? data.items : []);
      setProviderMeta({
        total: data.total || 0,
        page: data.page || page,
        limit: data.limit || providerMeta.limit,
        sessionConfigured: data.sessionConfigured,
      });
    } catch (err) {
      setProviderItems([]);
      setProviderError(err.response?.data?.message || err.message || 'Provider panel request list load nahi ho payi');
    } finally {
      setProviderLoading(false);
    }
  };

  const loadAll = async () => {
    try {
      setLoading(true);
      setError('');
      await Promise.all([loadBalance(), loadRequests({ page: 1 }), loadProviderRequests({ page: 1 })]);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Fund request data load nahi ho paya');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const submitRequest = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await api.post('/admin/clubapi/fund-requests', {
        ...form,
        amount: Number(form.amount),
      });
      setForm(initialForm);
      setSuccess('Fund request provider panel par submit ho gayi. Approval ke baad balance reflect hoga.');
      await Promise.all([loadBalance(), loadRequests({ page: 1 }), loadProviderRequests({ page: 1 })]);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Fund request save nahi ho paya');
    } finally {
      setSaving(false);
    }
  };

  const openStatus = (item) => {
    setDetail(item);
    setStatusForm({
      status: item.status || 'PENDING',
      reviewedNote: item.reviewedNote || '',
      providerReference: item.providerReference || '',
    });
  };

  const updateStatus = async () => {
    if (!detail) return;
    setStatusSaving(true);
    setError('');
    setSuccess('');
    try {
      const response = await api.put(`/admin/clubapi/fund-requests/${detail._id}/status`, statusForm);
      const updated = unwrap(response);
      setDetail(updated);
      setSuccess('Fund request status updated.');
      await Promise.all([loadBalance(), loadRequests()]);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Status update nahi ho paya');
    } finally {
      setStatusSaving(false);
    }
  };

  if (loading) {
    return <div className="fund-loading"><Spinner animation="border" variant="success" /></div>;
  }

  return (
    <div className="fund-page">
      <div className="fund-head">
        <div>
          <p>Provider Wallet</p>
          <h2><Wallet size={28} /> Fund Requests</h2>
          <span>Create, track and review provider balance top-up requests with UTR proof.</span>
        </div>
        <Button variant="outline-success" onClick={loadAll}><RefreshCw size={16} /> Refresh</Button>
      </div>

      {error && <Alert variant="danger" dismissible onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert variant="success" dismissible onClose={() => setSuccess('')}>{success}</Alert>}

      <Row className="g-3 mb-3">
        <Col lg={3} md={6}><Card className="fund-stat live"><Wallet /><span>Live Balance</span><strong>{balance?.balanceText || currency(balance?.balance)}</strong><small>{balance?.status || 'Not checked'}</small></Card></Col>
        <Col lg={3} md={6}><Card className="fund-stat"><Send /><span>Total Requests</span><strong>{totals.count}</strong><small>{currency(totals.amount)} requested</small></Card></Col>
        <Col lg={3} md={6}><Card className="fund-stat success"><CheckCircle2 /><span>Approved</span><strong>{currency(totals.approved)}</strong><small>Marked after provider credit</small></Card></Col>
        <Col lg={3} md={6}><Card className="fund-stat warning"><RefreshCw /><span>Pending</span><strong>{currency(totals.pending)}</strong><small>Submitted or under review</small></Card></Col>
      </Row>

      <Row className="g-3">
        <Col xl={4}>
          <Card className="fund-panel">
            <h5>Create Fund Request</h5>
            <p>Transfer ke baad exact bank reference number submit karein.</p>
            <div className="wallet-box">
              <div>
                <Building2 size={18} />
                <strong>{selectedBank?.walletType || 'P2P'} Wallet</strong>
              </div>
              <span>Account: {selectedBank?.accountNumber || '-'}</span>
              <span>IFSC: {selectedBank?.ifsc || '-'}</span>
              <span>Name: {selectedBank?.accountName || '-'}</span>
              <small>Minimum Amount: {currency(selectedBank?.minimumAmount || 0)}</small>
            </div>
            {!balance?.fundRequest?.sessionConfigured && (
              <Alert variant="warning" className="small">
                Provider panel session cookie configure nahi hai. Agar ClubAPI login required hua to submit fail ho sakta hai.
              </Alert>
            )}
            <Form onSubmit={submitRequest}>
              <Form.Group className="mb-3">
                <Form.Label>Amount</Form.Label>
                <Form.Control type="number" min={selectedBank?.minimumAmount || 1} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="1000" required />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Bank Reference Number</Form.Label>
                <Form.Control value={form.utrNumber} onChange={(e) => setForm({ ...form, utrNumber: e.target.value.toUpperCase() })} placeholder="Enter bank reference / UTR number" required />
                <Form.Text>Bank statement me jo reference/UTR dikhta hai wahi number dalein.</Form.Text>
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Transaction Date</Form.Label>
                <Form.Control type="date" value={form.paymentDate} onChange={(e) => setForm({ ...form, paymentDate: e.target.value })} />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Select Bank</Form.Label>
                <Form.Select value={form.bankAccountNumber} onChange={(e) => {
                  const nextBank = banks.find((bank) => bank.accountNumber === e.target.value);
                  setForm({ ...form, bankAccountNumber: e.target.value, walletType: nextBank?.walletType || form.walletType });
                }}>
                  {banks.map((bank) => (
                    <option key={bank.accountNumber} value={bank.accountNumber}>
                      {bank.accountNumber} - {bank.ifsc}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Payment Mode</Form.Label>
                <Form.Select value={form.paymentMode} onChange={(e) => setForm({ ...form, paymentMode: e.target.value })}>
                  <option value="IMPS">IMPS</option>
                  <option value="NEFT">NEFT</option>
                  <option value="RTGS">RTGS</option>
                  <option value="UPI">UPI</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="OTHER">Other</option>
                </Form.Select>
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Wallet Type</Form.Label>
                <Form.Select value={form.walletType} onChange={(e) => setForm({ ...form, walletType: e.target.value })}>
                  <option value="P2P">P2P</option>
                  <option value="P2A">P2A</option>
                </Form.Select>
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Proof URL</Form.Label>
                <Form.Control value={form.proofUrl} onChange={(e) => setForm({ ...form, proofUrl: e.target.value })} placeholder="/uploads/proof.png or https://..." />
                <Form.Text>Screenshot upload ke baad URL paste kar sakte hain.</Form.Text>
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Remarks</Form.Label>
                <Form.Control as="textarea" rows={3} value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} placeholder="Payment account, bank name, note..." />
              </Form.Group>
              <Button type="submit" disabled={saving} className="w-100">
                {saving ? <Spinner animation="border" size="sm" /> : <><Send size={16} /> Submit Request</>}
              </Button>
            </Form>
          </Card>
        </Col>

        <Col xl={8}>
          <Card className="fund-table-card">
            <div className="fund-table-head">
              <div>
                <h5>Fund Request History</h5>
                <p>Track UTR, proof and provider-credit review status.</p>
              </div>
              <div className="fund-filters">
                <Form.Select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
                  <option value="">All Status</option>
                  <option value="SUBMITTED">Submitted</option>
                  <option value="PENDING">Pending</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="FAILED">Failed</option>
                </Form.Select>
                <Form.Control value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} placeholder="Search UTR/reference" />
                <Button variant="outline-secondary" onClick={() => {
                  loadRequests({ page: 1 });
                  loadProviderRequests({ page: 1 });
                }}>Search</Button>
              </div>
            </div>

            <Table responsive hover className="align-middle mb-0">
              <thead>
                <tr><th>Date</th><th>Account Number</th><th>Amount</th><th>Trans Date</th><th>Method</th><th>Ref Number</th><th>Status</th><th>Wallet Type</th><th>Update Time</th><th>Remark</th><th>Action</th></tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan="11" className="text-center py-5 text-muted">No fund request found.</td></tr>
                ) : items.map((item) => (
                  <tr key={item._id}>
                    <td>{dateTime(item.createdAt)}<small>{item.requestedBy?.name || 'Admin'}</small></td>
                    <td>{item.bankAccountNumber || '-'}</td>
                    <td><strong>{currency(item.amount)}</strong></td>
                    <td>{dateTime(item.paymentDate)}</td>
                    <td><strong>{item.paymentMode}</strong></td>
                    <td><small>{item.utrNumber}</small></td>
                    <td><Badge bg={statusVariant(item.status)}>{item.status}</Badge></td>
                    <td>{item.walletType || 'P2P'}</td>
                    <td>{dateTime(item.updatedAt)}</td>
                    <td><small>{item.providerResponse?.message || item.reviewedNote || item.remarks || '-'}</small></td>
                    <td><Button size="sm" variant="outline-primary" onClick={() => openStatus(item)}><Eye size={15} /> View</Button></td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <div className="fund-pagination">
              <span>Page {pagination.page} of {pagination.pages} - {pagination.total} records</span>
              <div>
                <Button size="sm" variant="outline-secondary" disabled={pagination.page <= 1} onClick={() => loadRequests({ page: pagination.page - 1 })}>Previous</Button>
                <Button size="sm" variant="outline-secondary" disabled={pagination.page >= pagination.pages} onClick={() => loadRequests({ page: pagination.page + 1 })}>Next</Button>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      <Card className="fund-table-card mt-3">
        <div className="fund-table-head">
          <div>
            <h5>Provider Panel Requests</h5>
            <p>ClubAPI panel par jo fund request list dikh rahi hai, wahi yahan sync hogi.</p>
          </div>
          <Button variant="outline-success" onClick={() => loadProviderRequests({ page: 1 })} disabled={providerLoading}>
            {providerLoading ? <Spinner animation="border" size="sm" /> : <><RefreshCw size={16} /> Sync Provider List</>}
          </Button>
        </div>
        {providerError && (
          <Alert variant="warning" className="mx-3">
            {providerError}
          </Alert>
        )}
        <Table responsive hover className="align-middle mb-0">
          <thead>
            <tr><th>Date</th><th>Account Number</th><th>Amount</th><th>Trans Date</th><th>Method</th><th>Ref Number</th><th>Status</th><th>Wallet Type</th><th>Update Time</th><th>Remark</th></tr>
          </thead>
          <tbody>
            {providerLoading ? (
              <tr><td colSpan="10" className="text-center py-5"><Spinner animation="border" size="sm" /> Loading provider list...</td></tr>
            ) : providerItems.length === 0 ? (
              <tr><td colSpan="10" className="text-center py-5 text-muted">Provider panel me fund request list available nahi hai.</td></tr>
            ) : providerItems.map((item, index) => (
              <tr key={`${item.id || 'provider'}-${index}`}>
                <td>{item.date || '-'}</td>
                <td>{item.accountNumber || '-'}</td>
                <td><strong>{item.amount ? currency(item.amount) : '-'}</strong></td>
                <td>{item.transactionDate || '-'}</td>
                <td>{item.method || '-'}</td>
                <td><small>{item.refNumber || '-'}</small></td>
                <td><Badge bg={statusVariant(String(item.status || '').toUpperCase())}>{item.status || '-'}</Badge></td>
                <td>{item.walletType || '-'}</td>
                <td>{item.updateTime || '-'}</td>
                <td><small>{item.remark || '-'}</small></td>
              </tr>
            ))}
          </tbody>
        </Table>
        <div className="fund-pagination">
          <span>Provider records: {providerMeta.total || providerItems.length}</span>
          <div>
            <Button size="sm" variant="outline-secondary" disabled={providerMeta.page <= 1 || providerLoading} onClick={() => loadProviderRequests({ page: providerMeta.page - 1 })}>Previous</Button>
            <Button size="sm" variant="outline-secondary" disabled={providerLoading || providerItems.length < providerMeta.limit} onClick={() => loadProviderRequests({ page: providerMeta.page + 1 })}>Next</Button>
          </div>
        </div>
      </Card>

      <Modal show={!!detail} onHide={() => setDetail(null)} size="lg" centered>
        <Modal.Header closeButton><Modal.Title>Fund Request Details</Modal.Title></Modal.Header>
        <Modal.Body>
          {detail && (
            <div className="fund-detail">
              <div><span>Amount</span><strong>{currency(detail.amount)}</strong></div>
              <div><span>Status</span><strong><Badge bg={statusVariant(detail.status)}>{detail.status}</Badge></strong></div>
              <div><span>Mode</span><strong>{detail.paymentMode}</strong></div>
              <div><span>UTR</span><strong>{detail.utrNumber}</strong></div>
              <div><span>Bank Account</span><strong>{detail.bankAccountNumber || '-'}</strong></div>
              <div><span>Wallet Type</span><strong>{detail.walletType || 'P2P'}</strong></div>
              <div><span>Payment Date</span><strong>{dateTime(detail.paymentDate)}</strong></div>
              <div><span>Proof</span><strong>{detail.proofUrl ? <a href={detail.proofUrl} target="_blank" rel="noreferrer">Open proof</a> : 'Not added'}</strong></div>
              <div><span>Balance Before</span><strong>{detail.balanceBefore?.balanceText || currency(detail.balanceBefore?.balance)}</strong></div>
              <div><span>Balance After</span><strong>{detail.balanceAfter?.balanceText || '-'}</strong></div>
              <div className="wide"><span>Remarks</span><strong>{detail.remarks || '-'}</strong></div>
            </div>
          )}
          <hr />
          <Row className="g-3">
            <Col md={4}>
              <Form.Label>Status</Form.Label>
              <Form.Select value={statusForm.status} onChange={(e) => setStatusForm({ ...statusForm, status: e.target.value })}>
                <option value="SUBMITTED">Submitted</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
                <option value="FAILED">Failed</option>
              </Form.Select>
            </Col>
            <Col md={8}>
              <Form.Label>Provider Reference</Form.Label>
              <Form.Control value={statusForm.providerReference} onChange={(e) => setStatusForm({ ...statusForm, providerReference: e.target.value })} placeholder="Provider reference / ticket ID" />
            </Col>
            <Col xs={12}>
              <Form.Label>Review Note</Form.Label>
              <Form.Control as="textarea" rows={3} value={statusForm.reviewedNote} onChange={(e) => setStatusForm({ ...statusForm, reviewedNote: e.target.value })} placeholder="Approval/rejection note" />
            </Col>
          </Row>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setDetail(null)}>Close</Button>
          <Button onClick={updateStatus} disabled={statusSaving}>{statusSaving ? <Spinner animation="border" size="sm" /> : 'Update Status'}</Button>
        </Modal.Footer>
      </Modal>

      <style>{`
        .fund-loading{min-height:420px;display:grid;place-items:center}.fund-page{padding:8px 0 24px;color:#0f172a}.fund-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:18px}.fund-head p{margin:0 0 4px;color:#0f766e;font-weight:900;text-transform:uppercase;font-size:12px}.fund-head h2{display:flex;align-items:center;gap:10px;margin:0;font-weight:850}.fund-head span,.fund-panel p,.fund-table-head p,.fund-table-card small{color:#64748b}
        .fund-stat,.fund-panel,.fund-table-card{border:1px solid #e5e7eb;border-radius:8px;box-shadow:0 10px 26px rgba(15,23,42,.06)}.fund-stat{padding:16px;min-height:142px}.fund-stat svg{color:#0f766e}.fund-stat span{display:block;color:#64748b;font-weight:800;margin-top:8px}.fund-stat strong{display:block;font-size:24px;margin:4px 0;word-break:break-word}.fund-stat.live{background:linear-gradient(135deg,#0f766e,#2563eb);color:white}.fund-stat.live svg,.fund-stat.live span,.fund-stat.live small{color:white}.fund-stat.success strong{color:#047857}.fund-stat.warning strong{color:#b45309}
        .fund-panel{padding:18px}.fund-panel h5,.fund-table-head h5{margin:0;font-weight:850}.fund-panel p,.fund-table-head p{margin:2px 0 14px}.fund-panel .btn,.fund-table-head .btn,.fund-table-card td .btn{display:inline-flex;align-items:center;justify-content:center;gap:6px}.wallet-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:14px}.wallet-box div{display:flex;align-items:center;gap:8px;margin-bottom:8px;color:#0f766e}.wallet-box span,.wallet-box small{display:block;color:#475569;font-weight:700;font-size:12px;line-height:1.6}.wallet-box small{color:#b45309}
        .fund-table-card{overflow:hidden}.fund-table-head{display:flex;justify-content:space-between;gap:14px;padding:16px}.fund-filters{display:grid;grid-template-columns:150px minmax(180px,1fr) auto;gap:8px;align-items:start}.fund-table-card thead th{background:#f8fafc;color:#475569;font-size:12px;text-transform:uppercase}.fund-table-card td small{display:block}.fund-pagination{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:14px 16px;border-top:1px solid #eef2f7}.fund-pagination div{display:flex;gap:8px}
        .fund-detail{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px}.fund-detail>div{background:#f8fafc;border:1px solid #edf2f7;border-radius:8px;padding:12px}.fund-detail .wide{grid-column:1/-1}.fund-detail span{display:block;color:#64748b;font-size:12px;font-weight:800;text-transform:uppercase}.fund-detail strong{display:block;margin-top:4px;word-break:break-word}
        @media(max-width:768px){.fund-head,.fund-table-head,.fund-pagination{flex-direction:column}.fund-filters{grid-template-columns:1fr}.fund-pagination div{width:100%}.fund-pagination .btn{flex:1}}
      `}</style>
    </div>
  );
}
