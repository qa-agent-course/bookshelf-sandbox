'use strict';

// Message bundles for the UI and plural forms for texts built on the server.

const path = require('node:path');
const fs = require('node:fs');
const settings = require('./settings');

const LANGUAGES = ['en', 'uk'];
const DEFAULT_LANGUAGE = 'en';
const bundleDir = path.join(__dirname, '..', 'public', 'i18n');

const pluralTable = {
  en: (n) => (n === 1 ? 'one' : 'other'),
  uk: (n) => (n === 1 ? 'one' : 'few'),
};

function pluralCategory(lang, n) {
  if (settings.revision > 1) {
    return new Intl.PluralRules(lang).select(n);
  }
  return (pluralTable[lang] || pluralTable.en)(n);
}

const keyAliases = settings.revision > 1 ? { 'book.addToBasket': 'book.addToCart' } : {};

function readBundle(lang) {
  const raw = JSON.parse(fs.readFileSync(path.join(bundleDir, `${lang}.json`), 'utf8'));
  const bundle = {};
  for (const [key, value] of Object.entries(raw)) {
    bundle[keyAliases[key] || key] = value;
  }
  return bundle;
}

const bundles = Object.fromEntries(LANGUAGES.map((lang) => [lang, readBundle(lang)]));

function normaliseLanguage(lang) {
  return LANGUAGES.includes(lang) ? lang : DEFAULT_LANGUAGE;
}

function languageOf(req) {
  return normaliseLanguage(req.query?.lang || req.cookies?.lang);
}

function format(text, vars) {
  return String(text).replace(/\{(\w+)\}/g, (_, name) => (name in vars ? String(vars[name]) : `{${name}}`));
}

function t(lang, key, vars = {}) {
  let entry = bundles[lang]?.[key];
  if (entry === undefined) entry = bundles[DEFAULT_LANGUAGE][key];
  if (entry === undefined) return key;
  if (typeof entry === 'object') {
    const count = Number(vars.count);
    const category = pluralCategory(lang, count);
    entry = entry[category] ?? entry.other ?? entry.many ?? Object.values(entry)[0];
  }
  return format(entry, vars);
}

module.exports = { LANGUAGES, bundles, languageOf, normaliseLanguage, pluralCategory, t };
