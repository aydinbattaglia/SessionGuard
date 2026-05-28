import sharp from 'sharp';
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// Full icon SVG (128px base) — dark navy, gold shield, heartbeat pulse line
const iconFull = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <defs>
    <radialGradient id="glow" cx="50%" cy="35%" r="55%">
      <stop offset="0%" stop-color="#c9a84c" stop-opacity="0.09"/>
      <stop offset="100%" stop-color="#070b12" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- Background -->
  <rect width="128" height="128" rx="26" fill="#070b12"/>
  <rect width="128" height="128" rx="26" fill="url(#glow)"/>

  <!-- Shield fill (subtle) -->
  <path d="M64 108 Q22 89 22 65 L22 29 Q22 21 30 21 L98 21 Q106 21 106 29 L106 65 Q106 89 64 108 Z"
        fill="#c9a84c" fill-opacity="0.10"/>

  <!-- Shield border -->
  <path d="M64 108 Q22 89 22 65 L22 29 Q22 21 30 21 L98 21 Q106 21 106 29 L106 65 Q106 89 64 108 Z"
        fill="none" stroke="#c9a84c" stroke-width="3.5" stroke-linejoin="round"/>

  <!-- Heartbeat / keepalive pulse line -->
  <polyline
    points="34,64 44,64 49,64 53,47 58,79 62,59 66,59 70,69 74,64 94,64"
    fill="none" stroke="#c9a84c" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

// Minimal icon SVG (16px) — solid gold shield, no pulse detail (too small)
const iconMini = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
  <rect width="16" height="16" rx="3" fill="#070b12"/>
  <path d="M8 14 Q2 11 2 8 L2 3.5 Q2 2.5 3 2.5 L13 2.5 Q14 2.5 14 3.5 L14 8 Q14 11 8 14 Z"
        fill="#c9a84c"/>
</svg>`;

async function generate() {
  // 128px
  await sharp(Buffer.from(iconFull)).png().toFile(resolve(root, 'icons/icon128.png'));
  console.log('✓ icons/icon128.png');

  // 48px (scale the full SVG down)
  const svg48 = iconFull.replace('width="128" height="128"', 'width="48" height="48"');
  await sharp(Buffer.from(svg48)).resize(48, 48).png().toFile(resolve(root, 'icons/icon48.png'));
  console.log('✓ icons/icon48.png');

  // 16px (minimal version)
  await sharp(Buffer.from(iconMini)).png().toFile(resolve(root, 'icons/icon16.png'));
  console.log('✓ icons/icon16.png');

  // docs/icon.png — used in the website hero badge (32px looks good there)
  const svg32 = iconFull.replace('width="128" height="128"', 'width="32" height="32"');
  await sharp(Buffer.from(svg32)).resize(32, 32).png().toFile(resolve(root, 'docs/icon.png'));
  console.log('✓ docs/icon.png');
}

generate().catch(err => { console.error(err); process.exit(1); });
