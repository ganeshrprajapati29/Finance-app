import React, { useEffect, useMemo, useState } from 'react'
import { Button, Col, Form, Modal, Row } from 'react-bootstrap'
import {
  CheckCircle2,
  Eye,
  FileText,
  RefreshCcw,
  ShieldCheck,
  XCircle,
} from 'lucide-react'
import api from '../api/axios'
import {
  AlertStrip,
  DataTable,
  EmptyState,
  FilterChips,
  IdentityCell,
  LoadingState,
  MetricTile,
  PageHeader,
  SearchInput,
  StatusPill,
  Toolbar,
  formatDateTime,
} from '../components/AdminUI.jsx'

/**
 * Masks an identity number for display. Reviewers need enough to confirm the
 * right document without the full number sitting on a shared screen.
 */
const mask = (value, keep = 4) => {
  const raw = String(value || '').replace(/\s+/g, '')
  if (!raw) return '--'
  if (raw.length <= keep) return raw
  return `${'•'.repeat(Math.min(raw.length - keep, 8))}${raw.slice(-keep)}`
}

const addressText = (data = {}) =>
  data.completeAddress ||
  data.address ||
  [
    data.careOf,
    data.house,
    data.street,
    data.locality,
    data.postOffice,
    data.district,
    data.state,
    data.pincode,
  ]
    .filter(Boolean)
    .join(', ')

const KycReview = () => {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [status, setStatus] = useState('ALL')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [notes, setNotes] = useState('')

  const fetchKyc = async () => {
    try {
      setError('')
      setLoading(true)
      const res = await api.get('/admin/kyc', { params: { status, search, limit: 100 } })
      setItems(res.data?.data?.items || [])
    } catch (err) {
      setError(
        err.response?.data?.message || 'KYC records could not be loaded. Please try again.'
      )
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchKyc()
    // `search` is applied on submit, not on every keystroke, so it is
    // deliberately not a dependency here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  const stats = useMemo(
    () => ({
      total: items.length,
      submitted: items.filter((i) => i.kycSummary?.status === 'SUBMITTED').length,
      approved: items.filter((i) => i.kycSummary?.status === 'APPROVED').length,
      rejected: items.filter((i) => i.kycSummary?.status === 'REJECTED').length,
    }),
    [items]
  )

  const submitReview = async (reviewStatus) => {
    if (!selected?._id) return
    try {
      setSaving(true)
      setError('')
      await api.put(`/admin/kyc/${selected._id}/review`, { status: reviewStatus, notes })
      setNotice(
        `KYC ${reviewStatus === 'APPROVED' ? 'approved' : 'rejected'} for ${
          selected.name || 'this customer'
        }.`
      )
      setSelected(null)
      setNotes('')
      await fetchKyc()
    } catch (err) {
      setError(
        err.response?.data?.message || 'The review could not be saved. Please try again.'
      )
    } finally {
      setSaving(false)
    }
  }

  const openDetail = async (row) => {
    try {
      const res = await api.get(`/admin/kyc/${row._id}`)
      const data = res.data?.data || {}
      setSelected({
        ...row,
        ...data.user,
        kycSummary: data.kycSummary,
        loans: data.loans || [],
        creditReports: data.creditReports || [],
      })
      setNotes('')
    } catch {
      // Fall back to the list row so the reviewer still sees something.
      setSelected(row)
      setNotes('')
    }
  }

  const statusOptions = [
    { value: 'ALL', label: 'All', count: stats.total },
    { value: 'SUBMITTED', label: 'Under review', count: stats.submitted },
    { value: 'APPROVED', label: 'Approved', count: stats.approved },
    { value: 'REJECTED', label: 'Rejected', count: stats.rejected },
    { value: 'PENDING', label: 'Not started' },
  ]

  return (
    <div>
      <PageHeader
        icon={ShieldCheck}
        title="KYC Review"
        subtitle="Verify Aadhaar eKYC, PAN, documents and credit readiness before a loan is approved."
        actions={
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={fetchKyc}
            disabled={loading}
          >
            <RefreshCcw size={14} className="me-1" /> Refresh
          </button>
        }
      />

      {error && (
        <AlertStrip tone="danger" onRetry={fetchKyc}>
          {error}
        </AlertStrip>
      )}
      {notice && <AlertStrip tone="success">{notice}</AlertStrip>}

      <Row className="g-2 mb-3">
        <Col xl={3} md={6}>
          <MetricTile
            label="Total records"
            value={stats.total.toLocaleString('en-IN')}
            icon={ShieldCheck}
            tone="teal"
          />
        </Col>
        <Col xl={3} md={6}>
          <MetricTile
            label="Awaiting review"
            value={stats.submitted.toLocaleString('en-IN')}
            icon={FileText}
            tone="saffron"
            footnote="Action needed"
          />
        </Col>
        <Col xl={3} md={6}>
          <MetricTile
            label="Approved"
            value={stats.approved.toLocaleString('en-IN')}
            icon={CheckCircle2}
            tone="green"
          />
        </Col>
        <Col xl={3} md={6}>
          <MetricTile
            label="Rejected"
            value={stats.rejected.toLocaleString('en-IN')}
            icon={XCircle}
            tone="red"
          />
        </Col>
      </Row>

      <Toolbar>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search name, mobile, PAN or Aadhaar"
        />
        <button type="button" className="btn btn-primary btn-sm" onClick={fetchKyc}>
          Search
        </button>
        <div className="kp-spacer" />
        <FilterChips options={statusOptions} value={status} onChange={setStatus} />
      </Toolbar>

      {loading ? (
        <div className="kp-card">
          <LoadingState message="Loading KYC records..." />
        </div>
      ) : items.length === 0 ? (
        <div className="kp-card">
          <EmptyState
            icon={ShieldCheck}
            title="No KYC records here"
            message="Nothing matches this filter. Try All, or clear the search box."
            action={
              <button
                type="button"
                className="btn btn-outline-primary btn-sm"
                onClick={() => {
                  setSearch('')
                  setStatus('ALL')
                }}
              >
                Clear filters
              </button>
            }
          />
        </div>
      ) : (
        <DataTable
          columns={['Customer', 'Status', 'PAN', 'Aadhaar', 'Loans', 'Credit report', 'Updated', '']}
        >
          {items.map((item) => {
            const summary = item.kycSummary || {}
            return (
              <tr key={item._id}>
                <td style={{ maxWidth: 230 }}>
                  <IdentityCell
                    name={item.name || 'Khatu Pay user'}
                    sub={item.mobile || item.email || 'No contact'}
                  />
                </td>
                <td>
                  <StatusPill status={summary.status || 'PENDING'} />
                </td>
                <td>
                  <div className="kp-cell-primary">{summary.pan?.name || '--'}</div>
                  <div className="kp-cell-sub">
                    {summary.pan?.verified ? 'Verified' : 'Pending'} · {mask(summary.pan?.number)}
                  </div>
                </td>
                <td>
                  <div className="kp-cell-primary">
                    {summary.aadhaar?.verified ? 'Verified' : 'Pending'}
                  </div>
                  <div className="kp-cell-sub">
                    {summary.aadhaar?.maskedNumber || mask(summary.aadhaar?.number)}
                  </div>
                </td>
                <td className="kp-cell-mono">{item.loanSummary?.total || 0}</td>
                <td className="kp-cell-sub">
                  {item.creditReport
                    ? `${item.creditReport.bureau || 'Report'} ${item.creditReport.score || ''}`.trim()
                    : 'Not fetched'}
                </td>
                <td className="kp-cell-sub">
                  {formatDateTime(summary.submittedAt || item.updatedAt)}
                </td>
                <td>
                  <button
                    type="button"
                    className="btn btn-outline-primary btn-sm"
                    onClick={() => openDetail(item)}
                  >
                    <Eye size={14} className="me-1" /> Review
                  </button>
                </td>
              </tr>
            )
          })}
        </DataTable>
      )}

      <KycDetailModal
        user={selected}
        notes={notes}
        setNotes={setNotes}
        saving={saving}
        onHide={() => setSelected(null)}
        onApprove={() => submitReview('APPROVED')}
        onReject={() => submitReview('REJECTED')}
      />
    </div>
  )
}

const Info = ({ label, value }) => (
  <div
    className="p-2 rounded h-100"
    style={{ background: 'var(--kp-surface-alt)', border: '1px solid var(--kp-line)' }}
  >
    <div className="kp-metric-label mb-1">{label}</div>
    <div className="kp-cell-primary" style={{ wordBreak: 'break-word' }}>
      {value || '--'}
    </div>
  </div>
)

const SectionTitle = ({ children }) => (
  <div className="kp-section-title mt-3 mb-2">{children}</div>
)

const KycDetailModal = ({ user, notes, setNotes, saving, onHide, onApprove, onReject }) => {
  if (!user) return null

  const summary = user.kycSummary || {}
  const aadhaar = summary.aadhaar || {}
  const pan = summary.pan || {}
  const aadhaarData = aadhaar.data || {}
  const reports = user.creditReports || (user.creditReport ? [user.creditReport] : [])
  const docs = summary.docs || []

  // A reviewer should not be able to approve before the two hard gates the
  // loan route also enforces server-side.
  const canApprove = Boolean(aadhaar.verified && pan.verified)

  return (
    <Modal show={Boolean(user)} onHide={onHide} size="xl" centered scrollable>
      <Modal.Header closeButton>
        <Modal.Title style={{ fontSize: '1.05rem', fontWeight: 800 }}>
          KYC review — {user.name || 'Khatu Pay user'}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Row className="g-2">
          <Col md={4}>
            <Info label="Customer" value={user.name || 'Khatu Pay user'} />
          </Col>
          <Col md={4}>
            <Info label="Mobile" value={user.mobile} />
          </Col>
          <Col md={4}>
            <Info
              label="Current status"
              value={<StatusPill status={summary.status || 'PENDING'} />}
            />
          </Col>
        </Row>

        {!canApprove && (
          <div className="mt-3">
            <AlertStrip tone="warning">
              Aadhaar eKYC and PAN must both be verified before this KYC can be approved.
            </AlertStrip>
          </div>
        )}

        <SectionTitle>Aadhaar verification</SectionTitle>
        <Row className="g-2">
          <Col md={4}><Info label="Aadhaar number" value={aadhaar.maskedNumber || mask(aadhaar.number)} /></Col>
          <Col md={4}><Info label="Verified" value={aadhaar.verified ? 'Verified' : 'Not verified'} /></Col>
          <Col md={4}><Info label="Name on Aadhaar" value={aadhaarData.fullName} /></Col>
          <Col md={4}><Info label="Date of birth" value={aadhaarData.dob} /></Col>
          <Col md={4}><Info label="Gender" value={aadhaarData.gender} /></Col>
          <Col md={4}>
            <Info
              label="Mobile matched"
              value={
                aadhaarData.mobileMatched === undefined
                  ? '--'
                  : aadhaarData.mobileMatched
                    ? 'Yes'
                    : 'No'
              }
            />
          </Col>
          <Col md={8}><Info label="Address" value={addressText(aadhaarData)} /></Col>
          <Col md={4}>
            <Info
              label="State / PIN"
              value={[aadhaarData.state, aadhaarData.pincode].filter(Boolean).join(' - ')}
            />
          </Col>
        </Row>

        <SectionTitle>PAN verification</SectionTitle>
        <Row className="g-2">
          <Col md={4}><Info label="PAN number" value={pan.number} /></Col>
          <Col md={4}><Info label="Name on PAN" value={pan.name || pan.data?.name} /></Col>
          <Col md={4}><Info label="Verified" value={pan.verified ? 'Verified' : 'Not verified'} /></Col>
          <Col md={4}><Info label="Aadhaar seeding" value={pan.data?.aadhaarSeedingStatus} /></Col>
          <Col md={4}><Info label="Order ID" value={pan.orderId} /></Col>
          <Col md={4}><Info label="Verified at" value={formatDateTime(pan.verifiedAt)} /></Col>
        </Row>

        <SectionTitle>Credit report</SectionTitle>
        <Row className="g-2">
          <Col md={4}><Info label="Provider" value={reports[0]?.provider || 'Not fetched'} /></Col>
          <Col md={4}><Info label="Bureau" value={reports[0]?.bureau} /></Col>
          <Col md={4}><Info label="Score" value={reports[0]?.score} /></Col>
          <Col md={4}><Info label="Status" value={reports[0]?.status} /></Col>
          <Col md={4}><Info label="Reference" value={reports[0]?.referenceId} /></Col>
          <Col md={4}><Info label="Fetched at" value={formatDateTime(reports[0]?.createdAt)} /></Col>
        </Row>

        <SectionTitle>Uploaded documents</SectionTitle>
        <Row className="g-2">
          {docs.length ? (
            docs.map((doc, index) => (
              <Col md={4} key={doc.url || index}>
                <Info
                  label={doc.type || `Document ${index + 1}`}
                  value={
                    doc.url ? (
                      <a href={doc.url} target="_blank" rel="noreferrer">
                        Open document
                      </a>
                    ) : (
                      doc.status || 'Uploaded'
                    )
                  }
                />
              </Col>
            ))
          ) : (
            <Col md={12}>
              <Info label="Documents" value="No uploaded document found" />
            </Col>
          )}
        </Row>

        <Form.Group className="mt-3">
          <Form.Label>Review notes</Form.Label>
          <Form.Control
            as="textarea"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Shown to the customer on rejection, and kept in the audit trail."
          />
        </Form.Group>

        {reports[0]?.response && (
          <details className="mt-3">
            <summary className="kp-cell-sub" style={{ cursor: 'pointer' }}>
              View raw credit report response
            </summary>
            <pre
              className="mt-2 p-2 rounded kp-scroll"
              style={{
                background: 'var(--kp-ink)',
                color: '#e2e8f0',
                maxHeight: 260,
                overflow: 'auto',
                fontSize: '0.72rem',
              }}
            >
              {JSON.stringify(reports[0].response, null, 2)}
            </pre>
          </details>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="light" onClick={onHide} disabled={saving}>
          Close
        </Button>
        <Button variant="outline-danger" disabled={saving} onClick={onReject}>
          <XCircle size={15} className="me-1" /> Reject
        </Button>
        <Button
          variant="success"
          disabled={saving || !canApprove}
          onClick={onApprove}
          title={canApprove ? undefined : 'Aadhaar and PAN must be verified first'}
        >
          <CheckCircle2 size={15} className="me-1" />
          {saving ? 'Saving...' : 'Approve'}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}

export default KycReview
