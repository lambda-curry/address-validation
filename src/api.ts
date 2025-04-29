import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { D1Database } from '@cloudflare/workers-types';

// Import route modules
import baseRoutes from './routes/base';
import postalRoutes from './routes/postal';
import mcpRoutes from './routes/mcp';
import adminRoutes from './routes/admin';
import { Resource } from 'sst/resource';

// --- Hono App Setup ---
// Export the Bindings type for use in other modules
export type Bindings = {
  ImportWorker: {
    importCountryData: (country_code: string) => Promise<void>;
  };
};

const app = new Hono<{ Bindings: Bindings }>();

// --- Global Middleware ---

// Logging Middleware
app.use('*', async (c, next) => {
  console.log(`Request: ${c.req.method} ${c.req.url}`);
  try {
    await next();
  } catch (error) {
    console.error('Error processing request:', error);
    // Avoid sending JSON response here if it interferes with Worker error handling
  }
});

// CORS Middleware
app.use(
  '*',
  cors({
    origin: '*', // Configure as needed for production
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Accept', 'x-api-key'],
    exposeHeaders: ['Content-Type'],
    maxAge: 86400,
  }),
);

// API Key Validation Middleware
// Apply this *before* mounting routes that need protection
// Or apply within specific route modules if needed granularly
app.use('*', async (c, next) => {
  // Skip API key check for base routes (/, /health) and the MCP route (/mcp)
  // Use startsWith to cover all sub-paths under /mcp if necessary, but exact match is likely sufficient here.
  const publicPaths = ['/', '/health', '/mcp'];
  if (publicPaths.some((p) => c.req.path === p)) {
    await next();
    return;
  }

  const apiKey = c.req.header('x-api-key') || c.req.query('api_key');

  if (!apiKey || apiKey !== Resource.API_KEY.value) {
    return c.json({ error: 'Invalid or missing API key' }, 401);
  }

  await next();
});

// --- Mount Routes ---
app.route('/', baseRoutes); // Handles / and /health
app.route('/mcp', mcpRoutes); // Handles /sse and /messages
app.route('/postal-code', postalRoutes); // Handles /postal-code/ and /postal-code/:code
app.route('/init', adminRoutes); // Handles admin routes for initializing data

export default app;
