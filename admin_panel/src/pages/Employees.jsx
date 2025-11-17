import React, { useState, useEffect } from 'react';
import axios from '../api/axios';
import { toast } from 'react-toastify';
import { Table, Button, Modal, Form, Badge, Row, Col, Card, Spinner, Alert } from 'react-bootstrap';

const Employees = () => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    roles: ['employee'],
    permissions: {
      canManageUsers: false,
      canManageLoans: false,
      canManagePayments: false,
      canManageSupport: true,
      canSendNotifications: false,
      canViewAudit: false,
      canManageSettings: false,
    },
  });

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const response = await axios.get('/employees');
      const responseData = response.data.data || response.data;
      setEmployees(Array.isArray(responseData) ? responseData : []);
    } catch (error) {
      toast.error('Failed to fetch employees');
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingEmployee) {
        await axios.put(`/employees/${editingEmployee._id}`, formData);
        toast.success('✅ Employee updated successfully');
      } else {
        const response = await axios.post('/employees', formData);
        toast.success('✅ Employee created successfully');
        const { email, password } = formData;
        toast.info(`📋 Employee Login Credentials:\nEmail: ${email}\nPassword: ${password}`, {
          autoClose: 10000,
          position: "top-center"
        });
      }
      setShowModal(false);
      setEditingEmployee(null);
      resetForm();
      setTimeout(() => {
        fetchEmployees();
      }, 500);
    } catch (error) {
      toast.error('❌ ' + (error.response?.data?.message || 'Operation failed'));
    } finally {
      setSubmitting(false);
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

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this employee?')) return;
    try {
      await axios.delete(`/employees/${id}`);
      toast.success('✅ Employee deleted successfully');
      fetchEmployees();
    } catch (error) {
      toast.error('❌ Failed to delete employee');
    }
  };

  const handleResetPassword = async (id) => {
    if (!window.confirm('Are you sure you want to reset this employee\'s password?')) return;
    try {
      await axios.post(`/employees/${id}/reset-password`);
      toast.success('✅ Password reset successfully');
    } catch (error) {
      toast.error('❌ Failed to reset password');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      password: '',
      roles: ['employee'],
      permissions: {
        canManageUsers: false,
        canManageLoans: false,
        canManagePayments: false,
        canManageSupport: true,
        canSendNotifications: false,
        canViewAudit: false,
        canManageSettings: false,
      },
    });
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
      total: employees.length,
      active: employees.filter(e => e.status === 'active').length,
      inactive: employees.filter(e => e.status === 'inactive').length
    };
  };

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
                👥
              </div>
              <div>
                <h2 style={{ margin: 0, fontWeight: '700', fontSize: '28px' }}>Employee Management</h2>
                <p style={{ margin: '8px 0 0 0', opacity: 0.9, fontSize: '14px' }}>KhatuPay - Manage Your Team</p>
              </div>
            </div>
          </Col>
          <Col md={4} className="text-end">
            <Button
              onClick={() => {
                setEditingEmployee(null);
                resetForm();
                setShowModal(true);
              }}
              style={{ 
                background: 'linear-gradient(135deg, #1abc9c 0%, #16a085 100%)',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '700',
                padding: '10px 25px'
              }}
            >
              ➕ Add Employee
            </Button>
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
                <div style={{ color: '#6c757d', fontWeight: '600', fontSize: '13px' }}>👥 Total Employees</div>
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
      </Row>

      {/* Employees Table */}
      <Card style={{
        border: 'none',
        borderRadius: '16px',
        boxShadow: '0 15px 50px rgba(0, 31, 92, 0.1)',
        overflow: 'hidden'
      }}>
        <Card.Header style={{ background: 'linear-gradient(135deg, #001f5c 0%, #003d99 100%)', color: 'white', padding: '20px', fontWeight: '700', fontSize: '16px' }}>
          👥 Team Members
        </Card.Header>
        <Card.Body style={{ padding: '0' }}>
          {employees.length === 0 ? (
            <Alert variant="info" style={{ margin: '30px', borderRadius: '8px' }}>
              📭 No employees found. Add your first employee to get started!
            </Alert>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <Table striped hover responsive style={{ marginBottom: '0' }}>
                <thead style={{ background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)', borderBottom: '2px solid #dee2e6' }}>
                  <tr>
                    <th style={{ padding: '18px', fontWeight: '700', color: '#001f5c' }}>Employee</th>
                    <th style={{ padding: '18px', fontWeight: '700', color: '#001f5c' }}>Permissions</th>
                    <th style={{ padding: '18px', fontWeight: '700', color: '#001f5c' }}>Status</th>
                    <th style={{ padding: '18px', fontWeight: '700', color: '#001f5c' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((employee) => (
                    <tr key={employee._id} style={{ borderBottom: '1px solid #dee2e6', transition: 'background-color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                      <td style={{ padding: '16px' }}>
                        <div style={{ fontWeight: '700', color: '#001f5c', marginBottom: '4px' }}>👤 {employee.name}</div>
                        <div style={{ color: '#6c757d', fontSize: '13px', marginBottom: '4px' }}>📧 {employee.email}</div>
                        <div style={{ color: '#6c757d', fontSize: '13px' }}>📱 {employee.phone}</div>
                      </td>
                      <td style={{ padding: '16px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {Object.entries(employee.permissions)
                            .filter(([_, value]) => value)
                            .map(([key, _]) => (
                              <Badge key={key} style={{ background: '#1abc9c', padding: '6px 10px', borderRadius: '4px', fontWeight: '600', fontSize: '11px' }}>
                                {getPermissionIcon(key)} {getPermissionLabel(key)}
                              </Badge>
                            ))}
                          {Object.values(employee.permissions).every(v => !v) && (
                            <span style={{ color: '#6c757d', fontSize: '13px' }}>No permissions</span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '16px' }}>
                        <Badge bg={employee.status === 'active' ? 'success' : 'danger'} style={{ padding: '8px 12px', borderRadius: '6px', fontWeight: '600' }}>
                          {employee.status === 'active' ? '✅ Active' : '❌ Inactive'}
                        </Badge>
                      </td>
                      <td style={{ padding: '16px' }}>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <Button 
                            size="sm" 
                            variant="outline-primary"
                            onClick={() => handleEdit(employee)}
                            style={{ borderRadius: '6px', fontWeight: '600', fontSize: '12px' }}
                          >
                            ✏️ Edit
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline-warning"
                            onClick={() => handleResetPassword(employee._id)}
                            style={{ borderRadius: '6px', fontWeight: '600', fontSize: '12px' }}
                          >
                            🔑 Reset
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline-danger"
                            onClick={() => handleDelete(employee._id)}
                            style={{ borderRadius: '6px', fontWeight: '600', fontSize: '12px' }}
                          >
                            🗑️ Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Add/Edit Employee Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)} centered size="lg">
        <Modal.Header closeButton style={{ background: 'linear-gradient(135deg, #001f5c 0%, #003d99 100%)', color: 'white', border: 'none' }}>
          <Modal.Title style={{ fontWeight: '700' }}>
            {editingEmployee ? '✏️ Edit Employee' : '➕ Add New Employee'}
          </Modal.Title>
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
                      <Form.Label style={{ fontWeight: '700', color: '#001f5c', marginBottom: '8px' }}>👤 Full Name</Form.Label>
                      <Form.Control
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Enter full name"
                        style={{ borderRadius: '8px', border: '2px solid #dee2e6', padding: '10px 12px', fontWeight: '500' }}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label style={{ fontWeight: '700', color: '#001f5c', marginBottom: '8px' }}>📧 Email</Form.Label>
                      <Form.Control
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="Enter email"
                        style={{ borderRadius: '8px', border: '2px solid #dee2e6', padding: '10px 12px', fontWeight: '500' }}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
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
                  {!editingEmployee && (
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label style={{ fontWeight: '700', color: '#001f5c', marginBottom: '8px' }}>🔐 Password</Form.Label>
                        <Form.Control
                          type="password"
                          required
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          placeholder="Create password"
                          style={{ borderRadius: '8px', border: '2px solid #dee2e6', padding: '10px 12px', fontWeight: '500' }}
                        />
                      </Form.Group>
                    </Col>
                  )}
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
              resetForm();
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
                {editingEmployee ? 'Updating...' : 'Creating...'}
              </>
            ) : (
              <>
                {editingEmployee ? '💾 Update Employee' : '➕ Create Employee'}
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default Employees;