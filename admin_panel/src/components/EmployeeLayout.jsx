import { Container, Nav, Navbar, NavDropdown } from 'react-bootstrap'
import { Link, Outlet, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import api from '../api/axios.js'
import NotificationBell from './NotificationBell.jsx'
import { Menu, X, LogOut, Settings, Lock, User, Mail, Phone, ChevronDown, BarChart3, Users, FileText, CreditCard, Bell, HelpCircle, Send, History, MoreVertical, Users2, DollarSign, Gavel, Search, Calculator, Calendar, Zap, Edit, Split, AlertTriangle, Clock, MapPin, MessageSquare, UserCheck, QrCode, PhoneCall } from 'lucide-react'
import 'bootstrap/dist/css/bootstrap.min.css'

export default function EmployeeLayout(){
  const nav = useNavigate()
  const [employee, setEmployee] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [loading, setLoading] = useState(true)
  
  const logout = ()=>{ 
    localStorage.removeItem('kp_employee_tokens')
    localStorage.removeItem('employeeData')
    nav('/employee/login') 
  }

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const stored = localStorage.getItem('employeeData');
        if (stored) {
          setEmployee(JSON.parse(stored));
        }
        const response = await api.get('/employee/profile');
        const latest = response.data?.data || response.data;
        if (latest) {
          setEmployee(latest);
          localStorage.setItem('employeeData', JSON.stringify(latest));
        }
        setLoading(false);
      } catch (error) {
        console.error('Failed to fetch employee profile:', error)
        setLoading(false);
      }
    }
    fetchProfile()
  }, [])

  const permissions = employee?.permissions || {}
  const menuItems = [
    { label: 'Dashboard', to: '/employee/dashboard', icon: BarChart3, allowed: true },
    { label: 'Users', to: '/employee/users', icon: Users, allowed: permissions.canManageUsers },
    { label: 'Loans', to: '/employee/loans', icon: FileText, allowed: permissions.canManageLoans },
    { label: 'Payments', to: '/employee/payments', icon: CreditCard, allowed: permissions.canManagePayments },
    { label: 'Support', to: '/employee/support', icon: HelpCircle, allowed: permissions.canManageSupport },
    { label: 'Push Notifications', to: '/employee/push', icon: Send, allowed: permissions.canSendNotifications },
    { label: 'Collections', to: '/employee/collections', icon: Users, allowed: permissions.canManageCollections },
    { label: 'Reports', to: '/employee/reports', icon: History, allowed: permissions.canViewReports },
    { label: 'Audit / History', to: '/employee/history', icon: Clock, allowed: permissions.canViewAudit },
  ].filter((item) => item.allowed)

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
              <div style={{ color: '#94A3B8', fontSize: '11px', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis' }}>EMPLOYEE PANEL</div>
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

        {/* User Info */}
        {sidebarOpen && employee && (
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <div style={{ color: 'white', fontWeight: '600', fontSize: '14px' }}>{employee.name}</div>
            <div style={{ color: '#94A3B8', fontSize: '12px' }}>{employee.email}</div>
            <div style={{ color: '#10B981', fontSize: '11px', marginTop: '4px' }}>Online</div>
          </div>
        )}

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

