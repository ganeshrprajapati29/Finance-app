import { Container, Nav, Navbar, NavDropdown } from 'react-bootstrap'
import { Link, Outlet, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import api from '../api/axios.js'
import NotificationBell from './NotificationBell.jsx'
import { Menu, X, LogOut, Settings, Lock, User, Mail, Phone, ChevronDown, BarChart3, Users, FileText, CreditCard, Bell, HelpCircle, Send, History, MoreVertical, Users2, DollarSign, Gavel, Search, Calculator, Calendar, Zap, Edit, Split, AlertTriangle, Clock, MapPin, MessageSquare, UserCheck } from 'lucide-react'
import 'bootstrap/dist/css/bootstrap.min.css'

export default function Layout(){
  const nav = useNavigate()
  const [admin, setAdmin] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [loading, setLoading] = useState(true)
  
  const logout = ()=>{ 
    localStorage.removeItem('kp_tokens')
    nav('/login') 
  }

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await api.get('/admin/profile')
        setAdmin(response.data.data)
      } catch (error) {
        console.error('Failed to fetch admin profile:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchProfile()
  }, [])

  const menuItems = [
    { label: 'Dashboard', to: '/dashboard', icon: BarChart3 },
    { label: 'Users', to: '/users', icon: Users },
    { label: 'Loans', to: '/loans', icon: FileText },
    { label: 'EMI / Repayment Control', to: '/emi-control', icon: Calendar },
    { label: 'Withdrawals', to: '/withdrawals', icon: CreditCard },
    { label: 'Payments', to: '/payments', icon: CreditCard },
    { label: 'Reports', to: '/reports', icon: BarChart3 },
    { label: 'Track Loan', to: '/track-loan', icon: Search },
    { label: 'Loan Calculator', to: '/loan-calculator', icon: Calculator },
    { label: 'Overdue Users', to: '/overdue-users', icon: AlertTriangle },
    { label: 'Call Logs', to: '/call-logs', icon: Phone },
    { label: 'Visit Logs', to: '/visit-logs', icon: MapPin },
    { label: 'Warning SMS', to: '/warning-sms', icon: MessageSquare },
    { label: 'Create Agent', to: '/create-agent', icon: Users2 },
    { label: 'Agent Performance', to: '/agent-performance', icon: BarChart3 },
    { label: 'PTP Tracking', to: '/ptp-tracking', icon: Clock },
    { label: 'Loan Settlement', to: '/loan-settlement', icon: DollarSign },
    { label: 'Legal Actions', to: '/legal-actions', icon: Gavel },
    { label: 'FAQs', to: '/faqs', icon: HelpCircle },
    { label: 'Push Notifications', to: '/push', icon: Send },
    { label: 'Notification History', to: '/notification-history', icon: History },
    { label: 'Settings', to: '/settings', icon: Settings },
    { label: 'Support', to: '/support', icon: HelpCircle },
    { label: 'Change Password', to: '/change-password', icon: Lock },
    { label: 'Audit Log', to: '/audit', icon: History },
  ]

  const employeeItems = [
    { label: 'Manage Employees', to: '/employees' },
    { label: 'Employee History', to: '/employee-history' },
  ]

  const emiItems = [
    { label: 'Auto Debit Status', to: '/emi-control/auto-debit' },
    { label: 'Manual Payment Update', to: '/emi-control/manual-payment' },
    { label: 'Part Payment Support', to: '/emi-control/part-payment' },
    { label: 'Penalty Charges Management', to: '/emi-control/penalty-management' },
    { label: 'Extend EMI / Due Date Option', to: '/emi-control/extend-due-date' },
  ]

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#F8FAFC', overflow: 'hidden' }}>
      {/* Sidebar */}
      <div
        style={{
          width: sidebarOpen ? '280px' : '80px',
          background: 'linear-gradient(180deg, #0F172A 0%, #1E293B 100%)',
          transition: 'all 0.3s ease',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
          flexShrink: 0,
          position: 'relative',
          zIndex: 999
        }}
        className="sidebar"
      >
        {/* Brand */}
        <div
          style={{
            padding: '24px 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexShrink: 0
          }}
        >
          <div
            style={{
              background: 'linear-gradient(135deg, #0066FF, #00B366)',
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: '900',
              color: 'white',
              fontSize: '20px',
              flexShrink: 0
            }}
          >
            K
          </div>
          {sidebarOpen && (
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ color: 'white', fontWeight: '800', fontSize: '16px', overflow: 'hidden', textOverflow: 'ellipsis' }}>Khatu Pay</div>
              <div style={{ color: '#94A3B8', fontSize: '11px', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis' }}>ADMIN PANEL</div>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              color: 'white',
              borderRadius: '8px',
              padding: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Navigation */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '20px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <Nav className="flex-column" style={{ gap: '8px', width: '100%' }}>
            {menuItems.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 16px',
                    color: '#CBD5E1',
                    textDecoration: 'none',
                    borderRadius: '10px',
                    transition: 'all 0.3s ease',
                    fontSize: '14px',
                    fontWeight: '600',
                    whiteSpace: 'nowrap',
                    minWidth: 0,
                    flexShrink: 0
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(0, 102, 255, 0.15)'
                    e.currentTarget.style.color = '#0066FF'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.color = '#CBD5E1'
                  }}
                >
                  <Icon size={20} style={{ flexShrink: 0 }} />
                  {sidebarOpen && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>}
                </Link>
              )
            })}

            {/* Employees Dropdown */}
            <details
              style={{
                color: '#CBD5E1',
                transition: 'all 0.3s ease',
                flexShrink: 0
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#0066FF'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#CBD5E1'}
            >
              <summary
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  cursor: 'pointer',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: '600',
                  userSelect: 'none',
                  listStyle: 'none',
                  transition: 'all 0.3s ease',
                  minWidth: 0
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.parentElement.style.background = 'rgba(0, 102, 255, 0.1)'
                  e.currentTarget.style.color = '#0066FF'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.parentElement.style.background = 'transparent'
                  e.currentTarget.style.color = '#CBD5E1'
                }}
              >
                <Users2 size={20} style={{ flexShrink: 0 }} />
                {sidebarOpen && (
                  <>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>Employees</span>
                    <ChevronDown size={16} style={{ marginLeft: 'auto', flexShrink: 0 }} />
                  </>
                )}
              </summary>
              {sidebarOpen && (
                <div style={{ paddingLeft: '12px', marginTop: '8px', borderLeft: '2px solid rgba(0, 102, 255, 0.3)', marginLeft: '24px' }}>
                  {employeeItems.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      style={{
                        display: 'block',
                        padding: '10px 16px',
                        color: '#94A3B8',
                        textDecoration: 'none',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: '600',
                        transition: 'all 0.3s ease',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(0, 102, 255, 0.15)'
                        e.currentTarget.style.color = '#0066FF'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent'
                        e.currentTarget.style.color = '#94A3B8'
                      }}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </details>
          </Nav>
        </div>

        {/* Logout Button */}
        <div style={{ padding: '16px 12px', borderTop: '1px solid rgba(255, 255, 255, 0.1)', flexShrink: 0 }}>
          <button
            onClick={logout}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 16px',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#EF4444',
              borderRadius: '10px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '700',
              transition: 'all 0.3s ease',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.25)'
              e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.5)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'
              e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)'
            }}
          >
            <LogOut size={20} style={{ flexShrink: 0 }} />
            {sidebarOpen && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>Logout</span>}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {/* Top Navbar */}
        <Navbar
          bg="light"
          expand="lg"
          style={{
            background: 'linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 100%)',
            borderBottom: '1px solid #E2E8F0',
            padding: '16px 24px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
            flexShrink: 0
          }}
        >
          <Navbar.Brand style={{ fontWeight: '800', fontSize: '20px', color: '#0F172A' }}>
            Khatu Pay Admin
          </Navbar.Brand>
          <Navbar.Toggle aria-controls="basic-navbar-nav" />
          <Navbar.Collapse id="basic-navbar-nav" className="justify-content-end">
            <Nav style={{ gap: '12px', alignItems: 'center' }}>
              {/* Notification Bell */}
              <NotificationBell />

              <NavDropdown
                title={
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0F172A', whiteSpace: 'nowrap' }}>
                    <User size={18} />
                    <span style={{ fontWeight: '700', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {loading ? 'Loading...' : admin?.name || 'Admin'}
                    </span>
                    <ChevronDown size={16} />
                  </div>
                }
                id="admin-dropdown"
                style={{ cursor: 'pointer' }}
              >
                <NavDropdown.Item disabled style={{ cursor: 'default', padding: '16px', maxWidth: '300px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <div
                      style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '12px',
                        background: 'linear-gradient(135deg, #0066FF, #00B366)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontWeight: '900',
                        fontSize: '18px',
                        flexShrink: 0
                      }}
                    >
                      {admin?.name?.charAt(0) || 'A'}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: '700', color: '#0F172A', fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {admin?.name}
                      </div>
                      <div style={{ color: '#64748B', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {admin?.email}
                      </div>
                      {admin?.mobile && (
                        <div style={{ color: '#64748B', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {admin.mobile}
                        </div>
                      )}
                    </div>
                  </div>
                </NavDropdown.Item>
                <NavDropdown.Divider />
                <NavDropdown.Item as={Link} to="/profile" style={{ color: '#0F172A', fontWeight: '600' }}>
                  <UserCheck size={16} style={{ marginRight: '8px' }} />
                  Edit Profile
                </NavDropdown.Item>
                <NavDropdown.Item as={Link} to="/change-password" style={{ color: '#0F172A', fontWeight: '600' }}>
                  <Lock size={16} style={{ marginRight: '8px' }} />
                  Change Password
                </NavDropdown.Item>
                <NavDropdown.Item as={Link} to="/settings" style={{ color: '#0F172A', fontWeight: '600' }}>
                  <Settings size={16} style={{ marginRight: '8px' }} />
                  Settings
                </NavDropdown.Item>
                <NavDropdown.Divider />
                <NavDropdown.Item onClick={logout} style={{ color: '#EF4444', fontWeight: '700' }}>
                  <LogOut size={16} style={{ marginRight: '8px' }} />
                  Logout
                </NavDropdown.Item>
              </NavDropdown>
            </Nav>
          </Navbar.Collapse>
        </Navbar>

        {/* Content Area */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            background: '#F8FAFC',
            padding: '24px',
            minHeight: 0,
            minWidth: 0
          }}
        >
          <Container fluid style={{ maxWidth: '100%' }}>
            <Outlet />
          </Container>
        </div>
      </div>

      <style>{`
        body {
          margin: 0;
          padding: 0;
          overflow: hidden;
        }

        .sidebar {
          scrollbar-width: thin;
          scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
        }

        .sidebar::-webkit-scrollbar {
          width: 6px;
        }

        .sidebar::-webkit-scrollbar-track {
          background: transparent;
        }

        .sidebar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 3px;
        }

        .sidebar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.3);
        }

        details summary::-webkit-details-marker {
          display: none;
        }

        * {
          box-sizing: border-box;
        }

        html, body, #root {
          height: 100%;
          width: 100%;
        }
      `}</style>
    </div>
  )
}