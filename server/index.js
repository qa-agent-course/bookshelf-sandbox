'use strict';

// Bookshelf sandbox server: pages, REST API, request log.

const path = require('node:path');
const express = require('express');
const settings = require('./settings');
const i18n = require('./i18n');
const { requestLog, writeLine } = require('./log');
const { sendError } = require('./errors');

const publicDir = path.join(__dirname, '..', 'public');

const PAGES = {
  '/': 'index.html',
  '/login': 'login.html',
  '/book/:id': 'book.html',
  '/cart': 'cart.html',
  '/checkout': 'checkout.html',
  '/order/:id': 'order.html',
};

function parseCookies(req, res, next) {
  req.cookies = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const index = part.indexOf('=');
    if (index > 0) req.cookies[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
  }
  next();
}

function languageFromQuery(req, res, next) {
  if (typeof req.query.lang === 'string' && i18n.LANGUAGES.includes(req.query.lang)) {
    res.cookie('lang', req.query.lang, { sameSite: 'lax', path: '/' });
    req.cookies.lang = req.query.lang;
  }
  next();
}

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(requestLog);
  app.use(parseCookies);
  app.use(express.json({ limit: '20kb' }));

  app.use(require('./routes/health'));
  app.use(require('./routes/books'));
  app.use(require('./routes/auth'));
  app.use(require('./routes/cart').router);
  app.use(require('./routes/orders'));

  app.all('/api/{*rest}', (req, res) => sendError(res, 404, 'NOT_FOUND', 'No such endpoint'));

  app.get('/i18n/:file', (req, res, next) => {
    const match = /^([a-z]{2})\.json$/.exec(req.params.file);
    if (!match || !i18n.LANGUAGES.includes(match[1])) return next();
    res.set('Cache-Control', 'no-store');
    return res.json(i18n.bundles[match[1]]);
  });

  app.get('/app-config.js', (req, res) => {
    const config = { release: settings.release, revision: settings.revision };
    res.type('application/javascript').set('Cache-Control', 'no-store');
    res.send(`window.BOOKSHELF_CONFIG = ${JSON.stringify(config)};\n`);
  });

  for (const [route, file] of Object.entries(PAGES)) {
    app.get(route, languageFromQuery, (req, res) => res.sendFile(path.join(publicDir, file)));
  }
  app.use(express.static(publicDir, { index: false }));

  app.use((req, res) => {
    res.status(404).type('text/plain').send('Page not found');
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (!res.locals.log) res.locals.log = {};
    if (err.type === 'entity.parse.failed') {
      return sendError(res, 400, 'VALIDATION_ERROR', 'The request body is not valid JSON');
    }
    if (err.type === 'entity.too.large') {
      return sendError(res, 400, 'VALIDATION_ERROR', 'The request body is too large');
    }
    writeLine('ERROR', `req=${req.id} unhandled ${err.stack || err}`);
    return sendError(res, 500, 'INTERNAL_ERROR', 'Something went wrong');
  });

  return app;
}

function start() {
  const app = createApp();
  const server = app.listen(settings.port, settings.host, () => {
    writeLine(
      'INFO',
      `server started port=${settings.port} jitterMs=${settings.jitterMs} fixed=${settings.fixed}`,
    );
    console.log(`Bookshelf is running at http://localhost:${settings.port} (listening on ${settings.host} only)`);
  });
  server.on('error', (err) => {
    console.error(`Could not start the server: ${err.message}`);
    process.exit(1);
  });
}

if (require.main === module) start();

module.exports = { createApp };
