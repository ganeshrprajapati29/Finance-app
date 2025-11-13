import { useEffect, useState } from 'react'
import { Card, Row, Col, Spinner, Alert, Container } from 'react-bootstrap'
import api from '../api/axios'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { AlertCircle, RefreshCw } from 'lucide-react'
import 'bootstrap/dist/css/bootstrap.min.css'

export default function Dashboard(){
  const [metrics, setMetrics] = useState(null)
  const [series, setSeries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(()=>{
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const [metricsRes, seriesRes] = await Promise.all([
        api.get('/admin/metrics'),
        api.get('/admin/metrics/timeseries?days=30')
      ])
      
      setMetrics(metricsRes.data.data)
      setSeries(seriesRes.data.data)
    } catch (err) {
      console.error('Dashboard Error:', err)
      setError(err.message || 'Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
  }

  const formatCurrency = (value) => {
    if (!value) return '₹0'
    if (value >= 10000000) return '₹' + (value / 10000000).toFixed(2) + 'Cr'
    if (value >= 100000) return '₹' + (value / 100000).toFixed(2) + 'L'
    if (value >= 1000) return '₹' + (value / 1000).toFixed(2) + 'K'
    return '₹' + value
  }

  if (loading) {
    return (
      <Container fluid className="d-flex align-items-center justify-content-center" style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #F8FAFC 0%, #F0F4F8 100%)' }}>
        <div style={{ textAlign: 'center' }}>
          <Spinner animation="border" role="status" style={{ color: '#0066FF', marginBottom: '20px' }} />
          <h5 style={{ color: '#0F172A' }}>Loading Dashboard</h5>
          <p style={{ color: '#64748B' }}>Fetching your business metrics...</p>
        </div>
      </Container>
    )
  }

  return (
    <div style={{ background: 'linear-gradient(135deg, #F8FAFC 0%, #F0F4F8 100%)', minHeight: '100vh', padding: '40px 20px' }}>
      <Container fluid>
        {/* Header */}
        <div style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '36px', fontWeight: '900', color: '#0F172A', margin: 0, marginBottom: '8px' }}>Dashboard</h1>
            <p style={{ color: '#64748B', fontSize: '15px', margin: 0 }}>Real-time business analytics for Khatu Pay</p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            style={{
              background: '#0066FF',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              padding: '10px 20px',
              fontWeight: '700',
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.3s ease',
              opacity: refreshing ? 0.7 : 1
            }}
          >
            <RefreshCw size={18} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="danger" style={{ borderRadius: '12px', marginBottom: '30px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <AlertCircle size={20} />
            <span>{error}</span>
          </Alert>
        )}

        {/* Metrics Cards */}
        <Row className="mb-5">
          {metrics && (
            <>
              <Col lg={3} md={6} sm={12} className="mb-4">
                <Card style={{
                  background: 'linear-gradient(135deg, #0066FF12 0%, #0066FF05 100%)',
                  border: '2px solid #0066FF25',
                  borderRadius: '16px',
                  padding: '28px',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 4px 12px rgba(0, 102, 255, 0.08)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-8px)'
                  e.currentTarget.style.boxShadow = '0 16px 32px rgba(0, 102, 255, 0.15)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 102, 255, 0.08)'
                }}>
                  <Card.Body style={{ padding: 0 }}>
                    <div style={{ fontSize: '12px', color: '#64748B', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Total Users</div>
                    <h2 style={{ fontSize: '40px', fontWeight: '900', color: '#0F172A', margin: '0 0 8px 0' }}>{metrics.users?.toLocaleString() || '0'}</h2>
                    <p style={{ fontSize: '12px', color: '#10B981', fontWeight: '700', margin: 0 }}>↑ 12% increase this month</p>
                  </Card.Body>
                </Card>
              </Col>

              <Col lg={3} md={6} sm={12} className="mb-4">
                <Card style={{
                  background: 'linear-gradient(135deg, #00B36612 0%, #00B36605 100%)',
                  border: '2px solid #00B36625',
                  borderRadius: '16px',
                  padding: '28px',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 4px 12px rgba(0, 179, 102, 0.08)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-8px)'
                  e.currentTarget.style.boxShadow = '0 16px 32px rgba(0, 179, 102, 0.15)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 179, 102, 0.08)'
                }}>
                  <Card.Body style={{ padding: 0 }}>
                    <div style={{ fontSize: '12px', color: '#64748B', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Loan Applications</div>
                    <h2 style={{ fontSize: '40px', fontWeight: '900', color: '#0F172A', margin: '0 0 8px 0' }}>{metrics.loans?.toLocaleString() || '0'}</h2>
                    <p style={{ fontSize: '12px', color: '#10B981', fontWeight: '700', margin: 0 }}>↑ 8% increase this month</p>
                  </Card.Body>
                </Card>
              </Col>

              <Col lg={3} md={6} sm={12} className="mb-4">
                <Card style={{
                  background: 'linear-gradient(135deg, #FF8A0012 0%, #FF8A0005 100%)',
                  border: '2px solid #FF8A0025',
                  borderRadius: '16px',
                  padding: '28px',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 4px 12px rgba(255, 138, 0, 0.08)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-8px)'
                  e.currentTarget.style.boxShadow = '0 16px 32px rgba(255, 138, 0, 0.15)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(255, 138, 0, 0.08)'
                }}>
                  <Card.Body style={{ padding: 0 }}>
                    <div style={{ fontSize: '12px', color: '#64748B', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Approved Loans</div>
                    <h2 style={{ fontSize: '40px', fontWeight: '900', color: '#0F172A', margin: '0 0 8px 0' }}>{metrics.approved?.toLocaleString() || '0'}</h2>
                    <p style={{ fontSize: '12px', color: '#10B981', fontWeight: '700', margin: 0 }}>↑ 5% increase this month</p>
                  </Card.Body>
                </Card>
              </Col>

              <Col lg={3} md={6} sm={12} className="mb-4">
                <Card style={{
                  background: 'linear-gradient(135deg, #6B21A812 0%, #6B21A805 100%)',
                  border: '2px solid #6B21A825',
                  borderRadius: '16px',
                  padding: '28px',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 4px 12px rgba(107, 33, 168, 0.08)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-8px)'
                  e.currentTarget.style.boxShadow = '0 16px 32px rgba(107, 33, 168, 0.15)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(107, 33, 168, 0.08)'
                }}>
                  <Card.Body style={{ padding: 0 }}>
                    <div style={{ fontSize: '12px', color: '#64748B', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Amount Received</div>
                    <h2 style={{ fontSize: '40px', fontWeight: '900', color: '#0F172A', margin: '0 0 8px 0' }}>{formatCurrency(metrics.totalReceived)}</h2>
                    <p style={{ fontSize: '12px', color: '#10B981', fontWeight: '700', margin: 0 }}>↑ 18% increase this month</p>
                  </Card.Body>
                </Card>
              </Col>
            </>
          )}
        </Row>

        {/* Charts */}
        <Row>
          <Col lg={6} md={12} className="mb-4">
            <Card style={{
              background: 'linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 100%)',
              borderRadius: '16px',
              border: '1px solid #E2E8F0',
              padding: '32px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.06)',
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 12px 32px rgba(0, 0, 0, 0.12)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.06)'
            }}>
              <Card.Body style={{ padding: 0 }}>
                <div style={{ marginBottom: '24px' }}>
                  <h5 style={{ fontSize: '18px', fontWeight: '800', color: '#0F172A', margin: '0 0 4px 0' }}>New Users Registration</h5>
                  <p style={{ fontSize: '13px', color: '#64748B', margin: 0, fontWeight: '600' }}>Last 30 days user acquisition trend</p>
                </div>
                <div style={{ width: '100%', height: 320 }}>
                  {series.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={series} margin={{ top: 15, right: 30, left: -5, bottom: 15 }}>
                        <defs>
                          <linearGradient id="colorNewUsers" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#0066FF" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#0066FF" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="4 4" stroke="#E2E8F0" vertical={false} />
                        <XAxis dataKey="date" stroke="#94A3B8" style={{ fontSize: '12px', fontWeight: '600' }} />
                        <YAxis stroke="#94A3B8" style={{ fontSize: '12px', fontWeight: '600' }} />
                        <Tooltip
                          contentStyle={{
                            background: 'linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 100%)',
                            border: '2px solid #E2E8F0',
                            borderRadius: '12px',
                            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
                            padding: '12px',
                            fontWeight: '600'
                          }}
                          formatter={(value) => [value?.toLocaleString() || '0', 'Users']}
                        />
                        <Line type="natural" dataKey="newUsers" stroke="#0066FF" strokeWidth={3} dot={{ fill: '#0066FF', r: 5 }} activeDot={{ r: 7 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94A3B8' }}>No data available</div>
                  )}
                </div>
              </Card.Body>
            </Card>
          </Col>

          <Col lg={6} md={12} className="mb-4">
            <Card style={{
              background: 'linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 100%)',
              borderRadius: '16px',
              border: '1px solid #E2E8F0',
              padding: '32px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.06)',
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 12px 32px rgba(0, 0, 0, 0.12)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.06)'
            }}>
              <Card.Body style={{ padding: 0 }}>
                <div style={{ marginBottom: '24px' }}>
                  <h5 style={{ fontSize: '18px', fontWeight: '800', color: '#0F172A', margin: '0 0 4px 0' }}>Payments Received</h5>
                  <p style={{ fontSize: '13px', color: '#64748B', margin: 0, fontWeight: '600' }}>Daily collection overview (₹ per day)</p>
                </div>
                <div style={{ width: '100%', height: 320 }}>
                  {series.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={series} margin={{ top: 15, right: 30, left: -5, bottom: 15 }}>
                        <defs>
                          <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#6B21A8" stopOpacity={1} />
                            <stop offset="100%" stopColor="#6B21A8" stopOpacity={0.75} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="4 4" stroke="#E2E8F0" vertical={false} />
                        <XAxis dataKey="date" stroke="#94A3B8" style={{ fontSize: '12px', fontWeight: '600' }} />
                        <YAxis stroke="#94A3B8" style={{ fontSize: '12px', fontWeight: '600' }} />
                        <Tooltip
                          contentStyle={{
                            background: 'linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 100%)',
                            border: '2px solid #E2E8F0',
                            borderRadius: '12px',
                            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
                            padding: '12px',
                            fontWeight: '600'
                          }}
                          formatter={(value) => [formatCurrency(value), 'Amount']}
                        />
                        <Bar dataKey="receivedAmount" fill="url(#colorAmount)" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94A3B8' }}>No data available</div>
                  )}
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    </div>
  )
}