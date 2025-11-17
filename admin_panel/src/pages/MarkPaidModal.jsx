import { useState } from 'react'
import { Form, Button, Alert, Row, Col } from 'react-bootstrap'
import api from '../api/axios'

export default function MarkPaidModal({ selectedLoan, schedule, onClose, onSuccess }){
  const [selectedInstallment, setSelectedInstallment] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedInstallment) return

    setLoading(true)
    setError('')

    try {
      await api.post(`/admin/emi-control/mark-paid/${selectedLoan._id}/${selectedInstallment}`)
      onSuccess()
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to mark EMI as paid')
    } finally {
      setLoading(false)
    }
  }

  const unpaidInstallments = schedule?.filter(emi => !emi.paid) || []

  return (
    <div>
      <Form onSubmit={handleSubmit}>
        <Row className="mb-3">
          <Col md={12}>
            <Form.Group>
              <Form.Label>Select Installment to Mark as Paid</Form.Label>
              <Form.Select
                value={selectedInstallment}
                onChange={(e) => setSelectedInstallment(e.target.value)}
                required
              >
                <option value="">Choose installment...</option>
                {unpaidInstallments.map(emi => (
                  <option key={emi.installmentNo} value={emi.installmentNo}>
                    Installment #{emi.installmentNo} - ₹{emi.total?.toLocaleString()} (Due: {new Date(emi.dueDate).toLocaleDateString()})
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
          </Col>
        </Row>

        {error && <Alert variant="danger">{error}</Alert>}

        <div className="d-flex justify-content-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="success" type="submit" disabled={loading || !selectedInstallment}>
            {loading ? 'Marking Paid...' : 'Mark as Paid'}
          </Button>
        </div>
      </Form>
    </div>
  )
}
