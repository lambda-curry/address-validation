import { Hono } from 'hono';
import { mcpService } from '../mcp/service';
import type { Bindings } from '../api'; // Import shared Bindings
import type { DurableObjectNamespace } from '@cloudflare/workers-types'; // Import DO namespace type

// Extend Bindings to include the DO binding
interface MCPBindings extends Bindings {
  MCP_SESSION_DO: DurableObjectNamespace;
}

// --- Hono Router Setup ---
// Use the extended Bindings type
const mcpRoutes = new Hono<{ Bindings: MCPBindings }>();

const MCP_SSE_PATH = '/sse';
const MCP_MESSAGES_PATH = '/messages';

// --- GET /mcp/sse - Delegate to Durable Object ---
mcpRoutes.get(MCP_SSE_PATH, async (c) => {
  try {
    // Ensure the global MCP service is initialized (for tools, etc.)
    // The DO might also need to ensure this or have resources passed.
    await mcpService.init(c);
    await mcpService.waitForReady();

    // Generate a unique ID for the session (or use an existing one if provided)
    const sessionId = crypto.randomUUID();
    const doId = c.env.MCP_SESSION_DO.idFromName(sessionId);
    const stub = c.env.MCP_SESSION_DO.get(doId);

    console.log(`[Worker] Forwarding GET /sse to DO ID: ${doId}`);

    // Forward the original raw request to the DO's fetch handler
    // Let the DO handle parsing its own path (/sse)
    // @ts-ignore - Suppress type errors related to Response incompatibility
    // Use type assertion to satisfy Hono handler signature
    return (await stub.fetch(c.req.raw)) as unknown as Response;
  } catch (error) {
    console.error(`[Worker GET /sse] Error: ${error}`);
    return c.text('Failed to initialize MCP SSE endpoint', 500);
  }
});

// --- POST /mcp/messages - Delegate to Durable Object ---
mcpRoutes.post(MCP_MESSAGES_PATH, async (c) => {
  let sessionId: string | null = null;
  try {
    // Note: No need to call mcpService.init/waitForReady here in the worker,
    // as the DO should handle ensuring the service is ready before processing.

    sessionId = c.req.query('session_id') ?? 'unknown';
    if (sessionId === 'unknown' || !sessionId) {
      console.warn('[Worker POST /messages] Missing or invalid session_id');
      return c.json(
        { error: 'Missing or invalid session_id query parameter' },
        400,
      );
    }

    // Get the Durable Object ID from the session ID
    const doId = c.env.MCP_SESSION_DO.idFromName(sessionId);
    const stub = c.env.MCP_SESSION_DO.get(doId);

    console.log(`[Worker] Forwarding POST /messages to DO ID: ${doId}`);

    // Forward the original raw request to the DO's fetch handler
    // Let the DO handle parsing its own path (/message)
    // @ts-ignore - Suppress type errors related to Response incompatibility
    // Use type assertion to satisfy Hono handler signature
    return (await stub.fetch(c.req.raw)) as unknown as Response;
  } catch (error) {
    console.error(`[Worker POST /messages ${sessionId}] Error:`, error);
    // Generic error response from the worker
    return c.json({ error: 'Failed to process message' }, 500);
  }
});

export default mcpRoutes;
