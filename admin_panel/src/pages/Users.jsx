import { useEffect, useState } from 'react'
import { Table, Button, Form, Modal, Spinner, Alert } from 'react-bootstrap'
import api from '../api/axios'
import { Search, Edit, Lock, Unlock, Eye, AlertCircle, RefreshCw, Trash2 } from 'lucide-react'
import 'bootstrap/dist/css/bootstrap.min.css'

export default function Users(){
  const [rows, setRows] = useState([])
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actionLoading, setActionLoading] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [modalData, setModalData] = useState({ userId: null, amount: '', name: '' })

  const load = async () => {
    try {
      setLoading(true)
      setError(null)
      const r = await api.get('/admin/users')
      setRows(r.data.data)
    } catch (err) {
      console.error('Failed to load users:', err)
      setError(err.message || 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const setLimit = (id, userName) => {
    const user = rows.find(r => r._id === id)
    setModalData({
      userId: id,
      name: userName,
      amount: user?.loanLimit?.amount || ''
    })
    setShowModal(true)
  }

  const handleSetLimit = async () => {
    if (!modalData.amount || isNaN(modalData.amount)) {
      alert('Please enter a valid amount')
      return
    }
    try {
      setActionLoading('limit')
      await api.put(`/admin/users/${modalData.userId}/limit`, { amount: Number(modalData.amount) })
      await load()
      setShowModal(false)
      alert('Loan limit updated successfully')
    } catch (err) {
      alert('Failed to update loan limit: ' + err.message)
    } finally {
      setActionLoading(null)
    }
  }

  const setStatus = async (id, status) => {
    try {
      setActionLoading(`status-${id}`)
      await api.put(`/admin/users/${id}/status`, { status })
      await load()
      alert(`User ${status} successfully`)
    } catch (err) {
      alert('Failed to update user status: ' + err.message)
    } finally {
      setActionLoading(null)
    }
  }

  const filteredRows = rows.filter(r =>
    JSON.stringify(r).toLowerCase().includes(filter.toLowerCase())
  )

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
        <div style={{ textAlign: 'center' }}>
          <Spinner animation="border" role="status" style={{ color: '#0066FF', marginBottom: '16px' }} />
          <p style={{ color: '#64748B', fontWeight: '600' }}>Loading users...</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: '900', color: '#0F172A', margin: 0, marginBottom: '4px' }}>
              Users Management
            </h1>
            <p style={{ color: '#64748B', fontSize: '14px', margin: 0, fontWeight: '500' }}>
              Manage user accounts, set loan limits, and control access
            </p>
          </div>
          <button
            onClick={load}
            style={{
              background: '#0066FF',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              padding: '10px 20px',
              fontWeight: '700',
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            <RefreshCw size={18} />
            Refresh
          </button>
        </div>

        {error && (
          <Alert variant="danger" style={{ borderRadius: '12px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <AlertCircle size={20} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </Alert>
        )}

        {/* Search Bar */}
        <div style={{
          background: 'linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 100%)',
          border: '2px solid #E2E8F0',
          borderRadius: '12px',
          padding: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <Search size={20} style={{ color: '#94A3B8', flexShrink: 0 }} />
          <Form.Control
            placeholder="Search by name, email, mobile, or status..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
            style={{
              border: 'none',
              background: 'transparent',
              fontSize: '15px',
              fontWeight: '500',
              color: '#0F172A'
            }}
          />
        </div>
      </div>

      {/* Table */}
      <div style={{
        background: 'linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 100%)',
        borderRadius: '14px',
        border: '1px solid #E2E8F0',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.06)',
        overflow: 'hidden'
      }}>
        {filteredRows.length === 0 ? (
          <div style={{
            padding: '60px 40px',
            textAlign: 'center',
            color: '#94A3B8'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
            <h3 style={{ color: '#0F172A', marginBottom: '8px' }}>No users found</h3>
            <p style={{ margin: 0 }}>Try adjusting your search filters</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <Table hover responsive style={{ marginBottom: 0 }}>
              <thead style={{
                background: 'linear-gradient(135deg, #F1F5F9 0%, #E2E8F0 100%)',
                borderBottom: '2px solid #E2E8F0'
              }}>
                <tr>
                  <th style={{ fontWeight: '800', color: '#0F172A', padding: '16px', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Name</th>
                  <th style={{ fontWeight: '800', color: '#0F172A', padding: '16px', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Email</th>
                  <th style={{ fontWeight: '800', color: '#0F172A', padding: '16px', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Mobile</th>
                  <th style={{ fontWeight: '800', color: '#0F172A', padding: '16px', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</th>
                  <th style={{ fontWeight: '800', color: '#0F172A', padding: '16px', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Roles</th>
                  <th style={{ fontWeight: '800', color: '#0F172A', padding: '16px', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Loan Limit</th>
                  <th style={{ fontWeight: '800', color: '#0F172A', padding: '16px', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r, idx) => (
                  <tr
                    key={r._id}
                    style={{
                      borderBottom: '1px solid #E2E8F0',
                      transition: 'all 0.3s ease',
                      background: idx % 2 === 0 ? 'transparent' : 'rgba(0, 102, 255, 0.02)'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0, 102, 255, 0.06)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = idx % 2 === 0 ? 'transparent' : 'rgba(0, 102, 255, 0.02)'}
                  >
                    <td style={{ padding: '16px', fontWeight: '700', color: '#0F172A', fontSize: '14px' }}>
                      {r.name}
                    </td>
                    <td style={{ padding: '16px', color: '#64748B', fontSize: '14px', fontWeight: '500' }}>
                      {r.email}
                    </td>
                    <td style={{ padding: '16px', color: '#64748B', fontSize: '14px', fontWeight: '500' }}>
                      {r.mobile}
                    </td>
                    <td style={{ padding: '16px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 12px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: '700',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          background: r.status === 'active' ? '#D1FAE5' : '#FEE2E2',
                          color: r.status === 'active' ? '#065F46' : '#991B1B'
                        }}
                      >
                        <span
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: r.status === 'active' ? '#10B981' : '#EF4444',
                            display: 'inline-block'
                          }}
                        />
                        {r.status}
                      </span>
                    </td>
                    <td style={{ padding: '16px', color: '#64748B', fontSize: '14px', fontWeight: '500' }}>
                      {(r.roles || []).length > 0 ? (r.roles || []).join(', ') : '—'}
                    </td>
                    <td style={{ padding: '16px', fontSize: '14px', fontWeight: '700', color: '#0F172A' }}>
                      ₹ {(r.loanLimit?.amount || 0).toLocaleString()}
                    </td>
                    <td style={{ padding: '16px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <button
                          onClick={() => setLimit(r._id, r.name)}
                          disabled={actionLoading === 'limit'}
                          style={{
                            background: '#0066FF',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '6px 12px',
                            fontSize: '12px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            transition: 'all 0.3s ease',
                            opacity: actionLoading === 'limit' ? 0.7 : 1
                          }}
                          onMouseEnter={(e) => {
                            if (!actionLoading) e.currentTarget.style.background = '#0052CC'
                          }}
                          onMouseLeave={(e) => e.currentTarget.style.background = '#0066FF'}
                        >
                          <Edit size={14} />
                          Set Limit
                        </button>

                        {r.status === 'active' ? (
                          <button
                            onClick={() => setStatus(r._id, 'blocked')}
                            disabled={actionLoading === `status-${r._id}`}
                            style={{
                              background: '#FF8A00',
                              color: 'white',
                              border: 'none',
                              borderRadius: '8px',
                              padding: '6px 12px',
                              fontSize: '12px',
                              fontWeight: '700',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              transition: 'all 0.3s ease',
                              opacity: actionLoading === `status-${r._id}` ? 0.7 : 1
                            }}
                            onMouseEnter={(e) => {
                              if (!actionLoading) e.currentTarget.style.background = '#E67E00'
                            }}
                            onMouseLeave={(e) => e.currentTarget.style.background = '#FF8A00'}
                          >
                            <Lock size={14} />
                            Block
                          </button>
                        ) : (
                          <button
                            onClick={() => setStatus(r._id, 'active')}
                            disabled={actionLoading === `status-${r._id}`}
                            style={{
                              background: '#10B981',
                              color: 'white',
                              border: 'none',
                              borderRadius: '8px',
                              padding: '6px 12px',
                              fontSize: '12px',
                              fontWeight: '700',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              transition: 'all 0.3s ease',
                              opacity: actionLoading === `status-${r._id}` ? 0.7 : 1
                            }}
                            onMouseEnter={(e) => {
                              if (!actionLoading) e.currentTarget.style.background = '#059669'
                            }}
                            onMouseLeave={(e) => e.currentTarget.style.background = '#10B981'}
                          >
                            <Unlock size={14} />
                            Unblock
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </div>

      {/* Summary */}
      <div style={{ marginTop: '20px', display: 'flex', gap: '16px' }}>
        <div style={{
          background: 'linear-gradient(135deg, #D1FAE5 0%, #A7F3D0 100%)',
          border: '2px solid #10B981',
          borderRadius: '12px',
          padding: '16px',
          flex: 1,
          fontWeight: '700',
          color: '#065F46'
        }}>
          Active Users: {rows.filter(r => r.status === 'active').length}
        </div>
        <div style={{
          background: 'linear-gradient(135deg, #FEE2E2 0%, #FECACA 100%)',
          border: '2px solid #EF4444',
          borderRadius: '12px',
          padding: '16px',
          flex: 1,
          fontWeight: '700',
          color: '#991B1B'
        }}>
          Blocked Users: {rows.filter(r => r.status === 'blocked').length}
        </div>
        <div style={{
          background: 'linear-gradient(135deg, #DBEAFE 0%, #BFDBFE 100%)',
          border: '2px solid #0066FF',
          borderRadius: '12px',
          padding: '16px',
          flex: 1,
          fontWeight: '700',
          color: '#003D99'
        }}>
          Total Users: {rows.length}
        </div>
      </div>

      {/* Set Limit Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)} centered style={{ backdropFilter: 'blur(4px)' }}>
        <Modal.Header style={{
          background: 'linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 100%)',
          borderBottom: '2px solid #E2E8F0'
        }}>
          <Modal.Title style={{ fontWeight: '800', color: '#0F172A' }}>Set Loan Limit</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: '24px' }}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '700', color: '#0F172A', fontSize: '14px' }}>
              User: {modalData.name}
            </label>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '700', color: '#0F172A', fontSize: '14px' }}>
              Loan Limit (₹)
            </label>
            <Form.Control
              type="number"
              value={modalData.amount}
              onChange={(e) => setModalData({ ...modalData, amount: e.target.value })}
              placeholder="Enter amount"
              style={{
                borderRadius: '10px',
                border: '2px solid #E2E8F0',
                padding: '12px 16px',
                fontSize: '15px',
                fontWeight: '600'
              }}
              disabled={actionLoading === 'limit'}
            />
          </div>
        </Modal.Body>
        <Modal.Footer style={{
          background: 'linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)',
          borderTop: '2px solid #E2E8F0',
          padding: '16px 24px'
        }}>
          <button
            onClick={() => setShowModal(false)}
            style={{
              background: '#E2E8F0',
              color: '#0F172A',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 20px',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#CBD5E1'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#E2E8F0'}
          >
            Cancel
          </button>
          <button
            onClick={handleSetLimit}
            disabled={actionLoading === 'limit'}
            style={{
              background: '#0066FF',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 20px',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              opacity: actionLoading === 'limit' ? 0.7 : 1
            }}
            onMouseEnter={(e) => {
              if (!actionLoading) e.currentTarget.style.background = '#0052CC'
            }}
            onMouseLeave={(e) => e.currentTarget.style.background = '#0066FF'}
          >
            {actionLoading === 'limit' ? 'Saving...' : 'Save Limit'}
          </button>
        </Modal.Footer>
      </Modal>
    </div>
  )
}