import React, { useState, useEffect } from 'react';
import axios from '../api/axios';
import { toast } from 'react-toastify';
import { Table, Card, Row, Col, Badge, Button, Modal, Form, Spinner, Alert } from 'react-bootstrap';

const EmployeeHistory = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    permissions: {
      canManageUsers: false,
      canManageLoans: false,
      canManagePayments: false,
      canManageSupport: false,
      canSendNotifications: false,
      canViewAudit: false,
      canManageSettings: false,
    },
  });

  useEffect(() => {
    fetchEmployeeHistory();
  }, []);

  const fetchEmployeeHistory = async () => {
    try {
      const adminTokens = localStorage.getItem('kp_tokens');
      const employeeTokens = localStorage.getItem('kp_employee_tokens');

      let endpoint = '/employee-history/history';
      let useAdminEndpoint = false;

      if (adminTokens) {
        endpoint = '/employees';
        useAdminEndpoint = true;
      }

      const response = await axios.get(endpoint);
      const responseData = response.data.data || response.data;
      const employees = Array.isArray(responseData) ? responseData : [];

      const historyData = employees.map(employee => ({
        _id: employee._id,
        name: employee.name,
        email: employee.email,
        phone: employee.phone,
        createdAt: employee.createdAt || new Date().toISOString(),
        status: employee.status || 'active',
        permissions: employee.permissions
      }));

      setHistory(historyData);
    } catch (error) {
      console.error('Error fetching employee history:', error);
      toast.error('❌ Failed to fetch employee history');
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (employee) => {
    setEditingEmployee(employee);
    setFormData({
      name: employee.name,
      email: employee.email,
      phone: employee.phone,
      permissions: { ...employee.permissions },
    });
    setShowModal(true);
  };

  const handleStatusToggle = async (employee) => {
    try {
      const newStatus = employee.status === 'active' ? 'inactive' : 'active';
      await axios.put(`/employees/${employee._id}`, { status: newStatus });
      toast.success(`✅ Employee ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully`);
      fetchEmployeeHistory();
    } catch (error) {
      toast.error('❌ Failed to update employee status');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await axios.put(`/employees/${editingEmployee._id}`, formData);
      toast.success('✅ Employee updated successfully');
      setShowModal(false);
      setEditingEmployee(null);
      fetchEmployeeHistory();
    } catch (error) {
      toast.error('❌ ' + (error.response?.data?.message || 'Operation failed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handlePermissionChange = (permission, value) => {
    setFormData(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [permission]: value,
      },
    }));
  };

  const getPermissionIcon = (permission) => {
    const icons = {
      canManageUsers: '👤',
      canManageLoans: '💰',
      canManagePayments: '💳',
      canManageSupport: '🎟️',
      canSendNotifications: '📢',
      canViewAudit: '📜',
      canManageSettings: '⚙️'
    };
    return icons[permission] || '🔐';
  };

  const getPermissionLabel = (permission) => {
    return permission.replace('can', '').replace(/([A-Z])/g, ' $1').trim();
  };

  const getStats = () => {
    return {
      total: history.length,
      active: history.filter(e => e.status === 'active').length,
      inactive: history.filter(e => e.status === 'inactive').length,
      recent: history.filter(e => {
        const daysAgo = (new Date() - new Date(e.createdAt)) / (1000 * 60 * 60 * 24);
        return daysAgo <= 7;
      }).length
    };
  };

  const filteredHistory = filterStatus === 'ALL' 
    ? history 
    : history.filter(e => e.status === filterStatus);

  const stats = getStats();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <Spinner animation="border" style={{ color: '#1abc9c' }} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f5f7fa 0%, #e9ecef 100%)', padding: '40px 20px' }}>
      
      {/* Premium Header */}
      <div style={{ 
        background: 'linear-gradient(135deg, #001f5c 0%, #003d99 100%)',
        borderRadius: '16px',
        padding: '35px',
        marginBottom: '35px',
        boxShadow: '0 15px 50px rgba(0, 31, 92, 0.2)',
        color: 'white'
      }}>
        <Row className="align-items-center">
          <Col md={8}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{
                width: '70px',
                height: '70px',
                background: 'linear-gradient(135deg, #1abc9c 0%, #16a085 100%)',
                borderRadius: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '40px',
                fontWeight: 'bold',
                boxShadow: '0 10px 30px rgba(26, 188, 156, 0.3)'
              }}>
                📜
              </div>
              <div>
                <h2 style={{ margin: 0, fontWeight: '700', fontSize: '28px' }}>Employee History</h2>
                <p style={{ margin: '8px 0 0 0', opacity: 0.9, fontSize: '14px' }}>KhatuPay - Employee Creation History & Management</p>
              </div>
            </div>
          </Col>
        </Row>
      </div>

      {/* Statistics Cards */}
      <Row className="mb-4" style={{ display: 'flex', gap: '15px' }}>
        <Col style={{ flex: 1, minWidth: '150px' }}>
          <Card style={{ border: 'none', borderRadius: '12px', boxShadow: '0 5px 20px rgba(0, 31, 92, 0.1)', overflow: 'hidden', height: '100%' }}>
            <Card.Body style={{ padding: '20px', background: 'linear-gradient(135deg, rgba(26, 188, 156, 0.1) 0%, rgba(22, 160, 133, 0.05) 100%)' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '28px', fontWeight: '700', color: '#1abc9c', marginBottom: '8px' }}>{stats.total}</div>
                <div style={{ color: '#6c757d', fontWeight: '600', fontSize: '13px' }}>📋 Total Created</div>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col style={{ flex: 1, minWidth: '150px' }}>
          <Card style={{ border: 'none', borderRadius: '12px', boxShadow: '0 5px 20px rgba(0, 31, 92, 0.1)', overflow: 'hidden', height: '100%' }}>
            <Card.Body style={{ padding: '20px', background: 'linear-gradient(135deg, rgba(40, 167, 69, 0.1) 0%, rgba(32, 130, 55, 0.05) 100%)' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '28px', fontWeight: '700', color: '#28a745', marginBottom: '8px' }}>{stats.active}</div>
                <div style={{ color: '#6c757d', fontWeight: '600', fontSize: '13px' }}>✅ Active</div>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col style={{ flex: 1, minWidth: '150px' }}>
          <Card style={{ border: 'none', borderRadius: '12px', boxShadow: '0 5px 20px rgba(0, 31, 92, 0.1)', overflow: 'hidden', height: '100%' }}>
            <Card.Body style={{ padding: '20px', background: 'linear-gradient(135deg, rgba(220, 53, 69, 0.1) 0%, rgba(200, 35, 51, 0.05) 100%)' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '28px', fontWeight: '700', color: '#dc3545', marginBottom: '8px' }}>{stats.inactive}</div>
                <div style={{ color: '#6c757d', fontWeight: '600', fontSize: '13px' }}>❌ Inactive</div>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col style={{ flex: 1, minWidth: '150px' }}>
          <Card style={{ border: 'none', borderRadius: '12px', boxShadow: '0 5px 20px rgba(0, 31, 92, 0.1)', overflow: 'hidden', height: '100%' }}>
            <Card.Body style={{ padding: '20px', background: 'linear-gradient(135deg, rgba(255, 193, 7, 0.1) 0%, rgba(255, 152, 0, 0.05) 100%)' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '28px', fontWeight: '700', color: '#ffc107', marginBottom: '8px' }}>{stats.recent}</div>
                <div style={{ color: '#6c757d', fontWeight: '600', fontSize: '13px' }}>⭐ Last 7 Days</div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Filter Card */}
      <Card style={{
        border: 'none',
        borderRadius: '16px',
        boxShadow: '0 15px 50px rgba(0, 31, 92, 0.1)',
        marginBottom: '25px',
        overflow: 'hidden'
      }}>
        <Card.Body style={{ padding: '20px', background: '#f8f9fa' }}>
          <Row className="g-3">
            <Col md={4}>
              <Form.Group>
                <Form.Label style={{ fontWeight: '700', color: '#001f5c', marginBottom: '8px' }}>Filter by Status</Form.Label>
                <Form.Select 
                  value={filterStatus} 
                  onChange={(e) => setFilterStatus(e.target.value)}
                  style={{ 
                    borderRadius: '8px', 
                    border: '2px solid #dee2e6', 
                    padding: '10px 12px',
                    fontWeight: '500'
                  }}
                >
                  <option value="ALL">All Employees</option>
                  <option value="active">✅ Active</option>
                  <option value="inactive">❌ Inactive</option>
                </Form.Select>
              </Form.Group>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* History Table */}
      <Card style={{
        border: 'none',
        borderRadius: '16px',
        boxShadow: '0 15px 50px rgba(0, 31, 92, 0.1)',
        overflow: 'hidden'
      }}>
        <Card.Header style={{ background: 'linear-gradient(135deg, #001f5c 0%, #003d99 100%)', color: 'white', padding: '20px', fontWeight: '700', fontSize: '16px' }}>
          📜 Employee Creation History
        </Card.Header>
        <Card.Body style={{ padding: '0' }}>
          {filteredHistory.length === 0 ? (
            <Alert variant="info" style={{ margin: '30px', borderRadius: '8px' }}>
              📭 No employee history available
            </Alert>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <Table striped hover responsive style={{ marginBottom: '0' }}>
                <thead style={{ background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)', borderBottom: '2px solid #dee2e6' }}>
                  <tr>
                    <th style={{ padding: '18px', fontWeight: '700', color: '#001f5c' }}>Employee</th>
                    <th style={{ padding: '18px', fontWeight: '700', color: '#001f5c' }}>Created Date</th>
                    <th style={{ padding: '18px', fontWeight: '700', color: '#001f5c' }}>Status</th>
                    <th style={{ padding: '18px', fontWeight: '700', color: '#001f5c' }}>Permissions</th>
                    <th style={{ padding: '18px', fontWeight: '700', color: '#001f5c' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map((employee) => (
                    <tr key={employee._id} style={{ borderBottom: '1px solid #dee2e6', transition: 'background-color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                      <td style={{ padding: '16px' }}>
                        <div style={{ fontWeight: '700', color: '#001f5c', marginBottom: '4px' }}>👤 {employee.name}</div>
                        <div style={{ color: '#6c757d', fontSize: '13px', marginBottom: '4px' }}>📧 {employee.email}</div>
                        <div style={{ color: '#6c757d', fontSize: '13px' }}>📱 {employee.phone}</div>
                      </td>
                      <td style={{ padding: '16px', color: '#495057', fontSize: '13px', fontWeight: '600' }}>
                        🕐 {new Date(employee.createdAt).toLocaleDateString('en-IN', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td style={{ padding: '16px' }}>
                        <Button
                          onClick={() => handleStatusToggle(employee)}
                          style={{
                            background: employee.status === 'active' ? '#d4edda' : '#f8d7da',
                            color: employee.status === 'active' ? '#155724' : '#721c24',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '8px 12px',
                            fontWeight: '600',
                            fontSize: '12px',
                            cursor: 'pointer',
                            transition: 'all 0.3s'
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.opacity = '0.8';
                            e.target.style.transform = 'scale(1.05)';
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.opacity = '1';
                            e.target.style.transform = 'scale(1)';
                          }}
                        >
                          {employee.status === 'active' ? '✅ Active' : '❌ Inactive'}
                        </Button>
                      </td>
                      <td style={{ padding: '16px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {Object.entries(employee.permissions)
                            .filter(([_, value]) => value)
                            .map(([key, _]) => (
                              <Badge key={key} style={{ background: '#1abc9c', padding: '6px 10px', borderRadius: '4px', fontWeight: '600', fontSize: '11px' }}>
                                {getPermissionIcon(key)} {getPermissionLabel(key).substring(0, 8)}
                              </Badge>
                            ))}
                          {Object.values(employee.permissions).every(v => !v) && (
                            <span style={{ color: '#6c757d', fontSize: '13px' }}>No permissions</span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '16px' }}>
                        <Button 
                          size="sm" 
                          variant="outline-primary"
                          onClick={() => handleEdit(employee)}
                          style={{ borderRadius: '6px', fontWeight: '600', fontSize: '12px' }}
                        >
                          ✏️ Edit
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Edit Employee Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)} centered size="lg">
        <Modal.Header closeButton style={{ background: 'linear-gradient(135deg, #001f5c 0%, #003d99 100%)', color: 'white', border: 'none' }}>
          <Modal.Title style={{ fontWeight: '700' }}>✏️ Edit Employee</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: '30px', background: '#f8f9fa' }}>
          <Form onSubmit={handleSubmit}>
            {/* Basic Info */}
            <Card style={{ border: 'none', borderRadius: '12px', boxShadow: '0 5px 20px rgba(0, 31, 92, 0.1)', marginBottom: '20px' }}>
              <Card.Header style={{ background: 'linear-gradient(135deg, #1abc9c 0%, #16a085 100%)', color: 'white', fontWeight: '700', borderRadius: '12px 12px 0 0', border: 'none', padding: '15px' }}>
                📋 Basic Information
              </Card.Header>
              <Card.Body style={{ padding: '20px' }}>
                <Row className="g-3">
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label style={{ fontWeight: '700', color: '#001f5c', marginBottom: '8px' }}>👤 Name</Form.Label>
                      <Form.Control
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Enter name"
                        style={{ borderRadius: '8px', border: '2px solid #dee2e6', padding: '10px 12px', fontWeight: '500' }}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label style={{ fontWeight: '700', color: '#001f5c', marginBottom: '8px' }}>📧 Email</Form.Label>
                      <Form.Control
                        type="email"
                        disabled
                        value={formData.email}
                        style={{ borderRadius: '8px', border: '2px solid #dee2e6', padding: '10px 12px', fontWeight: '500', background: '#e9ecef' }}
                      />
                      <Form.Text style={{ color: '#6c757d', marginTop: '5px', display: 'block' }}>
                        Email cannot be changed
                      </Form.Text>
                    </Form.Group>
                  </Col>
                  <Col md={12}>
                    <Form.Group>
                      <Form.Label style={{ fontWeight: '700', color: '#001f5c', marginBottom: '8px' }}>📱 Phone</Form.Label>
                      <Form.Control
                        type="tel"
                        required
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="Enter phone number"
                        style={{ borderRadius: '8px', border: '2px solid #dee2e6', padding: '10px 12px', fontWeight: '500' }}
                      />
                    </Form.Group>
                  </Col>
                </Row>
              </Card.Body>
            </Card>

            {/* Permissions */}
            <Card style={{ border: 'none', borderRadius: '12px', boxShadow: '0 5px 20px rgba(0, 31, 92, 0.1)' }}>
              <Card.Header style={{ background: 'linear-gradient(135deg, #1abc9c 0%, #16a085 100%)', color: 'white', fontWeight: '700', borderRadius: '12px 12px 0 0', border: 'none', padding: '15px' }}>
                🔐 Permissions
              </Card.Header>
              <Card.Body style={{ padding: '20px' }}>
                <Row className="g-3">
                  {Object.entries(formData.permissions).map(([permission, value]) => (
                    <Col md={6} key={permission}>
                      <Form.Check
                        type="checkbox"
                        id={permission}
                        label={
                          <span style={{ fontWeight: '600', color: '#001f5c' }}>
                            {getPermissionIcon(permission)} {getPermissionLabel(permission)}
                          </span>
                        }
                        checked={value}
                        onChange={(e) => handlePermissionChange(permission, e.target.checked)}
                        style={{ cursor: 'pointer' }}
                      />
                    </Col>
                  ))}
                </Row>
              </Card.Body>
            </Card>
          </Form>
        </Modal.Body>
        <Modal.Footer style={{ borderTop: '1px solid #dee2e6', padding: '20px', background: '#f8f9fa' }}>
          <Button 
            variant="secondary" 
            onClick={() => {
              setShowModal(false);
              setEditingEmployee(null);
            }}
            style={{ borderRadius: '8px', fontWeight: '600' }}
          >
            Cancel
          </Button>
          <Button 
            variant="primary" 
            onClick={handleSubmit}
            disabled={submitting}
            style={{ 
              background: 'linear-gradient(135deg, #1abc9c 0%, #16a085 100%)',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {submitting ? (
              <>
                <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" />
                Updating...
              </>
            ) : (
              <>
                💾 Update Employee
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default EmployeeHistory;