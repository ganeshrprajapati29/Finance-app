import { useEffect, useState } from 'react'
import { Table, Button, Form, Row, Col, Card } from 'react-bootstrap'
import api from '../api/axios'

export default function FAQs(){
  const [rows, setRows] = useState([])
  const [q, setQ] = useState(''); const [a, setA] = useState('')

  const load = async ()=>{ const r = await api.get('/faq'); setRows(r.data.data) }
  useEffect(()=>{ load() }, [])

  const add = async ()=>{
    if (!q || !a) return
    await api.post('/faq', { question:q, answer:a, order: rows.length })
    setQ(''); setA(''); await load()
  }

  return (
    <div>
      <Card className="p-3 mb-3">
        <Row className="g-2">
          <Col md={5}><Form.Control placeholder="Question" value={q} onChange={e=>setQ(e.target.value)} /></Col>
          <Col md={5}><Form.Control placeholder="Answer" value={a} onChange={e=>setA(e.target.value)} /></Col>
          <Col md={2}><Button className="w-100" onClick={add}>Add FAQ</Button></Col>
        </Row>
      </Card>
      <Table striped hover responsive>
        <thead><tr><th>Q</th><th>A</th><th>Actions</th></tr></thead>
        <tbody>
          {rows.map(r=>(
            <tr key={r._id}>
              <td>{r.question}</td>
              <td>{r.answer}</td>
              <td><Button size="sm" variant="danger" onClick={async()=>{ await api.delete('/faq/'+r._id); await load() }}>Delete</Button></td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  )
}
