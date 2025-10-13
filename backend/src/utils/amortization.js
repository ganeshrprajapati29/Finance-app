export function generateAmortization(amount, annualRatePercent, months, startDate = new Date()) {
  const monthlyRate = (annualRatePercent/100)/12;
  const n = months;
  let emi = 0;
  if (monthlyRate === 0) emi = amount / n;
  else emi = (amount * monthlyRate * Math.pow(1+monthlyRate, n)) / (Math.pow(1+monthlyRate, n)-1);
  emi = Math.round(emi*100)/100;
  let balance = amount; const schedule = [];
  for (let i=1;i<=n;i++){
    const interest = Math.round((balance * monthlyRate)*100)/100;
    const principal = Math.round((emi - interest)*100)/100;
    const dueDate = new Date(startDate); dueDate.setMonth(dueDate.getMonth()+i);
    schedule.push({ installmentNo:i, dueDate, principal, interest, total: principal+interest, paid:false });
    balance = Math.round((balance - principal)*100)/100;
  }
  return schedule;
}
