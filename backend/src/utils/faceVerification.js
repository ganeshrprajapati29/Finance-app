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

function numberValue(...values) {
  for (const value of values) {
    const num = Number(value);
    if (Number.isFinite(num)) return num;
  }
  return null;
}

function truthyFlag(value) {
  if (value === true) return true;
  const text = String(value ?? '').trim().toLowerCase();
  return ['true', 'yes', 'y', '1', 'review', 'manual_review'].includes(text);
}

function falseFlag(value) {
  if (value === false) return true;
  const text = String(value ?? '').trim().toLowerCase();
  return ['false', 'no', 'n', '0', 'failed', 'failure', 'rejected'].includes(text);
}

function providerAccepted(body = {}) {
  const status = firstText(body.status, body.verificationStatus, body.result).toUpperCase();
  const message = firstText(body.message, body.statusMessage, body.bankResponse).toLowerCase();
  const statusCode = Number(body.statusCode ?? body.code);
  return body.success === true ||
    statusCode === 100 ||
    ['SUCCESS', 'VERIFIED', 'COMPLETED', 'LIVE', 'MATCHED', 'VALID'].includes(status) ||
    message.includes('valid authentication') ||
    message.includes('verified successfully');
}

function candidateBodies(data) {
  const queue = [data];
  const bodies = [];
  const seen = new Set();
  while (queue.length > 0 && bodies.length < 12) {
    const next = queue.shift();
    const body = asObject(next);
    if (Object.keys(body).length === 0 || seen.has(body)) continue;
    seen.add(body);
    bodies.push(body);
    for (const key of ['data', 'result', 'response', 'payload', 'verification', 'faceLiveness']) {
      if (body[key] && typeof body[key] === 'object') queue.push(body[key]);
    }
  }
  return bodies;
}

export function cleanBase64Image(value = '') {
  return String(value || '').replace(/^data:[^;]+;base64,/i, '').replace(/\s/g, '');
}

export function extractAadhaarFaceImage(aadhaar = {}) {
  const data = asObject(aadhaar);
  const raw = asObject(data.raw);
  const rawData = asObject(raw.data || raw.aadhaarData || raw.claims || raw.verifiedClaims);
  return cleanBase64Image(firstText(
    data.photoBase64,
    data.photo,
    data.image,
    data.residentPhoto,
    data.profilePhoto,
    data.faceImage,
    data.pht,
    rawData.photoBase64,
    rawData.photo,
    rawData.image,
    rawData.residentPhoto,
    rawData.profilePhoto,
    rawData.faceImage,
    rawData.pht
  ));
}

export function livenessPassed(data = {}) {
  return candidateBodies(data).some((body) => {
    const status = firstText(body.status, body.verificationStatus, body.result).toUpperCase();
    const score = numberValue(body.livenessScore, body.liveScore, body.score, body.confidence);
    const multipleFaces = truthyFlag(body.multipleFacesDetected) || truthyFlag(body.multipleFaces);
    const reviewNeeded = truthyFlag(body.reviewNeeded) || truthyFlag(body.needsReview);
    const explicitNotLive = falseFlag(body.isLive) || falseFlag(body.live) || falseFlag(body.liveness);
    return !multipleFaces && !reviewNeeded && (
      body.isLive === true || body.live === true || body.liveness === true ||
      body.faceDetected === true || ['SUCCESS', 'VERIFIED', 'COMPLETED', 'LIVE'].includes(status) ||
      (score !== null && score >= 70) || (!explicitNotLive && providerAccepted(body))
    );
  });
}

export function faceMatchPassed(data = {}) {
  return candidateBodies(data).some((body) => {
    const status = firstText(body.status, body.verificationStatus, body.result).toUpperCase();
    const score = numberValue(body.matchScore, body.faceMatchScore, body.score, body.confidence, body.similarity);
    const explicitNotMatched = falseFlag(body.match) || falseFlag(body.matched) || falseFlag(body.isMatched) || falseFlag(body.faceMatched);
    return body.match === true || body.matched === true || body.isMatched === true ||
      body.faceMatched === true || ['SUCCESS', 'VERIFIED', 'COMPLETED', 'MATCHED'].includes(status) ||
      (score !== null && score >= 70) || (!explicitNotMatched && providerAccepted(body));
  });
}

export function faceStageSummary(data = {}) {
  const body = asObject(data);
  return {
    providerStatus: firstText(body.status, body.verificationStatus, body.result),
    livenessScore: numberValue(body.livenessScore, body.liveScore, body.score, body.confidence),
    matchScore: numberValue(body.matchScore, body.faceMatchScore, body.score, body.confidence, body.similarity),
    message: firstText(body.message, body.reason, body.description),
  };
}
