import * as dotenv from 'dotenv';
dotenv.config();

import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { router } from './routes';

/**
 * Create and configure the Hono application
 */
const app = new Hono();

// Add CORS middleware
app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Accept', 'x-api-key'],
    exposeHeaders: ['Content-Type'],
    maxAge: 86400,
  }),
);

// Logging and error handling middleware
app.use('*', async (c, next) => {
  console.log(`Request: ${c.req.method} ${c.req.url}`);
  try {
    await next();
  } catch (error) {
    console.error('Error processing request:', error);
    return c.json({ error: 'Internal Server Error' }, 500);
  }
});

app.route('/', router);

// Start the server
const port = Number(process.env.PORT) || 4200;
console.log(`MCP Server is starting on port ${port}...`);

serve({
  port,
  fetch: app.fetch,
});
