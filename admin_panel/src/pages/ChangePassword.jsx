import { useState } from 'react';
import { Form, Button, Card, Alert, Row, Col, Spinner, ProgressBar } from 'react-bootstrap';
import api from '../api/axios.js';

export default function ChangePassword() {
  const [formData, setFormData] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [showPassword, setShowPassword] = useState({
    old: false,
    new: false,
    confirm: false
  });

  const getPasswordStrength = (password) => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^a-zA-Z\d]/.test(password)) strength++;
    return strength;
  };

  const passwordStrength = getPasswordStrength(formData.newPassword);
  
  const getStrengthLabel = (strength) => {
    const labels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];
    const colors = ['danger', 'warning', 'info', 'warning', 'success'];
    return { label: labels[strength], color: colors[strength] };
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.oldPassword.trim()) {
      setMessage('❌ Please enter your current password');
      setMessageType('danger');
      return;
    }

    if (!formData.newPassword.trim()) {
      setMessage('❌ Please enter a new password');
      setMessageType('danger');
      return;
    }

    if (formData.newPassword.length < 8) {
      setMessage('❌ New password must be at least 8 characters long');
      setMessageType('danger');
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setMessage('❌ New passwords do not match');
      setMessageType('danger');
      return;
    }

    if (formData.oldPassword === formData.newPassword) {
      setMessage('❌ New password must be different from current password');
      setMessageType('danger');
      return;
    }

    setLoading(true);
    try {
      await api.put('/admin/change-password', {
        oldPassword: formData.oldPassword,
        newPassword: formData.newPassword
      });
      setMessage('✅ Password changed successfully!');
      setMessageType('success');
      setFormData({ oldPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage('❌ ' + (error.response?.data?.message || 'Failed to change password'));
      setMessageType('danger');
    }
    setLoading(false);
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
                🔐
              </div>
              <div>
                <h2 style={{ margin: 0, fontWeight: '700', fontSize: '28px' }}>Change Password</h2>
                <p style={{ margin: '8px 0 0 0', opacity: 0.9, fontSize: '14px' }}>KhatuPay - Secure Your Account</p>
              </div>
            </div>
          </Col>
        </Row>
      </div>

      {/* Alert Message */}
      {message && (
        <Row className="mb-4">
          <Col md={{ span: 6, offset: 3 }}>
            <Alert 
              variant={messageType} 
              dismissible 
              onClose={() => setMessage('')}
              style={{
                borderRadius: '12px',
                border: 'none',
                boxShadow: '0 5px 20px rgba(0, 0, 0, 0.1)',
                fontWeight: '600'
              }}
            >
              {message}
            </Alert>
          </Col>
        </Row>
      )}

      {/* Main Form Card */}
      <Row className="justify-content-center">
        <Col md={6}>
          <Card style={{
            border: 'none',
            borderRadius: '16px',
            boxShadow: '0 15px 50px rgba(0, 31, 92, 0.1)',
            overflow: 'hidden'
          }}>
            <Card.Header style={{ background: 'linear-gradient(135deg, #001f5c 0%, #003d99 100%)', color: 'white', padding: '20px', fontWeight: '700', fontSize: '16px', borderBottom: 'none' }}>
              🔑 Update Your Password
            </Card.Header>
            <Card.Body style={{ padding: '30px', background: '#f8f9fa' }}>
              <Form onSubmit={handleSubmit}>
                {/* Current Password */}
                <Form.Group className="mb-4">
                  <Form.Label style={{ fontWeight: '700', color: '#001f5c', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    🔓 Current Password
                  </Form.Label>
                  <div style={{ position: 'relative' }}>
                    <Form.Control
                      type={showPassword.old ? 'text' : 'password'}
                      name="oldPassword"
                      value={formData.oldPassword}
                      onChange={handleChange}
                      placeholder="Enter your current password"
                      required
                      style={{ 
                        borderRadius: '8px', 
                        border: '2px solid #dee2e6', 
                        padding: '10px 40px 10px 12px',
                        fontWeight: '500',
                        transition: 'border-color 0.3s'
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#1abc9c'}
                      onBlur={(e) => e.target.style.borderColor = '#dee2e6'}
                    />
                    <Button
                      type="button"
                      variant="link"
                      onClick={() => setShowPassword({ ...showPassword, old: !showPassword.old })}
                      style={{
                        position: 'absolute',
                        right: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        border: 'none',
                        padding: '0',
                        color: '#1abc9c'
                      }}
                    >
                      {showPassword.old ? '👁️' : '👁️‍🗨️'}
                    </Button>
                  </div>
                  <Form.Text style={{ color: '#6c757d', marginTop: '5px', display: 'block' }}>
                    Enter the password you currently use to log in
                  </Form.Text>
                </Form.Group>

                {/* Divider */}
                <div style={{ borderTop: '2px solid #dee2e6', margin: '20px 0 25px 0' }}></div>

                {/* New Password */}
                <Form.Group className="mb-4">
                  <Form.Label style={{ fontWeight: '700', color: '#001f5c', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    🆕 New Password
                  </Form.Label>
                  <div style={{ position: 'relative' }}>
                    <Form.Control
                      type={showPassword.new ? 'text' : 'password'}
                      name="newPassword"
                      value={formData.newPassword}
                      onChange={handleChange}
                      placeholder="Create a strong password"
                      required
                      style={{ 
                        borderRadius: '8px', 
                        border: '2px solid #dee2e6', 
                        padding: '10px 40px 10px 12px',
                        fontWeight: '500',
                        transition: 'border-color 0.3s'
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#1abc9c'}
                      onBlur={(e) => e.target.style.borderColor = '#dee2e6'}
                    />
                    <Button
                      type="button"
                      variant="link"
                      onClick={() => setShowPassword({ ...showPassword, new: !showPassword.new })}
                      style={{
                        position: 'absolute',
                        right: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        border: 'none',
                        padding: '0',
                        color: '#1abc9c'
                      }}
                    >
                      {showPassword.new ? '👁️' : '👁️‍🗨️'}
                    </Button>
                  </div>
                  
                  {/* Password Strength Indicator */}
                  {formData.newPassword && (
                    <div style={{ marginTop: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <small style={{ color: '#6c757d', fontWeight: '600' }}>Password Strength:</small>
                        <small style={{ color: '#6c757d', fontWeight: '600' }}>
                          <span style={{ color: getStrengthLabel(passwordStrength).color === 'danger' ? '#dc3545' : getStrengthLabel(passwordStrength).color === 'warning' ? '#ffc107' : getStrengthLabel(passwordStrength).color === 'info' ? '#17a2b8' : '#28a745' }}>
                            {getStrengthLabel(passwordStrength).label}
                          </span>
                        </small>
                      </div>
                      <ProgressBar 
                        now={(passwordStrength + 1) * 20} 
                        variant={getStrengthLabel(passwordStrength).color}
                        style={{ height: '8px', borderRadius: '4px' }}
                      />
                    </div>
                  )}

                  <Form.Text style={{ color: '#6c757d', marginTop: '8px', display: 'block', lineHeight: '1.6' }}>
                    ✓ Minimum 8 characters<br/>
                    ✓ Mix of uppercase and lowercase letters<br/>
                    ✓ At least one number<br/>
                    ✓ At least one special character (!@#$%^&*)
                  </Form.Text>
                </Form.Group>

                {/* Confirm Password */}
                <Form.Group className="mb-4">
                  <Form.Label style={{ fontWeight: '700', color: '#001f5c', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    ✔️ Confirm New Password
                  </Form.Label>
                  <div style={{ position: 'relative' }}>
                    <Form.Control
                      type={showPassword.confirm ? 'text' : 'password'}
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      placeholder="Re-enter your new password"
                      required
                      style={{ 
                        borderRadius: '8px', 
                        border: formData.confirmPassword && formData.newPassword !== formData.confirmPassword ? '2px solid #dc3545' : '2px solid #dee2e6', 
                        padding: '10px 40px 10px 12px',
                        fontWeight: '500',
                        transition: 'border-color 0.3s'
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#1abc9c'}
                      onBlur={(e) => e.target.style.borderColor = formData.confirmPassword && formData.newPassword !== formData.confirmPassword ? '#dc3545' : '#dee2e6'}
                    />
                    <Button
                      type="button"
                      variant="link"
                      onClick={() => setShowPassword({ ...showPassword, confirm: !showPassword.confirm })}
                      style={{
                        position: 'absolute',
                        right: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        border: 'none',
                        padding: '0',
                        color: '#1abc9c'
                      }}
                    >
                      {showPassword.confirm ? '👁️' : '👁️‍🗨️'}
                    </Button>
                  </div>
                  {formData.confirmPassword && formData.newPassword === formData.confirmPassword && (
                    <Form.Text style={{ color: '#28a745', marginTop: '5px', display: 'block', fontWeight: '600' }}>
                      ✅ Passwords match
                    </Form.Text>
                  )}
                  {formData.confirmPassword && formData.newPassword !== formData.confirmPassword && (
                    <Form.Text style={{ color: '#dc3545', marginTop: '5px', display: 'block', fontWeight: '600' }}>
                      ❌ Passwords do not match
                    </Form.Text>
                  )}
                </Form.Group>

                {/* Submit Button */}
                <Button 
                  type="submit" 
                  disabled={loading || (formData.confirmPassword && formData.newPassword !== formData.confirmPassword)}
                  className="w-100"
                  style={{ 
                    background: 'linear-gradient(135deg, #1abc9c 0%, #16a085 100%)',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: '700',
                    padding: '12px 20px',
                    fontSize: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    marginTop: '10px'
                  }}
                >
                  {loading ? (
                    <>
                      <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" />
                      Changing Password...
                    </>
                  ) : (
                    <>
                      🔄 Change Password
                    </>
                  )}
                </Button>
              </Form>

              {/* Security Tips */}
              <div style={{ marginTop: '25px', padding: '15px', background: 'linear-gradient(135deg, rgba(26, 188, 156, 0.1) 0%, rgba(22, 160, 133, 0.05) 100%)', borderRadius: '8px', border: '2px solid #1abc9c' }}>
                <h6 style={{ color: '#001f5c', fontWeight: '700', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  🛡️ Security Tips
                </h6>
                <ul style={{ margin: '0', paddingLeft: '20px', color: '#6c757d', fontSize: '13px', lineHeight: '1.8' }}>
                  <li>Never share your password with anyone</li>
                  <li>Use a unique password not used elsewhere</li>
                  <li>Avoid using personal information in passwords</li>
                  <li>Change your password regularly (every 3 months)</li>
                  <li>Use a password manager to store passwords securely</li>
                </ul>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
}