'use strict';

const express = require('express');
const { store, findBook } = require('../store');
const { networkLatency } = require('../latency');
const { sendError } = require('../errors');

const router = express.Router();

function positiveInt(value, fallback) {
  if (value === undefined || value === '') return fallback;
  if (!/^\d+$/.test(String(value))) return NaN;
  return Number(value);
}

router.get('/api/books', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q : '';
  const page = positiveInt(req.query.page, 1);
  const limit = positiveInt(req.query.limit, 20);
  res.locals.log.q = q || undefined;

  if (q.length > 100) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'q must be at most 100 characters');
  }
  if (!Number.isInteger(page) || page < 1) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'page must be a whole number from 1');
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'limit must be a whole number from 1 to 50');
  }

  await networkLatency();

  const needle = q.trim().toLowerCase();
  const matches = needle
    ? store.books.filter(
        (b) => b.title.toLowerCase().includes(needle) || b.author.toLowerCase().includes(needle),
      )
    : store.books;
  const start = (page - 1) * limit;
  return res.json({ items: matches.slice(start, start + limit), page, limit, total: matches.length });
});

router.get('/api/books/:bookId', (req, res) => {
  const id = /^\d+$/.test(req.params.bookId) ? Number(req.params.bookId) : NaN;
  const book = Number.isInteger(id) ? findBook(id) : null;
  if (!book) return sendError(res, 404, 'BOOK_NOT_FOUND', 'No book with this id');
  return res.json(book);
});

module.exports = router;
