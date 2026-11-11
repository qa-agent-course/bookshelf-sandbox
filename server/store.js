'use strict';

// In-memory data. Everything is loaded from data/*.json on start
// and is lost when the server stops.

const path = require('node:path');
const fs = require('node:fs');

const dataDir = path.join(__dirname, '..', 'data');

function load(name) {
  return JSON.parse(fs.readFileSync(path.join(dataDir, name), 'utf8'));
}

const store = {};

function reset() {
  store.books = load('books.json');
  store.users = load('users.json');
  store.promoCodes = load('promo-codes.json');
  store.orders = load('orders.json');
  store.sessions = new Map();
  store.carts = new Map();
  store.nextOrderNumber =
    1 + Math.max(1000, ...store.orders.map((o) => Number(o.id.slice(4))));
  store.nextGuestNumber = 1;
}

function findBook(id) {
  return store.books.find((b) => b.id === id) || null;
}

function findUserByEmail(email) {
  const wanted = String(email).trim().toLowerCase();
  return store.users.find((u) => u.email === wanted) || null;
}

function findPromo(code) {
  const wanted = String(code).trim().toUpperCase();
  return store.promoCodes.find((p) => p.code === wanted) || null;
}

function cartFor(userId) {
  if (!store.carts.has(userId)) {
    store.carts.set(userId, { lines: new Map(), promoCodes: [], checkoutPending: false });
  }
  return store.carts.get(userId);
}

function emptyCart(userId) {
  const cart = cartFor(userId);
  cart.lines.clear();
  cart.promoCodes = [];
}

function addOrder(order) {
  store.orders.push(order);
  return order;
}

function nextOrderId() {
  const id = `ORD-${store.nextOrderNumber}`;
  store.nextOrderNumber += 1;
  return id;
}

function nextGuestId() {
  const id = `g_${String(store.nextGuestNumber).padStart(3, '0')}`;
  store.nextGuestNumber += 1;
  return id;
}

reset();

module.exports = {
  store,
  reset,
  findBook,
  findUserByEmail,
  findPromo,
  cartFor,
  emptyCart,
  addOrder,
  nextOrderId,
  nextGuestId,
};
