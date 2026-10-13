// Mirror of backend/src/utils/loanSchedule.js so the approval preview shows the
// exact EMI and totals the agreement and repayment schedule will use.

const toPaise = (value) => Math.round(Number(value || 0) * 100)
const toRupees = (paise) => paise / 100

export function monthlyEmi(principal, annualRatePercent, months) {
  const amount = Number(principal)
  const count = Number(months)
  const rate = Number(annualRatePercent) / 12 / 100
  if (!(amount > 0) || !(count > 0)) return 0
  if (!(rate > 0)) return amount / count
  const factor = (1 + rate) ** count
  return (amount * rate * factor) / (factor - 1)
}

export function buildRepaymentSchedule({ principal, annualRatePercent, months }) {
  const count = Math.trunc(Number(months))
  const principalPaise = toPaise(principal)
  const rate = Math.max(0, Number(annualRatePercent) || 0) / 12 / 100
  if (!(principalPaise > 0) || !(count > 0)) return { emi: 0, totalInterest: 0, totalRepayment: 0, schedule: [] }
  const emiPaise = Math.round(monthlyEmi(principalPaise, annualRatePercent, count))
  let balance = principalPaise
  let interestTotal = 0
  const schedule = []
  for (let index = 1; index <= count; index += 1) {
    const interest = Math.round(balance * rate)
    const principalPart = index === count ? balance : Math.min(balance, emiPaise - interest)
    schedule.push({ installmentNo: index, principal: toRupees(principalPart), interest: toRupees(interest), total: toRupees(principalPart + interest) })
    balance -= principalPart
    interestTotal += interest
  }
  return {
    emi: toRupees(emiPaise),
    totalInterest: toRupees(interestTotal),
    totalRepayment: toRupees(principalPaise + interestTotal),
    schedule,
  }
}

export function allInclusiveApr({ principal, annualRatePercent, months, upfrontCharges = 0 }) {
  const { schedule } = buildRepaymentSchedule({ principal, annualRatePercent, months })
  const received = Number(principal) - Math.max(0, Number(upfrontCharges) || 0)
  if (!schedule.length || !(received > 0)) return 0
  const presentValue = (monthly) => schedule.reduce((sum, row, index) => sum + row.total / (1 + monthly) ** (index + 1), 0)
  let low = 0
  let high = 1
  for (let step = 0; step < 100; step += 1) {
    const mid = (low + high) / 2
    if (presentValue(mid) > received) low = mid
    else high = mid
  }
  return Math.round(((low + high) / 2) * 12 * 100 * 100) / 100
}
