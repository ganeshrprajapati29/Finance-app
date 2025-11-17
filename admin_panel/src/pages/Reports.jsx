import { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Form, Table, Alert, Spinner } from 'react-bootstrap';
import { Download, FileText, CreditCard, Receipt, DollarSign, Calendar } from 'lucide-react';
import api from '../api/axios';

export default function Reports() {
  const [reports, setReports] = useState({
    loans: [],
    payments: [],
    bills: [],
    withdrawals: []
  });
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState({});
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    format: 'json'
  });
  const [activeTab, setActiveTab] = useState('loans');

  const reportTypes = [
    { key: 'loans', label: 'Loans Report', icon: FileText, color: 'primary' },
    { key: 'payments', label: 'Payments Report', icon: CreditCard, color: 'success' },
    { key: 'bills', label: 'Bills Report', icon: Receipt, color: 'info' },
    { key: 'withdrawals', label: 'Withdrawals Report', icon: DollarSign, color: 'warning' }
  ];

  const fetchReport = async (type) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        format: 'json',
        ...filters
      });

      const response = await api.get(`/reports/${type}?${params}`);
      setReports(prev => ({
        ...prev,
        [type]: response.data.data
      }));
    } catch (error) {
      console.error(`Error fetching ${type} report:`, error);
    } finally {
      setLoading(false);
    }
  };

  const downloadReport = async (type, format) => {
    setDownloading(prev => ({ ...prev, [type]: true }));
    try {
      const params = new URLSearchParams({
        format,
        ...filters
      });

      const response = await api.get(`/reports/${type}?${params}`, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;

      const timestamp = new Date().toISOString().split('T')[0];
      link.setAttribute('download', `${type}_report_${timestamp}.${format === 'excel' ? 'xlsx' : format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(`Error downloading ${type} report:`, error);
    } finally {
      setDownloading(prev => ({ ...prev, [type]: false }));
    }
  };

  useEffect(() => {
    fetchReport(activeTab);
  }, [activeTab, filters]);

  const renderTable = (data, type) => {
    if (!data || data.length === 0) {
      return (
        <Alert variant="info" className="text-center">
          No data available for the selected period.
        </Alert>
      );
    }

    const getColumns = () => {
      switch (type) {
        case 'loans':
          return [
            { key: 'id', label: 'Loan ID' },
            { key: 'userName', label: 'User Name' },
            { key: 'userEmail', label: 'Email' },
            { key: 'amountRequested', label: 'Requested' },
            { key: 'amountApproved', label: 'Approved' },
            { key: 'status', label: 'Status' },
            { key: 'createdAt', label: 'Created Date' }
          ];
        case 'payments':
          return [
            { key: 'id', label: 'Payment ID' },
            { key: 'userName', label: 'User Name' },
            { key: 'type', label: 'Type' },
            { key: 'amount', label: 'Amount' },
            { key: 'method', label: 'Method' },
            { key: 'status', label: 'Status' },
            { key: 'createdAt', label: 'Date' }
          ];
        case 'bills':
          return [
            { key: 'id', label: 'Bill ID' },
            { key: 'userName', label: 'User Name' },
            { key: 'type', label: 'Type' },
            { key: 'amount', label: 'Amount' },
            { key: 'status', label: 'Status' },
            { key: 'dueDate', label: 'Due Date' },
            { key: 'paidAt', label: 'Paid At' }
          ];
        case 'withdrawals':
          return [
            { key: 'id', label: 'Withdrawal ID' },
            { key: 'userName', label: 'User Name' },
            { key: 'amount', label: 'Amount' },
            { key: 'status', label: 'Status' },
            { key: 'bankName', label: 'Bank' },
            { key: 'decidedAt', label: 'Decided At' },
            { key: 'createdAt', label: 'Created Date' }
          ];
        default:
          return [];
      }
    };

    const columns = getColumns();

    return (
      <div className="table-responsive">
        <Table striped bordered hover>
          <thead className="table-dark">
            <tr>
              {columns.map(col => (
                <th key={col.key}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.slice(0, 100).map((item, index) => (
              <tr key={index}>
                {columns.map(col => (
                  <td key={col.key}>
                    {col.key === 'amount' || col.key === 'amountRequested' || col.key === 'amountApproved'
                      ? `₹${item[col.key] || 0}`
                      : item[col.key] || 'N/A'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </Table>
        {data.length > 100 && (
          <Alert variant="warning" className="mt-3">
            Showing first 100 records. Use export to get all data.
          </Alert>
        )}
      </div>
    );
  };

  return (
    <Container fluid>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="mb-0">Reports</h2>
      </div>

      {/* Filters */}
      <Card className="mb-4">
        <Card.Body>
          <Row className="g-3">
            <Col md={3}>
              <Form.Group>
                <Form.Label>Start Date</Form.Label>
                <Form.Control
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                />
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group>
                <Form.Label>End Date</Form.Label>
                <Form.Control
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                />
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group>
                <Form.Label>Format</Form.Label>
                <Form.Select
                  value={filters.format}
                  onChange={(e) => setFilters(prev => ({ ...prev, format: e.target.value }))}
                >
                  <option value="json">JSON</option>
                  <option value="csv">CSV</option>
                  <option value="excel">Excel</option>
                  <option value="pdf">PDF</option>
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={3} className="d-flex align-items-end">
              <Button
                variant="outline-primary"
                onClick={() => fetchReport(activeTab)}
                disabled={loading}
              >
                {loading ? <Spinner size="sm" /> : <Calendar size={16} />}
                {' '}Apply Filters
              </Button>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Report Type Tabs */}
      <Row className="mb-4">
        {reportTypes.map(({ key, label, icon: Icon, color }) => (
          <Col md={3} key={key}>
            <Card
              className={`cursor-pointer ${activeTab === key ? `border-${color}` : ''}`}
              onClick={() => setActiveTab(key)}
              style={{ cursor: 'pointer' }}
            >
              <Card.Body className="text-center">
                <Icon size={32} className={`text-${color} mb-2`} />
                <h6>{label}</h6>
                <small className="text-muted">
                  {reports[key]?.length || 0} records
                </small>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Report Content */}
      <Card>
        <Card.Header className="d-flex justify-content-between align-items-center">
          <h5 className="mb-0">
            {reportTypes.find(r => r.key === activeTab)?.label}
          </h5>
          <div className="d-flex gap-2">
            <Button
              variant="outline-success"
              size="sm"
              onClick={() => downloadReport(activeTab, 'csv')}
              disabled={downloading[activeTab]}
            >
              {downloading[activeTab] ? <Spinner size="sm" /> : <Download size={16} />}
              {' '}CSV
            </Button>
            <Button
              variant="outline-primary"
              size="sm"
              onClick={() => downloadReport(activeTab, 'excel')}
              disabled={downloading[activeTab]}
            >
              {downloading[activeTab] ? <Spinner size="sm" /> : <Download size={16} />}
              {' '}Excel
            </Button>
            <Button
              variant="outline-danger"
              size="sm"
              onClick={() => downloadReport(activeTab, 'pdf')}
              disabled={downloading[activeTab]}
            >
              {downloading[activeTab] ? <Spinner size="sm" /> : <Download size={16} />}
              {' '}PDF
            </Button>
          </div>
        </Card.Header>
        <Card.Body>
          {loading ? (
            <div className="text-center py-4">
              <Spinner animation="border" />
              <p className="mt-2">Loading report data...</p>
            </div>
          ) : (
            renderTable(reports[activeTab], activeTab)
          )}
        </Card.Body>
      </Card>
    </Container>
  );
}
