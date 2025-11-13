import { useState, useEffect } from 'react';
import { Form, Button, Card, Alert, Row, Col, Tab, Tabs } from 'react-bootstrap';
import api from '../api/axios';

export default function Settings() {
  const [settings, setSettings] = useState({
    appName: 'Khatu Pay',
    appVersion: '1.0.0',
    supportEmail: 'support@khatupay.com',
    maintenanceMode: false,
    maxLoanAmount: 50000,
    minLoanAmount: 1000,
    interestRate: 12.5,
    loanDuration: 12,
    fcmEnabled: false,
    emailEnabled: true,
    smsEnabled: false
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  useEffect(() => {
    // Load current settings
    api.get('/admin/settings')
      .then((r) => setSettings(r.data))
      .catch(() => {
        // Use default settings if API fails
      });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault(); 
    setLoading(true);
    try {
      await api.put('/admin/settings', settings);
      setMessage('Settings updated successfully!');
      setMessageType('success');
    } catch (error) {
      setMessage('Failed to update settings');
      setMessageType('danger');
    }
    setLoading(false);
  };

  const handleChange = (field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div>
      <h3 className="mb-4">System Settings</h3>

      {message && (
        <Alert variant={messageType} dismissible onClose={() => setMessage('')}>
          {message}
        </Alert>
      )}

      <Form onSubmit={handleSubmit}>
        <Tabs defaultActiveKey="general" className="mb-4">
          <Tab eventKey="general" title="General">
            <Card>
              <Card.Header>
                <h5 className="mb-0">General Settings</h5>
              </Card.Header>
              <Card.Body>
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Application Name</Form.Label>
                      <Form.Control
                        type="text"
                        value={settings.appName}
                        onChange={(e) => handleChange('appName', e.target.value)}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Application Version</Form.Label>
                      <Form.Control
                        type="text"
                        value={settings.appVersion}
                        onChange={(e) => handleChange('appVersion', e.target.value)}
                      />
                    </Form.Group>
                  </Col>
                </Row>

                <Form.Group className="mb-3">
                  <Form.Label>Support Email</Form.Label>
                  <Form.Control
                    type="email"
                    value={settings.supportEmail}
                    onChange={(e) => handleChange('supportEmail', e.target.value)}
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Check
                    type="switch"
                    id="maintenance-mode"
                    label="Maintenance Mode"
                    checked={settings.maintenanceMode}
                    onChange={(e) => handleChange('maintenanceMode', e.target.checked)}
                  />
                  <Form.Text className="text-muted">
                    Enable maintenance mode to temporarily disable user access
                  </Form.Text>
                </Form.Group>
              </Card.Body>
            </Card>
          </Tab>

          <Tab eventKey="loans" title="Loan Settings">
            <Card>
              <Card.Header>
                <h5 className="mb-0">Loan Configuration</h5>
              </Card.Header>
              <Card.Body>
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Minimum Loan Amount (₹)</Form.Label>
                      <Form.Control
                        type="number"
                        value={settings.minLoanAmount}
                        onChange={(e) => handleChange('minLoanAmount', parseInt(e.target.value))}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Maximum Loan Amount (₹)</Form.Label>
                      <Form.Control
                        type="number"
                        value={settings.maxLoanAmount}
                        onChange={(e) => handleChange('maxLoanAmount', parseInt(e.target.value))}
                      />
                    </Form.Group>
                  </Col>
                </Row>

                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Interest Rate (%)</Form.Label>
                      <Form.Control
                        type="number"
                        step="0.1"
                        value={settings.interestRate}
                        onChange={(e) => handleChange('interestRate', parseFloat(e.target.value))}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Default Loan Duration (Months)</Form.Label>
                      <Form.Control
                        type="number"
                        value={settings.loanDuration}
                        onChange={(e) => handleChange('loanDuration', parseInt(e.target.value))}
                      />
                    </Form.Group>
                  </Col>
                </Row>
              </Card.Body>
            </Card>
          </Tab>

          <Tab eventKey="notifications" title="Notifications">
            <Card>
              <Card.Header>
                <h5 className="mb-0">Notification Settings</h5>
              </Card.Header>
              <Card.Body>
                <Form.Group className="mb-3">
                  <Form.Check
                    type="switch"
                    id="fcm-enabled"
                    label="Enable FCM Push Notifications"
                    checked={settings.fcmEnabled}
                    onChange={(e) => handleChange('fcmEnabled', e.target.checked)}
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Check
                    type="switch"
                    id="email-enabled"
                    label="Enable Email Notifications"
                    checked={settings.emailEnabled}
                    onChange={(e) => handleChange('emailEnabled', e.target.checked)}
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Check
                    type="switch"
                    id="sms-enabled"
                    label="Enable SMS Notifications"
                    checked={settings.smsEnabled}
                    onChange={(e) => handleChange('smsEnabled', e.target.checked)}
                  />
                </Form.Group>
              </Card.Body>
            </Card>
          </Tab>
        </Tabs>

        <div className="d-flex justify-content-end">
          <Button type="submit" disabled={loading}>
            {loading ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </Form>
    </div>
  );
}
