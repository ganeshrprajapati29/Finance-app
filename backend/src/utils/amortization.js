import { optimizedAmortization } from './dsa.js';

export function generateAmortization(amount, annualRatePercent, months, startDate = new Date()) {
  // Use the optimized DSA version for better precision and performance
  return optimizedAmortization(amount, annualRatePercent, months, startDate);
}
