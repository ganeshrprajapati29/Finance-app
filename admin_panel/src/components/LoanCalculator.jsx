import { useState } from 'react'
import { Card, Form, Row, Col, Button, Alert, Table } from 'react-bootstrap'
import { Calculator, TrendingUp, DollarSign, Calendar } from 'lucide-react'

export default function LoanCalculator() {
  const [formData, setFormData] = useState({
    principal: '',
    rate: '',
    tenure: ''
  })
  const [results, setResults] = useState(null)
  const [schedule, setSchedule] = useState([])

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const calculateLoan = () => {
    const { principal, rate, tenure } = formData

    if (!principal || !rate || !tenure) {
      alert('Please fill all fields')
      return
    }

    const amount = parseFloat(principal)
    const annualRatePercent = parseFloat(rate)
    const months = parseInt(tenure)

    if (amount <= 0 || annualRatePercent < 0 || months <= 0) {
      alert('Please enter valid positive values')
      return
    }

    const monthlyRate = (annualRatePercent / 100) / 12
    const n = months
    let emi = 0

    if (monthlyRate === 0) {
      emi = amount / n
    } else {
      emi = (amount * monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1)
    }

    emi = Math.round(emi * 100) / 100
    const totalAmount = Math.round(emi * n * 100) / 100
    const totalInterest = Math.round((totalAmount - amount) * 100) / 100

    setResults({
      emi,
      totalInterest,
      totalAmount
    })

    // Generate schedule summary (first 5 and last 5 installments)
    const scheduleData = []
    let balance = amount

    for (let i = 1; i <= n; i++) {
      const interest = Math.round((balance * monthlyRate) * 100) / 100
      const principalPayment = Math.round((emi - interest) * 100) / 100
      balance = Math.round((balance - principalPayment) * 100) / 100

      if (i <= 5 || i > n - 5) {
        scheduleData.push({
          installmentNo: i,
          principal: principalPayment,
          interest,
          total: emi,
          balance: Math.max(0, balance)
        })
      }
    }

    setSchedule(scheduleData)
  }

  const resetCalculator = () => {
    setFormData({
      principal: '',
      rate: '',
      tenure: ''
    })
    setResults(null)
    setSchedule([])
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ color: '#0F172A', fontWeight: '800', marginBottom: '8px' }}>
          <Calculator size={32} style={{ marginRight: '12px', color: '#0066FF' }} />
          Loan Calculator
        </h2>
        <p style={{ color: '#64748B', fontSize: '16px' }}>
          Calculate EMI, total interest, and payment schedule for loans
        </p>
      </div>

      <Row>
        <Col lg={8}>
          <Card style={{ border: 'none', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)', borderRadius: '16px' }}>
            <Card.Body style={{ padding: '32px' }}>
              <h4 style={{ color: '#0F172A', fontWeight: '700', marginBottom: '24px' }}>
                Loan Details
              </h4>

              <Row>
                <Col md={4}>
                  <Form.Group style={{ marginBottom: '20px' }}>
                    <Form.Label style={{ fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                      Principal Amount (₹)
                    </Form.Label>
                    <Form.Control
                      type="number"
                      name="principal"
                      value={formData.principal}
                      onChange={handleInputChange}
                      placeholder="Enter amount"
                      style={{
                        padding: '12px 16px',
                        border: '2px solid #E5E7EB',
                        borderRadius: '8px',
                        fontSize: '16px',
                        transition: 'border-color 0.3s ease'
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#0066FF'}
                      onBlur={(e) => e.target.style.borderColor = '#E5E7EB'}
                    />
                  </Form.Group>
                </Col>

                <Col md={4}>
                  <Form.Group style={{ marginBottom: '20px' }}>
                    <Form.Label style={{ fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                      Annual Interest Rate (%)
                    </Form.Label>
                    <Form.Control
                      type="number"
                      name="rate"
                      value={formData.rate}
                      onChange={handleInputChange}
                      placeholder="e.g., 12.5"
                      step="0.1"
                      style={{
                        padding: '12px 16px',
                        border: '2px solid #E5E7EB',
                        borderRadius: '8px',
                        fontSize: '16px',
                        transition: 'border-color 0.3s ease'
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#0066FF'}
                      onBlur={(e) => e.target.style.borderColor = '#E5E7EB'}
                    />
                  </Form.Group>
                </Col>

                <Col md={4}>
                  <Form.Group style={{ marginBottom: '20px' }}>
                    <Form.Label style={{ fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                      Tenure (Months)
                    </Form.Label>
                    <Form.Control
                      type="number"
                      name="tenure"
                      value={formData.tenure}
                      onChange={handleInputChange}
                      placeholder="e.g., 24"
                      style={{
                        padding: '12px 16px',
                        border: '2px solid #E5E7EB',
                        borderRadius: '8px',
                        fontSize: '16px',
                        transition: 'border-color 0.3s ease'
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#0066FF'}
                      onBlur={(e) => e.target.style.borderColor = '#E5E7EB'}
                    />
                  </Form.Group>
                </Col>
              </Row>

              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <Button
                  onClick={calculateLoan}
                  style={{
                    background: 'linear-gradient(135deg, #0066FF, #00B366)',
                    border: 'none',
                    padding: '12px 24px',
                    borderRadius: '8px',
                    fontWeight: '600',
                    fontSize: '16px',
                    transition: 'transform 0.2s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <Calculator size={18} style={{ marginRight: '8px' }} />
                  Calculate
                </Button>

                <Button
                  variant="outline-secondary"
                  onClick={resetCalculator}
                  style={{
                    padding: '12px 24px',
                    borderRadius: '8px',
                    fontWeight: '600',
                    fontSize: '16px'
                  }}
                >
                  Reset
                </Button>
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col lg={4}>
          {results && (
            <Card style={{ border: 'none', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)', borderRadius: '16px' }}>
              <Card.Body style={{ padding: '24px' }}>
                <h5 style={{ color: '#0F172A', fontWeight: '700', marginBottom: '20px' }}>
                  Calculation Results
                </h5>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{
                    background: 'linear-gradient(135deg, #0066FF, #00B366)',
                    padding: '16px',
                    borderRadius: '12px',
                    color: 'white'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                      <DollarSign size={20} style={{ marginRight: '8px' }} />
                      <span style={{ fontSize: '14px', fontWeight: '600' }}>Monthly EMI</span>
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: '800' }}>
                      ₹{results.emi.toLocaleString('en-IN')}
                    </div>
                  </div>

                  <div style={{
                    background: '#F8FAFC',
                    padding: '16px',
                    borderRadius: '12px',
                    border: '1px solid #E2E8F0'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                      <TrendingUp size={20} style={{ marginRight: '8px', color: '#EF4444' }} />
                      <span style={{ fontSize: '14px', fontWeight: '600', color: '#374151' }}>Total Interest</span>
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: '700', color: '#EF4444' }}>
                      ₹{results.totalInterest.toLocaleString('en-IN')}
                    </div>
                  </div>

                  <div style={{
                    background: '#F8FAFC',
                    padding: '16px',
                    borderRadius: '12px',
                    border: '1px solid #E2E8F0'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                      <Calendar size={20} style={{ marginRight: '8px', color: '#0F172A' }} />
                      <span style={{ fontSize: '14px', fontWeight: '600', color: '#374151' }}>Total Amount</span>
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: '700', color: '#0F172A' }}>
                      ₹{results.totalAmount.toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>
              </Card.Body>
            </Card>
          )}
        </Col>
      </Row>

      {schedule.length > 0 && (
        <Card style={{ border: 'none', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)', borderRadius: '16px', marginTop: '24px' }}>
          <Card.Body style={{ padding: '32px' }}>
            <h5 style={{ color: '#0F172A', fontWeight: '700', marginBottom: '20px' }}>
              Payment Schedule Summary
            </h5>

            <Alert variant="info" style={{ borderRadius: '8px', marginBottom: '20px' }}>
              Showing first 5 and last 5 installments for preview
            </Alert>

            <div style={{ overflowX: 'auto' }}>
              <Table responsive style={{ borderRadius: '8px', overflow: 'hidden' }}>
                <thead style={{ background: '#F8FAFC' }}>
                  <tr>
                    <th style={{ padding: '12px 16px', fontWeight: '700', color: '#374151', border: 'none' }}>Installment</th>
                    <th style={{ padding: '12px 16px', fontWeight: '700', color: '#374151', border: 'none' }}>Principal (₹)</th>
                    <th style={{ padding: '12px 16px', fontWeight: '700', color: '#374151', border: 'none' }}>Interest (₹)</th>
                    <th style={{ padding: '12px 16px', fontWeight: '700', color: '#374151', border: 'none' }}>Total (₹)</th>
                    <th style={{ padding: '12px 16px', fontWeight: '700', color: '#374151', border: 'none' }}>Balance (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {schedule.map((item, index) => (
                    <tr key={item.installmentNo} style={{ borderBottom: index < schedule.length - 1 ? '1px solid #E5E7EB' : 'none' }}>
                      <td style={{ padding: '12px 16px', fontWeight: '600', color: '#0F172A' }}>{item.installmentNo}</td>
                      <td style={{ padding: '12px 16px', color: '#374151' }}>{item.principal.toLocaleString('en-IN')}</td>
                      <td style={{ padding: '12px 16px', color: '#374151' }}>{item.interest.toLocaleString('en-IN')}</td>
                      <td style={{ padding: '12px 16px', fontWeight: '600', color: '#0066FF' }}>{item.total.toLocaleString('en-IN')}</td>
                      <td style={{ padding: '12px 16px', color: '#374151' }}>{item.balance.toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </Card.Body>
        </Card>
      )}
    </div>
  )
}
