import { useState, useEffect } from 'react';
import { Card, Row, Col, Button, Alert, Spinner, Form, Table, Badge } from 'react-bootstrap';
import axios from '../api/axios';

const ClubAPISettings = () => {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    clubapiToken: '',
    tokenConfigured: false,
    baseUrl: 'https://api.clubapi.in',
    callbackUrl: 'https://khatupay.com/api/callback/clubapi',
    callbackId: '',
    enabled: true,
    timeout: 30000,
    retryAttempts: 3,
    billFetchEnabled: true,
    billPaymentEnabled: true,
    mobileRechargeEnabled: true,
    dthRechargeEnabled: true
  });
  const [outletForm, setOutletForm] = useState({
    outletMobile: '',
    name: '',
    aadhaarNumber: '',
    pan: '',
    shopName: '',
    shopAddress: '',
    city: '',
    state: '',
    pincode: '',
    bankAccountNumber: '',
    bankIfscCode: '',
    latitude: '',
    longitude: '',
    email: '',
    otp: '',
    otpSessionId: ''
  });
  const [outletLoading, setOutletLoading] = useState(null);
  const [outletResult, setOutletResult] = useState(null);
  const [bankForm, setBankForm] = useState({
    customerMobile: '',
    accountNumber: '',
    ifscCode: ''
  });
  const [bankLoading, setBankLoading] = useState(false);
  const [bankResult, setBankResult] = useState(null);
  const [payoutForm, setPayoutForm] = useState({
    amount: '',
    outletMobile: '',
    customerMobile: '',
    bankAccountNumber: '',
    bankIfscCode: '',
    beneficiaryName: ''
  });
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [payoutResult, setPayoutResult] = useState(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get('/admin/clubapi/settings');
      const data = response.data?.data || response.data;
      const nextSettings = {
        clubapiToken: data.tokenConfigured ? 'Configured in VPS env' : '',
        tokenConfigured: !!data.tokenConfigured,
        baseUrl: data.baseUrl || 'https://api.clubapi.in',
        callbackUrl: data.callbackUrl || 'https://khatupay.com/api/callback/clubapi',
        callbackId: data.callbackId || '',
        enabled: data.enabled !== false,
        timeout: data.timeout || 30000,
        retryAttempts: data.retryAttempts ?? 3,
        billFetchEnabled: data.billFetchEnabled !== false,
        billPaymentEnabled: data.billPaymentEnabled !== false,
        mobileRechargeEnabled: data.mobileRechargeEnabled !== false,
        dthRechargeEnabled: data.dthRechargeEnabled !== false
      };
      setSettings(nextSettings);
      setFormData(nextSettings);
    } catch (err) {
      console.error('Error fetching settings:', err);
      setError(err.response?.data?.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const response = await axios.put('/admin/clubapi/settings', {
        enabled: formData.enabled,
        baseUrl: formData.baseUrl,
        callbackUrl: formData.callbackUrl,
        callbackId: formData.callbackId,
        timeout: Number(formData.timeout || 30000),
        retryAttempts: Number(formData.retryAttempts || 0),
        billFetchEnabled: formData.billFetchEnabled,
        billPaymentEnabled: formData.billPaymentEnabled,
        mobileRechargeEnabled: formData.mobileRechargeEnabled,
        dthRechargeEnabled: formData.dthRechargeEnabled
      });
      const data = response.data?.data || response.data;
      const nextSettings = {
        ...formData,
        ...data,
        clubapiToken: data.tokenConfigured ? 'Configured in VPS env' : '',
        tokenConfigured: !!data.tokenConfigured
      };
      setSettings(nextSettings);
      setFormData(nextSettings);
      setSuccess('ClubAPI callback settings saved successfully');
    } catch (err) {
      console.error('Error saving settings:', err);
      setError(err.response?.data?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const testConnection = async () => {
    try {
      setError(null);
      setSuccess(null);
      const response = await axios.post('/admin/clubapi/settings/test');
      const data = response.data?.data || response.data;
      const callbackOk = Number(data.callbackStatus) >= 200 && Number(data.callbackStatus) < 300;
      setSuccess(`Connection OK. Balance: ${data.balanceStatus || 'SUCCESS'}, Callback: ${callbackOk ? 'Live' : data.callbackStatus || 'Failed'}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Connection test failed');
    }
  };

  const handleOutletChange = (field, value) => {
    setOutletForm(prev => ({ ...prev, [field]: value }));
  };

  const runOutletAction = async (action) => {
    try {
      setOutletLoading(action);
      setError(null);
      setSuccess(null);
      setOutletResult(null);
      const endpoint = action === 'register'
        ? '/admin/clubapi/outlet/register'
        : action === 'verify'
          ? '/admin/clubapi/outlet/verify-otp'
          : '/admin/clubapi/outlet/status';
      const payload = action === 'status'
        ? { outletMobile: outletForm.outletMobile }
        : action === 'verify'
          ? {
              outletMobile: outletForm.outletMobile,
              aadhaarNumber: outletForm.aadhaarNumber,
              otp: outletForm.otp,
              otpSessionId: outletForm.otpSessionId,
              latitude: outletForm.latitude,
              longitude: outletForm.longitude
            }
          : outletForm;
      const response = await axios.post(endpoint, payload);
      const data = response.data?.data || response.data;
      setOutletResult(data);
      const sessionId = data?.otpSessionId || data?.sessionId || data?.requestId || data?.urid || data?.data?.otpSessionId;
      if (sessionId) handleOutletChange('otpSessionId', String(sessionId));
      setSuccess(action === 'register' ? 'Outlet OTP request sent' : action === 'verify' ? 'Outlet OTP verified' : 'Outlet status fetched');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Outlet request failed');
    } finally {
      setOutletLoading(null);
    }
  };

  const handleBankChange = (field, value) => {
    setBankForm(prev => ({ ...prev, [field]: field === 'ifscCode' ? value.toUpperCase() : value }));
  };

  const validateBankAccount = async () => {
    try {
      setBankLoading(true);
      setError(null);
      setSuccess(null);
      setBankResult(null);
      const response = await axios.post('/admin/clubapi/bank/validate', bankForm);
      const data = response.data?.data || response.data;
      setBankResult(data);
      const name = data?.accountName || data?.beneficiaryName;
      setSuccess(name ? `Bank account verified: ${name}` : 'Bank validation response received');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Bank validation failed');
    } finally {
      setBankLoading(false);
    }
  };

  const handlePayoutChange = (field, value) => {
    setPayoutForm(prev => ({ ...prev, [field]: field === 'bankIfscCode' ? value.toUpperCase() : value }));
  };

  const validatePayoutBank = async () => {
    try {
      setPayoutLoading(true);
      setError(null);
      setSuccess(null);
      const response = await axios.post('/admin/clubapi/bank/validate', {
        customerMobile: payoutForm.customerMobile,
        accountNumber: payoutForm.bankAccountNumber,
        ifscCode: payoutForm.bankIfscCode
      });
      const data = response.data?.data || response.data;
      const name = data?.accountName || data?.beneficiaryName || '';
      if (name) handlePayoutChange('beneficiaryName', name);
      setPayoutResult(data);
      setSuccess(name ? `Payout bank verified: ${name}` : 'Bank validation response received');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Payout bank validation failed');
    } finally {
      setPayoutLoading(false);
    }
  };

  const submitPayout = async () => {
    if (!window.confirm(`Send payout of Rs. ${payoutForm.amount} to ${payoutForm.beneficiaryName || payoutForm.bankAccountNumber}?`)) return;
    try {
      setPayoutLoading(true);
      setError(null);
      setSuccess(null);
      setPayoutResult(null);
      const response = await axios.post('/admin/clubapi/payout', {
        amount: payoutForm.amount,
        outletMobile: payoutForm.outletMobile,
        mobile: payoutForm.bankAccountNumber,
        bankAccountNumber: payoutForm.bankAccountNumber,
        bankIfscCode: payoutForm.bankIfscCode,
        beneficiaryName: payoutForm.beneficiaryName
      });
      const data = response.data?.data || response.data;
      setPayoutResult(data);
      setSuccess(data?.resText || 'Payout request submitted');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Payout failed');
    } finally {
      setPayoutLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <Spinner animation="border" style={{ color: '#1abc9c' }} />
      </div>
    );
  }

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
        <h2 style={{ margin: 0, fontWeight: '700' }}>Club API Settings</h2>
        <p style={{ margin: '8px 0 0 0', opacity: 0.9 }}>Configure Club API integration settings</p>
      </div>

      {/* Alerts */}
      {error && <Alert variant="danger" dismissible onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert variant="success" dismissible onClose={() => setSuccess(null)}>{success}</Alert>}

      <Row>
        <Col lg={8}>
          <Card style={{ border: 'none', borderRadius: '12px', boxShadow: '0 5px 20px rgba(0, 31, 92, 0.1)' }}>
            <Card.Header style={{ background: '#1abc9c', color: 'white', fontWeight: '700' }}>
              API Configuration
            </Card.Header>
            <Card.Body>
              <Row className="g-3">
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Club API Token</Form.Label>
                    <Form.Control
                      type="password"
                      value={formData.clubapiToken}
                      disabled
                      placeholder="Configured in VPS env"
                    />
                    <Form.Text>{formData.tokenConfigured ? 'Token is active from backend environment.' : 'Token is not configured on backend.'}</Form.Text>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Base URL</Form.Label>
                    <Form.Control
                      type="url"
                      value={formData.baseUrl}
                      onChange={(e) => handleInputChange('baseUrl', e.target.value)}
                      placeholder="https://api.clubapi.com/v1"
                    />
                  </Form.Group>
                </Col>
                <Col md={8}>
                  <Form.Group>
                    <Form.Label>Callback URL</Form.Label>
                    <Form.Control
                      type="url"
                      value={formData.callbackUrl}
                      onChange={(e) => handleInputChange('callbackUrl', e.target.value)}
                      placeholder="https://khatupay.com/api/callback/clubapi"
                    />
                    <Form.Text>Use this exact URL in ClubAPI merchant dashboard callback settings.</Form.Text>
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>Callback ID</Form.Label>
                    <Form.Control
                      value={formData.callbackId}
                      onChange={(e) => handleInputChange('callbackId', e.target.value)}
                      placeholder="cbId from ClubAPI"
                    />
                    <Form.Text>Save ClubAPI callback ID here after creating it.</Form.Text>
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>Timeout (ms)</Form.Label>
                    <Form.Control
                      type="number"
                      value={formData.timeout}
                      onChange={(e) => handleInputChange('timeout', parseInt(e.target.value))}
                    />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>Retry Attempts</Form.Label>
                    <Form.Control
                      type="number"
                      min="0"
                      max="5"
                      value={formData.retryAttempts}
                      onChange={(e) => handleInputChange('retryAttempts', parseInt(e.target.value))}
                    />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>Status</Form.Label>
                    <div className="d-flex align-items-center" style={{ paddingTop: '8px' }}>
                      <Form.Check
                        type="switch"
                        id="enabled-switch"
                        checked={formData.enabled}
                        onChange={(e) => handleInputChange('enabled', e.target.checked)}
                        label={formData.enabled ? 'Enabled' : 'Disabled'}
                      />
                    </div>
                  </Form.Group>
                </Col>
              </Row>
            </Card.Body>
          </Card>

          <Card style={{ border: 'none', borderRadius: '12px', boxShadow: '0 5px 20px rgba(0, 31, 92, 0.1)', marginTop: '35px' }}>
            <Card.Header style={{ background: '#1abc9c', color: 'white', fontWeight: '700' }}>
              Service Configuration
            </Card.Header>
            <Card.Body>
              <Row className="g-3">
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Bill Fetch</Form.Label>
                    <div className="d-flex align-items-center">
                      <Form.Check
                        type="switch"
                        id="bill-fetch-switch"
                        checked={formData.billFetchEnabled}
                        onChange={(e) => handleInputChange('billFetchEnabled', e.target.checked)}
                        label={formData.billFetchEnabled ? 'Enabled' : 'Disabled'}
                      />
                    </div>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Bill Payment</Form.Label>
                    <div className="d-flex align-items-center">
                      <Form.Check
                        type="switch"
                        id="bill-payment-switch"
                        checked={formData.billPaymentEnabled}
                        onChange={(e) => handleInputChange('billPaymentEnabled', e.target.checked)}
                        label={formData.billPaymentEnabled ? 'Enabled' : 'Disabled'}
                      />
                    </div>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Mobile Recharge</Form.Label>
                    <div className="d-flex align-items-center">
                      <Form.Check
                        type="switch"
                        id="mobile-recharge-switch"
                        checked={formData.mobileRechargeEnabled}
                        onChange={(e) => handleInputChange('mobileRechargeEnabled', e.target.checked)}
                        label={formData.mobileRechargeEnabled ? 'Enabled' : 'Disabled'}
                      />
                    </div>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>DTH Recharge</Form.Label>
                    <div className="d-flex align-items-center">
                      <Form.Check
                        type="switch"
                        id="dth-recharge-switch"
                        checked={formData.dthRechargeEnabled}
                        onChange={(e) => handleInputChange('dthRechargeEnabled', e.target.checked)}
                        label={formData.dthRechargeEnabled ? 'Enabled' : 'Disabled'}
                      />
                    </div>
                  </Form.Group>
                </Col>
              </Row>
            </Card.Body>
          </Card>

          <Card style={{ border: 'none', borderRadius: '12px', boxShadow: '0 5px 20px rgba(0, 31, 92, 0.1)', marginTop: '35px' }}>
            <Card.Header style={{ background: '#0f766e', color: 'white', fontWeight: '700' }}>
              Bank Account Validate
            </Card.Header>
            <Card.Body>
              <Row className="g-3">
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>Customer Mobile</Form.Label>
                    <Form.Control
                      value={bankForm.customerMobile}
                      maxLength={10}
                      onChange={(e) => handleBankChange('customerMobile', e.target.value)}
                      placeholder="10 digit mobile"
                    />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>Account Number</Form.Label>
                    <Form.Control
                      value={bankForm.accountNumber}
                      onChange={(e) => handleBankChange('accountNumber', e.target.value)}
                      placeholder="Bank account number"
                    />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>IFSC Code</Form.Label>
                    <Form.Control
                      value={bankForm.ifscCode}
                      onChange={(e) => handleBankChange('ifscCode', e.target.value)}
                      placeholder="IFSC"
                    />
                  </Form.Group>
                </Col>
              </Row>
              <Button
                variant="success"
                onClick={validateBankAccount}
                disabled={bankLoading}
                style={{ marginTop: '18px' }}
              >
                {bankLoading ? <Spinner animation="border" size="sm" /> : 'Validate Account Name'}
              </Button>
              {bankResult && (
                <Alert variant={bankResult.isValid ? 'success' : 'info'} style={{ marginTop: '18px' }}>
                  <strong>{bankResult.accountName || bankResult.beneficiaryName || 'Name not returned'}</strong>
                  <div>{bankResult.resText || 'ClubAPI response received'}</div>
                </Alert>
              )}
            </Card.Body>
          </Card>

          <Card style={{ border: 'none', borderRadius: '12px', boxShadow: '0 5px 20px rgba(0, 31, 92, 0.1)', marginTop: '35px' }}>
            <Card.Header style={{ background: '#001f5c', color: 'white', fontWeight: '700' }}>
              Outlet Registration
            </Card.Header>
            <Card.Body>
              <Row className="g-3">
                {[
                  ['outletMobile', 'Outlet Mobile'],
                  ['name', 'Owner Name'],
                  ['aadhaarNumber', 'Aadhaar Number'],
                  ['pan', 'PAN Number'],
                  ['shopName', 'Shop Name'],
                  ['shopAddress', 'Shop Address'],
                  ['city', 'City'],
                  ['state', 'State'],
                  ['pincode', 'Pincode'],
                  ['bankAccountNumber', 'Bank Account Number'],
                  ['bankIfscCode', 'IFSC Code'],
                  ['latitude', 'Latitude'],
                  ['longitude', 'Longitude'],
                  ['email', 'Email']
                ].map(([field, label]) => (
                  <Col md={field === 'shopAddress' ? 12 : 6} key={field}>
                    <Form.Group>
                      <Form.Label>{label}</Form.Label>
                      <Form.Control
                        value={outletForm[field]}
                        onChange={(e) => handleOutletChange(field, e.target.value)}
                        placeholder={label}
                      />
                    </Form.Group>
                  </Col>
                ))}
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>OTP</Form.Label>
                    <Form.Control
                      value={outletForm.otp}
                      onChange={(e) => handleOutletChange('otp', e.target.value)}
                      placeholder="OTP"
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>OTP Session ID</Form.Label>
                    <Form.Control
                      value={outletForm.otpSessionId}
                      onChange={(e) => handleOutletChange('otpSessionId', e.target.value)}
                      placeholder="Optional"
                    />
                  </Form.Group>
                </Col>
              </Row>
              <div style={{ marginTop: '20px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <Button variant="primary" onClick={() => runOutletAction('register')} disabled={!!outletLoading}>
                  {outletLoading === 'register' ? <Spinner animation="border" size="sm" /> : 'Send OTP'}
                </Button>
                <Button variant="outline-success" onClick={() => runOutletAction('verify')} disabled={!!outletLoading}>
                  {outletLoading === 'verify' ? <Spinner animation="border" size="sm" /> : 'Verify OTP'}
                </Button>
                <Button variant="outline-info" onClick={() => runOutletAction('status')} disabled={!!outletLoading}>
                  {outletLoading === 'status' ? <Spinner animation="border" size="sm" /> : 'Outlet Status'}
                </Button>
              </div>
              {outletResult && (
                <pre style={{ marginTop: '18px', background: '#f8f9fa', padding: '12px', borderRadius: '8px', whiteSpace: 'pre-wrap' }}>
                  {JSON.stringify(outletResult, null, 2)}
                </pre>
              )}
            </Card.Body>
          </Card>

          <Card style={{ border: 'none', borderRadius: '12px', boxShadow: '0 5px 20px rgba(0, 31, 92, 0.1)', marginTop: '35px' }}>
            <Card.Header style={{ background: '#6f42c1', color: 'white', fontWeight: '700' }}>
              Payout API
            </Card.Header>
            <Card.Body>
              <Row className="g-3">
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>Amount</Form.Label>
                    <Form.Control
                      type="number"
                      value={payoutForm.amount}
                      onChange={(e) => handlePayoutChange('amount', e.target.value)}
                      placeholder="Amount"
                    />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>Outlet Mobile</Form.Label>
                    <Form.Control
                      value={payoutForm.outletMobile}
                      maxLength={10}
                      onChange={(e) => handlePayoutChange('outletMobile', e.target.value)}
                      placeholder="Outlet mobile"
                    />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>Customer Mobile</Form.Label>
                    <Form.Control
                      value={payoutForm.customerMobile}
                      maxLength={10}
                      onChange={(e) => handlePayoutChange('customerMobile', e.target.value)}
                      placeholder="10 digit mobile"
                    />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>Account Number</Form.Label>
                    <Form.Control
                      value={payoutForm.bankAccountNumber}
                      onChange={(e) => handlePayoutChange('bankAccountNumber', e.target.value)}
                      placeholder="Bank account number"
                    />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>IFSC</Form.Label>
                    <Form.Control
                      value={payoutForm.bankIfscCode}
                      onChange={(e) => handlePayoutChange('bankIfscCode', e.target.value)}
                      placeholder="IFSC"
                    />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>Beneficiary Name</Form.Label>
                    <Form.Control
                      value={payoutForm.beneficiaryName}
                      onChange={(e) => handlePayoutChange('beneficiaryName', e.target.value)}
                      placeholder="Account holder name"
                    />
                  </Form.Group>
                </Col>
              </Row>
              <div style={{ marginTop: '18px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <Button variant="outline-success" onClick={validatePayoutBank} disabled={payoutLoading}>
                  {payoutLoading ? <Spinner animation="border" size="sm" /> : 'Validate Name'}
                </Button>
                <Button variant="danger" onClick={submitPayout} disabled={payoutLoading}>
                  {payoutLoading ? <Spinner animation="border" size="sm" /> : 'Send Payout'}
                </Button>
              </div>
              {payoutResult && (
                <pre style={{ marginTop: '18px', background: '#f8f9fa', padding: '12px', borderRadius: '8px', whiteSpace: 'pre-wrap' }}>
                  {JSON.stringify(payoutResult, null, 2)}
                </pre>
              )}
            </Card.Body>
          </Card>

          <div style={{ marginTop: '35px', display: 'flex', gap: '15px' }}>
            <Button
              variant="primary"
              size="lg"
              onClick={handleSave}
              disabled={saving}
              style={{ borderRadius: '12px', padding: '12px 30px' }}
            >
              {saving ? <Spinner animation="border" size="sm" /> : '💾'} {saving ? 'Saving...' : 'Save Settings'}
            </Button>
            <Button
              variant="outline-info"
              size="lg"
              onClick={testConnection}
              style={{ borderRadius: '12px', padding: '12px 30px' }}
            >
              🔗 Test Connection
            </Button>
          </div>
        </Col>

        <Col lg={4}>
          {/* Status Card */}
          <Card style={{ border: 'none', borderRadius: '12px', boxShadow: '0 5px 20px rgba(0, 31, 92, 0.1)' }}>
            <Card.Header style={{ background: '#001f5c', color: 'white', fontWeight: '700' }}>
              System Status
            </Card.Header>
            <Card.Body>
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                  <Badge bg={formData.enabled ? 'success' : 'danger'} style={{ marginRight: '10px' }}>
                    {formData.enabled ? '●' : '●'}
                  </Badge>
                  <span>API Integration: {formData.enabled ? 'Active' : 'Inactive'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                  <Badge bg={formData.clubapiToken ? 'success' : 'warning'} style={{ marginRight: '10px' }}>
                    {formData.clubapiToken ? '●' : '●'}
                  </Badge>
                  <span>API Token: {formData.clubapiToken ? 'Configured' : 'Not Set'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <Badge bg="info" style={{ marginRight: '10px' }}>●</Badge>
                  <span>Last Updated: Just now</span>
                </div>
              </div>
            </Card.Body>
          </Card>

          {/* Quick Stats */}
          <Card style={{ border: 'none', borderRadius: '12px', boxShadow: '0 5px 20px rgba(0, 31, 92, 0.1)', marginTop: '35px' }}>
            <Card.Header style={{ background: '#1abc9c', color: 'white', fontWeight: '700' }}>
              Quick Stats
            </Card.Header>
            <Card.Body>
              <Table borderless size="sm">
                <tbody>
                  <tr>
                    <td>Total Transactions:</td>
                    <td className="text-end"><strong>1,245</strong></td>
                  </tr>
                  <tr>
                    <td>Success Rate:</td>
                    <td className="text-end"><strong>94.2%</strong></td>
                  </tr>
                  <tr>
                    <td>Avg Response Time:</td>
                    <td className="text-end"><strong>2.3s</strong></td>
                  </tr>
                  <tr>
                    <td>Active Services:</td>
                    <td className="text-end"><strong>4/4</strong></td>
                  </tr>
                </tbody>
              </Table>
            </Card.Body>
          </Card>

          {/* Service Status */}
          <Card style={{ border: 'none', borderRadius: '12px', boxShadow: '0 5px 20px rgba(0, 31, 92, 0.1)', marginTop: '35px' }}>
            <Card.Header style={{ background: '#ffc107', color: 'black', fontWeight: '700' }}>
              Service Status
            </Card.Header>
            <Card.Body>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Bill Fetch</span>
                  <Badge bg={formData.billFetchEnabled ? 'success' : 'secondary'}>
                    {formData.billFetchEnabled ? 'Active' : 'Disabled'}
                  </Badge>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Bill Payment</span>
                  <Badge bg={formData.billPaymentEnabled ? 'success' : 'secondary'}>
                    {formData.billPaymentEnabled ? 'Active' : 'Disabled'}
                  </Badge>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Mobile Recharge</span>
                  <Badge bg={formData.mobileRechargeEnabled ? 'success' : 'secondary'}>
                    {formData.mobileRechargeEnabled ? 'Active' : 'Disabled'}
                  </Badge>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>DTH Recharge</span>
                  <Badge bg={formData.dthRechargeEnabled ? 'success' : 'secondary'}>
                    {formData.dthRechargeEnabled ? 'Active' : 'Disabled'}
                  </Badge>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default ClubAPISettings;
