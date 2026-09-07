/**
 * Single response shape for every API endpoint:
 *
 *   { success: boolean, message: string, data: object|null, code?: string }
 *
 * `data` is always present (null rather than omitted) so clients can read
 * `res.data.data` without a shape check, and `code` is a stable machine
 * identifier that clients can branch on while `message` stays free to change.
 */

/**
 * Success response.
 * @param {import('express').Response} res
 * @param {*} data payload; `undefined` is normalised to `null`
 * @param {string} message human-readable summary
 * @param {object} [options]
 * @param {string} [options.code] optional machine-readable success code
 * @param {number} [options.status] HTTP status (default 200)
 */
export const ok = (res, data, message = 'OK', options = {}) => {
  const { code, status = 200 } = options;
  const body = {
    success: true,
    message,
    data: data === undefined ? null : data,
  };
  if (code) body.code = code;
  return res.status(status).json(body);
};

/**
 * Created response - same shape as `ok` with a 201.
 */
export const created = (res, data, message = 'Created', options = {}) =>
  ok(res, data, message, { ...options, status: 201 });

/**
 * Failure response.
 *
 * `data` stays in the body (as null by default) so a client never has to
 * special-case error payloads. Callers that need to return context with a
 * failure - e.g. the existing loan on an eligibility conflict - pass it here
 * instead of hand-rolling `res.status().json()`.
 *
 * @param {import('express').Response} res
 * @param {string} code stable machine-readable error code
 * @param {string} message user-facing message
 * @param {number} [status] HTTP status (default 400)
 * @param {*} [data] optional context payload
 */
export const fail = (res, code, message, status = 400, data = null) =>
  res.status(status).json({
    success: false,
    message,
    data,
    code,
  });
