import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Bindings } from '../api'; // Import shared Bindings
import { mcpService } from '../mcp/service'; // Corrected path: Import from new location

const baseRoutes = new Hono<{ Bindings: Bindings }>();

// Handler for /
baseRoutes.get('/', (c) => c.text('Hello World'));

// Handler for /health
baseRoutes.get('/health', async (c: Context<{ Bindings: Bindings }>) => {
  await mcpService.waitForReady(); // Use the imported service instance
  const toolCount = mcpService.getToolRegistry().list().length;

  // Simplified health check for worker environment
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    mcp: {
      ready: mcpService.isReady(),
      tools: toolCount,
    },
  });
});

export default baseRoutes;
