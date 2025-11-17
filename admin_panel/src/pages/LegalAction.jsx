import { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Table, Modal, Form, Alert, Badge, Spinner } from 'react-bootstrap';
import { Gavel, Mail, MessageSquare, AlertTriangle, Send, Eye, CheckCircle, XCircle } from 'lucide-react';
import { Tabs, Tab } from 'react-bootstrap';
import api from '../api/axios';

export default function LegalAction() {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionData, setActionData] = useState({
    actionType: '',
    noticeType: 'warning',
    message: '',
    sendEmail: true,
    sendSMS: true,
    language: 'english'
  });
  const [submitting, setSubmitting] = useState(false);
  const [legalActions, setLegalActions] = useState([]);

  const fetchDefaultedLoans = async () => {
    setLoading(true);
    try {
      const response = await api.get('/admin/settlements/loans/defaulted');
      setLoans(response.data.data);
    } catch (error) {
      console.error('Error fetching defaulted loans:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLegalActions = async () => {
    try {
      const response = await api.get('/admin/settlements/legal-actions');
      setLegalActions(response.data.data);
    } catch (error) {
      console.error('Error fetching legal actions:', error);
    }
  };

  const handleLegalAction = async () => {
    if (!actionData.actionType || !actionData.message) {
      alert('Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    try {
      const response = await api.post(`/admin/settlements/loans/${selectedLoan._id}/legal-action`, {
        actionType: actionData.actionType,
        noticeType: actionData.noticeType,
        message: actionData.message,
        sendEmail: actionData.sendEmail,
        sendSMS: actionData.sendSMS,
        language: actionData.language
      });

      if (response.data.success) {
        alert('Legal action initiated successfully!');
        setShowActionModal(false);
        setActionData({
          actionType: '',
          noticeType: 'warning',
          message: '',
          sendEmail: true,
          sendSMS: true,
          language: 'english'
        });
        setSelectedLoan(null);
        fetchLegalActions();
      } else {
        alert('Failed to initiate legal action: ' + (response.data.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error initiating legal action:', error);
      alert('Failed to initiate legal action: ' + (error.response?.data?.message || error.message));
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'defaulted':
        return <Badge bg="danger">Defaulted</Badge>;
      case 'legal_notice_sent':
        return <Badge bg="warning">Legal Notice Sent</Badge>;
      case 'court_case':
        return <Badge bg="dark">Court Case</Badge>;
      default:
        return <Badge bg="secondary">{status}</Badge>;
    }
  };

  const getActionBadge = (actionType) => {
    switch (actionType) {
      case 'warning_notice':
        return <Badge bg="warning">Warning Notice</Badge>;
      case 'legal_notice':
        return <Badge bg="danger">Legal Notice</Badge>;
      case 'court_notice':
        return <Badge bg="dark">Court Notice</Badge>;
      default:
        return <Badge bg="secondary">{actionType}</Badge>;
    }
  };

  const calculateDaysOverdue = (dueDate) => {
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = today - due;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const getDefaultMessage = (actionType, language) => {
    const messages = {
      english: {
        warning_notice: `Dear Customer,

This is a WARNING NOTICE regarding your outstanding loan with Khatu Pay.

Loan Details:
- Outstanding Amount: ₹${selectedLoan?.outstandingAmount || 0}
- Days Overdue: ${calculateDaysOverdue(selectedLoan?.nextPaymentDate)}

You are required to clear your outstanding dues immediately to avoid further legal action.

Please contact us at support@khatupay.com or call our helpline.

Regards,
Khatu Pay Legal Team`,

        legal_notice: `LEGAL NOTICE

To: ${selectedLoan?.userId?.name || 'Customer'}

This is a formal LEGAL NOTICE under the provisions of applicable laws.

You have defaulted on your loan agreement with Khatu Pay. Despite multiple reminders, you have failed to make payments.

Outstanding Amount: ₹${selectedLoan?.outstandingAmount || 0}
Days Overdue: ${calculateDaysOverdue(selectedLoan?.nextPaymentDate)}

Legal action will be initiated if payment is not received within 15 days of this notice.

Regards,
Khatu Pay Legal Department`,

        court_notice: `COURT NOTICE

FORMAL NOTICE OF LEGAL PROCEEDINGS

To: ${selectedLoan?.userId?.name || 'Customer'}

This is to inform you that legal proceedings have been initiated against you for defaulting on your loan agreement.

Court Case Details:
- Outstanding Amount: ₹${selectedLoan?.outstandingAmount || 0}
- Case will be filed under relevant consumer protection and financial laws.

You are advised to contact our legal department immediately to resolve this matter.

Regards,
Khatu Pay Legal Counsel`
      },
      hindi: {
        warning_notice: `प्रिय ग्राहक,

यह खातु पे के साथ आपके बकाया ऋण के संबंध में एक चेतावनी नोटिस है।

ऋण विवरण:
- बकाया राशि: ₹${selectedLoan?.outstandingAmount || 0}
- अतिदेय दिन: ${calculateDaysOverdue(selectedLoan?.nextPaymentDate)}

आगे की कानूनी कार्रवाई से बचने के लिए आपको तुरंत अपनी बकाया राशि चुकानी होगी।

कृपया हमसे support@khatupay.com पर संपर्क करें या हमारी हेल्पलाइन पर कॉल करें।

सादर,
खातु पे कानूनी टीम`,

        legal_notice: `कानूनी नोटिस

को: ${selectedLoan?.userId?.name || 'ग्राहक'}

यह लागू कानूनों के प्रावधानों के तहत एक औपचारिक कानूनी नोटिस है।

आपने खातु पे के साथ अपने ऋण समझौते में चूक की है। कई रिमाइंडर के बावजूद, आप भुगतान करने में विफल रहे हैं।

बकाया राशि: ₹${selectedLoan?.outstandingAmount || 0}
अतिदेय दिन: ${calculateDaysOverdue(selectedLoan?.nextPaymentDate)}

यदि इस नोटिस की प्राप्ति के 15 दिनों के भीतर भुगतान नहीं प्राप्त होता है तो कानूनी कार्रवाई शुरू की जाएगी।

सादर,
खातु पे कानूनी विभाग`,

        court_notice: `कोर्ट नोटिस

कानूनी कार्यवाही की औपचारिक सूचना

को: ${selectedLoan?.userId?.name || 'ग्राहक'}

यह आपको सूचित करने के लिए है कि आपके ऋण समझौते में चूक करने के लिए आपके खिलाफ कानूनी कार्यवाही शुरू की गई है।

कोर्ट केस विवरण:
- बकाया राशि: ₹${selectedLoan?.outstandingAmount || 0}
- मामला प्रासंगिक उपभोक्ता संरक्षण और वित्तीय कानूनों के तहत दर्ज किया जाएगा।

इस मामले को हल करने के लिए आपको तुरंत हमारे कानूनी विभाग से संपर्क करने की सलाह दी जाती है।

सादर,
खातु पे कानूनी सलाहकार`
      }
    };

    return messages[language]?.[actionType] || '';
  };

  useEffect(() => {
    fetchDefaultedLoans();
    fetchLegalActions();
  }, []);

  useEffect(() => {
    if (selectedLoan && actionData.actionType) {
      const defaultMessage = getDefaultMessage(actionData.actionType, actionData.language);
      setActionData(prev => ({ ...prev, message: defaultMessage }));
    }
  }, [selectedLoan, actionData.actionType, actionData.language]);

  return (
    <Container fluid>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="mb-0">Legal Actions</h2>
        <Button variant="primary" onClick={() => { fetchDefaultedLoans(); fetchLegalActions(); }} disabled={loading}>
          {loading ? <Spinner size="sm" /> : <AlertTriangle size={16} />}
          {' '}Refresh
        </Button>
      </div>

      <Tabs defaultActiveKey="loans" className="mb-4">
        <Tab eventKey="loans" title="All Users with Loans">
          <Card>
            <Card.Header>
              <h5 className="mb-0">All Users with Loans</h5>
              <small className="text-muted">Users who have taken loans - can initiate legal action</small>
            </Card.Header>
            <Card.Body>
              {loading ? (
                <div className="text-center py-4">
                  <Spinner animation="border" />
                  <p className="mt-2">Loading loans...</p>
                </div>
              ) : loans.length === 0 ? (
                <Alert variant="info" className="text-center">
                  No loans found.
                </Alert>
              ) : (
                <div className="table-responsive">
                  <Table striped bordered hover>
                    <thead className="table-dark">
                      <tr>
                        <th>Loan ID</th>
                        <th>User</th>
                        <th>Loan Amount</th>
                        <th>Outstanding</th>
                        <th>Status</th>
                        <th>Days Overdue</th>
                        <th>Last Payment</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loans.map((loan) => (
                        <tr key={loan._id}>
                          <td>{loan._id.slice(-8)}</td>
                          <td>
                            <div>
                              <strong>{loan.userId?.name || 'N/A'}</strong>
                              <br />
                              <small className="text-muted">{loan.userId?.email || 'N/A'}</small>
                              <br />
                              <small className="text-muted">{loan.userId?.mobile || 'N/A'}</small>
                            </div>
                          </td>
                          <td>₹{loan.decision?.amountApproved || 0}</td>
                          <td>₹{loan.outstandingAmount || 0}</td>
                          <td>{getStatusBadge(loan.status)}</td>
                          <td>
                            <span className={calculateDaysOverdue(loan.nextPaymentDate) > 30 ? 'text-danger fw-bold' : 'text-warning fw-bold'}>
                              {calculateDaysOverdue(loan.nextPaymentDate)} days
                            </span>
                          </td>
                          <td>
                            {loan.lastPaymentDate ? new Date(loan.lastPaymentDate).toLocaleDateString() : 'Never'}
                          </td>
                          <td>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => {
                                setSelectedLoan(loan);
                                setShowActionModal(true);
                              }}
                            >
                              <Gavel size={14} />
                              {' '}Legal Action
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}
            </Card.Body>
          </Card>
        </Tab>

        <Tab eventKey="actions" title="Legal Action History">
          <Card>
            <Card.Header>
              <h5 className="mb-0">Legal Action History</h5>
              <small className="text-muted">All legal actions taken against loans</small>
            </Card.Header>
            <Card.Body>
              {legalActions.length === 0 ? (
                <Alert variant="info" className="text-center">
                  No legal actions taken yet.
                </Alert>
              ) : (
                <div className="table-responsive">
                  <Table striped bordered hover>
                    <thead className="table-dark">
                      <tr>
                        <th>Action ID</th>
                        <th>User</th>
                        <th>Loan ID</th>
                        <th>Action Type</th>
                        <th>Status</th>
                        <th>Language</th>
                        <th>Email Sent</th>
                        <th>SMS Sent</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {legalActions.map((action) => (
                        <tr key={action._id}>
                          <td>{action._id.slice(-8)}</td>
                          <td>
                            <div>
                              <strong>{action.userId?.name || 'N/A'}</strong>
                              <br />
                              <small className="text-muted">{action.userId?.email || 'N/A'}</small>
                            </div>
                          </td>
                          <td>{action.loanId?._id?.slice(-8) || 'N/A'}</td>
                          <td>
                            <Badge bg="danger">{action.actionType.replace('_', ' ').toUpperCase()}</Badge>
                          </td>
                          <td>{getActionBadge(action.status)}</td>
                          <td>{action.language?.toUpperCase()}</td>
                          <td>
                            {action.emailSent ? (
                              <CheckCircle size={16} className="text-success" />
                            ) : (
                              <XCircle size={16} className="text-danger" />
                            )}
                          </td>
                          <td>
                            {action.smsSent ? (
                              <CheckCircle size={16} className="text-success" />
                            ) : (
                              <XCircle size={16} className="text-danger" />
                            )}
                          </td>
                          <td>{new Date(action.createdAt).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}
            </Card.Body>
          </Card>
        </Tab>
      </Tabs>

      {/* Legal Action Modal */}
      <Modal show={showActionModal} onHide={() => setShowActionModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Initiate Legal Action</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedLoan && (
            <div className="mb-3">
              <Alert variant="danger">
                <strong>Loan Details:</strong>
                <br />
                User: {selectedLoan.userId?.name} ({selectedLoan.userId?.email})
                <br />
                Outstanding: ₹{selectedLoan.outstandingAmount || 0}
                <br />
                Days Overdue: {calculateDaysOverdue(selectedLoan.nextPaymentDate)}
              </Alert>

              <Form>
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Action Type *</Form.Label>
                      <Form.Select
                        value={actionData.actionType}
                        onChange={(e) => setActionData(prev => ({ ...prev, actionType: e.target.value }))}
                        required
                      >
                        <option value="">Select action type</option>
                        <option value="warning_notice">Warning Notice</option>
                        <option value="legal_notice">Legal Notice</option>
                        <option value="court_notice">Court Notice</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Language</Form.Label>
                      <Form.Select
                        value={actionData.language}
                        onChange={(e) => setActionData(prev => ({ ...prev, language: e.target.value }))}
                      >
                        <option value="english">English</option>
                        <option value="hindi">Hindi</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                </Row>

                <Form.Group className="mb-3">
                  <Form.Label>Message *</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={8}
                    value={actionData.message}
                    onChange={(e) => setActionData(prev => ({ ...prev, message: e.target.value }))}
                    placeholder="Legal notice message"
                    required
                  />
                </Form.Group>

                <Row>
                  <Col md={6}>
                    <Form.Check
                      type="checkbox"
                      label="Send Email Notification"
                      checked={actionData.sendEmail}
                      onChange={(e) => setActionData(prev => ({ ...prev, sendEmail: e.target.checked }))}
                    />
                  </Col>
                  <Col md={6}>
                    <Form.Check
                      type="checkbox"
                      label="Send SMS Notification"
                      checked={actionData.sendSMS}
                      onChange={(e) => setActionData(prev => ({ ...prev, sendSMS: e.target.checked }))}
                    />
                  </Col>
                </Row>
              </Form>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowActionModal(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleLegalAction}
            disabled={submitting}
          >
            {submitting ? <Spinner size="sm" /> : <Send size={16} />}
            {' '}Initiate Legal Action
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
}
