import React, { useEffect, useMemo, useState } from 'react'
import { Badge, Button, Col, Form, Modal, Row, Table } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import {
  Ban,
  CheckCircle2,
  Download,
  Eye,
  IndianRupee,
  Lock,
  Mail,
  Phone,
  RefreshCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  UserCheck,
  UserPlus,
  Users as UsersIcon,
  Wallet,
} from 'lucide-react'
import api from '../api/axios'
import { AlertStrip, PageHeader } from '../components/AdminUI.jsx'

const normalize = (value) => String(value || '').trim().toLowerCase()

const formatCurrency = (amount) => `Rs. ${Number(amount || 0).toLocaleString('en-IN')}`

const formatDate = (date) => {
  if (!date) return 'N/A'
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const getMobile = (user) => user.mobile || user.phone || 'N/A'

const getKycStatus = (user) => {
  const directStatus = user.kyc?.status
  if (directStatus) return normalize(directStatus)

  const docs = user.kyc?.docs || user.kyc?.documents || []
  if (!docs.length) return 'not_submitted'
  if (docs.some((doc) => normalize(doc.status) === 'rejected')) return 'rejected'
  if (docs.every((doc) => normalize(doc.status) === 'approved')) return 'verified'
  return 'pending'
}

const statusMap = {
  active: { bg: 'success', label: 'Active' },
  blocked: { bg: 'danger', label: 'Blocked' },
}

const kycMap = {
  verified: { bg: 'success', label: 'Verified' },
  approved: { bg: 'success', label: 'Approved' },
  pending: { bg: 'warning', label: 'Pending' },
  rejected: { bg: 'danger', label: 'Rejected' },
  not_submitted: { bg: 'secondary', label: 'Not submitted' },
}

const emptyAddUserForm = {
  name: '',
  email: '',
  mobile: '',
  password: '',
  status: 'active',
  role: 'user',
  loanLimitAmount: '',
  walletBalance: '',
  emailVerified: true,
}

const Users = () => {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [kycFilter, setKycFilter] = useState('ALL')
  const [roleFilter, setRoleFilter] = useState('ALL')
  const [sortBy, setSortBy] = useState('newest')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [selectedUser, setSelectedUser] = useState(null)
  const [loanLimitAmount, setLoanLimitAmount] = useState(0)
  const [processing, setProcessing] = useState(false)
  const [actionUser, setActionUser] = useState(null)
  const [blockReason, setBlockReason] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [addUserForm, setAddUserForm] = useState(emptyAddUserForm)
  const [detailUser, setDetailUser] = useState(null)

  const fetchUsers = async () => {
    try {
      setError('')
      const res = await api.get('/admin/users?limit=1000')
      const data = res.data?.data || res.data || []
      setUsers(Array.isArray(data) ? data : data.items || [])
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Users could not be loaded')
      setUsers([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  useEffect(() => {
    setPage(1)
  }, [searchTerm, statusFilter, kycFilter, roleFilter, sortBy, limit])

  const stats = useMemo(() => {
    const active = users.filter((user) => normalize(user.status || 'active') === 'active').length
    const blocked = users.filter((user) => normalize(user.status) === 'blocked').length
    const verified = users.filter((user) => ['verified', 'approved'].includes(getKycStatus(user))).length
    const walletTotal = users.reduce((sum, user) => sum + Number(user.walletBalance || 0), 0)

    return {
      total: users.length,
      active,
      blocked,
      verified,
      walletTotal,
    }
  }, [users])

  const filteredUsers = useMemo(() => {
    const term = searchTerm.toLowerCase().trim()

    return users
      .filter((user) => {
        const status = normalize(user.status || 'active')
        const kyc = getKycStatus(user)
        const roles = user.roles || []
        const matchesSearch =
          !term ||
          normalize(user.name).includes(term) ||
          normalize(user.email).includes(term) ||
          normalize(getMobile(user)).includes(term) ||
          normalize(user._id).includes(term)
        const matchesStatus = statusFilter === 'ALL' || status === normalize(statusFilter)
        const matchesKyc = kycFilter === 'ALL' || kyc === normalize(kycFilter)
        const matchesRole = roleFilter === 'ALL' || roles.includes(roleFilter)

        return matchesSearch && matchesStatus && matchesKyc && matchesRole
      })
      .sort((a, b) => {
        if (sortBy === 'oldest') return new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
        if (sortBy === 'wallet') return Number(b.walletBalance || 0) - Number(a.walletBalance || 0)
        if (sortBy === 'limit') return Number(b.loanLimit?.amount || 0) - Number(a.loanLimit?.amount || 0)
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
      })
  }, [users, searchTerm, statusFilter, kycFilter, roleFilter, sortBy])

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / limit))
  const pagedUsers = filteredUsers.slice((page - 1) * limit, page * limit)

  const refresh = () => {
    setRefreshing(true)
    fetchUsers()
  }

  const openLimitModal = (user) => {
    setSelectedUser(user)
    setLoanLimitAmount(Number(user.loanLimit?.amount || 0))
  }

  const saveLoanLimit = async () => {
    if (!selectedUser) return
    try {
      setProcessing(true)
      await api.put(`/admin/users/${selectedUser._id}/limit`, { amount: Number(loanLimitAmount || 0) })
      setSelectedUser(null)
      await fetchUsers()
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update loan limit')
    } finally {
      setProcessing(false)
    }
  }

  const updateStatus = async () => {
    if (!actionUser) return
    try {
      setProcessing(true)
      const currentStatus = normalize(actionUser.status || 'active')
      const nextStatus = currentStatus === 'active' ? 'blocked' : 'active'
      await api.put(`/admin/users/${actionUser._id}/status`, {
        status: nextStatus,
        reason: nextStatus === 'blocked' ? blockReason.trim() : '',
      })
      setActionUser(null)
      setBlockReason('')
      await fetchUsers()
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update user status')
    } finally {
      setProcessing(false)
    }
  }

  const submitAddUser = async (event) => {
    event.preventDefault()
    try {
      setProcessing(true)
      const payload = {
        ...addUserForm,
        loanLimitAmount: Number(addUserForm.loanLimitAmount || 0),
        walletBalance: Number(addUserForm.walletBalance || 0),
      }
      const res = await api.post('/admin/users', payload)
      const createdUser = res.data?.data || res.data
      setShowAddModal(false)
      setAddUserForm(emptyAddUserForm)
      setDetailUser(createdUser)
      await fetchUsers()
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to add user')
    } finally {
      setProcessing(false)
    }
  }

  const exportCsv = () => {
    const headers = ['ID', 'Name', 'Mobile', 'Email', 'Status', 'KYC', 'Loan Limit', 'Wallet Balance', 'Joined']
    const rows = filteredUsers.map((user) => [
      user._id,
      user.name || '',
      getMobile(user),
      user.email || '',
      user.status || 'active',
      getKycStatus(user),
      user.loanLimit?.amount || 0,
      user.walletBalance || 0,
      formatDate(user.createdAt),
    ])
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `khatupay-users-${Date.now()}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  if (loading) {
    return (
      <div className="users-loading">
        <div className="spinner-border text-primary" role="status" />
        <p>Loading users...</p>
      </div>
    )
  }

  return (
    <div className="users-page">
      {/* Compact operations header - the console leads with actions and
          filters rather than a marketing banner. */}
      <PageHeader
        icon={UsersIcon}
        title="Users"
        subtitle="Search, review, block or unblock customers and manage their credit limits."
        actions={
          <>
            <Button variant="outline-primary" size="sm" onClick={exportCsv}>
              <Download size={14} className="me-1" /> Export CSV
            </Button>
            <Button variant="outline-primary" size="sm" onClick={refresh} disabled={refreshing}>
              <RefreshCcw size={14} className={refreshing ? 'spin me-1' : 'me-1'} />
              {refreshing ? 'Refreshing' : 'Refresh'}
            </Button>
            <Button size="sm" onClick={() => setShowAddModal(true)}>
              <UserPlus size={14} className="me-1" /> Add user
            </Button>
          </>
        }
      />

      {error && (
        <AlertStrip tone="danger" onRetry={refresh}>
          {error}
        </AlertStrip>
      )}

      <Row className="g-3">
        <Col xl={3} md={6}>
          <StatCard title="Total users" value={stats.total.toLocaleString('en-IN')} icon={UsersIcon} color="#2563EB" />
        </Col>
        <Col xl={3} md={6}>
          <StatCard title="Active users" value={stats.active.toLocaleString('en-IN')} icon={UserCheck} color="#059669" />
        </Col>
        <Col xl={3} md={6}>
          <StatCard title="KYC verified" value={stats.verified.toLocaleString('en-IN')} icon={ShieldCheck} color="#0891B2" />
        </Col>
        <Col xl={3} md={6}>
          <StatCard title="Wallet balance" value={formatCurrency(stats.walletTotal)} icon={Wallet} color="#D97706" />
        </Col>
      </Row>

      <section className="users-panel mt-3">
        <div className="users-panel-head">
          <div>
            <h2>All Users</h2>
            <p>{filteredUsers.length.toLocaleString('en-IN')} matching records</p>
          </div>
          <div className="users-count-pill">
            Page {page} of {totalPages}
          </div>
        </div>

        <div className="users-toolbar">
          <div className="users-search">
            <Search size={18} />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search name, mobile, email, user ID"
            />
          </div>
          <Form.Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="ALL">All status</option>
            <option value="active">Active</option>
            <option value="blocked">Blocked</option>
          </Form.Select>
          <Form.Select value={kycFilter} onChange={(event) => setKycFilter(event.target.value)}>
            <option value="ALL">All KYC</option>
            <option value="verified">Verified</option>
            <option value="pending">Pending</option>
            <option value="rejected">Rejected</option>
            <option value="not_submitted">Not submitted</option>
          </Form.Select>
          <Form.Select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
            <option value="ALL">All roles</option>
            <option value="user">User</option>
            <option value="admin">Admin</option>
            <option value="employee">Employee</option>
          </Form.Select>
          <Form.Select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="wallet">Wallet high to low</option>
            <option value="limit">Loan limit high to low</option>
          </Form.Select>
          <Form.Select value={limit} onChange={(event) => setLimit(Number(event.target.value))}>
            <option value={10}>10 rows</option>
            <option value={20}>20 rows</option>
            <option value={50}>50 rows</option>
            <option value={100}>100 rows</option>
          </Form.Select>
        </div>

        <div className="users-table-wrap">
          <Table responsive hover className="users-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Contact</th>
                <th>KYC</th>
                <th>Loan Limit</th>
                <th>Wallet</th>
                <th>Status</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagedUsers.length > 0 ? (
                pagedUsers.map((user) => {
                  const status = statusMap[normalize(user.status || 'active')] || statusMap.active
                  const kyc = kycMap[getKycStatus(user)] || kycMap.not_submitted
                  const isActive = normalize(user.status || 'active') === 'active'
                  return (
                    <tr key={user._id}>
                      <td>
                        <div className="user-cell">
                          <div>{(user.name || 'U').charAt(0).toUpperCase()}</div>
                          <section>
                            <strong>{user.name || 'Unnamed user'}</strong>
                            <small>{user._id?.slice(-10) || 'N/A'}</small>
                          </section>
                        </div>
                      </td>
                      <td>
                        <div className="contact-cell">
                          <span><Phone size={14} /> {getMobile(user)}</span>
                          <span><Mail size={14} /> {user.email || 'No email'}</span>
                        </div>
                      </td>
                      <td><Badge bg={kyc.bg}>{kyc.label}</Badge></td>
                      <td>
                        <strong>{formatCurrency(user.loanLimit?.amount || 0)}</strong>
                        {user.loanLimit?.setAt && <small>Set {formatDate(user.loanLimit.setAt)}</small>}
                      </td>
                      <td className="wallet-cell">{formatCurrency(user.walletBalance || 0)}</td>
                      <td><Badge bg={status.bg}>{status.label}</Badge></td>
                      <td>{formatDate(user.createdAt)}</td>
                      <td>
                        <div className="action-stack">
                          <Button variant="light" size="sm" onClick={() => setDetailUser(user)} title="View user">
                            <Eye size={15} />
                          </Button>
                          <Button variant="light" size="sm" onClick={() => openLimitModal(user)} title="Set loan limit">
                            <SlidersHorizontal size={15} />
                          </Button>
                          <Button
                            variant={isActive ? 'outline-danger' : 'outline-success'}
                            size="sm"
                            onClick={() => { setActionUser(user); setBlockReason('') }}
                            title={isActive ? 'Block user' : 'Unblock user'}
                          >
                            {isActive ? <Ban size={15} /> : <CheckCircle2 size={15} />}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan="8" className="users-empty">No users found for current filters.</td>
                </tr>
              )}
            </tbody>
          </Table>
        </div>

        <div className="users-pagination">
          <span>
            Showing {filteredUsers.length ? (page - 1) * limit + 1 : 0} to {Math.min(page * limit, filteredUsers.length)} of {filteredUsers.length}
          </span>
          <div>
            <Button variant="outline-secondary" size="sm" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>
              Previous
            </Button>
            <Button variant="outline-secondary" size="sm" disabled={page === totalPages} onClick={() => setPage((value) => value + 1)}>
              Next
            </Button>
          </div>
        </div>
      </section>

      <Modal show={showAddModal} onHide={() => setShowAddModal(false)} size="lg" centered>
        <Form onSubmit={submitAddUser}>
          <Modal.Header closeButton>
            <Modal.Title>Add New User</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <div className="add-user-grid">
              <Form.Group>
                <Form.Label>Full name</Form.Label>
                <Form.Control
                  value={addUserForm.name}
                  onChange={(event) => setAddUserForm((form) => ({ ...form, name: event.target.value }))}
                  placeholder="Enter user name"
                  required
                />
              </Form.Group>
              <Form.Group>
                <Form.Label>Email address</Form.Label>
                <Form.Control
                  type="email"
                  value={addUserForm.email}
                  onChange={(event) => setAddUserForm((form) => ({ ...form, email: event.target.value }))}
                  placeholder="user@example.com"
                  required
                />
              </Form.Group>
              <Form.Group>
                <Form.Label>Mobile number</Form.Label>
                <Form.Control
                  value={addUserForm.mobile}
                  onChange={(event) => setAddUserForm((form) => ({ ...form, mobile: event.target.value }))}
                  placeholder="10 digit mobile"
                  required
                />
              </Form.Group>
              <Form.Group>
                <Form.Label>Password</Form.Label>
                <Form.Control
                  type="password"
                  minLength={6}
                  value={addUserForm.password}
                  onChange={(event) => setAddUserForm((form) => ({ ...form, password: event.target.value }))}
                  placeholder="Minimum 6 characters"
                  required
                />
              </Form.Group>
              <Form.Group>
                <Form.Label>Status</Form.Label>
                <Form.Select
                  value={addUserForm.status}
                  onChange={(event) => setAddUserForm((form) => ({ ...form, status: event.target.value }))}
                >
                  <option value="active">Active</option>
                  <option value="blocked">Blocked</option>
                </Form.Select>
              </Form.Group>
              <Form.Group>
                <Form.Label>Role</Form.Label>
                <Form.Select
                  value={addUserForm.role}
                  onChange={(event) => setAddUserForm((form) => ({ ...form, role: event.target.value }))}
                >
                  <option value="user">User</option>
                  <option value="employee">Employee</option>
                  <option value="admin">Admin</option>
                </Form.Select>
              </Form.Group>
              <Form.Group>
                <Form.Label>Loan limit</Form.Label>
                <Form.Control
                  type="number"
                  min="0"
                  value={addUserForm.loanLimitAmount}
                  onChange={(event) => setAddUserForm((form) => ({ ...form, loanLimitAmount: event.target.value }))}
                  placeholder="0"
                />
              </Form.Group>
              <Form.Group>
                <Form.Label>Wallet balance</Form.Label>
                <Form.Control
                  type="number"
                  min="0"
                  value={addUserForm.walletBalance}
                  onChange={(event) => setAddUserForm((form) => ({ ...form, walletBalance: event.target.value }))}
                  placeholder="0"
                />
              </Form.Group>
            </div>
            <div className="add-user-note">
              <Lock size={16} />
              <span>This creates the user directly from admin panel and stores the password securely on backend.</span>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button type="submit" disabled={processing}>
              {processing ? 'Creating...' : 'Create user'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <Modal show={Boolean(detailUser)} onHide={() => setDetailUser(null)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>User Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {detailUser && (
            <div className="user-detail-modal">
              <div className="detail-profile-card">
                <div>{(detailUser.name || 'U').charAt(0).toUpperCase()}</div>
                <section>
                  <h3>{detailUser.name || 'Unnamed user'}</h3>
                  <p>{detailUser.email || 'No email'}</p>
                  <div>
                    <Badge bg={(statusMap[normalize(detailUser.status || 'active')] || statusMap.active).bg}>
                      {(statusMap[normalize(detailUser.status || 'active')] || statusMap.active).label}
                    </Badge>
                    <Badge bg={(kycMap[getKycStatus(detailUser)] || kycMap.not_submitted).bg}>
                      {(kycMap[getKycStatus(detailUser)] || kycMap.not_submitted).label}
                    </Badge>
                    <Badge bg={detailUser.pinStatus === 'SET' ? 'success' : detailUser.pinStatus === 'LOCKED' ? 'danger' : 'secondary'}>
                      {detailUser.pinStatus === 'SET' ? 'PIN Set' : detailUser.pinStatus === 'LOCKED' ? 'PIN Locked' : 'PIN Not Set'}
                    </Badge>
                  </div>
                </section>
              </div>

              <div className="detail-info-grid">
                <DetailItem label="User ID" value={detailUser._id || 'N/A'} />
                <DetailItem label="Mobile" value={getMobile(detailUser)} />
                <DetailItem label="Email verified" value={detailUser.emailVerified ? 'Yes' : 'No'} />
                <DetailItem label="Roles" value={(detailUser.roles || ['user']).join(', ')} />
                <DetailItem label="Loan limit" value={formatCurrency(detailUser.loanLimit?.amount || 0)} highlight />
                <DetailItem label="Wallet balance" value={formatCurrency(detailUser.walletBalance || 0)} highlight />
                <DetailItem label="Joined" value={formatDate(detailUser.createdAt)} />
                <DetailItem label="Limit updated" value={formatDate(detailUser.loanLimit?.setAt)} />
                {normalize(detailUser.status) === 'blocked' && (
                  <>
                    <DetailItem label="Blocked on" value={formatDate(detailUser.accessControl?.blockedAt)} />
                    <DetailItem label="Block reason" value={detailUser.accessControl?.blockReason || 'Account access restricted'} />
                  </>
                )}
              </div>

              <div className="detail-actions">
                <Button as={Link} to={`/users/${detailUser._id}`} onClick={() => setDetailUser(null)}>
                  Open full profile
                </Button>
                <Button
                  variant="light"
                  onClick={() => {
                    openLimitModal(detailUser)
                    setDetailUser(null)
                  }}
                >
                  Set loan limit
                </Button>
              </div>
            </div>
          )}
        </Modal.Body>
      </Modal>

      <Modal show={Boolean(selectedUser)} onHide={() => setSelectedUser(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Set Loan Limit</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedUser && (
            <div className="limit-modal-body">
              <div className="limit-user-box">
                <strong>{selectedUser.name || 'Unnamed user'}</strong>
                <span>{getMobile(selectedUser)} | {selectedUser.email || 'No email'}</span>
              </div>
              <div className="current-limit-box">
                <IndianRupee size={18} />
                <span>Current limit</span>
                <strong>{formatCurrency(selectedUser.loanLimit?.amount || 0)}</strong>
              </div>
              <Form.Group>
                <Form.Label>New loan limit</Form.Label>
                <Form.Control
                  type="number"
                  min="0"
                  value={loanLimitAmount}
                  onChange={(event) => setLoanLimitAmount(event.target.value)}
                />
              </Form.Group>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={() => setSelectedUser(null)}>Cancel</Button>
          <Button onClick={saveLoanLimit} disabled={processing}>
            {processing ? 'Saving...' : 'Save limit'}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={Boolean(actionUser)} onHide={() => { setActionUser(null); setBlockReason('') }} centered>
        <Modal.Header closeButton>
          <Modal.Title>{normalize(actionUser?.status || 'active') === 'active' ? 'Block user' : 'Unblock user'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            Are you sure you want to {normalize(actionUser?.status || 'active') === 'active' ? 'block' : 'unblock'}{' '}
            <strong>{actionUser?.name || 'this user'}</strong>?
          </p>
          {normalize(actionUser?.status || 'active') === 'active' && (
            <>
              <div className="alert alert-warning py-2">
                The user will be signed out from every device immediately and cannot use protected app services.
              </div>
              <Form.Group>
                <Form.Label>Reason for blocking</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  maxLength={300}
                  value={blockReason}
                  onChange={(event) => setBlockReason(event.target.value)}
                  placeholder="Enter a clear reason for support and audit records"
                  required
                />
                <Form.Text>{blockReason.length}/300</Form.Text>
              </Form.Group>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={() => setActionUser(null)}>Cancel</Button>
          <Button
            variant={normalize(actionUser?.status || 'active') === 'active' ? 'danger' : 'success'}
            onClick={updateStatus}
            disabled={processing || (normalize(actionUser?.status || 'active') === 'active' && blockReason.trim().length < 3)}
          >
            {processing ? 'Updating...' : 'Confirm'}
          </Button>
        </Modal.Footer>
      </Modal>

      <style>{usersStyles}</style>
    </div>
  )
}

const StatCard = ({ title, value, icon: Icon, color }) => (
  <div className="users-stat-card">
    <div style={{ color, background: `${color}18` }}>
      <Icon size={24} />
    </div>
    <span>{title}</span>
    <strong>{value}</strong>
  </div>
)

const DetailItem = ({ label, value, highlight }) => (
  <div className="detail-item-box">
    <span>{label}</span>
    <strong className={highlight ? 'highlight' : ''}>{value}</strong>
  </div>
)

const usersStyles = `
  .users-loading {
    min-height: 50vh;
    display: grid;
    place-items: center;
    gap: 12px;
    color: #64748B;
  }

  .users-page {
    color: #0F172A;
  }

  .users-stat-card,
  .users-panel {
    background: #FFFFFF;
    border: 1px solid #E2E8F0;
    border-radius: 8px;
    box-shadow: 0 12px 28px rgba(15, 23, 42, 0.07);
  }

  .users-stat-card {
    min-height: 142px;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .users-stat-card > div {
    width: 48px;
    height: 48px;
    border-radius: 8px;
    display: grid;
    place-items: center;
  }

  .users-stat-card span {
    color: #64748B;
    font-size: 13px;
    font-weight: 900;
    text-transform: uppercase;
  }

  .users-stat-card strong {
    font-size: 27px;
    line-height: 1.1;
  }

  .users-panel {
    padding: 18px;
  }

  .users-panel-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
  }

  .users-panel-head h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 900;
  }

  .users-panel-head p {
    margin: 3px 0 0;
    color: #64748B;
    font-weight: 700;
  }

  .users-count-pill {
    padding: 8px 12px;
    border-radius: 999px;
    background: #F1F5F9;
    color: #334155;
    font-size: 13px;
    font-weight: 900;
    white-space: nowrap;
  }

  .users-toolbar {
    display: grid;
    grid-template-columns: minmax(260px, 1.4fr) repeat(5, minmax(135px, 1fr));
    gap: 10px;
    margin-bottom: 14px;
  }

  .users-search {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 12px;
    border-radius: 8px;
    border: 1px solid #CBD5E1;
    background: #FFFFFF;
  }

  .users-search input {
    width: 100%;
    border: 0;
    outline: 0;
    min-height: 38px;
    font-weight: 700;
  }

  .users-table-wrap {
    border: 1px solid #E2E8F0;
    border-radius: 8px;
    overflow: hidden;
  }

  .users-table {
    margin: 0;
  }

  .users-table th {
    background: #F8FAFC;
    color: #475569;
    font-size: 12px;
    text-transform: uppercase;
    padding: 13px 14px;
    border-bottom: 1px solid #E2E8F0;
    white-space: nowrap;
  }

  .users-table td {
    vertical-align: middle;
    padding: 14px;
    color: #334155;
  }

  .users-table td small {
    display: block;
    color: #64748B;
    font-weight: 700;
    margin-top: 2px;
  }

  .user-cell {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 220px;
  }

  .user-cell > div {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: linear-gradient(135deg, #2563EB, #059669);
    color: white;
    font-weight: 900;
    flex: 0 0 auto;
  }

  .user-cell section {
    min-width: 0;
  }

  .user-cell strong {
    display: block;
    color: #0F172A;
  }

  .contact-cell {
    display: grid;
    gap: 5px;
    min-width: 220px;
  }

  .contact-cell span {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 13px;
    font-weight: 700;
    color: #475569;
  }

  .wallet-cell {
    font-weight: 900;
    color: #065F46 !important;
  }

  .action-stack {
    display: flex;
    gap: 7px;
    align-items: center;
    white-space: nowrap;
  }

  .action-stack .btn {
    width: 34px;
    height: 34px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
  }

  .users-empty {
    text-align: center;
    color: #64748B !important;
    padding: 34px !important;
    font-weight: 700;
  }

  .users-pagination {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    padding-top: 14px;
    color: #64748B;
    font-size: 13px;
    font-weight: 800;
  }

  .users-pagination div {
    display: flex;
    gap: 8px;
  }

  .limit-modal-body {
    display: grid;
    gap: 14px;
  }

  .add-user-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
  }

  .add-user-grid .form-label {
    color: #334155;
    font-size: 13px;
    font-weight: 800;
  }

  .add-user-note {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 16px;
    padding: 12px 14px;
    border-radius: 8px;
    background: #F0F9FF;
    border: 1px solid #BAE6FD;
    color: #0C4A6E;
    font-size: 13px;
    font-weight: 700;
  }

  .user-detail-modal {
    display: grid;
    gap: 16px;
  }

  .detail-profile-card {
    display: flex;
    gap: 16px;
    align-items: center;
    padding: 18px;
    border-radius: 8px;
    background: linear-gradient(135deg, #0F172A, #1E293B);
    color: white;
  }

  .detail-profile-card > div {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: linear-gradient(135deg, #2563EB, #059669);
    font-size: 24px;
    font-weight: 900;
    flex: 0 0 auto;
  }

  .detail-profile-card h3 {
    margin: 0;
    font-size: 22px;
  }

  .detail-profile-card p {
    margin: 4px 0 10px;
    color: #CBD5E1;
  }

  .detail-profile-card section > div {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .detail-info-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .detail-item-box {
    padding: 14px;
    border-radius: 8px;
    background: #F8FAFC;
    border: 1px solid #E2E8F0;
    display: grid;
    gap: 6px;
    min-width: 0;
  }

  .detail-item-box span {
    color: #64748B;
    font-size: 12px;
    font-weight: 900;
    text-transform: uppercase;
  }

  .detail-item-box strong {
    color: #0F172A;
    word-break: break-word;
  }

  .detail-item-box .highlight {
    color: #059669;
    font-size: 18px;
  }

  .detail-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    flex-wrap: wrap;
  }

  .limit-user-box,
  .current-limit-box {
    padding: 14px;
    border-radius: 8px;
    background: #F8FAFC;
    border: 1px solid #E2E8F0;
    display: grid;
    gap: 4px;
  }

  .limit-user-box span,
  .current-limit-box span {
    color: #64748B;
    font-size: 13px;
    font-weight: 700;
  }

  .current-limit-box {
    grid-template-columns: auto 1fr auto;
    align-items: center;
  }

  .current-limit-box strong {
    color: #059669;
  }

  .spin {
    animation: usersSpin 0.9s linear infinite;
  }

  @keyframes usersSpin {
    to { transform: rotate(360deg); }
  }

  @media (max-width: 1200px) {
    .users-toolbar {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .users-search {
      grid-column: 1 / -1;
    }
  }

  @media (max-width: 768px) {
    .users-panel-head,
    .users-pagination {
      align-items: flex-start;
      flex-direction: column;
    }

    .users-toolbar {
      grid-template-columns: 1fr;
    }

    .add-user-grid,
    .detail-info-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 576px) {

  }
`

export default Users
