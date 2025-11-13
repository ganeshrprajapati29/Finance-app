import { useState, useEffect } from 'react'
import { Table, Button, Modal, Form, Badge, Alert } from 'react-bootstrap'
import api from '../api/axios.js'

export default function Support(){
  const [tickets, setTickets] = useState([])
  const [show, setShow] = useState(false)
  const [selected, setSelected] = useState(null)
  const [status, setStatus] = useState('')
  const [notes, setNotes] = useState('')
  const [filter, setFilter] = useState('ALL')

  useEffect(() => { loadTickets() }, [])

  const loadTickets = async () => {
    try {
      const r = await api.get('/support')
      setTickets(r.data?.data || [])
    } catch (e) {
      console.error(e)
      setTickets([])
    }
  }

  const updateTicket = async () => {
    try {
      await api.put(`/support/${selected._id}`, { status, adminNotes: notes })
      setShow(false)
      loadTickets()
    } catch (e) { console.error(e) }
  }

  const getStatusBadge = (s) => {
    const variants = { OPEN: 'danger', IN_PROGRESS: 'warning', RESOLVED: 'success', CLOSED: 'secondary' }
    return <Badge bg={variants[s] || 'secondary'}>{s.replace('_', ' ')}</Badge>
  }

  const filteredTickets = tickets.filter(t => filter === 'ALL' || t.status === filter)

  return (
    <div>
      <h2>Support Tickets</h2>
      <div className="mb-3">
        <Form.Select value={filter} onChange={e => setFilter(e.target.value)} style={{ width: '200px' }}>
          <option value="ALL">All Tickets</option>
          <option value="OPEN">Open</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="RESOLVED">Resolved</option>
          <option value="CLOSED">Closed</option>
        </Form.Select>
      </div>
      {filteredTickets.length === 0 ? (
        <Alert variant="info">No tickets found.</Alert>
      ) : (
        <Table striped bordered hover responsive>
          <thead>
            <tr>
              <th>Subject</th>
              <th>Message</th>
              <th>Status</th>
              <th>User</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredTickets.map(t => (
              <tr key={t._id}>
                <td>{t.subject}</td>
                <td style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.message}</td>
                <td>{getStatusBadge(t.status)}</td>
                <td>{t.userId?.name || 'Unknown'}<br /><small>{t.userId?.email}</small></td>
                <td>{new Date(t.createdAt).toLocaleString()}</td>
                <td>
                  <Button variant="primary" size="sm" onClick={() => {
                    setSelected(t)
                    setStatus(t.status)
                    setNotes(t.adminNotes || '')
                    setShow(true)
                  }}>Update</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <Modal show={show} onHide={() => setShow(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Update Ticket</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selected && (
            <div className="mb-3">
              <h5>{selected.subject}</h5>
              <p><strong>User:</strong> {selected.userId?.name} ({selected.userId?.email})</p>
              <p><strong>Message:</strong> {selected.message}</p>
              <p><strong>Created:</strong> {new Date(selected.createdAt).toLocaleString()}</p>
            </div>
          )}
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Status</Form.Label>
              <Form.Select value={status} onChange={e => setStatus(e.target.value)}>
                <option value="OPEN">Open</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="RESOLVED">Resolved</option>
                <option value="CLOSED">Closed</option>
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Admin Notes</Form.Label>
              <Form.Control as="textarea" rows={4} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add notes for internal use..." />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShow(false)}>Cancel</Button>
          <Button variant="primary" onClick={updateTicket}>Update Ticket</Button>
        </Modal.Footer>
      </Modal>
    </div>
  )
}
