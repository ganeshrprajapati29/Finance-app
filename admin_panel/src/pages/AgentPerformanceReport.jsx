import { useState, useEffect } from 'react'
import { Card, Table, Button, Badge, Alert, Row, Col, Form, InputGroup } from 'react-bootstrap'
import api from '../api/axios'
import { TrendingUp, Users, Phone, MapPin, DollarSign, Target } from 'lucide-react'

export default function AgentPerformanceReport(){
  const [performanceData, setPerformanceData] = useState([])
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({
    agentId: '',
    startDate: '',
    endDate: ''
  })

  const loadPerformanceData = async ()=>{
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.agentId) params.append('agentId', filters.agentId)
      if (filters.startDate) params.append('startDate', filters.startDate)
      if (filters.endDate) params.append('endDate', filters.endDate)

      const r = await api.get(`/admin/collections/agent-performance?${params}`)
      setPerformanceData(r.data.data)
    } catch (error) {
      console.error('Failed to load performance data:', error)
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
    loadAgents()
  }, [])

  useEffect(()=>{ 
    loadPerformanceData()
  }, [filters])

  const getPerformanceRating = (agent)=>{
    const totalCases = agent.totalAssigned
    const resolvedCases = agent.resolvedCases + agent.settledCases
    const successRate = totalCases > 0 ? (resolvedCases / totalCases) * 100 : 0
    const ptpKeptRate = agent.ptpCreated > 0 ? (agent.ptpKept / agent.ptpCreated) * 100 : 0

    if (successRate >= 80 && ptpKeptRate >= 70) return { rating: 'EXCELLENT', color: 'success' }
    if (successRate >= 60 && ptpKeptRate >= 50) return { rating: 'GOOD', color: 'primary' }
    if (successRate >= 40 && ptpKeptRate >= 30) return { rating: 'AVERAGE', color: 'warning' }
    return { rating: 'NEEDS_IMPROVEMENT', color: 'danger' }
  }

  const formatCurrency = (amount)=>{
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount)
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="mb-0">
          <TrendingUp className="me-2" />
          Agent Performance Report
        </h2>
      </div>

      <Alert variant="info" className="mb-4">
        <strong>Note:</strong> Monitor collection agent performance, track recovery rates,
        and identify top performers. Use this data to optimize collection strategies.
      </Alert>

      {/* Filters */}
      <Card className="mb-4">
        <Card.Header>
          <h5 className="mb-0">Filters</h5>
        </Card.Header>
        <Card.Body>
          <Row>
            <Col md={4}>
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
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>Start Date</Form.Label>
                <Form.Control
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters({...filters, startDate: e.target.value})}
                />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>End Date</Form.Label>
                <Form.Control
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters({...filters, endDate: e.target.value})}
                />
              </Form.Group>
            </Col>
          </Row>
          <Button variant="outline-secondary" onClick={() => setFilters({ agentId: '', startDate: '', endDate: '' })}>
            Clear Filters
          </Button>
        </Card.Body>
      </Card>

      {/* Summary Cards */}
      <Row className="mb-4">
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <Users size={32} className="text-primary mb-2" />
              <h4>{performanceData.length}</h4>
              <small className="text-muted">Active Agents</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <Target size={32} className="text-success mb-2" />
              <h4>{performanceData.reduce((sum, agent) => sum + agent.totalAssigned, 0)}</h4>
              <small className="text-muted">Total Cases Assigned</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <TrendingUp size={32} className="text-info mb-2" />
              <h4>
                {performanceData.length > 0
                  ? Math.round(performanceData.reduce((sum, agent) => {
                      const resolved = agent.resolvedCases + agent.settledCases
                      return sum + (agent.totalAssigned > 0 ? (resolved / agent.totalAssigned) * 100 : 0)
                    }, 0) / performanceData.length)
                  : 0}%
              </h4>
              <small className="text-muted">Avg Recovery Rate</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <DollarSign size={32} className="text-warning mb-2" />
              <h4>{formatCurrency(performanceData.reduce((sum, agent) => sum + agent.totalOverdueAmount, 0))}</h4>
              <small className="text-muted">Total Overdue Amount</small>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Performance Table */}
      <Card>
        <Card.Header>
          <h5 className="mb-0">Agent Performance Details</h5>
        </Card.Header>
        <Card.Body>
          {loading ? (
            <div className="text-center">Loading...</div>
          ) : performanceData.length === 0 ? (
            <div className="text-center text-muted py-5">
              <TrendingUp size={48} className="mb-3 opacity-50" />
              <p>No performance data found</p>
            </div>
          ) : (
            <Table striped hover responsive>
              <thead className="table-dark">
                <tr>
                  <th>Agent Name</th>
                  <th>Cases Assigned</th>
                  <th>Active Cases</th>
                  <th>Resolved Cases</th>
                  <th>Legal Cases</th>
                  <th>Settled Cases</th>
                  <th>Recovery Rate</th>
                  <th>Call Logs</th>
                  <th>Visit Logs</th>
                  <th>PTP Created</th>
                  <th>PTP Kept</th>
                  <th>PTP Success Rate</th>
                  <th>Performance Rating</th>
                </tr>
              </thead>
              <tbody>
                {performanceData.map(agent => {
                  const resolvedCases = agent.resolvedCases + agent.settledCases
                  const recoveryRate = agent.totalAssigned > 0 ? ((resolvedCases / agent.totalAssigned) * 100).toFixed(1) : 0
                  const ptpSuccessRate = agent.ptpCreated > 0 ? ((agent.ptpKept / agent.ptpCreated) * 100).toFixed(1) : 0
                  const performance = getPerformanceRating(agent)

                  return (
                    <tr key={agent.agent._id}>
                      <td>
                        <div>
                          <div className="fw-bold">{agent.agent.name}</div>
                          <small className="text-muted">{agent.agent.phone}</small>
                        </div>
                      </td>
                      <td>
                        <Badge bg="primary">{agent.totalAssigned}</Badge>
                      </td>
                      <td>
                        <Badge bg="warning">{agent.activeCases}</Badge>
                      </td>
                      <td>
                        <Badge bg="success">{agent.resolvedCases}</Badge>
                      </td>
                      <td>
                        <Badge bg="danger">{agent.legalCases}</Badge>
                      </td>
                      <td>
                        <Badge bg="info">{agent.settledCases}</Badge>
                      </td>
                      <td>
                        <div>
                          <div className="fw-bold">{recoveryRate}%</div>
                          <small className="text-muted">
                            {resolvedCases}/{agent.totalAssigned}
                          </small>
                        </div>
                      </td>
                      <td>
                        <div className="d-flex align-items-center">
                          <Phone size={16} className="me-1" />
                          {agent.callLogs}
                        </div>
                      </td>
                      <td>
                        <div className="d-flex align-items-center">
                          <MapPin size={16} className="me-1" />
                          {agent.visitLogs}
                        </div>
                      </td>
                      <td>
                        <Badge bg="secondary">{agent.ptpCreated}</Badge>
                      </td>
                      <td>
                        <Badge bg="success">{agent.ptpKept}</Badge>
                      </td>
                      <td>
                        <div>
                          <div className="fw-bold">{ptpSuccessRate}%</div>
                          <small className="text-muted">
                            {agent.ptpKept}/{agent.ptpCreated}
                          </small>
                        </div>
                      </td>
                      <td>
                        <Badge bg={performance.color}>
                          {performance.rating.replace('_', ' ')}
                        </Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>
    </div>
  )
}
