import { fetchBbpsBill, payBbpsBill, generateClubUrid } from './clubapiUtility.js';

export async function bbpsFetchBill({ provider, accountRef, billType, bbpsId, customerMobile, opvalue1, opvalue2, opvalue3, opvalue4, opvalue5 }) {
  return await fetchBbpsBill({
    urid: generateClubUrid('KPB'),
    bbpsId: bbpsId || provider,
    mobile: accountRef,
    customerMobile: customerMobile || accountRef,
    opvalue1: opvalue1 || billType,
    opvalue2,
    opvalue3,
    opvalue4,
    opvalue5
  });
}

export async function bbpsPay({ provider, accountRef, billType, amount, billNumber, bbpsId, customerMobile, opvalue1, opvalue2, opvalue3, opvalue4, opvalue5 }) {
  return await payBbpsBill({
    urid: generateClubUrid('KPY'),
    bbpsId: bbpsId || provider,
    mobile: accountRef,
    customerMobile: customerMobile || accountRef,
    amount,
    opvalue1: opvalue1 || billType,
    opvalue2: opvalue2 || billNumber,
    opvalue3,
    opvalue4,
    opvalue5
  });
}
