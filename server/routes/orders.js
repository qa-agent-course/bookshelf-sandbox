'use strict';

const express = require('express');
const settings = require('../settings');
const { store, cartFor, emptyCart, addOrder, nextOrderId } = require('../store');
const { priceCart } = require('../pricing');
const { requireAuth } = require('../auth');
const { wait } = require('../latency');
const { sendError } = require('../errors');
const { cartLines } = require('./cart');

const router = express.Router();

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ADDRESS_RULES = {
  fullName: [2, 80],
  street: [2, 120],
  city: [2, 60],
  postcode: [3, 10],
};

function validateOrderRequest(body) {
  const details = [];
  const address = body && typeof body.address === 'object' && body.address ? body.address : null;
  if (!address) {
    details.push({ field: 'address', message: 'address is required' });
  } else {
    for (const [field, [min, max]] of Object.entries(ADDRESS_RULES)) {
      const value = address[field];
      if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) {
        details.push({ field: `address.${field}`, message: `${field} must be ${min} to ${max} characters` });
      }
    }
    if (typeof address.email !== 'string' || !EMAIL_PATTERN.test(address.email.trim())) {
      details.push({ field: 'address.email', message: 'email must be a valid email address' });
    }
  }
  if (!body || !['standard', 'pickup'].includes(body.deliveryOption)) {
    details.push({ field: 'deliveryOption', message: 'deliveryOption must be standard or pickup' });
  }
  return details;
}

function cleanAddress(address) {
  return Object.fromEntries(
    ['fullName', 'email', 'street', 'city', 'postcode'].map((key) => [key, address[key].trim()]),
  );
}

router.get('/api/orders', requireAuth, (req, res) => {
  const mine = store.orders.filter((o) => o.userId === req.auth.userId);
  res.locals.log.count = mine.length;
  res.json(mine);
});

router.post('/api/orders', requireAuth, async (req, res) => {
  const details = validateOrderRequest(req.body);
  if (details.length) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'The order request is not valid', details);
  }

  const userId = req.auth.userId;
  const cart = cartFor(userId);
  if (cart.lines.size === 0) {
    return sendError(res, 409, 'CART_EMPTY', 'The cart is empty');
  }
  if (settings.orders.oneCheckoutAtATime && cart.checkoutPending) {
    return sendError(res, 409, 'ORDER_IN_PROGRESS', 'This order is already being placed');
  }

  const { deliveryOption } = req.body;
  const promoCode = cart.promoCodes.length ? cart.promoCodes.join('+') : null;
  const priced = priceCart(cartLines(cart), cart.promoCodes, deliveryOption);

  cart.checkoutPending = true;
  try {
    // payment provider round trip (simulated)
    await wait(settings.paymentDelayMs);

    const order = addOrder({
      id: nextOrderId(),
      userId,
      status: 'received',
      deliveryOption,
      address: cleanAddress(req.body.address),
      lines: priced.lines,
      promoCode,
      totals: priced.totals,
      createdAt: new Date().toISOString(),
    });
    emptyCart(userId);
    res.locals.log.order = order.id;
    res.locals.log.total = order.totals.totalCents;
    return res.status(201).json(order);
  } finally {
    cart.checkoutPending = false;
  }
});

router.get('/api/orders/:orderId', requireAuth, (req, res) => {
  const order = store.orders.find((o) => o.id === req.params.orderId);
  if (order) res.locals.log.orderOwner = order.userId;
  const visible =
    order && (settings.orders.readScope !== 'owner' || order.userId === req.auth.userId);
  if (!visible) return sendError(res, 404, 'ORDER_NOT_FOUND', 'No such order');
  return res.json(order);
});

module.exports = router;
