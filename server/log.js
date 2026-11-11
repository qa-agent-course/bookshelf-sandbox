'use strict';

// Request log: one line per API request in logs/server.log, plus the console.

const fs = require('node:fs');
const path = require('node:path');
const settings = require('./settings');

const SLOW_MS = 1500;
let counter = 0x1000 + Math.floor(Math.random() * 0xd000);

function nextRequestId() {
  counter = counter >= 0xffff ? 0x1000 : counter + 1;
  return counter.toString(16);
}

function formatValue(value) {
  const text = String(value);
  return /[\s"]/.test(text) ? JSON.stringify(text) : text;
}

function writeLine(level, message) {
  const line = `${new Date().toISOString()} ${level.padEnd(5)} ${message}`;
  try {
    fs.mkdirSync(path.dirname(settings.logFile), { recursive: true });
    fs.appendFileSync(settings.logFile, `${line}\n`);
  } catch (err) {
    console.error(`could not write ${settings.logFile}: ${err.message}`);
  }
  console.log(line);
}

function requestLog(req, res, next) {
  const id = nextRequestId();
  const started = process.hrtime.bigint();
  req.id = id;
  res.locals.log = { user: undefined };
  res.set('X-Request-Id', id);

  if (!req.path.startsWith('/api/')) return next();

  res.on('finish', () => {
    const ms = Math.round(Number(process.hrtime.bigint() - started) / 1e6);
    const extras = Object.entries(res.locals.log)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => `${key}=${formatValue(value)}`);
    let level = 'INFO';
    if (res.statusCode >= 400) level = 'ERROR';
    else if (ms > SLOW_MS) {
      level = 'WARN';
      extras.unshift('slow request');
    }
    const parts = [`req=${id}`, req.method, req.path, res.statusCode, `${ms}ms`, ...extras];
    writeLine(level, parts.join(' '));
  });
  return next();
}

module.exports = { requestLog, writeLine };
