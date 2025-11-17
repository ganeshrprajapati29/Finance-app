import { generateAmortization } from '../utils/amortization.js';
import { PriorityQueue, LoanHashMap } from '../utils/dsa.js';

// Cache for loan decisions to avoid recalculations
const decisionCache = new LoanHashMap();

export function createDecision({ amountApproved, rateAPR, tenureMonths }){
  // Create cache key
  const cacheKey = `${amountApproved}-${rateAPR}-${tenureMonths}`;

  // Check cache first
  if (decisionCache.has(cacheKey)) {
    return decisionCache.get(cacheKey);
  }

  const schedule = generateAmortization(amountApproved, rateAPR, tenureMonths);
  const emi = schedule[0]?.total || 0;
  const decision = { amountApproved, rateAPR, tenureMonths, emi, schedule };

  // Cache the decision
  decisionCache.set(cacheKey, decision);

  return decision;
}

// Function to get overdue loans using priority queue
export function getOverdueLoans(loans) {
  const overdueQueue = new PriorityQueue((a, b) => {
    // Priority based on how overdue (earlier due dates have higher priority)
    const aDue = a.schedule?.find(s => !s.paid)?.dueDate?.getTime() || Infinity;
    const bDue = b.schedule?.find(s => !s.paid)?.dueDate?.getTime() || Infinity;
    return aDue - bDue; // Smaller timestamp (earlier) has higher priority
  });

  const now = new Date().getTime();
  loans.forEach(loan => {
    const nextDue = loan.schedule?.find(s => !s.paid)?.dueDate?.getTime();
    if (nextDue && nextDue < now) {
      overdueQueue.push(loan);
    }
  });

  return overdueQueue;
}
