const API_URL = 'https://api.sessionguard.io';
const MANAGE_URL = 'https://billing.stripe.com/p/login/sessionguard';

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
  const activateSection = document.getElementById('activateSection');
  const activateToggle = document.getElementById('activateToggle');
  const activateEmail  = document.getElementById('activateEmail');
  const activateBtn    = document.getElementById('activateBtn');
  const activateMsg    = document.getElementById('activateMsg');
  const proSection     = document.getElementById('proSection');

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

    function renderKeepalive() {
      if (p.lastKeepalive) {
        const secsAgo = Math.round((Date.now() - p.lastKeepalive) / 1000);
        if (secsAgo < 60) {
          lastKeepalive.textContent = `${secsAgo}s ago`;
        } else {
          const minAgo = Math.round(secsAgo / 60);
          lastKeepalive.textContent = `${minAgo}m ago`;
        }
      } else {
        lastKeepalive.textContent = p.hasEndpoint ? 'pending' : 'detecting...';
      }
    }
    renderKeepalive();
    setInterval(renderKeepalive, 5000);

    if (p.sessionsKept > 0) {
      sessionsKept.textContent =
        `${p.sessionsKept} timeout${p.sessionsKept === 1 ? '' : 's'} prevented`;
    }

    if (p.tier === 'paid' && status.license.tier !== 'pro') {
      upgradeNotice.classList.remove('hidden');
    }
  }

  // License section
  if (status.license.tier === 'pro') {
    proSection.classList.remove('hidden');
    upgradeNotice.classList.add('hidden');
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

  document.getElementById('upgradeMonthly')?.addEventListener('click', e => {
    e.preventDefault();
    openCheckout('monthly');
  });

  document.getElementById('upgradeAnnual')?.addEventListener('click', e => {
    e.preventDefault();
    openCheckout('annual');
  });

  activateToggle?.addEventListener('click', e => {
    e.preventDefault();
    activateSection.classList.toggle('hidden');
    if (!activateSection.classList.contains('hidden')) activateEmail.focus();
  });

  activateBtn?.addEventListener('click', () => activateLicense());

  activateEmail?.addEventListener('keydown', e => {
    if (e.key === 'Enter') activateLicense();
  });

  document.getElementById('manageLink')?.addEventListener('click', e => {
    e.preventDefault();
    chrome.tabs.create({ url: MANAGE_URL });
  });

  async function openCheckout(plan) {
    try {
      const res = await fetch(`${API_URL}/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const { url, error } = await res.json();
      if (error) throw new Error(error);
      chrome.tabs.create({ url });
    } catch (err) {
      console.error('[SG] checkout error:', err.message);
    }
  }

  async function activateLicense() {
    const email = activateEmail.value.trim().toLowerCase();
    if (!email) return;

    activateBtn.disabled = true;
    activateBtn.textContent = '...';
    activateMsg.classList.add('hidden');

    try {
      const res = await fetch(`${API_URL}/verify?email=${encodeURIComponent(email)}`);
      const { active, tier } = await res.json();

      if (active) {
        await chrome.storage.local.set({ license: { tier, email } });
        proSection.classList.remove('hidden');
        upgradeNotice.classList.add('hidden');
        activateSection.classList.add('hidden');
        chrome.runtime.sendMessage({ type: 'SET_PREF', key: 'enabled', value: true });
      } else {
        showMsg('No active subscription found for that email.', 'error');
      }
    } catch {
      showMsg('Could not verify — check your connection.', 'error');
    } finally {
      activateBtn.disabled = false;
      activateBtn.textContent = 'Activate';
    }
  }

  function showMsg(text, type) {
    activateMsg.textContent = text;
    activateMsg.className = `activate-msg activate-msg-${type}`;
    activateMsg.classList.remove('hidden');
  }
});
