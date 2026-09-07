import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, InputGroup, Modal, Row, Table } from 'react-bootstrap';
import { CheckCircle, Download, FileText, RefreshCw, Search } from 'lucide-react';
import api from '../api/axios';

const unwrap = (res) => res?.data?.data || res?.data || {};
const currency = (value) => `Rs. ${Number(value || 0).toLocaleString('en-IN')}`;
const dateOnly = (value) => (value ? new Date(value).toLocaleDateString('en-IN') : 'N/A');

const LoanSettlement = () => {
  const [settlements, setSettlements] = useState([]);
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('eligible');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [selectedSettlement, setSelectedSettlement] = useState(null);
  const [form, setForm] = useState({ settlementAmount: 0, reason: 'negotiation', notes: '' });

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      const [settlementRes, loansRes] = await Promise.all([
        api.get('/admin/settlements/settlements'),
        api.get('/admin/settlements/loans/overdue')
      ]);
      const settlementData = unwrap(settlementRes);
      const loanData = unwrap(loansRes);
      setSettlements(Array.isArray(settlementData) ? settlementData : []);
      setLoans((Array.isArray(loanData) ? loanData : []).filter((loan) => Number(loan.outstandingAmount || 0) > 0));
    } catch (err) {
      setSettlements([]);
      setLoans([]);
      setError(err.response?.data?.message || err.message || 'Loan settlement data load nahi ho paya');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => ({
    eligible: loans.length,
    outstanding: loans.reduce((sum, loan) => sum + Number(loan.outstandingAmount || 0), 0),
    settled: settlements.length,
    settlementAmount: settlements.reduce((sum, item) => sum + Number(item.settlementAmount || 0), 0),
    saved: settlements.reduce((sum, item) => sum + Math.max(0, Number(item.originalOutstanding || 0) - Number(item.settlementAmount || 0)), 0)
  }), [loans, settlements]);

  const filteredLoans = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return loans;
    return loans.filter((loan) =>
      loan.userId?.name?.toLowerCase().includes(q) ||
      loan.userId?.mobile?.includes(q) ||
      loan.loanAccountNumber?.toLowerCase().includes(q)
    );
  }, [loans, search]);

  const filteredSettlements = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return settlements;
    return settlements.filter((item) =>
      item.userId?.name?.toLowerCase().includes(q) ||
      item.userId?.mobile?.includes(q) ||
      item.loanId?.loanAccountNumber?.toLowerCase().includes(q) ||
      item.reason?.toLowerCase().includes(q)
    );
  }, [settlements, search]);

  const openSettlement = (loan) => {
    const suggested = Math.round(Number(loan.outstandingAmount || 0) * 0.85);
    setSelectedLoan(loan);
    setForm({ settlementAmount: suggested, reason: 'negotiation', notes: '' });
    setShowModal(true);
  };

  const submitSettlement = async () => {
    if (!selectedLoan) return;
    try {
      setSaving(true);
      await api.post(`/admin/settlements/loans/${selectedLoan._id}/settlement`, {
        settlementAmount: Number(form.settlementAmount),
        reason: form.reason,
        notes: form.notes
      });
      setShowModal(false);
      setSelectedLoan(null);
      load();
      setTab('history');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Settlement create nahi ho paya');
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = () => {
    const rows = [
      ['Loan', 'User', 'Outstanding', 'Settlement Amount', 'Saved', 'Reason', 'Status', 'Date'],
      ...settlements.map((item) => [
        item.loanId?.loanAccountNumber || item.loanId?._id || '',
        item.userId?.name || '',
        item.originalOutstanding,
        item.settlementAmount,
        Number(item.originalOutstanding || 0) - Number(item.settlementAmount || 0),
        item.reason,
        item.status,
        item.createdAt
      ])
    ];
    const blob = new Blob([rows.map((row) => row.map((cell) => `"${String(cell || '').replace(/"/g, '""')}"`).join(',')).join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'loan-settlements.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const statusBadge = (status) => {
    const map = { offered: 'warning', accepted: 'success', rejected: 'danger', expired: 'secondary', CLOSED: 'success', DISBURSED: 'primary' };
    return <Badge bg={map[status] || 'secondary'}>{status || 'N/A'}</Badge>;
  };

  return (
    <div className="settle-page">
      <div className="settle-head">
        <div>
          <p>Recovery Operations</p>
          <h2><FileText size={28} /> Loan Settlement</h2>
          <span>Create settlement closures and track settlement savings.</span>
        </div>
        <div className="settle-actions">
          <Button variant="outline-secondary" onClick={load}><RefreshCw size={16} /> Refresh</Button>
          <Button variant="outline-success" onClick={exportCsv}><Download size={16} /> Export</Button>
        </div>
      </div>

      {error && <Alert variant="warning" dismissible onClose={() => setError('')}>{error}</Alert>}

      <Row className="g-3 mb-3">
        <Col md={3}><Card className="settle-stat"><span>Eligible Loans</span><strong>{stats.eligible}</strong><small>{currency(stats.outstanding)} outstanding</small></Card></Col>
        <Col md={3}><Card className="settle-stat"><span>Settlements</span><strong>{stats.settled}</strong><small>Total closed via settlement</small></Card></Col>
        <Col md={3}><Card className="settle-stat success"><span>Collected</span><strong>{currency(stats.settlementAmount)}</strong><small>Settlement amount</small></Card></Col>
        <Col md={3}><Card className="settle-stat warning"><span>Waived / Saved</span><strong>{currency(stats.saved)}</strong><small>Difference recorded</small></Card></Col>
      </Row>

      <Card className="settle-panel mb-3">
        <div className="settle-toolbar">
          <InputGroup>
            <InputGroup.Text><Search size={16} /></InputGroup.Text>
            <Form.Control placeholder="Search borrower, mobile, loan..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </InputGroup>
          <div className="settle-tabs">
            <Button variant={tab === 'eligible' ? 'dark' : 'outline-dark'} onClick={() => setTab('eligible')}>Eligible Loans</Button>
            <Button variant={tab === 'history' ? 'dark' : 'outline-dark'} onClick={() => setTab('history')}>Settlement History</Button>
          </div>
        </div>
      </Card>

      <Card className="settle-table-card">
        {tab === 'eligible' ? (
          <Table responsive hover className="align-middle mb-0">
            <thead><tr><th>Loan</th><th>Borrower</th><th>Approved</th><th>Outstanding</th><th>Paid</th><th>Status</th><th className="text-end">Action</th></tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7" className="text-center py-5">Loading eligible loans...</td></tr>
              ) : filteredLoans.length === 0 ? (
                <tr><td colSpan="7" className="text-center py-5">No eligible loans found.</td></tr>
              ) : filteredLoans.map((loan) => (
                <tr key={loan._id}>
                  <td><strong>{loan.loanAccountNumber || loan._id}</strong><small>{dateOnly(loan.createdAt)}</small></td>
                  <td>{loan.userId?.name || 'N/A'}<small>{loan.userId?.mobile || loan.userId?.email}</small></td>
                  <td>{currency(loan.decision?.amountApproved)}</td>
                  <td className="fw-bold text-danger">{currency(loan.outstandingAmount)}</td>
                  <td>{currency(loan.paidAmount)}</td>
                  <td>{statusBadge(loan.status)}</td>
                  <td className="text-end"><Button size="sm" onClick={() => openSettlement(loan)}><CheckCircle size={14} /> Settle</Button></td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <Table responsive hover className="align-middle mb-0">
            <thead><tr><th>Settlement</th><th>Borrower</th><th>Outstanding</th><th>Settlement</th><th>Saved</th><th>Status</th><th>Date</th><th className="text-end">Action</th></tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="8" className="text-center py-5">Loading settlements...</td></tr>
              ) : filteredSettlements.length === 0 ? (
                <tr><td colSpan="8" className="text-center py-5">No settlements found.</td></tr>
              ) : filteredSettlements.map((item) => (
                <tr key={item._id}>
                  <td><strong>{item.loanId?.loanAccountNumber || item.loanId?._id || item._id}</strong><small>{item.reason?.replace(/_/g, ' ')}</small></td>
                  <td>{item.userId?.name || 'N/A'}<small>{item.userId?.mobile || item.userId?.email}</small></td>
                  <td>{currency(item.originalOutstanding)}</td>
                  <td className="fw-bold text-success">{currency(item.settlementAmount)}</td>
                  <td>{currency(Number(item.originalOutstanding || 0) - Number(item.settlementAmount || 0))}</td>
                  <td>{statusBadge(item.status)}</td>
                  <td>{dateOnly(item.createdAt)}</td>
                  <td className="text-end"><Button size="sm" variant="outline-primary" onClick={() => { setSelectedSettlement(item); setShowDetail(true); }}>View</Button></td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Modal show={showModal} onHide={() => setShowModal(false)}>
        <Modal.Header closeButton><Modal.Title>Create Settlement</Modal.Title></Modal.Header>
        <Modal.Body>
          {selectedLoan && (
            <>
              <div className="settle-summary">
                <strong>{selectedLoan.userId?.name}</strong>
                <span>{selectedLoan.loanAccountNumber || selectedLoan._id}</span>
                <b>{currency(selectedLoan.outstandingAmount)} outstanding</b>
              </div>
              <Form.Group className="mb-3">
                <Form.Label>Settlement Amount</Form.Label>
                <Form.Control type="number" value={form.settlementAmount} onChange={(e) => setForm({ ...form, settlementAmount: e.target.value })} />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Reason</Form.Label>
                <Form.Select value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}>
                  <option value="financial_hardship">Financial Hardship</option>
                  <option value="negotiation">Negotiation</option>
                  <option value="legal_risk">Legal Risk</option>
                  <option value="goodwill">Goodwill</option>
                  <option value="other">Other</option>
                </Form.Select>
              </Form.Group>
              <Form.Group>
                <Form.Label>Notes</Form.Label>
                <Form.Control as="textarea" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </Form.Group>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setShowModal(false)}>Cancel</Button>
          <Button disabled={saving} onClick={submitSettlement}>{saving ? 'Submitting...' : 'Submit Settlement'}</Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showDetail} onHide={() => setShowDetail(false)}>
        <Modal.Header closeButton><Modal.Title>Settlement Details</Modal.Title></Modal.Header>
        <Modal.Body>
          {selectedSettlement && (
            <div className="detail-grid">
              <Info label="Borrower" value={selectedSettlement.userId?.name} />
              <Info label="Loan" value={selectedSettlement.loanId?.loanAccountNumber || selectedSettlement.loanId?._id} />
              <Info label="Original Outstanding" value={currency(selectedSettlement.originalOutstanding)} />
              <Info label="Settlement Amount" value={currency(selectedSettlement.settlementAmount)} />
              <Info label="Saved" value={currency(Number(selectedSettlement.originalOutstanding || 0) - Number(selectedSettlement.settlementAmount || 0))} />
              <Info label="Status" value={selectedSettlement.status} />
              <Info label="Reason" value={selectedSettlement.reason?.replace(/_/g, ' ')} />
              <Info label="Notes" value={selectedSettlement.notes || 'N/A'} />
            </div>
          )}
        </Modal.Body>
        <Modal.Footer><Button variant="outline-secondary" onClick={() => setShowDetail(false)}>Close</Button></Modal.Footer>
      </Modal>

      <style>{`
        .settle-page{padding:8px 0 24px;color:#111827}.settle-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:18px}.settle-head p{margin:0 0 4px;color:#0f766e;font-size:12px;font-weight:900;text-transform:uppercase}.settle-head h2{display:flex;align-items:center;gap:10px;margin:0;font-weight:850}.settle-head span,.settle-table-card td small{color:#64748b}.settle-actions,.settle-tabs{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.settle-actions .btn,.settle-table-card .btn{display:inline-flex;align-items:center;gap:6px}
        .settle-stat,.settle-panel,.settle-table-card{border:1px solid #e5e7eb;border-radius:8px;box-shadow:0 10px 26px rgba(15,23,42,.06)}.settle-stat{padding:16px}.settle-stat span,.settle-stat small{color:#64748b;font-weight:800}.settle-stat strong{display:block;font-size:24px;margin:4px 0}.settle-stat.success strong{color:#047857}.settle-stat.warning strong{color:#b45309}.settle-panel{padding:16px}.settle-toolbar{display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center}.settle-table-card{overflow:hidden}.settle-table-card thead th{background:#f8fafc;color:#475569;font-size:12px;text-transform:uppercase}.settle-table-card td small{display:block}.settle-summary{padding:14px;border:1px solid #e5e7eb;border-radius:8px;background:#f8fafc;margin-bottom:14px}.settle-summary span,.settle-summary b{display:block}.settle-summary b{color:#b91c1c;margin-top:4px}.detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.info-box{padding:12px;border:1px solid #e5e7eb;border-radius:8px;background:#f8fafc}.info-box span{display:block;color:#64748b;font-size:12px;font-weight:900;text-transform:uppercase}.info-box strong{display:block;margin-top:4px}
        @media(max-width:768px){.settle-head,.settle-toolbar{grid-template-columns:1fr;flex-direction:column}.settle-toolbar{display:grid}.detail-grid{grid-template-columns:1fr}}
      `}</style>
    </div>
  );
};

const Info = ({ label, value }) => (
  <div className="info-box"><span>{label}</span><strong>{value || 'N/A'}</strong></div>
);

export default LoanSettlement;
