import { useEffect, useState } from 'react'
import { Table, Badge, Button, Form } from 'react-bootstrap'
import api from '../api/axios'

export default function Loans(){
  const [rows, setRows] = useState([])
  const [status, setStatus] = useState('PENDING')
  const load = async ()=>{ const r = await api.get('/admin/loans?status='+status); setRows(r.data.data) }
  useEffect(()=>{ load() }, [status])

  const approve = async (id)=>{
    const amountApproved = Number(prompt('Amount Approved:'))
    const rateAPR = Number(prompt('APR (%):', '18'))
    const tenureMonths = Number(prompt('Tenure (months):', '12'))
    await api.put(`/loans/${id}/decision`, { action:'approve', amountApproved, rateAPR, tenureMonths })
    await load()
  }
  const reject = async (id)=>{
    await api.put(`/loans/${id}/decision`, { action:'reject', remarks:'Not eligible' })
    await load()
  }

  return (
    <div>
      <div className="d-flex mb-2">
        <Form.Select value={status} onChange={e=>setStatus(e.target.value)} style={{ maxWidth: 240 }}>
          {['PENDING','APPROVED','REJECTED','DISBURSED','CLOSED'].map(s=><option key={s}>{s}</option>)}
        </Form.Select>
      </div>
      <Table striped hover responsive>
        <thead><tr><th>User</th><th>Requested</th><th>Tenure</th><th>Status</th><th>Approved Terms</th><th>Actions</th></tr></thead>
        <tbody>
        {rows.map(r=>(
          <tr key={r._id}>
            <td>{String(r.userId).slice(-6)}</td>
            <td>₹{r.application?.amountRequested}</td>
            <td>{r.application?.tenureMonths} mo</td>
            <td><Badge bg="secondary">{r.status}</Badge></td>
            <td>{r.decision?.amountApproved? `₹${r.decision.amountApproved} @ ${r.decision.rateAPR}% for ${r.decision.tenureMonths}m` : '-'}</td>
            <td>
              {r.status==='PENDING' && (<>
                <Button size="sm" onClick={()=>approve(r._id)}>Approve</Button>{' '}
                <Button size="sm" variant="danger" onClick={()=>reject(r._id)}>Reject</Button>
              </>)}
            </td>
          </tr>
        ))}
        </tbody>
      </Table>
    </div>
  )
}
