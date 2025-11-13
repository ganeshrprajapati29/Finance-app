export async function bbpsFetchBill({ provider, accountRef, billType, mock = true }) {
  if (mock) {
    const mockData = {
      MOBILE: { amount: 299, customerName: 'John Doe', dueDate: new Date(Date.now() + 7 * 864e5), billNumber: 'MBL123456789' },
      DTH: { amount: 399, customerName: 'Jane Smith', dueDate: new Date(Date.now() + 3 * 864e5), billNumber: 'DTH987654321' },
      ELECTRICITY: { amount: 1250, customerName: 'ABC Apartments', dueDate: new Date(Date.now() + 14 * 864e5), billNumber: 'ELE456789123' },
      WATER: { amount: 450, customerName: 'XYZ Society', dueDate: new Date(Date.now() + 10 * 864e5), billNumber: 'WTR789123456' },
      GAS: { amount: 850, customerName: 'Gas Consumer', dueDate: new Date(Date.now() + 5 * 864e5), billNumber: 'GAS321654987' }
    };
    return mockData[billType] || { amount: 199, customerName: 'Test User', dueDate: new Date(Date.now() + 7 * 864e5), billNumber: 'TEST123' };
  }
  // TODO: call Xpresso BBPS sandbox with your keys
}

export async function bbpsPay({ provider, accountRef, billType, amount, billNumber, mock = true }) {
  if (mock) return { status: 'SUCCESS', txnId: `${billType.substring(0, 3).toUpperCase()}${Date.now()}`, billNumber };
}
