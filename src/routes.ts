import { Hono } from 'hono';
import { SSEStreamingApi, streamSSE } from 'hono/streaming';
import { mcpService } from './mcp';
import { SSETransport } from './sse';

const router = new Hono();

// Store active connections
const transports: { [sessionId: string]: SSETransport } = {};

// Health check endpoint
router.get('/health', async (c) => {
  // Wait for MCP service to be ready
  await mcpService.waitForReady();

  const startTime = process.uptime();
  const uptime = Math.floor(startTime);
  const memory = process.memoryUsage();
  const toolCount = mcpService.getToolRegistry().list().length;

  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: `${uptime} seconds`,
    memory: {
      heapUsed: Math.round(memory.heapUsed / 1024 / 1024) + 'MB',
      heapTotal: Math.round(memory.heapTotal / 1024 / 1024) + 'MB',
    },
    version: process.version,
    mcp: {
      ready: mcpService.isReady(),
      tools: toolCount,
    },
  });
});

// SSE endpoint for MCP communication
router.get('/sse', (c) => {
  return streamSSE(
    c,
    async (stream) => {
      const transport = new SSETransport('/messages', stream);
      const sessionId = transport.sessionId;

      // Store transport by session ID
      transports[sessionId] = transport;

      console.log(`Client connected: ${sessionId}`);

      // Handle connection close
      stream.onAbort(() => {
        delete transports[sessionId];
        console.log(`Client disconnected: ${sessionId}`);
      });

      // Initialize tools with context
      try {
        // Initialize MCP service with Hono context
        await mcpService.init(c);

        // Set context on transport
        transport.setContext(c);
      } catch (error) {
        console.error(`Error initializing tools: ${error}`);
        return;
      }

      // Connect to MCP server
      try {
        await mcpService.connect(transport);
      } catch (error) {
        console.error(`Error connecting to MCP server: ${error}`);
        return;
      }

      // Keep connection alive
      while (!stream.closed) {
        try {
          await stream.sleep(30000);
        } catch (error) {
          console.error(`Error in SSE connection: ${error}`);
          break;
        }
      }
    },
    async (error: Error, stream: SSEStreamingApi) => {
      console.error(`Error in SSE connection: ${error}`);
      stream.close();
    },
  );
});

// Message handling endpoint
router.post('/messages', async (c) => {
  const sessionId = c.req.query('sessionId');

  if (!sessionId) {
    return c.text('Missing sessionId parameter', 400);
  }

  const transport = transports[sessionId as string];

  if (transport == null) {
    return c.text(`No active connection found for session: ${sessionId}`, 404);
  }

  try {
    return await transport.handlePostMessage(c);
  } catch (error) {
    console.error(`Error handling message: ${error}`);
    return c.text('Error processing message', 500);
  }
});

export { router };
