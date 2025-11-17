import { useState, useEffect } from 'react';
import { Table, Card, Badge, Pagination, Row, Col, Modal, Button, Spinner } from 'react-bootstrap';
import api from '../api/axios';

export default function NotificationHistory() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showDetail, setShowDetail] = useState(false);
  const [selectedNotif, setSelectedNotif] = useState(null);

  useEffect(() => {
    loadHistory();
  }, [page]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/notification-history?page=${page}`);
      setHistory(res.data.data.history);
      setTotalPages(res.data.data.pagination.pages);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const viewDetails = (notif) => {
    setSelectedNotif(notif);
    setShowDetail(true);
  };

  const getStatusBadge = (status) => {
    const variants = {
      'DELIVERED': 'success',
      'PENDING': 'warning',
      'FAILED': 'danger',
      'SENT': 'info'
    };
    return <Badge bg={variants[status] || 'secondary'}>{status}</Badge>;
  };

  const getRecipientBadge = (sentTo) => {
    if (sentTo === 'all') {
      return <Badge style={{ background: 'linear-gradient(135deg, #1abc9c 0%, #16a085 100%)', border: 'none', padding: '8px 12px', borderRadius: '6px' }}>📢 All Users</Badge>;
    }
    return <Badge bg="secondary" style={{ padding: '8px 12px', borderRadius: '6px' }}>👤 Specific User</Badge>;
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <Spinner animation="border" style={{ color: '#1abc9c' }} />
      </div>
    );
  }

  const paginationItems = [];
  const maxPagesToShow = 5;
  let startPage = Math.max(1, page - Math.floor(maxPagesToShow / 2));
  let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
  if (endPage - startPage < maxPagesToShow - 1) {
    startPage = Math.max(1, endPage - maxPagesToShow + 1);
  }

  if (startPage > 1) {
    paginationItems.push(
      <Pagination.First key="first" onClick={() => setPage(1)} disabled={page === 1} />
    );
    paginationItems.push(
      <Pagination.Prev key="prev" onClick={() => setPage(page - 1)} disabled={page === 1} />
    );
  }

  for (let i = startPage; i <= endPage; i++) {
    paginationItems.push(
      <Pagination.Item
        key={i}
        active={i === page}
        onClick={() => setPage(i)}
        style={{
          background: i === page ? 'linear-gradient(135deg, #1abc9c 0%, #16a085 100%)' : 'white',
          color: i === page ? 'white' : '#001f5c',
          border: i === page ? 'none' : '1px solid #dee2e6',
          borderRadius: '6px',
          fontWeight: '600'
        }}
      >
        {i}
      </Pagination.Item>
    );
  }

  if (endPage < totalPages) {
    paginationItems.push(
      <Pagination.Next key="next" onClick={() => setPage(page + 1)} disabled={page === totalPages} />
    );
    paginationItems.push(
      <Pagination.Last key="last" onClick={() => setPage(totalPages)} disabled={page === totalPages} />
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
                📋
              </div>
              <div>
                <h2 style={{ margin: 0, fontWeight: '700', fontSize: '28px' }}>Notification History</h2>
                <p style={{ margin: '8px 0 0 0', opacity: 0.9, fontSize: '14px' }}>KhatuPay - View All Sent Notifications</p>
              </div>
            </div>
          </Col>
          <Col md={4} className="text-end">
            <div style={{ fontSize: '14px' }}>
              <strong>Total Notifications</strong><br/>
              <div style={{ fontSize: '28px', fontWeight: '700', marginTop: '8px' }}>{history.length}</div>
            </div>
          </Col>
        </Row>
      </div>

      {/* History Card */}
      <Card style={{
        border: 'none',
        borderRadius: '16px',
        boxShadow: '0 15px 50px rgba(0, 31, 92, 0.1)',
        overflow: 'hidden'
      }}>
        <Card.Body style={{ padding: '0' }}>
          {history.length > 0 ? (
            <>
              <div style={{ overflowX: 'auto' }}>
                <Table striped hover responsive style={{ marginBottom: '0' }}>
                  <thead style={{ background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)', borderBottom: '2px solid #dee2e6' }}>
                    <tr>
                      <th style={{ padding: '18px', fontWeight: '700', color: '#001f5c' }}>Title</th>
                      <th style={{ padding: '18px', fontWeight: '700', color: '#001f5c' }}>Message</th>
                      <th style={{ padding: '18px', fontWeight: '700', color: '#001f5c' }}>Sent To</th>
                      <th style={{ padding: '18px', fontWeight: '700', color: '#001f5c' }}>Recipients</th>
                      <th style={{ padding: '18px', fontWeight: '700', color: '#001f5c' }}>Status</th>
                      <th style={{ padding: '18px', fontWeight: '700', color: '#001f5c' }}>Sent By</th>
                      <th style={{ padding: '18px', fontWeight: '700', color: '#001f5c' }}>Date & Time</th>
                      <th style={{ padding: '18px', fontWeight: '700', color: '#001f5c' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((item) => (
                      <tr key={item._id} style={{ borderBottom: '1px solid #dee2e6', transition: 'background-color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                        <td style={{ padding: '16px', fontWeight: '700', color: '#001f5c' }}>
                          {item.title}
                        </td>
                        <td style={{ padding: '16px', color: '#495057', maxWidth: '250px', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                          {item.message}
                        </td>
                        <td style={{ padding: '16px' }}>
                          {getRecipientBadge(item.sentTo === 'all' ? 'all' : 'specific')}
                          {item.sentTo !== 'all' && item.userId && (
                            <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '4px' }}>
                              <small>{item.userId?.name || 'Unknown'}</small>
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '16px', fontWeight: '700', color: '#1abc9c' }}>
                          {item.totalRecipients}
                        </td>
                        <td style={{ padding: '16px' }}>
                          {getStatusBadge(item.status || 'SENT')}
                        </td>
                        <td style={{ padding: '16px', color: '#495057' }}>
                          <strong>{item.sentBy?.name || 'Unknown'}</strong>
                        </td>
                        <td style={{ padding: '16px', color: '#495057', fontSize: '13px' }}>
                          🕐 {formatDate(item.sentAt)}
                        </td>
                        <td style={{ padding: '16px' }}>
                          <Button 
                            size="sm" 
                            variant="outline-primary" 
                            onClick={() => viewDetails(item)}
                            style={{ borderRadius: '6px', fontWeight: '600', fontSize: '12px' }}
                          >
                            👁️ View
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>

              {/* Pagination */}
              <div style={{ padding: '25px', background: '#f8f9fa', borderTop: '1px solid #dee2e6', display: 'flex', justifyContent: 'center' }}>
                <Pagination style={{ margin: '0', gap: '8px' }}>
                  {paginationItems}
                </Pagination>
              </div>
            </>
          ) : (
            <div style={{ padding: '60px 40px', textAlign: 'center', color: '#6c757d' }}>
              <div style={{ fontSize: '48px', marginBottom: '15px' }}>📭</div>
              <p style={{ fontSize: '18px', margin: '0', fontWeight: '600' }}>No Notifications Found</p>
              <small>No notifications have been sent yet</small>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Detail Modal */}
      <Modal show={showDetail} onHide={() => setShowDetail(false)} centered size="lg">
        <Modal.Header closeButton style={{ background: 'linear-gradient(135deg, #001f5c 0%, #003d99 100%)', color: 'white', border: 'none' }}>
          <Modal.Title style={{ fontWeight: '700' }}>Notification Details</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: '30px', background: '#f8f9fa' }}>
          {selectedNotif && (
            <div>
              <Card style={{ border: 'none', borderRadius: '12px', boxShadow: '0 5px 20px rgba(0, 31, 92, 0.1)', marginBottom: '20px' }}>
                <Card.Header style={{ background: 'linear-gradient(135deg, #1abc9c 0%, #16a085 100%)', color: 'white', fontWeight: '700', borderRadius: '12px 12px 0 0', border: 'none', padding: '15px' }}>
                  📬 Message Content
                </Card.Header>
                <Card.Body style={{ padding: '20px' }}>
                  <p style={{ marginBottom: '12px' }}><strong style={{ color: '#001f5c' }}>Title:</strong> <span style={{ color: '#495057' }}>{selectedNotif.title}</span></p>
                  <p style={{ marginBottom: '0' }}><strong style={{ color: '#001f5c' }}>Message:</strong></p>
                  <p style={{ background: '#e9ecef', padding: '15px', borderRadius: '8px', color: '#495057', marginBottom: '0', marginTop: '8px', lineHeight: '1.6' }}>{selectedNotif.message}</p>
                </Card.Body>
              </Card>

              <Card style={{ border: 'none', borderRadius: '12px', boxShadow: '0 5px 20px rgba(0, 31, 92, 0.1)', marginBottom: '20px' }}>
                <Card.Header style={{ background: 'linear-gradient(135deg, #1abc9c 0%, #16a085 100%)', color: 'white', fontWeight: '700', borderRadius: '12px 12px 0 0', border: 'none', padding: '15px' }}>
                  📊 Delivery Information
                </Card.Header>
                <Card.Body style={{ padding: '20px' }}>
                  <Row>
                    <Col md={6}>
                      <p style={{ marginBottom: '12px' }}><strong style={{ color: '#001f5c' }}>Sent To:</strong></p>
                      {selectedNotif.sentTo === 'all' ? (
                        <div style={{ color: '#1abc9c', fontWeight: '700' }}>📢 All Users</div>
                      ) : (
                        <div>
                          <div style={{ color: '#001f5c', fontWeight: '600' }}>👤 {selectedNotif.userId?.name || 'Unknown'}</div>
                          <small style={{ color: '#6c757d' }}>{selectedNotif.userId?.email}</small>
                        </div>
                      )}
                    </Col>
                    <Col md={6}>
                      <p style={{ marginBottom: '12px' }}><strong style={{ color: '#001f5c' }}>Status:</strong></p>
                      <p>{getStatusBadge(selectedNotif.status || 'SENT')}</p>
                    </Col>
                  </Row>
                  <Row>
                    <Col md={6}>
                      <p style={{ marginBottom: '12px' }}><strong style={{ color: '#001f5c' }}>Sent At:</strong></p>
                      <p style={{ color: '#495057' }}>📅 {formatDate(selectedNotif.sentAt)}</p>
                    </Col>
                    <Col md={6}>
                      <p style={{ marginBottom: '12px' }}><strong style={{ color: '#001f5c' }}>Total Recipients:</strong></p>
                      <p style={{ color: '#1abc9c', fontWeight: '700', fontSize: '18px' }}>{selectedNotif.totalRecipients}</p>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>

              <Card style={{ border: 'none', borderRadius: '12px', boxShadow: '0 5px 20px rgba(0, 31, 92, 0.1)', marginBottom: '20px' }}>
                <Card.Header style={{ background: 'linear-gradient(135deg, #1abc9c 0%, #16a085 100%)', color: 'white', fontWeight: '700', borderRadius: '12px 12px 0 0', border: 'none', padding: '15px' }}>
                  ✉️ Sender Information
                </Card.Header>
                <Card.Body style={{ padding: '20px' }}>
                  <Row>
                    <Col md={6}>
                      <p style={{ marginBottom: '12px' }}><strong style={{ color: '#001f5c' }}>Sent By:</strong></p>
                      <p style={{ color: '#495057', fontWeight: '600' }}>{selectedNotif.sentBy?.name || 'Unknown'}</p>
                    </Col>
                    <Col md={6}>
                      <p style={{ marginBottom: '12px' }}><strong style={{ color: '#001f5c' }}>Sender ID:</strong></p>
                      <p style={{ color: '#495057', fontSize: '12px', fontFamily: 'monospace' }}>{selectedNotif.sentBy?._id || 'N/A'}</p>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>

              {(selectedNotif.deliveredCount !== undefined || selectedNotif.failedCount !== undefined) && (
                <Card style={{ border: 'none', borderRadius: '12px', boxShadow: '0 5px 20px rgba(0, 31, 92, 0.1)' }}>
                  <Card.Header style={{ background: 'linear-gradient(135deg, #1abc9c 0%, #16a085 100%)', color: 'white', fontWeight: '700', borderRadius: '12px 12px 0 0', border: 'none', padding: '15px' }}>
                    ✅ Delivery Stats
                  </Card.Header>
                  <Card.Body style={{ padding: '20px' }}>
                    <Row>
                      <Col md={4} style={{ textAlign: 'center', paddingBottom: '15px', borderRight: '1px solid #dee2e6' }}>
                        <strong style={{ color: '#1abc9c', fontSize: '24px' }}>{selectedNotif.deliveredCount || 0}</strong><br/>
                        <small style={{ color: '#6c757d' }}>Delivered</small>
                      </Col>
                      <Col md={4} style={{ textAlign: 'center', paddingBottom: '15px', borderRight: '1px solid #dee2e6' }}>
                        <strong style={{ color: '#ffc107', fontSize: '24px' }}>{selectedNotif.totalRecipients - (selectedNotif.deliveredCount || 0) - (selectedNotif.failedCount || 0) || 0}</strong><br/>
                        <small style={{ color: '#6c757d' }}>Pending</small>
                      </Col>
                      <Col md={4} style={{ textAlign: 'center', paddingBottom: '15px' }}>
                        <strong style={{ color: '#dc3545', fontSize: '24px' }}>{selectedNotif.failedCount || 0}</strong><br/>
                        <small style={{ color: '#6c757d' }}>Failed</small>
                      </Col>
                    </Row>
                  </Card.Body>
                </Card>
              )}
            </div>
          )}
        </Modal.Body>
      </Modal>
    </div>
  );
}