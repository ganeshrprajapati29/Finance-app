import { useState, useEffect } from 'react';
import { Form, Button, Card, Alert, Row, Col, Spinner } from 'react-bootstrap';
import api from '../api/axios.js';

export default function Profile() {
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    mobile: ''
  });
  const [originalProfile, setOriginalProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const r = await api.get('/admin/profile');
      const data = r.data.data || r.data;
      setProfile(data);
      setOriginalProfile(data);
    } catch (error) {
      console.error('Error loading profile:', error);
      setMessage('❌ Failed to load profile');
      setMessageType('danger');
    } finally {
      setFetchLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await api.put('/admin/profile', profile);
      setMessage('✅ Profile updated successfully!');
      setMessageType('success');
      setOriginalProfile(profile);
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Failed to update profile';
      setMessage('❌ ' + errorMsg);
      setMessageType('danger');
    }
    setLoading(false);
  };

  const handleReset = () => {
    if (originalProfile) {
      setProfile(originalProfile);
      setMessage('🔄 Profile reset to last saved values');
      setMessageType('info');
      setTimeout(() => setMessage(''), 2000);
    }
  };

  const handleChange = (field, value) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  if (fetchLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
      </div>
    );
  }

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
                👤
              </div>
              <div>
                <h2 style={{ margin: 0, fontWeight: '700', fontSize: '28px' }}>Edit Profile</h2>
                <p style={{ margin: '8px 0 0 0', opacity: 0.9, fontSize: '14px' }}>KhatuPay - Update Your Personal Information</p>
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
        <Card.Body style={{ padding: '40px' }}>
          <Form onSubmit={handleSubmit}>
            <Row className="g-4">
              {/* Full Name */}
              <Col md={12}>
                <Form.Group>
                  <Form.Label style={{ fontWeight: '700', color: '#001f5c', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    👤 Full Name
                  </Form.Label>
                  <Form.Control
                    type="text"
                    value={profile.name || ''}
                    onChange={(e) => handleChange('name', e.target.value)}
                    placeholder="Enter your full name"
                    required
                    style={{
                      borderRadius: '8px',
                      border: '2px solid #dee2e6',
                      padding: '12px 14px',
                      fontWeight: '500',
                      fontSize: '16px',
                      transition: 'border-color 0.3s'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#1abc9c'}
                    onBlur={(e) => e.target.style.borderColor = '#dee2e6'}
                  />
                  <Form.Text style={{ color: '#6c757d', marginTop: '5px', display: 'block' }}>
                    Your display name that will be shown in the system
                  </Form.Text>
                </Form.Group>
              </Col>

              {/* Email Address */}
              <Col md={6}>
                <Form.Group>
                  <Form.Label style={{ fontWeight: '700', color: '#001f5c', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    📧 Email Address
                  </Form.Label>
                  <Form.Control
                    type="email"
                    value={profile.email || ''}
                    onChange={(e) => handleChange('email', e.target.value)}
                    placeholder="your.email@example.com"
                    required
                    style={{
                      borderRadius: '8px',
                      border: '2px solid #dee2e6',
                      padding: '12px 14px',
                      fontWeight: '500',
                      fontSize: '16px',
                      transition: 'border-color 0.3s'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#1abc9c'}
                    onBlur={(e) => e.target.style.borderColor = '#dee2e6'}
                  />
                  <Form.Text style={{ color: '#6c757d', marginTop: '5px', display: 'block' }}>
                    Your primary email address for notifications
                  </Form.Text>
                </Form.Group>
              </Col>

              {/* Mobile Number */}
              <Col md={6}>
                <Form.Group>
                  <Form.Label style={{ fontWeight: '700', color: '#001f5c', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    📱 Mobile Number
                  </Form.Label>
                  <Form.Control
                    type="tel"
                    value={profile.mobile || ''}
                    onChange={(e) => handleChange('mobile', e.target.value)}
                    placeholder="Enter 10-digit mobile number"
                    pattern="[6-9][0-9]{9}"
                    style={{
                      borderRadius: '8px',
                      border: '2px solid #dee2e6',
                      padding: '12px 14px',
                      fontWeight: '500',
                      fontSize: '16px',
                      transition: 'border-color 0.3s'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#1abc9c'}
                    onBlur={(e) => e.target.style.borderColor = '#dee2e6'}
                  />
                  <Form.Text style={{ color: '#6c757d', marginTop: '5px', display: 'block' }}>
                    Optional: Your mobile number for SMS notifications
                  </Form.Text>
                </Form.Group>
              </Col>
            </Row>

            {/* Submit Button Section */}
            <div style={{ marginTop: '40px', paddingTop: '30px', borderTop: '2px solid #dee2e6', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <Button
                variant="light"
                onClick={handleReset}
                style={{
                  borderRadius: '8px',
                  fontWeight: '700',
                  padding: '12px 25px',
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
                  padding: '12px 30px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: 'white'
                }}
              >
                {loading ? (
                  <>
                    <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" />
                    Updating...
                  </>
                ) : (
                  <>
                    💾 Update Profile
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
