import { useEffect, useState } from 'react'
import { Table, Button, Form, Row, Col, Card } from 'react-bootstrap'
import api from '../api/axios'
import { loadRazorpay } from '../utils/loadRazorpay'

export default function Payments(){
  const [rows, setRows] = useState([])
  const [amount, setAmount] = useState('')
  const [loanId, setLoanId] = useState('')
  const [billId, setBillId] = useState('')

  const load = async ()=>{
    const r = await api.get('/admin/payments')
    setRows(r.data.data)
  }
  useEffect(()=>{ load() }, [])

  const createOrder = async ()=>{
    if (!amount) return alert('Enter amount')
    const res = await api.post('/payments/razorpay/order', { amount: Number(amount), loanId: loanId || null, billId: billId || null })
    const { order, key_id } = res.data.data
    await loadRazorpay()
    const rz = new window.Razorpay({
      key: import.meta.env.VITE_RAZORPAY_KEY_ID || key_id,
      amount: order.amount,
      currency: order.currency,
      name: 'Khatu Pay',
      description: 'Test Payment',
      order_id: order.id,
      handler: async function (response) {
        await api.post('/payments/razorpay/verify', {
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature
        })
        alert('Payment verified!')
        await load()
      },
      prefill: { email: 'test@example.com', contact: '9999999999' }
    })
    rz.open()
  }

  return (
    <div>
      <Card className="p-3 mb-3">
        <Row className="g-2">
          <Col md={3}><Form.Control placeholder="Amount ₹" value={amount} onChange={e=>setAmount(e.target.value)} /></Col>
          <Col md={3}><Form.Control placeholder="LoanId (optional)" value={loanId} onChange={e=>setLoanId(e.target.value)} /></Col>
          <Col md={3}><Form.Control placeholder="BillId (optional)" value={billId} onChange={e=>setBillId(e.target.value)} /></Col>
          <Col md={3}><Button onClick={createOrder} className="w-100">Pay via Razorpay (Test)</Button></Col>
        </Row>
      </Card>

      <Table striped hover responsive>
        <thead><tr><th>User</th><th>Type</th><th>Amount</th><th>Status</th><th>Method</th><th>Ref/Order</th><th>Created</th></tr></thead>
        <tbody>
          {rows.map(r=>(
            <tr key={r._id}>
              <td>{String(r.userId).slice(-6)}</td>
              <td>{r.type}</td>
              <td>₹{r.amount}</td>
              <td>{r.status}</td>
              <td>{r.method}</td>
              <td>{r.reference}</td>
              <td>{new Date(r.createdAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  )
}
