'use strict';

// Compares the routes in openapi/bookshelf.openapi.yaml with the /api routes
// the Express app really serves. Exits with code 1 if they differ.
// Usage: npm run check:openapi

const fs = require('node:fs');
const path = require('node:path');

const specFile = path.join(__dirname, '..', 'openapi', 'bookshelf.openapi.yaml');
const METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];

function routesFromSpec(text) {
  const routes = new Set();
  let inPaths = false;
  let currentPath = null;
  for (const line of text.split(/\r?\n/)) {
    if (/^\S/.test(line)) {
      inPaths = line.startsWith('paths:');
      currentPath = null;
      continue;
    }
    if (!inPaths) continue;
    const pathMatch = /^ {2}(\/\S*):\s*$/.exec(line);
    if (pathMatch) {
      currentPath = pathMatch[1].replace(/\{(\w+)\}/g, ':$1');
      continue;
    }
    const methodMatch = /^ {4}(\w+):/.exec(line);
    if (currentPath && methodMatch && METHODS.includes(methodMatch[1])) {
      routes.add(`${methodMatch[1].toUpperCase()} ${currentPath}`);
    }
  }
  return routes;
}

function routesFromApp() {
  process.env.SANDBOX_JITTER_MS = '0';
  const { createApp } = require('../server/index');
  const app = createApp();
  const routes = new Set();
  const visit = (stack) => {
    for (const layer of stack) {
      if (layer.route && typeof layer.route.path === 'string') {
        for (const method of Object.keys(layer.route.methods)) {
          if (method === '_all') continue;
          routes.add(`${method.toUpperCase()} ${layer.route.path}`);
        }
      } else if (layer.handle && Array.isArray(layer.handle.stack)) {
        visit(layer.handle.stack);
      }
    }
  };
  visit(app.router.stack);
  return new Set([...routes].filter((r) => r.split(' ')[1].startsWith('/api/') && !r.includes('*')));
}

const spec = routesFromSpec(fs.readFileSync(specFile, 'utf8'));
const served = routesFromApp();
const missing = [...spec].filter((r) => !served.has(r)).sort();
const undocumented = [...served].filter((r) => !spec.has(r)).sort();

console.log(`OpenAPI routes: ${spec.size}, served /api routes: ${served.size}`);
for (const r of [...spec].sort()) console.log(`  ${served.has(r) ? 'ok     ' : 'MISSING'} ${r}`);
for (const r of undocumented) console.log(`  EXTRA   ${r} (served, not in the OpenAPI file)`);

if (missing.length || undocumented.length) {
  console.error(`\nMismatch: ${missing.length} missing, ${undocumented.length} undocumented.`);
  process.exit(1);
}
console.log('\nOpenAPI file and server routes match.');
