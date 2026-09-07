import { useEffect, useMemo, useState } from 'react'
import { Card, Col, Form, Row } from 'react-bootstrap'
import {
  Bell,
  RefreshCw,
  Save,
  Settings as SettingsIcon,
  Shield,
  Wallet,
} from 'lucide-react'
import api from '../api/axios'
import {
  AlertStrip,
  LoadingState,
  MetricTile,
  PageHeader,
  formatCurrency,
} from '../components/AdminUI.jsx'

const defaults = {
  appName: 'Khatu Pay',
  appVersion: '1.0.0',
  supportEmail: 'support@khatupay.com',
  maintenanceMode: false,
  maxLoanAmount: 50000,
  minLoanAmount: 1000,
  interestRate: 12.5,
  loanDuration: 12,
  fcmEnabled: false,
  emailEnabled: true,
  smsEnabled: false,
}

const unwrap = (res) => res?.data?.data || res?.data || {}

const Settings = () => {
  const [settings, setSettings] = useState(defaults)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const fetchSettings = async () => {
    try {
      setLoading(true)
      setError('')
      const res = await api.get('/admin/settings')
      setSettings({ ...defaults, ...unwrap(res) })
    } catch (err) {
      setError(
        err.response?.data?.message || 'Settings could not be loaded. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSettings()
  }, [])

  const stats = useMemo(
    () => ({
      loanRange: `${formatCurrency(settings.minLoanAmount)} – ${formatCurrency(
        settings.maxLoanAmount
      )}`,
      channels:
        [
          settings.fcmEnabled && 'Push',
          settings.emailEnabled && 'Email',
          settings.smsEnabled && 'SMS',
        ]
          .filter(Boolean)
          .join(' · ') || 'None enabled',
      mode: settings.maintenanceMode ? 'Maintenance' : 'Live',
    }),
    [settings]
  )

  const update = (key, value) => setSettings((prev) => ({ ...prev, [key]: value }))

  const saveSettings = async (event) => {
    event?.preventDefault?.()

    // Validate before hitting the API so an obviously wrong policy never
    // reaches production config.
    const min = Number(settings.minLoanAmount)
    const max = Number(settings.maxLoanAmount)
    const rate = Number(settings.interestRate)
    const duration = Number(settings.loanDuration)

    if (!(min > 0) || !(max > 0)) {
      setError('Loan amounts must be greater than zero.')
      return
    }
    if (min > max) {
      setError('Minimum loan amount cannot be higher than the maximum.')
      return
    }
    if (!(rate >= 0) || rate > 60) {
      setError('Interest rate must be between 0% and 60% APR.')
      return
    }
    if (!Number.isInteger(duration) || duration < 1 || duration > 60) {
      setError('Default duration must be a whole number between 1 and 60 months.')
      return
    }

    try {
      setSaving(true)
      setError('')
      setSuccess('')
      const res = await api.put('/admin/settings', {
        ...settings,
        minLoanAmount: min,
        maxLoanAmount: max,
        interestRate: rate,
        loanDuration: duration,
      })
      setSettings({ ...defaults, ...unwrap(res) })
      setSuccess('Settings saved successfully.')
    } catch (err) {
      setError(
        err.response?.data?.message || 'Settings could not be saved. Please try again.'
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingState message="Loading settings..." />

  return (
    <div>
      <PageHeader
        icon={SettingsIcon}
        title="Settings"
        subtitle="App configuration, loan policy limits and notification channels."
        actions={
          <>
            <button
              type="button"
              className="btn btn-outline-primary btn-sm"
              onClick={fetchSettings}
              disabled={saving}
            >
              <RefreshCw size={14} className="me-1" /> Discard changes
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={saveSettings}
              disabled={saving}
            >
              <Save size={14} className="me-1" /> {saving ? 'Saving...' : 'Save settings'}
            </button>
          </>
        }
      />

      {error && <AlertStrip tone="danger">{error}</AlertStrip>}
      {success && <AlertStrip tone="success">{success}</AlertStrip>}

      {settings.maintenanceMode && (
        <AlertStrip tone="warning">
          Maintenance mode is ON. Customers cannot transact in the app while this is
          enabled.
        </AlertStrip>
      )}

      <Row className="g-2 mb-3">
        <Col md={4}>
          <MetricTile
            label="App mode"
            value={stats.mode}
            footnote={`${settings.appName} v${settings.appVersion}`}
            icon={Shield}
            tone={settings.maintenanceMode ? 'saffron' : 'green'}
          />
        </Col>
        <Col md={4}>
          <MetricTile
            label="Loan range"
            value={stats.loanRange}
            footnote={`${settings.interestRate}% APR · ${settings.loanDuration} months default`}
            icon={Wallet}
            tone="teal"
          />
        </Col>
        <Col md={4}>
          <MetricTile
            label="Notification channels"
            value={stats.channels}
            footnote="Delivery routes for customer alerts"
            icon={Bell}
            tone="blue"
          />
        </Col>
      </Row>

      <Form onSubmit={saveSettings}>
        <Row className="g-3">
          <Col xl={6}>
            <Card className="kp-card h-100">
              <div className="kp-card-header">
                <SettingsIcon size={16} color="var(--kp-deep-teal)" />
                <h2 className="kp-card-title">General</h2>
              </div>
              <div className="kp-card-body">
                <Row className="g-3">
                  <Col md={6}>
                    <Form.Label>App name</Form.Label>
                    <Form.Control
                      value={settings.appName || ''}
                      onChange={(e) => update('appName', e.target.value)}
                    />
                  </Col>
                  <Col md={6}>
                    <Form.Label>App version</Form.Label>
                    <Form.Control
                      value={settings.appVersion || ''}
                      onChange={(e) => update('appVersion', e.target.value)}
                    />
                  </Col>
                  <Col md={12}>
                    <Form.Label>Support email</Form.Label>
                    <Form.Control
                      type="email"
                      value={settings.supportEmail || ''}
                      onChange={(e) => update('supportEmail', e.target.value)}
                    />
                  </Col>
                  <Col md={12}>
                    <Form.Check
                      type="switch"
                      id="maintenance-mode"
                      label="Maintenance mode (blocks customer transactions)"
                      checked={Boolean(settings.maintenanceMode)}
                      onChange={(e) => update('maintenanceMode', e.target.checked)}
                    />
                  </Col>
                </Row>
              </div>
            </Card>
          </Col>

          <Col xl={6}>
            <Card className="kp-card h-100">
              <div className="kp-card-header">
                <Wallet size={16} color="var(--kp-deep-teal)" />
                <h2 className="kp-card-title">Loan policy</h2>
              </div>
              <div className="kp-card-body">
                <Row className="g-3">
                  <Col md={6}>
                    <Form.Label>Minimum loan amount (₹)</Form.Label>
                    <Form.Control
                      type="number"
                      min="0"
                      value={settings.minLoanAmount}
                      onChange={(e) => update('minLoanAmount', e.target.value)}
                    />
                  </Col>
                  <Col md={6}>
                    <Form.Label>Maximum loan amount (₹)</Form.Label>
                    <Form.Control
                      type="number"
                      min="0"
                      value={settings.maxLoanAmount}
                      onChange={(e) => update('maxLoanAmount', e.target.value)}
                    />
                  </Col>
                  <Col md={6}>
                    <Form.Label>Interest rate (% APR)</Form.Label>
                    <Form.Control
                      type="number"
                      min="0"
                      max="60"
                      step="0.1"
                      value={settings.interestRate}
                      onChange={(e) => update('interestRate', e.target.value)}
                    />
                  </Col>
                  <Col md={6}>
                    <Form.Label>Default duration (months)</Form.Label>
                    <Form.Control
                      type="number"
                      min="1"
                      max="60"
                      value={settings.loanDuration}
                      onChange={(e) => update('loanDuration', e.target.value)}
                    />
                  </Col>
                </Row>
              </div>
            </Card>
          </Col>

          <Col xl={12}>
            <Card className="kp-card">
              <div className="kp-card-header">
                <Bell size={16} color="var(--kp-deep-teal)" />
                <h2 className="kp-card-title">Notification channels</h2>
              </div>
              <div className="kp-card-body">
                <div className="d-flex flex-wrap gap-4">
                  <Form.Check
                    type="switch"
                    id="fcm-enabled"
                    label="Push notifications (FCM)"
                    checked={Boolean(settings.fcmEnabled)}
                    onChange={(e) => update('fcmEnabled', e.target.checked)}
                  />
                  <Form.Check
                    type="switch"
                    id="email-enabled"
                    label="Email notifications"
                    checked={Boolean(settings.emailEnabled)}
                    onChange={(e) => update('emailEnabled', e.target.checked)}
                  />
                  <Form.Check
                    type="switch"
                    id="sms-enabled"
                    label="SMS notifications"
                    checked={Boolean(settings.smsEnabled)}
                    onChange={(e) => update('smsEnabled', e.target.checked)}
                  />
                </div>
              </div>
            </Card>
          </Col>
        </Row>

        {/* Submit lives in the page header, but a real submit button keeps
            Enter-to-save working inside the form. */}
        <button type="submit" className="visually-hidden" disabled={saving}>
          Save settings
        </button>
      </Form>
    </div>
  )
}

export default Settings
