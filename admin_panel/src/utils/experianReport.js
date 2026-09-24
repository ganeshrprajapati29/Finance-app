// Pure helpers that turn SignCare's Experian (Retail) JSON into what the admin
// report screen renders. Kept free of React so it can be exercised directly.

export const SCORE_MIN = 300
export const SCORE_MAX = 900

const asArray = (value) => (Array.isArray(value) ? value : [])
const text = (value) => String(value ?? '').trim()

export const num = (value) => {
  const n = Number(String(value ?? '').replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? n : 0
}

export const money = (value) => `Rs. ${num(value).toLocaleString('en-IN')}`

/** Experian dates are YYYYMMDD integers; 0 / '' means "not reported". */
export const bureauDate = (value) => {
  const raw = text(value)
  let match = raw.match(/^(\d{4})(\d{2})(\d{2})$/)
  if (!match) match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return ''
  const [, y, m, d] = match
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)))
  if (date.getUTCFullYear() !== Number(y) || date.getUTCMonth() !== Number(m) - 1 || date.getUTCDate() !== Number(d)) return ''
  return `${y}-${m}-${d}`
}

export const formatBureauDate = (value) => {
  const iso = bureauDate(value)
  if (!iso) return '—'
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
  })
}

export const scoreBand = (score) => {
  if (score === null || score === undefined) return { label: 'No score', tone: 'muted' }
  if (score >= 750) return { label: 'Excellent', tone: 'success' }
  if (score >= 700) return { label: 'Good', tone: 'success' }
  if (score >= 650) return { label: 'Fair', tone: 'warning' }
  return { label: 'Low', tone: 'danger' }
}

/** Position of a score on the 300-900 bar, as a 0-100 percentage. */
export const scorePosition = (score) => {
  if (score === null || score === undefined) return 0
  return Math.max(0, Math.min(100, ((score - SCORE_MIN) / (SCORE_MAX - SCORE_MIN)) * 100))
}

export const validScore = (value) => {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) && n >= SCORE_MIN && n <= SCORE_MAX ? n : null
}

const CLOSED = /closed|settled|written[\s-]*off/i
export const isClosedAccount = (account = {}) =>
  Boolean(account.date_Closed) || CLOSED.test(text(account.accountStatusDescription))

export const isSevereAccount = (account = {}) => {
  const wording = [
    account.writtenOffSettledStatusDescription,
    account.suitfiledwillfuldefaultwrittenoffstatusDescription,
    account.suitfiledWillfuldefaultDescription,
  ].map(text).join(' ')
    .replace(/\bno\s+suit\s*filed\b/gi, '')
    .replace(/\bnot\s+(?:written|settled)\b/gi, '')
  return num(account.written_Off_Amt_Total) > 0 || num(account.written_Off_Amt_Principal) > 0 ||
    /written[\s-]*off|wilful|willful|suit\s*filed|settled/i.test(wording)
}

export const dpdTone = (dpd) => {
  if (dpd === null || dpd === undefined) return 'none'
  if (dpd <= 0) return 'ok'
  if (dpd < 30) return 'late'
  return 'bad'
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Newest-first list of the last `months` months with each month's days-past-due (null = not reported). */
export const paymentHistory = (account = {}, now = new Date(), months = 12) => {
  const byMonth = new Map()
  for (const entry of asArray(account.caiS_Account_History)) {
    const year = num(entry?.year)
    const month = num(entry?.month)
    if (year && month) byMonth.set(`${year}-${month}`, entry)
  }
  const cells = []
  for (let i = 0; i < months; i += 1) {
    const point = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    const year = point.getUTCFullYear()
    const month = point.getUTCMonth() + 1
    const entry = byMonth.get(`${year}-${month}`)
    cells.push({
      key: `${year}-${month}`,
      label: `${MONTHS[month - 1]} ${String(year).slice(2)}`,
      dpd: entry ? num(entry.days_Past_Due) : null,
      asset: entry ? text(entry.assetClassificationDescription || entry.asset_Classification) : '',
    })
  }
  return cells
}

const monthsSince = (iso, now) => {
  const [y, m] = iso.split('-').map(Number)
  return (now.getUTCFullYear() - y) * 12 + (now.getUTCMonth() + 1 - m)
}

const uniqueBy = (items, keyOf) => {
  const seen = new Set()
  return items.filter((item) => {
    const key = keyOf(item)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function buildExperianView(report, now = new Date()) {
  if (!report || typeof report !== 'object' || !Object.keys(report).length) return null

  const rawAccounts = asArray(report.caiS_Account?.caiS_Account_DETAILS)
  const bureauSummary = report.caiS_Account?.caiS_Summary || {}
  const outstanding = bureauSummary.total_Outstanding_Balance || {}
  const caps = report.totalCAPS_Summary || {}
  const nonCaps = report.nonCreditCAPS?.nonCreditCAPS_Summary || {}
  const score = validScore(report.score?.fcirexScore)

  const accounts = rawAccounts.map((account, index) => {
    const history = paymentHistory(account, now)
    return {
      key: `${account.account_Number || 'acct'}-${index}`,
      lender: text(account.subscriber_Name) || 'Unknown lender',
      type: text(account.accountTypeDescription || account.portfolioTypeDescription) || '—',
      portfolio: text(account.portfolioTypeDescription),
      status: text(account.accountStatusDescription) || (account.account_Status !== undefined ? `Code ${account.account_Status}` : '—'),
      closed: isClosedAccount(account),
      severe: isSevereAccount(account),
      accountNumber: text(account.account_Number),
      opened: account.open_Date,
      reported: account.date_Reported,
      limit: num(account.credit_Limit_Amount),
      balance: num(account.current_Balance),
      pastDue: num(account.amount_Past_Due),
      emi: num(account.scheduled_Monthly_Payment_Amount),
      rate: text(account.rate_of_Interest),
      tenure: num(account.repayment_Tenure),
      collateral: text(account.type_of_Collateral),
      firstDelinquency: account.date_of_First_Delinquency,
      comment: text(account.special_Comment || account.subscriber_comments || account.consumer_comments),
      writtenOffTotal: num(account.written_Off_Amt_Total),
      wording: [account.writtenOffSettledStatusDescription, account.suitfiledWillfuldefaultDescription]
        .map(text).filter((item) => item && !/^(not|no)\b/i.test(item)).join(' · '),
      history,
      maxDpd12m: history.reduce((worst, cell) => Math.max(worst, cell.dpd || 0), 0),
    }
  })

  const open = accounts.filter((item) => !item.closed)
  const openedDates = rawAccounts.map((item) => bureauDate(item.open_Date)).filter(Boolean).sort()
  const creditAge = openedDates.length ? monthsSince(openedDates[0], now) : null

  const totals = {
    total: num(bureauSummary.credit_Account?.creditAccountTotal) || accounts.length,
    active: accounts.filter((item) => !item.closed && item.balance > 0).length,
    closed: accounts.filter((item) => item.closed).length,
    defaulted: num(bureauSummary.credit_Account?.creditAccountDefault),
    outstanding: num(outstanding.outstanding_Balance_All) || accounts.reduce((sum, item) => sum + item.balance, 0),
    secured: num(outstanding.outstanding_Balance_Secured),
    unsecured: num(outstanding.outstanding_Balance_UnSecured),
    pastDue: accounts.reduce((sum, item) => sum + item.pastDue, 0),
    delinquent: open.filter((item) => item.pastDue > 0 || item.history.slice(0, 3).some((cell) => (cell.dpd || 0) > 0)).length,
    writtenOff: accounts.filter((item) => item.severe).length,
    maxDpd12m: accounts.reduce((worst, item) => Math.max(worst, item.maxDpd12m), 0),
    creditAgeMonths: creditAge !== null && creditAge >= 0 ? creditAge : null,
  }

  const enquiries = {
    last7: caps.totalCAPSLast7Days ?? null,
    last30: caps.totalCAPSLast30Days ?? null,
    last90: caps.totalCAPSLast90Days ?? null,
    last180: caps.totalCAPSLast180Days ?? null,
    nonCredit30: nonCaps.nonCreditCAPSLast30Days ?? null,
  }

  // Bureau returns all-zero placeholder rows when there are no enquiries.
  const enquiryRows = asArray(report.caps?.capS_Application_Details)
    .filter((row) => bureauDate(row?.date_of_Request) || text(row?.subscriber_Name))
    .map((row, index) => ({
      key: `enq-${index}`,
      date: row.date_of_Request,
      lender: text(row.subscriber_Name) || '—',
      reason: text(row.enquiryReasonDescription) || (row.enquiry_Reason ? `Code ${row.enquiry_Reason}` : '—'),
      purpose: text(row.financePurposeDescription),
      amount: num(row.amount_Financed),
    }))

  const holders = rawAccounts.flatMap((item) => asArray(item.caiS_Holder_Details))
  const addresses = rawAccounts.flatMap((item) => asArray(item.caiS_Holder_Address_Details))
    .map((item) => [
      item.first_Line_Of_Address_non_normalized, item.second_Line_Of_Address_non_normalized,
      item.third_Line_Of_Address_non_normalized, item.city_non_normalized, item.fifth_Line_Of_Address_non_normalized,
      item.ziP_Postal_Code_non_normalized,
    ].map(text).filter(Boolean).join(', '))
  const phones = rawAccounts.flatMap((item) => asArray(item.caiS_Holder_Phone_Details))
  const ids = rawAccounts.flatMap((item) => asArray(item.caiS_Holder_ID_Details))

  const identity = {
    names: uniqueBy(holders.map((item) => [item.first_Name_Non_Normalized, item.middle_Name_1_Non_Normalized, item.surname_Non_Normalized]
      .map(text).filter(Boolean).join(' ')), (name) => name.toUpperCase()),
    birthDates: uniqueBy(holders.map((item) => bureauDate(item.date_of_birth)), (date) => date),
    pans: uniqueBy([...holders.map((item) => text(item.income_TAX_PAN)), ...ids.map((item) => text(item.income_TAX_PAN))], (pan) => pan.toUpperCase()),
    addresses: uniqueBy(addresses, (address) => address.toUpperCase()),
    emails: uniqueBy([...phones.map((item) => text(item.eMailId)), ...ids.map((item) => text(item.eMailId))], (mail) => mail.toLowerCase()),
    phones: uniqueBy(phones.map((item) => text(item.telephone_Number || item.mobilePhoneNumber)), (phone) => phone),
  }

  const submitted = report.current_Application?.current_Application_Details?.current_Applicant_Details || {}
  const applicant = {
    name: [submitted.first_Name, submitted.middle_Name1, submitted.last_Name].map(text).filter(Boolean).join(' '),
    pan: text(submitted.incomeTaxPan),
    dob: text(submitted.date_Of_Birth_Applicant),
    mobile: text(submitted.mobilePhoneNumber || submitted.telephone_Number_Applicant_1st),
  }

  const alerts = []
  if (totals.writtenOff > 0) alerts.push({ tone: 'danger', text: `${totals.writtenOff} account(s) written off, settled or suit-filed.` })
  if (totals.maxDpd12m >= 90) alerts.push({ tone: 'danger', text: `Payment ${totals.maxDpd12m} days past due within the last 12 months.` })
  else if (totals.maxDpd12m >= 30) alerts.push({ tone: 'warning', text: `Payment ${totals.maxDpd12m} days past due within the last 12 months.` })
  if (totals.pastDue > 0) alerts.push({ tone: 'warning', text: `${money(totals.pastDue)} currently past due.` })
  if (num(enquiries.last30) >= 5) alerts.push({ tone: 'warning', text: `${enquiries.last30} credit enquiries in the last 30 days.` })
  if (/^n/i.test(text(report.match_result?.exact_match))) alerts.push({ tone: 'warning', text: 'Bureau did not report an exact identity match.' })
  if (score === null) alerts.push({ tone: 'info', text: 'No bureau score was returned (thin or new-to-credit file).' })
  else if (score < 650) alerts.push({ tone: 'warning', text: `Bureau score ${score} is below 650.` })

  return {
    score,
    band: scoreBand(score),
    position: scorePosition(score),
    confidence: text(report.score?.fcirexScoreConfidLevel),
    reportNumber: text(report.creditProfileHeader?.reportNumber),
    reportDate: report.creditProfileHeader?.reportDate,
    exactMatch: text(report.match_result?.exact_match),
    bureauMessage: text(report.userMessage?.userMessageText),
    accounts,
    totals,
    enquiries,
    enquiryRows,
    identity,
    applicant,
    alerts,
  }
}
