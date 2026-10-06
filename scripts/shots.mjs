// Screenshots of routes at three widths in light and dark, written to .screens/.
// Usage: npm run shots -- / /about
// Uses a server already running on SHOTS_URL (default http://localhost:3000),
// otherwise starts `next dev` on port 3100 and stops it afterwards.
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const WIDTHS = [390, 834, 1440];
const THEMES = ['light', 'dark'];
const OUT = '.screens';

const routes = process.argv.slice(2);
if (routes.length === 0) {
  console.error('Usage: npm run shots -- <route> [...]');
  process.exit(1);
}

async function isUp(url) {
  try {
    const res = await fetch(url);
    return res.ok;
  } catch {
    return false;
  }
}

async function waitFor(url, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await isUp(url)) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Server at ${url} did not start within ${ms} ms`);
}

function fileName(route, width, theme) {
  const slug = route.replace(/^\/+|\/+$/g, '').replace(/[^a-zA-Z0-9]+/g, '-') || 'home';
  return `${OUT}/${slug}-${width}-${theme}.png`;
}

let base = process.env.SHOTS_URL ?? 'http://localhost:3000';
let server = null;
if (!(await isUp(base))) {
  base = 'http://localhost:3100';
  server = spawn('npx', ['next', 'dev', '--port', '3100'], { stdio: 'ignore', detached: true });
  await waitFor(base, 120_000);
}

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
try {
  for (const route of routes) {
    for (const theme of THEMES) {
      for (const width of WIDTHS) {
        const page = await browser.newPage({
          viewport: { width, height: 900 },
          colorScheme: theme,
        });
        await page.goto(new URL(route, base).toString(), { waitUntil: 'networkidle' });
        // Pages that query the engine mark their progress line data-loading.
        await page
          .waitForFunction(() => !document.querySelector('[data-loading]'), null, {
            timeout: 60_000,
          })
          .catch(() => console.warn(`still loading after 60 s: ${route} ${width} ${theme}`));
        const path = fileName(route, width, theme);
        await page.screenshot({ path, fullPage: true });
        await page.close();
        console.log(path);
      }
    }
  }
} finally {
  await browser.close();
  // Kill the whole process group: npx leaves next dev running otherwise.
  if (server) process.kill(-server.pid);
}
