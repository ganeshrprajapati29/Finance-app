import { useEffect, useState } from 'react'
import { Table, Button, Form } from 'react-bootstrap'
import api from '../api/axios'

export default function Users(){
  const [rows, setRows] = useState([])
  const [filter, setFilter] = useState('')

  const load = async ()=>{ const r = await api.get('/admin/users'); setRows(r.data.data) }
  useEffect(()=>{ load() }, [])

  const setLimit = async (id) => {
    const amount = prompt('Set loan limit (₹):')
    if (!amount) return
    await api.put(`/admin/users/${id}/limit`, { amount: Number(amount) })
    await load()
  }
  const setStatus = async (id, status) => {
    await api.put(`/admin/users/${id}/status`, { status })
    await load()
  }

  return (
    <div>
      <div className="d-flex mb-2">
        <Form.Control placeholder="Search name/email/mobile" value={filter} onChange={e=>setFilter(e.target.value)} />
      </div>
      <Table striped hover responsive>
        <thead><tr><th>Name</th><th>Email</th><th>Mobile</th><th>Status</th><th>Roles</th><th>Loan Limit</th><th>Actions</th></tr></thead>
        <tbody>
          {rows.filter(r=> JSON.stringify(r).toLowerCase().includes(filter.toLowerCase())).map(r=>(
            <tr key={r._id}>
              <td>{r.name}</td><td>{r.email}</td><td>{r.mobile}</td>
              <td><span className="badge badge-soft">{r.status}</span></td>
              <td>{(r.roles||[]).join(', ')}</td>
              <td>₹ {r.loanLimit?.amount || 0}</td>
              <td>
                <Button size="sm" onClick={()=>setLimit(r._id)}>Set Limit</Button>{' '}
                {r.status==='active' ? <Button size="sm" variant="warning" onClick={()=>setStatus(r._id,'blocked')}>Block</Button> : <Button size="sm" variant="success" onClick={()=>setStatus(r._id,'active')}>Unblock</Button>}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  )
}
