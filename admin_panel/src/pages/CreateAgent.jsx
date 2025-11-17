import { useState, useEffect } from 'react'
import { Card, Button, Form, Alert, Row, Col, Modal, Table, Badge, Dropdown } from 'react-bootstrap'
import api from '../api/axios'
import { UserPlus, Save, X, Edit, Trash2, MoreVertical, Users, Mail, Phone } from 'lucide-react'

export default function CreateAgent(){
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [agents, setAgents] = useState([])
  const [agentData, setAgentData] = useState({
    name: '',
    email: '',
    mobile: '',
    password: '',
    role: 'COLLECTION_AGENT',
    department: 'COLLECTIONS',
    isActive: true
  })
  const [editingAgent, setEditingAgent] = useState(null)
  const [showEditModal, setShowEditModal] = useState(false)

  // Load agents on component mount
  useEffect(() => {
    loadAgents()
  }, [])

  const loadAgents = async () => {
    try {
      const response = await api.get('/admin/agents')
      setAgents(response.data.data.agents || [])
    } catch (error) {
      console.error('Failed to load agents:', error)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      await api.post('/admin/agents', agentData)
      setSuccess('Agent created successfully!')
      setAgentData({
        name: '',
        email: '',
        mobile: '',
        password: '',
        role: 'COLLECTION_AGENT',
        department: 'COLLECTIONS',
        isActive: true
      })
      setShowModal(false)
      loadAgents() // Refresh the agents list
    } catch (error) {
      console.error('Failed to create agent:', error)
      setError(error.response?.data?.message || 'Failed to create agent')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    setAgentData({
      ...agentData,
      [name]: type === 'checkbox' ? checked : value
    })
  }

  const handleEdit = (agent) => {
    setEditingAgent(agent)
    setAgentData({
      name: agent.name,
      email: agent.email,
      mobile: agent.phone,
      role: agent.roles?.[0] || 'COLLECTION_AGENT',
      department: agent.department || 'COLLECTIONS',
      isActive: agent.isActive
    })
    setShowEditModal(true)
  }

  const handleDelete = async (agentId) => {
    if (window.confirm('Are you sure you want to delete this agent? This action cannot be undone.')) {
      try {
        await api.delete(`/admin/agents/${agentId}`)
        loadAgents() // Refresh the list
        alert('Agent deleted successfully')
      } catch (error) {
        console.error('Failed to delete agent:', error)
        alert('Failed to delete agent')
      }
    }
  }

  const handleEditSubmit = async (e) => {
    e.preventDefault()
    try {
      await api.put(`/admin/agents/${editingAgent._id}`, agentData)
      setShowEditModal(false)
      setEditingAgent(null)
      loadAgents() // Refresh the list
      alert('Agent updated successfully')
    } catch (error) {
      console.error('Failed to update agent:', error)
      alert('Failed to update agent')
    }
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="mb-0">
          <UserPlus className="me-2" />
          Create Collection Agent
        </h2>
        <Button variant="primary" onClick={() => setShowModal(true)}>
          <UserPlus className="me-2" size={16} />
          Add New Agent
        </Button>
      </div>

      <Alert variant="info" className="mb-4">
        <strong>Note:</strong> Create new collection agents to handle overdue loan recovery.
        Agents will have access to collection tools and customer data.
      </Alert>

      {/* Agents List */}
      <Card className="mb-4">
        <Card.Header>
          <h5 className="mb-0">Collection Agents ({agents.length})</h5>
        </Card.Header>
        <Card.Body>
          {agents.length === 0 ? (
            <div className="text-center text-muted py-5">
              <Users size={48} className="mb-3 opacity-50" />
              <p>No agents found</p>
              <p className="text-sm">Create your first collection agent to get started</p>
            </div>
          ) : (
            <Table striped hover responsive>
              <thead className="table-dark">
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Mobile</th>
                  <th>Role</th>
                  <th>Department</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {agents.map(agent => (
                  <tr key={agent._id}>
                    <td>
                      <div className="d-flex align-items-center">
                        <div
                          className="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center me-2"
                          style={{ width: '32px', height: '32px', fontSize: '14px', fontWeight: 'bold' }}
                        >
                          {agent.name.charAt(0).toUpperCase()}
                        </div>
                        {agent.name}
                      </div>
                    </td>
                    <td>
                      <div className="d-flex align-items-center">
                        <Mail size={16} className="me-2 text-muted" />
                        {agent.email}
                      </div>
                    </td>
                    <td>
                      <div className="d-flex align-items-center">
                        <Phone size={16} className="me-2 text-muted" />
                        {agent.phone}
                      </div>
                    </td>
                    <td>
                      <Badge bg={
                        agent.roles?.includes('TEAM_LEAD') ? 'primary' :
                        agent.roles?.includes('SENIOR_AGENT') ? 'info' : 'secondary'
                      }>
                        {agent.roles?.includes('TEAM_LEAD') ? 'Team Lead' :
                         agent.roles?.includes('SENIOR_AGENT') ? 'Senior Agent' : 'Collection Agent'}
                      </Badge>
                    </td>
                    <td>{agent.department || 'COLLECTIONS'}</td>
                    <td>
                      <Badge bg={agent.isActive ? 'success' : 'danger'}>
                        {agent.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td>{new Date(agent.createdAt).toLocaleDateString()}</td>
                    <td>
                      <Dropdown>
                        <Dropdown.Toggle variant="outline-secondary" size="sm" id={`dropdown-${agent._id}`}>
                          <MoreVertical size={16} />
                        </Dropdown.Toggle>
                        <Dropdown.Menu>
                          <Dropdown.Item onClick={() => handleEdit(agent)}>
                            <Edit size={16} className="me-2" />
                            Edit
                          </Dropdown.Item>
                          <Dropdown.Item onClick={() => handleDelete(agent._id)}>
                            <Trash2 size={16} className="me-2" />
                            Delete
                          </Dropdown.Item>
                        </Dropdown.Menu>
                      </Dropdown>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>

      {/* Create Agent Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Create New Collection Agent</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && (
            <Alert variant="danger" className="mb-3">
              {error}
            </Alert>
          )}
          {success && (
            <Alert variant="success" className="mb-3">
              {success}
            </Alert>
          )}

          <Form onSubmit={handleSubmit}>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Full Name *</Form.Label>
                  <Form.Control
                    type="text"
                    name="name"
                    value={agentData.name}
                    onChange={handleInputChange}
                    placeholder="Enter full name"
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Email *</Form.Label>
                  <Form.Control
                    type="email"
                    name="email"
                    value={agentData.email}
                    onChange={handleInputChange}
                    placeholder="Enter email address"
                    required
                  />
                </Form.Group>
              </Col>
            </Row>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Mobile Number *</Form.Label>
                  <Form.Control
                    type="tel"
                    name="mobile"
                    value={agentData.mobile}
                    onChange={handleInputChange}
                    placeholder="Enter mobile number"
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Password *</Form.Label>
                  <Form.Control
                    type="password"
                    name="password"
                    value={agentData.password}
                    onChange={handleInputChange}
                    placeholder="Enter password"
                    required
                  />
                </Form.Group>
              </Col>
            </Row>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Role</Form.Label>
                  <Form.Select
                    name="role"
                    value={agentData.role}
                    onChange={handleInputChange}
                  >
                    <option value="COLLECTION_AGENT">Collection Agent</option>
                    <option value="SENIOR_AGENT">Senior Agent</option>
                    <option value="TEAM_LEAD">Team Lead</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Department</Form.Label>
                  <Form.Select
                    name="department"
                    value={agentData.department}
                    onChange={handleInputChange}
                  >
                    <option value="COLLECTIONS">Collections</option>
                    <option value="RECOVERY">Recovery</option>
                    <option value="LEGAL">Legal</option>
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Check
                type="checkbox"
                name="isActive"
                checked={agentData.isActive}
                onChange={handleInputChange}
                label="Active (Agent can login and access the system)"
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            <X className="me-2" size={16} />
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={loading || !agentData.name || !agentData.email || !agentData.mobile || !agentData.password}
          >
            <Save className="me-2" size={16} />
            {loading ? 'Creating...' : 'Create Agent'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  )
}
