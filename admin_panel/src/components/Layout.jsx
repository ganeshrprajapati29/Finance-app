import { Container } from 'react-bootstrap'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  BarChart3,
  Calculator,
  Calendar,
  ChevronDown,
  Clock,
  CreditCard,
  DollarSign,
  FileText,
  Gavel,
  HelpCircle,
  History,
  ImagePlus,
  Gift,
  Lock,
  LogOut,
  MapPin,
  Menu,
  MessageSquare,
  Phone,
  QrCode,
  Search,
  Send,
  Settings,
  ShieldCheck,
  StickyNote,
  User,
  Users,
  Users2,
  Wallet,
  X,
  Layers,
} from 'lucide-react'
import api from '../api/axios.js'
import NotificationBell from './NotificationBell.jsx'
import 'bootstrap/dist/css/bootstrap.min.css'

const navSections = [
  {
    id: 'main',
    label: 'Main',
    items: [
      { label: 'Dashboard', to: '/dashboard', icon: BarChart3 },
      { label: 'Users', to: '/users', icon: Users },
      { label: 'Payments', to: '/payments', icon: CreditCard },
      { label: 'KYC Review', to: '/kyc', icon: ShieldCheck },
      { label: 'Offers & Banners', to: '/offers', icon: ImagePlus },
      { label: 'Rewards & Coupons', to: '/rewards', icon: Gift },
      { label: 'Reports', to: '/reports', icon: BarChart3 },
    ],
  },
  {
    id: 'loans',
    label: 'Loans & EMI',
    icon: FileText,
    items: [
      { label: 'Loans', to: '/loans', icon: FileText },
      { label: 'Track Loan', to: '/track-loan', icon: Search },
      { label: 'Loan Calculator', to: '/loan-calculator', icon: Calculator },
      { label: 'Loan Settlement', to: '/loan-settlement', icon: DollarSign },
      { label: 'Legal Actions', to: '/legal-actions', icon: Gavel },
      { label: 'EMI Control', to: '/emi-control', icon: Calendar },
      { label: 'Auto Debit Status', to: '/emi-control/auto-debit', icon: Calendar },
      { label: 'Manual Payment Update', to: '/emi-control/manual-payment', icon: CreditCard },
      { label: 'Part Payment Support', to: '/emi-control/part-payment', icon: CreditCard },
      { label: 'Penalty Management', to: '/emi-control/penalty-management', icon: AlertTriangle },
      { label: 'Extend EMI Due Date', to: '/emi-control/extend-due-date', icon: Clock },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    icon: Users2,
    items: [
      { label: 'Withdrawals', to: '/withdrawals', icon: CreditCard },
      { label: 'Virtual Accounts', to: '/virtual-accounts', icon: CreditCard },
      { label: 'Virtual Cards', to: '/virtual-cards', icon: CreditCard },
      { label: 'Payouts', to: '/payouts', icon: DollarSign },
      { label: 'QR Codes', to: '/qr', icon: QrCode },
      { label: 'QR Sticker Orders', to: '/qr-sticker-orders', icon: StickyNote },
      { label: 'Invoices', to: '/invoices', icon: FileText },
      { label: 'Overdue Users', to: '/overdue-users', icon: AlertTriangle },
      { label: 'Call Logs', to: '/call-logs', icon: Phone },
      { label: 'Visit Logs', to: '/visit-logs', icon: MapPin },
      { label: 'Warning SMS', to: '/warning-sms', icon: MessageSquare },
    ],
  },
  {
    id: 'team',
    label: 'Team & Agents',
    icon: Users2,
    items: [
      { label: 'Employees', to: '/employees', icon: Users2 },
      { label: 'Employee History', to: '/employee-history', icon: History },
      { label: 'Create Agent', to: '/create-agent', icon: Users2 },
      { label: 'Agent Performance', to: '/agent-performance', icon: BarChart3 },
      { label: 'PTP Tracking', to: '/ptp-tracking', icon: Clock },
    ],
  },
  {
    id: 'earnings',
    label: 'Earnings',
    icon: DollarSign,
    items: [
      { label: 'Earnings Dashboard', to: '/earnings-dashboard', icon: DollarSign },
      { label: 'Bill Earnings', to: '/bill-earnings', icon: DollarSign },
      { label: 'Loan Earnings', to: '/loan-earnings', icon: DollarSign },
      { label: 'QR Earnings', to: '/qr-earnings', icon: DollarSign },
      { label: 'Ads Earnings', to: '/ads-earnings', icon: DollarSign },
    ],
  },
  {
    id: 'clubapi',
    label: 'Club API',
    icon: CreditCard,
    items: [
      { label: 'Club API Dashboard', to: '/clubapi/dashboard', icon: BarChart3 },
      { label: 'Recharge & Bill Services', to: '/clubapi/services', icon: Layers },
      { label: 'Club API Transactions', to: '/clubapi/transactions', icon: FileText },
      { label: 'Fund Requests', to: '/clubapi/fund-requests', icon: Wallet },
      { label: 'Club API Bills', to: '/clubapi/bills', icon: CreditCard },
      { label: 'Club API Tools', to: '/clubapi/tools', icon: Send },
      { label: 'Club API Settings', to: '/clubapi/settings', icon: Settings },
    ],
  },
  {
    id: 'engage',
    label: 'Support & Engagement',
    icon: HelpCircle,
    items: [
      { label: 'Support', to: '/support', icon: HelpCircle },
      { label: 'FAQs', to: '/faqs', icon: HelpCircle },
      { label: 'Push Notifications', to: '/push', icon: Send },
      { label: 'Notification History', to: '/notification-history', icon: History },
    ],
  },
  {
    id: 'system',
    label: 'System',
    icon: Settings,
    items: [
      { label: 'Settings', to: '/settings', icon: Settings },
      { label: 'Profile', to: '/profile', icon: User },
      { label: 'Change Password', to: '/change-password', icon: Lock },
      { label: 'Audit Log', to: '/audit', icon: History },
    ],
  },
]

const flatItems = navSections.flatMap((section) => section.items)

function isActivePath(pathname, itemPath) {
  return pathname === itemPath || pathname.startsWith(`${itemPath}/`)
}

export default function Layout() {
  const nav = useNavigate()
  const location = useLocation()
  const [admin, setAdmin] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 992)
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 992)
  const [openSections, setOpenSections] = useState({})

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

  useEffect(() => {
    const syncLayout = () => {
      const mobile = window.innerWidth <= 992
      setIsMobile(mobile)
      setSidebarOpen((current) => (mobile ? false : current || true))
    }
    window.addEventListener('resize', syncLayout)
    return () => window.removeEventListener('resize', syncLayout)
  }, [])

  useEffect(() => {
    const activeSection = navSections.find((section) =>
      section.items.some((item) => isActivePath(location.pathname, item.to))
    )
    if (activeSection) {
      setOpenSections((current) => ({ ...current, [activeSection.id]: true }))
    }
    if (isMobile) setSidebarOpen(false)
  }, [location.pathname, isMobile])

  const currentItem = useMemo(() => (
    flatItems
      .filter((item) => isActivePath(location.pathname, item.to))
      .sort((a, b) => b.to.length - a.to.length)[0] || { label: 'Admin Panel' }
  ), [location.pathname])

  const quickLinks = flatItems.filter((item) =>
    ['/dashboard', '/users', '/loans', '/payments', '/support'].includes(item.to)
  )

  const adminName = admin?.name || admin?.fullName || admin?.email || 'Admin'
  const adminEmail = admin?.email || 'Logged in'
  const adminInitial = adminName.charAt(0).toUpperCase()

  const logout = () => {
    localStorage.removeItem('kp_tokens')
    nav('/login')
  }

  const toggleSection = (id) => {
    setOpenSections((current) => ({ ...current, [id]: !current[id] }))
  }

  return (
    <div className="admin-shell">
      {isMobile && sidebarOpen && <button className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar" />}

      <aside className={`admin-sidebar ${sidebarOpen ? 'open' : 'collapsed'} ${isMobile ? 'mobile' : ''}`}>
        <div className="sidebar-brand">
          <Link to="/dashboard" className="brand-mark">K</Link>
          {sidebarOpen && (
            <div className="brand-copy">
              <strong>Khatu Pay</strong>
              <span>Admin Console</span>
            </div>
          )}
          <button className="icon-btn sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Toggle sidebar">
            {sidebarOpen ? <X size={19} /> : <Menu size={19} />}
          </button>
        </div>

        <div className="sidebar-profile">
          <div className="profile-avatar">{loading ? 'A' : adminInitial}</div>
          {sidebarOpen && (
            <div className="profile-copy">
              <strong>{loading ? 'Loading...' : adminName}</strong>
              <span>{adminEmail}</span>
            </div>
          )}
        </div>

        <nav className="sidebar-nav">
          {navSections.map((section) => {
            const SectionIcon = section.icon
            const sectionActive = section.items.some((item) => isActivePath(location.pathname, item.to))
            const expanded = sidebarOpen && (openSections[section.id] || section.id === 'main' || sectionActive)

            if (section.id === 'main') {
              return (
                <div className="nav-section" key={section.id}>
                  {sidebarOpen && <div className="nav-section-label">{section.label}</div>}
                  {section.items.map((item) => <SidebarLink key={item.to} item={item} sidebarOpen={sidebarOpen} />)}
                </div>
              )
            }

            return (
              <div className={`nav-section ${sectionActive ? 'active-section' : ''}`} key={section.id}>
                <button
                  className={`section-trigger ${sectionActive ? 'active' : ''}`}
                  onClick={() => sidebarOpen ? toggleSection(section.id) : setSidebarOpen(true)}
                  title={section.label}
                >
                  {SectionIcon && <SectionIcon size={19} />}
                  {sidebarOpen && (
                    <>
                      <span>{section.label}</span>
                      <ChevronDown className={expanded ? 'chevron open' : 'chevron'} size={16} />
                    </>
                  )}
                </button>
                {expanded && (
                  <div className="section-links">
                    {section.items.map((item) => <SidebarLink key={item.to} item={item} sidebarOpen={sidebarOpen} nested />)}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        <div className="sidebar-footer">
          <button className="logout-btn" onClick={logout}>
            <LogOut size={19} />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div className="topbar-left">
            <button className="icon-btn mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Open sidebar">
              <Menu size={20} />
            </button>
            <div className="title-block">
              <span>Admin Panel</span>
              <h1>{currentItem.label}</h1>
            </div>
          </div>

          <div className="admin-navbar-links">
            {quickLinks.map((item) => {
              const Icon = item.icon
              return (
                <NavLink key={item.to} to={item.to} className={({ isActive }) => `quick-link ${isActive ? 'active' : ''}`}>
                  <Icon size={16} />
                  <span>{item.label}</span>
                </NavLink>
              )
            })}
          </div>

          <div className="topbar-actions">
            <NotificationBell />
            <details className="admin-profile-menu">
              <summary>
                <div className="profile-avatar small">{loading ? 'A' : adminInitial}</div>
                <div className="admin-profile-text">
                  <strong>{loading ? 'Loading...' : adminName}</strong>
                  <span>{adminEmail}</span>
                </div>
                <ChevronDown size={16} color="#64748B" />
              </summary>
              <div className="profile-dropdown">
                <Link className="admin-dropdown-link" to="/profile"><User size={16} /> Profile</Link>
                <Link className="admin-dropdown-link" to="/settings"><Settings size={16} /> Settings</Link>
                <Link className="admin-dropdown-link" to="/change-password"><Lock size={16} /> Change Password</Link>
                <button className="admin-dropdown-link admin-dropdown-button" onClick={logout}><LogOut size={16} /> Logout</button>
              </div>
            </details>
          </div>
        </header>

        <section className="admin-content">
          <Container fluid>
            <Outlet />
          </Container>
        </section>
      </main>

      <style>{`
        html, body, #root {
          height: 100%;
          width: 100%;
        }

        body {
          margin: 0;
          padding: 0;
          overflow: hidden;
          background: #F8FAFC;
        }

        * {
          box-sizing: border-box;
        }

        .admin-shell {
          display: flex;
          height: 100vh;
          width: 100%;
          overflow: hidden;
          background: #F8FAFC;
        }

        .admin-sidebar {
          width: 292px;
          min-width: 292px;
          display: flex;
          flex-direction: column;
          background: linear-gradient(180deg, #0B1220 0%, #111827 52%, #0F172A 100%);
          border-right: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 10px 0 35px rgba(15, 23, 42, 0.20);
          transition: width .22s ease, min-width .22s ease, transform .22s ease;
          position: relative;
          z-index: 1000;
        }

        .admin-sidebar.collapsed {
          width: 82px;
          min-width: 82px;
        }

        .sidebar-brand {
          height: 76px;
          padding: 16px;
          display: flex;
          align-items: center;
          gap: 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .brand-mark {
          width: 42px;
          height: 42px;
          min-width: 42px;
          border-radius: 12px;
          display: grid;
          place-items: center;
          color: #FFFFFF;
          text-decoration: none;
          font-size: 21px;
          font-weight: 900;
          background: linear-gradient(135deg, #0F766E, #2563EB);
          box-shadow: 0 14px 28px rgba(37, 99, 235, 0.26);
        }

        .brand-copy,
        .profile-copy,
        .title-block,
        .admin-profile-text {
          min-width: 0;
        }

        .brand-copy strong,
        .profile-copy strong,
        .admin-profile-text strong {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .brand-copy strong {
          color: #FFFFFF;
          font-size: 16px;
          line-height: 1.2;
        }

        .brand-copy span {
          color: #94A3B8;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: .08em;
          text-transform: uppercase;
        }

        .icon-btn {
          width: 38px;
          height: 38px;
          border: 1px solid rgba(148, 163, 184, 0.22);
          border-radius: 10px;
          display: inline-grid;
          place-items: center;
          background: rgba(255, 255, 255, 0.08);
          color: #FFFFFF;
          cursor: pointer;
          transition: background .18s ease, border-color .18s ease, transform .18s ease;
        }

        .icon-btn:hover {
          background: rgba(255, 255, 255, 0.14);
          border-color: rgba(255, 255, 255, 0.20);
        }

        .sidebar-toggle {
          margin-left: auto;
        }

        .sidebar-profile {
          margin: 14px 12px 8px;
          padding: 12px;
          display: flex;
          align-items: center;
          gap: 10px;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .profile-avatar {
          width: 38px;
          height: 38px;
          min-width: 38px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          color: #FFFFFF;
          font-weight: 900;
          background: linear-gradient(135deg, #0F766E, #22C55E);
        }

        .profile-avatar.small {
          width: 34px;
          height: 34px;
          min-width: 34px;
        }

        .profile-copy strong {
          color: #F8FAFC;
          font-size: 13px;
        }

        .profile-copy span {
          display: block;
          color: #94A3B8;
          font-size: 11px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .sidebar-nav {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 8px 10px 14px;
          scrollbar-width: thin;
          scrollbar-color: rgba(148, 163, 184, 0.30) transparent;
        }

        .sidebar-nav::-webkit-scrollbar {
          width: 6px;
        }

        .sidebar-nav::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.32);
          border-radius: 99px;
        }

        .nav-section {
          margin-bottom: 7px;
        }

        .nav-section-label {
          padding: 12px 12px 7px;
          color: #64748B;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: .08em;
          text-transform: uppercase;
        }

        .section-trigger,
        .sidebar-link {
          width: 100%;
          height: 42px;
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 0 12px;
          border: 0;
          border-radius: 11px;
          color: #CBD5E1;
          background: transparent;
          text-decoration: none;
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
          transition: background .18s ease, color .18s ease, box-shadow .18s ease;
        }

        .section-trigger svg,
        .sidebar-link svg {
          flex: 0 0 auto;
        }

        .section-trigger span,
        .sidebar-link span {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .section-trigger:hover,
        .sidebar-link:hover {
          background: rgba(37, 99, 235, 0.14);
          color: #FFFFFF;
        }

        .section-trigger.active,
        .sidebar-link.active {
          color: #FFFFFF;
          background: linear-gradient(135deg, #0F766E, #2563EB);
          box-shadow: 0 10px 24px rgba(15, 118, 110, 0.24);
        }

        .chevron {
          margin-left: auto;
          transition: transform .18s ease;
        }

        .chevron.open {
          transform: rotate(180deg);
        }

        .section-links {
          margin: 7px 0 3px 18px;
          padding-left: 10px;
          border-left: 1px solid rgba(148, 163, 184, 0.22);
        }

        .section-links .sidebar-link {
          height: 38px;
          padding-left: 10px;
          font-size: 12.5px;
          color: #94A3B8;
        }

        .admin-sidebar.collapsed .sidebar-profile,
        .admin-sidebar.collapsed .sidebar-brand {
          justify-content: center;
        }

        .admin-sidebar.collapsed .sidebar-toggle {
          margin-left: 0;
        }

        .admin-sidebar.collapsed .sidebar-link,
        .admin-sidebar.collapsed .section-trigger {
          justify-content: center;
          padding: 0;
        }

        .sidebar-footer {
          padding: 14px 12px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }

        .logout-btn {
          width: 100%;
          height: 42px;
          border: 1px solid rgba(239, 68, 68, 0.30);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          color: #FCA5A5;
          background: rgba(239, 68, 68, 0.10);
          font-weight: 900;
          cursor: pointer;
        }

        .logout-btn:hover {
          background: rgba(239, 68, 68, 0.18);
        }

        .admin-main {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .admin-topbar {
          height: 72px;
          padding: 12px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          background: rgba(255, 255, 255, 0.96);
          border-bottom: 1px solid #E2E8F0;
          box-shadow: 0 2px 18px rgba(15, 23, 42, 0.06);
        }

        .topbar-left,
        .topbar-actions {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }

        .mobile-menu {
          display: none;
          color: #0F172A;
          background: #F8FAFC;
          border-color: #E2E8F0;
        }

        .title-block span {
          display: block;
          color: #64748B;
          font-size: 12px;
          font-weight: 800;
          text-transform: uppercase;
        }

        .title-block h1 {
          margin: 0;
          max-width: 360px;
          color: #0F172A;
          font-size: 22px;
          font-weight: 900;
          line-height: 1.16;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .admin-navbar-links {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
          overflow-x: auto;
          padding-bottom: 2px;
        }

        .quick-link {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 9px 11px;
          border-radius: 10px;
          color: #475569;
          background: #F8FAFC;
          border: 1px solid #E2E8F0;
          text-decoration: none;
          font-size: 13px;
          font-weight: 800;
          white-space: nowrap;
        }

        .quick-link.active,
        .quick-link:hover {
          color: #FFFFFF;
          background: #0F766E;
          border-color: #0F766E;
        }

        .admin-profile-menu {
          position: relative;
        }

        .admin-profile-menu summary {
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          list-style: none;
          padding: 6px 10px;
          border-radius: 12px;
          border: 1px solid #E2E8F0;
          background: #F8FAFC;
        }

        details summary::-webkit-details-marker {
          display: none;
        }

        .admin-profile-text {
          max-width: 160px;
          text-align: left;
        }

        .admin-profile-text strong {
          color: #0F172A;
          font-size: 13px;
          line-height: 1.2;
        }

        .admin-profile-text span {
          display: block;
          color: #64748B;
          font-size: 11px;
          font-weight: 700;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .profile-dropdown {
          position: absolute;
          right: 0;
          top: calc(100% + 8px);
          width: 230px;
          padding: 8px;
          background: #FFFFFF;
          border: 1px solid #E2E8F0;
          border-radius: 12px;
          box-shadow: 0 18px 40px rgba(15, 23, 42, 0.16);
          z-index: 1200;
        }

        .admin-dropdown-link {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          border: 0;
          border-radius: 9px;
          background: transparent;
          color: #334155;
          font-size: 13px;
          font-weight: 800;
          text-decoration: none;
          text-align: left;
          cursor: pointer;
        }

        .admin-dropdown-link:hover {
          background: #F1F5F9;
          color: #0F766E;
        }

        .admin-dropdown-button {
          color: #EF4444;
        }

        .admin-content {
          flex: 1;
          min-height: 0;
          min-width: 0;
          overflow: auto;
          padding: 24px;
          background: #F8FAFC;
        }

        .sidebar-backdrop {
          display: none;
        }

        @media (max-width: 1180px) {
          .admin-navbar-links {
            display: none;
          }
        }

        @media (max-width: 992px) {
          .mobile-menu {
            display: inline-grid;
          }

          .admin-sidebar.mobile {
            position: fixed;
            inset: 0 auto 0 0;
            width: 292px;
            min-width: 292px;
            transform: translateX(-105%);
          }

          .admin-sidebar.mobile.open {
            transform: translateX(0);
          }

          .admin-sidebar.mobile.collapsed {
            width: 292px;
            min-width: 292px;
          }

          .sidebar-backdrop {
            display: block;
            position: fixed;
            inset: 0;
            z-index: 900;
            border: 0;
            background: rgba(15, 23, 42, 0.48);
          }

          .admin-topbar {
            padding: 12px 16px;
          }

          .title-block h1 {
            max-width: 48vw;
            font-size: 19px;
          }

          .admin-content {
            padding: 16px;
          }
        }

        @media (max-width: 640px) {
          .admin-profile-text {
            display: none;
          }

          .admin-profile-menu summary {
            padding: 6px;
          }

          .title-block h1 {
            max-width: 54vw;
          }
        }
      `}</style>
    </div>
  )
}

function SidebarLink({ item, sidebarOpen, nested = false }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      className={({ isActive }) => `sidebar-link ${nested ? 'nested' : ''} ${isActive ? 'active' : ''}`}
      title={item.label}
    >
      <Icon size={nested ? 16 : 19} />
      {sidebarOpen && <span>{item.label}</span>}
    </NavLink>
  )
}
