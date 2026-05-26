import { PLATFORMS, getPlatformByDomain } from './platforms.js';

const DEFAULT_INTERVAL = 8;
const DETECTION_WINDOW_MS = 5 * 60_000;
const MIN_REPEATS = 2;
const MAX_RESPONSE_BYTES = 2048;
const ALARM_PREFIX = 'sg-keepalive-';

// In-memory tracking (reset on service worker restart; endpoints persist in storage)
const pendingRequests = new Map(); // requestId -> { url, method, headers, timestamp }
const requestLog = new Map();      // platformKey -> [{ url, method, headers, timestamp }]

// === Lifecycle ===

chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.local.get(null);
  const defaults = {
    endpoints: {},
    prefs: { enabled: true, intervalMinutes: DEFAULT_INTERVAL },
    license: { tier: 'free', key: null },
    stats: {},
  };
  await chrome.storage.local.set({ ...defaults, ...existing });
  await scheduleAlarmsFromStorage();
});

chrome.runtime.onStartup.addListener(scheduleAlarmsFromStorage);

async function scheduleAlarmsFromStorage() {
  const { endpoints, prefs } = await chrome.storage.local.get(['endpoints', 'prefs']);
  if (!prefs?.enabled) return;
  const interval = prefs.intervalMinutes ?? DEFAULT_INTERVAL;
  for (const platformKey of Object.keys(endpoints ?? {})) {
    await ensureAlarm(platformKey, interval);
  }
}

async function ensureAlarm(platformKey, intervalMinutes) {
  const name = ALARM_PREFIX + platformKey;
  const existing = await chrome.alarms.get(name);
  if (!existing) {
    chrome.alarms.create(name, { delayInMinutes: intervalMinutes, periodInMinutes: intervalMinutes });
  }
}

// === Network Observation (top-level — survives service worker suspension) ===

const PLATFORM_URL_PATTERNS = [
  'https://*.westlaw.com/*',
  'https://*.lexisnexis.com/*',
  'https://advance.lexis.com/*',
  'https://*.bloomberglaw.com/*',
  'https://pacer.gov/*',
  'https://*.pacer.gov/*',
  'https://*.uscourts.gov/*',
];

chrome.webRequest.onBeforeSendHeaders.addListener(
  ({ requestId, url, method, requestHeaders }) => {
    if (!isHeartbeatCandidate(url)) return;
    const relevant = (requestHeaders ?? []).filter(({ name }) => {
      const n = name.toLowerCase();
      return n === 'authorization' || n === 'x-csrf-token' || n === 'x-auth-token';
    });
    pendingRequests.set(requestId, { url, method, headers: relevant, timestamp: Date.now() });
  },
  { urls: PLATFORM_URL_PATTERNS, types: ['xmlhttprequest', 'fetch'] },
  ['requestHeaders', 'extraHeaders']
);

chrome.webRequest.onCompleted.addListener(
  ({ requestId, statusCode, responseHeaders }) => {
    const pending = pendingRequests.get(requestId);
    pendingRequests.delete(requestId);
    if (!pending || statusCode < 200 || statusCode >= 300) return;

    const contentLength = responseHeaders?.find(h => h.name.toLowerCase() === 'content-length');
    if (contentLength && parseInt(contentLength.value, 10) > MAX_RESPONSE_BYTES) return;

    const hostname = new URL(pending.url).hostname;
    const platform = getPlatformByDomain(hostname);
    if (!platform) return;

    const log = requestLog.get(platform.key) ?? [];
    const cutoff = Date.now() - DETECTION_WINDOW_MS;
    const pruned = log.filter(e => e.timestamp > cutoff);
    pruned.push(pending);
    requestLog.set(platform.key, pruned);

    analyzeForHeartbeat(platform.key, pruned);
  },
  { urls: PLATFORM_URL_PATTERNS, types: ['xmlhttprequest', 'fetch'] },
  ['responseHeaders']
);

function isHeartbeatCandidate(url) {
  try {
    const { pathname } = new URL(url);
    if (/\.(js|css|png|jpg|gif|ico|woff2?|ttf|svg)(\?|$)/i.test(pathname)) return false;
    if (/^\/(search|document|content|static|assets)/i.test(pathname)) return false;
    return true;
  } catch {
    return false;
  }
}

async function analyzeForHeartbeat(platformKey, log) {
  // Group by normalized URL, find any URL that repeats >= MIN_REPEATS times
  const counts = new Map();
  for (const entry of log) {
    const key = normalizeUrl(entry.url);
    const existing = counts.get(key);
    if (!existing) { counts.set(key, entry); continue; }
    if (log.filter(e => normalizeUrl(e.url) === key).length >= MIN_REPEATS) {
      await persistEndpoint(platformKey, entry);
      return;
    }
  }

  // Also check against known heartbeat paths for this platform
  const platform = PLATFORMS[platformKey];
  if (!platform) return;
  for (const entry of log) {
    const { pathname } = new URL(entry.url);
    if (platform.knownHeartbeatPaths.some(p => pathname.startsWith(p))) {
      await persistEndpoint(platformKey, entry);
      return;
    }
  }
}

function normalizeUrl(url) {
  try {
    const u = new URL(url);
    for (const p of ['t', 'ts', 'timestamp', 'nonce', '_', 'rand', 'cb']) {
      u.searchParams.delete(p);
    }
    return u.origin + u.pathname + (u.searchParams.toString() ? '?' + u.searchParams : '');
  } catch {
    return url;
  }
}

async function persistEndpoint(platformKey, entry) {
  const { endpoints, prefs } = await chrome.storage.local.get(['endpoints', 'prefs']);
  const existing = endpoints[platformKey];
  if (existing && normalizeUrl(existing.url) === normalizeUrl(entry.url)) {
    existing.lastDetected = Date.now();
    await chrome.storage.local.set({ endpoints });
    return;
  }
  endpoints[platformKey] = {
    url: entry.url,
    method: entry.method,
    headers: entry.headers,
    lastDetected: Date.now(),
  };
  await chrome.storage.local.set({ endpoints });
  await ensureAlarm(platformKey, prefs?.intervalMinutes ?? DEFAULT_INTERVAL);
  refreshBadges();
}

// === Keepalive ===

chrome.alarms.onAlarm.addListener(async ({ name }) => {
  if (!name.startsWith(ALARM_PREFIX)) return;
  const platformKey = name.slice(ALARM_PREFIX.length);
  await fireKeepalive(platformKey);
});

async function fireKeepalive(platformKey) {
  const { endpoints, prefs, license, stats } = await chrome.storage.local.get([
    'endpoints', 'prefs', 'license', 'stats',
  ]);

  if (!prefs?.enabled) return;

  const platform = PLATFORMS[platformKey];
  if (!platform) return;

  if (platform.tier === 'paid' && license?.tier !== 'pro') return;

  const endpoint = endpoints?.[platformKey];
  if (!endpoint) return;

  let ok = false;
  try {
    const res = await fetch(endpoint.url, {
      method: endpoint.method ?? 'GET',
      credentials: 'include',
      headers: Object.fromEntries((endpoint.headers ?? []).map(h => [h.name, h.value])),
    });
    ok = res.ok;

    if (res.status === 401) {
      // Session has actually expired — clear stored endpoint so re-detection fires next visit
      delete endpoints[platformKey];
      await chrome.storage.local.set({ endpoints });
      chrome.alarms.clear(ALARM_PREFIX + platformKey);
    }
  } catch {
    // Network error or CORS — not actionable here
  }

  const now = Date.now();
  const platformStats = stats?.[platformKey] ?? { sessionsKept: 0 };
  if (ok) platformStats.sessionsKept += 1;
  platformStats.lastKeepalive = now;
  await chrome.storage.local.set({ stats: { ...(stats ?? {}), [platformKey]: platformStats } });

  refreshBadges();
}

// === Badge ===

async function refreshBadges() {
  const tabs = await chrome.tabs.query({ url: PLATFORM_URL_PATTERNS });
  const { endpoints } = await chrome.storage.local.get('endpoints');
  for (const tab of tabs) {
    try {
      const platform = getPlatformByDomain(new URL(tab.url).hostname);
      if (!platform) continue;
      const status = endpoints?.[platform.key] ? 'active' : 'detecting';
      setBadge(tab.id, status);
    } catch {}
  }
}

function setBadge(tabId, status) {
  const styles = {
    active:    { color: '#22c55e', text: '' },
    detecting: { color: '#f59e0b', text: '' },
    inactive:  { color: '#9ca3af', text: '' },
  };
  const s = styles[status] ?? styles.inactive;
  const target = tabId != null ? { tabId } : {};
  chrome.action.setBadgeBackgroundColor({ color: s.color, ...target });
  chrome.action.setBadgeText({ text: s.text, ...target });
}

// === Tab events ===

chrome.tabs.onUpdated.addListener(async (tabId, { status }, tab) => {
  if (status !== 'complete' || !tab.url) return;
  try {
    const platform = getPlatformByDomain(new URL(tab.url).hostname);
    if (!platform) { setBadge(tabId, 'inactive'); return; }
    const { endpoints } = await chrome.storage.local.get('endpoints');
    setBadge(tabId, endpoints?.[platform.key] ? 'active' : 'detecting');
  } catch {}
});

// === Message bus ===

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg.type === 'GET_STATUS') {
    buildStatus(sender.tab?.id).then(reply);
    return true;
  }
  if (msg.type === 'SET_PREF') {
    applyPref(msg.key, msg.value).then(reply);
    return true;
  }
});

async function buildStatus(tabId) {
  const { endpoints, prefs, license, stats } = await chrome.storage.local.get([
    'endpoints', 'prefs', 'license', 'stats',
  ]);

  let activePlatform = null;
  if (tabId != null) {
    try {
      const tab = await chrome.tabs.get(tabId);
      const p = getPlatformByDomain(new URL(tab.url).hostname);
      if (p) activePlatform = p.key;
    } catch {}
  }

  const platforms = Object.fromEntries(
    Object.entries(PLATFORMS).map(([key, p]) => [key, {
      name: p.name,
      tier: p.tier,
      hasEndpoint: !!endpoints?.[key],
      lastKeepalive: stats?.[key]?.lastKeepalive ?? null,
      sessionsKept: stats?.[key]?.sessionsKept ?? 0,
    }])
  );

  return {
    activePlatform,
    platforms,
    prefs: prefs ?? { enabled: true, intervalMinutes: DEFAULT_INTERVAL },
    license: license ?? { tier: 'free' },
  };
}

async function applyPref(key, value) {
  const { prefs } = await chrome.storage.local.get('prefs');
  const updated = { ...(prefs ?? {}), [key]: value };
  await chrome.storage.local.set({ prefs: updated });

  if (key === 'intervalMinutes') {
    const { endpoints } = await chrome.storage.local.get('endpoints');
    for (const platformKey of Object.keys(endpoints ?? {})) {
      const name = ALARM_PREFIX + platformKey;
      await chrome.alarms.clear(name);
      chrome.alarms.create(name, { delayInMinutes: value, periodInMinutes: value });
    }
  }
  return { ok: true };
}
