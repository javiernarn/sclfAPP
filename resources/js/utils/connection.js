// True when a request failed because the server could not be reached at all
// (no internet, server switched off, host answering 502/503/504) — as opposed
// to the server replying "no" (wrong password, validation error, ...).
export const isUnreachable = (err) =>
    !err?.response || [502, 503, 504].includes(err.response.status);
