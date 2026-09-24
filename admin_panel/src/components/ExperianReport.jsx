import React, { useMemo, useState } from 'react'
import { Badge, Button, Table } from 'react-bootstrap'
import { AlertTriangle, ChevronDown, ChevronRight, FileJson, FileSpreadsheet, Info, Printer } from 'lucide-react'
import api from '../api/axios'
import { buildExperianView, formatBureauDate, money } from '../utils/experianReport.js'

const STATUS_TONE = { VERIFIED: 'success', REVIEW: 'warning', FAILED: 'danger', PENDING: 'info' }

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
))

const formatStamp = (date) => (date ? new Date(date).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—')

const monthsLabel = (months) => {
  if (months === null || months === undefined) return '—'
  const years = Math.floor(months / 12)
  const rest = months % 12
  return [years ? `${years} yr` : '', rest || !years ? `${rest} mo` : ''].filter(Boolean).join(' ')
}

const saveBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

// A failed blob download hides the JSON error body inside the Blob.
const downloadErrorMessage = async (error) => {
  const body = error?.response?.data
  if (body instanceof Blob) {
    try { return JSON.parse(await body.text())?.message || '' } catch { return '' }
  }
  return body?.message || ''
}

const Stat = ({ label, value, tone, hint }) => (
  <div className={`xr-stat ${tone ? `xr-${tone}` : ''}`} title={hint || undefined}>
    <span>{label}</span>
    <strong>{value}</strong>
  </div>
)

const HistoryStrip = ({ cells }) => (
  <div className="xr-history" aria-label="Payment history, newest first">
    {cells.map((cell) => (
      <i
        key={cell.key}
        className={`xr-dpd xr-dpd-${cell.dpd === null ? 'none' : cell.dpd <= 0 ? 'ok' : cell.dpd < 30 ? 'late' : 'bad'}`}
        title={`${cell.label}: ${cell.dpd === null ? 'not reported' : cell.dpd <= 0 ? 'paid on time' : `${cell.dpd} days past due`}${cell.asset ? ` (${cell.asset})` : ''}`}
      />
    ))}
  </div>
)

function buildPrintHtml(view, meta) {
  const accountRows = view.accounts.map((a) => `
    <tr>
      <td>${escapeHtml(a.lender)}</td><td>${escapeHtml(a.type)}</td><td>${escapeHtml(a.status)}</td>
      <td>${escapeHtml(formatBureauDate(a.opened))}</td><td>${escapeHtml(a.limit ? money(a.limit) : '—')}</td>
      <td>${escapeHtml(money(a.balance))}</td><td>${escapeHtml(money(a.pastDue))}</td>
    </tr>`).join('')
  const enquiryRows = view.enquiryRows.map((row) => `
    <tr><td>${escapeHtml(formatBureauDate(row.date))}</td><td>${escapeHtml(row.lender)}</td>
    <td>${escapeHtml(row.reason)}</td><td>${escapeHtml(row.amount ? money(row.amount) : '—')}</td></tr>`).join('')
  const stat = (label, value) => `<div class="s"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`
  const t = view.totals
  return `<!doctype html><html><head><meta charset="utf-8"><title>Experian credit report ${escapeHtml(view.reportNumber)}</title>
  <style>
    body{font-family:Arial,Helvetica,sans-serif;color:#0f172a;margin:28px;font-size:12px}
    h1{font-size:20px;margin:0 0 2px}h2{font-size:14px;margin:22px 0 8px;border-bottom:1px solid #cbd5e1;padding-bottom:4px}
    .muted{color:#64748b}.score{display:flex;align-items:baseline;gap:12px;margin:14px 0}
    .score b{font-size:44px}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
    .s{border:1px solid #e2e8f0;border-radius:6px;padding:8px}.s span{display:block;color:#64748b;font-size:10px;text-transform:uppercase}
    table{width:100%;border-collapse:collapse}th,td{border-bottom:1px solid #e2e8f0;padding:6px 4px;text-align:left}th{font-size:10px;text-transform:uppercase;color:#64748b}
    .foot{margin-top:24px;color:#64748b;font-size:10px}
  </style></head><body>
  <h1>Experian Credit Report</h1>
  <div class="muted">${escapeHtml(meta.customer || 'Customer')} ${meta.pan ? `· PAN ${escapeHtml(meta.pan)}` : ''} · Report ${escapeHtml(view.reportNumber || '—')} · ${escapeHtml(formatBureauDate(view.reportDate))}</div>
  <div class="score"><b>${view.score ?? '—'}</b><span>${escapeHtml(view.band.label)}${view.confidence ? ` · confidence ${escapeHtml(view.confidence)}` : ''} (range 300-900)</span></div>
  <div class="grid">
    ${stat('Accounts', t.total)}${stat('Active', t.active)}${stat('Closed', t.closed)}${stat('Outstanding', money(t.outstanding))}
    ${stat('Past due', money(t.pastDue))}${stat('Written-off / settled', t.writtenOff)}${stat('Worst DPD (12m)', `${t.maxDpd12m} days`)}${stat('Credit age', monthsLabel(t.creditAgeMonths))}
    ${stat('Enquiries 30d', view.enquiries.last30 ?? '—')}${stat('Enquiries 90d', view.enquiries.last90 ?? '—')}${stat('Enquiries 180d', view.enquiries.last180 ?? '—')}${stat('Exact match', view.exactMatch || '—')}
  </div>
  ${view.alerts.length ? `<h2>Alerts</h2><ul>${view.alerts.map((a) => `<li>${escapeHtml(a.text)}</li>`).join('')}</ul>` : ''}
  <h2>Credit accounts</h2>
  <table><thead><tr><th>Lender</th><th>Type</th><th>Status</th><th>Opened</th><th>Limit</th><th>Balance</th><th>Past due</th></tr></thead><tbody>${accountRows || '<tr><td colspan="7">No accounts reported</td></tr>'}</tbody></table>
  <h2>Enquiries</h2>
  <table><thead><tr><th>Date</th><th>Lender</th><th>Purpose</th><th>Amount</th></tr></thead><tbody>${enquiryRows || '<tr><td colspan="4">No enquiries reported</td></tr>'}</tbody></table>
  <div class="foot">Source: Experian via SignCare · fetched ${escapeHtml(meta.fetchedAt)} · Printed ${escapeHtml(new Date().toLocaleString('en-IN'))} · Confidential - for loan assessment only.</div>
  </body></html>`
}

/**
 * Full Experian (Retail, soft-pull) report for one customer.
 *
 * `stage` is the SignCare `credit` stage from the loan verification record;
 * `archive` is the archived CreditReport row (used when the stage is absent).
 * `userId` addresses the workbook download.
 */
const ExperianReport = ({ stage, archive, userId, customerName, panMasked }) => {
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState(null)
  const [rawOpen, setRawOpen] = useState(false)

  const data = stage?.data || {}
  const report = data.jsonExperianReport || data.experianReport ||
    archive?.response?.jsonExperianReport || archive?.response?.experianReport || null
  const view = useMemo(() => buildExperianView(report), [report])

  const status = String(stage?.status || archive?.status || '').toUpperCase()
  const summary = data.summary || archive?.response?.summary || {}
  const hasExcel = summary.hasExcelReport === true || Boolean(data.excelExperianReport)
  const fetchedAt = stage?.verifiedAt || stage?.updatedAt || archive?.createdAt
  const reference = stage?.providerReference || stage?.requestId || archive?.referenceId || ''
  const message = stage?.message || ''
  const filenameKey = view?.reportNumber || reference || 'report'

  const downloadExcel = async () => {
    setBusy('excel')
    setError('')
    try {
      const res = await api.get(`/loan-verification/admin/${userId}/credit-report/excel`, { responseType: 'blob' })
      saveBlob(new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `experian-credit-report-${filenameKey}.xlsx`)
    } catch (err) {
      setError((await downloadErrorMessage(err)) || 'The Excel report could not be downloaded.')
    } finally {
      setBusy('')
    }
  }

  const downloadJson = () => {
    saveBlob(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }), `experian-credit-report-${filenameKey}.json`)
  }

  const printReport = () => {
    const win = window.open('', '_blank', 'width=980,height=800')
    if (!win) {
      setError('Allow pop-ups to print the report.')
      return
    }
    win.document.write(buildPrintHtml(view, { customer: customerName, pan: panMasked, fetchedAt: formatStamp(fetchedAt) }))
    win.document.close()
    win.focus()
    win.print()
  }

  return (
    <div className="detail-section xr">
      <style>{xrStyles}</style>
      <div className="section-heading-row">
        <h4>Experian Credit Report</h4>
        <div className="xr-actions">
          <Badge bg={STATUS_TONE[status] || 'secondary'}>{status || 'Not fetched'}</Badge>
          {view && (
            <>
              {hasExcel && userId && (
                <Button size="sm" variant="outline-success" onClick={downloadExcel} disabled={busy === 'excel'}>
                  <FileSpreadsheet size={14} /> {busy === 'excel' ? 'Preparing…' : 'Excel'}
                </Button>
              )}
              <Button size="sm" variant="outline-secondary" onClick={downloadJson}><FileJson size={14} /> JSON</Button>
              <Button size="sm" variant="outline-primary" onClick={printReport}><Printer size={14} /> Print / PDF</Button>
            </>
          )}
        </div>
      </div>

      {error && <div className="xr-note xr-danger"><AlertTriangle size={15} /> {error}</div>}

      {!view && (
        <div className={`xr-note ${status === 'FAILED' ? 'xr-danger' : status === 'REVIEW' ? 'xr-warning' : ''}`}>
          <Info size={15} />
          <span>
            {status === 'FAILED' && `The credit report could not be fetched. ${message}`}
            {status === 'REVIEW' && 'Experian returned no usable credit history for this customer (new-to-credit or unmatched profile). Review manually.'}
            {status === 'PENDING' && 'The credit report is still being fetched.'}
            {!['FAILED', 'REVIEW', 'PENDING'].includes(status) && 'The credit report has not been fetched yet. It is pulled when the customer submits the loan application.'}
          </span>
        </div>
      )}

      {view && (
        <>
          <div className="xr-hero">
            <div className="xr-score">
              <span className="xr-score-label">Experian score</span>
              <div className="xr-score-row">
                <b>{view.score ?? '—'}</b>
                <Badge bg={view.band.tone === 'muted' ? 'secondary' : view.band.tone}>{view.band.label}</Badge>
              </div>
              <div className="xr-bar" role="img" aria-label={`Score ${view.score ?? 'unavailable'} on a 300 to 900 scale`}>
                {view.score !== null && <i style={{ left: `${view.position}%` }} />}
              </div>
              <div className="xr-scale"><span>300</span><span>600</span><span>900</span></div>
            </div>
            <div className="xr-meta">
              <Stat label="Report no." value={view.reportNumber || '—'} />
              <Stat label="Report date" value={formatBureauDate(view.reportDate)} />
              <Stat label="Exact match" value={view.exactMatch || '—'} />
              <Stat label="Confidence" value={view.confidence || '—'} />
              <Stat label="Fetched" value={formatStamp(fetchedAt)} />
              <Stat label="Reference" value={reference || '—'} />
            </div>
          </div>

          {view.alerts.length > 0 && (
            <div className="xr-alerts">
              {view.alerts.map((alert) => (
                <div key={alert.text} className={`xr-note xr-${alert.tone}`}><AlertTriangle size={15} /> {alert.text}</div>
              ))}
            </div>
          )}

          <div className="xr-stats">
            <Stat label="Accounts" value={view.totals.total} />
            <Stat label="Active" value={view.totals.active} />
            <Stat label="Closed" value={view.totals.closed} />
            <Stat label="Outstanding" value={money(view.totals.outstanding)} hint={`Secured ${money(view.totals.secured)} · Unsecured ${money(view.totals.unsecured)}`} />
            <Stat label="Past due" value={money(view.totals.pastDue)} tone={view.totals.pastDue > 0 ? 'warning' : ''} />
            <Stat label="Delinquent now" value={view.totals.delinquent} tone={view.totals.delinquent > 0 ? 'warning' : ''} />
            <Stat label="Written-off / settled" value={view.totals.writtenOff} tone={view.totals.writtenOff > 0 ? 'danger' : ''} />
            <Stat label="Worst DPD (12m)" value={`${view.totals.maxDpd12m} days`} tone={view.totals.maxDpd12m >= 90 ? 'danger' : view.totals.maxDpd12m >= 30 ? 'warning' : ''} />
            <Stat label="Credit age" value={monthsLabel(view.totals.creditAgeMonths)} />
            <Stat label="Enquiries 30d" value={view.enquiries.last30 ?? '—'} />
            <Stat label="Enquiries 90d" value={view.enquiries.last90 ?? '—'} />
            <Stat label="Enquiries 180d" value={view.enquiries.last180 ?? '—'} />
          </div>

          <h5 className="xr-sub">Credit accounts</h5>
          {view.accounts.length === 0 ? (
            <div className="xr-note"><Info size={15} /> No credit accounts reported by Experian.</div>
          ) : (
            <div className="table-responsive">
              <Table hover size="sm" className="align-middle mb-0 xr-table">
                <thead>
                  <tr><th /><th>Lender</th><th>Type</th><th>Status</th><th>Opened</th><th>Limit</th><th>Balance</th><th>Past due</th><th>Last 12 months</th></tr>
                </thead>
                <tbody>
                  {view.accounts.map((account) => {
                    const open = expanded === account.key
                    return (
                      <React.Fragment key={account.key}>
                        <tr className={`xr-row ${account.severe ? 'xr-severe' : ''}`} onClick={() => setExpanded(open ? null : account.key)}>
                          <td>{open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
                          <td>
                            <strong>{account.lender}</strong>
                            {account.accountNumber && <small className="d-block text-muted">{account.accountNumber}</small>}
                          </td>
                          <td>{account.type}</td>
                          <td><Badge bg={account.severe ? 'danger' : account.closed ? 'secondary' : 'success'}>{account.status}</Badge></td>
                          <td>{formatBureauDate(account.opened)}</td>
                          <td>{account.limit ? money(account.limit) : '—'}</td>
                          <td>{money(account.balance)}</td>
                          <td className={account.pastDue > 0 ? 'xr-text-danger' : ''}>{money(account.pastDue)}</td>
                          <td><HistoryStrip cells={account.history} /></td>
                        </tr>
                        {open && (
                          <tr className="xr-detail-row">
                            <td colSpan={9}>
                              <div className="xr-detail">
                                <Stat label="Portfolio" value={account.portfolio || '—'} />
                                <Stat label="Last reported" value={formatBureauDate(account.reported)} />
                                <Stat label="Instalment" value={account.emi ? money(account.emi) : '—'} />
                                <Stat label="Interest rate" value={account.rate ? `${account.rate}%` : '—'} />
                                <Stat label="Tenure" value={account.tenure ? `${account.tenure} mo` : '—'} />
                                <Stat label="Collateral" value={account.collateral || '—'} />
                                <Stat label="First delinquency" value={formatBureauDate(account.firstDelinquency)} />
                                <Stat label="Written-off amount" value={account.writtenOffTotal ? money(account.writtenOffTotal) : '—'} />
                                {account.wording && <Stat label="Status notes" value={account.wording} tone="danger" />}
                                {account.comment && <Stat label="Comments" value={account.comment} />}
                              </div>
                              <div className="xr-legend">
                                <span><i className="xr-dpd xr-dpd-ok" /> On time</span>
                                <span><i className="xr-dpd xr-dpd-late" /> 1-29 days late</span>
                                <span><i className="xr-dpd xr-dpd-bad" /> 30+ days late</span>
                                <span><i className="xr-dpd xr-dpd-none" /> Not reported</span>
                                <span className="text-muted">Newest month first</span>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </Table>
            </div>
          )}

          <h5 className="xr-sub">Credit enquiries</h5>
          {view.enquiryRows.length === 0 ? (
            <div className="xr-note"><Info size={15} /> No individual enquiries reported.</div>
          ) : (
            <div className="table-responsive">
              <Table hover size="sm" className="align-middle mb-0 xr-table">
                <thead><tr><th>Date</th><th>Lender</th><th>Reason</th><th>Purpose</th><th>Amount</th></tr></thead>
                <tbody>
                  {view.enquiryRows.map((row) => (
                    <tr key={row.key}>
                      <td>{formatBureauDate(row.date)}</td><td>{row.lender}</td><td>{row.reason}</td>
                      <td>{row.purpose || '—'}</td><td>{row.amount ? money(row.amount) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}

          <details className="ekyc-raw">
            <summary>Identity as held by the bureau</summary>
            <div className="xr-detail">
              <Stat label="Names" value={view.identity.names.join(' / ') || '—'} />
              <Stat label="Date of birth" value={view.identity.birthDates.map(formatBureauDate).join(' / ') || '—'} />
              <Stat label="PAN" value={view.identity.pans.join(' / ') || '—'} />
              <Stat label="E-mail" value={view.identity.emails.join(' / ') || '—'} />
              <Stat label="Phones" value={view.identity.phones.join(' / ') || '—'} />
              <Stat label="Addresses" value={view.identity.addresses.join(' | ') || '—'} />
              <Stat label="Submitted name" value={view.applicant.name || '—'} />
              <Stat label="Submitted PAN" value={view.applicant.pan || '—'} />
            </div>
          </details>

          <details className="ekyc-raw" onToggle={(event) => setRawOpen(event.currentTarget.open)}>
            <summary>View full Experian response (JSON)</summary>
            {rawOpen && <pre>{JSON.stringify(report, null, 2)}</pre>}
          </details>
        </>
      )}
    </div>
  )
}

const xrStyles = `
  .xr { display: grid; gap: 12px; }
  .xr h4 { font-size: 16px; font-weight: 900; margin: 0; }
  .xr .section-heading-row { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 12px; }
  .xr .ekyc-raw summary { cursor: pointer; font-weight: 700; color: #0F766E; padding: 8px 0; }
  .xr .ekyc-raw pre { background: #0B1220; color: #E2E8F0; padding: 14px; border-radius: 8px; max-height: 320px; overflow: auto; font-size: 12px; white-space: pre-wrap; word-break: break-word; }
  .xr-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  .xr-actions .btn { display: inline-flex; align-items: center; gap: 6px; font-weight: 700; }
  .xr-hero { display: grid; grid-template-columns: minmax(240px, 320px) minmax(0, 1fr); gap: 14px; }
  .xr-score { padding: 16px; border-radius: 10px; border: 1px solid #E2E8F0; background: linear-gradient(160deg, #F0FDFA, #FFFFFF); }
  .xr-score-label { color: #64748B; font-size: 12px; font-weight: 900; text-transform: uppercase; }
  .xr-score-row { display: flex; align-items: center; gap: 12px; margin: 4px 0 12px; }
  .xr-score-row b { font-size: 42px; line-height: 1; color: #0F172A; }
  .xr-bar { position: relative; height: 10px; border-radius: 999px; background: linear-gradient(90deg, #DC2626 0%, #F59E0B 45%, #16A34A 100%); }
  .xr-bar i { position: absolute; top: -4px; width: 4px; height: 18px; margin-left: -2px; border-radius: 2px; background: #0F172A; box-shadow: 0 0 0 2px #FFFFFF; }
  .xr-scale { display: flex; justify-content: space-between; margin-top: 4px; color: #94A3B8; font-size: 11px; font-weight: 700; }
  .xr-meta, .xr-stats, .xr-detail { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
  .xr-stats { grid-template-columns: repeat(6, minmax(0, 1fr)); }
  .xr-detail { grid-template-columns: repeat(4, minmax(0, 1fr)); margin-top: 6px; }
  .xr-stat { padding: 11px 12px; border-radius: 8px; border: 1px solid #E2E8F0; background: #FFFFFF; min-width: 0; }
  .xr-stat span { display: block; color: #64748B; font-size: 11px; font-weight: 900; text-transform: uppercase; }
  .xr-stat strong { display: block; color: #0F172A; font-size: 14px; word-break: break-word; }
  .xr-stat.xr-warning { background: #FFFBEB; border-color: #FDE68A; }
  .xr-stat.xr-danger { background: #FEF2F2; border-color: #FECACA; }
  .xr-alerts { display: grid; gap: 8px; }
  .xr-note { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 8px; border: 1px solid #E2E8F0; background: #F8FAFC; color: #334155; font-weight: 700; font-size: 13px; }
  .xr-note.xr-warning { background: #FFFBEB; border-color: #FDE68A; color: #92400E; }
  .xr-note.xr-danger { background: #FEF2F2; border-color: #FECACA; color: #B91C1C; }
  .xr-note.xr-info { background: #EFF6FF; border-color: #BFDBFE; color: #1D4ED8; }
  .xr-sub { margin: 6px 0 0; font-size: 14px; font-weight: 900; color: #0F172A; }
  .xr-table th { color: #64748B; font-size: 11px; text-transform: uppercase; white-space: nowrap; }
  .xr-row { cursor: pointer; }
  .xr-row.xr-severe { background: #FEF2F2; }
  .xr-text-danger { color: #B91C1C; font-weight: 800; }
  .xr-detail-row > td { background: #F8FAFC; }
  .xr-history { display: inline-flex; gap: 2px; }
  .xr-dpd { display: inline-block; width: 9px; height: 16px; border-radius: 2px; background: #E2E8F0; }
  .xr-dpd-ok { background: #16A34A; }
  .xr-dpd-late { background: #F59E0B; }
  .xr-dpd-bad { background: #DC2626; }
  .xr-dpd-none { background: #E2E8F0; }
  .xr-legend { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 10px; font-size: 12px; font-weight: 700; color: #475569; }
  .xr-legend span { display: inline-flex; align-items: center; gap: 6px; }
  @media (max-width: 1200px) { .xr-stats { grid-template-columns: repeat(3, minmax(0, 1fr)); } .xr-detail { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (max-width: 768px) {
    .xr-hero, .xr-meta, .xr-stats, .xr-detail { grid-template-columns: 1fr; }
    .xr-stats, .xr-meta { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
`

export default ExperianReport
