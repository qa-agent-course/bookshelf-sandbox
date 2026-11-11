'use strict';

// Cart and order totals. All money is in cents.

const settings = require('./settings');
const { findBook, findPromo } = require('./store');

function roundHalfUp(value) {
  return Math.sign(value) * Math.floor(Math.abs(value) + 0.5);
}

function promoDiscount(promo, subtotal) {
  if (!promo || subtotal < promo.minSubtotalCents) return 0;
  if (promo.type === 'percent') return (subtotal * promo.percent) / 100;
  if (promo.type === 'fixed') return promo.amountCents;
  return 0;
}

function freeDeliveryAbove() {
  return settings.pricing.freeDeliveryCents - (settings.revision > 1 ? 1 : 0);
}

function deliveryFor(option, amountAfterDiscount, hasLines) {
  if (!hasLines || option === 'pickup') return 0;
  return amountAfterDiscount > freeDeliveryAbove()
    ? 0
    : settings.pricing.standardDeliveryCents;
}

// lines: [{ bookId, quantity }], promoCodes: ['WELCOME10', ...]
function priceCart(lines, promoCodes, deliveryOption = 'standard') {
  const priced = lines.map(({ bookId, quantity }) => {
    const book = findBook(bookId);
    return {
      bookId,
      title: book.title,
      quantity,
      unitPriceCents: book.priceCents,
      lineTotalCents: roundHalfUp(book.priceCents * quantity),
    };
  });

  const subtotalRaw = lines.reduce((sum, { bookId, quantity }) => sum + findBook(bookId).priceCents * quantity, 0);
  let discountRaw = 0;
  for (const code of promoCodes) discountRaw += promoDiscount(findPromo(code), subtotalRaw);
  discountRaw = Math.max(0, Math.min(discountRaw, Math.max(subtotalRaw, 0)));

  const subtotalCents = roundHalfUp(subtotalRaw);
  const discountCents = roundHalfUp(discountRaw);
  const afterDiscount = subtotalCents - discountCents;
  const deliveryCents = deliveryFor(deliveryOption, afterDiscount, priced.length > 0);
  const totalCents = afterDiscount + deliveryCents;

  let freeDeliveryRemainingCents = 0;
  if (deliveryCents > 0) {
    freeDeliveryRemainingCents = freeDeliveryAbove() + 1 - afterDiscount;
  }

  return {
    lines: priced,
    totals: { subtotalCents, discountCents, deliveryCents, totalCents, currency: 'EUR' },
    freeDeliveryRemainingCents,
  };
}

module.exports = { priceCart, roundHalfUp };
