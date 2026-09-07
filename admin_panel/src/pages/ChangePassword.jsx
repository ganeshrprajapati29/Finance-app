import { useMemo, useState } from 'react';
import { Alert, Button, Card, Col, Form, InputGroup, Row } from 'react-bootstrap';
import { Eye, EyeOff, KeyRound, Lock, ShieldCheck } from 'lucide-react';
import api from '../api/axios';

const ChangePassword = () => {
  const [passwords, setPasswords] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [visible, setVisible] = useState({ oldPassword: false, newPassword: false, confirmPassword: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const rules = useMemo(() => ({
    length: passwords.newPassword.length >= 8,
    upper: /[A-Z]/.test(passwords.newPassword),
    lower: /[a-z]/.test(passwords.newPassword),
    number: /\d/.test(passwords.newPassword),
    match: passwords.newPassword.length > 0 && passwords.newPassword === passwords.confirmPassword
  }), [passwords]);

  const strength = Object.values(rules).filter(Boolean).length;

  const update = (key, value) => {
    setPasswords((prev) => ({ ...prev, [key]: value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!passwords.oldPassword) return setError('Current password required hai');
    if (passwords.newPassword.length < 6) return setError('New password minimum 6 characters hona chahiye');
    if (passwords.newPassword !== passwords.confirmPassword) return setError('Confirm password match nahi kar raha');
    if (passwords.oldPassword === passwords.newPassword) return setError('New password current password se different hona chahiye');

    try {
      setLoading(true);
      setError('');
      setSuccess('');
      await api.put('/admin/change-password', {
        oldPassword: passwords.oldPassword,
        newPassword: passwords.newPassword
      });
      setSuccess('Password changed successfully');
      setPasswords({ oldPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Password change nahi ho paya');
    } finally {
      setLoading(false);
    }
  };

  const passwordField = (key, label) => (
    <Form.Group className="mb-3">
      <Form.Label>{label}</Form.Label>
      <InputGroup>
        <Form.Control type={visible[key] ? 'text' : 'password'} value={passwords[key]} onChange={(e) => update(key, e.target.value)} autoComplete="new-password" />
        <Button type="button" variant="outline-secondary" onClick={() => setVisible((prev) => ({ ...prev, [key]: !prev[key] }))}>{visible[key] ? <EyeOff size={16} /> : <Eye size={16} />}</Button>
      </InputGroup>
    </Form.Group>
  );

  return (
    <div className="password-page">
      <div className="password-head">
        <div>
          <p>Security</p>
          <h2><KeyRound size={28} /> Change Password</h2>
          <span>Update your admin password and keep account access protected.</span>
        </div>
      </div>

      {error && <Alert variant="warning" dismissible onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert variant="success" dismissible onClose={() => setSuccess('')}>{success}</Alert>}

      <Row className="g-3">
        <Col xl={7}>
          <Card className="password-panel">
            <Form onSubmit={submit}>
              {passwordField('oldPassword', 'Current Password')}
              {passwordField('newPassword', 'New Password')}
              {passwordField('confirmPassword', 'Confirm New Password')}
              <div className="text-end">
                <Button type="submit" disabled={loading}><Lock size={16} /> {loading ? 'Changing...' : 'Change Password'}</Button>
              </div>
            </Form>
          </Card>
        </Col>
        <Col xl={5}>
          <Card className="password-panel h-100">
            <h5><ShieldCheck size={18} /> Password Strength</h5>
            <div className="strength-bar"><span style={{ width: `${(strength / 5) * 100}%` }} /></div>
            <ul className="password-rules">
              <li className={rules.length ? 'ok' : ''}>At least 8 characters</li>
              <li className={rules.upper ? 'ok' : ''}>One uppercase letter</li>
              <li className={rules.lower ? 'ok' : ''}>One lowercase letter</li>
              <li className={rules.number ? 'ok' : ''}>One number</li>
              <li className={rules.match ? 'ok' : ''}>Passwords match</li>
            </ul>
          </Card>
        </Col>
      </Row>

      <style>{`
        .password-page{padding:8px 0 24px;color:#111827}.password-head{margin-bottom:18px}.password-head p{margin:0 0 4px;color:#0f766e;font-size:12px;font-weight:900;text-transform:uppercase}.password-head h2{display:flex;align-items:center;gap:10px;margin:0;font-weight:850}.password-head span{color:#64748b}.password-panel{border:1px solid #e5e7eb;border-radius:8px;box-shadow:0 10px 26px rgba(15,23,42,.06);padding:20px}.password-panel h5{display:flex;align-items:center;gap:8px;font-weight:850;margin-bottom:14px}.password-panel .btn{display:inline-flex;align-items:center;gap:6px}.strength-bar{height:10px;background:#e5e7eb;border-radius:999px;overflow:hidden;margin-bottom:14px}.strength-bar span{display:block;height:100%;background:#0f766e;transition:.2s}.password-rules{padding-left:18px;margin:0}.password-rules li{color:#64748b;margin-bottom:8px}.password-rules li.ok{color:#047857;font-weight:800}
      `}</style>
    </div>
  );
};

export default ChangePassword;
