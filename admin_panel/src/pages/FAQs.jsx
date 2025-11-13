import { useEffect, useState } from 'react'
import { Table, Button, Form, Row, Col, Card, Spinner, Alert, Modal } from 'react-bootstrap'
import api from '../api/axios'
import { Plus, Trash2, AlertCircle, RefreshCw, Edit2, Check, X } from 'lucide-react'
import 'bootstrap/dist/css/bootstrap.min.css'

export default function FAQs(){
  const [rows, setRows] = useState([])
  const [q, setQ] = useState('')
  const [a, setA] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [error, setError] = useState(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const load = async () => {
    try {
      setLoading(true)
      setError(null)
      const r = await api.get('/faq')
      setRows(r.data?.data || [])
    } catch (err) {
      console.error('Failed to load FAQs:', err)
      setError(err.message || 'Failed to load FAQs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const add = async () => {
    if (!q.trim() || !a.trim()) {
      alert('Please fill in both question and answer')
      return
    }
    try {
      setSubmitting(true)
      setError(null)
      await api.post('/faq', { question: q, answer: a, order: rows.length })
      setQ('')
      setA('')
      await load()
    } catch (err) {
      console.error('Failed to add FAQ:', err)
      setError(err.message || 'Failed to add FAQ')
    } finally {
      setSubmitting(false)
    }
  }

  const confirmDelete = (id, question) => {
    setDeleteTarget({ id, question })
    setShowDeleteModal(true)
  }

  const deleteFaq = async () => {
    if (!deleteTarget) return
    try {
      setDeleting(deleteTarget.id)
      await api.delete('/faq/' + deleteTarget.id)
      await load()
      setShowDeleteModal(false)
      setDeleteTarget(null)
    } catch (err) {
      console.error('Failed to delete FAQ:', err)
      setError(err.message || 'Failed to delete FAQ')
    } finally {
      setDeleting(null)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
        <div style={{ textAlign: 'center' }}>
          <Spinner animation="border" role="status" style={{ color: '#0066FF', marginBottom: '16px' }} />
          <p style={{ color: '#64748B', fontWeight: '600' }}>Loading FAQs...</p>
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
              FAQs Management
            </h1>
            <p style={{ color: '#64748B', fontSize: '14px', margin: 0, fontWeight: '500' }}>
              Create and manage frequently asked questions for your users
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
      </div>

      {/* Add FAQ Form */}
      <Card style={{
        background: 'linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 100%)',
        border: '2px solid #E2E8F0',
        borderRadius: '16px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.06)',
        marginBottom: '32px',
        overflow: 'hidden'
      }}>
        <Card.Body style={{ padding: '24px' }}>
          <div style={{ marginBottom: '16px' }}>
            <h5 style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Plus size={20} style={{ color: '#0066FF' }} />
              Add New FAQ
            </h5>
          </div>
          <Row className="g-3">
            <Col md={5}>
              <Form.Group>
                <Form.Label style={{ fontWeight: '700', color: '#0F172A', marginBottom: '8px', fontSize: '13px' }}>
                  Question
                </Form.Label>
                <Form.Control
                  placeholder="Enter question..."
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  disabled={submitting}
                  style={{
                    borderRadius: '10px',
                    border: '2px solid #E2E8F0',
                    padding: '12px 16px',
                    fontSize: '14px',
                    fontWeight: '500',
                    transition: 'all 0.3s ease'
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#0066FF'}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#E2E8F0'}
                />
              </Form.Group>
            </Col>
            <Col md={5}>
              <Form.Group>
                <Form.Label style={{ fontWeight: '700', color: '#0F172A', marginBottom: '8px', fontSize: '13px' }}>
                  Answer
                </Form.Label>
                <Form.Control
                  as="textarea"
                  rows={1}
                  placeholder="Enter answer..."
                  value={a}
                  onChange={e => setA(e.target.value)}
                  disabled={submitting}
                  style={{
                    borderRadius: '10px',
                    border: '2px solid #E2E8F0',
                    padding: '12px 16px',
                    fontSize: '14px',
                    fontWeight: '500',
                    transition: 'all 0.3s ease',
                    resize: 'none'
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#0066FF'}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#E2E8F0'}
                />
              </Form.Group>
            </Col>
            <Col md={2}>
              <Form.Group>
                <Form.Label style={{ fontWeight: '700', color: '#0F172A', marginBottom: '8px', fontSize: '13px', visibility: 'hidden' }}>
                  Action
                </Form.Label>
                <button
                  onClick={add}
                  disabled={submitting || !q.trim() || !a.trim()}
                  style={{
                    width: '100%',
                    background: '#0066FF',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '12px 16px',
                    fontWeight: '700',
                    fontSize: '14px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'all 0.3s ease',
                    opacity: (submitting || !q.trim() || !a.trim()) ? 0.6 : 1
                  }}
                  onMouseEnter={(e) => {
                    if (!submitting && q.trim() && a.trim()) {
                      e.currentTarget.style.background = '#0052CC'
                    }
                  }}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#0066FF'}
                >
                  {submitting ? (
                    <>
                      <Spinner animation="border" size="sm" style={{ marginRight: '4px' }} />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Plus size={18} />
                      Add FAQ
                    </>
                  )}
                </button>
              </Form.Group>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* FAQs Table */}
      <div style={{
        background: 'linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 100%)',
        borderRadius: '16px',
        border: '1px solid #E2E8F0',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.06)',
        overflow: 'hidden'
      }}>
        {rows.length === 0 ? (
          <div style={{
            padding: '80px 40px',
            textAlign: 'center',
            color: '#94A3B8'
          }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>❓</div>
            <h3 style={{ color: '#0F172A', marginBottom: '8px', fontSize: '20px', fontWeight: '800' }}>No FAQs yet</h3>
            <p style={{ margin: 0, fontSize: '14px', fontWeight: '500' }}>Add your first FAQ using the form above</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <Table hover responsive style={{ marginBottom: 0 }}>
              <thead style={{
                background: 'linear-gradient(135deg, #F1F5F9 0%, #E2E8F0 100%)',
                borderBottom: '2px solid #E2E8F0'
              }}>
                <tr>
                  <th style={{ fontWeight: '800', color: '#0F172A', padding: '16px', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', width: '35%' }}>Question</th>
                  <th style={{ fontWeight: '800', color: '#0F172A', padding: '16px', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', width: '50%' }}>Answer</th>
                  <th style={{ fontWeight: '800', color: '#0F172A', padding: '16px', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', width: '15%', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
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
                      <div style={{ maxHeight: '60px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {r.question}
                      </div>
                    </td>
                    <td style={{ padding: '16px', color: '#64748B', fontSize: '14px', fontWeight: '500' }}>
                      <div style={{ maxHeight: '60px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {r.answer}
                      </div>
                    </td>
                    <td style={{ padding: '16px', textAlign: 'center' }}>
                      <button
                        onClick={() => confirmDelete(r._id, r.question)}
                        disabled={deleting === r._id}
                        style={{
                          background: '#EF4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '6px 12px',
                          fontSize: '12px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'all 0.3s ease',
                          opacity: deleting === r._id ? 0.7 : 1
                        }}
                        onMouseEnter={(e) => {
                          if (deleting !== r._id) {
                            e.currentTarget.style.background = '#DC2626'
                          }
                        }}
                        onMouseLeave={(e) => e.currentTarget.style.background = '#EF4444'}
                      >
                        {deleting === r._id ? (
                          <>
                            <Spinner animation="border" size="sm" />
                            Deleting...
                          </>
                        ) : (
                          <>
                            <Trash2 size={14} />
                            Delete
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </div>

      {/* Stats */}
      <div style={{ marginTop: '24px' }}>
        <div style={{
          background: 'linear-gradient(135deg, #DBEAFE 0%, #BFDBFE 100%)',
          border: '2px solid #0066FF',
          borderRadius: '12px',
          padding: '16px 24px',
          fontWeight: '700',
          color: '#003D99',
          textAlign: 'center'
        }}>
          Total FAQs: {rows.length}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} centered style={{ backdropFilter: 'blur(4px)' }}>
        <Modal.Header style={{
          background: 'linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 100%)',
          borderBottom: '2px solid #E2E8F0'
        }}>
          <Modal.Title style={{ fontWeight: '800', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={24} style={{ color: '#EF4444' }} />
            Delete FAQ
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: '24px' }}>
          <p style={{ color: '#64748B', fontSize: '14px', fontWeight: '600', marginBottom: '16px' }}>
            Are you sure you want to delete this FAQ?
          </p>
          <div style={{
            background: '#FEE2E2',
            border: '2px solid #FECACA',
            borderRadius: '10px',
            padding: '16px',
            marginBottom: '16px'
          }}>
            <p style={{ color: '#991B1B', fontWeight: '700', fontSize: '13px', margin: '0 0 8px 0', textTransform: 'uppercase' }}>Question:</p>
            <p style={{ color: '#7F1D1D', fontWeight: '600', fontSize: '14px', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
              {deleteTarget?.question}
            </p>
          </div>
          <p style={{ color: '#94A3B8', fontSize: '12px', margin: 0, fontWeight: '600' }}>This action cannot be undone.</p>
        </Modal.Body>
        <Modal.Footer style={{
          background: 'linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)',
          borderTop: '2px solid #E2E8F0',
          padding: '16px 24px'
        }}>
          <button
            onClick={() => setShowDeleteModal(false)}
            style={{
              background: '#E2E8F0',
              color: '#0F172A',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 20px',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#CBD5E1'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#E2E8F0'}
          >
            <X size={16} />
            Cancel
          </button>
          <button
            onClick={deleteFaq}
            disabled={deleting}
            style={{
              background: '#EF4444',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 20px',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              opacity: deleting ? 0.7 : 1
            }}
            onMouseEnter={(e) => {
              if (!deleting) e.currentTarget.style.background = '#DC2626'
            }}
            onMouseLeave={(e) => e.currentTarget.style.background = '#EF4444'}
          >
            {deleting ? (
              <>
                <Spinner animation="border" size="sm" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 size={16} />
                Delete FAQ
              </>
            )}
          </button>
        </Modal.Footer>
      </Modal>
    </div>
  )
}