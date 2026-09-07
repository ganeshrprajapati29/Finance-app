function firstValue(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return value;
    }
  }
  return '';
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function compactAddress(parts) {
  return parts
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .filter((part, index, array) => array.indexOf(part) === index)
    .join(', ');
}

export function normalizeAadhaarKycData(result = {}, fallback = {}) {
  const existing = asObject(fallback);
  const data = asObject(result?.aadhaarData || result?.data || result?.aadhaarOfflineKyc || result);
  const rawAddress = data.address;
  const addressObj = asObject(rawAddress);

  const careOf = firstValue(
    addressObj.careOf,
    addressObj.co,
    addressObj.c_o,
    data.careOf,
    data.co,
    data.guardianName,
    data.fatherName,
    existing.careOf
  );
  const house = firstValue(addressObj.house, addressObj.houseNo, addressObj.houseNumber, data.house, data.houseNo, existing.house);
  const street = firstValue(addressObj.street, addressObj.landmark, addressObj.lm, data.street, data.landmark, data.lm, existing.street);
  const locality = firstValue(
    addressObj.vtc,
    addressObj.village,
    addressObj.locality,
    addressObj.po,
    addressObj.loc,
    data.vtc,
    data.village,
    data.locality,
    data.po,
    data.loc,
    existing.locality
  );
  const postOffice = firstValue(addressObj.po, addressObj.postOffice, data.po, data.postOffice, existing.postOffice);
  const district = firstValue(addressObj.dist, addressObj.district, addressObj.subdist, data.dist, data.district, data.subdist, existing.district);
  const state = firstValue(addressObj.state, data.state, existing.state);
  const pincode = firstValue(addressObj.pincode, addressObj.pc, addressObj.pinCode, data.pincode, data.pc, data.pinCode, existing.pincode);
  const rawAddressText = typeof rawAddress === 'string' ? rawAddress.trim() : '';
  const completeAddress = firstValue(
    data.fullAddress,
    compactAddress([careOf, house, street, locality, postOffice, district, state, pincode]),
    rawAddressText,
    existing.completeAddress,
    existing.address
  );

  return {
    fullName: firstValue(data.fullName, data.name, data.accountName, existing.fullName),
    maskedAadhaar: firstValue(data.maskedAadhaar, data.maskedAadhar, data.aadhaarNumber, existing.maskedAadhaar),
    dob: firstValue(data.dob, data.dateOfBirth, existing.dob),
    gender: firstValue(data.gender, existing.gender),
    address: completeAddress,
    completeAddress,
    careOf,
    house,
    street,
    locality,
    postOffice,
    district,
    state,
    pincode,
    photoBase64: firstValue(data.photo, data.image, data.photoBase64, existing.photoBase64),
    mobileMatched: firstValue(data.mobileMatched, existing.mobileMatched),
    raw: existing.raw || result
  };
}
