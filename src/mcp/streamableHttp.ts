import type {
  Transport,
  JSONRPCRequest,
  JSONRPCResponse,
  JSONRPCErrorResponse,
  ServerInterface, // Use local ServerInterface
} from './types';
import type { SSEStreamingApi } from 'hono/streaming'; // Import Hono SSE type

// Define a basic type for the server info structure (can be removed if ServerInterface covers it)
// interface ServerInfo {
//   name: string;
//   version: string;
//   capabilities: Record<string, unknown>;
// }

interface StreamableHTTPOptions {
  sse: SSEStreamingApi; // Hono's SSE API for sending events
  sessionId: string; // Session ID for this connection
  messageEndpoint: string; // The endpoint clients should POST messages to
}

/**
 * StreamableHTTP transport for MCP using Hono SSE
 * Sends events over an established SSE connection managed by Hono.
 */
export class StreamableHTTPServerTransport implements Transport {
  private sse: SSEStreamingApi;
  private sessionId: string;
  private messageEndpoint: string;
  private serverInfo: ReturnType<ServerInterface['getInfo']> | null = null; // Use return type of getInfo

  constructor(options: StreamableHTTPOptions) {
    this.sse = options.sse;
    this.sessionId = options.sessionId;
    this.messageEndpoint = options.messageEndpoint; // e.g., /mcp/messages
  }

  /**
   * Connect to an MCP server (called by Server instance)
   * Stores server info and sends the initial endpoint event.
   */
  public async connect(server: ServerInterface): Promise<void> {
    // Use ServerInterface type
    this.serverInfo = server.getInfo(); // Store info like name, version, capabilities
    console.log(
      `[MCP Transport ${this.sessionId}] Connected to server:`,
      this.serverInfo?.name,
    );
    this.sendEndpointEvent();
  }

  /**
   * Send the initial event telling the client where to POST messages.
   */
  private sendEndpointEvent(): void {
    const endpointUrl = `${this.messageEndpoint}?session_id=${this.sessionId}`;
    const event = {
      event: 'endpoint', // Standard MCP event name
      data: endpointUrl,
    };
    this.sendEvent(event);
    console.log(
      `[MCP Transport ${this.sessionId}] Sent endpoint event: ${endpointUrl}`,
    );
  }

  /**
   * Send a response to the client.
   */
  public async sendResponse(response: JSONRPCResponse): Promise<void> {
    this.sendEvent({
      event: 'message', // Standard MCP event name
      data: JSON.stringify(response),
    });
    // console.log(`[MCP Transport ${this.sessionId}] Sent response:`, response);
  }

  /**
   * Send an error to the client.
   */
  public async sendError(errorResponse: JSONRPCErrorResponse): Promise<void> {
    console.error(
      `[MCP Transport ${this.sessionId}] Sending error:`,
      errorResponse.error,
    );
    this.sendEvent({
      event: 'error', // Standard MCP event name
      data: JSON.stringify(errorResponse), // Send the full error response object
    });
  }

  /**
   * Helper to format and send an SSE event via Hono.
   */
  private sendEvent(event: { event: string; data: string }): void {
    // Check if stream is still writable (optional, sse.write might handle errors)
    // Format according to SSE spec
    const formattedEvent = `event: ${event.event}\ndata: ${event.data}\n\n`;
    try {
      this.sse.write(formattedEvent);
    } catch (error) {
      console.error(
        `[MCP Transport ${this.sessionId}] Failed to write SSE event:`,
        error,
      );
      // Consider closing the connection or logging further
    }
  }

  // No need for close/disconnect methods here as Hono's streamSSE handles the lifecycle
}
