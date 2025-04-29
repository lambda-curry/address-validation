import type {
  DurableObjectState,
  DurableObjectNamespace,
  ExecutionContext,
} from '@cloudflare/workers-types';
import { Hono } from 'hono';
import { streamSSE, type SSEStreamingApi } from 'hono/streaming';

// Import types and services needed by the session
import { mcpService } from './service'; // Assuming mcpService is initialized by the main worker
import { StreamableHTTPServerTransport } from './streamableHttp';
import type { JSONRPCRequest, Transport } from './types';

export interface Env {
  // Define expected bindings passed from wrangler/sst
  MCP_SESSION_DO: DurableObjectNamespace;
  // Add other bindings if the DO needs them directly
  // DATABASE: D1Database;
  // API_KEY: string;
}

/**
 * MCPSession Durable Object
 *
 * Handles the state and communication for a single MCP client session.
 */
export class MCPSession {
  private state: DurableObjectState;
  private app: Hono<{ Bindings: Env }>;
  private env: Env;
  private sse: SSEStreamingApi | null = null;
  private transport: Transport | null = null;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.app = new Hono<{ Bindings: Env }>();

    // --- Define DO Routes ---

    // GET /sse - Establish the SSE connection for this DO instance
    this.app.get('/sse', async (c) => {
      return streamSSE(c, async (sseApi) => {
        console.log(`[DO ${this.state.id}] SSE connection opened`);
        this.sse = sseApi; // Store the SSE API object for this connection

        try {
          // Ensure the shared mcpService is ready (initialized by main worker)
          await mcpService.waitForReady();
          const serverInstance = mcpService.getServerInstance();

          // Create the transport linked to this SSE stream
          this.transport = new StreamableHTTPServerTransport({
            sse: this.sse,
            sessionId: this.state.id.toString(),
            // The client needs the *main worker's* message endpoint
            // We need a way to get the base URL or pass it in the request
            // Hardcoding for now, needs improvement
            messageEndpoint: '/mcp/messages',
          });

          // Connect the server logic to this specific transport
          await serverInstance.connect(this.transport);
          console.log(`[DO ${this.state.id}] Server connected to transport`);
        } catch (err) {
          console.error(`[DO ${this.state.id}] Error during SSE setup:`, err);
          if (this.sse) {
            // Check if sse is still valid before closing
            try {
              this.sse.close();
            } catch (_) {}
          }
          this.transport = null;
          this.sse = null;
        }

        // Handle client disconnect
        sseApi.onAbort(() => {
          console.log(
            `[DO ${this.state.id}] SSE connection aborted by client.`,
          );
          this.transport = null;
          this.sse = null;
          // Consider scheduling object deletion if inactive
          // this.state.storage.deleteAlarm();
          // this.state.storage.setAlarm(Date.now() + 60 * 60 * 1000); // e.g., cleanup after 1 hour
        });
      });
    });

    // POST /message - Handle incoming JSON-RPC messages for this session
    this.app.post('/message', async (c) => {
      console.log(`[DO ${this.state.id}] Received POST /message`);
      // Ensure the SSE connection and transport are active
      if (!this.transport || !this.sse) {
        console.error(
          `[DO ${this.state.id}] Transport or SSE not ready for message.`,
        );
        return c.json(
          { error: 'Internal server error: Session not ready' },
          500,
        );
      }

      // Ensure the shared mcpService is ready
      await mcpService.waitForReady();
      const serverInstance = mcpService.getServerInstance();

      try {
        const requestBody = await c.req.json<JSONRPCRequest>();
        console.log(
          `[DO ${this.state.id}] Processing method:`,
          requestBody?.method,
        );

        // Process the request using the server instance and *this DO's transport*
        await serverInstance.receiveRequest(requestBody, this.transport);

        // Respond HTTP 202 Accepted - actual response goes via SSE
        return c.body(null, 202);
      } catch (err) {
        console.error(`[DO ${this.state.id}] Error processing message:`, err);
        // Attempt to send error back over SSE
        if (this.transport) {
          // Check transport again, might have disconnected
          try {
            // Try to extract ID from the original request if it was parsed and attached to the error
            let requestId: string | number | null = null;
            // Type guard to check if error might have the requestBody
            if (
              err instanceof Error &&
              typeof err === 'object' &&
              err !== null &&
              'requestBody' in err
            ) {
              const potentialRequestBody = (
                err as { requestBody?: { id?: string | number | null } }
              ).requestBody;
              if (
                potentialRequestBody &&
                (typeof potentialRequestBody.id === 'string' ||
                  typeof potentialRequestBody.id === 'number')
              ) {
                requestId = potentialRequestBody.id;
              }
            }

            await this.transport.sendError({
              jsonrpc: '2.0',
              error: {
                code: -32000,
                message:
                  err instanceof Error
                    ? err.message
                    : 'Failed to process message',
              },
              id: requestId,
            });
          } catch (sseErr) {
            console.error(
              `[DO ${this.state.id}] Failed to send error over SSE:`,
              sseErr,
            );
          }
        }
        // Return HTTP error
        return c.json({ error: 'Failed to process message' }, 500);
      }
    });
  }

  // fetch handler routes requests to the Hono app
  async fetch(request: Request): Promise<Response> {
    console.log(
      `[DO ${this.state.id}] Class Fetch: ${request.method} ${request.url}`,
    );
    // Ensure mcpService is initialized (assuming main worker handles this)
    try {
      await mcpService.waitForReady();
    } catch (initError) {
      console.error(
        `[DO ${this.state.id}] MCP Service failed to initialize:`,
        initError,
      );
      return new Response('MCP Service unavailable', { status: 503 });
    }
    // Route the request using the internal Hono app
    return this.app.fetch(request, this.env);
  }

  // Example Alarm for cleanup (requires setAlarm in onAbort)
  // async alarm() {
  //   console.log(`[DO ${this.state.id}] Alarm triggered, cleaning up state.`);
  //   await this.state.storage.deleteAll();
  // }
}

// --- ES Module Worker Export ---
// This satisfies Wrangler when `main` points to this file
// and `new_classes` is used.
// This fetch handler might not be directly called if requests
// are always routed via `env.MCP_SESSION_DO.get(id).fetch()`.
export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    // This top-level fetch is generally NOT used for DO requests,
    // as requests are routed to specific object instances via `stub.fetch()`.
    // However, Wrangler requires a valid module export.
    console.warn('[DO Script] Top-level fetch handler invoked unexpectedly.');
    // You could potentially route to a default DO instance here if needed,
    // but it's often better to return an error or a simple response.
    return new Response(
      'Durable Object script entry point. Access via worker binding.',
      { status: 400 },
    );
  },
};
