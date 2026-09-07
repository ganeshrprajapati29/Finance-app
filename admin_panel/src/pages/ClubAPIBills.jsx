import { useState, useEffect } from 'react';
import { Card, Row, Col, Table, Button, Badge, Alert, Spinner, Modal, Form, Pagination } from 'react-bootstrap';
import axios from '../api/axios';

const ClubAPIBills = () => {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters and pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  // Modals
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showFetchModal, setShowFetchModal] = useState(false);
  const [selectedBill, setSelectedBill] = useState(null);
  const [billActionLoading, setBillActionLoading] = useState('');
  const [fetchedBill, setFetchedBill] = useState(null);

  // Fetch bill form
  const [fetchForm, setFetchForm] = useState({
    type: 'ELECTRICITY',
    provider: '',
    accountRef: '',
    customerMobile: '',
    amount: '',
    opvalue1: '',
    opvalue2: '',
    opvalue3: '',
    opvalue4: '',
    opvalue5: ''
  });

  useEffect(() => {
    fetchBills();
  }, [page, search, statusFilter, typeFilter]);

  const fetchBills = async () => {
    try {
      setLoading(true);
      // Since we don't have a specific bills endpoint, we'll use transactions with bill types
      const params = new URLSearchParams({
        page,
        limit: 20,
        type: 'bill_fetch,bill_payment',
        ...(search && { search }),
        ...(statusFilter && { status: statusFilter })
      });

      const response = await axios.get(`/admin/clubapi/transactions?${params}`);
      setBills(response.data.data.transactions || []);
      setTotalPages(response.data.data.pagination?.totalPages || 1);
    } catch (err) {
      console.error('Error fetching bills:', err);
      setError('Failed to load bills');
    } finally {
      setLoading(false);
    }
  };

  const handleFetchBill = async () => {
    try {
      setBillActionLoading('fetch');
      setFetchedBill(null);
      const response = await axios.post('/admin/clubapi/bbps/fetch-bill', {
        mobile: fetchForm.accountRef,
        bbpsId: fetchForm.provider,
        customerMobile: fetchForm.customerMobile,
        opvalue1: fetchForm.opvalue1,
        opvalue2: fetchForm.opvalue2,
        opvalue3: fetchForm.opvalue3,
        opvalue4: fetchForm.opvalue4,
        opvalue5: fetchForm.opvalue5
      });
      const data = response.data?.data || response.data;
      setFetchedBill(data);
      const amount = data?.amount || data?.billAmount || data?.dueAmount || data?.data?.amount || data?.data?.billAmount || '';
      if (amount) setFetchForm((current) => ({ ...current, amount: String(amount) }));
      await fetchBills();
    } catch (err) {
      console.error('Error fetching bill:', err);
      alert(err.response?.data?.message || err.message || 'Failed to fetch bill');
    } finally {
      setBillActionLoading('');
    }
  };

  const handlePayFetchedBill = async () => {
    if (!window.confirm(`Pay bill of Rs. ${fetchForm.amount} for ${fetchForm.accountRef}?`)) return;
    try {
      setBillActionLoading('pay');
      const response = await axios.post('/admin/clubapi/bbps/pay-bill', {
        mobile: fetchForm.accountRef,
        bbpsId: fetchForm.provider,
        customerMobile: fetchForm.customerMobile,
        amount: fetchForm.amount,
        opvalue1: fetchForm.opvalue1,
        opvalue2: fetchForm.opvalue2,
        opvalue3: fetchForm.opvalue3,
        opvalue4: fetchForm.opvalue4,
        opvalue5: fetchForm.opvalue5
      });
      setFetchedBill(response.data?.data || response.data);
      await fetchBills();
      alert('Bill payment request submitted');
    } catch (err) {
      console.error('Error paying bill:', err);
      alert(err.response?.data?.message || err.message || 'Failed to pay bill');
    } finally {
      setBillActionLoading('');
    }
  };

  const getStatusBadge = (status) => {
    const variants = {
      completed: 'success',
      failed: 'danger',
      pending: 'warning',
      processing: 'info',
      cancelled: 'secondary'
    };
    return <Badge bg={variants[status] || 'secondary'}>{status}</Badge>;
  };

  const formatAmount = (amount) => `₹${amount?.toLocaleString() || 0}`;

  const formatDate = (date) => new Date(date).toLocaleString();

  const handlePageChange = (pageNum) => {
    setPage(pageNum);
  };

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('');
    setTypeFilter('');
    setPage(1);
  };

  const billTypes = [
    'ELECTRICITY',
    'WATER',
    'GAS',
    'TELEPHONE',
    'INTERNET',
    'CABLE_TV',
    'INSURANCE',
    'LOAN',
    'MUNICIPAL_TAXES'
  ];

  const providers = {
    ELECTRICITY: ['TATA_POWER', 'RELIANCE_ENERGY', 'MAHARASHTRA_STATE_ELECTRICITY', 'BESCOM'],
    WATER: ['MUMBAI_WATER', 'DELHI_JAL_BOARD', 'BANGALORE_WATER'],
    GAS: ['INDIAN_OIL', 'BHARAT_PETROLEUM', 'HINDUSTAN_PETROLEUM'],
    TELEPHONE: ['BSNL', 'MTNL', 'RELIANCE_COMMUNICATIONS'],
    INTERNET: ['AIRTEL_BROADBAND', 'JIO_FIBER', 'ACT_FIBERNET'],
    CABLE_TV: ['TATA_SKY', 'DISH_TV', 'SUN_DIRECT'],
    INSURANCE: ['LIC', 'BAJAJ_ALLIANZ', 'HDFC_ERGO'],
    LOAN: ['SBI_LOAN', 'HDFC_LOAN', 'ICICI_LOAN'],
    MUNICIPAL_TAXES: ['MUMBAI_MUNICIPAL_CORPORATION', 'DELHI_MUNICIPAL_CORPORATION']
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f5f7fa 0%, #e9ecef 100%)', padding: '40px 20px' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #001f5c 0%, #003d99 100%)',
        borderRadius: '16px',
        padding: '35px',
        marginBottom: '35px',
        boxShadow: '0 15px 50px rgba(0, 31, 92, 0.2)',
        color: 'white'
      }}>
        <h2 style={{ margin: 0, fontWeight: '700' }}>Club API Bills</h2>
        <p style={{ margin: '8px 0 0 0', opacity: 0.9 }}>Manage bill payments and fetches</p>
      </div>

      {/* Action Buttons */}
      <Row className="mb-4">
        <Col>
          <Button
            variant="success"
            size="lg"
            onClick={() => setShowFetchModal(true)}
            style={{ borderRadius: '12px', padding: '12px 30px' }}
          >
            🔍 Fetch New Bill
          </Button>
        </Col>
      </Row>

      {/* Filters */}
      <Card style={{ border: 'none', borderRadius: '12px', boxShadow: '0 5px 20px rgba(0, 31, 92, 0.1)', marginBottom: '35px' }}>
        <Card.Header style={{ background: '#1abc9c', color: 'white', fontWeight: '700' }}>
          Filters
        </Card.Header>
        <Card.Body>
          <Row className="g-3">
            <Col md={4}>
              <Form.Control
                type="text"
                placeholder="Search by Account Reference, Mobile..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </Col>
            <Col md={2}>
              <Form.Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">All Status</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
                <option value="cancelled">Cancelled</option>
              </Form.Select>
            </Col>
            <Col md={2}>
              <Form.Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                <option value="">All Types</option>
                <option value="bill_fetch">Bill Fetch</option>
                <option value="bill_payment">Bill Payment</option>
              </Form.Select>
            </Col>
            <Col md={2}>
              <Button variant="outline-secondary" onClick={resetFilters} className="w-100">
                Reset
              </Button>
            </Col>
            <Col md={2}>
              <Button variant="primary" onClick={fetchBills} className="w-100">
                Search
              </Button>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Bills Table */}
      <Card style={{ border: 'none', borderRadius: '12px', boxShadow: '0 5px 20px rgba(0, 31, 92, 0.1)' }}>
        <Card.Header style={{ background: '#001f5c', color: 'white', fontWeight: '700' }}>
          Bills
        </Card.Header>
        <Card.Body style={{ padding: 0 }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '50px' }}>
              <Spinner animation="border" style={{ color: '#1abc9c' }} />
            </div>
          ) : error ? (
            <Alert variant="danger" style={{ margin: '30px' }}>
              {error}
              <Button variant="outline-danger" size="sm" className="ms-2" onClick={fetchBills}>
                Retry
              </Button>
            </Alert>
          ) : bills.length === 0 ? (
            <Alert variant="info" style={{ margin: '30px' }}>No bills found</Alert>
          ) : (
            <>
              <Table striped hover responsive style={{ marginBottom: 0 }}>
                <thead style={{ background: '#f8f9fa' }}>
                  <tr>
                    <th>Type</th>
                    <th>Account Reference</th>
                    <th>Customer Mobile</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Provider</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bills.map((bill) => (
                    <tr key={bill._id}>
                      <td>{bill.type.replace('_', ' ').toUpperCase()}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}>{bill.accountRef}</td>
                      <td>{bill.customerMobile || 'N/A'}</td>
                      <td style={{ fontWeight: '600', color: '#1abc9c' }}>{formatAmount(bill.amount)}</td>
                      <td>{getStatusBadge(bill.status)}</td>
                      <td>{bill.provider}</td>
                      <td style={{ fontSize: '0.9rem', color: '#6c757d' }}>{formatDate(bill.createdAt)}</td>
                      <td>
                        <Button
                          variant="outline-info"
                          size="sm"
                          className="me-2"
                          onClick={() => {
                            setSelectedBill(bill);
                            setShowDetailModal(true);
                          }}
                        >
                          View
                        </Button>
                        {bill.type === 'bill_fetch' && bill.status === 'completed' && (
                          <Button variant="outline-success" size="sm">
                            Pay Bill
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div style={{ padding: '20px', display: 'flex', justifyContent: 'center' }}>
                  <Pagination>
                    <Pagination.First onClick={() => handlePageChange(1)} disabled={page === 1} />
                    <Pagination.Prev onClick={() => handlePageChange(page - 1)} disabled={page === 1} />
                    {[...Array(Math.min(5, totalPages))].map((_, idx) => {
                      const pageNum = Math.max(1, Math.min(totalPages - 4, page - 2)) + idx;
                      return (
                        <Pagination.Item
                          key={pageNum}
                          active={pageNum === page}
                          onClick={() => handlePageChange(pageNum)}
                        >
                          {pageNum}
                        </Pagination.Item>
                      );
                    })}
                    <Pagination.Next onClick={() => handlePageChange(page + 1)} disabled={page === totalPages} />
                    <Pagination.Last onClick={() => handlePageChange(totalPages)} disabled={page === totalPages} />
                  </Pagination>
                </div>
              )}
            </>
          )}
        </Card.Body>
      </Card>

      {/* Fetch Bill Modal */}
      <Modal show={showFetchModal} onHide={() => setShowFetchModal(false)} size="lg">
        <Modal.Header closeButton style={{ background: '#1abc9c', color: 'white' }}>
          <Modal.Title>Fetch Bill</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Bill Type</Form.Label>
                <Form.Select
                  value={fetchForm.type}
                  onChange={(e) => setFetchForm({ ...fetchForm, type: e.target.value, provider: '' })}
                >
                  {billTypes.map(type => (
                    <option key={type} value={type}>{type.replace('_', ' ')}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>BBPS ID / Provider</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="ClubAPI BBPS ID"
                  value={fetchForm.provider}
                  onChange={(e) => setFetchForm({ ...fetchForm, provider: e.target.value })}
                />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Account Reference</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="Enter account number/ID"
                  value={fetchForm.accountRef}
                  onChange={(e) => setFetchForm({ ...fetchForm, accountRef: e.target.value })}
                />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Customer Mobile</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="Enter mobile number"
                  value={fetchForm.customerMobile}
                  onChange={(e) => setFetchForm({ ...fetchForm, customerMobile: e.target.value })}
                />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Pay Amount</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="Amount returned by fetch bill"
                  value={fetchForm.amount}
                  onChange={(e) => setFetchForm({ ...fetchForm, amount: e.target.value })}
                />
              </Form.Group>
            </Col>
            {[1, 2, 3, 4, 5].map((idx) => (
              <Col md={idx < 3 ? 6 : 4} key={idx}>
                <Form.Group className="mb-3">
                  <Form.Label>{`opvalue${idx}`}</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder={`Optional opvalue${idx}`}
                    value={fetchForm[`opvalue${idx}`]}
                    onChange={(e) => setFetchForm({ ...fetchForm, [`opvalue${idx}`]: e.target.value })}
                  />
                </Form.Group>
              </Col>
            ))}
            {fetchedBill && (
              <Col md={12}>
                <Form.Group className="mb-3">
                  <Form.Label><strong>ClubAPI Response</strong></Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={8}
                    value={JSON.stringify(fetchedBill, null, 2)}
                    readOnly
                    style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}
                  />
                </Form.Group>
              </Col>
            )}
          </Row>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowFetchModal(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleFetchBill}
            disabled={!!billActionLoading || !fetchForm.provider || !fetchForm.accountRef || !fetchForm.customerMobile}
          >
            {billActionLoading === 'fetch' ? <Spinner animation="border" size="sm" /> : 'Fetch Bill'}
          </Button>
          <Button
            variant="success"
            onClick={handlePayFetchedBill}
            disabled={!!billActionLoading || !fetchForm.provider || !fetchForm.accountRef || !fetchForm.customerMobile || !fetchForm.amount}
          >
            {billActionLoading === 'pay' ? <Spinner animation="border" size="sm" /> : 'Pay Bill'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Bill Detail Modal */}
      <Modal show={showDetailModal} onHide={() => setShowDetailModal(false)} size="lg">
        <Modal.Header closeButton style={{ background: '#001f5c', color: 'white' }}>
          <Modal.Title>Bill Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedBill && (
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label><strong>Type</strong></Form.Label>
                  <Form.Control type="text" value={selectedBill.type.replace('_', ' ').toUpperCase()} readOnly />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label><strong>Provider</strong></Form.Label>
                  <Form.Control type="text" value={selectedBill.provider} readOnly />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label><strong>Account Reference</strong></Form.Label>
                  <Form.Control type="text" value={selectedBill.accountRef} readOnly />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label><strong>Customer Mobile</strong></Form.Label>
                  <Form.Control type="text" value={selectedBill.customerMobile || 'N/A'} readOnly />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label><strong>Amount</strong></Form.Label>
                  <Form.Control type="text" value={formatAmount(selectedBill.amount)} readOnly />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label><strong>Status</strong></Form.Label>
                  <Form.Control type="text" value={selectedBill.status.toUpperCase()} readOnly />
                </Form.Group>
              </Col>
              <Col md={12}>
                <Form.Group className="mb-3">
                  <Form.Label><strong>API Response</strong></Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={6}
                    value={JSON.stringify(selectedBill.response, null, 2)}
                    readOnly
                    style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}
                  />
                </Form.Group>
              </Col>
            </Row>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDetailModal(false)}>
            Close
          </Button>
          {selectedBill?.type === 'bill_fetch' && selectedBill?.status === 'completed' && (
            <Button variant="success">
              Pay This Bill
            </Button>
          )}
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default ClubAPIBills;
