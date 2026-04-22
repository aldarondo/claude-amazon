# claude-amazon

## What this is
MCP server that wraps Amazon.com via **Playwright browser automation**. Amazon has no public shopping API for personal use, so this opens a real Chromium browser window the user can see and interact with.

## Why browser automation
Amazon aggressively blocks scraping and unofficial API access. By using a real browser in headed mode (headless: false), the session looks like a normal human browsing session. The user logs in manually the first time, and the session persists for the lifetime of the MCP server process.

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Install the Chromium browser for Playwright
npx playwright install chromium

# 3. Start the MCP server
npm start
```

## Connecting to Claude Desktop
Add to `~/AppData/Roaming/Claude/claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "amazon": {
      "command": "node",
      "args": ["C:/Users/Aldarondo Family/Documents/Github/claude-amazon/src/index.js"]
    }
  }
}
```

## First use
1. Ask Claude to search for a product.
2. A Chrome window will open and navigate to Amazon.
3. If you see "Hello, sign in" — log in manually.
4. Claude will detect the login state and proceed automatically on the next call.

## Tools exposed
| Tool | Args | Description |
|------|------|-------------|
| `search_products` | query, limit? | Search Amazon, returns up to N results |
| `get_product_details` | asin | Full product info |
| `view_cart` | — | List current cart items |
| `add_to_cart` | asin | Add item to cart |

## Notes
- The browser stays open between tool calls. Close it via Ctrl+C on the server.
- Amazon may occasionally show CAPTCHAs — complete them manually in the browser.
- This is for personal use only; comply with Amazon's Terms of Service.
