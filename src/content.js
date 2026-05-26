(() => {
  const POLL_MS = 2000;

  // Modal selectors per platform domain suffix
  const CONFIGS = {
    'westlaw.com': {
      modal: ['#timeout-warning', '.session-timeout-modal', '.cobalt-session-timeout', '[data-testid="timeout-modal"]'],
      dismiss: ['#continueSession', '.continue-session-btn', '[data-testid="continue-session"]', 'button[data-id="continueSession"]'],
    },
    'lexisnexis.com': {
      modal: ['.session-expiry-modal', '#sessionExpiryModal', '.lds-session-timeout'],
      dismiss: ['.stay-logged-in', '#stayLoggedIn', 'button.continue'],
    },
    'lexis.com': {
      modal: ['.session-expiry-modal', '#sessionExpiryModal'],
      dismiss: ['.stay-logged-in', '#stayLoggedIn'],
    },
    'bloomberglaw.com': {
      modal: ['.timeout-dialog', '#timeoutDialog', '[data-testid="session-timeout"]'],
      dismiss: ['.extend-session', '#extendSession', 'button[data-action="extend"]'],
    },
    'pacer.gov': {
      modal: ['#session-warning', '.session-warning', '#timeout-modal'],
      dismiss: ['#extend-session', '.extend-session-btn', 'input[value="Continue"]'],
    },
    'uscourts.gov': {
      modal: ['#session-warning', '.session-warning'],
      dismiss: ['#extend-session', 'input[value="Continue"]'],
    },
  };

  const hostname = location.hostname.replace(/^www\./, '');

  function getConfig() {
    for (const [domain, cfg] of Object.entries(CONFIGS)) {
      if (hostname === domain || hostname.endsWith('.' + domain)) return cfg;
    }
    return null;
  }

  const config = getConfig();
  if (!config) return;

  function isVisible(el) {
    const s = window.getComputedStyle(el);
    return s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0';
  }

  function tryDismissModal() {
    for (const sel of config.modal) {
      const modal = document.querySelector(sel);
      if (!modal || !isVisible(modal)) continue;

      // Notify background
      chrome.runtime.sendMessage({ type: 'MODAL_DETECTED', hostname }).catch(() => {});

      // Try configured dismiss selectors
      for (const dSel of config.dismiss) {
        const btn = modal.querySelector(dSel) ?? document.querySelector(dSel);
        if (btn) { btn.click(); return; }
      }

      // Fallback: any button/link with continue/extend/stay in text
      const candidates = modal.querySelectorAll('button, a[role="button"], input[type="button"], input[type="submit"]');
      for (const el of candidates) {
        const text = (el.textContent ?? el.value ?? '').toLowerCase();
        if (/continue|extend|stay|keep/i.test(text)) { el.click(); return; }
      }
    }
  }

  // MutationObserver for fast modal detection
  const observer = new MutationObserver(tryDismissModal);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style', 'class', 'hidden'],
  });

  // Polling fallback
  const poll = setInterval(tryDismissModal, POLL_MS);

  window.addEventListener('pagehide', () => {
    observer.disconnect();
    clearInterval(poll);
  });
})();
