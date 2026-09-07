import React from 'react'
import { AlertTriangle, Inbox, RefreshCcw, Search } from 'lucide-react'

/**
 * Shared operations-console primitives.
 *
 * These are the React counterparts of the Flutter app's widget kit: the same
 * tokens (defined in index.css), the same status vocabulary, the same empty /
 * error / loading grammar. Admin pages compose these instead of shipping a
 * private <style> block each, which is what let the console drift into a
 * different look on every screen.
 */

/* ---------------------------------------------------------------- header */

export const PageHeader = ({ title, subtitle, actions, icon: Icon }) => (
  <div className="kp-page-head">
    {Icon && (
      <div className="kp-metric-icon teal" style={{ width: 40, height: 40, flex: '0 0 40px' }}>
        <Icon size={20} />
      </div>
    )}
    <div style={{ minWidth: 0 }}>
      <h1 className="kp-page-title">{title}</h1>
      {subtitle && <p className="kp-page-sub">{subtitle}</p>}
    </div>
    <div className="kp-spacer" style={{ flex: '1 1 auto' }} />
    {actions && <div className="d-flex flex-wrap gap-2">{actions}</div>}
  </div>
)

/* --------------------------------------------------------------- metrics */

/**
 * Compact KPI tile. `tone` maps to the icon-well tints in index.css.
 */
export const MetricTile = ({ label, value, footnote, icon: Icon, tone = 'teal' }) => (
  <div className="kp-metric">
    <div style={{ minWidth: 0 }}>
      <div className="kp-metric-label">{label}</div>
      <div className="kp-metric-value">{value}</div>
      {footnote && <div className="kp-metric-foot">{footnote}</div>}
    </div>
    {Icon && (
      <div className={`kp-metric-icon ${tone}`}>
        <Icon size={18} />
      </div>
    )}
  </div>
)

/* --------------------------------------------------------------- toolbar */

export const Toolbar = ({ children }) => <div className="kp-toolbar">{children}</div>

export const SearchInput = ({ value, onChange, placeholder = 'Search...' }) => (
  <div className="kp-search">
    <Search size={15} />
    <input
      className="form-control"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
    />
  </div>
)

/**
 * Segmented status filter. Each option is `{ value, label, count? }`.
 * Counts are rendered inline so an operator can see the size of each bucket
 * without switching to it.
 */
export const FilterChips = ({ options = [], value, onChange }) => (
  <div className="kp-chip-row">
    {options.map((option) => (
      <button
        key={option.value}
        type="button"
        className={`kp-chip ${option.value === value ? 'active' : ''}`}
        onClick={() => onChange(option.value)}
      >
        {option.label}
        {typeof option.count === 'number' && (
          <span className="kp-chip-count">{option.count}</span>
        )}
      </button>
    ))}
  </div>
)

/* ----------------------------------------------------------------- badge */

const STATUS_TONE = {
  CONFIRMED: 'success',
  SUCCESS: 'success',
  PAID: 'success',
  APPROVED: 'success',
  ACTIVE: 'success',
  VERIFIED: 'success',
  COMPLETED: 'success',
  DELIVERED: 'success',
  PENDING: 'warning',
  PROCESSING: 'warning',
  SUBMITTED: 'warning',
  UNDER_REVIEW: 'warning',
  INITIATED: 'warning',
  FAILED: 'danger',
  REJECTED: 'danger',
  CANCELLED: 'danger',
  BLOCKED: 'danger',
  OVERDUE: 'danger',
  EXPIRED: 'danger',
  DISBURSED: 'info',
  REFUNDED: 'info',
  SHIPPED: 'info',
  CLOSED: 'neutral',
}

export const prettify = (raw) => {
  const text = String(raw || '').trim()
  if (!text) return '--'
  return text
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

/** Status pill. Unknown statuses render neutral rather than throwing. */
export const StatusPill = ({ status, label }) => {
  const tone = STATUS_TONE[String(status || '').trim().toUpperCase()] || 'neutral'
  return <span className={`kp-badge ${tone}`}>{label || prettify(status)}</span>
}

/* ---------------------------------------------------------------- states */

export const LoadingState = ({ message = 'Loading...' }) => (
  <div className="kp-state">
    <div className="spinner-border text-primary mb-3" role="status" aria-hidden="true" />
    <div className="kp-state-text">{message}</div>
  </div>
)

export const EmptyState = ({
  title = 'Nothing here yet',
  message,
  icon: Icon = Inbox,
  action,
}) => (
  <div className="kp-state">
    <div className="kp-state-icon">
      <Icon size={24} />
    </div>
    <div className="kp-state-title">{title}</div>
    {message && <div className="kp-state-text">{message}</div>}
    {action && <div className="mt-3">{action}</div>}
  </div>
)

export const ErrorState = ({
  title = 'Could not load this data',
  message = 'Please try again in a moment.',
  onRetry,
}) => (
  <div className="kp-state danger">
    <div className="kp-state-icon">
      <AlertTriangle size={24} />
    </div>
    <div className="kp-state-title">{title}</div>
    <div className="kp-state-text">{message}</div>
    {onRetry && (
      <button type="button" className="btn btn-primary btn-sm mt-3" onClick={onRetry}>
        <RefreshCcw size={14} className="me-1" /> Retry
      </button>
    )}
  </div>
)

/** Non-blocking inline strip, when part of a page failed but the rest works. */
export const AlertStrip = ({ tone = 'warning', children, onRetry }) => (
  <div className={`kp-alert ${tone}`}>
    <AlertTriangle size={16} style={{ flex: '0 0 16px', marginTop: 2 }} />
    <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    {onRetry && (
      <button
        type="button"
        className="btn btn-sm btn-link p-0"
        style={{ color: 'inherit', fontWeight: 800 }}
        onClick={onRetry}
      >
        Retry
      </button>
    )}
  </div>
)

/* ----------------------------------------------------------------- table */

/**
 * Table shell that keeps wide operations grids scrolling inside their own
 * container instead of pushing the page sideways.
 */
export const DataTable = ({ columns = [], children, footer }) => (
  <div className="kp-table-wrap">
    <div className="kp-table-scroll">
      <table className="kp-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column} scope="col">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
    {footer}
  </div>
)

export const Pagination = ({ page, totalPages, total, limit, onPage }) => {
  const from = total ? (page - 1) * limit + 1 : 0
  const to = Math.min(page * limit, total)
  return (
    <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 px-3 py-2 border-top">
      <span className="kp-cell-sub">
        Showing {from.toLocaleString('en-IN')}-{to.toLocaleString('en-IN')} of{' '}
        {Number(total || 0).toLocaleString('en-IN')}
      </span>
      <div className="d-flex gap-2">
        <button
          type="button"
          className="btn btn-outline-primary btn-sm"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          Previous
        </button>
        <span className="kp-cell-sub align-self-center">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          className="btn btn-outline-primary btn-sm"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  )
}

/* --------------------------------------------------------------- helpers */

export const formatCurrency = (amount) =>
  `₹${Number(amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

export const formatDateTime = (date) =>
  date
    ? new Date(date).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '--'

export const formatDate = (date) =>
  date
    ? new Date(date).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '--'

export const initials = (name) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'KP'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

export const Avatar = ({ name }) => <span className="kp-avatar">{initials(name)}</span>

/** Two-line identity cell used across users / payments / loans tables. */
export const IdentityCell = ({ name, sub }) => (
  <div className="d-flex align-items-center gap-2">
    <Avatar name={name} />
    <div style={{ minWidth: 0 }}>
      <div className="kp-cell-primary text-truncate">{name || 'Unknown'}</div>
      {sub && <div className="kp-cell-sub text-truncate">{sub}</div>}
    </div>
  </div>
)
