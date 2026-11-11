'use strict';

function sendError(res, status, code, message, details) {
  const error = { code, message };
  if (details) error.details = details;
  res.locals.log.error = code;
  return res.status(status).json({ error });
}

module.exports = { sendError };
