import { useState, useEffect } from 'react'
import { Card, Table, Button, Badge, Alert, Row, Col, Form, Modal, Dropdown } from 'react-bootstrap'
import api from '../api/axios'
import { Users, Clock, AlertTriangle, UserCheck, Phone, MapPin } from 'lucide-react'

export default function OverdueUsersList(){
  const [users, setUsers] = useState([])
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({
    bucket: '',
    agentId: '',
    status: ''
  })
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)
  const [assignmentData, setAssignmentData] = useState({
    agentId: '',
    notes: ''
  })

  const loadUsers = async ()=>{
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.bucket) params.append('bucket', filters.bucket)
      if (filters.agentId) params.append('agentId', filters.agentId)
      if (filters.status) params.append('status', filters.status)

      const r = await api.get(`/admin/collections/overdue-users?${params}`)
      setUsers(r.data.data.users)
    } catch (error) {
      console.error('Failed to load users:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadAgents = async ()=>{
    try {
      const r = await api.get('/admin/employees?role=COLLECTION_AGENT')
      setAgents(r.data.data.employees || [])
    } catch (error) {
      console.error('Failed to load agents:', error)
    }
  }

  useEffect(()=>{ 
    loadUsers()
    loadAgents()
  }, [filters])

  const handleAssignAgent = (user)=>{
    setSelectedUser(user)
    setAssignmentData({
      agentId: '',
      notes: ''
    })
    setShowAssignModal(true)
  }

  const submitAssignment = async ()=>{
    try {
      await api.post('/admin/collections/assign-agent', {
        loanId: selectedUser.loanId,
        agentId: assignmentData.agentId,
        notes: assignmentData.notes
      })
      setShowAssignModal(false)
      await loadUsers()
      alert('Agent assigned successfully')
    } catch (error) {
      console.error('Failed to assign agent:', error)
      alert('Failed to assign agent')
    }
  }

  const getBucketColor = (bucket)=>{
    switch(bucket) {
      case '1-7': return 'success'
      case '8-15': return 'warning'
      case '16-30': return 'orange'
      case '31-60': return 'danger'
      case '60-90': return 'dark'
      default: return 'secondary'
    }
  }

  const getStatusColor = (status)=>{
    switch(status) {
      case 'ACTIVE': return 'primary'
      case 'RESOLVED': return 'success'
      case 'LEGAL': return 'danger'
      case 'SETTLED': return 'info'
      default: return 'secondary'
    }
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="mb-0">
          <Users className="me-2" />
          Overdue Users List
        </h2>
      </div>

      <Alert variant="warning" className="mb-4">
        <strong>Note:</strong> This list shows all users with overdue loan payments.
        Assign collection agents and track recovery progress.
      </Alert>

      {/* Filters */}
      <Card className="mb-4">
        <Card.Header>
          <h5 className="mb-0">Filters</h5>
        </Card.Header>
        <Card.Body>
          <Row>
            <Col md={3}>
              <Form.Group className="mb-3">
                <Form.Label>Bucket</Form.Label>
                <Form.Select
                  value={filters.bucket}
                  onChange={(e) => setFilters({...filters, bucket: e.target.value})}
                >
                  <option value="">All Buckets</option>
                  <option value="1-7">1-7 days</option>
                  <option value="8-15">8-15 days</option>
                  <option value="16-30">16-30 days</option>
                  <option value="31-60">31-60 days</option>
                  <option value="60-90">60-90 days</option>
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group className="mb-3">
                <Form.Label>Agent</Form.Label>
                <Form.Select
                  value={filters.agentId}
                  onChange={(e) => setFilters({...filters, agentId: e.target.value})}
                >
                  <option value="">All Agents</option>
                  {agents.map(agent => (
                    <option key={agent._id} value={agent._id}>{agent.name}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group className="mb-3">
                <Form.Label>Status</Form.Label>
                <Form.Select
                  value={filters.status}
                  onChange={(e) => setFilters({...filters, status: e.target.value})}
                >
                  <option value="">All Status</option>
                  <option value="UNASSIGNED">Unassigned</option>
                  <option value="ACTIVE">Active</option>
                  <option value="RESOLVED">Resolved</option>
                  <option value="LEGAL">Legal</option>
                  <option value="SETTLED">Settled</option>
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={3}>
              <Button
                variant="outline-secondary"
                className="mt-4"
                onClick={() => setFilters({ bucket: '', agentId: '', status: '' })}
              >
                Clear Filters
              </Button>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Summary Cards */}
      <Row className="mb-4">
        <Col md={2}>
          <Card className="text-center">
            <Card.Body>
              <Users size={32} className="text-primary mb-2" />
              <h4>{users.length}</h4>
              <small className="text-muted">Total Overdue</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={2}>
          <Card className="text-center">
            <Card.Body>
              <UserCheck size={32} className="text-success mb-2" />
              <h4>{users.filter(u => u.assignedAgent).length}</h4>
              <small className="text-muted">Assigned</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={2}>
          <Card className="text-center">
            <Card.Body>
              <Clock size={32} className="text-warning mb-2" />
              <h4>{users.filter(u => !u.assignedAgent).length}</h4>
              <small className="text-muted">Unassigned</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={2}>
          <Card className="text-center">
            <Card.Body>
              <AlertTriangle size={32} className="text-danger mb-2" />
              <h4>₹{users.reduce((sum, u) => sum + u.overdueAmount, 0).toLocaleString()}</h4>
              <small className="text-muted">Total Amount</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={2}>
          <Card className="text-center">
            <Card.Body>
              <Phone size={32} className="text-info mb-2" />
              <h4>{users.filter(u => u.collectionStatus === 'ACTIVE').length}</h4>
              <small className="text-muted">In Recovery</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={2}>
          <Card className="text-center">
            <Card.Body>
              <MapPin size={32} className="text-secondary mb-2" />
              <h4>{users.filter(u => u.collectionStatus === 'LEGAL').length}</h4>
              <small className="text-muted">Legal Cases</small>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Users Table */}
      <Card>
        <Card.Header>
          <h5 className="mb-0">Overdue Users</h5>
        </Card.Header>
        <Card.Body>
          {loading ? (
            <div className="text-center">Loading...</div>
          ) : users.length === 0 ? (
            <div className="text-center text-muted py-5">
              <Users size={48} className="mb-3 opacity-50" />
              <p>No overdue users found</p>
            </div>
          ) : (
            <Table striped hover responsive>
              <thead className="table-dark">
                <tr>
                  <th>Loan ID</th>
                  <th>Customer Name</th>
                  <th>Phone</th>
                  <th>Bucket</th>
                  <th>Days Overdue</th>
                  <th>Overdue Amount</th>
                  <th>Status</th>
                  <th>Assigned Agent</th>
                  <th>Last Contact</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.loanId}>
                    <td>{user.loanAccountNumber}</td>
                    <td>{user.userName}</td>
                    <td>{user.userPhone}</td>
                    <td>
                      <Badge bg={getBucketColor(user.bucket)}>
                        {user.bucket} days
                      </Badge>
                    </td>
                    <td>{user.daysOverdue} days</td>
                    <td>₹{user.overdueAmount.toLocaleString()}</td>
                    <td>
                      <Badge bg={getStatusColor(user.collectionStatus)}>
                        {user.collectionStatus}
                      </Badge>
                    </td>
                    <td>
                      {user.assignedAgent ? (
                        <div>
                          <div>{user.assignedAgent.name}</div>
                          <small className="text-muted">{user.assignedAgent.phone}</small>
                        </div>
                      ) : (
                        <Badge bg="secondary">Unassigned</Badge>
                      )}
                    </td>
                    <td>
                      {user.lastContactDate ? (
                        new Date(user.lastContactDate).toLocaleDateString()
                      ) : (
                        'Never'
                      )}
                    </td>
                    <td>
                      <div className="d-flex gap-1">
                        {!user.assignedAgent && (
                          <Button
                            size="sm"
                            variant="outline-primary"
                            onClick={() => handleAssignAgent(user)}
                          >
                            Assign Agent
                          </Button>
                        )}
                        <Dropdown>
                          <Dropdown.Toggle variant="outline-secondary" size="sm">
                            Actions
                          </Dropdown.Toggle>
                          <Dropdown.Menu>
                            <Dropdown.Item>View Details</Dropdown.Item>
                            <Dropdown.Item>Call History</Dropdown.Item>
                            <Dropdown.Item>Visit History</Dropdown.Item>
                            <Dropdown.Item>PTP Records</Dropdown.Item>
                          </Dropdown.Menu>
                        </Dropdown>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>

      {/* Assign Agent Modal */}
      <Modal show={showAssignModal} onHide={() => setShowAssignModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Assign Collection Agent</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedUser && (
            <div className="mb-3">
              <Alert variant="info">
                <strong>Loan:</strong> {selectedUser.loanAccountNumber} |
                <strong>Customer:</strong> {selectedUser.userName} |
                <strong>Overdue:</strong> ₹{selectedUser.overdueAmount.toLocaleString()} |
                <strong>Days:</strong> {selectedUser.daysOverdue}
              </Alert>
            </div>
          )}

          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Select Agent *</Form.Label>
              <Form.Select
                value={assignmentData.agentId}
                onChange={(e) => setAssignmentData({...assignmentData, agentId: e.target.value})}
              >
                <option value="">Choose an agent</option>
                {agents.map(agent => (
                  <option key={agent._id} value={agent._id}>
                    {agent.name} - {agent.phone}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Assignment Notes</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={assignmentData.notes}
                onChange={(e) => setAssignmentData({...assignmentData, notes: e.target.value})}
                placeholder="Any special instructions or notes for the agent"
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowAssignModal(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={submitAssignment}
            disabled={!assignmentData.agentId}
          >
            Assign Agent
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  )
}
