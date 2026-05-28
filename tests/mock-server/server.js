#!/usr/bin/env node
// Mock Westlaw server for testing SessionGuard
// Usage: node tests/mock-server/server.js [--timeout=<seconds>]
//
// Default session timeout: 240s (4 min). Platform heartbeat fires every 30s.
// Set extension interval to 3 min in the popup, then pause the platform
// heartbeat on the page to let SessionGuard's keepalive do the work.
//
// REMOVE localhost from manifest.json before submitting to Chrome Web Store.

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const PORT = 3131;
const __dir = path.dirname(fileURLToPath(import.meta.url));

const arg = process.argv.find(a => a.startsWith('--timeout='));
const SESSION_TTL_MS = arg ? parseInt(arg.split('=')[1], 10) * 1000 : 240_000;

// In-memory session store: token -> expiresAt
const sessions = new Map();

// Event log for the page to poll
let eventSeq = 0;
const eventLog = []; // { id, ts, source, status }
const MAX_EVENTS = 100;

function pushEvent(source, status) {
  const entry = { id: ++eventSeq, ts: Date.now(), source, status };
  eventLog.push(entry);
  if (eventLog.length > MAX_EVENTS) eventLog.shift();
  return entry;
}

function detectSource(req) {
  const origin = req.headers.origin ?? '';
  if (origin.startsWith('chrome-extension://')) return 'extension';
  // Service worker fetch may omit Origin entirely
  if (!origin) return 'extension';
  return 'page';
}

function newSession() {
  const token = crypto.randomBytes(16).toString('hex');
  sessions.set(token, Date.now() + SESSION_TTL_MS);
  return token;
}

function getToken(req) {
  const cookie = req.headers.cookie ?? '';
  const match = cookie.match(/sg_session=([a-f0-9]+)/);
  return match?.[1] ?? null;
}

function isValid(token) {
  if (!token || !sessions.has(token)) return false;
  return sessions.get(token) > Date.now();
}

function refreshSession(token) {
  sessions.set(token, Date.now() + SESSION_TTL_MS);
}

function setCookie(res, token) {
  // SameSite=None requires Secure; omit SameSite so Chrome uses Lax default for page requests.
  // The session token is also injected into the page as a meta tag for the extension to pick up.
  res.setHeader('Set-Cookie', `sg_session=${token}; Path=/`);
}

function json(res, status, body, req) {
  // Credentials require a specific origin, not wildcard
  const origin = req?.headers?.origin ?? 'http://localhost:3131';
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Vary': 'Origin',
  });
  res.end(JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // CORS preflight
  if (req.method === 'OPTIONS') {
    const origin = req.headers.origin ?? 'http://localhost:3131';
    res.writeHead(204, {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin',
    });
    return res.end();
  }

  // --- Heartbeat endpoint (what SessionGuard detects and replays) ---
  if (pathname === '/api/session/ping') {
    const token = getToken(req);
    const source = detectSource(req);
    if (!isValid(token)) {
      pushEvent(source, 401);
      return json(res, 401, { error: 'session_expired' }, req);
    }
    refreshSession(token);
    pushEvent(source, 200);
    return json(res, 200, { ok: true }, req);
  }

  // --- Session status (used by the page UI — /ui/ path keeps it out of heartbeat detection) ---
  if (pathname === '/ui/timer') {
    const token = getToken(req);
    if (!isValid(token)) return json(res, 200, { active: false, expiresIn: 0 }, req);
    const expiresIn = Math.max(0, Math.round((sessions.get(token) - Date.now()) / 1000));
    return json(res, 200, { active: true, expiresIn, ttl: SESSION_TTL_MS / 1000 }, req);
  }

  // --- Event log (page polls this to see extension keepalives) ---
  if (pathname === '/ui/events') {
    const since = parseInt(url.searchParams.get('since') ?? '0', 10);
    const events = eventLog.filter(e => e.id > since);
    return json(res, 200, { events, latest: eventSeq }, req);
  }

  // --- Force-expire (test control) ---
  if (pathname === '/api/session/expire' && req.method === 'POST') {
    const token = getToken(req);
    if (token) sessions.set(token, 0);
    return json(res, 200, { ok: true }, req);
  }

  // --- Main page ---
  if (pathname === '/') {
    let token = getToken(req);
    if (!isValid(token)) token = newSession();
    setCookie(res, token);

    const html = fs.readFileSync(path.join(__dir, 'page.html'), 'utf8')
      .replace('{{TTL}}', SESSION_TTL_MS / 1000);

    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(html);
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`SessionGuard mock server running at http://localhost:${PORT}`);
  console.log(`Session timeout: ${SESSION_TTL_MS / 1000}s`);
  console.log('Open http://localhost:3131 in Chrome with the extension loaded.');
});
