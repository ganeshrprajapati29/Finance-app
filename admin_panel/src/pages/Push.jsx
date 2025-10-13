import { useEffect, useState } from 'react'
import { Table, Button, Form, Row, Col, Card } from 'react-bootstrap'
import api from '../api/axios'

export default function Push(){
  const [users, setUsers] = useState([])
  const [userId, setUserId] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')

  useEffect(()=>{ (async()=>{ const u=await api.get('/admin/users'); setUsers(u.data.data) })() }, [])

  const send = async ()=>{
    await api.post('/admin/push', { userId, title, body })
    alert('Push attempted')
  }

  return (
    <div>
      <Card className="p-3 mb-3">
        <Row className="g-2">
          <Col md={4}>
            <Form.Select value={userId} onChange={e=>setUserId(e.target.value)}>
              <option value="">Select user</option>
              {users.map(u=><option key={u._id} value={u._id}>{u.name} ({u.email})</option>)}
            </Form.Select>
          </Col>
          <Col md={3}><Form.Control placeholder="Title" value={title} onChange={e=>setTitle(e.target.value)} /></Col>
          <Col md={3}><Form.Control placeholder="Body" value={body} onChange={e=>setBody(e.target.value)} /></Col>
          <Col md={2}><Button className="w-100" onClick={send}>Send</Button></Col>
        </Row>
      </Card>
    </div>
  )
}
