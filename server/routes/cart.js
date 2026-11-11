'use strict';

const express = require('express');
const settings = require('../settings');
const { cartFor, findBook, findPromo } = require('../store');
const { priceCart } = require('../pricing');
const { requireAuth } = require('../auth');
const { networkLatency } = require('../latency');
const { sendError } = require('../errors');
const i18n = require('../i18n');

const router = express.Router();
const QUANTITY_MESSAGE = 'Choose from 1 to 10 copies';

function cartLines(cart) {
  return [...cart.lines.entries()].map(([bookId, quantity]) => ({ bookId, quantity }));
}

function cartView(req) {
  const cart = cartFor(req.auth.userId);
  const priced = priceCart(cartLines(cart), cart.promoCodes);
  const itemCount = priced.lines.reduce((sum, line) => sum + line.quantity, 0);
  const lang = i18n.languageOf(req);
  return {
    lines: priced.lines,
    itemCount,
    promoCode: cart.promoCodes.length ? cart.promoCodes.join('+') : null,
    deliveryOption: 'standard',
    totals: priced.totals,
    freeDeliveryRemainingCents: priced.freeDeliveryRemainingCents,
    itemCountText: i18n.t(lang, 'cart.summary', { count: itemCount }),
  };
}

function logTotals(res, view) {
  Object.assign(res.locals.log, {
    subtotal: view.totals.subtotalCents,
    delivery: view.totals.deliveryCents,
    total: view.totals.totalCents,
  });
}

// Returns an error message, or null when the quantity can be used.
function checkQuantity(quantity, alreadyInCart = 0) {
  if (typeof quantity !== 'number' || !Number.isFinite(quantity)) {
    return 'quantity must be a number';
  }
  if (settings.cart.quantityValidation === 'server') {
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > settings.cart.maxCopiesPerBook) {
      return QUANTITY_MESSAGE;
    }
    if (alreadyInCart + quantity > settings.cart.maxCopiesPerBook) {
      return QUANTITY_MESSAGE;
    }
  }
  return null;
}

function parseBookId(value) {
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value);
  return NaN;
}

router.get('/api/cart', requireAuth, async (req, res) => {
  await networkLatency();
  const view = cartView(req);
  logTotals(res, view);
  res.json(view);
});

router.post('/api/cart/items', requireAuth, (req, res) => {
  const { bookId, quantity } = req.body || {};
  const id = typeof bookId === 'number' ? bookId : NaN;
  res.locals.log.bookId = bookId;
  res.locals.log.qty = quantity;
  if (!Number.isInteger(id) || id < 1) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'bookId must be a whole number from 1');
  }
  if (!findBook(id)) return sendError(res, 404, 'BOOK_NOT_FOUND', 'No book with this id');

  const cart = cartFor(req.auth.userId);
  const current = cart.lines.get(id) || 0;
  const problem = checkQuantity(quantity, current);
  if (problem) return sendError(res, 400, 'VALIDATION_ERROR', problem);

  cart.lines.set(id, current + quantity);
  return res.status(201).json(cartView(req));
});

router.patch('/api/cart/items/:bookId', requireAuth, (req, res) => {
  const id = parseBookId(req.params.bookId);
  const { quantity } = req.body || {};
  res.locals.log.bookId = req.params.bookId;
  res.locals.log.qty = quantity;
  const cart = cartFor(req.auth.userId);
  if (!cart.lines.has(id)) return sendError(res, 404, 'LINE_NOT_FOUND', 'This book is not in the cart');

  const problem = checkQuantity(quantity);
  if (problem) return sendError(res, 400, 'VALIDATION_ERROR', problem);

  cart.lines.set(id, quantity);
  return res.json(cartView(req));
});

router.delete('/api/cart/items/:bookId', requireAuth, (req, res) => {
  const id = parseBookId(req.params.bookId);
  res.locals.log.bookId = req.params.bookId;
  const cart = cartFor(req.auth.userId);
  if (!cart.lines.has(id)) return sendError(res, 404, 'LINE_NOT_FOUND', 'This book is not in the cart');
  cart.lines.delete(id);
  return res.json(cartView(req));
});

router.post('/api/cart/promo', requireAuth, (req, res) => {
  const { code } = req.body || {};
  if (typeof code !== 'string' || code.trim().length < 1 || code.trim().length > 20) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'code must be 1 to 20 characters');
  }
  const promo = findPromo(code);
  res.locals.log.code = code.trim().toUpperCase();
  if (!promo) return sendError(res, 400, 'PROMO_UNKNOWN', 'This promo code does not exist');

  const cart = cartFor(req.auth.userId);
  if (cart.promoCodes.includes(promo.code)) {
    return sendError(res, 409, 'PROMO_ALREADY_APPLIED', 'This promo code is already applied');
  }
  if (cart.promoCodes.length >= settings.cart.maxPromoCodes) {
    return sendError(res, 409, 'PROMO_ALREADY_APPLIED', 'A promo code is already applied to this cart');
  }
  const before = priceCart(cartLines(cart), []);
  if (before.totals.subtotalCents < promo.minSubtotalCents) {
    return sendError(
      res,
      400,
      'PROMO_NOT_ELIGIBLE',
      `${promo.code} needs a subtotal of ${(promo.minSubtotalCents / 100).toFixed(2)} EUR or more`,
    );
  }

  cart.promoCodes.push(promo.code);
  const view = cartView(req);
  res.locals.log.discountTotal = view.totals.discountCents;
  return res.json(view);
});

router.delete('/api/cart/promo', requireAuth, (req, res) => {
  const cart = cartFor(req.auth.userId);
  cart.promoCodes = [];
  return res.json(cartView(req));
});

module.exports = { router, cartLines };
