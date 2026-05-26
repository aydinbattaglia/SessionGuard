// Platform registry — imported by background.js (ES module context only)

export const PLATFORMS = {
  mock: {
    name: 'Mock (localhost)',
    domains: ['localhost'],
    tier: 'free',
    knownHeartbeatPaths: ['/api/session/ping'],
    modalSelectors: ['#timeout-warning'],
    dismissSelectors: ['#continueSession'],
  },
  westlaw: {
    name: 'Westlaw',
    domains: ['westlaw.com', 'westlaw.co.uk', 'lawschool.westlaw.com'],
    tier: 'free',
    knownHeartbeatPaths: ['/app/heartbeat', '/cobalt/api/session', '/api/session/ping'],
    modalSelectors: [
      '#timeout-warning',
      '.session-timeout-modal',
      '.cobalt-session-timeout',
      '[data-testid="timeout-modal"]',
    ],
    dismissSelectors: [
      '#continueSession',
      '.continue-session-btn',
      '[data-testid="continue-session"]',
      'button[data-id="continueSession"]',
    ],
  },
  lexisnexis: {
    name: 'LexisNexis',
    domains: ['lexisnexis.com', 'advance.lexis.com', 'signin.lexisnexis.com'],
    tier: 'paid',
    knownHeartbeatPaths: ['/api/user/ping', '/auth/keepalive', '/session/heartbeat'],
    modalSelectors: ['.session-expiry-modal', '#sessionExpiryModal', '.lds-session-timeout'],
    dismissSelectors: ['.stay-logged-in', '#stayLoggedIn', 'button.continue'],
  },
  bloomberglaw: {
    name: 'Bloomberg Law',
    domains: ['bloomberglaw.com'],
    tier: 'paid',
    knownHeartbeatPaths: ['/api/session/keepalive', '/session/ping'],
    modalSelectors: ['.timeout-dialog', '#timeoutDialog', '[data-testid="session-timeout"]'],
    dismissSelectors: ['.extend-session', '#extendSession', 'button[data-action="extend"]'],
  },
  pacer: {
    name: 'PACER',
    domains: ['pacer.gov', 'pacer.uscourts.gov'],
    tier: 'paid',
    knownHeartbeatPaths: ['/cgi-bin/ping.pl', '/session/keepalive'],
    modalSelectors: ['#session-warning', '.session-warning', '#timeout-modal'],
    dismissSelectors: ['#extend-session', '.extend-session-btn', 'input[value="Continue"]'],
  },
};

export function getPlatformByDomain(hostname) {
  const h = hostname.replace(/^www\./, '');
  for (const [key, platform] of Object.entries(PLATFORMS)) {
    if (platform.domains.some(d => h === d || h.endsWith('.' + d))) {
      return { key, ...platform };
    }
  }
  return null;
}
