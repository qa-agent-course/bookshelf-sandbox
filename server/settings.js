'use strict';

// Runtime settings. Values come from the environment, see .env.example.

const path = require('node:path');

function intFromEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

const fixed = process.env.SANDBOX_FIXED === '1';

module.exports = {
  port: intFromEnv('PORT', 3000),
  // The app is a training target with deliberate weaknesses: never expose it to a network.
  host: process.env.HOST || '127.0.0.1',
  jitterMs: intFromEnv('SANDBOX_JITTER_MS', 800),
  fixed,
  release: fixed ? '1.1.0' : '1.0.0',
  demoPassword: process.env.DEMO_PASSWORD || 'change-me-locally',
  tokenTtlSeconds: 3600,
  paymentDelayMs: 500,
  logFile: path.join(__dirname, '..', 'logs', 'server.log'),

  pricing: {
    standardDeliveryCents: 490,
    freeDeliveryAboveCents: fixed ? 2999 : 3000,
  },
  cart: {
    maxCopiesPerBook: 10,
    quantityValidation: fixed ? 'server' : 'client',
    maxPromoCodes: fixed ? 1 : 5,
  },
  orders: {
    readScope: fixed ? 'owner' : 'signed-in',
    oneCheckoutAtATime: fixed,
  },
  i18n: {
    pluralEngine: fixed ? 'intl' : 'table',
    keyAliases: fixed ? { 'book.addToBasket': 'book.addToCart' } : {},
  },
  ui: {
    checkoutLabels: fixed ? 'all' : 'default',
    fieldErrors: fixed ? 'text' : 'outline',
    lockSubmit: fixed,
  },
};
