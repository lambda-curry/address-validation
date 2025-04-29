import { Hono } from 'hono';
import { mcpService } from '../mcp/service'; // Corrected path
import type { Bindings } from '../api'; // Import shared Bindings
import { StreamableHTTPServerTransport } from '../mcp/streamableHttp';

// --- Hono Router Setup ---
const mcpRoutes = new Hono<{ Bindings: Bindings }>();

// Single MCP Endpoint using Streamable HTTP Transport
mcpRoutes.post('/', async (c) => {
  try {
    // 1. Ensure MCP Service is initialized (loads tools)
    await mcpService.init(c);

    // 2. Get the MCP Server instance
    const server = mcpService.getServerInstance();
    if (!server) {
      console.error('[MCP] Server instance not available.');
      return c.text('MCP Server not initialized', 503); // Service Unavailable
    }

    // 3. Create the transport for this request
    // The transport expects an options object, including the request
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
    });

    // 4. Connect the server to the transport for this request
    // This handles the request processing and response streaming.
    await server.connect(transport);

    // 5. The transport handles the response, so we might not need to return anything explicitly from Hono.
    // However, returning c.res might be necessary depending on how Hono and the environment handle it.
    // If transport.connect() completes, the response is likely handled.
    // Let's return undefined or potentially c.res if needed.
    return undefined; // Or potentially c.res if transport doesn't fully control response flow
  } catch (error) {
    console.error(`[MCP] Error handling request: ${error}`);
    return c.text('Error processing message', 500);
  }
});

export default mcpRoutes;
