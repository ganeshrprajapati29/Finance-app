import { useEffect, useState } from 'react'
import { Table } from 'react-bootstrap'
import api from '../api/axios'

export default function Audit(){
  const [rows, setRows] = useState([])
  useEffect(()=>{ (async()=>{ const r=await api.get('/admin/audit'); setRows(r.data.data) })() }, [])
  return (
    <Table striped hover responsive>
      <thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Entity</th><th>Meta</th></tr></thead>
      <tbody>
        {rows.map(r=>(
          <tr key={r._id}>
            <td>{new Date(r.createdAt).toLocaleString()}</td>
            <td>{String(r.actorId).slice(-6)}</td>
            <td>{r.action}</td>
            <td>{r.entityType}:{r.entityId}</td>
            <td><code style={{fontSize:12}}>{JSON.stringify(r.meta)}</code></td>
          </tr>
        ))}
      </tbody>
    </Table>
  )
}
