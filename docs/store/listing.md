# Chrome Web Store — SessionGuard Listing

---

## Short description (132 chars max)

Keeps your Westlaw, LexisNexis, Bloomberg Law, and PACER sessions alive automatically. No more re-logging in.

---

## Full description

SessionGuard silently keeps your legal research platform sessions alive — so you never lose your place mid-research because of an inactivity timeout.

HOW IT WORKS

SessionGuard runs as a Chrome background service worker and sends small keepalive pings to your platform's session endpoint at a configurable interval (3–15 minutes). This resets the platform's inactivity timer without interrupting your workflow.

No configuration required. SessionGuard automatically detects the correct keepalive endpoint by watching your network traffic after you first log in.

SUPPORTED PLATFORMS

Free:
• Westlaw (westlaw.com, westlaw.co.uk)

Pro (coming soon):
• LexisNexis (lexisnexis.com, advance.lexis.com)
• Bloomberg Law (bloomberglaw.com)
• PACER (pacer.gov and all uscourts.gov sub-domains)

FEATURES

• Automatic keepalives — fires silently every few minutes in the background
• Smart endpoint detection — no manual setup; works from first login
• Session stats — see how many timeouts were prevented and when the last keepalive fired, right in the popup
• Adjustable interval — set anywhere from 3 to 15 minutes to match your platform's timeout window
• Secure by design — your credentials never leave your browser; SessionGuard replays already-authenticated requests, never login forms
• Lightweight — runs as a background service worker with zero impact on page load or browser performance

PRIVACY

SessionGuard never stores or transmits your passwords, usernames, or login credentials. It replays small network requests that your browser has already made and authenticated. All preferences are stored locally in your browser using chrome.storage.local and are never sent to any server.

FREQUENTLY ASKED QUESTIONS

Will my institution know I'm using SessionGuard?
SessionGuard sends the same keepalive requests your browser would send during normal activity. From the platform's perspective, it looks like you are simply staying active. It does not circumvent authentication or access controls.

Does it work if I'm not actively using the tab?
Yes. SessionGuard runs as a Chrome service worker and fires keepalives even when the tab is in the background, as long as Chrome is running.

Can I turn it off?
Yes. Use the toggle in the extension popup to disable SessionGuard at any time.

Does it store my password?
No. SessionGuard never stores passwords or login credentials of any kind. It replays small, already-authenticated network requests using cookies and tokens already present in your browser session.

---

## Permission justifications

### webRequest
SessionGuard monitors outgoing network requests on supported legal research platform domains (Westlaw, LexisNexis, Bloomberg Law, PACER) to automatically detect each platform's session keepalive endpoint. This detection is required because each platform uses a different internal URL for activity signalling — there is no configuration-free alternative. The extension reads only request URLs and methods; it never reads, modifies, or blocks requests or response bodies.

### storage
SessionGuard stores user preferences locally using chrome.storage.local — specifically the keepalive interval (3–15 minutes) and the enabled/disabled state. On the Pro tier, the activation email is stored locally to persist the subscription status across browser restarts. No data is transmitted to external servers as part of storage operations.

### alarms
SessionGuard uses the Chrome Alarms API to schedule periodic keepalive pings at the user-configured interval. The Alarms API is required because it is the only reliable mechanism for scheduling recurring background work in a Manifest V3 service worker — setTimeout and setInterval are not guaranteed to persist across service worker sleep/wake cycles.

### tabs
SessionGuard queries the currently active tab to determine which supported legal research platform (if any) the user has open, and applies the appropriate keepalive strategy for that platform. Tab metadata (URL) is accessed only for the active tab in the current window and is never stored, transmitted, or used for any purpose other than platform detection.

---

## Category

Productivity

## Language

English

## Website

https://aydinbattaglia.github.io/SessionGuard/
