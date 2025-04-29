import type {
  JSONRPCRequest,
  JSONRPCResponse,
  JSONRPCErrorResponse,
  ServerInterface, // Import local interface
  Transport,
} from './types';

// Define more specific types if needed, or use Record<string, unknown>
interface ServerInfo {
  name: string;
  version: string;
  capabilities: Record<string, unknown>;
}
type ServerConfig = Record<string, unknown>;

/**
 * Custom MCP Server implementation adhering to ServerInterface
 */
export class Server implements ServerInterface {
  private info: ServerInfo;
  private config: ServerConfig;
  // Store handlers keyed by method name
  private requestHandlers: Map<
    string,
    (params: unknown, request: JSONRPCRequest) => Promise<unknown>
  > = new Map(); // Specify handler param/return types

  constructor(info: ServerInfo, config?: ServerConfig) {
    this.info = info;
    this.config = config ?? {};
  }

  /**
   * Set a request handler for a specific method name.
   * The handler receives the validated params and the full request object.
   */
  public setRequestHandler(
    schema: { method: string; params: Record<string, unknown> }, // Expect method in schema
    handler: (params: unknown, request: JSONRPCRequest) => Promise<unknown>, // Specify handler param/return types
  ): void {
    if (!schema || typeof schema.method !== 'string') {
      console.error('Invalid schema provided to setRequestHandler:', schema);
      throw new Error('Invalid schema: missing method string');
    }
    this.requestHandlers.set(schema.method, handler);
    console.log(`[MCP Server] Registered handler for method: ${schema.method}`);
  }

  /**
   * Connect to a transport (called by the transport itself during SSE setup).
   * This fulfills the Transport.connect(server) call.
   */
  public async connect(transport: Transport): Promise<void> {
    // The server doesn't store the transport per se;
    // it's passed in during receiveRequest for the specific session.
    console.log('[MCP Server] Transport connected for session.');
    // It needs to call the transport's connect method to complete the handshake
    // and allow the transport to send the initial 'endpoint' event.
    await transport.connect(this);
  }

  /**
   * Receive and handle an incoming JSON-RPC request using a specific transport
   * associated with the client's session.
   */
  public async receiveRequest(
    request: JSONRPCRequest,
    transport: Transport,
  ): Promise<void> {
    const { method, params, id } = request;

    if (id === undefined || id === null) {
      console.warn(
        '[MCP Server] Received request without ID. Ignoring notification.',
      );
      // MCP typically expects requests to have IDs for responses.
      // Decide if notifications (no ID) should be handled.
      return;
    }

    const handler = this.requestHandlers.get(method);

    if (!handler) {
      console.error(`[MCP Server] No handler for method: ${method}`);
      const errorResponse: JSONRPCErrorResponse = {
        jsonrpc: '2.0',
        error: { code: -32601, message: `Method not found: ${method}` },
        id: id,
      };
      await transport.sendError(errorResponse);
      return;
    }

    try {
      console.log(`[MCP Server] Handling method: ${method} (ID: ${id})`);
      // TODO: Add params validation against schema if possible/needed
      const result = await handler(params, request); // Pass params and full request

      const response: JSONRPCResponse = {
        jsonrpc: '2.0',
        result: result,
        id: id,
      };
      await transport.sendResponse(response);
      console.log(
        `[MCP Server] Sent response for method: ${method} (ID: ${id})`,
      );
    } catch (error) {
      console.error(
        `[MCP Server] Error handling method ${method} (ID: ${id}):`,
        error,
      );
      let errorMessage = 'Internal server error';
      const errorCode = -32000; // Generic server error;

      if (error instanceof Error) {
        errorMessage = error.message;
        // Check for specific error types or codes if needed
      }

      const errorResponse: JSONRPCErrorResponse = {
        jsonrpc: '2.0',
        error: { code: errorCode, message: errorMessage },
        id: id,
      };
      await transport.sendError(errorResponse);
    }
  }

  /**
   * Get server info - fulfills ServerInterface
   */
  public getInfo(): ServerInfo {
    return this.info;
  }

  // Not part of ServerInterface, but might be useful internally
  public getConfig(): ServerConfig {
    return this.config;
  }
}
