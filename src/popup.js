const PRICING_URL = 'https://sessionguard.io/pricing';

document.addEventListener('DOMContentLoaded', async () => {
  const enableToggle   = document.getElementById('enableToggle');
  const intervalSlider = document.getElementById('intervalSlider');
  const intervalVal    = document.getElementById('intervalVal');
  const platformSection = document.getElementById('platformSection');
  const idleSection    = document.getElementById('idleSection');
  const statusDot      = document.getElementById('statusDot');
  const platformName   = document.getElementById('platformName');
  const lastKeepalive  = document.getElementById('lastKeepalive');
  const sessionsKept   = document.getElementById('sessionsKept');
  const upgradeNotice  = document.getElementById('upgradeNotice');

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const status = await chrome.runtime.sendMessage({ type: 'GET_STATUS', tabId: tab?.id });

  // Prefs
  enableToggle.checked = status.prefs.enabled;
  intervalSlider.value = status.prefs.intervalMinutes;
  intervalVal.textContent = status.prefs.intervalMinutes;

  // Platform section
  if (status.activePlatform) {
    const p = status.platforms[status.activePlatform];
    idleSection.classList.add('hidden');
    platformSection.classList.remove('hidden');
    platformName.textContent = p.name;

    statusDot.className = 'dot ' + (p.hasEndpoint ? 'dot-green' : 'dot-amber');

    if (p.lastKeepalive) {
      const minAgo = Math.round((Date.now() - p.lastKeepalive) / 60_000);
      lastKeepalive.textContent = minAgo < 1 ? 'just now' : `${minAgo}m ago`;
    } else {
      lastKeepalive.textContent = p.hasEndpoint ? 'pending' : 'detecting...';
    }

    if (p.sessionsKept > 0) {
      sessionsKept.textContent =
        `${p.sessionsKept} timeout${p.sessionsKept === 1 ? '' : 's'} prevented`;
    }

    if (p.tier === 'paid' && status.license.tier !== 'pro') {
      upgradeNotice.classList.remove('hidden');
    }
  }

  // Handlers
  enableToggle.addEventListener('change', () => {
    chrome.runtime.sendMessage({ type: 'SET_PREF', key: 'enabled', value: enableToggle.checked });
  });

  intervalSlider.addEventListener('input', () => {
    intervalVal.textContent = intervalSlider.value;
  });

  intervalSlider.addEventListener('change', () => {
    chrome.runtime.sendMessage({
      type: 'SET_PREF',
      key: 'intervalMinutes',
      value: parseInt(intervalSlider.value, 10),
    });
  });

  document.getElementById('upgradeLink')?.addEventListener('click', e => {
    e.preventDefault();
    chrome.tabs.create({ url: PRICING_URL });
  });
});
