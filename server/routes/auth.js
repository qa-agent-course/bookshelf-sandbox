'use strict';

const express = require('express');
const { signIn, startGuest } = require('../auth');
const { sendError } = require('../errors');

const router = express.Router();

router.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || !email.trim() || typeof password !== 'string' || !password) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'email and password are required');
  }
  res.locals.log.email = email.trim().toLowerCase();
  const result = signIn(email, password);
  if (!result) return sendError(res, 401, 'INVALID_CREDENTIALS', 'Email or password is wrong');
  res.locals.log.user = result.user.id;
  return res.json(result.session);
});

router.post('/api/auth/guest', (req, res) => {
  const { guestId, session } = startGuest();
  res.locals.log.user = guestId;
  res.status(201).json(session);
});

module.exports = router;
