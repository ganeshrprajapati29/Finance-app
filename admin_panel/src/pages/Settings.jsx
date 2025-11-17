import { useState, useEffect } from 'react';
import { Form, Button, Card, Alert, Row, Col, Tab, Tabs, Spinner } from 'react-bootstrap';
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

  const [originalSettings, setOriginalSettings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const r = await api.get('/admin/settings');
      setSettings(r.data.data || r.data);
      setOriginalSettings(r.data.data || r.data);
    } catch (error) {
      console.error('Error loading settings:', error);
      setOriginalSettings(settings);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); 
    setLoading(true);
    try {
      await api.put('/admin/settings', settings);
      setMessage('✅ Settings updated successfully!');
      setMessageType('success');
      setOriginalSettings(settings);
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage('❌ Failed to update settings. Please try again.');
      setMessageType('danger');
    }
    setLoading(false);
  };

  const handleReset = () => {
    if (originalSettings) {
      setSettings(originalSettings);
      setMessage('🔄 Settings reset to last saved values');
      setMessageType('info');
      setTimeout(() => setMessage(''), 2000);
    }
  };

  const handleChange = (field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f5f7fa 0%, #e9ecef 100%)', padding: '40px 20px' }}>
      
      {/* Premium Header */}
      <div style={{ 
        background: 'linear-gradient(135deg, #001f5c 0%, #003d99 100%)',
        borderRadius: '16px',
        padding: '35px',
        marginBottom: '35px',
        boxShadow: '0 15px 50px rgba(0, 31, 92, 0.2)',
        color: 'white'
      }}>
        <Row className="align-items-center">
          <Col md={8}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{
                width: '70px',
                height: '70px',
                background: 'linear-gradient(135deg, #1abc9c 0%, #16a085 100%)',
                borderRadius: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '40px',
                fontWeight: 'bold',
                boxShadow: '0 10px 30px rgba(26, 188, 156, 0.3)'
              }}>
                ⚙️
              </div>
              <div>
                <h2 style={{ margin: 0, fontWeight: '700', fontSize: '28px' }}>System Settings</h2>
                <p style={{ margin: '8px 0 0 0', opacity: 0.9, fontSize: '14px' }}>KhatuPay - Configure Your Application</p>
              </div>
            </div>
          </Col>
        </Row>
      </div>

      {/* Alert Message */}
      {message && (
        <Alert 
          variant={messageType} 
          dismissible 
          onClose={() => setMessage('')}
          style={{
            marginBottom: '25px',
            borderRadius: '12px',
            border: 'none',
            boxShadow: '0 5px 20px rgba(0, 0, 0, 0.1)',
            fontWeight: '600'
          }}
        >
          {message}
        </Alert>
      )}

      {/* Main Form Card */}
      <Card style={{
        border: 'none',
        borderRadius: '16px',
        boxShadow: '0 15px 50px rgba(0, 31, 92, 0.1)',
        overflow: 'hidden'
      }}>
        <Card.Body style={{ padding: '0' }}>
          <Form onSubmit={handleSubmit}>
            <Tabs 
              defaultActiveKey="general" 
              className="mb-0"
              style={{
                borderBottom: '2px solid #dee2e6',
                background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
                padding: '0 20px'
              }}
            >
              {/* General Settings Tab */}
              <Tab 
                eventKey="general" 
                title="🏢 General Settings"
                style={{ padding: '0' }}
              >
                <div style={{ padding: '30px' }}>
                  <Row className="g-3">
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label style={{ fontWeight: '700', color: '#001f5c', marginBottom: '10px' }}>
                          📱 Application Name
                        </Form.Label>
                        <Form.Control
                          type="text"
                          value={settings.appName || ''}
                          onChange={(e) => handleChange('appName', e.target.value)}
                          placeholder="Enter application name"
                          style={{ 
                            borderRadius: '8px', 
                            border: '2px solid #dee2e6', 
                            padding: '10px 12px',
                            fontWeight: '500',
                            transition: 'border-color 0.3s'
                          }}
                          onFocus={(e) => e.target.style.borderColor = '#1abc9c'}
                          onBlur={(e) => e.target.style.borderColor = '#dee2e6'}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label style={{ fontWeight: '700', color: '#001f5c', marginBottom: '10px' }}>
                          🔢 Application Version
                        </Form.Label>
                        <Form.Control
                          type="text"
                          value={settings.appVersion || ''}
                          onChange={(e) => handleChange('appVersion', e.target.value)}
                          placeholder="e.g., 1.0.0"
                          style={{ 
                            borderRadius: '8px', 
                            border: '2px solid #dee2e6', 
                            padding: '10px 12px',
                            fontWeight: '500',
                            transition: 'border-color 0.3s'
                          }}
                          onFocus={(e) => e.target.style.borderColor = '#1abc9c'}
                          onBlur={(e) => e.target.style.borderColor = '#dee2e6'}
                        />
                      </Form.Group>
                    </Col>
                  </Row>

                  <Row className="g-3 mt-2">
                    <Col md={12}>
                      <Form.Group>
                        <Form.Label style={{ fontWeight: '700', color: '#001f5c', marginBottom: '10px' }}>
                          📧 Support Email
                        </Form.Label>
                        <Form.Control
                          type="email"
                          value={settings.supportEmail || ''}
                          onChange={(e) => handleChange('supportEmail', e.target.value)}
                          placeholder="support@example.com"
                          style={{ 
                            borderRadius: '8px', 
                            border: '2px solid #dee2e6', 
                            padding: '10px 12px',
                            fontWeight: '500',
                            transition: 'border-color 0.3s'
                          }}
                          onFocus={(e) => e.target.style.borderColor = '#1abc9c'}
                          onBlur={(e) => e.target.style.borderColor = '#dee2e6'}
                        />
                      </Form.Group>
                    </Col>
                  </Row>

                  <div style={{ marginTop: '30px', padding: '20px', background: 'linear-gradient(135deg, rgba(26, 188, 156, 0.1) 0%, rgba(22, 160, 133, 0.05) 100%)', borderRadius: '8px', border: '2px solid #1abc9c' }}>
                    <Form.Group style={{ margin: '0' }}>
                      <Form.Check
                        type="switch"
                        id="maintenance-mode"
                        label={
                          <span style={{ fontWeight: '600', color: '#001f5c', fontSize: '16px' }}>
                            🛠️ Enable Maintenance Mode
                          </span>
                        }
                        checked={settings.maintenanceMode || false}
                        onChange={(e) => handleChange('maintenanceMode', e.target.checked)}
                        style={{ cursor: 'pointer' }}
                      />
                      <Form.Text style={{ color: '#6c757d', marginTop: '8px', display: 'block', lineHeight: '1.6' }}>
                        When enabled, users will see a maintenance message and won't be able to access the application
                      </Form.Text>
                    </Form.Group>
                  </div>
                </div>
              </Tab>

              {/* Loan Settings Tab */}
              <Tab 
                eventKey="loans" 
                title="💰 Loan Settings"
                style={{ padding: '0' }}
              >
                <div style={{ padding: '30px' }}>
                  <div style={{ marginBottom: '30px', paddingBottom: '20px', borderBottom: '2px solid #dee2e6' }}>
                    <h5 style={{ color: '#001f5c', fontWeight: '700', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      💵 Loan Amount Configuration
                    </h5>
                    <Row className="g-3">
                      <Col md={6}>
                        <Form.Group>
                          <Form.Label style={{ fontWeight: '700', color: '#001f5c', marginBottom: '10px' }}>
                            📉 Minimum Loan Amount (₹)
                          </Form.Label>
                          <Form.Control
                            type="number"
                            value={settings.minLoanAmount || ''}
                            onChange={(e) => handleChange('minLoanAmount', parseInt(e.target.value) || 0)}
                            placeholder="1000"
                            style={{ 
                              borderRadius: '8px', 
                              border: '2px solid #dee2e6', 
                              padding: '10px 12px',
                              fontWeight: '500',
                              transition: 'border-color 0.3s'
                            }}
                            onFocus={(e) => e.target.style.borderColor = '#1abc9c'}
                            onBlur={(e) => e.target.style.borderColor = '#dee2e6'}
                          />
                          <Form.Text style={{ color: '#6c757d', marginTop: '5px', display: 'block' }}>
                            Minimum amount users can request
                          </Form.Text>
                        </Form.Group>
                      </Col>
                      <Col md={6}>
                        <Form.Group>
                          <Form.Label style={{ fontWeight: '700', color: '#001f5c', marginBottom: '10px' }}>
                            📈 Maximum Loan Amount (₹)
                          </Form.Label>
                          <Form.Control
                            type="number"
                            value={settings.maxLoanAmount || ''}
                            onChange={(e) => handleChange('maxLoanAmount', parseInt(e.target.value) || 0)}
                            placeholder="50000"
                            style={{ 
                              borderRadius: '8px', 
                              border: '2px solid #dee2e6', 
                              padding: '10px 12px',
                              fontWeight: '500',
                              transition: 'border-color 0.3s'
                            }}
                            onFocus={(e) => e.target.style.borderColor = '#1abc9c'}
                            onBlur={(e) => e.target.style.borderColor = '#dee2e6'}
                          />
                          <Form.Text style={{ color: '#6c757d', marginTop: '5px', display: 'block' }}>
                            Maximum amount users can request
                          </Form.Text>
                        </Form.Group>
                      </Col>
                    </Row>
                  </div>

                  <div>
                    <h5 style={{ color: '#001f5c', fontWeight: '700', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      📊 Loan Terms Configuration
                    </h5>
                    <Row className="g-3">
                      <Col md={6}>
                        <Form.Group>
                          <Form.Label style={{ fontWeight: '700', color: '#001f5c', marginBottom: '10px' }}>
                            📈 Interest Rate (% per annum)
                          </Form.Label>
                          <Form.Control
                            type="number"
                            step="0.1"
                            value={settings.interestRate || ''}
                            onChange={(e) => handleChange('interestRate', parseFloat(e.target.value) || 0)}
                            placeholder="12.5"
                            style={{ 
                              borderRadius: '8px', 
                              border: '2px solid #dee2e6', 
                              padding: '10px 12px',
                              fontWeight: '500',
                              transition: 'border-color 0.3s'
                            }}
                            onFocus={(e) => e.target.style.borderColor = '#1abc9c'}
                            onBlur={(e) => e.target.style.borderColor = '#dee2e6'}
                          />
                          <Form.Text style={{ color: '#6c757d', marginTop: '5px', display: 'block' }}>
                            Default APR for new loans (e.g., 12.5 for 12.5% per annum)
                          </Form.Text>
                        </Form.Group>
                      </Col>
                      <Col md={6}>
                        <Form.Group>
                          <Form.Label style={{ fontWeight: '700', color: '#001f5c', marginBottom: '10px' }}>
                            ⏱️ Default Loan Duration (Months)
                          </Form.Label>
                          <Form.Control
                            type="number"
                            value={settings.loanDuration || ''}
                            onChange={(e) => handleChange('loanDuration', parseInt(e.target.value) || 0)}
                            placeholder="12"
                            style={{ 
                              borderRadius: '8px', 
                              border: '2px solid #dee2e6', 
                              padding: '10px 12px',
                              fontWeight: '500',
                              transition: 'border-color 0.3s'
                            }}
                            onFocus={(e) => e.target.style.borderColor = '#1abc9c'}
                            onBlur={(e) => e.target.style.borderColor = '#dee2e6'}
                          />
                          <Form.Text style={{ color: '#6c757d', marginTop: '5px', display: 'block' }}>
                            Default tenure for new loans (in months)
                          </Form.Text>
                        </Form.Group>
                      </Col>
                    </Row>
                  </div>

                  {/* Quick Info Card */}
                  <div style={{ marginTop: '30px', padding: '20px', background: 'linear-gradient(135deg, rgba(26, 188, 156, 0.1) 0%, rgba(22, 160, 133, 0.05) 100%)', borderRadius: '12px', border: '2px solid #1abc9c' }}>
                    <h6 style={{ color: '#001f5c', fontWeight: '700', marginBottom: '12px' }}>💡 Current Configuration Summary</h6>
                    <Row>
                      <Col md={6}>
                        <div style={{ marginBottom: '8px' }}>
                          <small style={{ color: '#6c757d' }}>Loan Range: </small>
                          <strong style={{ color: '#1abc9c' }}>₹{(settings.minLoanAmount || 0).toLocaleString()} - ₹{(settings.maxLoanAmount || 0).toLocaleString()}</strong>
                        </div>
                      </Col>
                      <Col md={6}>
                        <div>
                          <small style={{ color: '#6c757d' }}>Rate & Duration: </small>
                          <strong style={{ color: '#1abc9c' }}>{settings.interestRate || 0}% APR for {settings.loanDuration || 0} months</strong>
                        </div>
                      </Col>
                    </Row>
                  </div>
                </div>
              </Tab>

              {/* Notifications Tab */}
              <Tab 
                eventKey="notifications" 
                title="🔔 Notification Settings"
                style={{ padding: '0' }}
              >
                <div style={{ padding: '30px' }}>
                  <h5 style={{ color: '#001f5c', fontWeight: '700', marginBottom: '25px' }}>Configure Notification Channels</h5>

                  {/* FCM Push Notifications */}
                  <div style={{ marginBottom: '25px', padding: '20px', background: 'linear-gradient(135deg, rgba(23, 162, 184, 0.1) 0%, rgba(20, 130, 155, 0.05) 100%)', borderRadius: '12px', border: '2px solid #17a2b8' }}>
                    <Form.Group style={{ margin: '0' }}>
                      <Form.Check
                        type="switch"
                        id="fcm-enabled"
                        label={
                          <span style={{ fontWeight: '600', color: '#001f5c', fontSize: '16px' }}>
                            🔔 FCM Push Notifications
                          </span>
                        }
                        checked={settings.fcmEnabled || false}
                        onChange={(e) => handleChange('fcmEnabled', e.target.checked)}
                        style={{ cursor: 'pointer', margin: '0' }}
                      />
                      <Form.Text style={{ color: '#6c757d', marginTop: '8px', display: 'block', lineHeight: '1.6' }}>
                        Enable Firebase Cloud Messaging for instant push notifications on mobile and web. Users will receive real-time alerts.
                      </Form.Text>
                    </Form.Group>
                  </div>

                  {/* Email Notifications */}
                  <div style={{ marginBottom: '25px', padding: '20px', background: 'linear-gradient(135deg, rgba(40, 167, 69, 0.1) 0%, rgba(32, 130, 55, 0.05) 100%)', borderRadius: '12px', border: '2px solid #28a745' }}>
                    <Form.Group style={{ margin: '0' }}>
                      <Form.Check
                        type="switch"
                        id="email-enabled"
                        label={
                          <span style={{ fontWeight: '600', color: '#001f5c', fontSize: '16px' }}>
                            📧 Email Notifications
                          </span>
                        }
                        checked={settings.emailEnabled || false}
                        onChange={(e) => handleChange('emailEnabled', e.target.checked)}
                        style={{ cursor: 'pointer', margin: '0' }}
                      />
                      <Form.Text style={{ color: '#6c757d', marginTop: '8px', display: 'block', lineHeight: '1.6' }}>
                        Send important updates and notifications via email to user mailboxes. This is ideal for detailed information.
                      </Form.Text>
                    </Form.Group>
                  </div>

                  {/* SMS Notifications */}
                  <div style={{ marginBottom: '0', padding: '20px', background: 'linear-gradient(135deg, rgba(255, 193, 7, 0.1) 0%, rgba(255, 152, 0, 0.05) 100%)', borderRadius: '12px', border: '2px solid #ffc107' }}>
                    <Form.Group style={{ margin: '0' }}>
                      <Form.Check
                        type="switch"
                        id="sms-enabled"
                        label={
                          <span style={{ fontWeight: '600', color: '#001f5c', fontSize: '16px' }}>
                            📱 SMS Notifications
                          </span>
                        }
                        checked={settings.smsEnabled || false}
                        onChange={(e) => handleChange('smsEnabled', e.target.checked)}
                        style={{ cursor: 'pointer', margin: '0' }}
                      />
                      <Form.Text style={{ color: '#6c757d', marginTop: '8px', display: 'block', lineHeight: '1.6' }}>
                        Send time-sensitive notifications via SMS to user mobile numbers. Perfect for urgent alerts and reminders.
                      </Form.Text>
                    </Form.Group>
                  </div>

                  {/* Status Summary */}
                  <div style={{ marginTop: '30px', padding: '20px', background: '#f8f9fa', borderRadius: '12px', border: '1px solid #dee2e6' }}>
                    <h6 style={{ color: '#001f5c', fontWeight: '700', marginBottom: '15px' }}>📋 Notification Channels Status</h6>
                    <Row>
                      <Col md={4}>
                        <div style={{ textAlign: 'center', paddingBottom: '12px', borderRight: '1px solid #dee2e6' }}>
                          <div style={{ fontSize: '24px', marginBottom: '8px' }}>{settings.fcmEnabled ? '✅' : '❌'}</div>
                          <small style={{ color: '#6c757d', fontWeight: '600' }}>Push Notifications</small>
                        </div>
                      </Col>
                      <Col md={4}>
                        <div style={{ textAlign: 'center', paddingBottom: '12px', borderRight: '1px solid #dee2e6' }}>
                          <div style={{ fontSize: '24px', marginBottom: '8px' }}>{settings.emailEnabled ? '✅' : '❌'}</div>
                          <small style={{ color: '#6c757d', fontWeight: '600' }}>Email</small>
                        </div>
                      </Col>
                      <Col md={4}>
                        <div style={{ textAlign: 'center', paddingBottom: '12px' }}>
                          <div style={{ fontSize: '24px', marginBottom: '8px' }}>{settings.smsEnabled ? '✅' : '❌'}</div>
                          <small style={{ color: '#6c757d', fontWeight: '600' }}>SMS</small>
                        </div>
                      </Col>
                    </Row>
                  </div>
                </div>
              </Tab>
            </Tabs>

            {/* Submit Button Section */}
            <div style={{ padding: '25px', background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)', borderTop: '2px solid #dee2e6', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <Button 
                variant="light" 
                onClick={handleReset}
                style={{ 
                  borderRadius: '8px', 
                  fontWeight: '700',
                  padding: '10px 25px',
                  border: '2px solid #dee2e6',
                  color: '#001f5c'
                }}
              >
                🔄 Reset
              </Button>
              <Button 
                type="submit" 
                disabled={loading}
                style={{ 
                  background: 'linear-gradient(135deg, #1abc9c 0%, #16a085 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '700',
                  padding: '10px 30px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: 'white'
                }}
              >
                {loading ? (
                  <>
                    <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" />
                    Saving...
                  </>
                ) : (
                  <>
                    💾 Save Settings
                  </>
                )}
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>
    </div>
  );
}