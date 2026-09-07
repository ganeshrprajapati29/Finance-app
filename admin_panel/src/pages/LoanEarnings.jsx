import { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Row, Spinner, Table } from 'react-bootstrap';
import { CSVLink } from 'react-csv';
import { Download, RefreshCw } from 'lucide-react';
import api from '../api/axios';

const currency = (value) => `Rs. ${Number(value || 0).toLocaleString('en-IN')}`;
const unwrap = (res) => res?.data?.data || res?.data || {};

const LoanEarnings = () => {
  const [earnings, setEarnings] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadEarnings = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get('/admin/earnings/loans');
      const data = unwrap(response);
      setEarnings(Array.isArray(data.items) ? data.items : []);
      setStats(data.stats || {});
    } catch (err) {
      setEarnings([]);
      setStats({});
      setError(err.response?.data?.message || err.message || 'Loan earnings load nahi ho paya');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEarnings();
  }, []);

  const totals = useMemo(() => ({
    loanAmount: earnings.reduce((sum, item) => sum + Number(item.loanAmount || 0), 0),
    processingFee: earnings.reduce((sum, item) => sum + Number(item.processingFee || 0), 0),
    interest: earnings.reduce((sum, item) => sum + Number(item.interest || 0), 0),
    lateFee: earnings.reduce((sum, item) => sum + Number(item.lateFee || 0), 0),
    profit: earnings.reduce((sum, item) => sum + Number(item.profit || 0), 0)
  }), [earnings]);

  const csvHeaders = [
    { label: 'Loan ID', key: 'loanId' },
    { label: 'User', key: 'user.name' },
    { label: 'Loan Amount', key: 'loanAmount' },
    { label: 'Processing Fee', key: 'processingFee' },
    { label: 'Interest', key: 'interest' },
    { label: 'Late Fee', key: 'lateFee' },
    { label: 'Profit', key: 'profit' }
  ];

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: 400 }}>
        <Spinner animation="border" variant="success" />
      </div>
    );
  }

  return (
    <div className="container-fluid p-4">
      <div className="d-flex justify-content-between align-items-start mb-4 gap-3">
        <div>
          <p className="text-uppercase text-success fw-bold mb-1 small">Loan Revenue</p>
          <h2 className="mb-1">Loan Earnings</h2>
          <p className="text-muted mb-0">Processing fee, interest, penalties and net profit by loan.</p>
        </div>
        <div className="d-flex gap-2">
          <Button variant="outline-secondary" onClick={loadEarnings}><RefreshCw size={16} /> Refresh</Button>
          <CSVLink data={earnings} headers={csvHeaders} filename="loan-earnings.csv" className="btn btn-outline-success">
            <Download size={16} /> Export
          </CSVLink>
        </div>
      </div>

      {error && <Alert variant="warning" dismissible onClose={() => setError('')}>{error}</Alert>}

      <Row className="g-3 mb-3">
        <Col md={3}><Card className="p-3 border-0 shadow-sm"><small className="text-muted fw-bold">Active Loans</small><h3>{stats.activeLoans || 0}</h3></Card></Col>
        <Col md={3}><Card className="p-3 border-0 shadow-sm"><small className="text-muted fw-bold">Completed Loans</small><h3>{stats.completedLoans || 0}</h3></Card></Col>
        <Col md={3}><Card className="p-3 border-0 shadow-sm"><small className="text-muted fw-bold">Interest</small><h3>{currency(totals.interest)}</h3></Card></Col>
        <Col md={3}><Card className="p-3 border-0 shadow-sm"><small className="text-muted fw-bold">Net Profit</small><h3 className="text-success">{currency(totals.profit)}</h3></Card></Col>
      </Row>

      <Card className="border-0 shadow-sm">
        <Table responsive hover className="align-middle mb-0">
          <thead className="table-light">
            <tr>
              <th>Loan</th>
              <th>User</th>
              <th>Loan Amount</th>
              <th>Processing Fee</th>
              <th>Interest</th>
              <th>Late Fee</th>
              <th>Profit</th>
            </tr>
          </thead>
          <tbody>
            {earnings.length === 0 ? (
              <tr><td colSpan="7" className="text-center py-5">No loan earnings found.</td></tr>
            ) : earnings.map((earning) => (
              <tr key={earning.loanId}>
                <td><strong>{earning.loanId}</strong></td>
                <td>{earning.user?.name || 'N/A'}<small className="d-block text-muted">{earning.user?.mobile || earning.user?.email}</small></td>
                <td>{currency(earning.loanAmount)}</td>
                <td>{currency(earning.processingFee)}</td>
                <td>{currency(earning.interest)}</td>
                <td>{earning.lateFee > 0 ? <Badge bg="warning">{currency(earning.lateFee)}</Badge> : currency(0)}</td>
                <td className="fw-bold text-success">{currency(earning.profit)}</td>
              </tr>
            ))}
          </tbody>
          {earnings.length > 0 && (
            <tfoot className="table-light">
              <tr>
                <th colSpan="2">Totals</th>
                <th>{currency(totals.loanAmount)}</th>
                <th>{currency(totals.processingFee)}</th>
                <th>{currency(totals.interest)}</th>
                <th>{currency(totals.lateFee)}</th>
                <th>{currency(totals.profit)}</th>
              </tr>
            </tfoot>
          )}
        </Table>
      </Card>
    </div>
  );
};

export default LoanEarnings;
