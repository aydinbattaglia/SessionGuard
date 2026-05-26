import { describe, it, expect, vi, beforeEach } from 'vitest';
import { normalizeUrl, isHeartbeatCandidate, buildStatus, fireKeepalive } from '../src/background.js';

beforeEach(() => {
  vi.clearAllMocks();
  chrome.storage.local.set.mockResolvedValue(undefined);
  chrome.alarms.get.mockResolvedValue(null);
  chrome.alarms.clear.mockResolvedValue(true);
  chrome.tabs.query.mockResolvedValue([]);
});

// ---- normalizeUrl ----

describe('normalizeUrl', () => {
  it('strips rotating cache-busting params', () => {
    const url = 'https://westlaw.com/api/ping?t=1234567&q=foo';
    expect(normalizeUrl(url)).toBe('https://westlaw.com/api/ping?q=foo');
  });

  it('strips all known noise params', () => {
    const url = 'https://example.com/hb?ts=1&timestamp=2&nonce=x&_=3&rand=4&cb=5&keep=me';
    expect(normalizeUrl(url)).toBe('https://example.com/hb?keep=me');
  });

  it('returns url unchanged if no noise params', () => {
    const url = 'https://westlaw.com/api/session/ping';
    expect(normalizeUrl(url)).toBe(url);
  });

  it('omits trailing ? when all params stripped', () => {
    const result = normalizeUrl('https://example.com/ping?t=1');
    expect(result).not.toContain('?');
  });

  it('returns original string on invalid URL', () => {
    expect(normalizeUrl('not-a-url')).toBe('not-a-url');
  });
});

// ---- isHeartbeatCandidate ----

describe('isHeartbeatCandidate', () => {
  it('accepts a lightweight API path', () => {
    expect(isHeartbeatCandidate('https://westlaw.com/api/session/ping')).toBe(true);
  });

  it('accepts a path with no file extension', () => {
    expect(isHeartbeatCandidate('https://lexisnexis.com/auth/keepalive')).toBe(true);
  });

  it('rejects JS files', () => {
    expect(isHeartbeatCandidate('https://westlaw.com/static/app.js')).toBe(false);
  });

  it('rejects CSS files', () => {
    expect(isHeartbeatCandidate('https://westlaw.com/styles/main.css?v=1')).toBe(false);
  });

  it('rejects image files', () => {
    expect(isHeartbeatCandidate('https://westlaw.com/img/logo.png')).toBe(false);
    expect(isHeartbeatCandidate('https://westlaw.com/icons/icon.svg')).toBe(false);
  });

  it('rejects /search paths', () => {
    expect(isHeartbeatCandidate('https://westlaw.com/search?q=contracts')).toBe(false);
  });

  it('rejects /document paths', () => {
    expect(isHeartbeatCandidate('https://lexisnexis.com/document/123')).toBe(false);
  });

  it('rejects /static paths', () => {
    expect(isHeartbeatCandidate('https://bloomberglaw.com/static/chunk.js')).toBe(false);
  });

  it('returns false on invalid URL', () => {
    expect(isHeartbeatCandidate('')).toBe(false);
    expect(isHeartbeatCandidate('not-a-url')).toBe(false);
  });
});

// ---- buildStatus ----

describe('buildStatus', () => {
  it('returns default structure when storage is empty', async () => {
    chrome.storage.local.get.mockResolvedValue({
      endpoints: {},
      prefs: { enabled: true, intervalMinutes: 8 },
      license: { tier: 'free' },
      stats: {},
    });

    const status = await buildStatus(null);

    expect(status).toHaveProperty('activePlatform', null);
    expect(status).toHaveProperty('platforms');
    expect(status).toHaveProperty('prefs.enabled', true);
    expect(status).toHaveProperty('license.tier', 'free');
    expect(Object.keys(status.platforms)).toEqual(
      expect.arrayContaining(['westlaw', 'lexisnexis', 'bloomberglaw', 'pacer'])
    );
  });

  it('marks hasEndpoint true for stored platforms', async () => {
    chrome.storage.local.get.mockResolvedValue({
      endpoints: { westlaw: { url: 'https://westlaw.com/ping', method: 'GET' } },
      prefs: { enabled: true, intervalMinutes: 8 },
      license: { tier: 'free' },
      stats: { westlaw: { sessionsKept: 3, lastKeepalive: Date.now() } },
    });

    const status = await buildStatus(null);

    expect(status.platforms.westlaw.hasEndpoint).toBe(true);
    expect(status.platforms.westlaw.sessionsKept).toBe(3);
    expect(status.platforms.lexisnexis.hasEndpoint).toBe(false);
  });

  it('identifies active platform from tab URL', async () => {
    chrome.storage.local.get.mockResolvedValue({
      endpoints: {},
      prefs: { enabled: true, intervalMinutes: 8 },
      license: { tier: 'free' },
      stats: {},
    });
    chrome.tabs.get.mockResolvedValue({ url: 'https://www.westlaw.com/search' });

    const status = await buildStatus(42);

    expect(status.activePlatform).toBe('westlaw');
  });
});

// ---- fireKeepalive ----

describe('fireKeepalive', () => {
  it('skips when disabled', async () => {
    chrome.storage.local.get.mockResolvedValue({
      endpoints: { westlaw: { url: 'https://westlaw.com/ping', method: 'GET' } },
      prefs: { enabled: false, intervalMinutes: 8 },
      license: { tier: 'free' },
      stats: {},
    });

    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true, status: 200 });
    await fireKeepalive('westlaw');
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('skips paid platform when license is free', async () => {
    chrome.storage.local.get.mockResolvedValue({
      endpoints: { lexisnexis: { url: 'https://lexisnexis.com/ping', method: 'GET', headers: [] } },
      prefs: { enabled: true, intervalMinutes: 8 },
      license: { tier: 'free' },
      stats: {},
    });

    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true, status: 200 });
    await fireKeepalive('lexisnexis');
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('fires fetch for free-tier platform (westlaw) on free license', async () => {
    chrome.storage.local.get.mockResolvedValue({
      endpoints: { westlaw: { url: 'https://westlaw.com/api/ping', method: 'GET', headers: [] } },
      prefs: { enabled: true, intervalMinutes: 8 },
      license: { tier: 'free' },
      stats: {},
    });

    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true, status: 200 });
    await fireKeepalive('westlaw');
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://westlaw.com/api/ping',
      expect.objectContaining({ method: 'GET', credentials: 'include' })
    );
    fetchSpy.mockRestore();
  });

  it('fires fetch for paid platform when license is pro', async () => {
    chrome.storage.local.get.mockResolvedValue({
      endpoints: { lexisnexis: { url: 'https://lexisnexis.com/ping', method: 'GET', headers: [] } },
      prefs: { enabled: true, intervalMinutes: 8 },
      license: { tier: 'pro' },
      stats: {},
    });

    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true, status: 200 });
    await fireKeepalive('lexisnexis');
    expect(fetchSpy).toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('clears endpoint and alarm on 401 response', async () => {
    const endpoints = { westlaw: { url: 'https://westlaw.com/ping', method: 'GET', headers: [] } };
    chrome.storage.local.get.mockResolvedValue({
      endpoints,
      prefs: { enabled: true, intervalMinutes: 8 },
      license: { tier: 'free' },
      stats: {},
    });

    vi.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 401 });
    await fireKeepalive('westlaw');

    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({ endpoints: {} })
    );
    expect(chrome.alarms.clear).toHaveBeenCalledWith('sg-keepalive-westlaw');
    vi.restoreAllMocks();
  });
});
