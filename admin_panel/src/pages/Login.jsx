import { useState } from 'react'
import { Button, Card, Form, Container } from 'react-bootstrap'

export default function Login(){
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [showPolicy, setShowPolicy] = useState(false)

  const onSubmit = async (e)=>{
    e.preventDefault()
    setLoading(true); setErr('')
    try{
      const res = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Login failed')
      
      const { accessToken, refreshToken, user } = data.data
      if (!user.roles.includes('admin')) throw new Error('Not an admin user')
      localStorage.setItem('kp_tokens', JSON.stringify({ accessToken, refreshToken }))
      window.location.href = '/dashboard'
    }catch(e){ 
      setErr(e.message) 
    }
    finally{ 
      setLoading(false) 
    }
  }

  if (showPolicy) {
    return (
      <div style={{ 
        minHeight:'100vh', 
        background: 'linear-gradient(135deg, #0a1929 0%, #1a3a52 100%)',
        padding: '2rem 0'
      }}>
        <Container style={{ maxWidth: 800 }}>
          <Card style={{ 
            borderRadius: 20,
            border: 'none',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
          }}>
            <Card.Body className="p-4">
              <div className="d-flex justify-content-between align-items-center mb-4">
                <h3 style={{ color: '#0a1929', fontWeight: 700 }}>Privacy Policy</h3>
                <Button 
                  variant="link" 
                  onClick={() => setShowPolicy(false)}
                  style={{ color: '#20c997', fontSize: 24, textDecoration: 'none' }}
                >
                  ×
                </Button>
              </div>
              
              <div style={{ color: '#4a5568', lineHeight: 1.8 }}>
                <h5 style={{ color: '#0a1929', fontWeight: 600, marginTop: '1.5rem' }}>1. Information We Collect</h5>
                <p>We collect information you provide directly to us, including name, email address, phone number, and payment information when you use Khatu Pay services.</p>

                <h5 style={{ color: '#0a1929', fontWeight: 600, marginTop: '1.5rem' }}>2. How We Use Your Information</h5>
                <p>We use the information we collect to provide, maintain, and improve our services, process transactions, send you technical notices and support messages, and respond to your comments and questions.</p>

                <h5 style={{ color: '#0a1929', fontWeight: 600, marginTop: '1.5rem' }}>3. Information Sharing</h5>
                <p>We do not share your personal information with third parties except as described in this policy. We may share information with service providers who perform services on our behalf, and when required by law or to protect our rights.</p>

                <h5 style={{ color: '#0a1929', fontWeight: 600, marginTop: '1.5rem' }}>4. Data Security</h5>
                <p>We take reasonable measures to help protect your personal information from loss, theft, misuse, unauthorized access, disclosure, alteration, and destruction. All payment information is encrypted using industry-standard SSL technology.</p>

                <h5 style={{ color: '#0a1929', fontWeight: 600, marginTop: '1.5rem' }}>5. Your Rights</h5>
                <p>You have the right to access, update, or delete your personal information at any time. You may also opt out of receiving promotional communications from us.</p>

                <h5 style={{ color: '#0a1929', fontWeight: 600, marginTop: '1.5rem' }}>6. Contact Us</h5>
                <p>If you have any questions about this Privacy Policy, please contact us at support@khatupay.com</p>

                <p style={{ marginTop: '2rem', fontSize: '0.9rem', color: '#718096' }}>
                  Last updated: November 12, 2025
                </p>
              </div>

              <Button 
                onClick={() => setShowPolicy(false)}
                style={{
                  background: 'linear-gradient(135deg, #20c997 0%, #17a2b8 100%)',
                  border: 'none',
                  borderRadius: 10,
                  padding: '12px 40px',
                  fontWeight: 600,
                  marginTop: '2rem',
                  width: '100%'
                }}
              >
                Back to Login
              </Button>
            </Card.Body>
          </Card>
        </Container>
      </div>
    )
  }

  return (
    <div style={{ 
      minHeight:'100vh', 
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0a1929 0%, #1a3a52 100%)',
      padding: '2rem 1rem'
    }}>
      <Container>
        <div style={{ maxWidth: 480, margin: '0 auto' }}>
          {/* Logo Section */}
          <div className="text-center mb-4">
            <div style={{
              background: 'white',
              width: 100,
              height: 100,
              margin: '0 auto 1.5rem',
              borderRadius: 25,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{
                background: '#0a1929',
                width: 70,
                height: 70,
                borderRadius: 15,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative'
              }}>
                <span style={{ 
                  fontSize: 42, 
                  fontWeight: 900, 
                  color: '#20c997',
                  fontFamily: 'system-ui, -apple-system, sans-serif'
                }}>K</span>
                <div style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  width: 20,
                  height: 20,
                  background: '#20c997',
                  borderRadius: 4,
                  transform: 'rotate(15deg)'
                }}>
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    color: '#0a1929',
                    fontSize: 14,
                    fontWeight: 900
                  }}>₹</div>
                </div>
              </div>
            </div>
            <h2 style={{ 
              color: 'white', 
              fontWeight: 700,
              marginBottom: '0.5rem',
              fontSize: '2rem'
            }}>Khatu Pay</h2>
            <p style={{ 
              color: '#20c997', 
              fontSize: '1.1rem',
              fontWeight: 600,
              marginBottom: 0
            }}>Credit is Happiness</p>
          </div>

          {/* Login Card */}
          <Card style={{ 
            borderRadius: 20,
            border: 'none',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            background: 'rgba(255, 255, 255, 0.98)',
            backdropFilter: 'blur(10px)'
          }}>
            <Card.Body className="p-4">
              <div className="mb-4">
                <h4 style={{ 
                  color: '#0a1929', 
                  fontWeight: 700,
                  marginBottom: '0.5rem'
                }}>Admin Login</h4>
                <p style={{ color: '#718096', marginBottom: 0, fontSize: '0.95rem' }}>
                  Enter your credentials to access dashboard
                </p>
              </div>

              <Form onSubmit={onSubmit}>
                <Form.Group className="mb-3">
                  <Form.Label style={{ color: '#2d3748', fontWeight: 600, fontSize: '0.9rem' }}>
                    Email Address
                  </Form.Label>
                  <Form.Control 
                    type="email"
                    value={email} 
                    onChange={e=>setEmail(e.target.value)}
                    placeholder="admin@khatupay.com"
                    required
                    style={{
                      borderRadius: 10,
                      border: '2px solid #e2e8f0',
                      padding: '12px 16px',
                      fontSize: '0.95rem',
                      transition: 'all 0.3s'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#20c997'}
                    onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label style={{ color: '#2d3748', fontWeight: 600, fontSize: '0.9rem' }}>
                    Password
                  </Form.Label>
                  <Form.Control 
                    type="password" 
                    value={password} 
                    onChange={e=>setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    style={{
                      borderRadius: 10,
                      border: '2px solid #e2e8f0',
                      padding: '12px 16px',
                      fontSize: '0.95rem',
                      transition: 'all 0.3s'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#20c997'}
                    onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                  />
                </Form.Group>

                {err && (
                  <div style={{
                    background: '#fee',
                    border: '1px solid #fcc',
                    borderRadius: 8,
                    padding: '10px 14px',
                    marginBottom: '1rem',
                    color: '#c33',
                    fontSize: '0.9rem'
                  }}>
                    <strong>Error:</strong> {err}
                  </div>
                )}

                <Button 
                  type="submit" 
                  disabled={loading}
                  style={{
                    width: '100%',
                    background: loading ? '#cbd5e0' : 'linear-gradient(135deg, #20c997 0%, #17a2b8 100%)',
                    border: 'none',
                    borderRadius: 10,
                    padding: '14px',
                    fontWeight: 600,
                    fontSize: '1rem',
                    boxShadow: loading ? 'none' : '0 4px 15px rgba(32, 201, 151, 0.4)',
                    transition: 'all 0.3s',
                    cursor: loading ? 'not-allowed' : 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    if (!loading) {
                      e.target.style.transform = 'translateY(-2px)'
                      e.target.style.boxShadow = '0 6px 20px rgba(32, 201, 151, 0.5)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!loading) {
                      e.target.style.transform = 'translateY(0)'
                      e.target.style.boxShadow = '0 4px 15px rgba(32, 201, 151, 0.4)'
                    }
                  }}
                >
                  {loading ? (
                    <span>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Signing in...
                    </span>
                  ) : (
                    'Sign In'
                  )}
                </Button>

                <div className="text-center mt-4">
                  <Button 
                    variant="link" 
                    onClick={() => setShowPolicy(true)}
                    style={{
                      color: '#718096',
                      textDecoration: 'none',
                      fontSize: '0.9rem',
                      fontWeight: 500
                    }}
                    onMouseEnter={(e) => e.target.style.color = '#20c997'}
                    onMouseLeave={(e) => e.target.style.color = '#718096'}
                  >
                    Privacy Policy
                  </Button>
                </div>
              </Form>
            </Card.Body>
          </Card>

          {/* Footer */}
          <div className="text-center mt-4">
            <p style={{ 
              color: 'rgba(255,255,255,0.7)', 
              fontSize: '0.85rem',
              marginBottom: 0
            }}>
              © 2025 Khatu Pay. All rights reserved.
            </p>
          </div>
        </div>
      </Container>
    </div>
  )
}