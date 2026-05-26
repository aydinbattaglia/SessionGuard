import { vi } from 'vitest';

// Chrome extension API mock — must be set up before any src/ import
global.chrome = {
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn().mockResolvedValue(undefined),
    },
  },
  runtime: {
    onInstalled: { addListener: vi.fn() },
    onStartup:   { addListener: vi.fn() },
    onMessage:   { addListener: vi.fn() },
    sendMessage: vi.fn(),
  },
  alarms: {
    get:    vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    clear:  vi.fn().mockResolvedValue(true),
    onAlarm: { addListener: vi.fn() },
  },
  webRequest: {
    onBeforeSendHeaders: { addListener: vi.fn() },
    onCompleted:         { addListener: vi.fn() },
  },
  tabs: {
    get:     vi.fn(),
    query:   vi.fn().mockResolvedValue([]),
    onUpdated: { addListener: vi.fn() },
    onRemoved: { addListener: vi.fn() },
  },
  action: {
    setBadgeBackgroundColor: vi.fn(),
    setBadgeText:            vi.fn(),
  },
};
