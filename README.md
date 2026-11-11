# Bookshelf sandbox

Bookshelf is a tiny online bookshop for the course "Your QA agent from zero".
It is a training product: you can search books, add them to a cart, apply a promo code, check out and see the order.
Nothing is real. There are no payments, all people are fictional, all emails use `example.com`, all tokens start with `sbx_FAKE_`.

The product has deliberate defects for you to find. Finding them, with evidence, is the exercise.

> Safety: never expose this app to a network. It is a training target with deliberate weaknesses.
> The server listens on `127.0.0.1` (your own computer) only. Do not change `HOST`, do not deploy it, do not open the port in a firewall or a tunnel.

## What you need

- Node.js 22.9 or later (22.x, 24.x or 26.x). Check with `node --version`.
- Git, a terminal and a browser.

## Start it

```bash
npm install
```

```bash
npm start
```

Open http://localhost:3000. Stop the server with Ctrl+C. All data lives in memory and resets on every restart.

Optional: copy the settings file once, so tests and the server share the same values.

macOS / Linux:

```bash
cp .env.example .env
```

Windows (PowerShell):

```powershell
Copy-Item .env.example .env
```

## Settings (`.env`)

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `3000` | Server port |
| `HOST` | `127.0.0.1` | Address the server listens on. Never expose this app to a network. |
| `DEMO_PASSWORD` | `change-me-locally` | Password of the two fake demo users. Tests read it from the environment. Do not paste it into an agent chat. |
| `SANDBOX_JITTER_MS` | `800` | Upper limit (ms) of a random delay on some API responses, like a real network. `0` makes the app deterministic. |
| `SANDBOX_FIXED` | unset | `1` starts the "fixed build", used to confirm that a reported problem is fixed. |

Restart `npm start` after changing `.env`.

## Demo users (fictional)

| Email | Name |
|---|---|
| `reader.one@example.com` | Reader One |
| `reader.two@example.com` | Reader Two |

Both use `DEMO_PASSWORD`. You can also click "Continue as guest" on `/login`.

## Pages

| URL | What it is |
|---|---|
| `/` | Catalogue and search |
| `/book/1` ... `/book/8` | Book details, quantity, "Add to cart" |
| `/cart` | Cart, promo code, totals |
| `/checkout` | Delivery form, "Place order" |
| `/order/ORD-1001` | Order details |
| `/login` | Sign in or continue as guest |

Language: EN / UK switch in the header, or add `?lang=uk` to any page URL.

## API

The contract is `openapi/bookshelf.openapi.yaml` (OpenAPI 3.1). Base URL `http://localhost:3000`.
Every response has an `X-Request-Id` header; the same ID appears in `logs/server.log`.

```bash
curl http://localhost:3000/api/health
```

Check that the OpenAPI file lists exactly the routes the server serves:

```bash
npm run check:openapi
```

## Tests

Install the Playwright browser once:

```bash
npx playwright install chromium
```

(`npx playwright install` without a name installs all browsers; chromium is enough here.)

Run all tests. Playwright starts the server for you if it is not running:

```bash
npx playwright test
```

Run every test 5 times:

```bash
npm run test:e2e:5
```

Open the last HTML report:

```bash
npx playwright show-report
```

The CI workflow `.github/workflows/playwright.yml` runs the same tests on GitHub Actions when you push to your own private repository.

## What is inside

```
server/        Express server: routes, pricing, i18n, auth, in-memory store, request log
public/        HTML pages, app.js, styles.css, translations in public/i18n/
data/          seed data: books, fake users, promo codes, two earlier orders
openapi/       bookshelf.openapi.yaml, the API contract
docs/          PRODUCT_BRIEF.md and CONVENTIONS.md (ticket, test case and bug report formats)
tickets/       BS-101 ... BS-108 as Markdown, plus jira-import.csv
tests/e2e/     search.spec.ts, cart-badge.spec.ts
tests/api/     empty: API tests from P14 go here
logs/          server.log (sample + new lines while the server runs), browser-console.log (sample)
scripts/       check-openapi.js
```

## Logs

The server appends one line per API request to `logs/server.log`. The file starts with a sample from an earlier test session. To restore the sample:

```bash
npm run reset
```

`logs/browser-console.log` is a sample copied from the DevTools console on `/checkout`.

The logs contain fake emails and fake tokens on purpose. Treat them like real ones: redact them before they go into a bug report.
