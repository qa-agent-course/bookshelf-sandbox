# Bookshelf: product brief

Bookshelf is a tiny online bookshop built for QA practice. It is not a real shop: no payments, no deliveries, fake data only.

## What it does

A reader can browse eight public-domain classics, search them, open a book, add copies to a cart, apply a promo code, check out with a delivery address and see the order.

## Users

| User | How they get in | Notes |
|---|---|---|
| Guest | "Continue as guest" on `/login`, or automatically on the first cart action | Gets a session token for 60 minutes. Can place orders. |
| Signed-in reader | `reader.one@example.com` or `reader.two@example.com` (fictional), password from `DEMO_PASSWORD` | Can see their own orders. |

## Critical flows

1. Search the catalogue (BS-101).
2. Add a book to the cart with a quantity (BS-102).
3. Cart totals: promo codes, delivery fee, total (BS-103, BS-106).
4. Checkout and place the order (BS-104, BS-108).
5. See an order (BS-107).

## Domain

E-commerce. Prices in EUR, money in cents. Two languages: English (default) and Ukrainian (BS-105).

## Architecture in one paragraph

Node.js + Express server (`server/`), plain HTML pages with one `app.js` (`public/`), REST API described in `openapi/bookshelf.openapi.yaml`, data in memory (seeded from `data/*.json`, reset on every restart). Each API request writes one line to `logs/server.log`, and every response carries an `X-Request-Id` header that matches the log line.

## Areas that changed recently

Promo codes, the delivery fee, the checkout form and the Ukrainian translation were all added in the last release.
