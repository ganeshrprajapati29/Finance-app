export async function bbpsFetchBill({ provider, accountRef, mock=true }) {
  if (mock) {
    return { amount: 199, customerName: 'Test User', dueDate: new Date(Date.now()+7*864e5) };
  }
  // TODO: call Xpresso BBPS sandbox with your keys
}

export async function bbpsPay({ provider, accountRef, amount, mock=true }) {
  if (mock) return { status: 'SUCCESS', txnId: 'BBPS'+Date.now() };
}
