import { generateAmortization } from '../utils/amortization.js';
export function createDecision({ amountApproved, rateAPR, tenureMonths }){
  const schedule = generateAmortization(amountApproved, rateAPR, tenureMonths);
  const emi = schedule[0]?.total || 0;
  return { amountApproved, rateAPR, tenureMonths, emi, schedule };
}
