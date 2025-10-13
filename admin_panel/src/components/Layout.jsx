import { Container, Nav } from 'react-bootstrap'
import { Link, Outlet, useNavigate } from 'react-router-dom'

export default function Layout(){
  const nav = useNavigate()
  const logout = ()=>{ localStorage.removeItem('kp_tokens'); nav('/login') }
  return (
    <div className="d-flex">
      <div className="sidebar">
        <div className="brand mb-3"> Admin Panel</div>
        <Nav className="flex-column">
          <Nav.Link as={Link} to="/dashboard">Dashboard</Nav.Link>
          <Nav.Link as={Link} to="/users">Users</Nav.Link>
          <Nav.Link as={Link} to="/loans">Loans</Nav.Link>
          <Nav.Link as={Link} to="/payments">Payments</Nav.Link>
          <Nav.Link as={Link} to="/faqs">FAQs</Nav.Link>
          <Nav.Link as={Link} to="/push">Push</Nav.Link>
          <Nav.Link as={Link} to="/audit">Audit</Nav.Link>
          <Nav.Link onClick={logout}>Logout</Nav.Link>
        </Nav>
      </div>
      <div className="content w-100">
        <div className="header"><div>Admin</div></div>
        <Container fluid className="mt-3"><Outlet /></Container>
      </div>
    </div>
  )
}
