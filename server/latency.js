'use strict';

// Simulated network latency for local runs: most responses
// come back at once, the rest take up to SANDBOX_JITTER_MS.
// SANDBOX_JITTER_MS=0 turns it off.

const settings = require('./settings');

function latencyMs() {
  const max = settings.jitterMs;
  if (!max) return 0;
  return Math.random() < 0.75 ? 0 : Math.round(max * Math.random());
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function networkLatency() {
  return wait(latencyMs());
}

module.exports = { networkLatency, wait };
