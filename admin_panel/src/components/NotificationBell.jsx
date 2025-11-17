import { useState, useEffect, useRef } from 'react'
import { Badge, Dropdown, Button, Modal, Card, Row, Col, Alert } from 'react-bootstrap'
import { Bell, Check, CheckCheck, X, Eye, MessageSquare, CreditCard, FileText, AlertTriangle } from 'lucide-react'
import api from '../api/axios.js'

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showDropdown, setShowDropdown] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [selectedNotification, setSelectedNotification] = useState(null)
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    loadNotifications()
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadNotifications, 30000)
    return () => clearInterval(interval)
  }, [])

  const loadNotifications = async () => {
    try {
      const response = await api.get('/admin/notifications')
      setNotifications(response.data.notifications || [])
      setUnreadCount(response.data.unreadCount || 0)
    } catch (error) {
      console.error('Failed to load notifications:', error)
    }
  }

  const markAsRead = async (notificationId) => {
    try {
      await api.put(`/admin/notifications/${notificationId}/read`)
      setNotifications(prev =>
        prev.map(n => n._id === notificationId ? { ...n, isRead: true } : n)
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (error) {
      console.error('Failed to mark as read:', error)
    }
  }

  const markAllAsRead = async () => {
    try {
      await api.put('/admin/notifications/read-all')
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
      setUnreadCount(0)
    } catch (error) {
      console.error('Failed to mark all as read:', error)
    }
  }

  const claimNotification = async (notification) => {
    setLoading(true)
    try {
      // Create a support ticket from the notification
      await api.post('/admin/notifications/claim', {
        notificationId: notification._id,
        subject: `Claim: ${notification.title}`,
        message: notification.message,
        userId: notification.userId._id,
        priority: notification.priority || 'MEDIUM'
      })

      // Mark notification as read and update status
      await markAsRead(notification._id)
      setNotifications(prev =>
        prev.map(n => n._id === notification._id ? { ...n, status: 'CLAIMED' } : n)
      )
      setShowModal(false)
    } catch (error) {
      console.error('Failed to claim notification:', error)
    } finally {
      setLoading(false)
    }
  }

  const getNotificationIcon = (type) => {
    const icons = {
      'loan': FileText,
      'payment': CreditCard,
      'support': MessageSquare,
      'kyc': AlertTriangle,
      'general': Bell
    }
    const Icon = icons[type] || Bell
    return <Icon size={16} />
  }

  const getNotificationColor = (type) => {
    const colors = {
      'loan': '#0066FF',
      'payment': '#28a745',
      'support': '#ffc107',
      'kyc': '#dc3545',
      'general': '#6c757d'
    }
    return colors[type] || '#6c757d'
  }

  const formatTime = (date) => {
    const now = new Date()
    const diff = now - new Date(date)
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    return `${days}d ago`
  }

  return (
    <>
      <Dropdown
        show={showDropdown}
        onToggle={setShowDropdown}
        ref={dropdownRef}
        align="end"
      >
        <Dropdown.Toggle
          as={Button}
          variant="link"
          className="position-relative p-2"
          style={{
            color: '#64748B',
            border: 'none',
            background: 'transparent',
            fontSize: '20px'
          }}
        >
          <Bell size={20} />
          {unreadCount > 0 && (
            <Badge
              bg="danger"
              className="position-absolute"
              style={{
                top: '4px',
                right: '4px',
                fontSize: '10px',
                minWidth: '18px',
                height: '18px',
                borderRadius: '9px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Dropdown.Toggle>

        <Dropdown.Menu
          style={{
            width: '400px',
            maxHeight: '500px',
            overflowY: 'auto',
            border: 'none',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.1)',
            borderRadius: '12px',
            marginTop: '8px'
          }}
        >
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e9ecef' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h6 style={{ margin: 0, fontWeight: '700', color: '#0F172A' }}>
                Notifications
              </h6>
              {unreadCount > 0 && (
                <Button
                  variant="link"
                  size="sm"
                  onClick={markAllAsRead}
                  style={{
                    padding: '4px 8px',
                    fontSize: '12px',
                    color: '#0066FF',
                    textDecoration: 'none'
                  }}
                >
                  Mark all read
                </Button>
              )}
            </div>
          </div>

          {notifications.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#6c757d' }}>
              <Bell size={48} style={{ opacity: 0.3, marginBottom: '12px' }} />
              <p style={{ margin: 0, fontSize: '14px' }}>No notifications</p>
            </div>
          ) : (
            notifications.slice(0, 10).map((notification) => (
              <Dropdown.Item
                key={notification._id}
                style={{
                  padding: '12px 20px',
                  borderBottom: '1px solid #f1f5f9',
                  background: notification.isRead ? 'white' : '#f8fafc',
                  cursor: 'pointer'
                }}
                onClick={() => {
                  if (!notification.isRead) {
                    markAsRead(notification._id)
                  }
                  setSelectedNotification(notification)
                  setShowModal(true)
                }}
              >
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      background: getNotificationColor(notification.type),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      flexShrink: 0
                    }}
                  >
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#0F172A',
                      marginBottom: '4px',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}>
                      {notification.title}
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: '#64748B',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      marginBottom: '4px'
                    }}>
                      {notification.message}
                    </div>
                    <div style={{
                      fontSize: '11px',
                      color: '#94A3B8',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <span>{notification.userId?.name || 'Unknown User'}</span>
                      <span>{formatTime(notification.createdAt)}</span>
                    </div>
                  </div>
                  {!notification.isRead && (
                    <div
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '4px',
                        background: '#0066FF',
                        flexShrink: 0,
                        marginTop: '6px'
                      }}
                    />
                  )}
                </div>
              </Dropdown.Item>
            ))
          )}

          {notifications.length > 10 && (
            <div style={{ padding: '12px 20px', textAlign: 'center', borderTop: '1px solid #e9ecef' }}>
              <Button
                variant="link"
                size="sm"
                style={{ color: '#0066FF', textDecoration: 'none', fontSize: '12px' }}
              >
                View all notifications
              </Button>
            </div>
          )}
        </Dropdown.Menu>
      </Dropdown>

      {/* Notification Detail Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg" centered>
        <Modal.Header closeButton style={{ background: 'linear-gradient(135deg, #001f5c 0%, #003d99 100%)', color: 'white' }}>
          <Modal.Title style={{ fontWeight: '700' }}>
            {getNotificationIcon(selectedNotification?.type)} {selectedNotification?.title}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: '30px' }}>
          {selectedNotification && (
            <div>
              <Row className="mb-4">
                <Col md={8}>
                  <Card style={{ border: 'none', borderRadius: '12px', boxShadow: '0 5px 20px rgba(0, 0, 0, 0.1)' }}>
                    <Card.Body style={{ padding: '20px' }}>
                      <h6 style={{ color: '#0F172A', fontWeight: '700', marginBottom: '12px' }}>
                        📋 Notification Details
                      </h6>
                      <div style={{ marginBottom: '16px' }}>
                        <strong style={{ color: '#0F172A' }}>Message:</strong>
                        <p style={{ margin: '8px 0', color: '#495057', lineHeight: '1.6' }}>
                          {selectedNotification.message}
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                        <div>
                          <strong style={{ color: '#0F172A', fontSize: '13px' }}>User:</strong>
                          <p style={{ margin: '4px 0', color: '#495057', fontSize: '14px' }}>
                            👤 {selectedNotification.userId?.name || 'Unknown'}
                          </p>
                        </div>
                        <div>
                          <strong style={{ color: '#0F172A', fontSize: '13px' }}>Email:</strong>
                          <p style={{ margin: '4px 0', color: '#495057', fontSize: '14px' }}>
                            📧 {selectedNotification.userId?.email || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <strong style={{ color: '#0F172A', fontSize: '13px' }}>Time:</strong>
                          <p style={{ margin: '4px 0', color: '#495057', fontSize: '14px' }}>
                            🕐 {new Date(selectedNotification.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      {selectedNotification.data && Object.keys(selectedNotification.data).length > 0 && (
                        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #dee2e6' }}>
                          <strong style={{ color: '#0F172A' }}>Additional Data:</strong>
                          <pre style={{
                            background: '#f8f9fa',
                            padding: '12px',
                            borderRadius: '8px',
                            fontSize: '12px',
                            margin: '8px 0',
                            overflow: 'auto'
                          }}>
                            {JSON.stringify(selectedNotification.data, null, 2)}
                          </pre>
                        </div>
                      )}
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={4}>
                  <Card style={{ border: 'none', borderRadius: '12px', boxShadow: '0 5px 20px rgba(0, 0, 0, 0.1)' }}>
                    <Card.Body style={{ padding: '20px', textAlign: 'center' }}>
                      <div style={{
                        width: '60px',
                        height: '60px',
                        borderRadius: '12px',
                        background: getNotificationColor(selectedNotification.type),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        margin: '0 auto 16px'
                      }}>
                        {getNotificationIcon(selectedNotification.type)}
                      </div>
                      <h6 style={{ color: '#0F172A', fontWeight: '700', marginBottom: '8px' }}>
                        {selectedNotification.type?.toUpperCase()} ALERT
                      </h6>
                      <p style={{ color: '#64748B', fontSize: '13px', margin: 0 }}>
                        Priority: {selectedNotification.priority || 'MEDIUM'}
                      </p>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>

              {selectedNotification.type === 'support' && selectedNotification.status !== 'CLAIMED' && (
                <Alert variant="info" style={{ borderRadius: '12px', border: 'none' }}>
                  <AlertTriangle size={16} style={{ marginRight: '8px' }} />
                  This notification can be claimed as a support ticket.
                </Alert>
              )}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer style={{ borderTop: '1px solid #dee2e6' }}>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            Close
          </Button>
          {selectedNotification?.type === 'support' && selectedNotification?.status !== 'CLAIMED' && (
            <Button
              variant="primary"
              onClick={() => claimNotification(selectedNotification)}
              disabled={loading}
              style={{
                background: 'linear-gradient(135deg, #1abc9c 0%, #16a085 100%)',
                border: 'none'
              }}
            >
              {loading ? 'Claiming...' : '🎫 Claim as Support Ticket'}
            </Button>
          )}
        </Modal.Footer>
      </Modal>
    </>
  )
}
