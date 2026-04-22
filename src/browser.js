import { chromium } from 'playwright';
import { existsSync, writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SESSION_FILE = join(__dirname, '..', 'amazon-session.json');

/**
 * Launch a Chromium browser in headed mode so the user can see and interact.
 * Restores a saved session if amazon-session.json exists.
 * @returns {{ browser: Browser, page: Page, context: BrowserContext }}
 */
export async function launchBrowser() {
  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized'],
  });

  const contextOptions = {
    viewport: null,
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  };

  if (existsSync(SESSION_FILE)) {
    try {
      const state = JSON.parse(readFileSync(SESSION_FILE, 'utf8'));
      contextOptions.storageState = state;
    } catch {
      // Corrupt session file — start fresh
    }
  }

  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  return { browser, page, context };
}

/**
 * Save the current browser session (cookies + localStorage) to disk.
 * Call this after a successful login so future startups skip the login flow.
 * @param {import('playwright').BrowserContext} context
 */
export async function saveSession(context) {
  const state = await context.storageState();
  writeFileSync(SESSION_FILE, JSON.stringify(state, null, 2));
}

/**
 * Close the browser.
 * @param {import('playwright').Browser} browser
 */
export async function closeBrowser(browser) {
  await browser.close();
}

/**
 * Verify the user is logged in to Amazon.
 * Navigates to amazon.com and checks the account nav link.
 * If logged in successfully, saves the session to disk for future use.
 * Throws if not logged in.
 * @param {import('playwright').Page} page
 * @param {import('playwright').BrowserContext} context
 */
export async function ensureLoggedIn(page, context) {
  await page.goto('https://www.amazon.com', { waitUntil: 'domcontentloaded' });

  await page.waitForTimeout(2000);

  const accountText = await page
    .$eval('#nav-link-accountList .nav-line-1', (el) => el.textContent.trim())
    .catch(() => null);

  if (!accountText || accountText.toLowerCase().includes('sign in')) {
    throw new Error(
      'Not logged in to Amazon. Please log in manually in the browser window and retry.'
    );
  }

  // Persist the authenticated session so next startup skips login
  if (context) {
    await saveSession(context);
  }
}
