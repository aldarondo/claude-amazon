# claude-amazon ROADMAP

## [Human] Prerequisites
- [ ] Run `npm install` in the project folder
- [ ] Run `npx playwright install chromium`
- [ ] On first tool call: log in to Amazon in the browser window that opens

## [Code] ✅ Completed — 2026-04-19
- [x] `src/browser.js` — launchBrowser, closeBrowser, ensureLoggedIn
- [x] `src/api.js` — searchProducts, getProductDetails, viewCart, addToCart
- [x] `src/index.js` — MCP server with 4 tools
- [x] package.json, .gitignore, .env.example, CLAUDE.md

## Backlog
- [x] `[Code]` 2026-04-19 — Persist browser cookies/session to `amazon-session.json`; restored on startup; saved after each successful login check
- [ ] Handle CAPTCHA detection: pause and notify user in Claude chat
- [ ] `place_order` tool (checkout flow — high risk, needs confirmation guard)
- [ ] Support multiple Amazon locales (.co.uk, .ca, etc.)
- [ ] `track_orders` tool — navigate to order history
