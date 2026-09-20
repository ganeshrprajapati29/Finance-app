import React, { useEffect, useMemo, useState } from 'react'
import { Button, Col, Form, Modal, Row } from 'react-bootstrap'
import {
  Activity,
  Bolt,
  CreditCard,
  Pencil,
  Plus,
  RefreshCcw,
  Satellite,
  Smartphone,
  Trash2,
  Car,
  Layers,
  X,
} from 'lucide-react'

import api from '../api/axios'
import {
  AlertStrip,
  DataTable,
  EmptyState,
  ErrorState,
  FilterChips,
  LoadingState,
  PageHeader,
  SearchInput,
  StatusPill,
  Toolbar,
} from '../components/AdminUI.jsx'

/**
 * Recharge & Bill Services catalog.
 *
 * ClubAPI's operator-list API only returns operator names and ids - it does
 * not return BBPS biller ids or the input fields a biller needs. So:
 *   - "Sync from ClubAPI" imports Mobile / DTH operators (and any BBPS billers
 *     the list does include),
 *   - Credit Card, Electricity and FASTag billers are added here using the
 *     bbpsId from the ClubAPI panel's BBPS biller list, with the exact fields
 *     that biller asks for.
 * The app only ever shows enabled providers, and payments re-validate against
 * this catalog on the server.
 */

const SERVICE_ICONS = {
  mobile: Smartphone,
  dth: Satellite,
  credit_card: CreditCard,
  electricity: Bolt,
  fastag: Car,
}

const FIELD_KEY_HELP = {
  mobile: 'mobile - primary account value (required)',
  opvalue1: 'opvalue1',
  opvalue2: 'opvalue2',
  opvalue3: 'opvalue3',
  opvalue4: 'opvalue4',
  opvalue5: 'opvalue5',
}

const emptyField = (key = 'mobile') => ({
  key,
  label: '',
  placeholder: '',
  hint: '',
  inputType: 'text',
  minLength: 0,
  maxLength: 64,
  pattern: '',
  uppercase: false,
})

const errorMessage = (err, fallback) => err?.response?.data?.message || fallback

export default function ServiceCatalog() {
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [active, setActive] = useState('mobile')
  const [search, setSearch] = useState('')
  const [notice, setNotice] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const [editing, setEditing] = useState(null)
  const [busyId, setBusyId] = useState('')
  const [health, setHealth] = useState(null)
  const [checking, setChecking] = useState(false)

  const checkConnections = async () => {
    try {
      setChecking(true)
      const res = await api.get('/admin/services/health')
      setHealth(res.data?.data || null)
    } catch (err) {
      setHealth({ error: errorMessage(err, 'The health check could not run.') })
    } finally {
      setChecking(false)
    }
  }

  const load = async () => {
    try {
      setLoadError('')
      setLoading(true)
      const res = await api.get('/admin/services/catalog')
      setServices(res.data?.data?.services || [])
    } catch (err) {
      setLoadError(errorMessage(err, 'The service catalog could not be loaded.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const service = services.find((item) => item.key === active)
  const isBill = service?.kind === 'bill'

  const providers = useMemo(() => {
    const rows = service?.providers || []
    const term = search.trim().toLowerCase()
    if (!term) return rows
    return rows.filter(
      (row) =>
        row.name.toLowerCase().includes(term) ||
        String(row.code).toLowerCase().includes(term) ||
        String(row.state || '').toLowerCase().includes(term)
    )
  }, [service, search])

  const sync = async () => {
    try {
      setSyncing(true)
      setNotice(null)
      const res = await api.post('/admin/services/sync')
      const summary = res.data?.data || {}
      setNotice({
        tone: 'success',
        text: res.data?.message || 'Sync complete',
        added: summary.added || [],
        detail: `${summary.received || 0} operators received · ${summary.refreshed || 0} already listed · ${summary.skipped || 0} not part of these services`,
      })
      await load()
    } catch (err) {
      setNotice({ tone: 'danger', text: errorMessage(err, 'Sync failed. Check the ClubAPI token and IP whitelist.') })
    } finally {
      setSyncing(false)
    }
  }

  const toggleEnabled = async (provider) => {
    try {
      setBusyId(provider.id)
      await api.put(`/admin/services/providers/${provider.id}`, { enabled: !provider.enabled })
      await load()
    } catch (err) {
      setNotice({ tone: 'danger', text: errorMessage(err, 'Could not update the provider.') })
    } finally {
      setBusyId('')
    }
  }

  const remove = async (provider) => {
    if (!window.confirm(`Remove ${provider.name}? Customers will no longer see it.`)) return
    try {
      setBusyId(provider.id)
      await api.delete(`/admin/services/providers/${provider.id}`)
      setNotice({ tone: 'success', text: `${provider.name} removed.` })
      await load()
    } catch (err) {
      setNotice({ tone: 'danger', text: errorMessage(err, 'Could not remove the provider.') })
    } finally {
      setBusyId('')
    }
  }

  const chips = services.map((item) => ({
    value: item.key,
    label: item.title,
    count: (item.providers || []).filter((p) => p.enabled).length,
  }))

  return (
    <div>
      <PageHeader
        icon={Layers}
        title="Recharge & Bill Services"
        subtitle="Operators and billers customers can pay for: Mobile, DTH, Credit Card, Electricity and FASTag."
        actions={
          <>
            <Button variant="outline-primary" size="sm" onClick={checkConnections} disabled={checking}>
              <Activity size={14} className="me-1" />
              {checking ? 'Checking...' : 'Check connections'}
            </Button>
            <Button variant="outline-primary" size="sm" onClick={sync} disabled={syncing || loading}>
              <RefreshCcw size={14} className={syncing ? 'spin me-1' : 'me-1'} />
              {syncing ? 'Syncing...' : 'Sync from ClubAPI'}
            </Button>
            <Button
              size="sm"
              disabled={!service}
              onClick={() =>
                setEditing({
                  isNew: true,
                  service: active,
                  name: '',
                  code: '',
                  state: '',
                  enabled: true,
                  sortOrder: 100,
                  supportsFetch: true,
                  customFields: false,
                  fields: [],
                })
              }
            >
              <Plus size={14} className="me-1" /> Add {isBill ? 'biller' : 'operator'}
            </Button>
          </>
        }
      />

      {health && <HealthPanel health={health} onClose={() => setHealth(null)} />}

      {notice && (
        <AlertStrip tone={notice.tone}>
          <strong>{notice.text}</strong>
          {notice.detail && <div className="small mt-1">{notice.detail}</div>}
          {notice.added?.length > 0 && (
            <ul className="small mb-0 mt-1 ps-3">
              {notice.added.slice(0, 12).map((row) => (
                <li key={`${row.service}-${row.code}`}>
                  {row.name} <span className="text-muted">({row.service} · {row.code})</span>
                </li>
              ))}
            </ul>
          )}
        </AlertStrip>
      )}

      {isBill && (
        <AlertStrip tone="info">
          ClubAPI does not return BBPS biller IDs through its API. Add each {service?.title?.toLowerCase()} biller
          with the <strong>bbpsId</strong> shown in your ClubAPI panel&apos;s BBPS biller list, and set the fields
          exactly as that biller requires (the first one is always sent as <code>mobile</code>).
        </AlertStrip>
      )}

      <Toolbar>
        <FilterChips options={chips} value={active} onChange={setActive} />
        <div className="kp-spacer" />
        <SearchInput value={search} onChange={setSearch} placeholder="Search name, ID or state" />
      </Toolbar>

      {loading && !services.length ? (
        <div className="kp-card">
          <LoadingState message="Loading catalog..." />
        </div>
      ) : loadError ? (
        <div className="kp-card">
          <ErrorState message={loadError} onRetry={load} />
        </div>
      ) : !providers.length ? (
        <div className="kp-card">
          <EmptyState
            icon={SERVICE_ICONS[active] || Layers}
            title={search ? 'No match' : `No ${isBill ? 'billers' : 'operators'} yet`}
            message={
              search
                ? 'Try a different search.'
                : isBill
                  ? 'Add billers using their bbpsId from the ClubAPI panel. Customers see this service as "coming soon" until then.'
                  : 'Run "Sync from ClubAPI" to import operators, or add one manually.'
            }
          />
        </div>
      ) : (
        <DataTable columns={['Provider', isBill ? 'BBPS ID' : 'Operator ID', 'Customer fields', isBill ? 'Bill fetch' : 'Source', 'Status', '']}>
          {providers.map((provider) => (
            <tr key={provider.id}>
              <td style={{ minWidth: 220 }}>
                <div className="kp-cell-primary">{provider.name}</div>
                <div className="kp-cell-sub">
                  {[provider.state, provider.clubapiName && provider.clubapiName !== provider.name ? `ClubAPI: ${provider.clubapiName}` : '']
                    .filter(Boolean)
                    .join(' · ') || '—'}
                </div>
              </td>
              <td className="kp-cell-mono">{provider.code}</td>
              <td style={{ minWidth: 220 }}>
                {(provider.effectiveFields || []).map((field) => (
                  <div key={field.key} className="kp-cell-sub">
                    <strong>{field.label}</strong> <span className="text-muted">({field.key})</span>
                  </div>
                ))}
                {provider.usesDefaultFields && <div className="kp-cell-sub text-muted">Service default</div>}
              </td>
              <td className="kp-cell-sub">
                {isBill ? (provider.supportsFetch ? 'Fetch required' : 'Amount only') : prettySource(provider.source)}
              </td>
              <td>
                <Form.Check
                  type="switch"
                  id={`enabled-${provider.id}`}
                  checked={Boolean(provider.enabled)}
                  disabled={busyId === provider.id}
                  onChange={() => toggleEnabled(provider)}
                  label={<StatusPill status={provider.enabled ? 'ACTIVE' : 'CLOSED'} label={provider.enabled ? 'Live' : 'Hidden'} />}
                />
              </td>
              <td className="text-nowrap">
                <Button
                  size="sm"
                  variant="outline-primary"
                  className="me-1"
                  onClick={() =>
                    setEditing({
                      ...provider,
                      isNew: false,
                      customFields: !provider.usesDefaultFields,
                      fields: provider.usesDefaultFields ? [] : provider.fields,
                    })
                  }
                >
                  <Pencil size={14} />
                </Button>
                <Button size="sm" variant="outline-danger" disabled={busyId === provider.id} onClick={() => remove(provider)}>
                  <Trash2 size={14} />
                </Button>
              </td>
            </tr>
          ))}
        </DataTable>
      )}

      {editing && (
        <ProviderModal
          draft={editing}
          service={services.find((item) => item.key === editing.service)}
          onClose={() => setEditing(null)}
          onSaved={async (message) => {
            setEditing(null)
            setNotice({ tone: 'success', text: message })
            await load()
          }}
        />
      )}
    </div>
  )
}

/**
 * Result of GET /admin/services/health - run on the server, so it shows the
 * server's real Razorpay keys and ClubAPI access, not this browser's.
 */
function HealthPanel({ health, onClose }) {
  if (health.error) {
    return (
      <AlertStrip tone="danger">
        {health.error}{' '}
        <button type="button" className="btn btn-link btn-sm p-0" onClick={onClose}>Close</button>
      </AlertStrip>
    )
  }

  const Row2 = ({ ok, title, children }) => (
    <div className="d-flex gap-2 align-items-start py-2" style={{ borderTop: '1px solid var(--kp-line)' }}>
      <StatusPill status={ok ? 'ACTIVE' : 'FAILED'} label={ok ? 'OK' : 'Problem'} />
      <div style={{ minWidth: 0 }}>
        <div className="kp-cell-primary">{title}</div>
        <div className="kp-cell-sub">{children}</div>
      </div>
    </div>
  )

  const { razorpay = {}, clubapi = {}, catalog = {}, problems = [] } = health
  return (
    <div className="kp-card p-3 mb-3">
      <div className="d-flex align-items-center justify-content-between mb-2">
        <div>
          <div className="kp-section-title">Connection check (from the server)</div>
          <div className="kp-cell-sub">
            {health.ready ? 'Payments and ClubAPI are reachable.' : 'Recharges and bill payments will fail until the problems below are fixed.'}
          </div>
        </div>
        <Button size="sm" variant="light" onClick={onClose}><X size={14} /></Button>
      </div>

      <Row2 ok={razorpay.ok} title={`Razorpay - ${razorpay.keyMode || '-'} key ${razorpay.keyId || ''}`}>
        {razorpay.message}
        {!razorpay.webhookSecretConfigured && ' Webhook secret is not set.'}
      </Row2>
      <Row2 ok={clubapi.ok} title={`ClubAPI - ${clubapi.baseHost || '-'}${clubapi.sandbox ? ' (SANDBOX)' : ''}`}>
        {clubapi.message}
        {clubapi.balance && ` Balance: ₹${Number(clubapi.balance.total || 0).toLocaleString('en-IN')}.`}
        {!clubapi.callbackIdConfigured && ' Callback ID is not set.'}
      </Row2>
      <Row2
        ok={Object.values(catalog).every((c) => c.enabled > 0)}
        title="Operators & billers"
      >
        {Object.entries(catalog).map(([key, c]) => `${key.replace('_', ' ')}: ${c.enabled}`).join(' · ')}
      </Row2>

      {problems.length > 0 && (
        <ul className="small mb-0 mt-2 ps-3" style={{ color: 'var(--kp-danger)' }}>
          {problems.map((p) => <li key={p}>{p}</li>)}
        </ul>
      )}
    </div>
  )
}

const prettySource = (source) =>
  ({ seed: 'ClubAPI docs', clubapi_sync: 'ClubAPI sync', admin: 'Added by admin' })[source] || source || '—'

function ProviderModal({ draft, service, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({
    ...draft,
    fields: draft.fields?.length ? draft.fields.map((field) => ({ ...emptyField(), ...field })) : [],
  }))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const isBill = service?.kind === 'bill'

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const setField = (index, key, value) =>
    setForm((prev) => ({
      ...prev,
      fields: prev.fields.map((field, i) => (i === index ? { ...field, [key]: value } : field)),
    }))

  const usedKeys = form.fields.map((field) => field.key)
  const nextKey = ['mobile', 'opvalue1', 'opvalue2', 'opvalue3', 'opvalue4', 'opvalue5'].find((key) => !usedKeys.includes(key))

  const enableCustomFields = (on) => {
    setForm((prev) => ({
      ...prev,
      customFields: on,
      fields: on
        ? prev.fields.length
          ? prev.fields
          : (service?.defaultFields || [emptyField()]).map((field) => ({ ...emptyField(), ...field }))
        : [],
    }))
  }

  const save = async (event) => {
    event.preventDefault()
    setError('')

    if (!form.name.trim() || !String(form.code).trim()) {
      setError(`Name and ${isBill ? 'BBPS ID' : 'operator ID'} are required.`)
      return
    }
    if (form.customFields) {
      if (!form.fields.some((field) => field.key === 'mobile')) {
        setError('Add a field for "mobile" - it is the primary value ClubAPI requires.')
        return
      }
      const unlabeled = form.fields.find((field) => !field.label.trim())
      if (unlabeled) {
        setError(`Give the "${unlabeled.key}" field a label customers will understand.`)
        return
      }
      for (const field of form.fields) {
        if (!field.pattern) continue
        try {
          new RegExp(field.pattern)
        } catch {
          setError(`The pattern for "${field.label}" is not a valid regular expression.`)
          return
        }
      }
    }

    const payload = {
      service: form.service,
      name: form.name.trim(),
      code: String(form.code).trim(),
      state: (form.state || '').trim(),
      enabled: Boolean(form.enabled),
      sortOrder: Number(form.sortOrder) || 100,
      supportsFetch: isBill ? Boolean(form.supportsFetch) : true,
      fields: form.customFields
        ? form.fields.map((field) => ({
            ...field,
            minLength: Number(field.minLength) || 0,
            maxLength: Number(field.maxLength) || 64,
          }))
        : [],
    }

    try {
      setSaving(true)
      if (form.isNew) {
        await api.post('/admin/services/providers', payload)
        onSaved(`${payload.name} added.`)
      } else {
        await api.put(`/admin/services/providers/${form.id}`, payload)
        onSaved(`${payload.name} updated.`)
      }
    } catch (err) {
      setError(errorMessage(err, 'Could not save the provider.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal show onHide={onClose} size="lg" centered scrollable>
      <Form onSubmit={save}>
        <Modal.Header closeButton>
          <Modal.Title style={{ fontSize: '1.05rem', fontWeight: 800 }}>
            {form.isNew ? 'Add' : 'Edit'} {isBill ? 'biller' : 'operator'} · {service?.title}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && <AlertStrip tone="danger">{error}</AlertStrip>}

          <Row className="g-3">
            <Col md={7}>
              <Form.Label>{isBill ? 'Biller name' : 'Operator name'}</Form.Label>
              <Form.Control value={form.name} onChange={(e) => set('name', e.target.value)} placeholder={isBill ? 'e.g. HDFC Bank Credit Card' : 'e.g. Airtel'} />
            </Col>
            <Col md={5}>
              <Form.Label>{isBill ? 'BBPS ID (bbpsId)' : 'ClubAPI operator ID'}</Form.Label>
              <Form.Control
                value={form.code}
                onChange={(e) => set('code', e.target.value)}
                placeholder={isBill ? 'e.g. UPPCL0000UTP02' : 'e.g. 1'}
                style={{ fontFamily: 'monospace' }}
              />
            </Col>
            {isBill && (
              <Col md={7}>
                <Form.Label>State / region (optional)</Form.Label>
                <Form.Control value={form.state || ''} onChange={(e) => set('state', e.target.value)} placeholder="e.g. Uttar Pradesh" />
              </Col>
            )}
            <Col md={isBill ? 5 : 4}>
              <Form.Label>Sort order</Form.Label>
              <Form.Control type="number" min="0" value={form.sortOrder} onChange={(e) => set('sortOrder', e.target.value)} />
            </Col>
            <Col md={12} className="d-flex flex-wrap gap-4">
              <Form.Check type="switch" id="provider-enabled" label="Visible to customers" checked={Boolean(form.enabled)} onChange={(e) => set('enabled', e.target.checked)} />
              {isBill && (
                <Form.Check
                  type="switch"
                  id="provider-fetch"
                  label="Bill fetch supported (recommended)"
                  checked={Boolean(form.supportsFetch)}
                  onChange={(e) => set('supportsFetch', e.target.checked)}
                />
              )}
            </Col>
          </Row>

          <hr />

          <div className="d-flex align-items-center justify-content-between mb-2">
            <div>
              <div className="kp-section-title">Customer input fields</div>
              <div className="kp-cell-sub">
                What the app asks the customer, and which ClubAPI parameter each value is sent as.
              </div>
            </div>
            <Form.Check
              type="switch"
              id="custom-fields"
              label="Custom fields"
              checked={Boolean(form.customFields)}
              onChange={(e) => enableCustomFields(e.target.checked)}
            />
          </div>

          {!form.customFields ? (
            <div className="kp-cell-sub">
              Using the {service?.title} defaults:{' '}
              {(service?.defaultFields || []).map((field) => `${field.label} (${field.key})`).join(', ')}
            </div>
          ) : (
            <>
              {form.fields.map((field, index) => (
                <div key={index} className="p-2 mb-2 rounded" style={{ border: '1px solid var(--kp-line)', background: 'var(--kp-surface-alt)' }}>
                  <Row className="g-2 align-items-end">
                    <Col md={3}>
                      <Form.Label className="small">Sent as</Form.Label>
                      <Form.Select size="sm" value={field.key} onChange={(e) => setField(index, 'key', e.target.value)}>
                        {Object.keys(FIELD_KEY_HELP).map((key) => (
                          <option key={key} value={key} disabled={key !== field.key && usedKeys.includes(key)}>
                            {key}
                          </option>
                        ))}
                      </Form.Select>
                    </Col>
                    <Col md={5}>
                      <Form.Label className="small">Label shown to customer</Form.Label>
                      <Form.Control size="sm" value={field.label} onChange={(e) => setField(index, 'label', e.target.value)} placeholder="e.g. Consumer number" />
                    </Col>
                    <Col md={3}>
                      <Form.Label className="small">Input type</Form.Label>
                      <Form.Select size="sm" value={field.inputType} onChange={(e) => setField(index, 'inputType', e.target.value)}>
                        <option value="text">Text</option>
                        <option value="number">Digits</option>
                        <option value="mobile">Mobile number</option>
                      </Form.Select>
                    </Col>
                    <Col md={1} className="text-end">
                      <Button
                        size="sm"
                        variant="outline-danger"
                        title="Remove field"
                        onClick={() => setForm((prev) => ({ ...prev, fields: prev.fields.filter((_, i) => i !== index) }))}
                      >
                        <X size={14} />
                      </Button>
                    </Col>
                    <Col md={4}>
                      <Form.Label className="small">Placeholder</Form.Label>
                      <Form.Control size="sm" value={field.placeholder} onChange={(e) => setField(index, 'placeholder', e.target.value)} />
                    </Col>
                    <Col md={4}>
                      <Form.Label className="small">Help text</Form.Label>
                      <Form.Control size="sm" value={field.hint} onChange={(e) => setField(index, 'hint', e.target.value)} />
                    </Col>
                    <Col md={2}>
                      <Form.Label className="small">Min length</Form.Label>
                      <Form.Control size="sm" type="number" min="0" max="64" value={field.minLength} onChange={(e) => setField(index, 'minLength', e.target.value)} />
                    </Col>
                    <Col md={2}>
                      <Form.Label className="small">Max length</Form.Label>
                      <Form.Control size="sm" type="number" min="1" max="64" value={field.maxLength} onChange={(e) => setField(index, 'maxLength', e.target.value)} />
                    </Col>
                    <Col md={8}>
                      <Form.Label className="small">Validation pattern (regex, optional)</Form.Label>
                      <Form.Control size="sm" value={field.pattern} onChange={(e) => setField(index, 'pattern', e.target.value)} placeholder="e.g. ^[0-9]{10,12}$" style={{ fontFamily: 'monospace' }} />
                    </Col>
                    <Col md={4}>
                      <Form.Check
                        type="checkbox"
                        id={`upper-${index}`}
                        label="Convert to UPPERCASE"
                        checked={Boolean(field.uppercase)}
                        onChange={(e) => setField(index, 'uppercase', e.target.checked)}
                      />
                    </Col>
                  </Row>
                </div>
              ))}
              {nextKey && (
                <Button size="sm" variant="outline-primary" onClick={() => setForm((prev) => ({ ...prev, fields: [...prev.fields, emptyField(nextKey)] }))}>
                  <Plus size={14} className="me-1" /> Add field ({nextKey})
                </Button>
              )}
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving...' : form.isNew ? 'Add provider' : 'Save changes'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  )
}
