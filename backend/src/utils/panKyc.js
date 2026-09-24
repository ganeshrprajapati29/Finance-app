function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function firstText(...values) {
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (text && text !== 'null' && text !== 'undefined') return text;
  }
  return '';
}

function nestedPanData(result = {}) {
  const root = asObject(result);
  const candidates = [];
  const visited = new Set();
  const visit = (value) => {
    const item = asObject(value);
    if (!Object.keys(item).length || visited.has(item)) return;
    visited.add(item);
    candidates.push(item);
    for (const child of Object.values(item)) {
      if (Array.isArray(child)) child.forEach(visit);
      else visit(child);
    }
  };
  visit(root);

  // Prefer the deepest object that actually carries PAN identity fields.
  const score = (item) => {
    let value = 0;
    if (firstText(item.pan, item.panNumber, item.pan_number, item.panNo)) value += 2;
    if (firstText(item.status, item.pan_status, item.panStatus)) value += 3;
    if (firstText(item.category, item.pan_type, item.panType)) value += 2;
    if (firstText(item.fullName, item.full_name, item.name, item.panName,
      item.name_as_per_pan, item.pan_holder_name)) value += 5;
    return value;
  };
  return candidates.reduce(
    (best, item) => (score(item) > score(best) ? item : best),
    root,
  );
}

function joinedName(data = {}) {
  return [data.firstName, data.middleName, data.lastName]
    .filter((part) => String(part ?? '').trim())
    .map((part) => String(part).trim())
    .join(' ');
}

export function normalizePanKycData(result = {}, fallback = {}) {
  const root = asObject(result);
  const data = nestedPanData(root);
  const existing = asObject(fallback);

  const panNumber = firstText(
    data.pan,
    data.panNumber,
    data.pan_number,
    data.panNo,
    data.pan_no,
    root.pan,
    root.panNumber,
    existing.pan,
    existing.panNumber,
  ).toUpperCase();

  // SignCare's PAN verify response does NOT return the name text — only a
  // name_as_per_pan_match boolean. Use the fallback (submitted name) as the
  // stored name so it is available to downstream steps.
  const name = firstText(
    data.name,
    data.fullName,
    data.full_name,
    data.panName,
    data.panHolderName,
    data.pan_holder_name,
    // SignCare field: name as registered on PAN (present in some response shapes)
    data.name_as_per_pan,
    data.nameAsPerPan,
    data.nameOnCard,
    root.name,
    root.fullName,
    root.panName,
    root.panHolderName,
    joinedName(data),
    // Fallback: the name the user submitted — store it so it is not lost
    existing.name,
    existing.fullName,
  );

  // SignCare returns status as "VALID" / "INVALID". Map to a consistent value.
  const rawStatus = firstText(
    data.status,
    data.pan_status,
    data.panStatus,
    data.verificationStatus,
    root.status,
  );

  // aadhaar_seeding_status is snake_case in SignCare response
  const aadhaarSeedingStatus = firstText(
    data.aadhaar_seeding_status,
    data.aadhaarSeedingStatus,
    data.aadhaarLinked,
    data.aadhaar_linked,
    data.aadhaarSeeding,
    existing.aadhaarSeedingStatus,
  );

  return {
    pan: panNumber,
    panNumber,
    name,
    fullName: name,
    firstName: firstText(data.firstName, data.first_name),
    middleName: firstText(data.middleName, data.middle_name),
    lastName: firstText(data.lastName, data.last_name),
    dob: firstText(data.dob, data.dateOfBirth, data.date_of_birth, existing.dob),
    category: firstText(data.category, data.panType, data.pan_type, existing.category),
    status: rawStatus,
    panStatus: rawStatus,
    // name_as_per_pan_match: true = name matched, false = mismatch, null = not checked
    nameMatchResult: data.name_as_per_pan_match ?? data.nameAsPerPanMatch ?? null,
    dobMatchResult: data.date_of_birth_match ?? data.dateOfBirthMatch ?? null,
    aadhaarSeedingStatus,
    raw: root,
  };
}

export function isPanVerified(result = {}, normalized = normalizePanKycData(result)) {
  const root = asObject(result);
  const data = nestedPanData(root);

  // SignCare uses status "VALID" for an existing PAN, "INVALID" for non-existent.
  // success:true + statusCode:100 means the lookup itself succeeded regardless of
  // whether the name matched — a VALID PAN is a verified PAN for loan KYC purposes.
  const status = firstText(
    data.status,
    data.pan_status,
    data.panStatus,
    data.verificationStatus,
    root.status,
  ).toUpperCase();

  // Explicitly reject INVALID status — no fallback should override this.
  if (status === 'INVALID') return false;

  const message = firstText(root.message, root.resText, data.message).toLowerCase();

  return Boolean(
    root.valid === true ||
    root.verified === true ||
    data.valid === true ||
    data.verified === true ||
    data.panValid === true ||
    data.nameMatched === true ||
    // SignCare's primary valid status
    status === 'VALID' ||
    ['SUCCESS', 'VERIFIED', 'ACTIVE', 'COMPLETED'].includes(status) ||
    message.includes('success'),
  );
}
