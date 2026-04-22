import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { launchBrowser, closeBrowser, ensureLoggedIn } from './browser.js';
import { searchProducts, getProductDetails, viewCart, addToCart } from './api.js';

// ---------------------------------------------------------------------------
// Browser state — single shared session for the lifetime of the MCP server
// ---------------------------------------------------------------------------
let browser = null;
let page = null;
let context = null;

async function getBrowserSession() {
  if (!browser) {
    ({ browser, page, context } = await launchBrowser());
  }
  return { browser, page, context };
}

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------
const server = new Server(
  {
    name: 'claude-amazon',
    version: '1.0.0',
    description:
      'Amazon shopping assistant via browser automation. ' +
      'Requires manual login to Amazon in the browser window that opens.',
  },
  {
    capabilities: { tools: {} },
  }
);

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'search_products',
      description:
        'Search Amazon for products. Returns ASIN, title, price, rating, review count, URL, and image URL. ' +
        'A browser window will open — log in to Amazon if prompted.',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query, e.g. "standing desk" or "coffee beans"',
          },
          limit: {
            type: 'number',
            description: 'Max number of results to return (default 10)',
          },
        },
        required: ['query'],
      },
    },
    {
      name: 'get_product_details',
      description: 'Get full details for a specific Amazon product by ASIN.',
      inputSchema: {
        type: 'object',
        properties: {
          asin: {
            type: 'string',
            description: 'Amazon Standard Identification Number, e.g. "B08N5WRWNW"',
          },
        },
        required: ['asin'],
      },
    },
    {
      name: 'view_cart',
      description: 'View the current Amazon cart contents.',
      inputSchema: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
    {
      name: 'add_to_cart',
      description: 'Add a product to the Amazon cart by ASIN.',
      inputSchema: {
        type: 'object',
        properties: {
          asin: {
            type: 'string',
            description: 'Amazon Standard Identification Number of the product to add',
          },
        },
        required: ['asin'],
      },
    },
  ],
}));

// ---------------------------------------------------------------------------
// Tool handlers
// ---------------------------------------------------------------------------
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    const { page: p, context: ctx } = await getBrowserSession();

    switch (name) {
      case 'search_products': {
        await ensureLoggedIn(p, ctx);
        const results = await searchProducts(p, args.query, args.limit ?? 10);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(results, null, 2),
            },
          ],
        };
      }

      case 'get_product_details': {
        await ensureLoggedIn(p, ctx);
        const details = await getProductDetails(p, args.asin);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(details, null, 2),
            },
          ],
        };
      }

      case 'view_cart': {
        await ensureLoggedIn(p, ctx);
        const items = await viewCart(p);
        return {
          content: [
            {
              type: 'text',
              text: items.length
                ? JSON.stringify(items, null, 2)
                : 'Your cart is empty.',
            },
          ],
        };
      }

      case 'add_to_cart': {
        await ensureLoggedIn(p, ctx);
        const result = await addToCart(p, args.asin);
        return {
          content: [
            {
              type: 'text',
              text: result.message,
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------
process.on('SIGINT', async () => {
  if (browser) await closeBrowser(browser);
  process.exit(0);
});

process.on('SIGTERM', async () => {
  if (browser) await closeBrowser(browser);
  process.exit(0);
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
const transport = new StdioServerTransport();
await server.connect(transport);
console.error('claude-amazon MCP server running. A browser window will open on first tool call.');
